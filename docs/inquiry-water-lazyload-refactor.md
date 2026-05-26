# InquiryData 水資源 UI 與大型地圖資料拆分紀錄

本次整理目標：降低 `InquiryData.tsx` 與前端 JS bundle 的負擔，先拆低風險水資源 UI，並將大型 SVG path 資料從 TypeScript bundle 外移。

## 已完成

1. 新增 `frontend/src/features/inquiry/water/WaterMapPanel.tsx`
   - 將 `InquiryData.tsx` 內「地區降雨量時間地圖 / 河川水質 RPI 位置圖 / 水質監測站位置圖」的左側水資源地圖 UI 抽成獨立元件。
   - 保留原有選取、圖例、區域名稱開關、RPI 河川圖與水質監測站 overlay 行為。

2. 大型地圖資料改為 JSON lazy load
   - 新增：
     - `frontend/public/data/miaoliPreciseWaterMap.json`
     - `frontend/public/data/waterRpiDedicatedMapData.json`
     - `frontend/public/data/waterRpiGisRiverShapes.json`
   - 原本三個大型 TS 檔案改成輕量 loader：
     - `frontend/src/data/miaoliPreciseWaterMap.ts`
     - `frontend/src/data/waterRpiDedicatedMapData.ts`
     - `frontend/src/data/waterRpiGisRiverShapes.ts`
   - 這樣大型 path 資料不再直接打進 JS bundle，而是跟著對應模組載入時從 `public/data` 讀取。

3. 型別與建置檢查
   - `npm run check` 通過。
   - `npm run build:frontend` 通過。

## 成效

- 三個大型地圖 TS 檔從約 2.6MB 原始碼資料，降為輕量 loader。
- build 後主要 JS chunk 大幅下降：
  - `InquiryData` chunk 約 261KB。
  - `index` chunk 約 324KB。
- `InquiryData.tsx` 的水資源地圖 UI 已開始從主檔拆出，後續可以繼續拆右側分析圖、快照 Modal 與水資源 hooks。

## 後續建議

下一步可以繼續拆：

1. `WaterChartPanel.tsx`：拆右側數據分析圖。
2. `WaterSnapshotLiveViews.tsx`：拆 RPI / 水質監測站 live snapshot 預覽。
3. `useWaterInquiryState.ts`：集中水資源選項、播放、圖例、選取狀態。
4. 後端 routes 再逐步拆分，不建議與前端水資源 UI 同一輪大改。
