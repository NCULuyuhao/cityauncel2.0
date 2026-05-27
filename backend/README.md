# backend

後端使用 Express 與 MySQL，負責帳號驗證、任務狀態、資料卡、探究調查書、地圖選擇、AI 幫幫忙、教師端分析與即時事件。

## 主要內容

- `src/server.js`：啟動 HTTP 伺服器。
- `src/app.js`：建立 Express app、掛載中介層、路由與靜態檔案。
- `src/db.js`：建立 MySQL 連線池。
- `src/routes/`：所有 API 入口。
- `src/services/`：可重複使用的資料庫與業務邏輯。
- `src/middleware/`：驗證與權限檢查。
- `uploads/`：學生產生或上傳的快照圖片。

## 常用指令

```bash
npm install
npm run dev
npm run check
npm start
```

## 維護注意

- 不要把實際 `.env` 上傳到公開 repository。
- 新增 API 時，優先在 `routes/` 放 HTTP 行為，在 `services/` 放共用邏輯。
- 涉及學生行為的功能，應同步寫入 `student_activity_logs` 或對應歷程表，方便教師端分析。
