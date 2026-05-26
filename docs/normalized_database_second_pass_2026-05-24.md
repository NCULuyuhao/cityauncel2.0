# 第二輪資料庫正規化調整（2026-05-24）

本輪不是把所有 JSON 都拆掉，而是只針對「可被關聯查詢、且原本會造成重複或難以分析」的資料做正規化。

## 本輪調整的資料表

### 1. 小組決策卡

原本：

- `decisioncards.selected_card_ids` 用 JSON 陣列保存三張卡。
- `decisioncard_logs.selected_card_ids` 也用 JSON 陣列保存每次操作的三張卡。

第一版曾拆成 `decisioncard_cards` 與 `decisioncard_log_cards`，但後續檢查發現小組決策卡規則固定為「三張卡」，不是任意數量清單，因此拆成四張表會讓前後端存取邏輯變得過度複雜。

最終調整後：

- `decisioncards`：保存每組目前鎖定狀態，並直接存 `selected_card_id_1`、`selected_card_id_2`、`selected_card_id_3`。
- `decisioncard_logs`：保存鎖定、重鎖、教師解鎖等歷程，也直接保存該次操作當下的三張卡。
- 移除 `decisioncard_cards` 與 `decisioncard_log_cards`，避免過度拆表。

查詢某一組目前鎖定卡片時，可以用：

```sql
SELECT group_id, locked_by_user_id, lock_reason,
       selected_card_id_1, selected_card_id_2, selected_card_id_3
FROM decisioncards
WHERE group_id = ?;
```

查詢曾經選過某張卡的小組，可以用：

```sql
SELECT group_id, locked_by_user_id, locked_at
FROM decisioncards
WHERE selected_card_id_1 = ?
   OR selected_card_id_2 = ?
   OR selected_card_id_3 = ?;
```

### 2. AI 幫幫忙使用紀錄

原本：

- `ai_helper_records.username`、`group_id` 與 `users` 重複。
- `card_refs_json` 用 JSON 保存引用卡片。
- `context_summary_json` 用 JSON 保存可以拆成欄位的摘要。

調整後：

- `ai_helper_records`：只保存 AI 互動主紀錄、學生文字、AI 回覆、需求類型、頁面/焦點摘要等可查詢欄位。
- `ai_helper_record_cards`：保存該次 AI 互動引用或聚焦的資料卡。

查詢某位學生的 AI 幫幫忙歷程時，可以用：

```sql
SELECT r.id, r.user_id, r.round_key, r.need_type, r.action_type,
       r.request_text, r.response_text, c.card_id
FROM ai_helper_records r
LEFT JOIN ai_helper_record_cards c ON c.ai_helper_record_id = r.id
WHERE r.user_id = ?
ORDER BY r.created_at, r.id, c.card_order;
```

### 3. 學生稱號獎勵

原本：

- `student_rewards.reward_key` 已經能識別稱號。
- 但同時又保存 `reward_data` JSON，重複存稱號名稱與描述。

調整後：

- `student_rewards` 只保存 `user_id`、`reward_type`、`reward_key`、`earned_at`。
- 稱號名稱與描述由後端的稱號定義表依 `reward_key` 還原，不再重複寫進資料庫。

## 保留不拆的資料

### `student_activity_logs.previous_value / new_value / metadata`

這是行為事件稽核紀錄，不是主要關聯資料。它保存的是「事件發生當下的快照」，不是目前狀態。因此保留文字化 JSON，比硬拆成大量事件子表更合理。

### `game_settings.setting_value`

這是教師端即時控制狀態，屬於 key-value runtime setting。資料量小、型別會依設定不同而改變，保留 JSON 字串比拆表更簡潔。

### `data_card_sources.source_payload`

這是資料卡來源註冊表，固定圖卡、互動快照、水資源卡的 payload 型態不同。它不是學生行為資料，保留 JSON 可避免為不同卡種建立過度細碎的表。

## 後端已同步調整

- `backend/src/services/decisioncards.js`
- `backend/src/routes/groupCardPack.routes.js`
- `backend/src/routes/teacher.routes.js`
- `backend/src/routes/voting.routes.js`
- `backend/src/routes/ai.routes.js`
- `backend/src/routes/inquiry.routes.js`
- `backend/src/app.js`

## 驗證紀錄

已通過：

```bash
npm run check --prefix backend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
DB_HOST=localhost DB_USER=root DB_NAME=cityauncel_game_system JWT_SECRET=test PORT=3211 node backend/src/server.js
curl http://localhost:3211/
```

備註：sandbox 沒有你的 MySQL 實體資料庫，因此這裡沒有實際匯入 `database/cityauncel_database_rebuild_clean.sql`。本版以乾淨重建資料庫為前提。
