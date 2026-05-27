/**
 * CityAuncel maintainability notes
 * 檔案用途：後端 gameSettings 共用服務，集中處理可被多個 API 重用的資料庫或業務邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const pool = require("../db");
const { parseJSON } = require("./schemaUtils");

async function getGameSetting(key, fallback) {
  const [rows] = await pool.query(
    "SELECT setting_value FROM game_settings WHERE setting_key = ?",
    [key],
  );
  if (rows.length === 0) return fallback;
  return parseJSON(rows[0].setting_value, fallback);
}

async function setGameSetting(key, value) {
  const serializedValue = JSON.stringify(value);
  await pool.query(
    `INSERT INTO game_settings (setting_key, setting_value)
     VALUES (?, ?) AS new_setting
     ON DUPLICATE KEY UPDATE
       setting_value = new_setting.setting_value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, serializedValue],
  );
}

module.exports = {
  getGameSetting,
  setGameSetting,
};
