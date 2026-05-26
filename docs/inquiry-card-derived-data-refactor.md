# Inquiry card derived data refactor

## 這次拆分

新增 `frontend/src/features/inquiry/cards/useCardDerivedData.ts`，把 `InquiryData.tsx` 中的卡牌衍生資料計算移出去。

目前集中管理：

- `cardById`
- 各分類卡牌清單
- 各分類總數與已解鎖數
- 全部可見卡牌數
- 已解鎖卡牌數
- 本回合已收藏卡牌
- 全部已解鎖且有內容的卡牌
- 已確認證據卡牌
- 目前 activeCard
- 待填寫蒐集理由的卡牌
- 水資源固定舊卡是否應顯示在分類清單中的判斷

## 原則

這次只拆「derived data」，不改卡牌資料來源、不改解鎖流程、不改分類邏輯，也不改 UI。

`InquiryData.tsx` 只需要呼叫 `useCardDerivedData`，不再直接管理這段統計與 Map/Set 整理邏輯。

## 下一步建議

接下來可以繼續拆：

1. `SnapshotCaptureOverlay.tsx`：快照擷取彈窗與確認建立線索流程。
2. `useInquiryDraft.ts`：探究草稿讀寫與 localStorage 防爆量邏輯。
3. `useCollectionReflection.ts`：蒐集理由批次判斷與提示文字。
