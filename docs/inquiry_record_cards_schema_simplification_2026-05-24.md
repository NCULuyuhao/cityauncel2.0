# 調查書證據卡資料表簡化紀錄（2026-05-24）

## 調整原因

重新檢查後，`inquiry_evidence_cards` 與 `inquiry_record_cards` 存的是同一個實體：某一份調查書中的某一張資料卡。差異只在於「這張卡最後是否被採用為證據」。

若拆成兩張表，會出現以下問題：

1. 同一張卡在同一份調查書中重複以 `(inquiry_record_id, card_id)` 存在兩處。
2. 教師端統計必須同時 JOIN 使用卡表與證據卡表，查詢較繞。
3. 後端同步 investigation 與 final summary 時，需要維護兩張表的一致性。

因此本輪改為一張表保存：

- 該份調查書使用過哪些卡。
- 哪些卡最後被標記為證據。
- 證據卡排序。

## 新欄位

`inquiry_record_cards` 新增：

| 欄位 | 用途 |
| --- | --- |
| `is_evidence` | 是否為最後調查書採用的證據卡。 |
| `evidence_order` | 證據卡排序。 |
| `evidence_selected_at` | 被標記為證據的時間。 |

## 移除資料表

新版 clean schema 不再建立：

- `inquiry_evidence_cards`

舊資料庫若已存在這張表，會透過以下方式處理：

- `database/cityauncel_database_rebuild_clean.sql`：重建時直接 DROP。
- `database/migrations/2026_05_24_merge_inquiry_evidence_into_record_cards.sql`：就地升級時先搬移資料，再 DROP。
- `backend/src/services/schemaUtils.js`：後端啟動時若偵測到舊表，也會把資料搬到 `inquiry_record_cards` 後移除舊表。

## 後端同步修正

已更新：

- `backend/src/routes/inquiry.routes.js`
  - final summaries 改為更新 `inquiry_record_cards.is_evidence/evidence_order`。
  - investigations 單獨同步時會保留既有證據標記，避免送出調查書後再次同步卡片造成證據狀態遺失。
- `backend/src/routes/teacher.routes.js`
  - learning dashboard 改從 `inquiry_record_cards WHERE is_evidence = 1` 讀取證據卡。
- `backend/src/services/schemaUtils.js`
  - 建立新欄位。
  - 搬移並移除舊 `inquiry_evidence_cards`。

## 為什麼這仍符合正規化

正規化重點不是拆最多表，而是避免同一件事在多處重複保存。現在一列 `(inquiry_record_id, card_id)` 就完整描述該調查書中的某一張卡；證據狀態只是這列資料的屬性，因此放在同一張表比獨立一張表更清楚。
