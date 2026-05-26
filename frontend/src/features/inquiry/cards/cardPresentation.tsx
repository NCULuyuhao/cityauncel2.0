import type { ReactNode } from "react";
import { MessageCircle, Mountain, PawPrint, Stars, Waves } from "lucide-react";

export type CategoryKey = "water" | "land" | "leopard" | "rumor" | "other";

export type CategoryMeta = {
  key: CategoryKey;
  label: string;
  subtitle: string;
  icon: ReactNode;
};

export const categoryMetaMap: Record<CategoryKey, CategoryMeta> = {
  water: {
    key: "water",
    label: "水資源",
    subtitle: "降雨、河川汙染、監測站等資訊",
    icon: <Waves className="h-4 w-4" />,
  },
  land: {
    key: "land",
    label: "土地資料",
    subtitle: "土地變化、人口密度、車流量等資料",
    icon: <Mountain className="h-4 w-4" />,
  },
  leopard: {
    key: "leopard",
    label: "石虎相關資訊",
    subtitle: "出沒位置、意外事件紀錄、統計等資訊",
    icon: <PawPrint className="h-4 w-4" />,
  },
  rumor: {
    key: "rumor",
    label: "傳言",
    subtitle: "傳言與新聞報導線索",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  other: {
    key: "other",
    label: "其他",
    subtitle: "全域線索、跨域資料與補充卡牌",
    icon: <Stars className="h-4 w-4" />,
  },
};

export const categoryTabThemeMap: Record<
  CategoryKey,
  {
    active: string;
    inactive: string;
    badge: string;
  }
> = {
  water: {
    active:
      "border-sky-300 bg-sky-50/95 text-sky-800 shadow-[0_8px_22px_rgba(14,165,233,0.10)]",
    inactive: "border-sky-100 bg-white/86 hover:bg-sky-50/88",
    badge: "bg-sky-100/90 text-sky-700",
  },
  land: {
    active:
      "border-emerald-300 bg-emerald-50/95 text-emerald-800 shadow-[0_8px_22px_rgba(16,185,129,0.10)]",
    inactive: "border-emerald-100 bg-white/86 hover:bg-emerald-50/88",
    badge: "bg-emerald-100/90 text-emerald-700",
  },
  leopard: {
    active:
      "border-orange-300 bg-orange-50/95 text-orange-800 shadow-[0_8px_22px_rgba(249,115,22,0.10)]",
    inactive: "border-orange-100 bg-white/86 hover:bg-orange-50/88",
    badge: "bg-orange-100/90 text-orange-700",
  },
  rumor: {
    active:
      "border-violet-300 bg-violet-50/95 text-violet-800 shadow-[0_8px_22px_rgba(139,92,246,0.10)]",
    inactive: "border-violet-100 bg-white/86 hover:bg-violet-50/88",
    badge: "bg-violet-100/90 text-violet-700",
  },
  other: {
    active:
      "border-amber-300 bg-amber-50/95 text-amber-800 shadow-[0_8px_22px_rgba(245,158,11,0.10)]",
    inactive: "border-amber-100 bg-white/86 hover:bg-amber-50/88",
    badge: "bg-amber-100/90 text-amber-700",
  },
};

export const categoryListThemeMap: Record<
  CategoryKey,
  {
    page: string;
    pageBg: string;
    grid: string;
    glowOne: string;
    glowTwo: string;
    headerIcon: string;
    counter: string;
    unlockedFrame: string;
    unlockedFooter: string;
    activeRing: string;
  }
> = {
  water: {
    page: "border-sky-100/80",
    pageBg: "rgba(224, 242, 254, 0.82)",
    grid: "bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)]",
    glowOne: "bg-white/40",
    glowTwo: "bg-[#b6c99a]/28",
    headerIcon: "border-sky-200 bg-sky-50 text-sky-600",
    counter: "border-sky-200 bg-sky-50/80 text-sky-700",
    unlockedFrame:
      "border-sky-300 bg-[linear-gradient(180deg,rgba(224,242,254,0.96)_0%,rgba(186,230,253,0.72)_100%)] shadow-[0_12px_28px_rgba(14,165,233,0.12)]",
    unlockedFooter: "border-sky-200 bg-sky-50/95",
    activeRing: "ring-sky-300/75",
  },
  land: {
    page: "border-emerald-100/80",
    pageBg: "rgba(220, 252, 231, 0.82)",
    grid: "bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)]",
    glowOne: "bg-white/40",
    glowTwo: "bg-[#b6c99a]/28",
    headerIcon: "border-emerald-200 bg-emerald-50 text-emerald-600",
    counter: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    unlockedFrame:
      "border-emerald-300 bg-[linear-gradient(180deg,rgba(209,250,229,0.96)_0%,rgba(187,247,208,0.72)_100%)] shadow-[0_12px_28px_rgba(16,185,129,0.12)]",
    unlockedFooter: "border-emerald-200 bg-emerald-50/95",
    activeRing: "ring-emerald-300/75",
  },
  leopard: {
    page: "border-orange-100/80",
    pageBg: "rgba(255, 237, 213, 0.82)",
    grid: "bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)]",
    glowOne: "bg-white/40",
    glowTwo: "bg-[#b6c99a]/28",
    headerIcon: "border-orange-200 bg-orange-50 text-orange-600",
    counter: "border-orange-200 bg-orange-50/80 text-orange-700",
    unlockedFrame:
      "border-orange-300 bg-[linear-gradient(180deg,rgba(255,237,213,0.96)_0%,rgba(254,215,170,0.72)_100%)] shadow-[0_12px_28px_rgba(249,115,22,0.12)]",
    unlockedFooter: "border-orange-200 bg-orange-50/95",
    activeRing: "ring-orange-300/75",
  },
  rumor: {
    page: "border-violet-100/80",
    pageBg: "rgba(237, 233, 254, 0.82)",
    grid: "bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)]",
    glowOne: "bg-white/40",
    glowTwo: "bg-[#b6c99a]/28",
    headerIcon: "border-violet-200 bg-violet-50 text-violet-600",
    counter: "border-violet-200 bg-violet-50/80 text-violet-700",
    unlockedFrame:
      "border-violet-300 bg-[linear-gradient(180deg,rgba(237,233,254,0.96)_0%,rgba(221,214,254,0.72)_100%)] shadow-[0_12px_28px_rgba(139,92,246,0.12)]",
    unlockedFooter: "border-violet-200 bg-violet-50/95",
    activeRing: "ring-violet-300/75",
  },
  other: {
    page: "border-amber-100/80",
    pageBg: "rgba(254, 243, 199, 0.82)",
    grid: "bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)]",
    glowOne: "bg-white/40",
    glowTwo: "bg-[#facc15]/20",
    headerIcon: "border-amber-200 bg-amber-50 text-amber-600",
    counter: "border-amber-200 bg-amber-50/80 text-amber-700",
    unlockedFrame:
      "border-amber-300 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(254,243,199,0.72)_100%)] shadow-[0_12px_28px_rgba(245,158,11,0.12)]",
    unlockedFooter: "border-amber-200 bg-amber-50/95",
    activeRing: "ring-amber-300/75",
  },
};

export const revealedTitlesByCategory: Record<CategoryKey, string[]> = {
  water: [
    "苗栗市降水量資訊",
    "頭份市水庫蓄水資料",
    "竹南鎮河川監測紀錄",
    "後龍鎮地下水位分析",
    "通霄鎮灌溉系統概況",
    "苑裡鎮用水分布地圖",
    "公館鄉水質檢測報告",
    "銅鑼鄉集水區觀測資料",
    "三義鄉雨量變化圖表",
    "頭屋鄉水資源調度資訊",
  ],
  land: [
    "大湖鄉-人口密度",
    "大湖鄉-公路交通量",
    "大湖鄉-土地樣貌",
    "公館鄉-人口密度",
    "公館鄉-公路交通量",
    "公館鄉-土地樣貌",
    "後龍鎮-人口密度",
    "後龍鎮-公路交通量",
    "後龍鎮-土地樣貌",
    "苗栗市-人口密度",
    "苗栗市-公路交通量",
    "苗栗市-土地樣貌",
    "南庄鄉-人口密度",
    "南庄鄉-土地樣貌",
    "三灣鄉-人口密度",
    "三灣鄉-公路交通量",
    "三灣鄉-土地樣貌",
    "三義鄉-人口密度",
    "三義鄉-公路交通量",
    "三義鄉-土地樣貌",
    "獅潭鄉-人口密度",
    "獅潭鄉-公路交通量",
    "獅潭鄉-土地樣貌",
    "泰安鄉-人口密度",
    "泰安鄉-土地樣貌",
    "頭份市-人口密度",
    "頭份市-公路交通量",
    "頭份市-土地樣貌",
    "銅鑼鄉-人口密度",
    "銅鑼鄉-公路交通量",
    "銅鑼鄉-土地樣貌",
    "通霄鎮-人口密度",
    "通霄鎮-公路交通量",
    "通霄鎮-土地樣貌",
    "頭屋鄉-人口密度",
    "頭屋鄉-土地樣貌",
    "西湖鄉-人口密度",
    "西湖鄉-公路交通量",
    "西湖鄉-土地樣貌",
    "苑裡鎮-人口密度",
    "苑裡鎮-公路交通量",
    "苑裡鎮-土地樣貌",
    "造橋鄉-人口密度",
    "造橋鄉-公路交通量",
    "造橋鄉-土地樣貌",
    "竹南鎮-人口密度",
    "竹南鎮-公路交通量",
    "竹南鎮-土地樣貌",
    "卓蘭鎮-人口密度",
    "卓蘭鎮-公路交通量",
    "卓蘭鎮-土地樣貌",
  ],
  leopard: [
    "大湖鄉-石虎出沒位置",
    "大湖鄉-石虎意外統計",
    "公館鄉-石虎出沒位置",
    "公館鄉-石虎意外統計",
    "後龍鎮-石虎出沒位置",
    "後龍鎮-石虎意外報告書1",
    "後龍鎮-石虎意外報告書2",
    "後龍鎮-石虎意外報告書3",
    "後龍鎮-石虎意外統計",
    "苗栗市-石虎出沒位置",
    "苗栗市-石虎意外統計",
    "南庄鄉-石虎出沒位置",
    "南庄鄉-石虎意外統計",
    "三灣鄉-石虎出沒位置",
    "三灣鄉-石虎意外統計",
    "三義鄉-石虎出沒位置",
    "三義鄉-石虎意外報告書",
    "三義鄉-石虎意外統計",
    "獅潭鄉-石虎出沒位置",
    "獅潭鄉-石虎意外報告書",
    "獅潭鄉-石虎意外統計",
    "泰安鄉-石虎出沒位置",
    "銅鑼鄉-石虎出沒位置",
    "銅鑼鄉-石虎意外統計",
    "通霄鎮-石虎出沒位置",
    "通霄鎮-石虎意外報告書1",
    "通霄鎮-石虎意外報告書2",
    "通霄鎮-石虎意外報告書3",
    "通霄鎮-石虎意外統計",
    "頭份市-石虎出沒位置",
    "頭份市-石虎意外統計",
    "頭屋鄉-石虎出沒位置",
    "頭屋鄉-石虎意外統計",
    "西湖鄉-石虎出沒位置",
    "西湖鄉-石虎意外統計",
    "苑裡鎮-石虎出沒位置",
    "苑裡鎮-石虎意外報告書",
    "苑裡鎮-石虎意外統計",
    "造橋鄉-石虎出沒位置",
    "造橋鄉-石虎意外統計",
    "竹南鎮-石虎意外統計",
    "卓蘭鎮-石虎出沒位置",
    "卓蘭鎮-石虎意外報告書",
    "卓蘭鎮-石虎意外統計",
  ],
  rumor: [
    "傳言-1",
    "傳言-2",
    "傳言-3",
    "傳言-4",
    "傳言-5",
    "傳言-6",
    "傳言-7",
    "傳言-8",
    "傳言-9",
    "傳言-10",
    "傳言-11",
    "傳言-12",
    "傳言-13",
    "傳言-14",
    "傳言-15",
    "傳言-16",
    "傳言-17",
    "傳言-18",
    "新聞報導-1",
    "新聞報導-2",
    "新聞報導-3",
    "新聞報導-4",
    "新聞報導-5",
    "新聞報導-6",
    "新聞報導-7",
    "新聞報導-8",
    "新聞報導-9",
    "新聞報導-10",
    "新聞報導-11",
    "新聞報導-12",
    "新聞報導-13",
    "新聞報導-14",
    "新聞報導-15",
  ],
  other: [
    "公路位置圖",
    "石虎棲地分布",
    "觀光景點數量分布",
    "觀光景點類型",
    "石虎路殺位置圖",
    "自主通報趨勢",
    "獎勵金趨勢",
    "通報獎勵制度",
    "113年家禽場域通報狀況",
    "113年捕獲事件",
    "友善農地投入",
    "社區巡守統計",
    "圍網趨勢",
  ],
};

export type TitleReward = {
  id: string;
  name: string;
  description: string;
};

export const titleRewardPool: Record<string, TitleReward> = {
  water_novice: {
    id: "water_novice",
    name: "略懂水性",
    description: "蒐集 3 張水資源卡牌",
  },
  water_advanced: {
    id: "water_advanced",
    name: "有點水準",
    description: "蒐集 7 張水資源卡牌",
  },
  water_master: {
    id: "water_master",
    name: "水很深",
    description: "蒐集 10 張水資源卡牌",
  },

  land_novice: {
    id: "land_novice",
    name: "腳踏實地",
    description: "蒐集 3 張土地資料卡牌",
  },
  land_advanced: {
    id: "land_advanced",
    name: "有土有真相",
    description: "蒐集 7 張土地資料卡牌",
  },
  land_master: {
    id: "land_master",
    name: "地頭蛇",
    description: "蒐集 10 張土地資料卡牌",
  },

  leopard_novice: {
    id: "leopard_novice",
    name: "初生之虎",
    description: "蒐集 3 張石虎相關資料卡牌",
  },
  leopard_advanced: {
    id: "leopard_advanced",
    name: "虎視眈眈",
    description: "蒐集 7 張石虎相關資料卡牌",
  },
  leopard_master: {
    id: "leopard_master",
    name: "如虎添翼",
    description: "蒐集 10 張石虎相關資料卡牌",
  },

  rumor_novice: {
    id: "rumor_novice",
    name: "小耳朵",
    description: "蒐集 3 張 NPC 傳言卡牌",
  },
  rumor_advanced: {
    id: "rumor_advanced",
    name: "三姑六婆",
    description: "蒐集 7 張 NPC 傳言卡牌",
  },
  rumor_master: {
    id: "rumor_master",
    name: "八卦王",
    description: "蒐集 10 張 NPC 傳言卡牌",
  },

  cross_novice: {
    id: "cross_novice",
    name: "東張西望",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 2 張卡牌",
  },
  cross_advanced: {
    id: "cross_advanced",
    name: "略懂略懂",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 4 張卡牌",
  },
  cross_master: {
    id: "cross_master",
    name: "四界都有你",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 6 張卡牌",
  },
};

export const categoryCardThemeMap: Record<
  CategoryKey,
  {
    lockedFace: string;
    unlockedFace: string;
    lockedAccent: string;
    previewShell: string;
  }
> = {
  water: {
    lockedFace: "bg-white/92 border border-sky-100/70",
    unlockedFace: "bg-white/92 border border-sky-200/70",
    lockedAccent: "text-sky-500",
    previewShell: "bg-white border border-sky-200",
  },
  land: {
    lockedFace: "bg-white/92 border border-lime-100/70",
    unlockedFace: "bg-white/92 border border-lime-200/70",
    lockedAccent: "text-lime-600",
    previewShell: "bg-white border border-lime-200",
  },
  leopard: {
    lockedFace: "bg-white/92 border border-orange-100/70",
    unlockedFace: "bg-white/92 border border-orange-200/70",
    lockedAccent: "text-orange-500",
    previewShell: "bg-white border border-orange-200",
  },
  rumor: {
    lockedFace: "bg-white/92 border border-violet-100/70",
    unlockedFace: "bg-white/92 border border-violet-200/70",
    lockedAccent: "text-violet-500",
    previewShell: "bg-white border border-violet-200",
  },
  other: {
    lockedFace: "bg-white/92 border border-amber-100/70",
    unlockedFace: "bg-white/92 border border-amber-200/70",
    lockedAccent: "text-amber-500",
    previewShell: "bg-white border border-amber-200",
  },
};

export const writtenCardStateMap: Record<
  CategoryKey,
  {
    shell: string;
    iconBg: string;
    iconText: string;
    hintText: string;
    badge: string;
    hoverGlow: string;
    previewBox: string;
    collectionItem: string;
    collectionLabel: string;
    collectionHint: string;
    collectionArrow: string;
  }
> = {
  water: {
    shell:
      "border border-sky-200/70 bg-[linear-gradient(180deg,rgba(240,249,255,0.96)_0%,rgba(224,242,254,0.90)_100%)]",
    iconBg: "border border-sky-200 bg-sky-100/80",
    iconText: "text-sky-500",
    hintText: "text-sky-600",
    badge:
      "rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700",
    hoverGlow: "group-hover:shadow-[0_12px_28px_rgba(14,165,233,0.18)]",
    previewBox: "border border-sky-200 bg-sky-50/80",
    collectionItem: "border border-sky-200 bg-sky-50 hover:bg-sky-100/70",
    collectionLabel: "bg-sky-100 text-sky-700",
    collectionHint: "text-sky-600",
    collectionArrow: "text-sky-500",
  },
  land: {
    shell:
      "border border-lime-200/70 bg-[linear-gradient(180deg,rgba(247,254,231,0.96)_0%,rgba(236,252,203,0.90)_100%)]",
    iconBg: "border border-lime-200 bg-lime-100/80",
    iconText: "text-lime-600",
    hintText: "text-lime-700",
    badge:
      "rounded-full border border-lime-200 bg-lime-100 px-3 py-1 text-xs font-medium text-lime-700",
    hoverGlow: "group-hover:shadow-[0_12px_28px_rgba(132,204,22,0.18)]",
    previewBox: "border border-lime-200 bg-lime-50/80",
    collectionItem: "border border-lime-200 bg-lime-50 hover:bg-lime-100/70",
    collectionLabel: "bg-lime-100 text-lime-700",
    collectionHint: "text-lime-700",
    collectionArrow: "text-lime-600",
  },
  leopard: {
    shell:
      "border border-orange-200/70 bg-[linear-gradient(180deg,rgba(255,247,237,0.96)_0%,rgba(255,237,213,0.90)_100%)]",
    iconBg: "border border-orange-200 bg-orange-100/80",
    iconText: "text-orange-500",
    hintText: "text-orange-700",
    badge:
      "rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700",
    hoverGlow: "group-hover:shadow-[0_12px_28px_rgba(249,115,22,0.18)]",
    previewBox: "border border-orange-200 bg-orange-50/80",
    collectionItem:
      "border border-orange-200 bg-orange-50 hover:bg-orange-100/70",
    collectionLabel: "bg-orange-100 text-orange-700",
    collectionHint: "text-orange-700",
    collectionArrow: "text-orange-500",
  },
  rumor: {
    shell:
      "border border-violet-200/70 bg-[linear-gradient(180deg,rgba(250,245,255,0.96)_0%,rgba(243,232,255,0.90)_100%)]",
    iconBg: "border border-violet-200 bg-violet-100/80",
    iconText: "text-violet-500",
    hintText: "text-violet-700",
    badge:
      "rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700",
    hoverGlow: "group-hover:shadow-[0_12px_28px_rgba(139,92,246,0.18)]",
    previewBox: "border border-violet-200 bg-violet-50/80",
    collectionItem:
      "border border-violet-200 bg-violet-50 hover:bg-violet-100/70",
    collectionLabel: "bg-violet-100 text-violet-700",
    collectionHint: "text-violet-700",
    collectionArrow: "text-violet-500",
  },
  other: {
    shell:
      "border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(254,243,199,0.90)_100%)]",
    iconBg: "border border-amber-200 bg-amber-100/80",
    iconText: "text-amber-500",
    hintText: "text-amber-700",
    badge:
      "rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700",
    hoverGlow: "group-hover:shadow-[0_12px_28px_rgba(245,158,11,0.18)]",
    previewBox: "border border-amber-200 bg-amber-50/80",
    collectionItem: "border border-amber-200 bg-amber-50 hover:bg-amber-100/70",
    collectionLabel: "bg-amber-100 text-amber-700",
    collectionHint: "text-amber-700",
    collectionArrow: "text-amber-500",
  },
};
