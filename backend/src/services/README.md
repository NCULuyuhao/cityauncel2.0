# backend/src/services

這裡放後端可重用的業務邏輯與資料庫操作。routes 負責 HTTP；services 負責真正的查詢、轉換、補 schema、統計與回合規則。

## 服務責任

- `activityLog.js`：學生行為紀錄與短時間重複事件過濾。
- `aiHelperService.js`：AI provider 設定、prompt scaffolding、fallback 回覆、AI 使用紀錄。
- `decisioncards.js`：角色卡包選牌、投票、通過牌、分數與回合狀態。
- `gameSettings.js`：遊戲流程開關與全班狀態。
- `inquiryData.js`：任務一資料正規化、調查書、證據卡、理由與稱號。
- `mapDecisionService.js`：地圖選項統計、平手判斷、有效決策過濾。
- `realtime.js`：SSE client 管理與事件廣播。
- `schemaUtils.js`：資料表 / 欄位存在檢查與安全補齊。
- `teacherLearningDashboard.js`：教師端分析指標、學生洞察、文字與卡片統計。
- `users.js`：使用者 profile、組別名稱、coin 與 actor 解析。
- `votingService.js`：投票相關共用查詢與狀態整理。

## 修改建議

- 新規則先寫在 service，再由 route 呼叫，避免多個 API 各自複製一份規則。
- 涉及交易的流程使用 connection 傳入，讓多張表的更新可以一起成功或一起 rollback。
- schema 補齊函式應保持 idempotent，也就是重複執行不會破壞資料。
