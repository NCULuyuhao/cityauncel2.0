# UIUX 重新思考與重排｜2026-05-16

## 核心設計方向

這一版不再以「手機優先單欄」作為主要策略，而是改成「桌機橫式設計稿優先、比例縮放優先、必要時才重排」。

也就是說：

1. 桌機橫式畫面是主要視覺基準。
2. 平板、iPad、小筆電寬度下，盡量維持左右排版。
3. 只有低於約 600px 的手機窄螢幕，才真正改成上下排版。
4. 容器不再各自被壓扁、拉長，而是透過全域變數統一縮放間距、圓角、卡片高度、網格比例。
5. 互動區域保留拖曳與橫向滑動，但不阻擋整頁上下捲動。

## 主要修改

### 1. 全域 UIUX 比例系統

在 `frontend/src/index.css` 新增 `UIUX Rethink Pass 2026-05-16`，統一定義：

- `--uiux-canvas-max`
- `--uiux-readable-max`
- `--uiux-edge`
- `--uiux-gap`
- `--uiux-card-radius`
- `--uiux-panel-pad`

用這些變數控制所有主要頁面的外距、卡片圓角、間距與最大寬度。

### 2. 修正過早單欄化問題

上一版在 768px 以下會把大量 grid 強制改成單欄，導致平板或瀏覽器縮窄時太早變成上下排版。

這版改成：

- 600px 以下才強制單欄。
- 601px～900px 仍盡量保留雙欄。
- 701px～1180px 使用平板橫式的比例縮放。

### 3. 首頁重新建立主要排版規則

首頁改成使用：

- `uiux-home-header-grid`
- `uiux-dashboard-grid`
- `uiux-stats-grid`

讓首頁的標題、投票狀態、統計卡、調查書、地圖、稱號收藏有一致比例。

### 4. 探究資料頁重新建立主舞台比例

探究資料的互動式數據探索與卡片彈窗改成使用：

- `uiux-inquiry-stage-grid`
- `uiux-map-chart-stage`
- `uiux-card-grid`
- `uiux-card-modal-grid`
- `uiux-ai-workshop-grid`

主要效果：

- 地圖與數據分析圖盡量維持左右並排。
- 資料卡清單用自動比例欄位，不再在中寬畫面被擠壓變形。
- 數據卡彈窗左側預覽與右側筆記區在平板寬度仍維持左右關係。

### 5. 卡包頁維持桌機視覺比例

卡包列表改成 `uiux-pack-grid`：

- 900px 以上維持三欄。
- 601px～900px 仍盡量維持多欄，不過避免卡包被壓扁。
- 600px 以下才單欄。

### 6. 個人／小組／全班地圖頁延後上下排版

`MiaoliMap.tsx` 原本在 1120px 就切成上下排版，這會讓平板橫式或較窄桌機太早失去左右結構。

這版改成：

- 約 900px 以下才切成上下排版。
- 900px 以上維持左地圖、右資訊欄。

## 驗證

已執行：

```bash
cd frontend
npm run typecheck
npm run build
```

結果：

- TypeScript 檢查通過。
- Vite production build 成功。
- 僅保留原本的大 chunk 警告，並非這次 UIUX 修改造成的錯誤。
