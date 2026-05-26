# 前導問題 UIUX 置中與流暢展開調整（2026-05-16）

## 修改目標

本次以 `cityauncel_4.0_ai.zip` 為最新基準，針對探究前導問題流程進行 UIUX 修正。

重點是讓前導問題在各裝置上都保持視覺中心，不因為選項展開、輸入框出現或內容高度增加而讓畫面突然跳動。

## 調整內容

### 1. 前導問題畫面置中

修改 `frontend/src/pages/InquiryData.tsx`：

- `InquiryPurposePage`
- `InquiryFollowUpPage`
- `flowStage === "ready"` 的準備頁

以上三個前導流程都改用：

- `inquiry-intro-shell`
- `inquiry-intro-card`
- `items-center justify-center`

讓所有主要內容位於畫面中央。

### 2. 容器高度變化改為流暢過渡

前導問題主要卡片改為 `motion.div layout`，讓 Framer Motion 自動處理內容高度變化。

當使用者點選「有」、「其他」、「懷疑對象」等會展開輸入區或提示區的選項時，外層卡片不再瞬間變高，而是用 layout transition 平滑調整。

### 3. 選項按鈕視覺更穩定

選項按鈕加入 `inquiry-intro-choice-button`：

- 文字置中
- 最小高度統一
- 選取狀態、陰影、邊框、間距都使用 transition
- 避免按鈕被選取後突然改變尺寸

### 4. 展開區塊加入進場效果

在 `frontend/src/index.css` 新增：

- `.inquiry-intro-shell`
- `.inquiry-intro-card`
- `.inquiry-intro-choice-button`
- `@keyframes inquiry-intro-panel-in`

讓文字輸入區、目前選擇摘要、補充說明區出現時有淡入與輕微下移效果。

### 5. 小高度裝置保護

若裝置高度太低，例如橫式手機或很矮的瀏覽器視窗，前導頁會改為靠上排列，避免中央置中導致上方內容被擠出畫面。

## 驗證結果

已執行：

```bash
npm run --prefix frontend typecheck
```

結果：通過。

已重新安裝前端依賴後執行：

```bash
cd frontend
npm install
npm run build
```

結果：通過。

備註：一開始 build 失敗是因為壓縮檔內的 `node_modules` 缺少 Vite/Rolldown 的 Linux optional native dependency。重新 `npm install` 後即可正常建置，與本次程式修改無關。
