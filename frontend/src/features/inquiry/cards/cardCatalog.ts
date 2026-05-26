import type { EvidenceSnapshotMeta } from "@/features/inquiry/snapshots/snapshotBuilder";
import {
  categoryMetaMap,
  revealedTitlesByCategory,
  type CategoryKey,
} from "@/features/inquiry/cards/cardPresentation";

export type CatalogGameCard = {
  id: string;
  localId: number;
  category: CategoryKey;
  title: string;
  revealedTitle: string;
  content: string;
  unlocked: boolean;
  unlockedAt: string | null;
  imageSrc: string;
  sourceType: "fixedImage";
  snapshotMeta?: EvidenceSnapshotMeta;
  sharedFromOtherPlayer?: boolean;
  sharedAuthorName?: string;
};

export const CATEGORY_KEYS: CategoryKey[] = [
  "water",
  "land",
  "leopard",
  "rumor",
  "other",
];
export const TITLE_REWARD_CATEGORY_KEYS: Array<Exclude<CategoryKey, "other">> =
  ["water", "land", "leopard", "rumor"];

export const CARD_IMAGE_FILES_BY_CATEGORY: Record<CategoryKey, string[]> = {
  water: [],
  land: [
    "dahu_development_population_density.webp",
    "dahu_development_traffic_volume.webp",
    "dahu_land_01.webp",
    "gongguan_development_population_density.webp",
    "gongguan_development_traffic_volume.webp",
    "gongguan_land_01.webp",
    "houlong_development_population_density.webp",
    "houlong_development_traffic_volume.webp",
    "houlong_land_01.webp",
    "miaoli_development_population_density.webp",
    "miaoli_development_traffic_volume.webp",
    "miaoli_land_01.webp",
    "nanzhuang_development_population_density.webp",
    "nanzhuang_land_01.webp",
    "sanwan_development_population_density.webp",
    "sanwan_development_traffic_volume.webp",
    "sanwan_land_01.webp",
    "sanyi_development_population_density.webp",
    "sanyi_development_traffic_volume.webp",
    "sanyi_land_01.webp",
    "shitan_development_population_density.webp",
    "shitan_development_traffic_volume.webp",
    "shitan_land_01.webp",
    "taian_development_population_density.webp",
    "taian_land_01.webp",
    "toufen_development_population_density.webp",
    "toufen_development_traffic_volume.webp",
    "tongluo_development_population_density.webp",
    "tongluo_development_traffic_volume.webp",
    "tongluo_land_01.webp",
    "tongxiao_development_population_density.webp",
    "tongxiao_development_traffic_volume.webp",
    "tongxiao_land_01.webp",
    "toufen_land_01.webp",
    "touwu_development_population_density.webp",
    "touwu_land_01.webp",
    "xihu_development_population_density.webp",
    "xihu_development_traffic_volume.webp",
    "xihu_land_01.webp",
    "yuanli_development_population_density.webp",
    "yuanli_development_traffic_volume.webp",
    "yuanli_land_01.webp",
    "zaoqiao_development_population_density.webp",
    "zaoqiao_development_traffic_volume.webp",
    "zaoqiao_land_01.webp",
    "zhunan_development_population_density.webp",
    "zhunan_development_traffic_volume.webp",
    "zhunan_land_01.webp",
    "zhuolan_development_population_density.webp",
    "zhuolan_development_traffic_volume.webp",
    "zhuolan_land_01.webp",
  ],
  leopard: [
    "dahu_leopard_01.webp",
    "dahu_leopard_03.webp",
    "gongguan_leopard_01.webp",
    "gongguan_leopard_03.webp",
    "houlong_leopard_01.webp",
    "houlong_leopard_02_1.webp",
    "houlong_leopard_02_2.webp",
    "houlong_leopard_02_3.webp",
    "houlong_leopard_03.webp",
    "miaoli_leopard_01.webp",
    "miaoli_leopard_03.webp",
    "nanzhuang_leopard_01.webp",
    "nanzhuang_leopard_03.webp",
    "sanwan_leopard_01.webp",
    "sanwan_leopard_03.webp",
    "sanyi_leopard_01.webp",
    "sanyi_leopard_02_1.webp",
    "sanyi_leopard_03.webp",
    "shitan_leopard_01.webp",
    "shitan_leopard_02_1.webp",
    "shitan_leopard_03.webp",
    "taian_leopard_03.webp",
    "tongluo_leopard_01.webp",
    "tongluo_leopard_03.webp",
    "tongxiao_leopard_01.webp",
    "tongxiao_leopard_02_1.webp",
    "tongxiao_leopard_02_2.webp",
    "tongxiao_leopard_02_3.webp",
    "tongxiao_leopard_03.webp",
    "toufen_leopard_01.webp",
    "toufen_leopard_03.webp",
    "touwu_leopard_01.webp",
    "touwu_leopard_03.webp",
    "xihu_leopard_01.webp",
    "xihu_leopard_03.webp",
    "yuanli_leopard_01.webp",
    "yuanli_leopard_02_1.webp",
    "yuanli_leopard_03.webp",
    "zaoqiao_leopard_01.webp",
    "zaoqiao_leopard_03.webp",
    "zhunan_leopard_03.webp",
    "zhuolan_leopard_01.webp",
    "zhuolan_leopard_02_1.webp",
    "zhuolan_leopard_03.webp",
  ],
  rumor: [
    "rumor_01.webp",
    "rumor_02.webp",
    "rumor_03.webp",
    "rumor_04.webp",
    "rumor_05.webp",
    "rumor_06.webp",
    "rumor_07.webp",
    "rumor_08.webp",
    "rumor_09.webp",
    "rumor_10.webp",
    "rumor_11.webp",
    "rumor_12.webp",
    "rumor_13.webp",
    "rumor_14.webp",
    "rumor_15.webp",
    "rumor_16.webp",
    "rumor_17.webp",
    "rumor_18.webp",
    "news_01.webp",
    "news_02.webp",
    "news_03.webp",
    "news_04.webp",
    "news_05.webp",
    "news_06.webp",
    "news_07.webp",
    "news_08.webp",
    "news_09.webp",
    "news_10.webp",
    "news_11.webp",
    "news_12.webp",
    "news_13.webp",
    "news_14.webp",
    "news_15.webp",
  ],
  other: [
    "Global_Card_01.webp",
    "Global_Card_02.webp",
    "Global_Card_03.webp",
    "Global_Card_04.webp",
    "Global_Card_05.webp",
    "Global_Card_06.webp",
    "Global_Card_07.webp",
    "Global_Card_08.webp",
    "Global_Card_09.webp",
    "Global_Card_10.webp",
    "Global_Card_11.webp",
    "Global_Card_12.webp",
    "Global_Card_13.webp",
  ],
};

export function formatCardFileTitle(fileName: string) {
  const baseName = fileName.replace(/\.webp$/i, "");
  return baseName
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createCardsByCategory(
  category: CategoryKey,
): CatalogGameCard[] {
  return CARD_IMAGE_FILES_BY_CATEGORY[category].map((fileName, index) => ({
    id: `${category}-${index + 1}`,
    localId: index + 1,
    category,
    title: `${categoryMetaMap[category].label}卡 ${index + 1}`,
    revealedTitle:
      revealedTitlesByCategory[category][index] ??
      `${categoryMetaMap[category].label}：${formatCardFileTitle(fileName)}`,
    content: "",
    unlocked: false,
    unlockedAt: null,
    imageSrc: `/card/${fileName}`,
    sourceType: "fixedImage",
  }));
}

export function createAllCards(): CatalogGameCard[] {
  return CATEGORY_KEYS.flatMap((category) => createCardsByCategory(category));
}

// 水資源不再使用固定圖片卡，只保留學生擷取的互動快照卡；
// 因此預載時也略過水資源固定卡，避免不必要的圖片解碼造成卡頓。
export const ALL_CARD_IMAGE_PRELOAD_CARDS = createAllCards().filter(
  (card) => card.category !== "water",
);
