# Backend final routes/services refactor

本次整理目標是讓 `backend/src/app.js` 只保留 Express 初始化、靜態目錄、routes 掛載與錯誤處理。

## 新增 routes

- `backend/src/routes/upload.routes.js`
  - `POST /api/clue-snapshots`
  - 負責線索快照圖片上傳、base64 驗證、檔名清理與 uploads 寫入。

- `backend/src/routes/activity.routes.js`
  - `POST /api/activity-log`
  - 負責學生端活動紀錄寫入。

## 新增 shared services

- `backend/src/services/gameSettings.js`
  - `getGameSetting`
  - `setGameSetting`

- `backend/src/services/users.js`
  - `GROUPS`
  - `mapGroupName`
  - `ensureUsersGenderColumn`
  - `ensureStudentCoinBalance`
  - `getRequestUserProfile`
  - `getActor`

- `backend/src/services/schemaUtils.js`
  - `parseJSON`
  - `stringify`
  - `tableHasColumn`
  - `tableExists`
  - `tableHasIndex`
  - `ensureDataCardSourcesTable`
  - `ensureLearningDashboardIndexes`

## app.js 現在的責任

- 建立 Express app
- 設定 CORS / JSON limit
- 掛載 `/uploads` 靜態目錄
- 掛載 realtime SSE route
- 建立 shared services instance
- 掛載各 routes
- 統一錯誤處理

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```
