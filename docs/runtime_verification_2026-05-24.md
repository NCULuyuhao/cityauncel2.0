# Runtime verification after normalized database refactor

本次檢查目的：確認正規化資料庫改動後，前端 API、後端路由、資料表欄位與主要流程沒有因欄位改名或 JSON 拆表而斷掉。

## 已執行檢查

```bash
npm run check --prefix backend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
PORT=3210 node backend/src/server.js
curl http://localhost:3210/
```

檢查結果：

- 後端 `node --check` 通過。
- 前端 TypeScript 檢查通過。
- 前端 production build 通過。
- ESLint 通過。
- 後端 server 可以啟動，根路由可以回應。

## 本次額外修正

### 1. 避免相同前導答案造成不同調查書被合併

正規化後，探究資料是依 `record_order`、`orientation_created_at` 與前導答案內容組回前端格式。原本去重時會把「相同前導答案」也視為同一筆，這在學生不同回合選到一樣答案時，可能導致：

- 新回合資料被舊回合吃掉。
- 後續卡片或調查書看起來沒有存進資料庫。
- 回到首頁時調查書數量或內容不如預期。

已修正為：

- 有 `recordOrder` 時以 `recordOrder` 作為主要回合鍵。
- 有 `orientationCreatedAt` 時以時間戳作為冪等鍵。
- 只有缺少上述兩種可靠鍵時，才退回用前導答案內容去重。

修改位置：

- `backend/src/routes/inquiry.routes.js`
  - `uniquePlans`
  - `normalizeSummaryWithPlanLink`
  - `upsertSummaryByPlanLink`

### 2. 調查書更新時優先依回合序號合併

`/api/inquiries/investigations` 與 `/api/inquiries/final-summaries` 現在會優先用 `recordOrder` 找到同一份調查書，再退回使用 `orientationCreatedAt`，避免同答案、不同回合互相覆蓋。

## 需要實機 MySQL 才能完全驗證的部分

目前在 sandbox 中沒有你的 MySQL 伺服器與真實資料庫，因此尚未實際執行 `SOURCE database/cityauncel_database_rebuild_clean.sql;`。建議你在本機匯入乾淨資料庫後，依序測試：

1. 註冊 / 登入學生。
2. 首頁按「開始調查」。
3. 完成前導問題。
4. 解鎖一張資料卡並寫 note。
5. 按「結束數據探究」。
6. 選證據卡並送出調查書。
7. 回首頁確認調查書、稱號、coin、線索卡都正常。
8. 教師端開學習分析儀表板。
9. 重複開第二份調查書，且刻意填跟第一份相同的前導答案，確認兩份資料不會被合併。
