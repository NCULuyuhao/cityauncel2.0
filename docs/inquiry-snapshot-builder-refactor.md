# Inquiry snapshotBuilder 拆分紀錄

本次將互動數據快照的 SVG 建構邏輯從 `frontend/src/pages/InquiryData.tsx` 拆到：

- `frontend/src/features/inquiry/snapshots/snapshotBuilder.ts`

## 拆出的內容

- `buildSnapshotSvgDataUrl`
- `buildWaterRpiLiveSnapshotSvgDataUrl`
- SVG 文字 escape / wrap 工具
- 快照分類色彩 theme
- 快照圖表統計工具
- RPI 數值格式化與分級顏色
- 降雨量圖例與分級顏色
- 快照用 chart bar 顏色工具

## 保留在 InquiryData.tsx 的內容

快照的實際擷取流程仍保留在 `InquiryData.tsx`，包含：

- 開啟擷取線索
- html-to-image / canvas 擷取
- 快照圖片上傳
- 建立互動快照卡
- 錯誤處理與 UI 狀態

這樣可以先把純 SVG 建構邏輯抽離，同時避免改動資料儲存與擷取流程。

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```
