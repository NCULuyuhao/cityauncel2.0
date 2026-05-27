# CityAuncel 石虎探究遊戲系統

這是一套以石虎保育議題為核心的探究式學習系統。學生會在任務一、任務二與卡包階段中蒐集資料卡、撰寫調查書、操作地圖任務、參與小組決策，教師端則可控制流程並查看學生行為與學習成果。

## 專案結構

```txt
cityauncel2.0/
├─ backend/      Express + MySQL 後端 API
├─ frontend/     Vite + React 前端介面
├─ database/     MySQL 重建腳本與資料表拆分檔
├─ docs/         重構紀錄、修正紀錄與設計說明
└─ *.py          地圖與測站資料輔助產生腳本
```

## 啟動流程

第一次使用先安裝前後端相依套件：

```bash
npm run install:all
```

後端：

```bash
cd backend
cp .env.example .env
# 修改 .env 的 DB_HOST、DB_USER、DB_PASSWORD、DB_NAME、JWT_SECRET 等設定
npm run dev
```

前端：

```bash
cd frontend
npm run dev
```

## 資料庫重建

建議使用整合重建腳本建立乾淨資料庫：

```sql
SOURCE database/cityauncel_database_rebuild_clean.sql;
```

獨立資料表檔仍保留在 `database/`，方便單獨檢查資料表欄位與索引。

## 檢查與打包

```bash
npm run check
npm run build:frontend
```

`npm run check` 會執行後端 JavaScript 語法檢查與前端 TypeScript 型別檢查。`npm run build:frontend` 會編譯前端並產生正式版輸出。

## 維護原則

- 前端以頁面、功能區與共用元件分層，避免單一檔案過大。
- 後端以 routes、services、middleware 分層，routes 處理 HTTP，services 處理可重用邏輯。
- 資料庫採用「主表、關聯表、歷程表」分離，讓教師端分析可以清楚追蹤學生流程。
- AI 幫幫忙保留使用紀錄、引用卡片與回合限制，方便後續分析學生如何使用支援。
