# frontend/src

這裡是前端主要程式碼。整體以頁面、功能模組、API、storage、style 與工具函式分層。

## 分層說明

- `pages/`：頁面級流程與路由畫面。
- `features/`：特定功能的元件、hooks、資料轉換與互動流程。
- `components/`：跨功能共用元件。
- `api/`：後端 API 呼叫封裝。
- `storage/`：localStorage 存取。
- `styles/`：全域樣式與響應式修正。
- `utils/`：純工具函式。

## 維護注意

當頁面檔超過太多狀態或副作用時，優先拆成 hook 或 feature 子元件，避免功能交錯造成回歸錯誤。
