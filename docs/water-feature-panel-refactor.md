# 水資源功能拆分紀錄

本次延續 `InquiryData.tsx` 的拆分，目標是降低單一頁面檔案大小，並讓水資源相關 UI 更容易維護。

## 已拆出的檔案

- `frontend/src/features/inquiry/water/WaterMapPanel.tsx`
  - 水資源左側地圖區。
  - 包含降雨量地圖、RPI 河川圖、水質監測站地圖與圖例。

- `frontend/src/features/inquiry/water/WaterChartPanel.tsx`
  - 水資源右側數據分析圖。
  - 包含資料解讀、時間軸、長條圖、水質監測站清單。

- `frontend/src/features/inquiry/water/WaterLiveSnapshotViews.tsx`
  - RPI 與水質監測站的 live snapshot 預覽與卡片預覽。
  - 避免快照相關 JSX 繼續堆在 `InquiryData.tsx`。

- `frontend/src/features/inquiry/water/waterResources.ts`
  - 水資源資料解析與月份工具。

## 大型資料 lazy load 狀態

上一輪已將大型地圖資料外移到：

- `frontend/public/data/miaoliPreciseWaterMap.json`
- `frontend/public/data/waterRpiDedicatedMapData.json`
- `frontend/public/data/waterRpiGisRiverShapes.json`

原本的 `src/data/*.ts` 改為 loader，避免大型 path 資料直接打進 JS bundle。

## 檢查結果

本輪已通過：

```bash
npm run check
npm run build:frontend
```

## 後續建議

下一步可以繼續拆：

1. `useWaterInquiryState.ts`：把水資源的狀態、memo 與 useEffect 從 `InquiryData.tsx` 拆出去。
2. `SnapshotModal.tsx`：把擷取線索彈窗與快照流程 UI 拆出去。
3. `ClueCardPanel.tsx`：把線索卡列表與卡片預覽拆出去。
