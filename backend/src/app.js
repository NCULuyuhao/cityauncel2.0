/**
 * CityAuncel maintainability notes
 * 檔案用途：建立 Express 應用程式，集中設定 CORS、rate limit、靜態檔、API 路由與錯誤處理。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const pool = require("./db");
const inquiryRoutes = require("./routes/inquiry.routes");
const barrageRoutes = require("./routes/barrage.routes");
const createActivityRoutes = require("./routes/activity.routes");
const createAuthRoutes = require("./routes/auth.routes");
const createGameStatusRoutes = require("./routes/gameStatus.routes");
const createMapRoutes = require("./routes/map.routes");
const createUploadRoutes = require("./routes/upload.routes");
const { createVotingRoutes } = require("./routes/voting.routes");
const { createVotingService } = require("./services/votingService");
const createTeacherRoutes = require("./routes/teacher.routes");
const createAiRoutes = require("./routes/ai.routes");
const createGroupCardPackRoutes = require("./routes/groupCardPack.routes");
const { authenticateToken, requireTeacher } = require("./middleware/auth");
const { publishRealtimeEvent, registerRealtimeRoutes } = require("./services/realtime");
const { insertStudentActivityLog } = require("./services/activityLog");
const { createDecisioncardService } = require("./services/decisioncards");
const { getGameSetting, setGameSetting } = require("./services/gameSettings");
const {
  GROUPS,
  ensureStudentCoinBalance,
  ensureUsersGenderColumn,
  getActor,
  getRequestUserProfile,
  mapGroupName,
} = require("./services/users");
const {
  parseJSON,
  tableExists,
  tableHasColumn,
  ensureDataCardSourcesTable,
  ensureMapChoicesTable,
  ensureInquiryNormalizedTables,
  ensureLearningDashboardIndexes,
} = require("./services/schemaUtils");

// 建立單一 Express app，後續 middleware 與 routes 都掛在這個實例上。
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const allowedCorsOrigins = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function readPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createApiRateLimiter({ max, message, skip }) {
  return rateLimit({
    windowMs: readPositiveIntegerEnv("RATE_LIMIT_WINDOW_MS", 60 * 1000),
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip,
    message: { message },
  });
}

app.set("trust proxy", 1);
app.use(cors({
  origin: allowedCorsOrigins.length > 0 ? allowedCorsOrigins : isProduction ? false : true,
}));
// 調查書與快照可能包含較大的 JSON payload，因此 body limit 由環境變數控制。
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "12mb" }));

const authRateLimiter = createApiRateLimiter({
  max: readPositiveIntegerEnv("AUTH_RATE_LIMIT_MAX", 20),
  message: "登入或註冊嘗試過於頻繁，請稍後再試",
});
const aiRateLimiter = createApiRateLimiter({
  max: readPositiveIntegerEnv("AI_RATE_LIMIT_MAX", 30),
  message: "AI 幫幫忙使用過於頻繁，請稍後再試",
});
const uploadRateLimiter = createApiRateLimiter({
  max: readPositiveIntegerEnv("UPLOAD_RATE_LIMIT_MAX", 60),
  message: "圖片上傳過於頻繁，請稍後再試",
});
const generalRateLimiter = createApiRateLimiter({
  max: readPositiveIntegerEnv("GENERAL_RATE_LIMIT_MAX", 1200),
  message: "操作過於頻繁，請稍後再試",
  // 首頁、教師端與學生端有多個狀態查詢與 SSE 備援輪詢；GET 若跟寫入操作共用限制，
  // 在開發模式、React StrictMode 或全班同 IP 的教室網路下容易誤判為 429。
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
});

app.use(["/api/login", "/api/register"], authRateLimiter);
app.use("/api/ai", aiRateLimiter);
app.use("/api/clue-snapshots", uploadRateLimiter);
app.use("/api", generalRateLimiter);

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const UPLOADS_DIR = path.join(PROJECT_ROOT, "backend", "uploads");
const CLUE_SNAPSHOT_UPLOAD_DIR = path.join(UPLOADS_DIR, "clue_snapshots");
app.use("/uploads", express.static(UPLOADS_DIR));

registerRealtimeRoutes(app);

const decisioncardService = createDecisioncardService({
  pool,
  GROUPS,
  parseJSON,
  tableExists,
  tableHasColumn,
});

const votingService = createVotingService({
  pool,
  parseJSON,
  mapGroupName,
  getGameSetting,
  setGameSetting,
  tableExists,
  tableHasColumn,
  ensureDecisioncardsTable: decisioncardService.ensureDecisioncardsTable,
  getAllDecisioncards: decisioncardService.getAllDecisioncards,
});

app.get("/", (req, res) => {
  res.send("CityAuncel backend is running with the clean database schema");
});

app.use(createAuthRoutes({
  ensureUsersGenderColumn,
  ensureStudentCoinBalance,
  getRequestUserProfile,
  mapGroupName,
}));

app.use(createGameStatusRoutes({
  getGameSetting,
  setGameSetting,
  publishRealtimeEvent,
}));

app.use(createMapRoutes({
  getRequestUserProfile,
  getActor,
  mapGroupName,
  publishRealtimeEvent,
  ensureMapChoicesTable,
}));

app.use(createVotingRoutes({
  votingService,
  getActor,
  getGameSetting,
  setGameSetting,
  publishRealtimeEvent,
}));

app.use(createGroupCardPackRoutes({
  pool,
  authenticateToken,
  getRequestUserProfile,
  parseJSON,
  publishRealtimeEvent,
  insertStudentActivityLog,
  decisioncardService,
}));

app.use(createTeacherRoutes({
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
  ensureDecisioncardsTable: decisioncardService.ensureDecisioncardsTable,
  insertDecisioncardLog: decisioncardService.insertDecisioncardLog,
  buildTeacherDecisioncardsPayload: decisioncardService.buildTeacherDecisioncardsPayload,
  getDecisioncardByGroupId: decisioncardService.getDecisioncardByGroupId,
  getAllDecisioncards: decisioncardService.getAllDecisioncards,
}));

app.use(createAiRoutes({ getActor }));
app.use(createUploadRoutes({ clueSnapshotUploadDir: CLUE_SNAPSHOT_UPLOAD_DIR }));
app.use(createActivityRoutes({ getActor }));
app.use("/api/inquiries", authenticateToken, inquiryRoutes);
app.use("/api", barrageRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ message: "送出的資料太大，請重新整理後再試一次" });
  }
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ message: "JSON 格式錯誤，請重新送出" });
  }
  return res.status(500).json({ message: "伺服器錯誤" });
});

module.exports = app;
