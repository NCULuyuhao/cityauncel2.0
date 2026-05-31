/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 map 功能 API 路由，負責接收請求、檢查參數並回傳 JSON 結果。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");

const pool = require("../db");
const { authenticateToken, requireTeacher } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");
const {
  VALID_FINAL_CHOICES,
  GROUPS,
  objectFromChoiceRows,
  replaceMapChoices,
  resolveVoteFromMaps,
  buildVoteStatsFromMaps,
  getLatestPersonalMapActionTimes,
  getLatestClassInputActionTimes,
  filterActiveGroupFinalChoices,
  filterActiveClassFinalChoices,
} = require("../services/mapDecisionService");

const ALL_DISTRICTS_SENTINEL = "__ALL__";
// 個人地圖限制：保育與開發各最多 9 個；「我不知道」不列入限制。
const PERSONAL_MAP_CHOICE_LIMIT = 9;

const MAP_DISTRICT_NAMES = [
  "苗栗市",
  "頭份市",
  "竹南鎮",
  "後龍鎮",
  "通霄鎮",
  "苑裡鎮",
  "卓蘭鎮",
  "大湖鄉",
  "公館鄉",
  "銅鑼鄉",
  "南庄鄉",
  "頭屋鄉",
  "三義鄉",
  "西湖鄉",
  "造橋鄉",
  "三灣鄉",
  "獅潭鄉",
  "泰安鄉",
];
const MAP_DISTRICT_SET = new Set(MAP_DISTRICT_NAMES);

function normalizeMapStatePayload(rawMapState) {
  const normalized = {};
  if (!rawMapState || typeof rawMapState !== "object" || Array.isArray(rawMapState)) {
    return normalized;
  }

  Object.entries(rawMapState).forEach(([districtName, choice]) => {
    if (!MAP_DISTRICT_SET.has(districtName)) return;
    if (!choice) return;
    if (!VALID_FINAL_CHOICES.includes(choice) && choice !== "我不知道") return;
    normalized[districtName] = choice;
  });

  return normalized;
}

function getIncompleteMapDistricts(mapState) {
  return MAP_DISTRICT_NAMES.filter((districtName) => {
    const choice = mapState?.[districtName];
    return choice !== "保育" && choice !== "開發" && choice !== "我不知道";
  });
}

function getPersonalMapLimitError(mapState) {
  const choices = Object.values(mapState || {});
  const conserveCount = choices.filter((choice) => choice === "保育").length;
  const developCount = choices.filter((choice) => choice === "開發").length;

  if (conserveCount > PERSONAL_MAP_CHOICE_LIMIT) {
    return `需要保育最多只能選 ${PERSONAL_MAP_CHOICE_LIMIT} 個，目前已選 ${conserveCount} 個`;
  }
  if (developCount > PERSONAL_MAP_CHOICE_LIMIT) {
    return `需要開發最多只能選 ${PERSONAL_MAP_CHOICE_LIMIT} 個，目前已選 ${developCount} 個`;
  }
  return null;
}


function isTieVoteStats(stats) {
  if (!stats) return false;
  const conserveCount = Number(stats.保育 || 0);
  const developCount = Number(stats.開發 || 0);
  return conserveCount + developCount > 0 && conserveCount === developCount;
}

function groupLockSummaryFromStatuses(statuses) {
  const totalCount = statuses.length;
  const lockedCount = statuses.filter((status) => status.isLocked).length;
  return {
    lockedCount,
    totalCount,
    unlockedCount: Math.max(totalCount - lockedCount, 0),
    allLocked: totalCount > 0 && lockedCount === totalCount,
  };
}

