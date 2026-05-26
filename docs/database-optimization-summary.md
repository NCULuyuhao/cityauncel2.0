# 資料庫與程式碼整理摘要

本次整理目標是不改動既有流程與畫面邏輯，但把資料庫中重複保存的卡牌資料降到最低。

## 核心調整

### 1. `student_unlocked_cards` 改為只保存卡牌識別

原本每位學生每解鎖一張卡，都會在 `card_data` 存入整包 JSON，例如 `id`、`title`、`imageSrc`、`content`、`snapshotMeta` 等。這會導致同一張固定資料卡在不同學生資料列中重複保存。

現在此表只保存：

- `user_id`
- `card_id`
- `unlocked_at`
- `updated_at`

固定資料卡的 title、圖片、分類等，都由前端既有卡牌清單依 `card_id` 還原，不再重複入庫。

### 2. 新增 `data_card_sources`

固定資料卡不用額外存來源，因為 `card_id` 已能對應前端資料來源。

但學生建立的水資源互動快照卡不是固定圖片，仍需要一筆可還原來源的資料，因此新增 `data_card_sources`，每張動態來源卡只存一筆來源資料。

### 3. 活動紀錄自動瘦身

`student_activity_logs` 的寫入增加資料清理：

- 卡牌物件會改存 `{ cardId }`
- 不再重複保存 `title`、`revealedTitle`、`imageSrc`、`content`、`snapshotMeta`
- 證據卡、調查卡陣列改成 `evidenceCardsIds`、`investigationCardsIds` 這類 ID 清單
- 最終摘要紀錄只保留可分析的摘要資訊，不再整包塞入完整調查內容

### 4. 前端相容調整

前端讀取動態快照卡時，如果後端沒有回傳大型 `imageSrc`，會用 `snapshotMeta` 重新生成快照 SVG，避免把大型 data URL 存進資料庫。

## 舊資料庫升級

請先備份資料庫，再執行：

```sql
SOURCE database/migrations/2026_05_13_clean_card_storage.sql;
```

這支 migration 會：

1. 建立 `data_card_sources`
2. 將既有互動快照卡來源從 `student_unlocked_cards.card_data` 搬到 `data_card_sources`
3. 移除 `student_unlocked_cards.card_data`

