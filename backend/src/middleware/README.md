# backend/src/middleware

這裡放 Express middleware。middleware 應專注於請求進入 route 前需要共用處理的事情，例如身分驗證、權限檢查或請求資料整理。

目前主要檔案：

- `auth.js`：解析 JWT、取得登入者資訊，並提供教師權限檢查。
