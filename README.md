# CityAuncel 石虎探究遊戲系統

CityAuncel 是一套以「石虎生存危機」為核心的探究式學習與協商遊戲系統。學生會依序完成資料探究、調查書、地圖決策與角色卡包協商；教師端可控制任務進度、查看學生行為紀錄與學習成果分析。

這份 README 用來協助後續維護者快速理解專案結構、啟動方式、主要資料流與修改入口。

## 系統流程總覽

```txt
登入 / 註冊
  ↓
首頁 HomePage
  ├─ 任務一：數據調查工作臺 InquiryData
  │   ├─ 前導探究問題
  │   ├─ 數據卡解鎖與蒐集理由
  │   ├─ 水資源即時快照 / 線索卡
  │   ├─ AI 幫幫忙
  │   └─ 調查書送出與稱號獎勵
  │
  ├─ 任務二：繪製地圖 MiaoliMap
  │   ├─ 個人地圖鎖定
  │   ├─ 小組地圖整合與組長決策
  │   └─ 全班地圖整合與教師決策
  │
  ├─ 角色卡包 CardPackPage
  │   ├─ 組內選 3 張行動卡
  │   ├─ 標記核心牌與撰寫理由
  │   ├─ 公告欄投票：同意 / 反對 / 保留
  │   └─ 回合結算與分數紀錄
  │
  └─ 教師端 ControlPage / BehaviorRecord
      ├─ 任務開關與全班流程控制
      ├─ 學生行為紀錄
      └─ 學習分析儀表板
```

## 專案結構

```txt
cityauncel2.0/
├─ backend/                 Express + MySQL 後端 API
│  ├─ src/app.js            Express app、中介層、路由掛載、全域錯誤處理
│  ├─ src/server.js         HTTP server 啟動入口
│  ├─ src/db.js             MySQL 連線池
│  ├─ src/routes/           API controller 層
│  ├─ src/services/         資料庫操作與可重用業務邏輯
│  └─ uploads/              線索快照等上傳檔案
│
├─ frontend/                Vite + React + TypeScript 前端
│  ├─ src/pages/            頁面級元件與主要流程
│  ├─ src/features/         依任務拆分的 UI、hooks、模型與資料轉換
│  ├─ src/api/              API 呼叫封裝、即時同步與暫存寫入佇列
│  ├─ src/storage/          localStorage 草稿 / 登入狀態 / UI 狀態
│  ├─ src/components/       跨頁共用元件
│  └─ src/styles/           全域、響應式、iOS Safari 與效能樣式
│
├─ database/                MySQL schema 與分表 SQL
├─ docs/                    重構、修正、資料庫與分析設計紀錄
├─ generate_precise_map_data.py
└─ update_station_coords.py
```

## 第一次啟動

在專案根目錄安裝前後端相依套件：

```bash
npm run install:all
```

### 1. 建立後端環境變數

目前 zip 內沒有 `.env.example`，請在 `backend/` 自行建立 `.env`：

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密碼
DB_NAME=cityauncel_game_system
JWT_SECRET=請改成一組夠長的隨機字串

# 前端部署網域；本機開發可留空或填 http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# 可選：AI 幫幫忙
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
AI_HELPER_MODEL=gpt-5-mini
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
AZURE_OPENAI_AI_HELPER_DEPLOYMENT=
AZURE_OPENAI_API_VERSION=preview
```

### 2. 重建資料庫

目前資料庫主重建腳本是：

```sql
SOURCE database/cityauncel_database_rebuild_preserve_users_settings.sql;
```

這個腳本用來重建主要 schema，並保留使用者與遊戲設定相關資料。若你要完全清空重建，請先自行確認備份，再依實際需求調整 SQL。

### 3. 啟動後端

```bash
npm run dev:backend
```

或：

```bash
cd backend
npm run dev
```

預設會在 `http://localhost:3001` 啟動。

