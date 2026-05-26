# 專案層級建議

- `backend/src/app.js`：Express app、middleware、routes 掛載與目前保留的主要 API。
- `backend/src/server.js`：只負責啟動 HTTP server。
- `backend/src/routes/`：獨立 route 模組。
- `backend/src/services/`：未來放商業邏輯。
- `frontend/src/pages/`：頁面級元件。
- `frontend/src/components/`：跨頁共用元件。
- `frontend/src/api/`：前端 API client。
