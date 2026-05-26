# Backend routes refactor v12

本輪以 `cityauncel4_dead_api_cleanup_snapshot_flow_v11` 為基礎，繼續把仍在使用的後端 API 依功能拆出，並避免改動前端呼叫路徑。

## 拆分內容

### `backend/src/routes/barrage.routes.js`

拆出目前前端仍會使用的彈幕相關 API：

- `GET /api/barrage-status`
- `GET /api/barrages/latest-id`
- `GET /api/barrages`
- `POST /api/barrages`

彈幕字數限制、不當字詞檢查、coin 扣除與彈幕 activity log 也集中在這個 route 檔案內。

### `backend/src/routes/auth.routes.js`

拆出登入註冊與目前使用者同步：

- `POST /api/register`
- `POST /api/login`
- `GET /api/me`

保留原本不需要 email 的帳號登入邏輯。

### `backend/src/routes/gameStatus.routes.js`

拆出教師控制狀態類 API：

- `GET /api/map-task-status`
- `PUT /api/map-task-status`
- `GET /api/inquiry-task-status`
- `PUT /api/inquiry-task-status`
- `GET /api/card-pack-status`
- `PUT /api/card-pack-status`
- `GET /api/student-screen-lock`
- `PUT /api/student-screen-lock`

這些 route 仍透過注入的 `getGameSetting`、`setGameSetting`、`publishRealtimeEvent` 使用原本 app.js 的設定與即時事件機制。

### `backend/src/services/activityLog.js`

拆出學生行為紀錄寫入服務：

- `insertStudentActivityLog`
- activity value 瘦身與去重
- 卡片物件轉 cardId 的紀錄清理規則

`app.js` 與 `barrage.routes.js` 現在都使用同一份 activity log service，避免重複維護。

## app.js 變化

`backend/src/app.js` 從約 4383 行降到約 3868 行。

本輪保留在 `app.js` 的內容主要仍是：

- 資料表 ensure / migration 類 helper
- 地圖與投票流程
- AI 幫幫忙與 AI chat
- 教師 dashboard
- database reset

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```

## 下一步建議

下一輪可以繼續拆：

1. `voting.routes.js`：嫌犯投票與最終結算相關 API。
2. `map.routes.js`：個人地圖、小組地圖、全班共識地圖。
3. `teacher.routes.js`：教師端玩家、分組、learning dashboard、清空資料。
4. `ai.routes.js`：AI 幫幫忙與 AI chat。

建議先拆 `map.routes.js` 或 `voting.routes.js`，因為這兩類在前端路徑明確，且比 AI route 更容易驗證。
