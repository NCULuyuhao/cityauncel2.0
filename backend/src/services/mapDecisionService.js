/**
 * CityAuncel maintainability notes
 * 檔案用途：後端地圖決策 service，負責地圖選擇資料轉換、平手判斷與有效最終決策篩選。
 * 維護重點：此檔集中管理地圖決策規則；route 只處理 API 入口與回應。
 */

const pool = require("../db");

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

module.exports = {
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
};
