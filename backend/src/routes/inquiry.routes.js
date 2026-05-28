/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 inquiry 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");
const pool = require("../db");
const { ensureInquiryNormalizedTables } = require("../services/schemaUtils");
const {
  MAX_BARRAGE_COINS,
  FINAL_SUMMARY_COIN_REWARD,
  stringify,
  stableJSONString,
  ensureStudentCoinBalanceWithConnection,
  getActor,
  insertStudentActivityLog,
  readInquiryData,
  replaceInquiryRecords,
  replaceTitles,
  replaceCards,
  normalizeFinalSummaryData,
  upsertSummaryByPlanLink,
  mergeTitlesById,
  getInvestigationTitlesForCompletedCount,
  countCompletedFinalSummaries,
} = require("../services/inquiryData");

const router = express.Router();

router.post("/records", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const requestedOrder = Number(req.body?.recordOrder || 0);
    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);

    let recordOrder = Number.isFinite(requestedOrder) && requestedOrder > 0 ? requestedOrder : null;

    if (!recordOrder) {
      const [latestRows] = await connection.query(
        `SELECT record_order
         FROM inquiry_records
         WHERE user_id = ?
         ORDER BY record_order DESC
         LIMIT 1
         FOR UPDATE`,
        [userId],
      );
      recordOrder = (Number(latestRows[0]?.record_order) || 0) + 1;
    }

    const [[existingRow]] = await connection.query(
      `SELECT id, started_at FROM inquiry_records WHERE user_id = ? AND record_order = ? FOR UPDATE`,
      [userId, recordOrder],
    );

    let createdAt = existingRow?.started_at;
    if (!existingRow) {
      const [result] = await connection.query(
        `INSERT INTO inquiry_records (user_id, record_order, started_at)
         VALUES (?, ?, NOW())`,
        [userId, recordOrder],
      );
      const [[createdRow]] = await connection.query(
        `SELECT started_at FROM inquiry_records WHERE id = ?`,
        [result.insertId],
      );
      createdAt = createdRow?.started_at;
    }

    await connection.commit();
    res.json({
      message: "已建立新調查書",
      recordOrder,
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "建立新調查書失敗" });
  } finally {
    connection.release();
  }
});

router.get("/", async (req, res) => {
  try {
    res.json(await readInquiryData(req.user.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取探究資料失敗" });
  }
});

router.post("/plans", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const introStage = req.body?.introStage;
    const createdAt = req.body?.orientationCreatedAt || req.body?.createdAt;
    if (!createdAt) return res.status(400).json({ message: "缺少開始調查時間" });
    const recordOrder = Number(req.body?.recordOrder) || oldData.inquiryPlans.length + 1;
    const nextPlan = { introStage, recordOrder, orientationCreatedAt: createdAt };

    // 防止同一次「開始調查」被前端重複觸發時，重複新增 inquiry plan 與重複寫入 student_activity_logs。
    // 以前端產生的 orientationCreatedAt 作為主要冪等鍵；若舊資料沒有時間戳，則退回用 recordOrder + introStage 比對。
    const nextIntroStageKey = stableJSONString(introStage);
    const alreadyExists = oldData.inquiryPlans.some((plan) => {
      if (plan?.orientationCreatedAt && plan.orientationCreatedAt === createdAt) return true;

      const sameRecordOrder = Number(plan?.recordOrder) === recordOrder;
      const sameIntroStage = stableJSONString(plan?.introStage) === nextIntroStageKey;
      return sameRecordOrder && sameIntroStage;
    });

    if (alreadyExists) {
      return res.json({
        message: "探究前導問題已儲存",
        inquiryPlans: oldData.inquiryPlans,
        duplicated: true,
      });
    }

    const nextPlans = [...oldData.inquiryPlans, nextPlan];

    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);
    await replaceInquiryRecords(connection, userId, nextPlans, oldData.finalSummaries);
    await connection.commit();

    const actor = await getActor(userId, req.user);
    await insertStudentActivityLog({
      ...actor,
      eventType: "inquiry_plan_create",
      eventLabel: "完成探究調查前導問題",
      targetType: "inquiry_intro",
      newValue: { introStage },
      metadata: { orientationCreatedAt: createdAt },
    });

    res.json({ message: "探究前導問題已儲存", inquiryPlans: nextPlans });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究前導問題失敗" });
  } finally {
    connection.release();
  }
});

router.put("/plans", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const nextInquiryPlans = Array.isArray(req.body.inquiryPlans) ? req.body.inquiryPlans : [];

    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);
    await replaceInquiryRecords(connection, userId, nextInquiryPlans, oldData.finalSummaries);
    await connection.commit();
    res.json({ message: "探究計畫已儲存" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究計畫失敗" });
  } finally {
    connection.release();
  }
});

