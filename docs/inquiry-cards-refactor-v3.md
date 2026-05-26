# InquiryData 卡片/線索區塊拆分 v3

本次延續水資源拆分後的整理，優先拆低風險但高可讀性的 UI 與呈現設定。

## 已完成

### 1. 卡片收藏面板拆分

新增：

- `frontend/src/features/inquiry/cards/CollectedCardsPanel.tsx`

負責：

- 右下角「數據收藏」浮動面板
- 本回合卡片排序
- 最新解鎖/分類排序按鈕
- 水資源 live snapshot 小圖預覽

### 2. 已收藏卡片預覽彈窗拆分

新增：

- `frontend/src/features/inquiry/cards/CollectedCardPreview.tsx`

負責：

- 點擊已收藏卡片後的完整內容預覽
- 一般圖片卡預覽
- 水資源 live snapshot 卡預覽

### 3. 卡片呈現設定集中

新增：

- `frontend/src/features/inquiry/cards/cardPresentation.tsx`

集中：

- `categoryMetaMap`
- `categoryTabThemeMap`
- `categoryListThemeMap`
- `categoryCardThemeMap`
- `writtenCardStateMap`
- `revealedTitlesByCategory`
- `titleRewardPool`

這些資料原本全部寫在 `InquiryData.tsx`，現在集中到 cards feature 中，後續修改卡片顏色、分類名稱、稱號資料時更容易找到。

## 效果

`InquiryData.tsx` 從上一版約 10635 行降到約 9691 行。

目前 `features/inquiry` 已逐漸形成：

```txt
features/inquiry/
  water/
    WaterMapPanel.tsx
    WaterChartPanel.tsx
    WaterLiveSnapshotViews.tsx
    waterResources.ts
  cards/
    CollectedCardsPanel.tsx
    CollectedCardPreview.tsx
    cardPresentation.tsx
    cardSerialization.ts
```

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```

## 下一步建議

1. 拆 `GameCardGrid` 成 `features/inquiry/cards/GameCardGrid.tsx`
2. 拆卡牌篩選工具成 `cardFilters.ts`
3. 拆調查書/任務流程 UI
4. 最後才拆水資源 state hook，避免一次把狀態與 UI 同時拆開造成行為改變。
