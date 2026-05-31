# backend

後端使用 Express 5 與 MySQL，負責帳號驗證、任務狀態、資料卡、調查書、地圖鎖定、角色卡包、AI 幫幫忙、教師端分析、圖片上傳與 SSE 即時同步。

## 啟動與檢查

```bash
npm install
npm run dev
npm run check
npm start
```

## 必要環境變數

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密碼
DB_NAME=cityauncel_game_system
JWT_SECRET=請改成一組夠長的隨機字串
CORS_ORIGIN=http://localhost:5173
```

AI 幫幫忙可使用 OpenAI 或 Azure OpenAI。若未設定 key，AI route 會走 fallback 或回傳錯誤，需依實際部署環境確認。

## 目錄責任

```txt
src/
├─ server.js                 只負責讀取 app 並 listen
├─ app.js                    中介層、rate limit、路由掛載、錯誤處理
├─ db.js                     MySQL 連線池與必要 env 檢查
├─ middleware/
│  └─ auth.js                JWT 驗證與教師權限
├─ routes/                   HTTP controller 層
└─ services/                 可重用資料庫與業務邏輯
```

## API 路由地圖

| 路由檔 | 功能 |
|---|---|
| `auth.routes.js` | 登入、註冊、目前使用者資訊 |
| `gameStatus.routes.js` | 全班任務狀態、教師流程控制狀態 |
| `inquiry.routes.js` | 調查書、前導問題、資料卡、稱號 |
| `map.routes.js` | 個人/小組/全班地圖、鎖定、地圖統計 |
| `groupCardPack.routes.js` | 組內選牌、卡包鎖定、同步公告 |
| `voting.routes.js` | 角色卡包投票、嫌疑角色投票相關邏輯 |
| `ai.routes.js` | AI 幫幫忙對話、缺口檢查、使用紀錄 |
| `teacher.routes.js` | 教師端管理、資料匯總、學習分析 |
| `activity.routes.js` | 學生行為紀錄 |
| `barrage.routes.js` | 彈幕訊息 |
| `upload.routes.js` | 線索快照上傳 |

## Service 地圖

| service | 責任 |
|---|---|
| `users.js` | 使用者、組別、coin、actor profile |
| `schemaUtils.js` | 啟動時檢查 / 補齊資料表與欄位 |
| `inquiryData.js` | 任務一 normalized 儲存與讀取 |
| `aiHelperService.js` | AI prompt、fallback、使用紀錄與引用卡片 |
| `mapDecisionService.js` | 地圖選項、票數統計、平手判定 |
| `decisioncards.js` | 角色卡包 schema、選牌、投票與回合結算 |
| `votingService.js` | 投票資料聚合與通用投票服務 |
| `teacherLearningDashboard.js` | 教師端量化 / 質性分析資料整理 |
| `realtime.js` | SSE 連線註冊與事件廣播 |
| `activityLog.js` | 學生操作紀錄寫入與重複事件過濾 |
| `gameSettings.js` | 全班任務開關與遊戲設定 |

## 維護注意

- 新增 API 時，routes 只處理 HTTP request/response；資料庫查詢與可重用規則放到 services。
- 所有需要登入的 route 應使用 `authenticateToken`；教師功能再加 `requireTeacher`。
- 會影響學生歷程或教師分析的操作，需同步寫入明確的資料表或 `student_activity_logs`。
- 即時同步請透過 `publishRealtimeEvent`，事件 payload 要包含足夠的 scope，讓前端能過濾。
- 修改 schema 前，先檢查 `database/` SQL 與 `schemaUtils.js` 是否也要同步。
- 不要把 `.env`、真實 token、資料庫密碼或學生個資提交到 repository。
