# 2026-05-14 程式碼安全優化紀錄

本次以 `cityauncel2.0 (2).zip` 為基準，在不改變既有功能流程的前提下，完成以下安全型優化：

## 前端效能

- `HomePage.tsx`
  - 將 `InquiryData`、`CardPackPage`、`BehaviorRecord` 改為 `React.lazy` 動態載入。
  - 新增 `Suspense` 載入畫面，避免首次進入首頁時一次載入所有大型頁面程式碼。
  - 生產建置主 bundle 由約 `3.43 MB` 降為約 `1.32 MB`；大型探究頁拆成獨立 chunk，只有進入探究頁時才載入。

## 草稿儲存穩定性

- `InquiryData.tsx`
  - 新增 `lastSavedDraftJsonRef`，若草稿內容沒有變化，不再重複 `localStorage.setItem`。
  - 保留原本 idle 寫入與 QuotaExceededError fallback 邏輯。
  - 可降低探究頁狀態更新時的同步寫入成本，減少動畫卡頓與 localStorage 壓力。

## 後端傳輸資料瘦身

- `inquiryApi.ts`
  - 修正 `stripLargePayload` 原本只遞迴複製、沒有真正移除大型欄位的問題。
  - 現在會剔除 `photoSnapshotDataUrl`、`canvasDataUrl`、`screenshotDataUrl`。
  - 若 `imageSrc` 是 `data:image/*` base64，也不會跟著調查紀錄送到後端，避免資料庫與 request body 膨脹。
  - 互動式快照卡仍保留必要的 `snapshotMeta`，既有快照還原邏輯不受影響。
  - 移除一處 `any`，改用 `Record<string, unknown>`。

## 驗證結果

已完成：

```bash
npm run check
npm run build:frontend
```

結果：TypeScript 與後端 syntax check 皆通過，前端可成功完成 Vite production build。

備註：Vite 仍提示部分 chunk 超過 500 kB，主要來自探究資料頁與首頁仍含大量地圖/資料常數。這不影響執行，但之後若要再降初始載入量，可繼續把教師中心、地圖頁、資料常數檔做更細的分包。
