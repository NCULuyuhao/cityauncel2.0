# Backend dead API cleanup and snapshot flow refactor

## 依據

本次清理以前端目前實際呼叫的 API 為基準，檢查 `frontend/src` 中的 `fetch()`、`requestJson()` 與 API wrapper，再比對 `backend/src/app.js` 中仍保留的 routes。

## 已移除的後端舊端點

這些端點目前沒有被前端畫面或功能呼叫，且多數屬於舊版資料同步或舊教師分析功能：

- `GET /api/user-data`
- `PUT /api/user-data`
- `PUT /api/user-data/profile`
- `PUT /api/user-data/inquiry-plans`
- `PUT /api/user-data/final-summaries`
- `PUT /api/user-data/titles`
- `PUT /api/user-data/cards`
- `GET /api/group-final-decisions`
- `PUT /api/teacher/groups`
- `GET /api/teacher/group-card-pack-lock-logs`
- `GET /api/teacher/analytics-query`
- `GET /api/teacher/activity-logs`

## 一併移除的舊 helper

移除上述端點後，以下只服務舊端點的 helper 也已移除：

- 舊 `/api/user-data*` 使用的資料同步 helper
- 舊教師端 analytics query 使用的查詢與序列分析 helper
- 舊 group final decisions 使用的整理 helper
- 舊 card source legacy upsert helper

目前新版探究資料改走 `backend/src/routes/inquiry.routes.js` 的 `/api/inquiries/*`，不再使用舊 `/api/user-data*`。

## 快照卡建立流程拆分

新增：

- `frontend/src/features/inquiry/snapshots/snapshotCardFlow.ts`

負責從 `InquiryData.tsx` 移出快照卡建立後的副作用流程：

- 加入 `cards` state
- 加入本回合收藏
- 更新 `unlockedCardIds`
- 通知 AI 幫幫忙
- 觸發剛解鎖動畫
- 捲動到新快照卡並閃爍提示
- 更新開發 / 保育平衡分數
- 寫入 activity log
- 同步 investigation cards

`InquiryData.tsx` 現在只保留 `handleCreateSnapshotCard` 的流程入口，實際副作用交給 `applySnapshotCardCreation()`。

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```
