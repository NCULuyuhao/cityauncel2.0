/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 users 共用服務，集中處理可被多個 API 重用的資料庫或業務邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const pool = require("../db");
const { tableExists, tableHasColumn } = require("./schemaUtils");

const GROUPS = {
  environment: { name: "🌿棲地保育局" },
  government: { name: "🚧土地規劃局" },
  farming: { name: "🐄農業生計局" },
  animal: { name: "🐕犬貓管理局" },
  greenEnergy: { name: "☀️科技投資局" },
  education: { name: "🎓公眾教育局" },
};

function mapGroupName(groupId) {
  if (!groupId) return null;
  return GROUPS[String(groupId)]?.name || null;
}

async function ensureUsersColumns() {
  if (!(await tableHasColumn("users", "gender"))) {
    await pool.query("ALTER TABLE users ADD COLUMN gender ENUM('male','female') NULL AFTER role");
  }

  if (!(await tableHasColumn("users", "barrage_coins"))) {
    await pool.query("ALTER TABLE users ADD COLUMN barrage_coins int NOT NULL DEFAULT 0 AFTER is_group_leader");
  }

  // Legacy migration: coin balance used to live in a one-to-one child table.
  // Keep this here so older local databases can boot after the schema simplification.
  if (await tableExists("student_coin_balances")) {
    await pool.query(
      `UPDATE users u
       LEFT JOIN student_coin_balances scb ON scb.user_id = u.id
       SET u.barrage_coins = COALESCE(scb.barrage_coins, u.barrage_coins, 0)`,
    );
  }
}

async function ensureUsersGenderColumn() {
  await ensureUsersColumns();
}

async function ensureStudentCoinBalance(userId, connection = pool) {
  await ensureUsersColumns();
  await connection.query(
    "UPDATE users SET barrage_coins = COALESCE(barrage_coins, 0) WHERE id = ?",
    [userId],
  );
}

async function getRequestUserProfile(userId) {
  const [rows] = await pool.query(
    `SELECT id, username, NULL AS email, role, group_id, is_group_leader
     FROM users
     WHERE id = ?`,
    [userId],
  );
  return rows[0] || null;
}

async function getActor(userId, tokenUser = {}) {
  const user = await getRequestUserProfile(userId);
  return {
    userId,
    username: user?.username || tokenUser.username || null,
    role: user?.role || tokenUser.role || "student",
    groupId: user?.group_id || null,
  };
}

module.exports = {
  GROUPS,
  mapGroupName,
  ensureUsersGenderColumn,
  ensureStudentCoinBalance,
  getRequestUserProfile,
  getActor,
};