router.post("/investigations", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const syncReason = String(req.body?.summary?.syncReason || "");
    const investigationSummary = normalizeFinalSummaryData(req.body?.summary);
    const nextFinalSummaries = upsertSummaryByPlanLink(oldData.finalSummaries, {
      ...investigationSummary,
      evidenceCards: [],
      conclusion: "",
    });

    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);
    const { normalizedSummaries } = await replaceInquiryRecords(connection, userId, oldData.inquiryPlans, nextFinalSummaries);
    const nextEarnedTitles = mergeTitlesById(
      oldData.earnedTitles,
      getInvestigationTitlesForCompletedCount(countCompletedFinalSummaries(normalizedSummaries)),
    );
    await replaceTitles(connection, userId, nextEarnedTitles);
    await connection.commit();

    if (syncReason === "finish") {
      await insertStudentActivityLog({
        ...(await getActor(userId, req.user)),
        eventType: "investigation_finish",
        eventLabel: "結束數據探究並確認本回合解鎖卡牌",
        targetType: "investigation",
        newValue: {
          orientationCreatedAt: investigationSummary.orientationCreatedAt,
          investigationCreatedAt: investigationSummary.investigationCreatedAt,
          investigationCardCount: investigationSummary.investigationCards.length,
        },
      });
    }

    res.json({ message: "本回合解鎖卡牌已同步儲存", finalSummaries: nextFinalSummaries });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存本回合解鎖卡牌失敗" });
  } finally {
    connection.release();
  }
});

router.post("/final-summaries", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const summary = normalizeFinalSummaryData(req.body?.summary);
    const nextFinalSummaries = upsertSummaryByPlanLink(oldData.finalSummaries, summary);

    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);
    const { normalizedSummaries } = await replaceInquiryRecords(connection, userId, oldData.inquiryPlans, nextFinalSummaries);
    const newSummaryCount = Math.max(
      0,
      countCompletedFinalSummaries(normalizedSummaries) - countCompletedFinalSummaries(oldData.finalSummaries),
    );
    if (newSummaryCount > 0) {
      await connection.query(
        `UPDATE users
         SET barrage_coins = LEAST(COALESCE(barrage_coins, 0) + ?, ?)
         WHERE id = ?`,
        [newSummaryCount * FINAL_SUMMARY_COIN_REWARD, MAX_BARRAGE_COINS, userId],
      );
    }
    const nextEarnedTitles = mergeTitlesById(
      oldData.earnedTitles,
      getInvestigationTitlesForCompletedCount(countCompletedFinalSummaries(normalizedSummaries)),
    );
    await replaceTitles(connection, userId, nextEarnedTitles);
    await connection.commit();

    const actor = await getActor(userId, req.user);
    if (newSummaryCount > 0) {
      await insertStudentActivityLog({
        ...actor,
        eventType: "coin_reward",
        eventLabel: `完成探究調查書獲得 ${newSummaryCount * FINAL_SUMMARY_COIN_REWARD} coin`,
        targetType: "barrage_coin",
        newValue: { amount: newSummaryCount * FINAL_SUMMARY_COIN_REWARD },
      });
      await insertStudentActivityLog({
        ...actor,
        eventType: "final_summary_submit",
        eventLabel: "送出數據探究總結",
        targetType: "summary",
        targetId: String(nextFinalSummaries.length),
        previousValue: { summaryCount: oldData.finalSummaries.length },
        newValue: { summaryCount: nextFinalSummaries.length, latestSummary: nextFinalSummaries.at(-1) || null },
      });
    }

    const [[coinRow]] = await pool.query("SELECT barrage_coins FROM users WHERE id = ?", [userId]);
    res.json({ message: "探究總結已儲存", finalSummaries: nextFinalSummaries, barrageCoins: Number(coinRow?.barrage_coins) || 0 });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究總結失敗" });
  } finally {
    connection.release();
  }
});

router.put("/final-summaries", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const nextFinalSummaries = Array.isArray(req.body.finalSummaries) ? req.body.finalSummaries : [];
    const oldData = await readInquiryData(userId);

    await ensureInquiryNormalizedTables();
    await connection.beginTransaction();
    await ensureStudentCoinBalanceWithConnection(connection, userId);
    await replaceInquiryRecords(connection, userId, oldData.inquiryPlans, nextFinalSummaries);
    await connection.commit();
    res.json({ message: "探究總結已儲存" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究總結失敗" });
  } finally {
    connection.release();
  }
});

router.put("/titles", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const requestedTitles = Array.isArray(req.body.earnedTitles) ? req.body.earnedTitles : [];
    const nextEarnedTitles = mergeTitlesById(
      oldData.earnedTitles,
      requestedTitles,
      getInvestigationTitlesForCompletedCount(countCompletedFinalSummaries(oldData.finalSummaries)),
    );

    await connection.beginTransaction();
    await replaceTitles(connection, userId, nextEarnedTitles);
    await connection.commit();

    if (stringify(oldData.earnedTitles) !== stringify(nextEarnedTitles)) {
      await insertStudentActivityLog({
        ...(await getActor(userId, req.user)),
        eventType: "title_reward",
        eventLabel: "稱號獲得更新",
        targetType: "titles",
        previousValue: oldData.earnedTitles,
        newValue: nextEarnedTitles,
      });
    }

    res.json({ message: "探究稱號已儲存" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究稱號失敗" });
  } finally {
    connection.release();
  }
});

router.put("/cards", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const oldData = await readInquiryData(userId);
    const nextUnlockedCards = Array.isArray(req.body.unlockedCards) ? req.body.unlockedCards : [];

    await connection.beginTransaction();
    await replaceCards(connection, userId, nextUnlockedCards);
    await connection.commit();

    // /cards 是資料同步端點；學生的實際解鎖動作已由 card_unlock / card_content_update 紀錄，這裡不再寫活動紀錄，避免同一件事出現兩種名稱。

    res.json({ message: "探究卡牌已儲存" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "儲存探究卡牌失敗" });
  } finally {
    connection.release();
  }
});

module.exports = router;
