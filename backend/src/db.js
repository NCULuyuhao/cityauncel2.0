/**
 * CityAuncel maintainability notes
 * 檔案用途：建立 MySQL 連線池，供 routes 與 services 共用資料庫連線。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}

function numberFromEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// 使用連線池避免每次 API 請求都重新建立 MySQL 連線。
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: numberFromEnv("DB_PORT", 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: numberFromEnv("DB_CONNECTION_LIMIT", 10),
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "+08:00",
  supportBigNumbers: true,
});

module.exports = pool;
