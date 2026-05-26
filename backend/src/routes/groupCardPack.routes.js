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
  } = decisioncardService;

  router.get("/api/group-card-pack-lock", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      const groupId = user?.group_id || null;
      if (!groupId) return res.json({ lock: null });

      await ensureDecisioncardsTable();
      const lock = await getDecisioncardByGroupId(groupId);
      if (!lock) return res.json({ lock: null });

      return res.json({
        lock: {
          groupId: lock.groupId,
          selectedCardIds: lock.selectedCardIds,
          lockedBy: lock.lockedBy,
          reason: lock.reason || "",
          lockedAt: lock.lockedAt,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "讀取小組卡包鎖定狀態失敗" });
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
      if (reason.length < 20) {
        return res.status(400).json({ message: "鎖定理由至少需要 20 個字" });
      }

      await ensureDecisioncardsTable();

      await connection.beginTransaction();
      const previousLock = await getDecisioncardByGroupId(groupId, { connection, forUpdate: true });
      await upsertDecisioncard({
        connection,
        groupId,
        lockedByUserId: user.id,
        selectedCardIds,
        lockReason: reason,
      });
      const lock = await getDecisioncardByGroupId(groupId, { connection });

      await insertDecisioncardLog({
        connection,
        groupId,
        actionType: previousLock ? "relock" : "lock",
        lockedByUserId: user.id,
        selectedCardIds,
        lockReason: reason,
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
      const payload = { message: "小組卡牌已鎖定", lock, ...teacherPayload };
      publishRealtimeEvent("group-card-pack-lock", { groupId, lock, groups: teacherPayload.groups });
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
