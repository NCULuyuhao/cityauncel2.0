# 2026-05-24 資料庫最終檢查與調整紀錄

## 檢查結論

本輪以 `cityauncel3.0.zip` 的最新程式碼為基準，重新檢查資料表設計、後端 SQL 存取、前端 API 型別與資料庫匯入檔。檢查後判斷：目前 20 張核心資料表的拆分已經接近最合理狀態，沒有再建議把主要業務資料表合併或拆分。

原因是目前資料表已經形成清楚的分工：

- 一對一狀態已合併到主表，例如 `users.barrage_coins`。
- 一對多狀態保留獨立表，例如 `student_unlocked_cards`、`student_rewards`。
- 多對多關係保留關聯表，例如 `inquiry_collection_note_cards`、`ai_helper_record_cards`。
- 目前狀態與歷程紀錄分開，例如 `map_choices` / `map_action_logs`、`decisioncards` / `decisioncard_logs`。
- 不同形狀的 runtime 設定與事件快照保留 JSON，例如 `game_settings.setting_value`、`student_activity_logs.metadata`、`data_card_sources.source_payload`。

## 本輪沒有再合併的表

### `student_unlocked_cards`

不建議合併到 `users` 或 `inquiry_record_cards`。它代表學生永久解鎖過哪些資料卡，是學生層級的目前狀態；`inquiry_record_cards` 則是某份調查書本回合使用過的卡，兩者語意不同。

### `student_rewards`

不建議合併到 `users`。一位學生可以有多個稱號，且每個稱號有取得時間，因此是典型的一對多資料。

### `map_action_logs`

不建議合併到 `map_choices` 或 `student_activity_logs`。`map_choices` 是目前狀態；`map_action_logs` 是地圖任務的結構化歷程，可直接查某地區、某小組、某學生的選擇變化。

### `decisioncard_logs`

不建議合併到 `decisioncards`。`decisioncards` 只保存每組目前鎖定的三張卡；`decisioncard_logs` 保存每次鎖定、重鎖、教師解鎖的歷程。

### `ai_helper_unlocks`

不建議合併到 `ai_helper_records`。`ai_helper_unlocks` 是每位學生每回合是否已投幣解鎖的狀態；`ai_helper_records` 是每一次 AI 對話或檢查的歷程。若只靠歷程表判斷是否解鎖，查詢會變得比較不直覺，也容易受事件類型影響。

### `ai_helper_record_cards`

不建議合併到 `ai_helper_records`。一次 AI 互動可能引用 0 到多張卡，卡片數量不固定，使用關聯表比 `card_id_1`、`card_id_2` 更合理。

### `inquiry_collection_note_cards`

不建議合併到 `inquiry_collection_notes` 或 `inquiry_record_cards`。一段 note 可以對應多張卡，保留關聯表可以避免同一段理由文字被複製多次。

### `game_settings`

不建議改成一張固定欄位的大表。教師控制狀態有些是簡單布林值，有些是完整結算結果，例如 `final_decision_settlement`，使用 key-value 設定表比建立很多只用一次的欄位更清楚。

## 本輪實際修正

本輪沒有改變資料表結構，但修正了兩個與資料庫設定一致性有關的問題：

1. 新增 `database/cityauncel_database_rebuild_clean.sql`，讓乾淨重建可以直接執行一份 SQL，不必逐張表匯入 Workbench dump。
2. 統一學生畫面鎖定設定 key：使用 `student_screen_lock`，不再預設產生未使用的 `student_screen_lock_status` / `class_screen_lock_status`。
3. `/api/student-screen-lock` 同時支援與回傳 `locked`、`isLocked`，避免前後端命名不同造成教師端切換後畫面沒反應。

## 建議使用方式

乾淨重建資料庫時建議執行：

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```

若只匯入單張表 SQL，請注意外鍵順序；因此仍建議優先使用 clean rebuild 檔。
