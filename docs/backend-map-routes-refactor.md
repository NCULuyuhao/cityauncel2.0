# Backend map routes refactor

本次拆分以 `cityauncel4_backend_routes_refactor_v12` 為基礎，將仍在使用的地圖相關 API 從 `backend/src/app.js` 拆出到 `backend/src/routes/map.routes.js`。

## 拆出的 API

- `GET /api/user-map`
- `PUT /api/user-map`
- `GET /api/group-personal-maps`
- `PUT /api/group-final-decision`
- `GET /api/class-group-decisions`
- `POST /api/class-final-decision`
- `GET /api/class-final-decisions`

## 拆出的邏輯

- 個人地圖儲存與舊決策覆蓋失效
- 小組個人地圖彙整
- 小組平手地區最終決策
- 全班小組決策彙整
- 全班平手地區教師決策
- map action log 時間判斷與過期覆蓋過濾

## 保留不變

前端 API 路徑沒有變，仍然使用 `/api/...`。本次只調整後端內部檔案分工。

## 驗證

- `npm run check`
- `npm run build:frontend`
