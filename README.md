# cityauncel4 石虎探究遊戲系統

這份專案已整理成前後端分層版本，保留目前遊戲邏輯：學生登入、資料卡解鎖、探究調查書、地圖任務、決策卡包、彈幕、投票、教師端控制與資料分析。

```txt
cityauncel4.0/
├─ backend/        Express + MySQL 後端 API
├─ frontend/       Vite + React 前端
├─ database/       MySQL schema 與資料表說明
└─ docs/           專案整理紀錄
```

## 啟動方式

第一次使用請先安裝相依套件：

```bash
npm run install:all
```

後端：

```bash
cd backend
cp .env.example .env
# 修改 .env 的 DB_* 與 JWT_SECRET
npm run dev
```

前端：

```bash
cd frontend
npm run dev
```

## 資料庫

建立空資料庫後，可一次匯入整合 schema：

```bash
mysql -u <user> -p < database/00_full_schema.sql
```

如果只要查看單一資料表，`database/cityauncel_game_system_*.sql` 仍保留為獨立檔案。

## 檢查指令

```bash
npm run check
```

這會執行：

- 後端 JavaScript 語法檢查。
- 前端 TypeScript 型別檢查。

完整前端打包：

```bash
npm run build:frontend
```

## 本次整理重點

- 移除輸出包中的 `node_modules/`、`frontend/dist/`、實際 `.env`，避免相依套件跨環境損壞與機密外洩。
- 補上根目錄 scripts，之後可以在根目錄統一安裝、檢查與啟動前後端。
- 強化後端資料庫連線設定，缺少必要環境變數時會直接提示，不會進入不明錯誤狀態。
- 保留 `users` 不含 email 欄位的登入邏輯，符合目前資料表設計。
- 新增 `database/00_full_schema.sql` 與資料庫說明，方便重建資料庫。
- 保留原本主要 API 與遊戲流程，以不破壞既有功能為優先。

## 注意事項

若前端打包出現 Vite / Rolldown native binding 類錯誤，通常是壓縮檔內附帶的 `node_modules` 不完整或平台不一致。請刪除 `frontend/node_modules` 後重新執行：

```bash
cd frontend
npm install
npm run build
```
