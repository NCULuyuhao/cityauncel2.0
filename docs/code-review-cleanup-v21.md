# v21 工程師審查與清理紀錄

## 已安全移除的殘留碼

- 移除 `backend/src/ai/aiSystemKnowledge.js`：目前後端 `ai.routes.js` 已經內建 AI helper system knowledge，這個舊檔沒有被任何程式引用。
- 移除 `snapshotBuilder.ts` 裡保留的舊版 `buildWaterRpiLiveSnapshotSvgDataUrl` 備援函式，以及其專用的 RPI 專用地圖資料 import。正式快照流程已統一走 `buildSnapshotSvgDataUrl`。

## 已整理的維護性問題

- 新增 `frontend/src/storage/controlPageStorage.ts`，將教師分組草稿與清空瀏覽器暫存的 localStorage/sessionStorage 操作集中管理。
- `ControlPage.tsx` 不再直接操作教師分組 localStorage。
- 專案名稱從舊的 `cityauncel2.0` / `my-card-game` 更新為 `cityauncel4` / `cityauncel4-frontend` / `cityauncel4-backend`，避免版本名稱混亂。

## 驗證

- `npm run check` 通過。
- `npm run build:frontend` 通過。

## 後續建議

1. 拆 `AiInquiryAssistant.tsx`：先拆 config/types/API/session hook/message UI。
2. 拆 `InquiryData.tsx` 的草稿同步、稱號同步與調查書提交流程 hook。
3. 拆 `HomePage.tsx` 成 `HomeHeader`、`TaskOneCard`、`TaskTwoMapPreview`、`TitleCollection`。
4. 拆 `index.css` 或至少依頁面分區，避免 RWD 補丁互相覆蓋。
5. 確認正式資料庫不需要讀舊格式後，再刪除舊資料相容碼。
