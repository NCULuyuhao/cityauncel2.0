# InquiryData 拆分進度紀錄

本次整理遵守「不改功能、不重寫核心流程」原則，先把低風險、純工具型與可獨立管理的區塊拆出。

## 已拆出項目

### 1. 水資源工具與資料常數

新增：

- `frontend/src/features/inquiry/water/waterResources.ts`

內容包含：

- 苗栗鄉鎮清單
- 水資源月份設定
- CSV 解析工具
- 降雨量資料解析
- 降雨量格式化與月份篩選工具

保留在 `InquiryData.tsx` 的項目：

- 水資源互動 UI
- 水資源快照視覺化
- RPI / 水質測站與地圖互動中仍需依賴頁面狀態的部分

### 2. 快照與線索卡序列化工具

新增：

- `frontend/src/features/inquiry/cards/cardSerialization.ts`

內容包含：

- 舊版/新版卡片欄位相容讀取
- 卡片圖片路徑轉換
- 時間格式正規化
- 快照 payload 瘦身，避免把大型 base64 存入 localStorage / 資料庫

### 3. AI 幫幫忙 feature 歸位

搬移：

- 原本：`frontend/src/components/AiInquiryAssistant.tsx`
- 現在：`frontend/src/features/inquiry/ai/AiInquiryAssistant.tsx`

新增：

- `frontend/src/features/inquiry/ai/index.ts`

### 4. 後端 realtime service 拆分

新增：

- `backend/src/services/realtime.js`

內容包含：

- `/api/events` SSE 連線註冊
- `publishRealtimeEvent`

`backend/src/app.js` 仍保留大多數 routes，後續可繼續逐步拆成 `routes/*.routes.js`。

## 已驗證

- `npm run check`
- `npm run build:frontend`

兩者皆通過。build 仍有 chunk 過大警告，主因是 `InquiryData` 與首頁 bundle 尚未做 code splitting。

## 下一步建議

1. 拆 `InquiryData.tsx` 的水資源 UI 元件。
2. 拆快照 UI 與證據卡 UI。
3. 將 `HomePage` 與 `InquiryData` 加上 lazy loading。
4. 逐步拆 `backend/src/app.js` routes。
