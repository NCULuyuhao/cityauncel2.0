# backend/src/services

這裡放後端共用服務邏輯。service 應盡量保持「可被多個 route 重用」，例如活動紀錄、使用者資料、遊戲設定、資料表檢查與即時事件。

## 主要服務

- `activityLog.js`：統一寫入學生行為紀錄。
- `decisioncards.js`：小組決策卡狀態與歷程。
- `gameSettings.js`：教師端 runtime 設定讀寫。
- `realtime.js`：即時事件推播與長輪詢。
- `schemaUtils.js`：啟動時確認資料表與欄位。
- `users.js`：使用者、組別與 coin 狀態相關工具。

## 維護注意

如果 route 中出現重複 SQL 或重複資料整理規則，通常代表可以抽成 service。
