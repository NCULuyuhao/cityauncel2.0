# 後端 groupCardPack routes 拆分紀錄

本次將學生端小組卡包鎖定功能從 `backend/src/app.js` 拆出，保留原本 API 路徑與前端呼叫方式。

## 新增檔案

- `backend/src/routes/groupCardPack.routes.js`
- `backend/src/services/decisioncards.js`

## 拆出的 API

- `GET /api/group-card-pack-lock`
- `PUT /api/group-card-pack-lock`

## 拆出的共用服務

`decisioncards.js` 集中管理：

- `decisioncards` 資料表建立與舊表更名
- `decisioncard_logs` 資料表建立與舊欄位清理
- 小組決策卡資料正規化
- 決策卡歷程紀錄寫入
- 教師端決策卡鎖定狀態 payload

## 保留行為

- 只有組長可以鎖定小組三張卡牌。
- 鎖定理由至少 20 個字。
- 鎖定後仍會寫入學生行為紀錄。
- 鎖定後仍會透過 realtime 通知學生端與教師端。
- 教師端解除鎖定仍共用同一組 `decisioncards` service。
