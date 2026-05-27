# README 與程式註解整理紀錄（2026-05-27）

本次整理目的：提升專案可讀性，讓後續維護者能快速理解每個資料夾與主要程式檔的責任範圍。

## 已完成項目

- 重寫或新增 37 個非相依套件資料夾的 `README.md`。
- 替前端、後端、SQL、CSS、HTML、Python 等 130 個程式/腳本檔加入檔案用途註解。
- 針對 `backend/src/app.js`、`backend/src/db.js`、`backend/src/routes/ai.routes.js`、`frontend/src/api/apiClient.ts`、`frontend/src/features/inquiry/ai/AiInquiryAssistant.tsx`、`frontend/src/pages/InquiryData.tsx`、`frontend/src/pages/HomePage.tsx` 等關鍵檔案補上額外行內註解。
- 未調整既有功能邏輯、API 路徑、資料表欄位或畫面流程。

## 檢查結果

- `npm run check` 已通過：後端 JavaScript 語法檢查與前端 TypeScript 型別檢查皆正常。
- `npm run build:frontend` 在目前沙盒環境無法完成，原因是壓縮檔內的 `frontend/node_modules` 帶有 Windows/Rolldown native binding，缺少 Linux 對應套件。此錯誤與本次 README/註解修改無關；在實際開發機重新執行 `npm install` 後再打包即可。

## 維護建議

後續若再新增資料夾，建議同步新增 `README.md`，並在新增程式檔開頭加入用途註解，避免專案規模變大後難以追蹤責任範圍。
