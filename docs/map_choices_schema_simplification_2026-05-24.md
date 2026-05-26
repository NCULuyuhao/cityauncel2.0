# 地圖資料表合併檢查與調整（2026-05-24）

## 調整原因

原本地圖目前狀態分成兩張表：

- `map_user_choices`：學生個人地圖選擇
- `map_overrides`：小組 / 全班最終選擇

重新檢查後，這兩張表本質上都是「某個層級對某個地區的目前選擇」。分表會讓後端在每個流程都要分別查個人、小組、全班，清空資料與分組變更時也要分開處理，邏輯不夠直觀。

## 新設計

改為單一目前狀態表：

```text
map_choices
```

主要欄位：

```text
scope       personal / group / class
owner_id    personal 時為 user_id；group 時為 group_id；class 時固定為 class
user_id     只有 personal 會填，用來關聯 users.id
group_id    只有 group 會填
district_name
choice
created_at
updated_at
```

唯一鍵：

```text
(scope, owner_id, district_name)
```

這樣一位學生、一個小組、或全班對同一地區都只會有一筆目前狀態。

## 保留的歷程表

`map_action_logs` 仍然保留，因為它不是目前狀態，而是操作歷程。

因此現在地圖資料分工是：

```text
map_choices      目前狀態
map_action_logs  操作歷程
```

## 移除的舊表

新版 clean rebuild 不再建立：

```text
map_user_choices
map_overrides
```

`database/cityauncel_database_rebuild_clean.sql` 會明確 DROP 這兩張舊表。

## 已同步修改

- `backend/src/routes/map.routes.js`
- `backend/src/routes/teacher.routes.js`
- `backend/src/app.js`
- `backend/src/services/schemaUtils.js`
- `database/cityauncel_database_rebuild_clean.sql`
- `database/cityauncel_game_system_map_choices.sql`
- `database/README.md`

## 不調整的地方

`suspect_votes` 維持一列一個排序項目，因為角色排序不一定永遠固定三個欄位；用 `rank_position` 保存排序比較適合後續統計。

`ai_helper_records` 與 `ai_helper_record_cards` 維持主表 + card 關聯表，因為一次 AI 互動引用的卡片數量不固定，拆關聯表比固定 card_id_1 / 2 / 3 更合理。
