/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 teacher 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");
const { createTeacherLearningDashboardService } = require("../services/teacherLearningDashboard");

function createTeacherRoutes(dependencies) {
  const {
    pool,
    authenticateToken,
    requireTeacher,
    GROUPS,
    parseJSON,
    mapGroupName,
    publishRealtimeEvent,
    setGameSetting,
    votingService,
    ensureUsersGenderColumn,
    ensureDataCardSourcesTable,
    ensureMapChoicesTable,
    ensureInquiryNormalizedTables,
    ensureLearningDashboardIndexes,
    ensureDecisioncardsTable,
    insertDecisioncardLog,
    buildTeacherDecisioncardsPayload,
    getDecisioncardByGroupId,
    getAllDecisioncards,
  } = dependencies;

  const router = express.Router();

  function normalizeGroupId(value) {
    const groupId = String(value || "").trim();
    if (!groupId || groupId === "unassigned" || groupId === "null") return null;
    return GROUPS[groupId] ? groupId : null;
  }

  async function getMapGroupLockRealtimePayload(extra = {}) {
    const [groups] = await pool.query(
      `SELECT group_id AS groupId,
              COUNT(*) AS memberCount,
              SUM(CASE WHEN is_group_leader = 1 THEN 1 ELSE 0 END) AS leaderCount
       FROM users
       WHERE group_id IS NOT NULL AND COALESCE(role, 'student') = 'student'
       GROUP BY group_id
       HAVING memberCount > 0
       ORDER BY MIN(id) ASC`,
    );
    const [lockRows] = await pool.query(
      `SELECT group_id AS groupId, locked_by_user_id AS lockedByUserId, locked_at AS lockedAt
       FROM map_locks
       WHERE scope = 'group' AND group_id IS NOT NULL`,
    );
    const locksByGroupId = new Map(lockRows.map((row) => [String(row.groupId), row]));
    const groupLockStatuses = groups.map((group) => {
      const groupId = String(group.groupId);
      const lock = locksByGroupId.get(groupId);
      return {
        groupId,
        groupName: mapGroupName(groupId) || GROUPS[groupId]?.name || `小組 ${groupId}`,
        memberCount: Number(group.memberCount || 0),
        leaderCount: Number(group.leaderCount || 0),
        hasLeader: Number(group.leaderCount || 0) > 0,
        isLocked: Boolean(lock),
        lockedAt: lock?.lockedAt || null,
        lockedByUserId: lock?.lockedByUserId || null,
      };
    });
    const lockedCount = groupLockStatuses.filter((status) => status.isLocked).length;
    const totalCount = groupLockStatuses.length;
    return {
      groupLockStatuses,
      groupLockSummary: {
        lockedCount,
        totalCount,
        unlockedCount: Math.max(totalCount - lockedCount, 0),
        allLocked: totalCount > 0 && lockedCount === totalCount,
      },
      allGroupsLocked: totalCount > 0 && lockedCount === totalCount,
      ...extra,
    };
  }

router.get("/api/teacher/group-card-pack-locks", authenticateToken, requireTeacher, async (req, res) => {
  try {
    res.json(await buildTeacherDecisioncardsPayload());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取各組卡牌決策鎖定狀態失敗" });
  }
});



router.delete("/api/teacher/group-card-pack-locks/:groupId", authenticateToken, requireTeacher, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const groupId = String(req.params.groupId || "").trim();
    if (!GROUPS[groupId]) return res.status(400).json({ message: "小組不存在" });

    await ensureDecisioncardsTable();

    await connection.beginTransaction();
    const previousLock = await getDecisioncardByGroupId(groupId, { connection, forUpdate: true });

    const [result] = await connection.query(
      "DELETE FROM decisioncards WHERE group_id = ?",
      [groupId],
    );

    if (previousLock) {
      await insertDecisioncardLog({
        connection,
        groupId,
        actionType: "teacher_unlock_group",
        lockedByUserId: req.user.id,
        selectedCardIds: previousLock.selectedCardIds,
        lockReason: previousLock.reason,
      });
    }

    await connection.commit();

    const payload = {
      message: `${GROUPS[groupId].name} 已解鎖，該組學生會回到九張卡牌畫面`,
      groupId,
      unlockedCount: Number(result?.affectedRows || 0),
      ...(await buildTeacherDecisioncardsPayload()),
    };
    publishRealtimeEvent("group-card-pack-lock", { groupId, lock: null, groups: payload.groups });
    res.json(payload);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "解除小組卡牌決策鎖定失敗" });
  } finally {
    connection.release();
  }
});

