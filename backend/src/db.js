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
