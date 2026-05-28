/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 voting 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");

const pool = require("../db");
const { authenticateToken, requireTeacher } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");
const { createVotingService, SUSPECT_ROLES, SUSPECT_ROLE_IDS } = require("../services/votingService");

function createVotingRoutes({
  votingService,
  getActor,
  getGameSetting,
  setGameSetting,
  publishRealtimeEvent,
}) {
  const router = express.Router();

  router.get("/api/final-decision-settlement", authenticateToken, async (req, res) => {
    try {
      res.json(await votingService.buildFinalDecisionSettlement());
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取決策結算狀態失敗" });
    }
  });

  router.post("/api/final-decision-settlement", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const settlement = await votingService.calculateFinalDecisionSettlement(req.user.id);
      await setGameSetting("final_decision_settlement", settlement);

      publishRealtimeEvent("final-decision-settlement", settlement);
      publishRealtimeEvent("teacher-controls", { finalDecisionSettlement: settlement });

      res.json({ message: `決策結算完成：${settlement.outcome.title}`, ...settlement });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "決策結算失敗" });
    }
  });

  router.post("/api/final-decision-settlement/close", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const closedSettlement = {
        isFinalized: false,
        closedAt: new Date().toISOString(),
        closedBy: req.user.id,
      };

      await setGameSetting("final_decision_settlement", closedSettlement);

      publishRealtimeEvent("final-decision-settlement", closedSettlement);
      publishRealtimeEvent("teacher-controls", { finalDecisionSettlement: closedSettlement });

      res.json({ message: "已關閉決策結算，學生端可回到遊戲流程。", ...closedSettlement });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "關閉決策結算失敗" });
    }
  });

  router.get("/api/suspect-voting-status", authenticateToken, async (req, res) => {
    try {
      res.json(await votingService.buildSuspectVotingPayload(req.user.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取嫌犯投票狀態失敗" });
    }
  });

  router.put("/api/suspect-voting-status", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const isOpen = Boolean(req.body?.isOpen);
      const previousStatus = await getGameSetting("suspect_voting_status", {
        isOpen: false,
        isFinalized: false,
        finalizedSuspects: [],
        finalizedAt: null,
      });
      const nextStatus = isOpen
        ? { isOpen: true, isFinalized: false, finalizedSuspects: [], finalizedAt: null }
        : {
            isOpen: false,
            isFinalized: Boolean(previousStatus.isFinalized),
            finalizedSuspects: Array.isArray(previousStatus.finalizedSuspects)
              ? previousStatus.finalizedSuspects
              : [],
            finalizedAt: previousStatus.finalizedAt || null,
          };
      await setGameSetting("suspect_voting_status", nextStatus);
      const payload = await votingService.buildSuspectVotingPayload(req.user.id);
      publishRealtimeEvent("suspect-voting-status", payload);
      publishRealtimeEvent("teacher-controls", { suspectVoting: payload });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "更新嫌犯投票狀態失敗" });
    }
  });

  router.post("/api/suspect-votes", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const status = await getGameSetting("suspect_voting_status", { isOpen: false, isFinalized: false });
      if (!status.isOpen || status.isFinalized) return res.status(403).json({ message: "目前未開放嫌犯投票" });

      const actor = await getActor(req.user.id, req.user);
      if (actor.role === "teacher") return res.status(403).json({ message: "教師不能送出學生投票" });

      await votingService.ensureSuspectVotesTable();

      const rawRanking = Array.isArray(req.body?.ranking)
        ? req.body.ranking
        : Array.isArray(req.body?.roleIds)
          ? req.body.roleIds
          : Array.isArray(req.body?.groupIds)
            ? req.body.groupIds
            : [];
      const ranking = rawRanking.map(String).filter((roleId) => SUSPECT_ROLE_IDS.has(roleId));
      const uniqueRanking = Array.from(new Set(ranking));
      if (uniqueRanking.length !== SUSPECT_ROLES.length) {
        return res.status(400).json({ message: "請把六個角色由最相關排到最不相關後再送出" });
      }

      await connection.beginTransaction();
      const [[existingVoteRow]] = await connection.query(
        "SELECT COUNT(*) AS count FROM suspect_votes WHERE user_id = ? FOR UPDATE",
        [req.user.id],
      );
      if (Number(existingVoteRow?.count || 0) > 0) {
        await connection.rollback();
        return res.status(409).json({ message: "你已經完成投票，不能重複投票" });
      }

      for (const [index, roleId] of uniqueRanking.entries()) {
        await connection.query(
          "INSERT INTO suspect_votes (user_id, role_id, rank_position) VALUES (?, ?, ?)",
          [req.user.id, roleId, index + 1],
        );
      }
      await connection.commit();

      await insertStudentActivityLog({
        ...actor,
        eventType: "suspect_vote_submit",
        eventLabel: "送出嫌犯排序投票",
        targetType: "suspect_voting",
        newValue: { ranking: uniqueRanking, topRoleId: uniqueRanking[0] },
      });

      const payload = await votingService.buildSuspectVotingPayload(req.user.id);
      publishRealtimeEvent("suspect-votes-updated", { userId: req.user.id, ranking: uniqueRanking, topRoleId: uniqueRanking[0], voting: payload });
      res.json(payload);
    } catch (error) {
      await connection.rollback();
      console.error(error);
      res.status(500).json({ message: "送出嫌犯投票失敗" });
    } finally {
      connection.release();
    }
  });

  router.post("/api/suspect-voting-finish", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const currentPayload = await votingService.buildSuspectVotingPayload(req.user.id);
      const nextStatus = {
        isOpen: false,
        isFinalized: true,
        finalizedSuspects: votingService.resolveSuspectVotingWinners(currentPayload.totals),
        finalizedAt: new Date().toISOString(),
      };
      await setGameSetting("suspect_voting_status", nextStatus);
      const payload = await votingService.buildSuspectVotingPayload(req.user.id);
      publishRealtimeEvent("suspect-voting-status", payload);
      publishRealtimeEvent("teacher-controls", { suspectVoting: payload });
      res.json(payload);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "結算嫌犯投票失敗" });
    }
  });

  return router;
}

module.exports = { createVotingRoutes, createVotingService };
