# frontend/src/pages

這裡放頁面級 React 元件。頁面負責組合功能模組、處理主要流程與切換畫面。

## 主要頁面

- `AuthPage.tsx`：登入與註冊。
- `HomePage.tsx`：首頁與任務入口。
- `InquiryData.tsx`：探究資料卡、前導任務、調查書與 AI 幫幫忙。
- `MiaoliMap.tsx`：任務二地圖操作。
- `CardPackPage.tsx`：小組卡包與決策卡。
- `ControlPage.tsx`：教師控制台。
- `BehaviorRecord.tsx`：教師端行為資料與分析呈現。

## 維護注意

頁面檔應以「組裝流程」為主。可重用的顯示、狀態管理與 API 呼叫請拆到其他資料夾。
