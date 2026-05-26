# 2026-05-16 程式碼優化紀錄

本次以「功能不變、資料儲存邏輯不破壞、提升部署彈性與互動流暢度」為優先，完成下列調整：

## 前端 API 與即時同步

- 將 `HomePage.tsx` 中多處寫死的 `http://localhost:3001` 改為共用 `apiUrl()`，避免日後部署到不同主機或改 API 網址時漏改。
- 將 `realtime.ts` 改為使用共用 `apiUrl()`，SSE 連線同樣跟著 `.env` 的 `VITE_API_BASE_URL` 走。
- 將即時同步 payload 從鬆散型別改為必要位置的明確型別收斂，保留功能，同時讓 TypeScript 檢查更可靠。

## 資料壓縮與重複邏輯整理

- 將「移除大型 base64 截圖欄位」的邏輯集中到 `payloadNormalization.ts` 的 `stripLargePayload()`。
- `inquiryApi.ts` 改用共用工具，不再自己維護一份重複的 `stripLargePayload()`。
- 保留既有規則：固定卡牌只儲存可識別資訊，互動快照卡保留必要的圖片路徑與快照描述，不再把大型 base64 圖片塞入 JSON。

## 彈幕效能與體驗

- `BarrageLayer.tsx` 改用共用 `apiUrl()`。
- 彈幕 coin 與新彈幕輪詢在瀏覽器分頁隱藏時會暫停，分頁回到可見時立即補讀，降低背景消耗與不必要請求。
- 彈幕輪詢啟動後會先讀一次，不必等第一個 interval 才同步。
- 將部分同步重置改為非同步重置，避免 React effect 中同步 setState 造成額外 render 風險。

## 登入型別與錯誤處理

- `AuthPage.tsx` 移除 `any` 型別，登入回傳資料先做安全正規化。
- 登入逾時錯誤改以 `DOMException` 判斷，避免 unknown error 型別造成型別不安全。

## 驗證結果

已通過：

```bash
npm run check
```

包含：

- 後端 `node --check`
- 前端 `tsc -b --pretty false`

另外嘗試執行前端 Vite build，但目前壓縮包內的 `node_modules` 缺少 Vite/Rolldown 的 Linux optional native binding，屬於依賴安裝環境問題，不是本次程式碼語法問題。若要在本機完整 build，請刪除 `node_modules` 後重新 `npm install`。
