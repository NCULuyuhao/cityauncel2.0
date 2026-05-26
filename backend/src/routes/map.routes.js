const express = require("express");

const pool = require("../db");
const { authenticateToken, requireTeacher } = require("../middleware/auth");
const { insertStudentActivityLog } = require("../services/activityLog");

const VALID_MAP_CHOICES = ["保育", "開發", "我不知道"];
const VALID_FINAL_CHOICES = ["保育", "開發"];
const GROUPS = {
  environment: { name: "🌿棲地保育局" },
  government: { name: "🚧土地規劃局" },
  farming: { name: "🐄農業生計局" },
  animal: { name: "🐕犬貓管理局" },
  greenEnergy: { name: "☀️科技投資局" },
  education: { name: "🎓公眾教育局" },
};

function objectFromChoiceRows(rows) {
  const result = {};
  (rows || []).forEach((row) => {
    const districtName = row.district_name || row.districtName;
    if (!districtName) return;
    result[districtName] = row.choice || null;
  });
  return result;
}

async function replaceMapChoices(connection, userId, nextMapState, groupId = null) {
  const [oldRows] = await connection.query(
    `SELECT district_name, choice FROM map_choices WHERE scope = 'personal' AND user_id = ?`,
    [userId],
  );
  const oldMapState = objectFromChoiceRows(oldRows);

  const allDistricts = new Set([
    ...Object.keys(oldMapState || {}),
    ...Object.keys(nextMapState || {}),
  ]);

  for (const districtName of allDistricts) {
    const previousChoice = oldMapState[districtName] || null;
    const newChoice = nextMapState[districtName] || null;

    if (newChoice && !VALID_MAP_CHOICES.includes(newChoice)) continue;
    if (previousChoice === newChoice) continue;

    if (!newChoice) {
      await connection.query(
        "DELETE FROM map_choices WHERE scope = 'personal' AND user_id = ? AND district_name = ?",
        [userId, districtName],
      );
    } else {
      await connection.query(
        `INSERT INTO map_choices (scope, owner_id, user_id, district_name, choice)
         VALUES ('personal', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = CURRENT_TIMESTAMP`,
        [String(userId), userId, districtName, newChoice],
      );
    }

    if (groupId) {
      await connection.query(
        `DELETE FROM map_choices
         WHERE scope = 'group' AND group_id = ? AND district_name = ?`,
        [groupId, districtName],
      );
    }
    await connection.query(
      `DELETE FROM map_choices
       WHERE scope = 'class' AND owner_id = 'class' AND district_name = ?`,
      [districtName],
    );

    await connection.query(
      `INSERT INTO map_action_logs (
        user_id, scope, group_id, district_name,
        previous_choice, new_choice, action_type
      ) VALUES (?, 'personal', ?, ?, ?, ?, ?)`,
      [
        userId,
        groupId,
        districtName,
        previousChoice,
        newChoice,
        previousChoice ? "change_choice" : "set_choice",
      ],
    );
  }

  return oldMapState;
}

function resolveVoteFromMaps(maps) {
  const result = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([district, choice]) => {
      if (!result[district]) result[district] = { 保育: 0, 開發: 0, 我不知道: 0 };
      if (choice === "保育") result[district].保育 += 1;
      if (choice === "開發") result[district].開發 += 1;
      if (choice === "我不知道") result[district].我不知道 += 1;
    });
  });

  const final = {};
  Object.entries(result).forEach(([district, count]) => {
    const knownVotes = count.保育 + count.開發;
    if (knownVotes === 0 && count.我不知道 === maps.length && maps.length > 0) {
      final[district] = "我不知道";
    } else if (count.保育 > count.開發) {
      final[district] = "保育";
    } else if (count.開發 > count.保育) {
      final[district] = "開發";
    } else {
      final[district] = null;
    }
  });
  return final;
}

function buildVoteStatsFromMaps(maps) {
  const stats = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([district, choice]) => {
      if (!stats[district]) stats[district] = { 保育: 0, 開發: 0, 我不知道: 0 };
      if (choice === "保育") stats[district].保育 += 1;
      if (choice === "開發") stats[district].開發 += 1;
      if (choice === "我不知道") stats[district].我不知道 += 1;
    });
  });
  return stats;
}

function isTieFromVoteStats(stats) {
  if (!stats) return false;
  const conserveCount = Number(stats.保育 || 0);
  const developCount = Number(stats.開發 || 0);
  const knownVotes = conserveCount + developCount;
  return knownVotes > 0 && conserveCount === developCount;
}

