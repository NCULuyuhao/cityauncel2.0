/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 groupCardPack 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");

function createGroupCardPackRoutes({
  pool,
  authenticateToken,
  getRequestUserProfile,
  publishRealtimeEvent,
  insertStudentActivityLog,
  decisioncardService,
}) {
  const router = express.Router();
  const {
    ensureDecisioncardsTable,
    insertDecisioncardLog,
    buildTeacherDecisioncardsPayload,
    getDecisioncardByGroupId,
    upsertDecisioncard,
    getCurrentDecisionRound,
    getAcceptedDecisioncards,
    getDecisioncardVotes,
    getDecisioncardVoteSubmissions,
    upsertDecisioncardVote,
    upsertDecisioncardVoteSubmission,
    calculateRoundScores,
    getDecisioncardRoundHistory,
    getDecisioncardGroupScores,
  } = decisioncardService;

  router.get("/api/group-card-pack-lock", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      const groupId = user?.group_id || null;
      if (!groupId) return res.json({ lock: null });

      await ensureDecisioncardsTable();
      const roundNo = await getCurrentDecisionRound();
      const lock = await getDecisioncardByGroupId(groupId);
      if (!lock || (Number(lock.roundNo) || 1) !== roundNo) return res.json({ lock: null, roundNo });

      return res.json({
        lock: {
          groupId: lock.groupId,
          selectedCardIds: lock.selectedCardIds,
          lockedBy: lock.lockedBy,
          reason: lock.reason || "",
          coreCardId: lock.coreCardId || null,
          roundNo: lock.roundNo || 1,
          lockedAt: lock.lockedAt,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "讀取小組卡包鎖定狀態失敗" });
    }
  });


  router.get("/api/decision-card-game", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      const groupId = user?.group_id || null;
      await ensureDecisioncardsTable();
      const roundNo = await getCurrentDecisionRound();
      const proposals = await decisioncardService.getAllDecisioncards();
      const votes = await getDecisioncardVotes({ roundNo });
      const voteSubmissions = await getDecisioncardVoteSubmissions({ roundNo });
      const acceptedCards = await getAcceptedDecisioncards();
      const roundHistory = await getDecisioncardRoundHistory();
      const groupScores = await getDecisioncardGroupScores();
      const roundResult = calculateRoundScores(proposals.filter((p) => (Number(p.roundNo) || 1) === roundNo), votes);
      return res.json({
        groupId,
        isGroupLeader: Boolean(user?.is_group_leader),
        roundNo,
        proposals,
        votes,
        voteSubmissions,
        myVotes: votes.filter((vote) => String(vote.voterGroupId) === String(groupId)),
        acceptedCards,
        roundHistory,
        groupScores,
        roundPreview: roundResult,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "讀取決策卡遊戲狀態失敗" });
    }
  });

  router.put("/api/decision-card-game/votes", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      const voterGroupId = user?.group_id || null;
      if (!voterGroupId) return res.status(400).json({ message: "尚未分配小組，無法投票" });
      if (!user?.is_group_leader) return res.status(403).json({ message: "只有組長可以投票" });
      await ensureDecisioncardsTable();
      const roundNo = await getCurrentDecisionRound();
      const proposals = await decisioncardService.getAllDecisioncards();
      const currentRoundProposals = proposals.filter((p) => (Number(p.roundNo) || 1) === roundNo);
      const proposalByCard = new Map();
      proposals.forEach((proposal) => (proposal.selectedCardIds || []).forEach((cardId) => proposalByCard.set(String(cardId), proposal)));
      const rawVotes = Array.isArray(req.body?.votes) ? req.body.votes : [];
      const normalizedVotes = [];
      const seenCards = new Set();
      let agreeCount = 0;
      let rejectCount = 0;
      for (const item of rawVotes) {
        const cardId = String(item?.cardId || "").trim();
        const voteType = String(item?.voteType || "").trim();
        if (!cardId || seenCards.has(cardId)) continue;
        if (voteType !== "agree" && voteType !== "reject") continue;
        const proposal = proposalByCard.get(cardId);
        if (!proposal) continue;
        if (String(proposal.groupId) === String(voterGroupId)) continue;
        if ((Number(proposal.roundNo) || 1) !== roundNo) continue;
        if (voteType === "agree") agreeCount += 1;
        if (voteType === "reject") rejectCount += 1;
        if (agreeCount > 5 || rejectCount > 5) return res.status(400).json({ message: "同意票與反對票各最多 5 張" });
        seenCards.add(cardId);
        normalizedVotes.push({ cardId, voteType, proposalGroupId: proposal.groupId });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("DELETE FROM decisioncard_votes WHERE round_no = ? AND voter_group_id = ?", [roundNo, voterGroupId]);
        await connection.query("DELETE FROM decisioncard_vote_records WHERE round_no = ? AND voter_group_id = ?", [roundNo, voterGroupId]);
        for (const vote of normalizedVotes) {
          await upsertDecisioncardVote({
            connection,
            roundNo,
            proposalGroupId: vote.proposalGroupId,
            cardId: vote.cardId,
            voterGroupId,
            voterUserId: user.id,
            voteType: vote.voteType,
          });
        }

        // 保存完整投票快照：O/X 明確寫入，未投或保留的牌以 keep 記錄。
        // 這張表供教師端與研究分析回看「每一組在每一輪對每張公告牌的投票成果」。
        const normalizedVoteByCard = new Map(normalizedVotes.map((vote) => [String(vote.cardId), vote]));
        for (const proposal of currentRoundProposals) {
          if (String(proposal.groupId) === String(voterGroupId)) continue;
          const proposalCardIds = Array.isArray(proposal.selectedCardIds) ? proposal.selectedCardIds : [];
          for (const cardId of proposalCardIds) {
            const explicitVote = normalizedVoteByCard.get(String(cardId));
            await connection.query(
              `INSERT INTO decisioncard_vote_records (
                round_no, proposal_group_id, card_id, voter_group_id, voter_user_id, vote_type, submitted_at
              ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON DUPLICATE KEY UPDATE
                proposal_group_id = VALUES(proposal_group_id),
                voter_user_id = VALUES(voter_user_id),
                vote_type = VALUES(vote_type),
                submitted_at = VALUES(submitted_at),
                updated_at = CURRENT_TIMESTAMP`,
              [roundNo, proposal.groupId, cardId, voterGroupId, user.id, explicitVote?.voteType || "keep"]
            );
          }
        }
        await upsertDecisioncardVoteSubmission({ connection, roundNo, voterGroupId, voterUserId: user.id });
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      // 送出投票後只回傳投票畫面立即需要的資料，避免為了讀取歷史與分數造成 API timeout。
      // 前端會保留原本的公告欄提案資料，並透過較低頻率輪詢補齊其他狀態。
      const votes = await getDecisioncardVotes({ roundNo });
      const voteSubmissions = await getDecisioncardVoteSubmissions({ roundNo });
      const roundPreview = calculateRoundScores(currentRoundProposals, votes);
      const payload = {
        message: "投票已送出",
        roundNo,
        proposals: currentRoundProposals,
        votes,
        voteSubmissions,
        myVotes: votes.filter((vote) => String(vote.voterGroupId) === String(voterGroupId)),
        roundPreview,
      };
      publishRealtimeEvent("decision-card-game", payload);
      return res.json(payload);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "送出投票失敗" });
    }
  });

  router.put("/api/group-card-pack-lock", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const user = await getRequestUserProfile(req.user.id);
      const groupId = user?.group_id || null;
      if (!groupId) return res.status(400).json({ message: "尚未分配小組，無法鎖定卡包" });
      if (!user?.is_group_leader) return res.status(403).json({ message: "只有組長可以鎖定小組卡牌" });

      const selectedCardIds = Array.from(new Set(Array.isArray(req.body?.selectedCardIds) ? req.body.selectedCardIds : []))
        .map((cardId) => String(cardId).trim())
        .filter(Boolean);

      if (selectedCardIds.length !== 3) {
        return res.status(400).json({ message: "請選擇三張卡牌後再鎖定" });
      }

      const reason = String(req.body?.reason || "").trim();
      const coreCardId = String(req.body?.coreCardId || "").trim();
      if (!selectedCardIds.includes(coreCardId)) {
        return res.status(400).json({ message: "請在三張卡牌中指定一張核心牌" });
      }
      if (reason.length < 20) {
        return res.status(400).json({ message: "鎖定理由至少需要 20 個字" });
      }

      await ensureDecisioncardsTable();
      const roundNo = await getCurrentDecisionRound();
      const acceptedCards = await getAcceptedDecisioncards();
      const acceptedCardIds = new Set(acceptedCards.map((card) => String(card.cardId)));
      if (selectedCardIds.some((cardId) => acceptedCardIds.has(String(cardId)))) {
        return res.status(400).json({ message: "已通過進入決策區的牌不能再次提交" });
      }

      await connection.beginTransaction();
      const previousLock = await getDecisioncardByGroupId(groupId, { connection, forUpdate: true });
      await upsertDecisioncard({
        connection,
        groupId,
        lockedByUserId: user.id,
        selectedCardIds,
        lockReason: reason,
        coreCardId,
        roundNo,
      });
      const lock = await getDecisioncardByGroupId(groupId, { connection });

      await insertDecisioncardLog({
        connection,
        groupId,
        actionType: previousLock ? "relock" : "lock",
        lockedByUserId: user.id,
        selectedCardIds,
        lockReason: reason,
        coreCardId,
        roundNo,
      });

      await connection.commit();

      await insertStudentActivityLog({
        userId: user.id,
        username: user.username,
        role: user.role || "student",
        groupId,
        eventType: "group_card_pack_lock",
        eventLabel: previousLock ? "組長重新鎖定小組卡包三張卡牌" : "組長鎖定小組卡包三張卡牌",
        targetType: "role_card_pack",
        targetId: groupId,
        previousValue: previousLock,
        newValue: { selectedCardIds, reason },
        metadata: lock,
      });

      const teacherPayload = await buildTeacherDecisioncardsPayload();
      const gamePayload = { roundNo, acceptedCards: await getAcceptedDecisioncards(), roundHistory: await getDecisioncardRoundHistory(), groupScores: await getDecisioncardGroupScores(), proposals: await decisioncardService.getAllDecisioncards(), votes: await getDecisioncardVotes({ roundNo }), voteSubmissions: await getDecisioncardVoteSubmissions({ roundNo }) };
      const payload = { message: "小組提案已送到公告欄", lock, ...teacherPayload, ...gamePayload };
      publishRealtimeEvent("group-card-pack-lock", { groupId, lock, groups: teacherPayload.groups });
      publishRealtimeEvent("decision-card-game", gamePayload);
      return res.json(payload);
    } catch (error) {
      await connection.rollback();
      console.error(error);
      return res.status(500).json({ message: "儲存小組卡包鎖定狀態失敗" });
    } finally {
      connection.release();
    }
  });

  return router;
}

module.exports = createGroupCardPackRoutes;
