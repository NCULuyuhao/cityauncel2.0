# AI 幫幫忙 prompt 與開關調整（2026-05-17）

## 修改重點

1. 後端 `backend/src/app.js`
   - 重新強化 AI 幫幫忙 prompt。
   - 所有對話型 AI 都會先判斷學生文字狀態：求助、提出想法、已做決定、準備結束。
   - 指引探究方向改為「詰問引導型」：求助或提出想法時用一個問題引導；已做決定時肯定並收斂，不再硬追問。
   - 數據關聯性改為「方向給予型」：學生有想法時直接給可查的資料方向，不再模仿詰問法；只有完全沒方向時才溫和引導學生先說想法。
   - 增加後處理：若數據關聯性在學生已有想法時又變成問句，會改用備援方向建議；若指引探究方向在學生已做決定或準備結束時仍追問，也會改成收斂回覆。
   - 對話型回覆上限調整為 45 字，避免因 30 字過短導致語氣不自然。

2. 前端 `frontend/src/components/AiInquiryAssistant.tsx`
   - 移除 AI 幫幫忙視窗右上角 X。
   - 底部「AI 幫幫忙」按鈕改為同一顆按鈕開啟/關閉；開啟時文字顯示「收起幫幫忙」。
   - 前端對話型回覆截斷上限同步調整為 45 字。
   - 輸入框提示改為更自然的「AI會接著你的想法回」。

## 驗證

- 已執行 `node --check backend/src/app.js`。
- 已執行 `npx tsc -b --pretty false`。
- `npm run build` 的 TypeScript 階段通過，但 Vite 階段受上傳壓縮檔內 Windows node_modules 缺少 Linux optional native binding 影響，出現 `@rolldown/binding-linux-x64-gnu` 缺失。此問題屬 node_modules 平台相依套件問題，回到原本 Windows 專案重新 `npm install` 後再 build 即可。
