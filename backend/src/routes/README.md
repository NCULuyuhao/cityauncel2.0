# backend/src/routes

這裡是後端 API 的 controller 層。每個檔案對應一組功能領域，負責接收 HTTP request、驗證必要參數、呼叫 service 或資料庫，最後回傳 JSON。

## 功能對照

- `auth.routes.js`：登入、註冊、使用者資訊。
- `activity.routes.js`：學生操作紀錄查詢或寫入。
- `ai.routes.js`：AI 幫幫忙、投幣解鎖、對話與使用紀錄。
- `barrage.routes.js`：彈幕資料。
- `gameStatus.routes.js`：教師控制的任務狀態。
- `groupCardPack.routes.js`：任務二後的小組卡包與決策資料。
- `inquiry.routes.js`：探究調查書、資料卡、前導任務與快照。
- `map.routes.js`：苗栗地圖任務選擇與地圖歷程。
- `teacher.routes.js`：教師端資料分析 API。
- `upload.routes.js`：圖片或快照上傳。
- `voting.routes.js`：嫌犯排序投票。

## 維護注意

route 檔可以處理 request/response，但可重複的查詢、格式化或狀態檢查應拆到 `services/`，避免 route 越長越難維護。
