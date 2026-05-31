# database

這裡保存 CityAuncel 石虎探究系統的 MySQL schema。資料表採用「主表、關聯表、歷程表」分離，讓前端功能正常運作，也讓教師端之後能做清楚的學習歷程分析。

## 主要重建入口

目前 zip 內的主要重建腳本是：

```sql
SOURCE database/cityauncel_database_rebuild_preserve_users_settings.sql;
```

這個版本會重建主要任務與分析資料表，同時保留 users / game settings 相關資料。若要完全清空資料，請先備份正式資料，再依需求調整 SQL。

## 分表 SQL

`cityauncel_game_system_*.sql` 是各資料表的拆分檔，方便單獨檢查欄位、索引與外鍵。修改 schema 時建議同步更新：

1. 主重建腳本。
2. 對應分表 SQL。
3. 後端 `routes/` / `services/` 中使用的欄位名稱。
4. 教師端分析查詢與視覺化資料整理。

## 資料表分類

| 類別 | 主要資料表 | 用途 |
|---|---|---|
| 使用者與遊戲狀態 | `users`、`game_settings` | 登入、組別、教師控制、全班流程狀態 |
| 任務一探究 | `inquiry_records`、`inquiry_orientation_responses`、`inquiry_record_cards` | 前導問題、調查書、證據卡 |
| 蒐集理由 | `inquiry_collection_notes`、`inquiry_collection_note_cards` | 學生為什麼蒐集某批資料卡 |
| 資料卡與獎勵 | `data_card_sources`、`student_unlocked_cards`、`student_rewards` | 已解鎖卡、卡片來源、稱號 |
| AI 幫幫忙 | `ai_helper_unlocks`、`ai_helper_records`、`ai_helper_record_cards` | AI 使用次數、對話紀錄、引用卡片 |
| 地圖任務 | `map_choices`、`map_action_logs`、`map_locks` | 個人/小組/全班地圖、鎖定狀態、操作歷程 |
| 角色卡包 | `decisioncards`、`decisioncard_logs`、`decisioncard_votes`、`decisioncard_vote_records`、`decisioncard_round_results`、`decisioncard_group_scores`、`decisioncard_accepted_cards`、`decisioncard_round_state` | 選牌、投票、回合結算、通過牌與分數 |
| 其他互動 | `student_activity_logs`、`barrages`、`suspect_votes` | 行為紀錄、彈幕、嫌疑角色投票 |

## 設計原則

- **主表保存一次任務或一次提交**，例如一份調查書、一個卡包鎖定紀錄。
- **關聯表保存多對多關係**，例如一份調查書引用多張證據卡。
- **歷程表保存事件時間與 actor**，不要只保存目前狀態，否則教師端無法回看學生過程。
- **少存重複大型 JSON**，若前端需要完整畫面，可由後端查詢多張表後組合回傳。
- **欄位命名盡量直觀一致**，例如 `type`、`category`、`region`、`card_id` 不要在不同表任意改名。
