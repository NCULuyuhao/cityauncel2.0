/**
 * CityAuncel maintainability notes
 * 檔案用途：角色卡包前端模型，集中定義組別牌庫、卡包 UI 狀態、卡片標準化與圖片預載。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import type React from "react";

export type GroupKey =
  | "environment"
  | "government"
  | "farming"
  | "animal"
  | "greenEnergy"
  | "education";

export type User = {
  id: number | string;
  username?: string;
  groupId?: string | null;
  groupName?: string | null;
  isGroupLeader?: boolean;
};

export type UnlockedCardData =
  | string
  | {
      id: string;
      content?: string;
      unlockedAt?: string | number | null;
      source?: string;
      groupId?: string | null;
    };

export const CARD_BACK_IMAGE = "/card/card-back-leopard-cat.webp";

export type PackCard = {
  id: string;
  title: string;
  frontText: string;
};

export type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

export type CardPackPageProps = {
  token: string;
  currentUser: User;
  unlockedCards: UnlockedCardData[];
  setUnlockedCards: React.Dispatch<React.SetStateAction<UnlockedCardData[]>>;
  realtimeLockSignal?: {
    nonce: number;
    groupId: string | null;
    lock: {
      selectedCardIds: string[];
      lockedAt: string;
    } | null;
  } | null;
  onBack: () => void;
  onActivityLog?: (payload: ActivityLogPayload) => void;
};

export const GROUP_PACK_META: Record<
  GroupKey,
  {
    title: string;
    subtitle: string;
    accent: string;
    cardFace: string;
    cardText: string;
    cardMutedText: string;
    stageGlow: string;
    emoji: string;
    coverImage: string;
  }
> = {
  environment: {
    title: "棲地保育局卡包",
    subtitle: "棲地保育局專屬",
    accent: "from-emerald-300 via-lime-200 to-green-300",
    cardFace: "from-emerald-100 via-lime-100 to-green-200",
    cardText: "text-emerald-950",
    cardMutedText: "text-emerald-800",
    stageGlow:
      "border-emerald-200/45 bg-emerald-100/18 shadow-[0_0_70px_rgba(16,185,129,0.20)]",
    emoji: "🌿",
    coverImage: "/card/role-pack-conservation.webp",
  },
  government: {
    title: "土地規劃局卡包",
    subtitle: "土地規劃局專屬",
    accent: "from-sky-300 via-blue-200 to-cyan-200",
    cardFace: "from-sky-100 via-blue-100 to-cyan-200",
    cardText: "text-sky-950",
    cardMutedText: "text-sky-800",
    stageGlow:
      "border-sky-200/45 bg-sky-100/18 shadow-[0_0_70px_rgba(14,165,233,0.20)]",
    emoji: "🏙️",
    coverImage: "/card/role-pack-land.webp",
  },
  farming: {
    title: "農業生計局卡包",
    subtitle: "農業生計局專屬",
    accent: "from-yellow-100 via-amber-100 to-orange-200",
    cardFace: "from-yellow-100 via-amber-100 to-orange-200",
    cardText: "text-amber-950",
    cardMutedText: "text-amber-800",
    stageGlow:
      "border-amber-200/45 bg-amber-100/18 shadow-[0_0_70px_rgba(245,158,11,0.20)]",
    emoji: "🌾",
    coverImage: "/card/role-pack-farm.webp",
  },
  animal: {
    title: "犬貓管理局卡包",
    subtitle: "犬貓管理局專屬",
    accent: "from-violet-300 via-purple-200 to-fuchsia-200",
    cardFace: "from-violet-100 via-purple-100 to-fuchsia-200",
    cardText: "text-violet-950",
    cardMutedText: "text-violet-800",
    stageGlow:
      "border-violet-200/45 bg-violet-100/18 shadow-[0_0_70px_rgba(139,92,246,0.20)]",
    emoji: "🐾",
    coverImage: "/card/role-pack-animal.webp",
  },
  greenEnergy: {
    title: "科技投資局卡包",
    subtitle: "科技投資局專屬",
    accent: "from-cyan-300 via-teal-200 to-emerald-200",
    cardFace: "from-cyan-100 via-teal-100 to-emerald-200",
    cardText: "text-teal-950",
    cardMutedText: "text-teal-800",
    stageGlow:
      "border-teal-200/45 bg-teal-100/18 shadow-[0_0_70px_rgba(20,184,166,0.20)]",
    emoji: "💻",
    coverImage: "/card/role-pack-tech.webp",
  },
  education: {
    title: "公眾教育局卡包",
    subtitle: "公眾教育局專屬",
    accent: "from-orange-200 via-amber-100 to-yellow-100",
    cardFace: "from-orange-100 via-amber-100 to-yellow-100",
    cardText: "text-orange-950",
    cardMutedText: "text-orange-800",
    stageGlow:
      "border-orange-200/45 bg-orange-100/18 shadow-[0_0_70px_rgba(249,115,22,0.20)]",
    emoji: "📚",
    coverImage: "/card/role-pack-education.webp",
  },
};

export type CardPackGroupMeta = (typeof GROUP_PACK_META)[GroupKey];

const GROUP_TEXT: Record<GroupKey, string[]> = {
  environment: [
    "劃設石虎核心棲地管制區",
    "要求開發案避開石虎熱區",
    "擴大石虎棲地巡護與復育",
    "提供石虎熱區資料協助土地規劃",
    "派出生態講師支援公眾教育",
    "分享巡查資訊協助犬貓管制",
    "協調石虎棲地保護範圍",
    "整合石虎保育行動",
    "共同商議棲地保護方案",
  ],
  government: [
    "優先規劃山區道路改善工程",
    "調整農地分區推動地方建設",
    "規劃山坡地觀光開發帶",
    "設計生態廊道支援棲地保育",
    "保留農業生產區穩定農民生計",
    "調整園區位置避開高產農地",
    "協調土地開發與保留範圍",
    "整合地方開發規劃",
    "共同商議土地使用方案",
  ],
  farming: [
    "擴大友善農業補助名額",
    "保留高產農地穩定農民收入",
    "主導農損補償優先給農民",
    "提供試驗農地支援石虎友善耕作",
    "開放農民班協助犬貓管理宣導",
    "提供試作場域支援科技農業設備",
    "協調農地使用與農民生計",
    "整合友善農業行動",
    "共同商議農民生計方案",
  ],
  animal: [
    "建立熱區犬貓登記與追蹤",
    "加強農場犬棄養與絕育管理",
    "設置遊蕩犬貓誘捕安置站",
    "提供犬貓熱區資料支援石虎保育",
    "派出收容資源協助農場犬安置",
    "協助公眾教育局辦理飼主溝通",
    "協調犬貓活動管理範圍",
    "整合犬貓安置與宣導",
    "共同商議犬貓管理方案",
  ],
  greenEnergy: [
    "建置科技園區帶動地方就業",
    "設置太陽能與儲能示範場",
    "規劃企業研發基地擴大投資",
    "讓出科技設備支援農業轉型",
    "建置AI監測系統支援石虎保育",
    "建立晶片追蹤平台支援犬貓管理",
    "協調科技園區設置地點",
    "整合友善環境的投資方式",
    "共同商議科技建設方案",
  ],
  education: [
    "主導全縣石虎議題教育課程",
    "集中宣導資源推動保育共識",
    "主導居民參與政策說明平台",
    "設計飼主溝通教材支援犬貓管理",
    "製作農民友善農業宣導包",
    "協助科技園區辦理居民說明會",
    "協調保育與發展的溝通方式",
    "整合居民意見與各局說明",
    "共同商議居民意見回應方式",
  ],
};

// 組別順序會影響公告欄、教師端與投票顯示，新增組別時需同步後端 GROUPS。
export const GROUP_ORDER: GroupKey[] = [
  "environment",
  "government",
  "farming",
  "animal",
  "greenEnergy",
  "education",
];

const CARD_PACK_IMAGE_URLS = [
  CARD_BACK_IMAGE,
  ...GROUP_ORDER.map((key) => GROUP_PACK_META[key].coverImage),
];

export function preloadCardPackImages() {
  CARD_PACK_IMAGE_URLS.forEach((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    if (typeof image.decode === "function") {
      image.decode().catch(() => undefined);
    }
  });
}

export function normalizeCardId(card: UnlockedCardData) {
  return typeof card === "string" ? card : card.id;
}

export function resolveGroup(groupId?: string | null): GroupKey {
  return (
    [
      "environment",
      "government",
      "farming",
      "animal",
      "greenEnergy",
      "education",
    ] as GroupKey[]
  ).includes(groupId as GroupKey)
    ? (groupId as GroupKey)
    : "education";
}

export type GroupCardPackLock = {
  groupId: string;
  selectedCardIds: string[];
  lockedBy?: number | string | null;
  lockedByName?: string | null;
  reason?: string;
  lockedAt: string;
};

export type CardPackUiState = {
  isOpened?: boolean;
  selectedIds?: string[];
  flippedIds?: string[];
  lockReason?: string;
  coreCardId?: string;
  wheelRotation?: number;
  roundNo?: number;
};

function cardPackUiStorageKey(userId?: string | number | null) {
  return `cityauncel_card_pack_ui_${userId || "guest"}`;
}

export function readCardPackUiState(
  userId?: string | number | null,
): CardPackUiState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(cardPackUiStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CardPackUiState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCardPackUiState(
  userId: string | number | null | undefined,
  state: CardPackUiState,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      cardPackUiStorageKey(userId),
      JSON.stringify(state),
    );
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

// 牌庫由組別生成，前端只負責顯示與選擇；真正鎖定與回合狀態仍以後端為準。
export function buildPackCards(group: GroupKey): PackCard[] {
  const meta = GROUP_PACK_META[group];
  return GROUP_TEXT[group].map((text, index) => ({
    id: `${group}-pack-${index + 1}`,
    title: `${meta.title.replace("卡包", "")} ${index + 1}`,
    frontText: text,
  }));
}

export function createLockSignature(
  groupId: string | null | undefined,
  selectedCardIds: string[],
  lockedAt: string,
) {
  return `${groupId || ""}:${lockedAt}:${selectedCardIds.map(String).sort().join("|")}`;
}

export function areSameCardIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const leftSorted = left.map(String).sort();
  const rightSorted = right.map(String).sort();
  return leftSorted.every((id, index) => id === rightSorted[index]);
}
