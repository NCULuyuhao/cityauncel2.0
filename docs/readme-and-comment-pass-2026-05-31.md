# README 與程式註解更新紀錄（2026-05-31）

本次更新目的：在不改動功能邏輯的前提下，讓目前版本的專案更容易交接、部署與維護。

## README 更新

- 重寫根目錄 `README.md`，補上完整系統流程、資料流、啟動步驟、環境變數、部署提醒與功能修改入口。
- 更新 `frontend/README.md`，說明前端資料夾責任、任務一草稿與送出流程、SSE 同步與 pending write queue。
- 更新 `backend/README.md`，補上必要環境變數、API route 地圖、service 地圖與後端維護原則。
- 更新 `database/README.md`，修正目前實際存在的重建腳本名稱，並補上資料表分類與 schema 維護原則。
- 更新 `frontend/src/api/README.md`、`frontend/src/features/inquiry/README.md`、`backend/src/services/README.md`，讓維護者能快速找到 API、任務一與 service 修改入口。

## 程式註解更新

- 為尚未有檔案用途註解的前端 API、storage、utils、features 與 CSS 補上 maintainability notes。
- 在關鍵資料流檔案補上行內註解：
  - `frontend/src/api/apiClient.ts`
  - `frontend/src/api/pendingWriteQueue.ts`
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/pages/InquiryData.tsx`
  - `frontend/src/pages/CardPackPage.tsx`
  - `frontend/src/features/cardPack/cardPackModel.ts`
  - `frontend/src/features/inquiry/timer/useDataListCountdown.ts`
  - `frontend/src/features/inquiry/water/interactiveDataSnapshotHelpers.ts`
  - `backend/src/routes/map.routes.js`
  - `backend/src/services/inquiryData.js`
  - `backend/src/services/decisioncards.js`
  - `backend/src/services/teacherLearningDashboard.js`

## 特別校正

原本 README 提到 `cityauncel_database_rebuild_clean.sql`，但目前壓縮檔內實際存在的是 `cityauncel_database_rebuild_preserve_users_settings.sql`。本次已修正文件，避免照 README 執行時找不到 SQL 檔。

## 功能影響

本次只更新文件與註解，未調整 API 路徑、資料表欄位、前端畫面流程或遊戲規則。
