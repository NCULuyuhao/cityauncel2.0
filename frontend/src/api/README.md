# frontend/src/api

這裡集中管理前端與後端溝通的封裝。頁面與 feature 模組應優先呼叫這裡的函式，避免在元件內直接散落裸 `fetch`。

## 核心檔案

- `apiClient.ts`：組合 API base URL、授權 header、錯誤物件與 JSON request。
- `apiResponseCache.ts`：快取短時間內重複讀取的 GET 回應，降低首頁與教師端反覆查詢。
- `pendingWriteQueue.ts`：重要寫入失敗時先放入 localStorage，連線恢復後重送。
- `realtime.ts`：SSE 受控重連，避免 EventSource 在斷線時高速重連。
- `homeApi.ts`：首頁、地圖、報告、全班任務狀態。
- `inquiryApi.ts`：任務一調查書、卡片、稱號與前導問題。
- `cardPackApi.ts`：角色卡包選牌、鎖定、投票與回合狀態。
- `aiHelperApi.ts`：AI 幫幫忙。
- `controlApi.ts` / `teacherDashboardApi.ts`：教師端控制與分析。

## 維護原則

- 所有需要 token 的 request 都使用 `authHeaders(token)`。
- request timeout 或錯誤格式應由 `requestJson` 統一處理。
- 會改變資料的 API 可考慮搭配 `requestJsonWithPending`，避免教室網路不穩造成寫入遺失。
- 新增 API 型別時，盡量在同一檔案定義 response type，讓頁面不用猜後端欄位。