function createMapRoutes({ getRequestUserProfile, getActor, mapGroupName, publishRealtimeEvent, ensureMapChoicesTable }) {
  const router = express.Router();
  let mapChoicesReadyPromise = null;

  const ensureMapChoicesReady = async (req, res, next) => {
    if (!ensureMapChoicesTable) return next();
    if (!mapChoicesReadyPromise) {
      mapChoicesReadyPromise = ensureMapChoicesTable().catch((error) => {
        mapChoicesReadyPromise = null;
        throw error;
      });
    }
    try {
      await mapChoicesReadyPromise;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "地圖資料表初始化失敗" });
    }
  };

  async function getPersonalLockByUserId(userId) {
    const [[lockRow]] = await pool.query(
      `SELECT user_id AS userId, locked_by_user_id AS lockedByUserId, locked_at AS lockedAt
       FROM map_locks
       WHERE scope = 'personal' AND user_id = ?`,
      [userId],
    );
    return lockRow || null;
  }

  async function getGroupLockByGroupId(groupId) {
    if (!groupId) return null;
    const [[lockRow]] = await pool.query(
      `SELECT group_id AS groupId, locked_by_user_id AS lockedByUserId, locked_at AS lockedAt
       FROM map_locks
       WHERE scope = 'group' AND group_id = ?`,
      [groupId],
    );
    return lockRow || null;
  }

  // 小組地圖進入條件與統計都需要同時讀成員、個人選擇與個人鎖定狀態。
  async function getGroupMembersAndMaps(groupId) {
    const [members] = await pool.query(
      `SELECT id, username, NULL AS email, is_group_leader
       FROM users
       WHERE group_id = ? AND COALESCE(role, 'student') = 'student'
       ORDER BY is_group_leader DESC, id ASC`,
      [groupId],
    );

    const memberIds = members.map((member) => member.id);
    const [choiceRows] = memberIds.length > 0
      ? await pool.query(
          `SELECT user_id, district_name, choice
           FROM map_choices
           WHERE scope = 'personal' AND user_id IN (?)
           ORDER BY user_id ASC, district_name ASC`,
          [memberIds],
        )
      : [[]];

    const choicesByUserId = new Map();
    choiceRows.forEach((row) => {
      const key = String(row.user_id);
      const current = choicesByUserId.get(key) || {};
      current[row.district_name] = row.choice;
      choicesByUserId.set(key, current);
    });

    const [lockRows] = memberIds.length > 0
      ? await pool.query(
          `SELECT user_id AS userId, locked_at AS lockedAt, locked_by_user_id AS lockedByUserId
           FROM map_locks
           WHERE scope = 'personal' AND user_id IN (?)`,
          [memberIds],
        )
      : [[]];
    const personalLocksByUserId = new Map(
      lockRows.map((row) => [String(row.userId), row]),
    );

    const membersWithLocks = members.map((member) => {
      const lock = personalLocksByUserId.get(String(member.id));
      return {
        id: member.id,
        username: member.username,
        name: member.username,
        email: member.email,
        isGroupLeader: Boolean(member.is_group_leader),
        isPersonalMapLocked: Boolean(lock),
        personalMapLockedAt: lock?.lockedAt || null,
      };
    });

    const personalData = members.map((member) => choicesByUserId.get(String(member.id)) || {});
    const personalLockStatuses = membersWithLocks.map((member) => ({
      userId: member.id,
      username: member.username,
      name: member.name,
      isGroupLeader: member.isGroupLeader,
      isLocked: member.isPersonalMapLocked,
      lockedAt: member.personalMapLockedAt,
    }));

    return {
      members: membersWithLocks,
      personalData,
      personalLockStatuses,
      personalLockSummary: groupLockSummaryFromStatuses(personalLockStatuses),
    };
  }

  async function getActiveGroupFinalDecisions(groupId, personalData) {
    const [finalRows] = await pool.query(
      `SELECT district_name, choice, updated_at
       FROM map_choices
       WHERE scope = 'group' AND group_id = ?`,
      [groupId],
    );

    const latestPersonalActionTimes = await getLatestPersonalMapActionTimes(groupId);
    return filterActiveGroupFinalChoices({
      groupId,
      personalMaps: personalData,
      finalRows,
      latestPersonalActionTimes,
    });
  }

  function findUnresolvedGroupTieDistricts(personalData, activeGroupFinalDecisions) {
    const voteStats = buildVoteStatsFromMaps(personalData);
    return Object.entries(voteStats)
      .filter(([districtName, stats]) => isTieVoteStats(stats) && !activeGroupFinalDecisions[districtName])
      .map(([districtName]) => districtName);
  }

  async function getActiveMapGroups() {
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

    return groups.map((group) => ({
      groupId: String(group.groupId),
      groupName: mapGroupName(group.groupId) || GROUPS[String(group.groupId)]?.name || `小組 ${group.groupId}`,
      memberCount: Number(group.memberCount || 0),
      leaderCount: Number(group.leaderCount || 0),
      hasLeader: Number(group.leaderCount || 0) > 0,
    }));
  }

  async function getAllGroupLockStatuses() {
    const activeGroups = await getActiveMapGroups();
    const [lockRows] = await pool.query(
      `SELECT group_id AS groupId, locked_by_user_id AS lockedByUserId, locked_at AS lockedAt
       FROM map_locks
       WHERE scope = 'group' AND group_id IS NOT NULL`,
    );
    const locksByGroupId = new Map(lockRows.map((row) => [String(row.groupId), row]));

    return activeGroups.map((group) => {
      const lock = locksByGroupId.get(String(group.groupId));
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        memberCount: group.memberCount,
        leaderCount: group.leaderCount,
        hasLeader: group.hasLeader,
        isLocked: Boolean(lock),
        lockedAt: lock?.lockedAt || null,
        lockedByUserId: lock?.lockedByUserId || null,
      };
    });
  }

  async function buildPersonalLockRealtimePayload(userId, groupId) {
    const fallbackSummary = { lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false };
    if (!groupId) {
      return {
        scope: "personal",
        userId,
        groupId: null,
        groupName: null,
        members: [],
        personalLockStatuses: [],
        personalLockSummary: fallbackSummary,
        isGroupReady: false,
        isMyPersonalLocked: false,
      };
    }

    const { members, personalLockStatuses, personalLockSummary } = await getGroupMembersAndMaps(groupId);
    const myLock = personalLockStatuses.find((status) => String(status.userId) === String(userId));
    return {
      scope: "personal",
      userId,
      groupId,
      groupName: mapGroupName(groupId),
      members,
      personalLockStatuses,
      personalLockSummary,
      isGroupReady: personalLockSummary.allLocked,
      isMyPersonalLocked: Boolean(myLock?.isLocked),
    };
  }

  async function buildGroupLockRealtimePayload({ scope = "group", userId = null, groupId = null, extra = {} } = {}) {
    const groupLockStatuses = await getAllGroupLockStatuses();
    const groupLockSummary = groupLockSummaryFromStatuses(groupLockStatuses);
    return {
      scope,
      userId,
      groupId,
      groupLockStatuses,
      groupLockSummary,
      allGroupsLocked: groupLockSummary.allLocked,
      ...extra,
    };
  }

  router.use([
    "/api/user-map",
    "/api/user-map/lock",
    "/api/group-personal-maps",
    "/api/group-final-decision",
    "/api/group-map/lock",
    "/api/class-group-decisions",
    "/api/class-final-decision",
    "/api/class-final-decisions",
  ], ensureMapChoicesReady);

  router.get("/api/user-map", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT district_name, choice FROM map_choices WHERE scope = 'personal' AND user_id = ?",
        [req.user.id],
      );
      const lock = await getPersonalLockByUserId(req.user.id);
      res.json({
        mapState: objectFromChoiceRows(rows),
        isPersonalLocked: Boolean(lock),
        personalLockedAt: lock?.lockedAt || null,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取個人地圖失敗" });
    }
  });

  router.put("/api/user-map", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const personalLock = await getPersonalLockByUserId(req.user.id);
      if (personalLock) {
        return res.status(423).json({ message: "個人地圖已鎖定，不能再修改" });
      }

      const nextMapState = normalizeMapStatePayload(req.body?.mapState || {});
      const limitError = getPersonalMapLimitError(nextMapState);
      if (limitError) return res.status(409).json({ message: limitError });
      const actor = await getActor(req.user.id, req.user);

      await connection.beginTransaction();
      const oldMapState = await replaceMapChoices(connection, req.user.id, nextMapState, actor.groupId);
      await connection.commit();

      const allDistricts = new Set([...Object.keys(oldMapState), ...Object.keys(nextMapState)]);
      for (const districtName of allDistricts) {
        const previousChoice = oldMapState[districtName] || null;
        const newChoice = nextMapState[districtName] || null;
        if (previousChoice !== newChoice) {
          try {
            await insertStudentActivityLog({
              ...actor,
              eventType: `map_${previousChoice ? "change_choice" : "set_choice"}`,
              eventLabel: "地圖決策操作",
              targetType: "personal",
              targetId: districtName,
              previousValue: previousChoice,
              newValue: newChoice,
              metadata: { scope: "personal", districtName, actionType: previousChoice ? "change_choice" : "set_choice" },
            });
          } catch (logError) {
            console.error("地圖決策活動紀錄寫入失敗：", logError);
          }
        }
      }

      publishRealtimeEvent("map-user-updated", { userId: req.user.id, groupId: actor.groupId || null });
      res.json({ message: "個人地圖已儲存" });
    } catch (error) {
      try { await connection.rollback(); } catch (rollbackError) { console.error("地圖交易回復失敗：", rollbackError); }
      console.error(error);
      res.status(500).json({ message: "儲存個人地圖失敗" });
    } finally {
      connection.release();
    }
  });

  router.post("/api/user-map/lock", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const actor = await getActor(req.user.id, req.user);
      const incomingMapState = req.body && Object.prototype.hasOwnProperty.call(req.body, "mapState")
        ? normalizeMapStatePayload(req.body.mapState)
        : null;

      await connection.beginTransaction();

      const [[existingLock]] = await connection.query(
        `SELECT user_id AS userId, locked_at AS lockedAt
         FROM map_locks
         WHERE scope = 'personal' AND user_id = ?
         FOR UPDATE`,
        [req.user.id],
      );

      if (existingLock) {
        await connection.commit();
        publishRealtimeEvent(
          "map-lock-updated",
          await buildPersonalLockRealtimePayload(req.user.id, actor.groupId || null),
        );
        return res.json({ message: "個人地圖已鎖定", isPersonalLocked: true, alreadyLocked: true });
      }

      let finalMapState = incomingMapState;
      if (!finalMapState) {
        const [rows] = await connection.query(
          `SELECT district_name, choice FROM map_choices WHERE scope = 'personal' AND user_id = ?`,
          [req.user.id],
        );
        finalMapState = objectFromChoiceRows(rows);
      }

      const incompleteDistricts = getIncompleteMapDistricts(finalMapState);
      if (incompleteDistricts.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          message: `還有 ${incompleteDistricts.length} 個鄉鎮市尚未完成判斷，請全部選完後再鎖定`,
          incompleteDistricts,
          completedCount: MAP_DISTRICT_NAMES.length - incompleteDistricts.length,
          totalCount: MAP_DISTRICT_NAMES.length,
        });
      }

      const limitError = getPersonalMapLimitError(finalMapState);
      if (limitError) {
        await connection.rollback();
        return res.status(409).json({ message: limitError });
      }

      const oldMapState = incomingMapState
        ? await replaceMapChoices(connection, req.user.id, finalMapState, actor.groupId)
        : finalMapState;

      await connection.query(
        `INSERT INTO map_locks (scope, owner_id, user_id, group_id, locked_by_user_id)
         VALUES ('personal', ?, ?, ?, ?)`,
        [String(req.user.id), req.user.id, actor.groupId || null, req.user.id],
      );
      await connection.query(
        `INSERT INTO map_action_logs (user_id, scope, group_id, district_name, previous_choice, new_choice, action_type)
         VALUES (?, 'personal', ?, ?, NULL, 'locked', 'lock_personal_map')`,
        [req.user.id, actor.groupId || null, ALL_DISTRICTS_SENTINEL],
      );

      await connection.commit();

      try {
        await insertStudentActivityLog({
          ...actor,
          eventType: "map_lock_personal",
          eventLabel: "鎖定個人地圖",
          targetType: "personal",
          targetId: ALL_DISTRICTS_SENTINEL,
          previousValue: oldMapState,
          newValue: "locked",
          metadata: { scope: "personal", completedDistricts: MAP_DISTRICT_NAMES.length },
        });
      } catch (logError) {
        console.error("鎖定個人地圖活動紀錄寫入失敗：", logError);
      }

      publishRealtimeEvent(
        "map-lock-updated",
        await buildPersonalLockRealtimePayload(req.user.id, actor.groupId || null),
      );
      publishRealtimeEvent("map-user-updated", { userId: req.user.id, groupId: actor.groupId || null });
      return res.json({ message: "個人地圖已鎖定", isPersonalLocked: true, mapState: finalMapState });
    } catch (error) {
      try { await connection.rollback(); } catch (rollbackError) { console.error("地圖交易回復失敗：", rollbackError); }
      console.error(error);
      return res.status(500).json({ message: "鎖定個人地圖失敗" });
    } finally {
      connection.release();
    }
  });

  router.get("/api/group-personal-maps", authenticateToken, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");

      const user = await getRequestUserProfile(req.user.id);
      const groupId = user?.group_id || null;
      if (!groupId) {
        return res.json({
          groupId: null,
          groupName: null,
          members: [],
          personalData: [],
          groupFinalDecisions: {},
          personalLockStatuses: [],
          personalLockSummary: { lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false },
          isGroupReady: false,
          isMyPersonalLocked: false,
          isGroupMapLocked: false,
          groupMapLockedAt: null,
          groupMapLockedByUserId: null,
        });
      }

      const { members, personalData, personalLockStatuses, personalLockSummary } = await getGroupMembersAndMaps(groupId);
      const activeGroupFinalDecisions = await getActiveGroupFinalDecisions(groupId, personalData);
      const groupLock = await getGroupLockByGroupId(groupId);
      const myPersonalLock = personalLockStatuses.find((status) => String(status.userId) === String(req.user.id));

      res.json({
        groupId,
        groupName: mapGroupName(groupId),
        members,
        personalData,
        groupFinalDecisions: activeGroupFinalDecisions,
        personalLockStatuses,
        personalLockSummary,
        isGroupReady: personalLockSummary.allLocked,
        isMyPersonalLocked: Boolean(myPersonalLock?.isLocked),
        isGroupMapLocked: Boolean(groupLock),
        groupMapLockedAt: groupLock?.lockedAt || null,
        groupMapLockedByUserId: groupLock?.lockedByUserId || null,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取小組地圖失敗" });
    }
  });

  router.put("/api/group-final-decision", authenticateToken, async (req, res) => {
    try {
      const { districtName, choice } = req.body;
      if (!districtName) return res.status(400).json({ message: "缺少地區名稱" });
      if (choice && !VALID_FINAL_CHOICES.includes(choice)) return res.status(400).json({ message: "決策只能是保育或開發" });

      const user = await getRequestUserProfile(req.user.id);
      if (!user?.group_id) return res.status(400).json({ message: "尚未分配小組" });
      if (!user?.is_group_leader) return res.status(403).json({ message: "只有組長可以決定小組平手地區" });
      if (await getGroupLockByGroupId(user.group_id)) return res.status(423).json({ message: "小組地圖已鎖定，不能再修改" });

      const { personalLockSummary } = await getGroupMembersAndMaps(user.group_id);
      if (!personalLockSummary.allLocked) return res.status(409).json({ message: "需等待小組全員鎖定個人地圖後，才能決定小組平手地區" });

      const [[oldRow]] = await pool.query(
        `SELECT choice FROM map_choices
         WHERE scope = 'group' AND group_id = ? AND district_name = ?`,
        [user.group_id, districtName],
      );
      const previousChoice = oldRow?.choice || null;
      const newChoice = choice || null;

      if (previousChoice !== newChoice) {
        if (!choice) {
          await pool.query(
            `DELETE FROM map_choices
             WHERE scope = 'group' AND group_id = ? AND district_name = ?`,
            [user.group_id, districtName],
          );
        } else {
          await pool.query(
            `INSERT INTO map_choices (scope, owner_id, group_id, district_name, choice)
             VALUES ('group', ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = CURRENT_TIMESTAMP`,
            [String(user.group_id), user.group_id, districtName, choice],
          );
        }

        await pool.query(
          `DELETE FROM map_choices
           WHERE scope = 'class' AND owner_id = 'class' AND district_name = ?`,
          [districtName],
        );

        await pool.query(
          `INSERT INTO map_action_logs (user_id, scope, group_id, district_name, previous_choice, new_choice, action_type)
           VALUES (?, 'group', ?, ?, ?, ?, ?)`,
          [req.user.id, user.group_id, districtName, previousChoice, newChoice, previousChoice ? "change_group_final" : "set_group_final"],
        );
        await insertStudentActivityLog({
          userId: req.user.id,
          username: user.username,
          role: user.role || "student",
          groupId: user.group_id,
          eventType: previousChoice ? "map_change_group_final" : "map_set_group_final",
          eventLabel: "小組地圖最終決策",
          targetType: "group",
          targetId: districtName,
          previousValue: previousChoice,
          newValue: newChoice,
        });
      }

      publishRealtimeEvent("map-group-final-updated", {
        groupId: user.group_id,
        districtName,
        choice: newChoice,
        userId: req.user.id,
      });
      res.json({ message: choice ? "已儲存小組決策" : "已清除小組決策" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "儲存小組決策失敗" });
    }
  });

  router.post("/api/group-map/lock", authenticateToken, async (req, res) => {
    try {
      const user = await getRequestUserProfile(req.user.id);
      if (!user?.group_id) return res.status(400).json({ message: "尚未分配小組" });
      if (!user?.is_group_leader) return res.status(403).json({ message: "只有組長可以鎖定小組地圖" });

      const existingLock = await getGroupLockByGroupId(user.group_id);
      if (existingLock) {
        publishRealtimeEvent(
          "map-lock-updated",
          await buildGroupLockRealtimePayload({ scope: "group", groupId: user.group_id, userId: req.user.id }),
        );
        return res.json({ message: "小組地圖已鎖定", isGroupMapLocked: true });
      }

      const { personalData, personalLockSummary } = await getGroupMembersAndMaps(user.group_id);
      if (!personalLockSummary.allLocked) {
        return res.status(409).json({ message: "需等待小組全員鎖定個人地圖後，才能鎖定小組地圖" });
      }

      const activeGroupFinalDecisions = await getActiveGroupFinalDecisions(user.group_id, personalData);
      const unresolvedTieDistricts = findUnresolvedGroupTieDistricts(personalData, activeGroupFinalDecisions);
      if (unresolvedTieDistricts.length > 0) {
        return res.status(409).json({
          message: `還有 ${unresolvedTieDistricts.length} 個平手地區尚未由組長決定`,
          unresolvedTieDistricts,
        });
      }

      await pool.query(
        `INSERT INTO map_locks (scope, owner_id, user_id, group_id, locked_by_user_id)
         VALUES ('group', ?, NULL, ?, ?)`,
        [String(user.group_id), user.group_id, req.user.id],
      );
      await pool.query(
        `INSERT INTO map_action_logs (user_id, scope, group_id, district_name, previous_choice, new_choice, action_type)
         VALUES (?, 'group', ?, ?, NULL, 'locked', 'lock_group_map')`,
        [req.user.id, user.group_id, ALL_DISTRICTS_SENTINEL],
      );
      await insertStudentActivityLog({
        userId: req.user.id,
        username: user.username,
        role: user.role || "student",
        groupId: user.group_id,
        eventType: "map_lock_group",
        eventLabel: "鎖定小組地圖",
        targetType: "group",
        targetId: ALL_DISTRICTS_SENTINEL,
        newValue: "locked",
      });

      publishRealtimeEvent(
        "map-lock-updated",
        await buildGroupLockRealtimePayload({ scope: "group", groupId: user.group_id, userId: req.user.id }),
      );
      res.json({ message: "小組地圖已鎖定", isGroupMapLocked: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "鎖定小組地圖失敗" });
    }
  });

  router.get("/api/class-group-decisions", authenticateToken, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");

      const [memberChoiceRows] = await pool.query(
        `SELECT u.group_id AS groupId, u.id AS userId, c.district_name, c.choice
         FROM users u
         LEFT JOIN map_choices c ON c.scope = 'personal' AND c.user_id = u.id
         WHERE u.group_id IS NOT NULL AND COALESCE(u.role, 'student') = 'student'
         ORDER BY u.group_id ASC, u.id ASC, c.district_name ASC`,
      );

      const personalMapsByGroupId = new Map();
      memberChoiceRows.forEach((row) => {
        if (!row.groupId || !row.userId) return;
        const groupKey = String(row.groupId);
        const userKey = String(row.userId);
        if (!personalMapsByGroupId.has(groupKey)) personalMapsByGroupId.set(groupKey, new Map());
        const userMaps = personalMapsByGroupId.get(groupKey);
        if (!userMaps.has(userKey)) userMaps.set(userKey, {});
        if (row.district_name && row.choice) {
          userMaps.get(userKey)[row.district_name] = row.choice;
        }
      });

      const [groupFinalRows] = await pool.query(
        `SELECT group_id AS groupId, district_name, choice, updated_at
         FROM map_choices
         WHERE scope = 'group' AND group_id IS NOT NULL`,
      );
      const finalRowsByGroupId = new Map();
      groupFinalRows.forEach((row) => {
        const groupKey = String(row.groupId);
        const current = finalRowsByGroupId.get(groupKey) || [];
        current.push(row);
        finalRowsByGroupId.set(groupKey, current);
      });
      const latestPersonalActionTimes = await getLatestPersonalMapActionTimes();

      const activeGroups = await getActiveMapGroups();
      const groupResults = activeGroups.map((groupInfo) => {
        const groupId = String(groupInfo.groupId);
        const userMaps = personalMapsByGroupId.get(groupId);
        const personalMaps = userMaps ? Array.from(userMaps.values()) : [];
        const autoDecisions = resolveVoteFromMaps(personalMaps);
        const activeFinalChoices = filterActiveGroupFinalChoices({
          groupId,
          personalMaps,
          finalRows: finalRowsByGroupId.get(groupId) || [],
          latestPersonalActionTimes,
        });

        return {
          groupId,
          groupName: groupInfo.groupName,
          memberCount: groupInfo.memberCount,
          leaderCount: groupInfo.leaderCount,
          decisions: { ...autoDecisions, ...activeFinalChoices },
        };
      });

      const [classRows] = await pool.query(
        `SELECT district_name, choice, updated_at
         FROM map_choices
         WHERE scope = 'class' AND owner_id = 'class'`,
      );
      const latestClassInputActionTimes = await getLatestClassInputActionTimes();
      const activeClassFinalChoices = filterActiveClassFinalChoices({
        groupResults,
        classRows,
        latestClassInputActionTimes,
      });

      const groupLockStatuses = await getAllGroupLockStatuses();
      const groupLockSummary = groupLockSummaryFromStatuses(groupLockStatuses);

      res.json({
        groupResults,
        classFinalChoices: activeClassFinalChoices,
        groupLockStatuses,
        groupLockSummary,
        allGroupsLocked: groupLockSummary.allLocked,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取全班地圖失敗" });
    }
  });

  router.post("/api/class-final-decision", authenticateToken, requireTeacher, async (req, res) => {
    try {
      const targetDistrict = req.body?.district || req.body?.districtName;
      const choice = req.body?.choice || null;
      if (!targetDistrict) return res.status(400).json({ message: "缺少地區名稱" });
      if (choice && !VALID_FINAL_CHOICES.includes(choice)) return res.status(400).json({ message: "決策只能是保育或開發" });

      const groupLockStatuses = await getAllGroupLockStatuses();
      const groupLockSummary = groupLockSummaryFromStatuses(groupLockStatuses);
      if (!groupLockSummary.allLocked) {
        return res.status(409).json({ message: "需等待所有組長鎖定小組地圖後，才能決定全班平手地區" });
      }

      const [[oldRow]] = await pool.query(
        `SELECT choice FROM map_choices
         WHERE scope = 'class' AND owner_id = 'class' AND district_name = ?`,
        [targetDistrict],
      );
      const previousChoice = oldRow?.choice || null;

      if (previousChoice !== choice) {
        if (!choice) {
          await pool.query(
            `DELETE FROM map_choices
             WHERE scope = 'class' AND owner_id = 'class' AND district_name = ?`,
            [targetDistrict],
          );
        } else {
          await pool.query(
            `INSERT INTO map_choices (scope, owner_id, group_id, district_name, choice)
             VALUES ('class', 'class', NULL, ?, ?)
             ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = CURRENT_TIMESTAMP`,
            [targetDistrict, choice],
          );
        }

        await pool.query(
          `INSERT INTO map_action_logs (user_id, scope, group_id, district_name, previous_choice, new_choice, action_type)
           VALUES (?, 'class', NULL, ?, ?, ?, ?)`,
          [req.user.id, targetDistrict, previousChoice, choice, previousChoice ? "change_class_final" : "set_class_final"],
        );
      }

      publishRealtimeEvent("map-class-final-updated", {
        districtName: targetDistrict,
        choice,
        userId: req.user.id,
      });
      res.json({ message: choice ? "已儲存全班決策" : "已清除全班決策" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "儲存全班決策失敗" });
    }
  });

  router.get("/api/class-final-decisions", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT district_name, choice FROM map_choices WHERE scope = 'class' AND owner_id = 'class'`,
      );
      res.json(objectFromChoiceRows(rows));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取全班決策失敗" });
    }
  });

  return router;
}

module.exports = createMapRoutes;
