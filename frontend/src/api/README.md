# frontend/src/api

這裡封裝前端呼叫後端 API 的函式。頁面與 feature 應透過這些函式存取資料，不要在 UI 元件中散落 fetch 細節。

## 維護注意

- 新增 API 時，先在 `apiClient.ts` 使用共用的 `requestJson`。
- 需要 token 的請求使用 `authHeaders`。
- 圖片或上傳檔路徑統一透過 `mediaUrl` 或 `persistableMediaPath` 轉換。
