# frontend/src/features/inquiry

任務一「數據調查工作臺」的功能模組。`pages/InquiryData.tsx` 只負責組合這些模組，實際 UI、hooks、資料卡、AI、水資源快照與送出流程放在這裡。

## 子資料夾

- `ai/`：AI 幫幫忙面板、prompt 類型、卡片摘要與顯示規則。
- `cards/`：資料卡目錄、篩選、呈現、圖片預載與已蒐集卡面板。
- `draft/`：從 localStorage 還原任務一草稿。
- `hooks/`：前導流程、草稿自動保存、送出調查書、歷史返回處理。
- `intro/`：前導探究問題與轉場畫面。
- `snapshots/`：水資源快照轉成線索卡 / 證據卡。
- `summary/`：送出確認與蒐集理由規則。
- `timer/`：數據清單倒數與恢復邏輯。
- `titleRewards/`：稱號獎勵 UI 與判斷。
- `water/`：互動式水資源資料面板、圖表與地圖。

## 維護注意

- 新增卡片類型時，通常要同步檢查 `cards/cardCatalog.ts`、`cards/cardPresentation.tsx`、後端資料儲存與教師端分析。
- 修改送出調查書時，優先看 `hooks/useInquirySubmission.ts`，不要只改頁面按鈕。
- 水資源快照是動態生成資料，需保留可回復的 snapshot meta，不要只存圖片。
