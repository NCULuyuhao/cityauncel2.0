# InquiryData card grid refactor

本輪拆分將數據卡清單從 `frontend/src/pages/InquiryData.tsx` 拆出，目標是降低主頁面的 UI 責任，讓卡牌清單、篩選與圖片顯示可以獨立維護。

## 新增檔案

- `frontend/src/features/inquiry/cards/GameCardGrid.tsx`
  - 負責數據卡 grid、翻牌畫面、待解鎖/已解鎖卡面、分類切換淡入。
- `frontend/src/features/inquiry/cards/cardFilters.ts`
  - 負責土地、石虎、傳言、其他分類的地區與問題面向篩選。
- `frontend/src/features/inquiry/cards/ProgressiveCardImage.tsx`
  - 負責卡牌圖片的 lazy/eager loading 呈現。

## 調整重點

- `InquiryData.tsx` 不再直接承擔卡牌 grid 的 JSX。
- 卡牌篩選邏輯不再混在主頁面裡。
- 保留原本翻牌動畫、快照預覽、水資源 live snapshot 卡片顯示邏輯。
- 保留原本預載圖片流程，不改學生操作行為。

## 後續建議

下一輪可以繼續拆：

1. `cardCatalog.ts`：固定卡牌檔名、初始卡牌建立。
2. `useCardDerivedData.ts`：卡牌統計、分類分組、已解鎖卡片整理。
3. `SnapshotCaptureOverlay.tsx`：快照擷取彈窗與圖片輸出流程。
