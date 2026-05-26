# 教師端學生紀錄資料分析系統重設（2026-05-24）

## 調整目的

這次重設的重點不是替教師判斷「探索是否有效」，而是把學生在系統中留下的資料切成可篩選、可比較、可回查的資料面向。教師可以依照研究或課堂觀察需要，自行解釋篩出的現象。

## 後端 API

主要調整：`backend/src/routes/teacher.routes.js`

`GET /api/teacher/learning-dashboard` 現在會整合下列資料來源：

- `student_activity_logs`：學生頁面、卡片、地圖、卡包、AI 等操作事件。
- `inquiry_records`：調查書主紀錄與結論文字。
- `inquiry_orientation_responses`：任務一前導問題回答。
- `inquiry_record_cards`：調查書引用卡與證據卡。
- `inquiry_collection_notes` / `inquiry_collection_note_cards`：學生蒐集理由 note 與對應卡片。
- `student_unlocked_cards`：學生已解鎖資料卡。
- `data_card_sources`：卡片類型、標題與來源。
- `map_choices` / `map_action_logs`：任務二地圖目前選擇與選擇歷程。
- `suspect_votes`：角色投票排序。
- `decisioncards` / `decisioncard_logs`：小組卡包目前鎖定與歷史紀錄。
- `ai_helper_records` / `ai_helper_unlocks` / `ai_helper_record_cards`：AI 幫幫忙使用、投幣、功能類型與引用卡片。
- `barrages`：彈幕互動。

## 前端頁面

主要調整：`frontend/src/pages/BehaviorRecord.tsx`

新版頁面包含：

1. **總覽**：學生總數、事件量、任務一成果、任務二地圖與各階段資料量。
2. **學生篩選**：學生 × 任務一／任務二／卡包／AI 指標矩陣，可匯出 CSV。
3. **任務一**：前導回答、解鎖卡、證據卡、蒐集理由、調查書成果、資料卡漏斗。
4. **任務二**：地區 × 地圖選擇交叉表、學生地圖選擇與投票欄位。
5. **開啟卡包**：小組目前鎖定卡、歷史鎖定次數、被選卡片排名、卡包理由。
6. **原始紀錄**：所有篩選後事件的可追溯表，可匯出 CSV。
7. **分析方法**：預設的量化統計、質性材料與適合的視覺化建議。

## 有意義的篩選條件

新版提供以下資料分析篩選：

- 階段：全部、任務一、任務二、開啟卡包、AI 幫幫忙、其他互動。
- 小組。
- 單一學生。
- 資料類型：水資源、土地資料、石虎相關資訊、謠言、其他類型。
- 事件類型。
- 資料來源表。
- 學生狀態標籤：已完成調查書、有證據卡、有地圖選擇、有角色投票、小組已鎖定卡包、有使用 AI 等。
- 關鍵字：學生、事件、卡片、地區、文字片段。

## 預設分析方法

新版保留五種自動化資料整理方法：

1. 學生 × 階段指標矩陣。
2. 資料卡使用漏斗。
3. 地區 × 地圖選擇交叉表。
4. 文字資料池。
5. 行為序列與原始紀錄追溯。

這些方法只整理資料，不替教師下結論。

## 驗證結果

已通過：

- `npm --prefix backend run check`
- `npm --prefix frontend run typecheck`

在目前容器中嘗試 `frontend build` 時，原壓縮包內的 `node_modules` 缺少 Linux 版 Vite/Rolldown optional dependency（`@rolldown/binding-linux-x64-gnu`），因此無法在容器完成 Vite build。這是 node_modules 平台相依套件缺失，不是 TypeScript 型別錯誤。建議在實際開發電腦執行：

```bash
cd frontend
npm install
npm run build
```
