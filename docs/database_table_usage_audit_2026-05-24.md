# 資料表使用檢查紀錄（2026-05-24）

## 檢查目的

確認第二輪正規化後的資料庫是否仍包含已經不需要的資料表；若有，移除資料表並同步調整前後端；若沒有，補上資料表用途說明。

## 檢查方式

1. 掃描 `database/cityauncel_database_rebuild_clean.sql` 中的所有 `CREATE TABLE`。
2. 全專案搜尋每張資料表是否被後端 routes、services、教師端統計或前端 API 使用。
3. 比對資料表是否屬於目前狀態表、關聯表、歷程表或設定表。
4. 對看似重複的 log 表確認是否保存歷史快照；若是歷程用途，保留。

## 檢查結論

原先 25 張資料表中，`decisioncard_cards` 與 `decisioncard_log_cards` 經重新評估後屬於過度拆分，已移除；本輪又將舊表 `map_user_choices` 與 `map_overrides` 合併為 `map_choices`，當時 clean schema 保留 21 張資料表；後續已再合併 `student_coin_balances`，目前為 20 張資料表。

已補上：

- `database/README.md`：每張資料表用途、設計理由與主要關聯。

## 未移除但需說明的表

以下資料表雖然與其他主表有欄位重疊，但用途是保存歷程或事件快照，因此不應刪除：

- `student_activity_logs`
- `map_action_logs`
- `decisioncard_logs`
- `ai_helper_records`
- `ai_helper_record_cards`

這些表不是目前狀態資料，而是分析、追蹤與除錯用的歷程資料。


## 2026-05-24 補充修正：小組決策卡不再過度拆分

重新檢查前後端後，確認小組決策卡每次固定選三張卡，因此 `decisioncard_cards` 與 `decisioncard_log_cards` 會讓資料表與程式存取過度複雜。已改為：

- `decisioncards.selected_card_id_1 / 2 / 3` 保存目前鎖定的三張卡。
- `decisioncard_logs.selected_card_id_1 / 2 / 3` 保存每次鎖定或解鎖時的三張卡快照。

這樣仍然可以查詢與分析，又不需要額外 JOIN 明細表。


## 2026-05-24 補充修正：`inquiry_evidence_cards` 合併回 `inquiry_record_cards`

重新檢查後，`inquiry_evidence_cards` 被判定為可以合併的表。證據卡是同一份調查書卡片集合中的子集合，不需要另建一張表重複保存 `inquiry_record_id + card_id`。

已改為：

- `inquiry_record_cards.is_evidence`
- `inquiry_record_cards.evidence_order`
- `inquiry_record_cards.evidence_selected_at`

後端 `/api/inquiries/final-summaries` 與教師端 learning dashboard 已同步改為讀寫 `inquiry_record_cards`。

## 2026-05-24 補充修正：`student_coin_balances` 合併進 `users`

再次檢查後，`student_coin_balances` 被判定為一對一過度拆分。這張表只保存 `user_id` 與 `barrage_coins`，沒有多幣別、多歷程或多筆狀態，因此不需要另建 child table。

已改為：

- `users.barrage_coins` 保存學生目前可用 coin。
- 彈幕、AI 幫幫忙、完成調查書獎勵 coin 都直接讀寫 `users.barrage_coins`。
- 教師端清空資料時會重設學生 `users.barrage_coins = 0`。
- clean schema 仍會 `DROP TABLE IF EXISTS student_coin_balances`，避免舊表殘留。

目前 clean schema 保留 20 張資料表。
