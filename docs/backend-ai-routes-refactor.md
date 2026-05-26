# backend ai.routes.js 拆分紀錄

## 本次整理

將 AI 幫幫忙相關後端邏輯從 `backend/src/app.js` 拆到：

- `backend/src/routes/ai.routes.js`

保留前端原本呼叫路徑，不需要修改前端。

## 移出的 API

- `GET /api/ai-helper/status`
- `POST /api/ai-helper/unlock`
- `POST /api/ai-helper/records/event`
- `POST /api/ai/chat`

## 移出的邏輯

- OpenAI / Azure OpenAI provider 設定與回應文字解析
- AI 幫幫忙 prompt、fallback、字數限制與安全語彙處理
- AI 幫幫忙 unlock table / record table 建立
- AI 使用紀錄寫入
- AI 回覆 retry 與 fallback 流程
- coin 扣款與續費流程

## 保留在 app.js 的部分

`app.js` 目前只保留全域設定、快照上傳、小組卡包鎖定、activity-log 以及 routes 掛載。

## 驗證

已通過：

```bash
npm run check
npm run build:frontend
```
