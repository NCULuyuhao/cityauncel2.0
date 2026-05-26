# AI 幫幫忙：指引探究方向大局觀引導修正

## 修改目的

將「指引探究方向 AI」調整為：

1. 先從石虎、人類、環境、生態的大局觀建立探究動機。
2. 再幫學生形成可調查目的。
3. 接著依學生回覆逐步聚焦資料面向。
4. 最後在約五回合內帶回數據卡蒐集，讓學生理解數據卡的用意。

## 主要修改

- `backend/src/app.js`
  - 更新 `AI_HELPER_DIRECTION_SCAFFOLD_RULES`
  - 指引探究方向回覆上限改為 90 字
  - 系統 prompt 改成「大局觀到數據卡的五回合探究鷹架」
  - fallback 回覆同步改成大局觀 → 目的 → 資料卡支撐的語氣

- `frontend/src/components/AiInquiryAssistant.tsx`
  - direction 的 `replyLimit` 改為 90
  - 指引探究方向輸入提示改為大局觀與數據卡導向

## 驗證

- `node --check backend/src/app.js` 通過。
- `npx tsc -b` 仍因壓縮包環境缺少 `vite/client` 與 `node` 型別套件無法完整執行，與本次修改無關。
