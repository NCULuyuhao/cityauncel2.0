# UIUX 修正：首頁等高地圖、線索卡固定尺寸、前導問題收合順暢

日期：2026-05-16

## 修改重點

### 1. 首頁繪製地圖容器與左側調查書等高

- 將首頁任務一調查書區塊與任務二繪製地圖區塊改為同一列等高延展。
- 右側地圖外框改為 `flex-1`，會跟著左側調查書高度一起延展。
- 地圖 SVG 維持 `preserveAspectRatio="xMidYMid meet"`，不會被拉伸變形，始終位於容器中央。

### 2. 線索擷取後的數據卡固定尺寸

- 調整 `.uiux-card-grid`，資料卡不再使用 `auto-fit + 1fr` 撐滿整列。
- 單張線索卡不會被放很大，多張卡也不會因為數量增加而慢慢縮小。
- 所有類型資料卡維持同一套固定尺寸與比例。

### 3. 前導問題收合動畫更順

- 前導問題主卡片加入 layout transition。
- 補充輸入區塊加入 `AnimatePresence` 與 `motion.div layout`。
- 展開與收合都使用相同節奏的動畫，不再只有展開順、收回時瞬間跳一下。

## 驗證

- `npm run --prefix frontend typecheck` 通過。
- `npm run --prefix frontend build` 通過。
