# frontend

前端使用 Vite、React、TypeScript、Tailwind CSS 與 Framer Motion。它負責學生端任務流程、資料卡探究、地圖互動、角色卡包、AI 幫幫忙、彈幕與教師端介面。

## 啟動與檢查

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

若後端不是本機 `http://localhost:3001`，請建立前端環境變數：

```env
VITE_API_BASE_URL=https://你的後端網址
```

## 目錄責任

```txt
src/
├─ main.tsx                  React 入口與全域樣式匯入
├─ pages/                    頁面級流程
│  ├─ HomePage.tsx           首頁、任務狀態、報告、全域流程入口
│  ├─ InquiryData.tsx        任務一：數據調查工作臺
│  ├─ MiaoliMap.tsx          任務二：個人/小組/全班地圖
│  ├─ CardPackPage.tsx       角色卡包協商
│  ├─ ControlPage.tsx        教師端控制
│  └─ BehaviorRecord.tsx     教師端行為與學習分析
├─ features/                 依任務拆分的可重用功能模組
├─ api/                      後端 API、SSE、快取與 pending write queue
├─ storage/                  localStorage 存取封裝
├─ components/               跨頁共用元件
├─ data/                     苗栗地圖、水資源圖層與靜態資料
├─ styles/                   全域、響應式、iOS Safari 與效能樣式
└─ utils/                    純工具函式
```

## 重要資料流

### 登入狀態

`authStorage.ts` 保存 token 與使用者資料；API 呼叫統一透過 `apiClient.ts` 組合後端網址與授權 header。

### 任務一草稿與送出

`InquiryData.tsx` 負責畫面編排；草稿保存由 `useInquiryDraftAutosave.ts` 與 `inquiryDraftStorage.ts` 負責；最終送出流程集中在 `useInquirySubmission.ts`，避免送出邏輯散落在頁面內。

### 任務二與卡包同步

`realtime.ts` 負責 SSE 連線，並使用受控重連避免網路不穩時大量重連。首頁、地圖與卡包頁面收到事件後，再依 userId / groupId / scope 判斷是否更新畫面。

### 斷線與延遲保護

`pendingWriteQueue.ts` 會把重要寫入暫存在 localStorage。若 API 暫時失敗，使用者下次進入或連線恢復後可以重新送出，降低教室網路不穩造成資料遺失的機率。

## 修改建議

- 不要直接在 `pages/` 堆所有狀態；超過單一畫面責任時，拆到 `features/` 或 hooks。
- 新增 API 時，先在 `src/api/` 建立封裝，頁面不要直接寫裸 `fetch`。
- 新增 localStorage key 時，集中放在 `storage/`，並寫防呆解析，避免舊資料造成畫面壞掉。
- 動畫與同步狀態要分開設計：資料是否成功以後端回應或 realtime 事件為準，動畫只做視覺回饋。
- 若修改大型頁面，請先執行 `npm run typecheck`，再測一次完整學生流程。
