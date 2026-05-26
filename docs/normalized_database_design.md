# 石虎探究系統資料庫正規化設計說明

本次重構目標是把原本塞在 `inquiry_records.orientation`、`inquiry_records.investigation`、`inquiry_records.conclusion` 的大包 JSON 拆成可查詢、可閱讀、可分析的資料表。前端 API 路徑維持原本設計，後端負責把正規化資料重新組成前端需要的格式，因此不需要把前端每個頁面重新改成直接理解資料表。

## 核心設計原則

1. **主表只放主體資料**：`inquiry_records` 只代表「某學生第幾份調查書」與時間、最終文字，不保存前導回答或卡片清單 JSON。
2. **卡片只存 card_id**：固定資料卡本身由前端靜態資料識別；學生快照卡的來源資料只放在 `data_card_sources` 一次，其它表只引用 `card_id`。
3. **note 文字只存一次**：學生針對一批線索卡寫的理由放在 `inquiry_collection_notes`，透過 `inquiry_collection_note_cards` 關聯到多張卡，避免每張卡複製同一段文字。
4. **前端路徑穩定**：`/api/inquiries`、`/api/inquiries/plans`、`/api/inquiries/investigations`、`/api/inquiries/final-summaries` 等路徑維持不變，只替換後端資料存取邏輯。

## 正規化後的探究資料表

| 資料表 | 用途 | 主要欄位 |
| --- | --- | --- |
| `inquiry_records` | 調查書主表，一列代表一位學生的一份調查書 | `user_id`, `record_order`, `started_at`, `ended_at`, `conclusion_text` |
| `inquiry_orientation_responses` | 前導任務回答，一個選項或一段文字一列 | `inquiry_record_id`, `response_order`, `response_type`, `answer_order`, `answer_text` |
| `inquiry_record_cards` | 該調查書回合解鎖/使用過的資料卡，並直接標記最後採用的證據卡 | `inquiry_record_id`, `card_id`, `card_order`, `unlocked_at`, `is_evidence`, `evidence_order` |
| `inquiry_collection_notes` | 學生撰寫的蒐集理由 / note | `inquiry_record_id`, `note_key`, `note_text`, `created_at` |
| `inquiry_collection_note_cards` | note 與資料卡的多對多關聯 | `note_id`, `card_id`, `card_order` |

## 重要 API 與資料表對應

| API | 寫入 / 讀取重點 |
| --- | --- |
| `GET /api/inquiries` | 從正規化表組回 `inquiryPlans`、`finalSummaries`、`unlockedCards`、`inquiryUnlockedCardsByOrder` |
| `POST /api/inquiries/records` | 建立 `inquiry_records` 主表列 |
| `POST /api/inquiries/plans` | 寫入 `inquiry_records` + `inquiry_orientation_responses` |
| `PUT /api/inquiries/plans` | 同步目前所有前導回答到正規化表 |
| `POST /api/inquiries/investigations` | 寫入 `inquiry_record_cards`、`inquiry_collection_notes`、`inquiry_collection_note_cards` |
| `POST /api/inquiries/final-summaries` | 更新 `inquiry_record_cards.is_evidence/evidence_order` 與 `inquiry_records.conclusion_text` |
| `GET /api/teacher/learning-dashboard` | 改由 `inquiry_record_cards.is_evidence` 與 `conclusion_text` 產生統計，不再解析 JSON |

## 重新建置建議

若可以清空舊資料，建議直接執行：

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```

如果是沿用舊資料庫啟動，後端會用 `ensureInquiryNormalizedTables()` 建立缺少的新表與欄位，但舊 JSON 欄位內容不會自動完整搬移。這次需求是重新設計乾淨資料庫，因此以 clean rebuild 為主要使用方式。

## 2026-05-24 第二輪正規化補充

除了探究調查書，本版也把其他適合關聯化的資料表一起調整：

- `decisioncards.selected_card_ids` 改為 `selected_card_id_1`、`selected_card_id_2`、`selected_card_id_3`。
- `decisioncard_logs.selected_card_ids` 也改為三個固定卡片欄位，保留歷程但不再額外拆明細表。
- `ai_helper_records.card_refs_json` 拆為 `ai_helper_record_cards`。
- `ai_helper_records.context_summary_json` 改為 `page_key`、`page_label`、`focus_label`、`focus_text`、`collection_reflection_text`、`active_cards_count` 等可查詢欄位。
- `student_rewards.reward_data` 移除，只保存 `reward_key`，稱號文字由程式內稱號表還原。

保留 `student_activity_logs.metadata`、`game_settings.setting_value`、`data_card_sources.source_payload`，因為它們分別是事件快照、runtime key-value 設定、不同型態資料卡來源 payload；硬拆反而會造成過度正規化與維護成本。


## 2026-05-24 第三輪正規化補充

本輪重新檢查後，將 `inquiry_evidence_cards` 合併回 `inquiry_record_cards`。原因是最後證據卡不是獨立實體，而是同一份調查書已使用資料卡中的子集合；若拆成兩張表，會讓 `(inquiry_record_id, card_id)` 在兩處重複保存。新版用 `is_evidence`、`evidence_order`、`evidence_selected_at` 直接標記在 `inquiry_record_cards` 上，資料表數量更少，查詢某份調查書使用哪些卡、哪些卡被採為證據也更直觀。

## 2026-05-24 第四輪正規化補充

本輪重新檢查後，將一對一的 `student_coin_balances` 合併進 `users.barrage_coins`。原因是 coin balance 並不是多筆紀錄，也不是歷程資料；每位學生只有一個目前 coin 數量。保留獨立表會讓彈幕、AI 幫幫忙、調查書獎勵流程都多一次 `INSERT IGNORE`、`LEFT JOIN` 或額外查詢。

合併後仍符合正規化：`barrage_coins` 完全依賴 `users.id`，沒有重複保存，也沒有把一對多資料硬塞進主表。相對地，`student_rewards`、`student_unlocked_cards`、`student_activity_logs` 仍保留為獨立表，因為它們是多筆狀態或事件歷程。

## 2026-05-24 最終檢查補充

本輪重新檢查最新程式碼後，沒有再對核心資料表做結構合併或拆分。理由是目前設計已經把一對一狀態、一對多狀態、多對多關聯、目前狀態與歷程表分開處理；再繼續合併會讓資料語意混雜，例如把 AI 解鎖狀態混進 AI 對話歷程，或把地圖歷程混進地圖目前狀態。

本輪只做非結構性的資料庫一致性修正：新增 `database/cityauncel_database_rebuild_clean.sql` 作為乾淨重建入口，並統一 `game_settings` 中學生畫面鎖定的 key 為 `student_screen_lock`。後端 `/api/student-screen-lock` 也改為同時接受與回傳 `locked`、`isLocked`，避免前後端命名差異造成狀態切換看起來沒反應。
