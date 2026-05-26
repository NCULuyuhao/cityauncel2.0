# Frontend API + localStorage Refactor

本次整理目標是把前端散落在元件中的 API 呼叫與 AI helper localStorage 操作集中管理，降低後續維護成本，並維持既有功能與 API 路徑不變。

## 新增檔案

- `frontend/src/api/authApi.ts`
  - 集中登入與註冊 API。
- `frontend/src/api/aiHelperApi.ts`
  - 集中 AI 幫幫忙狀態、投幣解鎖、事件紀錄與 AI chat API。
- `frontend/src/api/barrageApi.ts`
  - 集中彈幕 coin 狀態、最新彈幕 id、彈幕列表與送出 API。
- `frontend/src/api/controlApi.ts`
  - 集中教師控制頁使用的任務開關、投票結算、卡包鎖定、學生分組、清空資料 API。
- `frontend/src/storage/aiHelperStorage.ts`
  - 集中 AI 幫幫忙回合使用狀態的 localStorage 讀寫。

## 修改重點

- `AuthPage.tsx`
  - 改用 `authApi.ts` 處理登入/註冊。
  - 改用 `authStorage.ts` 儲存登入 token 與 user，不再直接操作 `localStorage`。
- `AiInquiryAssistant.tsx`
  - 移除直接 `fetch()`。
  - 移除直接 AI helper usage `localStorage` 讀寫。
  - 改用 `aiHelperApi.ts` 與 `aiHelperStorage.ts`。
- `BarrageLayer.tsx`
  - 移除直接 `fetch()`。
  - 改用 `barrageApi.ts`。
- `ControlPage.tsx`
  - 移除直接 `fetch()` 與 `API_BASE`。
  - 改用 `controlApi.ts`。

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```

## 後續建議

下一輪可以繼續整理：

- `cardPackApi.ts`：整理 `CardPackPage.tsx` 的 API 呼叫。
- `teacherDashboardApi.ts` 或併入 `controlApi.ts`：整理 `BehaviorRecord.tsx` 的 learning dashboard API。
- `inquiryDraftStorage.ts`：整理 `InquiryData.tsx` 中的探究草稿 localStorage。