router.delete("/api/teacher/group-card-pack-locks", authenticateToken, requireTeacher, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await ensureDecisioncardsTable();

    await connection.beginTransaction();
    const previousLocks = await getAllDecisioncards({ connection, forUpdate: true });

    const [result] = await connection.query("DELETE FROM decisioncards");

    for (const previousLock of previousLocks) {
      await insertDecisioncardLog({
        connection,
        groupId: previousLock.groupId,
        actionType: "teacher_unlock_all",
        lockedByUserId: req.user.id,
        selectedCardIds: previousLock.selectedCardIds,
        lockReason: previousLock.reason,
      });
    }

    await connection.commit();

    const payload = {
      message: "已解除全部小組卡牌決策鎖定，全班學生會回到九張卡牌畫面",
      unlockedCount: Number(result?.affectedRows || 0),
      ...(await buildTeacherDecisioncardsPayload()),
    };
    publishRealtimeEvent("group-card-pack-lock", { groupId: null, lock: null, groups: payload.groups });
    res.json(payload);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "解除全部卡牌決策鎖定失敗" });
  } finally {
    connection.release();
  }
});


router.get("/api/teacher/players", authenticateToken, requireTeacher, async (req, res) => {
  try {
    await ensureUsersGenderColumn();
    const [rows] = await pool.query(
      `SELECT id, username, NULL AS email, role, gender, group_id, is_group_leader
       FROM users
       WHERE COALESCE(role, 'student') = 'student'
       ORDER BY group_id ASC, is_group_leader DESC, id ASC`,
    );
    res.json({
      groups: Object.entries(GROUPS).map(([id, group]) => ({ id, name: group.name })),
      players: rows.map((row) => ({
        id: row.id,
        name: row.username,
        username: row.username,
        email: row.email,
        role: row.role || "student",
        gender: row.gender || null,
        groupId: row.group_id || "unassigned",
        isGroupLeader: Boolean(row.is_group_leader),
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "讀取學生失敗" });
  }
});

async function saveTeacherGroupAssignments({ req, res, successMessage }) {
  const connection = await pool.getConnection();
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments)) return res.status(400).json({ message: "assignments 必須是陣列" });

    if (ensureMapChoicesTable) await ensureMapChoicesTable(connection);

    await connection.beginTransaction();
    const affectedGroupIds = new Set();
    const movedUserIds = new Set();

    for (const item of assignments) {
      const userId = Number(item.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw Object.assign(new Error("學生 ID 格式錯誤"), { statusCode: 400 });
      }

      const [[oldUser]] = await connection.query("SELECT group_id, is_group_leader FROM users WHERE id = ?", [userId]);
      const oldGroupId = oldUser?.group_id || null;
      const oldIsGroupLeader = Boolean(oldUser?.is_group_leader);
      const groupId = normalizeGroupId(item.groupId);
      const isGroupLeader = groupId && item.isGroupLeader ? 1 : 0;
      if (oldGroupId) affectedGroupIds.add(oldGroupId);
      if (groupId) affectedGroupIds.add(groupId);
      if (String(oldGroupId || "") !== String(groupId || "")) movedUserIds.add(userId);
      if (oldIsGroupLeader !== Boolean(isGroupLeader)) {
        if (oldGroupId) affectedGroupIds.add(oldGroupId);
        if (groupId) affectedGroupIds.add(groupId);
      }

      await connection.query(
        `UPDATE users SET group_id = ?, is_group_leader = ?
         WHERE id = ? AND COALESCE(role, 'student') = 'student'`,
        [groupId, isGroupLeader, userId],
      );
    }

    const [groupIds] = await connection.query(
      `SELECT DISTINCT group_id FROM users WHERE group_id IS NOT NULL AND COALESCE(role, 'student') = 'student'`,
    );
    for (const row of groupIds) {
      const [leaders] = await connection.query(
        `SELECT id FROM users
         WHERE group_id = ? AND is_group_leader = 1 AND COALESCE(role, 'student') = 'student'
         ORDER BY id ASC`,
        [row.group_id],
      );
      if (leaders.length > 1) {
        await connection.query(
          `UPDATE users SET is_group_leader = 0
           WHERE group_id = ? AND id <> ? AND COALESCE(role, 'student') = 'student'`,
          [row.group_id, leaders[0].id],
        );
      }
    }

    if (affectedGroupIds.size > 0) {
      await connection.query(
        `DELETE FROM map_choices WHERE scope = 'group' AND group_id IN (?)`,
        [[...affectedGroupIds]],
      );
      await connection.query(
        `DELETE FROM map_locks WHERE scope = 'group' AND group_id IN (?)`,
        [[...affectedGroupIds]],
      );
    }
    if (movedUserIds.size > 0) {
      await connection.query(
        `DELETE FROM map_locks WHERE scope = 'personal' AND user_id IN (?)`,
        [[...movedUserIds]],
      );
    }
    await connection.query("DELETE FROM map_choices WHERE scope = 'class' AND owner_id = 'class'");
    await connection.commit();

    publishRealtimeEvent(
      "map-lock-updated",
      await getMapGroupLockRealtimePayload({
        scope: "assignment",
        affectedGroupIds: [...affectedGroupIds],
        movedUserIds: [...movedUserIds],
      }),
    );

    res.json({ message: movedUserIds.size > 0 ? `${successMessage}，已重置移組學生的個人地圖鎖定狀態` : successMessage });
  } catch (error) {
    await connection.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "儲存分組失敗" });
  } finally {
    connection.release();
  }
}

