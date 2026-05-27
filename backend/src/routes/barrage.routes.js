/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 barrage 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");

const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");
const { ensureStudentCoinBalance } = require("../services/users");

const router = express.Router();

const BARRAGE_MAX_LENGTH = 20;
const MAX_BARRAGE_COINS = 10;
const BAD_WORDS = [
  "幹", "靠", "操", "淦", "肏", "屌", "雞掰", "機掰", "靠北", "靠杯", "靠腰",
  "媽的", "他媽", "他媽的", "三小", "殺小", "白癡", "智障", "腦殘", "低能",
  "垃圾", "廢物", "去死", "王八蛋", "混蛋", "爛人", "醜八怪", "北七", "87",
  "哭爸", "哭夭", "賤", "賤人", "死胖子", "死矮子", "臭三八", "破麻",
  "fuck", "fuk", "fck", "shit", "bitch", "asshole", "idiot", "stupid", "damn",
  "trash", "loser", "kill yourself", "kys",
];

function normalizeBarrageText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[~!@#$%^&*()_+\-={}\[\]:";'<>?,.\/\\|，。！？、；：「」『』（）【】《》]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a");
}

function containsBadWords(text) {
  const normalized = normalizeBarrageText(text);
  return BAD_WORDS.some((word) => normalized.includes(normalizeBarrageText(word)));
}

router.get("/barrage-status", authenticateToken, async (req, res) => {
  try {
    await ensureStudentCoinBalance(req.user.id);
    await pool.query(
      "UPDATE users SET barrage_coins = LEAST(COALESCE(barrage_coins, 0), ?) WHERE id = ?",
      [MAX_BARRAGE_COINS, req.user.id],
    );
    const [[row]] = await pool.query("SELECT barrage_coins FROM users WHERE id = ?", [req.user.id]);
    res.json({ coins: Number(row?.barrage_coins) || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取彈幕 coin 失敗" });
  }
});

router.get("/barrages/latest-id", authenticateToken, async (req, res) => {
  try {
    const [[row]] = await pool.query("SELECT COALESCE(MAX(id), 0) AS latestId FROM barrages");
    res.json({ latestId: Number(row?.latestId) || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取最新彈幕 ID 失敗" });
  }
});

router.get("/barrages", authenticateToken, async (req, res) => {
  try {
    const afterId = Math.max(Number(req.query.afterId) || 0, 0);
    const [rows] = await pool.query(
      `SELECT b.id, b.user_id AS userId, u.username, b.content, b.created_at AS createdAt
       FROM barrages b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id > ?
       ORDER BY b.id ASC
       LIMIT 20`,
      [afterId],
    );
    res.json({ barrages: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取彈幕失敗" });
  }
});

router.post("/barrages", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ message: "請輸入彈幕內容" });
    if (content.length > BARRAGE_MAX_LENGTH) return res.status(400).json({ message: "彈幕最多 20 個字" });
    if (containsBadWords(content)) return res.status(400).json({ message: "彈幕內容包含不適當字詞，請重新輸入" });

    await ensureStudentCoinBalance(req.user.id);
    await connection.beginTransaction();
    const [[user]] = await connection.query(
      `SELECT u.username, u.role, u.group_id, u.barrage_coins
       FROM users u
       WHERE u.id = ?
       FOR UPDATE`,
      [req.user.id],
    );

    const role = user?.role || req.user.role || "student";
    if (role === "teacher") {
      await connection.rollback();
      return res.status(403).json({ message: "教師不能使用學生彈幕 coin" });
    }

    const coins = Number(user?.barrage_coins) || 0;
    if (coins < 1) {
      await connection.rollback();
      return res.status(400).json({ message: "coin 不足，完成探究調查書可以獲得 5 coin" });
    }

    await connection.query("UPDATE users SET barrage_coins = barrage_coins - 1 WHERE id = ?", [req.user.id]);
    const [result] = await connection.query(
      "INSERT INTO barrages (user_id, content) VALUES (?, ?)",
      [req.user.id, content],
    );
    await connection.commit();

    await insertStudentActivityLog({
      userId: req.user.id,
      username: user?.username || req.user.username || null,
      role,
      groupId: user?.group_id || null,
      eventType: "barrage_send",
      eventLabel: "送出彈幕",
      targetType: "barrage",
      targetId: String(result.insertId),
      newValue: { content, cost: 1, coinsAfter: coins - 1 },
    });

    res.json({
      message: "彈幕已送出",
      coins: coins - 1,
      barrage: {
        id: result.insertId,
        userId: req.user.id,
        username: user?.username || req.user.username || null,
        content,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "送出彈幕失敗" });
  } finally {
    connection.release();
  }
});

module.exports = router;
