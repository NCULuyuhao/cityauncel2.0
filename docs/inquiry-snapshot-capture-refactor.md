# Inquiry snapshot capture refactor

本次拆分將快照擷取時使用的 DOM / canvas 工具從 `InquiryData.tsx` 移到：

- `frontend/src/features/inquiry/snapshots/snapshotCapture.ts`

## 已拆出的責任

- 擷取前建立安全渲染樣式，暫停動畫與濾鏡
- 移除 SVG filter 屬性後再擷取
- 等待 UI frame 穩定
- 使用 `html-to-image` 的 `toCanvas` 擷取指定 DOM
- 將 canvas 壓縮為 WebP data URL
- 舊瀏覽器不支援 WebP 時 fallback 到 JPEG

## 保留在 `InquiryData.tsx` 的責任

- 決定何時開啟擷取流程
- 決定擷取哪個 DOM ref
- 建立快照卡片
- 上傳快照圖片
- 處理擷取失敗時的 UI 狀態

這樣可以讓「擷取工具」和「探究頁面流程」分工更清楚。
