# frontend

前端使用 Vite、React、TypeScript、Tailwind CSS 與 Framer Motion。主要負責學生端任務流程、探究調查書、地圖互動、資料卡、AI 幫幫忙與教師端控制介面。

## 主要內容

- `src/main.tsx`：React 入口。
- `src/pages/`：頁面級元件。
- `src/features/`：依功能拆分的複合元件與 hooks。
- `src/components/`：跨頁共用元件。
- `src/api/`：與後端 API 溝通的封裝。
- `src/storage/`：localStorage 草稿與狀態保存。
- `src/styles/`：全域樣式、響應式與主題樣式。
- `public/`：靜態圖片、卡牌與圖示資源。

## 常用指令

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

## 維護注意

頁面檔只保留流程編排，複雜 UI 與資料轉換應拆到 `features/`、`api/`、`storage/` 或 `utils/`。
