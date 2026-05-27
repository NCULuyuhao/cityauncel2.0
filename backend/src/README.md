# backend/src

這裡是後端主程式碼。整體架構以 Express app 為中心，搭配 routes、services 與 middleware 分層。

## 分層說明

- `server.js`：只負責啟動服務。
- `app.js`：集中註冊跨域、JSON body、rate limit、API 路由與錯誤處理。
- `db.js`：集中管理 MySQL 連線池。
- `routes/`：API controller 層。
- `services/`：資料庫操作與可重用業務邏輯。
- `middleware/`：token 驗證、教師權限等 HTTP 中介層。

## 修改建議

修改功能時先找對應 route，再確認是否已有 service 可重用。避免把大量 SQL 與流程邏輯都塞進 `app.js`。
