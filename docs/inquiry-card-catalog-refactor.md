# InquiryData card catalog refactor

本次整理把固定卡牌目錄與初始化邏輯從 `frontend/src/pages/InquiryData.tsx` 拆出，集中到：

- `frontend/src/features/inquiry/cards/cardCatalog.ts`

## 拆出的內容

- `CATEGORY_KEYS`
- `TITLE_REWARD_CATEGORY_KEYS`
- `CARD_IMAGE_FILES_BY_CATEGORY`
- `formatCardFileTitle`
- `createCardsByCategory`
- `createAllCards`
- `ALL_CARD_IMAGE_PRELOAD_CARDS`

## 設計目的

固定卡牌圖片檔名與卡牌初始化屬於資料目錄，不應該混在主要頁面元件裡。拆出後：

1. `InquiryData.tsx` 少承擔靜態資料管理。
2. 後續新增、移除或調整卡牌檔名時，只需要改 `cardCatalog.ts`。
3. 預載卡牌圖片的規則集中管理，避免重複散落在頁面邏輯中。
4. 為後續拆 `useCardDerivedData.ts` 與卡牌狀態 hook 做準備。

## 行為維持

- 水資源仍不使用固定圖片卡，只保留互動快照卡。
- 卡牌 id、localId、title、revealedTitle、imageSrc 生成規則維持不變。
- 預載仍會略過水資源固定卡。

## 後續建議

下一步可繼續拆：

- `useCardDerivedData.ts`：卡牌分類統計、已解鎖卡片整理、目前回合卡片整理。
- `SnapshotCaptureOverlay.tsx`：快照擷取彈窗與圖片輸出流程。
- `inquiryDraftStorage.ts`：探究草稿 localStorage 管理。
