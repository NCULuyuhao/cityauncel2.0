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