function toTimeValue(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOverrideFresh(overrideUpdatedAt, latestInputChangedAt) {
  const overrideTime = toTimeValue(overrideUpdatedAt);
  const inputTime = toTimeValue(latestInputChangedAt);
  if (!overrideTime) return true;
  if (!inputTime) return true;
  return overrideTime >= inputTime;
}

async function getLatestPersonalMapActionTimes(groupId = null) {
  const params = [];
  const where = ["scope = 'personal'", "group_id IS NOT NULL"];
  if (groupId) {
    where.push("group_id = ?");
    params.push(groupId);
  }

  const [rows] = await pool.query(
    `SELECT group_id AS groupId, district_name AS districtName, MAX(created_at) AS latestChangedAt
     FROM map_action_logs
     WHERE ${where.join(" AND ")}
     GROUP BY group_id, district_name`,
    params,
  );

  const result = new Map();
  rows.forEach((row) => {
    result.set(`${row.groupId}::${row.districtName}`, row.latestChangedAt);
  });
  return result;
}

async function getLatestClassInputActionTimes() {
  const [rows] = await pool.query(
    `SELECT district_name AS districtName, MAX(created_at) AS latestChangedAt
     FROM map_action_logs
     WHERE scope IN ('personal', 'group')
     GROUP BY district_name`,
  );

  const result = new Map();
  rows.forEach((row) => {
    result.set(String(row.districtName), row.latestChangedAt);
  });
  return result;
}

function filterActiveGroupFinalChoices({ groupId, personalMaps, finalRows, latestPersonalActionTimes }) {
  const voteStats = buildVoteStatsFromMaps(personalMaps);
  const active = {};

  finalRows.forEach((row) => {
    const districtName = row.district_name || row.districtName;
    const choice = row.choice;
    if (!districtName || !choice) return;
    if (!isTieFromVoteStats(voteStats[districtName])) return;

    const latestInputChangedAt = latestPersonalActionTimes?.get(`${groupId}::${districtName}`);
    if (!isOverrideFresh(row.updated_at || row.updatedAt, latestInputChangedAt)) return;

    active[districtName] = choice;
  });

  return active;
}

function filterActiveClassFinalChoices({ groupResults, classRows, latestClassInputActionTimes }) {
  const groupDecisionMaps = groupResults.map((group) => group.decisions || {});
  const active = {};

  classRows.forEach((row) => {
    const districtName = row.district_name || row.districtName;
    const choice = row.choice;
    if (!districtName || !choice) return;

    const votes = groupDecisionMaps.map((decisions) => decisions[districtName]).filter(Boolean);
    const classStats = buildVoteStatsFromMaps(votes.map((vote) => ({ [districtName]: vote })));
    if (!isTieFromVoteStats(classStats[districtName])) return;

    const latestInputChangedAt = latestClassInputActionTimes?.get(String(districtName));
    if (!isOverrideFresh(row.updated_at || row.updatedAt, latestInputChangedAt)) return;

    active[districtName] = choice;
  });

  return active;
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

  router.use([
    "/api/user-map",
    "/api/group-personal-maps",
    "/api/group-final-decision",
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
      res.json({ mapState: objectFromChoiceRows(rows) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "讀取個人地圖失敗" });
    }
  });

  router.put("/api/user-map", authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const nextMapState = req.body?.mapState || {};
      const actor = await getActor(req.user.id, req.user);

      await connection.beginTransaction();
      const oldMapState = await replaceMapChoices(connection, req.user.id, nextMapState, actor.groupId);
      await connection.commit();

      const allDistricts = new Set([...Object.keys(oldMapState), ...Object.keys(nextMapState)]);
      for (const districtName of allDistricts) {
        const previousChoice = oldMapState[districtName] || null;
        const newChoice = nextMapState[districtName] || null;
        if (previousChoice !== newChoice) {
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
        }
      }

      publishRealtimeEvent("map-user-updated", { userId: req.user.id, groupId: actor.groupId || null });
      res.json({ message: "個人地圖已儲存" });
    } catch (error) {
      await connection.rollback();
      console.error(error);
      res.status(500).json({ message: "儲存個人地圖失敗" });
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
        return res.json({ groupId: null, groupName: null, members: [], personalData: [], groupFinalDecisions: {} });
      }

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

      const [finalRows] = await pool.query(
        `SELECT district_name, choice, updated_at
         FROM map_choices
         WHERE scope = 'group' AND group_id = ?`,
        [groupId],
      );

      const personalData = members.map((member) => choicesByUserId.get(String(member.id)) || {});
      const latestPersonalActionTimes = await getLatestPersonalMapActionTimes(groupId);
      const activeGroupFinalDecisions = filterActiveGroupFinalChoices({
        groupId,
        personalMaps: personalData,
        finalRows,
        latestPersonalActionTimes,
      });

      res.json({
        groupId,
        groupName: mapGroupName(groupId),
        members: members.map((member) => ({
          id: member.id,
          username: member.username,
          name: member.username,
          email: member.email,
          isGroupLeader: Boolean(member.is_group_leader),
        })),
        personalData,
        groupFinalDecisions: activeGroupFinalDecisions,
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

      const groupResults = Object.entries(GROUPS).map(([groupId, groupInfo]) => {
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
          groupName: groupInfo.name,
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

      res.json({ groupResults, classFinalChoices: activeClassFinalChoices });
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
