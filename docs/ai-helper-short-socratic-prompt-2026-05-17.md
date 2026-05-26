# AI 幫幫忙：短版蘇格拉底詰問 prompt 調整

## 調整原因
原本的蘇格拉底式詰問 prompt 太完整，會讓指引探究方向 AI 回覆過長，超出前端顯示適合範圍。

## 本次調整
- 將 `AI_HELPER_SOCRATIC_DIRECTION_RULES` 改成短版規則。
- 指引探究方向限制為最多 1～2 句、最多 36 字。
- 每次最多只問 1 個主要問題。
- 保留「承接學生想法 → 追問假設/證據/因果/下一步」的蘇格拉底詰問核心。
- 學生已做決定或準備結束時，不再追問，只肯定與提醒觀察重點。
- 前端送出的 `replyLimit` 也同步將 direction / relation 壓到 36 字。

## 修改檔案
- `backend/src/app.js`
- `frontend/src/components/AiInquiryAssistant.tsx`
