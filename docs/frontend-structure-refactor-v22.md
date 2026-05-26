# Frontend structure refactor v22

本次整理目標：在不改動功能路徑與核心流程的前提下，繼續拆前端大型檔案，並移除已明確不再使用的舊資料相容碼。

## 已拆分

### AI 幫幫忙
- `frontend/src/features/inquiry/ai/aiHelperTypes.ts`
- `frontend/src/features/inquiry/ai/aiHelperConfig.ts`
- `frontend/src/features/inquiry/ai/aiHelperUtils.ts`

將型別、選項設定、字數限制、回覆格式化、storage parsing 等從 `AiInquiryAssistant.tsx` 移出。

### Inquiry hooks
- `frontend/src/features/inquiry/hooks/useInquiryDraftAutosave.ts`
- `frontend/src/features/inquiry/hooks/useInquiryTitleSync.ts`
- `frontend/src/features/inquiry/hooks/useStableScrollbarGutter.ts`

將探究草稿自動儲存、稱號同步、頁面捲軸 gutter 控制從 `InquiryData.tsx` 移出。

### Home layout components
- `frontend/src/features/home/HomeHeader.tsx`
- `frontend/src/features/home/TaskOneCard.tsx`
- `frontend/src/features/home/TaskTwoMapPreview.tsx`
- `frontend/src/features/home/TitleCollection.tsx`

先拆頁面外層結構，保留內部行為與渲染邏輯，避免一次拆太深造成首頁互動失效。

### CSS
- `frontend/src/index.css` 現在只負責 import。
- 主要樣式移到 `frontend/src/styles/global.css`。
- 頁面覆寫與修正移到 `frontend/src/styles/page-overrides.css`。

## 已移除舊資料相容碼

- 移除前端 `InquiryIntroStageRecord.mainChoice` 與 `followUp` 舊欄位。
- `getIntroStageDisplay` 改為只讀取新版 `records`。
- 後端 `normalizeOrientationData` 不再把舊版 `mainChoice/followUp` 轉成 records。

這表示系統資料來源統一改以新版 `records` 格式為準。

## 驗證

- `npm run check`
- `npm run build:frontend`

兩者皆通過。
