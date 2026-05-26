# CityAuncel 資料庫說明

建議使用 `cityauncel_database_rebuild_clean.sql` 重新建立乾淨資料庫。

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```

## 核心資料表

| 資料表 | 用途 |
| --- | --- |
| `users` | 使用者主表，保存學生/教師帳號、組別、組長身分與目前 coin 數量。 |
| `game_settings` | 教師端 runtime 設定，例如任務開關、學生畫面鎖定、嫌犯投票狀態、最後決策結算。 |
| `data_card_sources` | 動態資料卡來源。固定卡只靠前端 catalog，互動快照卡才需要在此保存來源 payload。 |
| `student_unlocked_cards` | 學生永久解鎖過哪些資料卡。 |
| `student_rewards` | 學生取得的稱號或獎勵 key。 |
| `student_activity_logs` | 學生操作歷程與事件快照。 |
| `barrages` | 學生送出的彈幕內容。 |

## 探究調查書資料表

| 資料表 | 用途 |
| --- | --- |
| `inquiry_records` | 一列代表某位學生的一份調查書。 |
| `inquiry_orientation_responses` | 前導任務回答，一個選項或一段文字一列。 |
| `inquiry_record_cards` | 某份調查書使用過的卡，也用 `is_evidence` 標記最後採用的證據卡。 |
| `inquiry_collection_notes` | 學生針對一批線索卡寫的理由/note。 |
| `inquiry_collection_note_cards` | note 與資料卡的關聯表。 |

## 地圖任務資料表

| 資料表 | 用途 |
| --- | --- |
| `map_choices` | 個人/小組/全班對各地區的目前選擇。 |
| `map_action_logs` | 地圖選擇變更歷程。 |

## 小組決策與投票資料表

| 資料表 | 用途 |
| --- | --- |
| `decisioncards` | 每組目前鎖定的三張決策卡。 |
| `decisioncard_logs` | 小組決策卡鎖定、重鎖、解鎖歷程。 |
| `suspect_votes` | 學生嫌犯排序投票。 |

## AI 幫幫忙資料表

| 資料表 | 用途 |
| --- | --- |
| `ai_helper_unlocks` | 每位學生每回合是否已投幣解鎖 AI 幫幫忙。 |
| `ai_helper_records` | 每次 AI 幫幫忙使用紀錄。 |
| `ai_helper_record_cards` | AI 回合引用/聚焦的資料卡關聯表。 |

## 為什麼目前不再繼續合併

目前資料庫已經把一對一狀態合併到主表，並保留一對多、多對多、歷程表與 runtime 設定表。再繼續合併會讓資料語意混在一起，例如把地圖歷程塞進目前狀態、把 AI 解鎖狀態塞進對話歷程，反而會讓查詢與維護變得不清楚。
