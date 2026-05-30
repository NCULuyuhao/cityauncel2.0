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
    "強制劃設核心保育區",
    "擴張石虎保護範圍",
    "禁止棲地開發行動",
    "讓出低風險保育區",
    "縮減次要保護範圍",
    "承擔棲地調查成本",
    "協調開發緩衝區",
    "聯合巡查棲地熱區",
    "評估棲地破碎風險",
  ],
  government: [
    "劃設開發專區",
    "加速道路建設",
    "擴大建設用地",
    "放棄高收益開發區",
    "縮減建設用地面積",
    "延後道路開發時程",
    "協調避開棲地開發",
    "共議土地使用方案",
    "整合分階段方案",
  ],
  farming: [
    "擴張農地生產",
    "維護農民耕作權",
    "爭取農民補助",
    "讓出部分農地作棲地",
    "承擔友善農法成本",
    "承擔犬隻管理成本",
    "合作推動友善農法",
    "平衡生計與保育方案",
    "整合友善農業區",
  ],
  animal: [
    "強化犬貓管制",
    "禁止犬貓放養",
    "集中管制高風險犬群",
    "承擔犬貓收容成本",
    "延後強制管制行動",
    "免費協助農民改善犬隻管理",
    "聯合巡查犬貓熱區",
    "協調犬貓共管區",
    "推動社區共管機制",
  ],
  greenEnergy: [
    "優先開發科技園區",
    "擴張能源設施",
    "爭取企業進駐",
    "放棄高收益開發地",
    "縮小科技園區規模",
    "承擔地方補償成本",
    "協調低衝擊選址",
    "配合調整開發設計",
    "共創低衝擊示範區",
  ],
  education: [
    "主導公眾倡議",
    "掌控議題討論",
    "擴大教育活動",
    "承擔居民反彈壓力",
    "讓出宣導資源支援他局",
    "承接衝突溝通任務",
    "聯合辦理政策說明",
    "整合居民共識意見",
    "建立溝通平台",
  ],
};

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
