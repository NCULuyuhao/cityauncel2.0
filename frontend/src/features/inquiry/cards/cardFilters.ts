/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 cardFilters，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { CategoryKey } from "@/features/inquiry/cards/cardPresentation";

export type CardRegionFilter = string[];
export type CardQuestionFilter = string[];

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterableGameCard = {
  category: CategoryKey;
  imageSrc: string;
};

const CARD_REGION_LABEL_BY_PREFIX: Record<string, string> = {
  miaoli: "苗栗市",
  toufen: "頭份市",
  tofen: "頭份市",
  zhunan: "竹南鎮",
  houlong: "後龍鎮",
  tongxiao: "通霄鎮",
  tonxiao: "通霄鎮",
  yuanli: "苑裡鎮",
  zhuolan: "卓蘭鎮",
  xihu: "西湖鄉",
  touwu: "頭屋鄉",
  gongguan: "公館鄉",
  tongluo: "銅鑼鄉",
  sanyi: "三義鄉",
  zaoqiao: "造橋鄉",
  sanwan: "三灣鄉",
  nanzhuang: "南庄鄉",
  shitan: "獅潭鄉",
  taian: "泰安鄉",
  dahu: "大湖鄉",
};

const LAND_QUESTION_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "全部數據(不分類)" },
  { value: "land", label: "土地樣貌" },
  { value: "population", label: "人口密度" },
  { value: "traffic", label: "每日平均車流量" },
];

const LEOPARD_QUESTION_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "全部數據(不分類)" },
  { value: "appearance", label: "石虎出現位置" },
  { value: "deathCase", label: "死亡事件案例" },
  { value: "deathStats", label: "死亡事件統計數據卡" },
];

const RUMOR_QUESTION_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "全部類型" },
  { value: "rumor", label: "傳言" },
  { value: "news", label: "新聞報導" },
];

const OTHER_QUESTION_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "全部類型" },
  { value: "supplement", label: "補充資料" },
  { value: "resource", label: "人力與資源" },
];

function getCardFileName(card: FilterableGameCard) {
  return card.imageSrc.split("/").pop() ?? "";
}

function getCardRegionPrefix(card: FilterableGameCard) {
  const fileName = getCardFileName(card).replace(/\.webp$/i, "");
  if (fileName.startsWith("Global_Card")) return "global";
  if (fileName.startsWith("rumor_")) return "rumor";
  if (fileName.startsWith("news_")) return "news";
  const firstUnderscoreIndex = fileName.indexOf("_");
  return firstUnderscoreIndex > 0
    ? fileName.slice(0, firstUnderscoreIndex)
    : fileName;
}

function getCardRegionLabel(prefix: string) {
  return CARD_REGION_LABEL_BY_PREFIX[prefix] ?? prefix;
}

function getCardQuestionType(card: FilterableGameCard) {
  const fileName = getCardFileName(card).toLowerCase();

  if (card.category === "land") {
    if (fileName.includes("_land")) return "land";
    if (fileName.includes("population") || fileName.includes("pupulation"))
      return "population";
    if (fileName.includes("traffic")) return "traffic";
  }

  if (card.category === "leopard") {
    if (/_leopard_01\b/.test(fileName)) return "appearance";
    if (/_leopard_02_/.test(fileName)) return "deathCase";
    if (/_leopard_03\b/.test(fileName)) return "deathStats";
  }

  if (card.category === "rumor") {
    if (fileName.startsWith("rumor_")) return "rumor";
    if (fileName.startsWith("news_")) return "news";
  }

  if (card.category === "other") {
    const match = fileName.match(/global_card_(\d+)/i);
    const cardNumber = match ? Number.parseInt(match[1], 10) : NaN;
    if (!Number.isNaN(cardNumber)) {
      if (cardNumber >= 1 && cardNumber <= 5) return "supplement";
      if (cardNumber >= 6 && cardNumber <= 13) return "resource";
    }
  }

  return "other";
}

export function getQuestionFilterOptions(category: CategoryKey): FilterOption[] {
  if (category === "land") return LAND_QUESTION_FILTER_OPTIONS;
  if (category === "leopard") return LEOPARD_QUESTION_FILTER_OPTIONS;
  if (category === "rumor") return RUMOR_QUESTION_FILTER_OPTIONS;
  if (category === "other") return OTHER_QUESTION_FILTER_OPTIONS;
  return [];
}

export function shouldShowCardFilter(category: CategoryKey) {
  return (
    category === "land" ||
    category === "leopard" ||
    category === "rumor" ||
    category === "other"
  );
}

export function shouldShowRegionFilter(category: CategoryKey) {
  return category === "land" || category === "leopard";
}

export function buildRegionFilterOptions(cards: FilterableGameCard[]): FilterOption[] {
  const regionOptionsByLabel = new Map<string, FilterOption>();

  cards.forEach((card) => {
    const prefix = getCardRegionPrefix(card);
    if (prefix === "global" || prefix === "rumor" || prefix === "news") return;

    const label = getCardRegionLabel(prefix);
    if (!regionOptionsByLabel.has(label)) {
      regionOptionsByLabel.set(label, { value: prefix, label });
    }
  });

  const options = Array.from(regionOptionsByLabel.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "zh-Hant"),
  );

  return [{ value: "all", label: "全部地區" }, ...options];
}

export function filterCardsByStudentSelection<TCard extends FilterableGameCard>(
  cards: TCard[],
  category: CategoryKey,
  regionFilter: CardRegionFilter,
  questionFilter: CardQuestionFilter,
) {
  if (!shouldShowCardFilter(category)) return cards;

  const useAllRegions = regionFilter.length === 0;
  const useAllQuestions = questionFilter.length === 0;

  return cards.filter((card) => {
    const matchesRegion =
      useAllRegions || regionFilter.includes(getCardRegionPrefix(card));
    const matchesQuestion =
      useAllQuestions || questionFilter.includes(getCardQuestionType(card));
    return matchesRegion && matchesQuestion;
  });
}
