# 程式碼整理紀錄

本次整理以「不改變既有功能」為原則，先處理容易累積技術債的位置。

## 已整理

- `frontend/src/api/homeApi.ts`
  - 集中首頁相關 API 呼叫，避免 `HomePage.tsx` 直接散落多段 `fetch`。
  - 後續若 API path、headers 或錯誤處理要調整，可以先從這裡找。

- `frontend/src/storage/authStorage.ts`
  - 集中登入 token 與使用者資料的 localStorage 存取。
  - 減少頁面元件直接操作 `cityauncel_token`、`cityauncel_user`。

- `frontend/src/storage/homeDraftStorage.ts`
  - 集中首頁前導草稿存取。
  - 保留 v2 草稿版本檢查，避免舊版正式進度快取覆蓋資料庫資料。

- `backend/src/middleware/auth.js`
  - 從 `app.js` 拆出 `authenticateToken` 與 `requireTeacher`。
  - 讓 `app.js` 稍微減少基礎 middleware 雜訊。

## 尚未大拆的原因

`InquiryData.tsx` 與 `backend/src/app.js` 都還很大，但它們牽涉大量核心流程。後續建議以「每次拆一個功能區」進行，例如先拆水資源、AI 幫幫忙、投票或地圖，而不是一次大重構。

## 後續建議順序

1. 將 `ControlPage.tsx`、`AiInquiryAssistant.tsx`、`BarrageLayer.tsx` 的 `fetch` 也逐步集中到 `frontend/src/api`。
2. 將 `InquiryData.tsx` 的草稿、快照、卡牌、水資源互動拆成 hooks/components。
3. 將大型地圖資料由 `.ts` 改為 `public/data/*.json` 並需要時再載入。
4. 將 `backend/src/app.js` 的教師控制、投票、地圖、AI 幫幫忙 API 拆成 routes/services。