### 4. 啟動前端

```bash
npm run dev:frontend
```

或：

```bash
cd frontend
npm run dev
```

預設會在 `http://localhost:5173` 啟動。

若後端不是 `http://localhost:3001`，請在前端環境變數設定：

```env
VITE_API_BASE_URL=https://你的後端網址
```

## 常用檢查與打包

```bash
npm run check
npm run build:frontend
```

- `npm run check`：執行後端 JavaScript 語法檢查與前端 TypeScript 型別檢查。
- `npm run build:frontend`：執行前端正式版編譯。
- 若在不同作業系統解壓縮舊的 `node_modules` 後 build 失敗，請刪除前後端 `node_modules` 後重新 `npm install`。

## 主要修改入口

| 想修改的功能 | 優先檢查檔案 |
|---|---|
| 登入、註冊、使用者資料 | `backend/src/routes/auth.routes.js`、`backend/src/services/users.js`、`frontend/src/api/authApi.ts` |
| 任務一資料探究畫面 | `frontend/src/pages/InquiryData.tsx`、`frontend/src/features/inquiry/` |
| 調查書儲存 / 送出 | `frontend/src/features/inquiry/hooks/useInquirySubmission.ts`、`backend/src/routes/inquiry.routes.js`、`backend/src/services/inquiryData.js` |
| AI 幫幫忙 | `frontend/src/features/inquiry/ai/`、`frontend/src/api/aiHelperApi.ts`、`backend/src/routes/ai.routes.js`、`backend/src/services/aiHelperService.js` |
| 任務二地圖 | `frontend/src/pages/MiaoliMap.tsx`、`backend/src/routes/map.routes.js`、`backend/src/services/mapDecisionService.js` |
| 角色卡包 | `frontend/src/pages/CardPackPage.tsx`、`frontend/src/features/cardPack/`、`backend/src/routes/groupCardPack.routes.js`、`backend/src/services/decisioncards.js` |
| 教師端控制 | `frontend/src/pages/ControlPage.tsx`、`backend/src/routes/teacher.routes.js` |
| 教師端學習分析 | `frontend/src/pages/BehaviorRecord.tsx`、`backend/src/services/teacherLearningDashboard.js` |
| 即時同步 SSE | `frontend/src/api/realtime.ts`、`backend/src/services/realtime.js` |
| 資料庫 schema | `database/`、`backend/src/services/schemaUtils.js` |

## 維護原則

1. **頁面只負責編排流程**：複雜 UI、資料轉換、localStorage 與 API 呼叫應拆到 `features/`、`storage/` 或 `api/`。
2. **後端 routes 不堆大量 SQL**：routes 負責 HTTP 參數與回應，重用邏輯放到 services。
3. **學生行為要可分析**：影響任務歷程的動作應寫入對應表或 `student_activity_logs`。
4. **避免大型 JSON 重複存放**：調查書、卡片與理由應優先以主表 + 關聯表保存，必要時才保存衍生摘要。
5. **即時同步事件要有 scope**：小組、個人、全班事件需附上可過濾的 userId / groupId / scope，避免非相關畫面被誤觸發。
6. **卡包與地圖鎖定以後端成功為準**：前端動畫可以延後播放，但不能先假設鎖定成功。
7. **註解寫原因，不只翻譯程式碼**：新增註解時優先說明「為什麼這裡要這樣做」，不要只描述變數名稱。

## 部署提醒

- 後端部署到 Railway 時，需在 Railway 設定 `DB_*`、`JWT_SECRET`、AI key 與 CORS 相關環境變數。
- 前端部署到 Vercel 時，需設定 `VITE_API_BASE_URL` 指向 Railway 後端。
- MySQL migration 或重建前務必備份資料，尤其是正式教學資料。
- `backend/uploads/` 是執行時產生檔案，不應當作長期可靠備份；正式部署若需要長期保存，建議改用物件儲存服務。
