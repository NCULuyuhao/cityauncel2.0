# 首頁任務二地圖單頁輪播修正（2026-05-16）

## 修改目標

首頁「任務二：繪製地圖」不再同時呈現三張地圖，而是改成一頁只顯示一張地圖：

1. 我的石虎地圖
2. 小組地圖
3. 全班共識彙整結果

下方進度條同時顯示三個頁籤，點擊或左右拖曳可切換目前顯示的地圖。

## 修改內容

- 修改 `frontend/src/pages/HomePage.tsx`
- 將原本三張地圖以 flex 軌道排列再位移的設計，改為只渲染目前頁面的地圖。
- 新增 `safeMapPreviewPageIndex` 與 `currentMapPreviewPage`，確保目前頁面永遠落在合法範圍內。
- 下方控制列改為三段式進度條：
  - `1. 我的石虎地圖`
  - `2. 小組地圖`
  - `3. 全班共識彙整結果`
- 保留左右拖曳切換。
- 保留地圖圖例、頁面標題與任務開關遮罩。

## 驗證

- `npm run --prefix frontend typecheck` 通過
- `npm run --prefix frontend build` 通過
