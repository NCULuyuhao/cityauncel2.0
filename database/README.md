# database

這裡保存 CityAuncel 石虎探究系統的 MySQL schema。建議以 `cityauncel_database_rebuild_clean.sql` 作為重新建立資料庫的主要入口，其餘 `cityauncel_game_system_*.sql` 是依資料表拆分的版本，方便檢查欄位。

## 建議重建方式

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```

## 資料表設計概念

系統資料大致分為五類：

1. **使用者與任務狀態**：`users`、`game_settings`。
2. **學生探究歷程**：`inquiry_records`、`inquiry_orientation_responses`、`inquiry_record_cards`、`inquiry_collection_notes`、`inquiry_collection_note_cards`。
3. **資料卡與學生解鎖狀態**：`data_card_sources`、`student_unlocked_cards`、`student_rewards`。
4. **地圖、小組決策與投票**：`map_choices`、`map_action_logs`、`decisioncards`、`decisioncard_logs`、`suspect_votes`。
5. **AI 與行為分析**：`ai_helper_unlocks`、`ai_helper_records`、`ai_helper_record_cards`、`student_activity_logs`、`barrages`。

## 維護注意

- 修改 schema 後要同步檢查後端 routes/services 是否使用相同欄位名稱。
- 歷程表不要只保存目前狀態，應保留事件時間與 actor，方便教師端回看學生探究過程。
- 關聯表用來描述多對多關係，例如一份調查書使用多張卡、一段理由引用多張卡。
