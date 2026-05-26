# 送出探究總結 500 修正（2026-05-23）

## 問題
正式站送出 `/api/inquiries/final-summaries` 時，前端顯示：

- `POST /api/inquiries/final-summaries 500`
- `儲存探究總結失敗`

## 修正內容

1. `backend/src/routes/inquiry.routes.js`
   - 新增 `toSqlDateTimeValue()`。
   - 將寫入 `inquiry_records.created_at`、`inquiry_records.ended_at` 的時間轉為 MySQL 可接受的 `Date` 值。
   - 避免前端送出的 `new Date().toISOString()` 直接寫入 MySQL `DATETIME` 欄位而在 strict mode 造成 500。

2. `backend/src/middleware/auth.js`
   - 驗證 JWT 後，再到 `users` 表確認帳號仍存在。
   - 避免資料庫重建後，舊 token 指向已不存在的 `user_id`，導致 `inquiry_records` 外鍵失敗。
   - 若帳號不存在，回傳 `401 帳號資料不存在，請重新登入`，不再讓寫入流程變成 500。

## 驗證

- `backend npm run check` 已通過。
- `frontend npm run build` 已通過。
