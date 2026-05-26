# 小組決策卡資料表簡化調整（2026-05-24）

## 問題

上一版把小組決策卡拆成：

- `decisioncards`
- `decisioncard_cards`
- `decisioncard_logs`
- `decisioncard_log_cards`

這種設計在「卡片數量不固定」時合理，但本系統的小組決策卡規則固定為三張卡。若仍拆出兩張 cards 明細表，前後端每次讀取與寫入都必須多做 JOIN / INSERT / DELETE，造成資料流比功能需求更複雜。

## 調整後設計

保留兩張表：

### `decisioncards`

保存每組目前鎖定的小組決策卡結果。

重要欄位：

- `group_id`
- `selected_card_id_1`
- `selected_card_id_2`
- `selected_card_id_3`
- `locked_by_user_id`
- `lock_reason`
- `locked_at`
- `updated_at`

### `decisioncard_logs`

保存每一次鎖定、重鎖、教師解除鎖定的歷程快照。

重要欄位：

- `group_id`
- `action_type`
- `selected_card_id_1`
- `selected_card_id_2`
- `selected_card_id_3`
- `locked_by_user_id`
- `lock_reason`
- `locked_at`
- `created_at`

## 已移除資料表

- `decisioncard_cards`
- `decisioncard_log_cards`

clean rebuild 與獨立 decisioncard SQL 也會一併 DROP 更早期的舊表名稱：

- `group_card_pack_locks`
- `group_card_pack_lock_logs`
- `group_card_pack_lock_events`

這次已把 DROP 補進：

- `database/cityauncel_database_rebuild_clean.sql`
- `database/cityauncel_game_system_decisioncards.sql`
- `database/cityauncel_game_system_decisioncard_logs.sql`
- `database/migrations/2026_05_24_drop_legacy_decisioncard_child_tables.sql`

也就是說：

- 乾淨重建資料庫時，會先 DROP 舊表再建立新表。
- 只想處理既有資料庫殘留舊表時，可以單獨執行 migration SQL。

## 後端同步修改

- `backend/src/services/decisioncards.js`
  - 改為直接讀寫三個 `selected_card_id_*` 欄位。
  - 保留舊版 `selected_card_ids` JSON 與舊版 child table 的啟動遷移邏輯；若舊表存在，會先搬到三個欄位，再移除舊 child table。
- `backend/src/routes/teacher.routes.js`
  - 教師清空資料表清單移除已刪除的 child table。

## SQL 同步修改

- `database/cityauncel_database_rebuild_clean.sql`
- `database/cityauncel_game_system_decisioncards.sql`
- `database/cityauncel_game_system_decisioncard_logs.sql`

## 設計理由

這不是退回 JSON，而是改成更符合業務規則的正規化程度：

- 不用 JSON。
- 不重複存標題或卡片內容，只存 `card_id`。
- 因固定三張卡，所以直接欄位化。
- 保留目前狀態表與歷程表的區分。
- 減少不必要 JOIN，使前後端流程更穩定。
