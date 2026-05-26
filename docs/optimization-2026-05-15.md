# 2026-05-15 整體效率與安全優化紀錄

## 已調整重點

1. **教師端分析查詢改成可使用索引的日期篩選**
   - 將 `DATE(a.created_at) >= ? / <= ?` 改為 `a.created_at >= ?` 與 `< DATE_ADD(?, INTERVAL 1 DAY)`。
   - 這樣 MySQL 可以使用 `created_at` 相關索引，降低大量學生行為紀錄查詢時的排序與掃描成本。
   - 目的：降低 `Out of sort memory`、查詢卡頓與教師端分析白畫面的風險。

2. **新增學習分析查詢輔助索引**
   - 新增 `idx_student_activity_dashboard_filter (created_at, event_type, target_type, user_id)`。
   - 後端啟動時會自動補索引；也同步更新 `database/2026_05_14_learning_dashboard_indexes.sql` 供手動執行。

3. **水資源資料 CSV 載入合併與取消機制**
   - 原本三個 `useEffect` 分別讀取降雨量、RPI、水質測站 CSV。
   - 改為單一 effect 以 `Promise.all` 並行載入，已有資料不重讀，切換頁面時使用 `AbortController` 取消未完成請求。
   - 目的：減少點擊水資源分類時的閃爍、重複 fetch 與不必要 state 更新。

4. **後端 CORS 與 JSON body size 可設定化**
   - 新增 `CORS_ORIGIN`，正式部署時可限制允許來源。
   - 新增 `JSON_BODY_LIMIT`，預設從 25mb 降為 12mb，降低超大 JSON 造成伺服器壓力。
   - 前端目前已盡量移除 base64 大圖資料，12mb 通常已足夠；如果仍有大型互動快照，可在 `.env` 調高。

5. **錯誤回應更明確**
   - JSON 格式錯誤回 400。
   - request body 過大回 413。
   - 避免所有解析錯誤都被包成 500，方便前端與教師端判斷問題來源。

## 驗證結果

已通過：

```bash
npm run check
```

包含：

- 後端 `node --check`
- 前端 `tsc -b --pretty false`

前端完整 build 在此沙盒環境中因上傳壓縮包內的 `node_modules` 缺少 Linux optional native binding 而無法完成，錯誤來自 `@rolldown/binding-linux-x64-gnu` 缺失。這通常是跨作業系統搬移 `node_modules` 造成，請在本機刪除 `node_modules` 後重新 `npm install` 再執行 build。

## 建議覆蓋方式

1. 備份原專案。
2. 覆蓋本壓縮包內容。
3. 將原本的 `backend/.env` 保留或依 `backend/.env.example` 建立。
4. 建議重新安裝依賴：

```bash
npm run install:all
npm run check
npm run dev:backend
npm run dev:frontend
```

若要建置前端：

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

Windows PowerShell 可使用：

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run build
```
