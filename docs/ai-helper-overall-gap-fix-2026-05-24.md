# AI 幫幫忙：總體探究缺口修正紀錄（2026-05-24）

## 問題

「檢查本次探究缺口」可以正常檢查本次探究已解鎖的數據卡，但「檢查總體探究缺口」在點擊後，前端有機會因 React state 尚未即時更新，導致送給 AI 的文字仍是「請檢查我的本次探究缺口」，和實際選擇的 `gapScope: overall` 互相衝突。

此外，後端原本對 gap 的離線提示只看類別摘要，沒有明確區分「本次」與「總體」，也沒有強制在 overall 時優先使用 `allUnlockedCards`。

## 修正規則

1. 本次探究缺口：只檢查本次探究已解鎖的數據卡。
2. 總體探究缺口：檢查學生在整個系統中所有已解鎖過的數據卡。
3. 點擊總體缺口時，前端必須直接把 scope context 傳給 `runCheckAdvice`，不可依賴尚未更新的 React state。
4. 後端收到 `gapScope: overall` 時，必須優先讀取 `allUnlockedCards`，不能退回本次卡片。
5. AI 回覆要點出目前資料偏重哪一類，以及建議補哪一種證據角度。

## 修改檔案

- `frontend/src/features/inquiry/ai/AiInquiryAssistant.tsx`
- `frontend/src/features/inquiry/ai/aiHelperTypes.ts`
- `frontend/src/pages/InquiryData.tsx`
- `backend/src/routes/ai.routes.js`
