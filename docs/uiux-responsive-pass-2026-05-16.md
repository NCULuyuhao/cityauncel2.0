# UIUX Responsive Pass 2 — 2026-05-16

本次修改以不改動核心功能邏輯為前提，針對整體 UIUX、響應式版面、滾動體驗與操作穩定性做第二輪整理。

## 修改重點

### 1. 修正主畫面滾動問題
- 將主要頁面根容器從 `overflow-hidden` 調整為 `overflow-x-hidden`。
- 保留上下滾動，避免桌機滑鼠滾輪、平板拖曳、手機滑動時整頁被鎖住。
- 新增 `.uiux-page-shell` 作為所有主要頁面的穩定外層規格。

### 2. 統一跨裝置版面安全規則
- 手機、小平板、iPad 橫式、桌機都會保留安全邊距。
- 全域限制圖片、SVG、地圖、圖表、表格與長文字不撐爆外層容器。
- 小螢幕自動降低大區塊最小高度，避免內容被硬塞或需要橫向拖曳。

### 3. 降低畫面跳動與卡頓感
- 降低 hover 位移效果，避免使用者滑過按鈕或卡片時畫面一直跳動。
- 行動裝置上降低大型陰影與 blur 成本，讓頁面滑動更穩定。
- 保留必要回饋，但避免過度浮動、彈跳與重繪。

### 4. 改善彈窗與卡片閱讀體驗
- 彈窗在任何裝置都會限制在視窗內，並保留內部滾動。
- 資料卡、證據卡、清單卡與調查書區塊都加入容器保護規則。
- 長文字可自然換行，不會擠出卡片或造成破版。

## 修改檔案
- `frontend/src/index.css`
- `frontend/src/pages/AuthPage.tsx`
- `frontend/src/pages/BehaviorRecord.tsx`
- `frontend/src/pages/CardPackPage.tsx`
- `frontend/src/pages/ControlPage.tsx`
- `frontend/src/pages/HomePage.tsx`
- `frontend/src/pages/InquiryData.tsx`

## 驗證
- `npm run typecheck` 通過。
- `npm run build` 通過。