router.put("/api/teacher/players/groups", authenticateToken, requireTeacher, async (req, res) => {
  await saveTeacherGroupAssignments({ req, res, successMessage: "分組與組長儲存成功，地圖決策已重新整理" });
});





const teacherLearningDashboardService = createTeacherLearningDashboardService({
  pool,
  GROUPS,
  parseJSON,
  mapGroupName,
  ensureUsersGenderColumn,
  ensureDataCardSourcesTable,
  ensureMapChoicesTable,
  ensureInquiryNormalizedTables,
  ensureLearningDashboardIndexes,
  ensureDecisioncardsTable,
});

router.get(
  "/api/teacher/learning-dashboard",
  authenticateToken,
  requireTeacher,
  teacherLearningDashboardService.getLearningDashboard,
);





const CLEAR_DATABASE_CONFIRM_TEXT = "清空資料表";
const TEACHER_CLEARABLE_TABLES = [
  "student_activity_logs",
  "decisioncard_logs",
  "decisioncards",
  "student_unlocked_cards",
  "student_rewards",
  "inquiry_collection_note_cards",
  "inquiry_collection_notes",
  "inquiry_record_cards",
  "inquiry_orientation_responses",
  "inquiry_records",
  "ai_helper_record_cards",
  "ai_helper_records",
  "ai_helper_unlocks",
  "map_locks",
  "map_choices",
  "map_action_logs",
  "suspect_votes",
  "barrages",
  "data_card_sources",
];

async function getExistingTables(connection, tableNames) {
  if (!Array.isArray(tableNames) || tableNames.length === 0) return [];

  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (?)`,
    [tableNames],
  );
  const existing = new Set(rows.map((row) => row.tableName));
  return tableNames.filter((tableName) => existing.has(tableName));
}

async function getAutoIncrementTables(connection, tableNames) {
  if (!Array.isArray(tableNames) || tableNames.length === 0) return new Set();

  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (?)
       AND EXTRA LIKE '%auto_increment%'`,
    [tableNames],
  );
  return new Set(rows.map((row) => row.tableName));
}

router.delete("/api/teacher/database-data", authenticateToken, requireTeacher, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const confirmText = String(req.body?.confirmText || "").trim();
    if (confirmText !== CLEAR_DATABASE_CONFIRM_TEXT) {
      return res.status(400).json({ message: "確認文字錯誤，請輸入「清空資料表」。" });
    }

    const existingTables = await getExistingTables(connection, TEACHER_CLEARABLE_TABLES);
    const autoIncrementTables = await getAutoIncrementTables(connection, existingTables);

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const tableName of existingTables) {
        await connection.query(`DELETE FROM \`${tableName}\``);
        if (autoIncrementTables.has(tableName)) {
          await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
        }
      }
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    await connection.query("UPDATE users SET barrage_coins = 0 WHERE role = 'student'");

    // game_settings 不整張清空，但清空學生資料時需要重置「會引用舊紀錄」的動態狀態，
    // 避免 suspect_votes 已空卻仍顯示上一輪投票結算結果。
    await setGameSetting("suspect_voting_status", {
      isOpen: false,
      isFinalized: false,
      finalizedSuspects: [],
      finalizedAt: null,
    });

    await setGameSetting("final_decision_settlement", { isFinalized: false });

    const payload = {
      clearedTables: existingTables,
      skippedTables: TEACHER_CLEARABLE_TABLES.filter((tableName) => !existingTables.includes(tableName)),
      clearedAt: new Date().toISOString(),
    };
    publishRealtimeEvent("database-data-cleared", payload);
    publishRealtimeEvent("suspect-voting-status", await votingService.buildSuspectVotingPayload(req.user.id));
    publishRealtimeEvent("final-decision-settlement", { isFinalized: false });

    res.json({
      message: `資料表已清空，共清空 ${existingTables.length} 個資料表。`,
      ...payload,
    });
  } catch (error) {
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch {}
    console.error(error);
    res.status(500).json({ message: "清空資料表失敗" });
  } finally {
    connection.release();
  }
});



  return router;
}

module.exports = createTeacherRoutes;
