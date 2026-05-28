/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 ai 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：路由只保留 req/res 與權限入口，AI provider、prompt、fallback 與紀錄寫入邏輯放在 services/aiHelperService.js。
 */

const express = require("express");

const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");
const {
  MAX_BARRAGE_COINS,
  HELP_USES_PER_COIN,
  ensureStudentCoinBalance,
  ensureStudentCoinBalanceWithConnection,
  ensureAiHelperUnlockTable,
  insertAiHelperRecord,
  generateAiHelperReply,
} = require("../services/aiHelperService");

function createAiRoutes({ getActor }) {
  const router = express.Router();

  router.get("/api/ai-helper/status", authenticateToken, async (req, res) => {
    try {
      const scope = String(req.query?.scope || "cards").slice(0, 40);
      const roundKey = String(req.query?.roundKey || req.query?.round || "round-1").slice(0, 80);
      await ensureAiHelperUnlockTable();
      await ensureStudentCoinBalance(req.user.id);
      await pool.query(
        "UPDATE users SET barrage_coins = LEAST(COALESCE(barrage_coins, 0), ?) WHERE id = ?",
        [MAX_BARRAGE_COINS, req.user.id],
      );
      const [[coinRow]] = await pool.query("SELECT barrage_coins FROM users WHERE id = ?", [req.user.id]);
      const [[unlockRow]] = await pool.query(
        "SELECT id, unlocked_at AS unlockedAt FROM ai_helper_unlocks WHERE user_id = ? AND round_key = ? AND scope = ? LIMIT 1",
        [req.user.id, roundKey, scope],
      );
      res.json({
        unlocked: Boolean(unlockRow),
        unlockedAt: unlockRow?.unlockedAt || null,
        coins: Number(coinRow?.barrage_coins) || 0,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取 AI 幫幫忙狀態失敗" });
    }
  });

  router.post("/api/ai-helper/unlock", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const scope = String(req.body?.scope || "cards").slice(0, 40);
      const roundKey = String(req.body?.roundKey || req.body?.round || "round-1").slice(0, 80);
      await ensureAiHelperUnlockTable(connection);
      await ensureStudentCoinBalance(req.user.id);
      await connection.beginTransaction();
      await ensureStudentCoinBalanceWithConnection(connection, req.user.id);
      const [[user]] = await connection.query(
        `SELECT u.username, u.role, u.group_id, u.barrage_coins
         FROM users u
         WHERE u.id = ?
         FOR UPDATE`,
        [req.user.id],
      );
      if ((user?.role || req.user.role) === "teacher") {
        await connection.rollback();
        return res.status(403).json({ message: "教師不需要投幣解鎖 AI 幫幫忙" });
      }
      const forceCharge = Boolean(req.body?.forceCharge || req.body?.renew || req.body?.chargeAgain);
      const [[existing]] = await connection.query(
        "SELECT id FROM ai_helper_unlocks WHERE user_id = ? AND round_key = ? AND scope = ? LIMIT 1",
        [req.user.id, roundKey, scope],
      );
      if (existing && !forceCharge) {
        await connection.commit();
        return res.json({ message: "本回合已解鎖", unlocked: true, coins: Number(user?.barrage_coins) || 0 });
      }
      const coins = Number(user?.barrage_coins) || 0;
      const isRenewal = Boolean(existing && forceCharge);
      if (coins < 1) {
        await connection.rollback();
        return res.status(400).json({ message: "coin 不足，完成探究調查書可以獲得 coin" });
      }
      await connection.query("UPDATE users SET barrage_coins = barrage_coins - 1 WHERE id = ?", [req.user.id]);
      if (existing) {
        await connection.query(
          "UPDATE ai_helper_unlocks SET unlocked_at = CURRENT_TIMESTAMP WHERE id = ?",
          [existing.id],
        );
      } else {
        await connection.query(
          "INSERT INTO ai_helper_unlocks (user_id, round_key, scope) VALUES (?, ?, ?)",
          [req.user.id, roundKey, scope],
        );
      }
      await connection.commit();
      await insertStudentActivityLog({
        userId: req.user.id,
        username: user?.username || req.user.username || null,
        role: user?.role || req.user.role || "student",
        groupId: user?.group_id || null,
        eventType: isRenewal ? "ai_helper_renew" : "ai_helper_unlock",
        eventLabel: isRenewal ? "續費 AI 幫幫忙" : "投幣解鎖 AI 幫幫忙",
        targetType: "ai_helper",
        targetId: `${scope}:${roundKey}`,
        newValue: { cost: 1, coinsAfter: coins - 1, scope, roundKey, forceCharge },
      });
      await insertAiHelperRecord({
        userId: req.user.id,
        username: user?.username || req.user.username || null,
        groupId: user?.group_id || null,
        roundKey,
        scope,
        sessionId: req.body?.sessionId || null,
        actionType: isRenewal ? "renew" : "unlock",
        requestText: isRenewal ? "續費 AI 幫幫忙" : "投幣解鎖 AI 幫幫忙",
        helpCredits: HELP_USES_PER_COIN,
      });
      res.json({
        message: isRenewal ? "AI 幫幫忙已續費" : "AI 幫幫忙已解鎖",
        unlocked: true,
        coins: coins - 1,
        credits: HELP_USES_PER_COIN,
      });
    } catch (error) {
      await connection.rollback();
      console.error(error);
      res.status(500).json({ message: "解鎖 AI 幫幫忙失敗" });
    } finally {
      connection.release();
    }
  });

  router.post("/api/ai-helper/records/event", authenticateToken, async (req, res) => {
    try {
      const actor = await getActor(req.user.id, req.user);
      if (actor.role === "teacher") return res.status(403).json({ message: "教師不需要記錄 AI 幫幫忙使用紀錄" });
      const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};
      const roundKey = String(req.body?.roundKey || req.body?.round || context.roundKey || "round-1").slice(0, 80);
      const scope = String(req.body?.scope || context.pageKey || "cards").slice(0, 40);
      const actionType = String(req.body?.actionType || "event").slice(0, 40);
      await insertAiHelperRecord({
        userId: actor.userId,
        username: actor.username,
        groupId: actor.groupId,
        roundKey,
        scope,
        sessionId: req.body?.sessionId || null,
        needType: req.body?.needType || null,
        helpCategory: req.body?.helpCategory || null,
        actionType,
        requestText: req.body?.requestText || req.body?.text || null,
        responseText: req.body?.responseText || null,
        responseSource: req.body?.responseSource || null,
        gapScope: req.body?.gapScope || context.gapScope || null,
        context,
        helpCredits: req.body?.helpCredits,
        turnsInHelp: req.body?.turnsInHelp,
        checksInHelp: req.body?.checksInHelp,
      });
      res.json({ message: "AI 幫幫忙紀錄已儲存" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "儲存 AI 幫幫忙紀錄失敗" });
    }
  });

  router.post("/api/ai/chat", authenticateToken, async (req, res) => {
    try {
      const needType = String(req.body?.needType || req.body?.aiMode || "direction");
      const message = String(req.body?.message || "").trim();
      const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};
      const aiReply = await generateAiHelperReply({ needType, message, context });
      const actor = await getActor(req.user.id, req.user);
      await insertAiHelperRecord({
        userId: actor.userId,
        username: actor.username,
        groupId: actor.groupId,
        roundKey: req.body?.roundKey || context.roundKey || "round-1",
        scope: req.body?.scope || context.pageKey || "cards",
        sessionId: req.body?.sessionId || null,
        needType,
        helpCategory: context.helpCategory || null,
        actionType: "chat",
        requestText: message,
        responseText: aiReply.reply,
        responseSource: aiReply.source,
        provider: aiReply.provider,
        isFallback: aiReply.isFallback,
        gapScope: context.gapScope || null,
        context,
        helpCredits: req.body?.helpCredits,
        turnsInHelp: req.body?.turnsInHelp,
        checksInHelp: req.body?.checksInHelp,
      });
      res.json({
        reply: aiReply.reply,
        aiMode: needType,
        source: aiReply.source,
        provider: aiReply.provider,
        isFallback: aiReply.isFallback,
        warning: aiReply.warning,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "AI 暫時無法回覆" });
    }
  });

  return router;
}

module.exports = createAiRoutes;
