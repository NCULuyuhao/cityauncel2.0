/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 aiHelperConfig，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { AiNeedCategory, AiNeedType } from "./aiHelperTypes";

export const PAGE_LABELS: Record<string, string> = {
  cards: "數據清單",
  cardPack: "小組決策卡包",
  map: "繪製地圖",
  ending: "遊戲結局",
};

export const NEED_OPTIONS: Array<{
  type: AiNeedType;
  title: string;
  desc: string;
  icon: string;
  category: AiNeedCategory;
}> = [
  {
    type: "direction",
    title: "指引探究方向",
    desc: "適合還沒有方向的玩家。先給幾個可探究方向，再陪你把有興趣的方向變成可以思考的切入點，最後回到系統用數據卡驗證想法",
    icon: "🧭",
    category: "dialogue",
  },
  {
    type: "reason",
    title: "教我寫理由",
    desc: "像老師一樣先看你選了哪些卡，再建議你可以怎麼寫從卡片中看到或發現了什麼",
    icon: "✏️",
    category: "suggestion",
  },
  {
    type: "relation",
    title: "強化你的想法",
    desc: "適合已經有想法的玩家。先理解你的想法，再告訴你可以看哪些數據來支持",
    icon: "🔗",
    category: "dialogue",
  },
  {
    type: "clarity",
    title: "檢查數據品質",
    desc: "檢查你的數據是否清楚且完整",
    icon: "🔍",
    category: "check",
  },
  {
    type: "gap",
    title: "檢查探究缺口",
    desc: "看看你的探究方向是否過於集中或偏頗",
    icon: "🧩",
    category: "check",
  },
];

export const HELP_USES_PER_COIN = 2;
export const MAX_TURNS_PER_HELP = 5;
export const MAX_CHECKS_PER_HELP = 2;

const DIRECTION_OPENING_OPTIONS = [
  "思考哪些地區同時有石虎活動和人類活動壓力",
  "思考道路是否改變石虎移動或覓食的路線",
  "思考土地利用改變是否讓石虎活動空間變少",
  "思考地方傳言和真實紀錄之間是否有落差",
  "思考環境條件是否影響石虎適合生活的地方",
  "思考人類保育行動是否能降低人與石虎互動問題",
  "思考觀光或開發活動是否讓某些地區壓力更高",
];

export function getDirectionOpeningLine() {
  const shuffled = [...DIRECTION_OPENING_OPTIONS].sort(() => Math.random() - 0.5);
  const count = 3 + Math.floor(Math.random() * 3);
  return `你可以先從幾個方向挑一個：${shuffled.slice(0, count).join("；")} 選到有感覺的方向後，可以回到系統找相關數據卡，驗證你的想法有沒有成立。`;
}

export function getOpeningLine(needType: AiNeedType) {
  if (needType === "direction") return getDirectionOpeningLine();
  const map: Record<Exclude<AiNeedType, "direction">, string> = {
    reason: "我會先看看你蒐集到哪些資料卡，再像老師一樣給你貼近這些卡的寫作建議。",
    relation: "你先說說目前的想法，我會幫你想可以看哪些數據來支持它。",
    clarity: "",
    gap: "你想檢查本次探究，還是總體探究？",
  };
  return map[needType];
}
