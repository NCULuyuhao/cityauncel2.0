# Inquiry Snapshot Capture Overlay Refactor

本次整理把 `InquiryData.tsx` 中的快照擷取演出覆蓋層拆到獨立元件：

- `frontend/src/features/inquiry/snapshots/SnapshotCaptureOverlay.tsx`

## 拆分內容

`SnapshotCaptureOverlay` 負責：

- 擷取畫面的全螢幕遮罩
- CAPTURING / CAPTURED 狀態顯示
- 掃描線、四角框、進度條動畫
- 使用實際擷取圖片、water live snapshot view、或 fallback SVG 快照作為預覽

## 保留在 InquiryData.tsx 的邏輯

為降低改壞風險，這次沒有移動核心流程：

- `handleOpenCapture`
- `captureElementAsImageDataUrl`
- `buildSnapshotSvgDataUrl`
- 快照圖片上傳
- 建立互動快照卡
- 快照錯誤處理

## 下一步建議

下一輪可以再拆：

- `snapshotBuilder.ts`：把 `buildSnapshotSvgDataUrl` 和 SVG 建構工具移出主頁面。
- `useSnapshotCapture.ts`：把擷取狀態、timer、錯誤訊息和上傳流程整理成 hook。
- `SnapshotCaptureControls.tsx`：把「擷取線索」按鈕與錯誤提示區拆出。
