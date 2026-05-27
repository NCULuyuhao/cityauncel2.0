/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 CardPackPage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { saveInquiryCards } from "../api/inquiryApi";
import { subscribeRealtime } from "../api/realtime";
import {
  getCardPackCurrentUser,
  getGroupCardPackLock,
  saveGroupCardPackLock,
} from "../api/cardPackApi";

type GroupKey =
  | "environment"
  | "government"
  | "farming"
  | "animal"
  | "greenEnergy"
  | "education";

type User = {
  id: number | string;
  username?: string;
  groupId?: string | null;
  groupName?: string | null;
  isGroupLeader?: boolean;
};

type UnlockedCardData =
  | string
  | {
      id: string;
      content?: string;
      unlockedAt?: string | number | null;
      source?: string;
      groupId?: string | null;
    };

const CARD_BACK_IMAGE = "/card/card-back-leopard-cat.webp";

type PackCard = {
  id: string;
  title: string;
  frontText: string;
};

type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

type CardPackPageProps = {
  token: string;
  currentUser: User;
  unlockedCards: UnlockedCardData[];
  setUnlockedCards: React.Dispatch<React.SetStateAction<UnlockedCardData[]>>;
  realtimeLockSignal?: {
    nonce: number;
    groupId: string | null;
    selectedCardIds: string[];
    lockedAt: string;
  } | null;
  onBack: () => void;
  onActivityLog?: (payload: ActivityLogPayload) => void;
};

const GROUP_PACK_META: Record<
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

const GROUP_ORDER: GroupKey[] = [
  "environment",
  "government",
  "farming",
  "animal",
  "greenEnergy",
  "education",
];

function normalizeCardId(card: UnlockedCardData) {
  return typeof card === "string" ? card : card.id;
}

function resolveGroup(groupId?: string | null): GroupKey {
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

type GroupCardPackLock = {
  groupId: string;
  selectedCardIds: string[];
  lockedBy?: number | string | null;
  lockedByName?: string | null;
  reason?: string;
  lockedAt: string;
};

type CardPackUiState = {
  isOpened?: boolean;
  selectedIds?: string[];
  flippedIds?: string[];
  lockReason?: string;
  wheelRotation?: number;
};

function cardPackUiStorageKey(userId?: string | number | null) {
  return `cityauncel_card_pack_ui_${userId || "guest"}`;
}

function readCardPackUiState(
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

function saveCardPackUiState(
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

function buildPackCards(group: GroupKey): PackCard[] {
  const meta = GROUP_PACK_META[group];
  return GROUP_TEXT[group].map((text, index) => ({
    id: `${group}-pack-${index + 1}`,
    title: `${meta.title.replace("卡包", "")} ${index + 1}`,
    frontText: text,
  }));
}

function createLockSignature(
  groupId: string | null | undefined,
  selectedCardIds: string[],
  lockedAt: string,
) {
  return `${groupId || ""}:${lockedAt}:${selectedCardIds.map(String).sort().join("|")}`;
}

function areSameCardIdSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const leftSorted = left.map(String).sort();
  const rightSorted = right.map(String).sort();
  return leftSorted.every((id, index) => id === rightSorted[index]);
}

export default function CardPackPage({
  token,
  currentUser,
  unlockedCards,
  setUnlockedCards,
  realtimeLockSignal,
  onBack,
  onActivityLog,
}: CardPackPageProps) {
  const [serverGroupId, setServerGroupId] = useState<string | null>(
    currentUser.groupId ?? null,
  );
  const group = resolveGroup(serverGroupId ?? currentUser.groupId);
  const meta = GROUP_PACK_META[group];
  const isGroupLeader = Boolean(currentUser.isGroupLeader);
  const cards = useMemo(() => buildPackCards(group), [group]);
  const initialCardPackUiState = readCardPackUiState(currentUser.id);
  const initialIsOpened = Boolean(initialCardPackUiState.isOpened);
  const [openProgress, setOpenProgress] = useState(initialIsOpened ? 1 : 0);
  const openProgressFrameRef = useRef<number | null>(null);
  const openProgressValueRef = useRef(initialIsOpened ? 1 : 0);
  const pendingOpenProgressRef = useRef(initialIsOpened ? 1 : 0);
  const [isCuttingPack, setIsCuttingPack] = useState(false);
  const [isLaunchingCards, setIsLaunchingCards] = useState(false);
  const [isOpened, setIsOpened] = useState(initialIsOpened);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    Array.isArray(initialCardPackUiState.selectedIds)
      ? initialCardPackUiState.selectedIds.map(String).filter(Boolean)
      : [],
  );
  const [flippedIds, setFlippedIds] = useState<Set<string>>(
    new Set(
      Array.isArray(initialCardPackUiState.flippedIds)
        ? initialCardPackUiState.flippedIds.map(String).filter(Boolean)
        : [],
    ),
  );
  const [isLocked, setIsLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [showLockConfirmDialog, setShowLockConfirmDialog] = useState(false);
  const [fadingCardIds, setFadingCardIds] = useState<string[]>([]);
  const [lockReason, setLockReason] = useState(
    typeof initialCardPackUiState.lockReason === "string"
      ? initialCardPackUiState.lockReason
      : "",
  );
  const [hiddenCardIds, setHiddenCardIds] = useState<string[]>([]);
  const [disappearingCardIds, setDisappearingCardIds] = useState<string[]>([]);
  const [energyBurstActive, setEnergyBurstActive] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(
    typeof initialCardPackUiState.wheelRotation === "number" &&
      Number.isFinite(initialCardPackUiState.wheelRotation)
      ? initialCardPackUiState.wheelRotation
      : 0,
  );
  const wheelStageRef = useRef<HTMLDivElement | null>(null);
  const [wheelStageSize, setWheelStageSize] = useState({
    width: 760,
    height: 680,
  });
  const lightBarSwipeRef = useRef<{
    startX: number;
    direction: "left-to-right" | "right-to-left" | null;
    barWidth: number;
  } | null>(null);
  const [deniedPackId, setDeniedPackId] = useState<GroupKey | null>(null);
  const deniedPackTimeoutRef = useRef<number | null>(null);
  const openingTimeoutRef = useRef<number | null>(null);
  const launchCompleteTimeoutRef = useRef<number | null>(null);
  const cardSwipeRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const wheelDragRef = useRef<{
    startX: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    dragging: boolean;
  } | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);
  const suppressCardClickRef = useRef<string | null>(null);
  const lastAppliedLockAtRef = useRef<string | null>(null);
  const lastAppliedLockSignatureRef = useRef<string | null>(null);
  const syncGroupLockInFlightRef = useRef(false);
  const openedLockPollInFlightRef = useRef(false);
  const lockAnimationTimeoutsRef = useRef<number[]>([]);
  const pendingGroupLockIdsRef = useRef<string[] | null>(null);
  const pendingGroupLockShouldMessageRef = useRef(true);
  const pendingIncomingGroupLockRef = useRef<{
    groupId: GroupKey | null;
    selectedCardIds: string[];
    lockedAt: string;
    showMessage: boolean;
  } | null>(null);
  const isOpenedRef = useRef(false);
  const isLockedRef = useRef(false);
  const selectedIdsRef = useRef<string[]>([]);
  const isCuttingPackRef = useRef(false);
  const isLaunchingCardsRef = useRef(false);
  const [cardSwipePreview, setCardSwipePreview] = useState<{
    cardId: string | null;
    offsetX: number;
  }>({
    cardId: null,
    offsetX: 0,
  });

  useLayoutEffect(() => {
    isOpenedRef.current = isOpened;
    isLockedRef.current = isLocked;
    selectedIdsRef.current = selectedIds;
    isCuttingPackRef.current = isCuttingPack;
    isLaunchingCardsRef.current = isLaunchingCards;
  }, [isOpened, isLocked, selectedIds, isCuttingPack, isLaunchingCards]);

  useEffect(() => {
    saveCardPackUiState(currentUser.id, {
      isOpened,
      selectedIds,
      flippedIds: Array.from(flippedIds),
      lockReason,
      wheelRotation,
    });
  }, [
    currentUser.id,
    flippedIds,
    isOpened,
    lockReason,
    selectedIds,
    wheelRotation,
  ]);

  const selectedCards = cards.filter((card) => selectedIds.includes(card.id));
  const trimmedLockReason = lockReason.trim();
  const canLock = isGroupLeader && selectedIds.length === 3 && !isLocked;
  const canConfirmLock = canLock && trimmedLockReason.length >= 20;
  const wheelMetrics = useMemo(() => {
    const width = Math.max(320, wheelStageSize.width || 320);
    const height = Math.max(360, wheelStageSize.height || 360);
    const shortest = Math.min(width, height);
    const longest = Math.max(width, height);
    const cardWidth = Math.round(
      Math.max(76, Math.min(150, shortest * 0.22, width * 0.24)),
    );
    const cardHeight = Math.round((cardWidth * 4) / 3);
    const maxRadiusX = Math.max(86, (width - cardWidth - 24) / 2);
    const maxRadiusY = Math.max(92, (height - cardHeight - 24) / 2);
    const comfortableRadius = Math.max(
      96,
      Math.min(shortest * 0.34, longest * 0.28),
    );
    const radius = Math.round(
      Math.min(maxRadiusX, maxRadiusY, comfortableRadius),
    );

    return { cardWidth, cardHeight, radius };
  }, [wheelStageSize]);

  useEffect(() => {
    return () => {
      if (inertiaFrameRef.current !== null)
        cancelAnimationFrame(inertiaFrameRef.current);
      if (openProgressFrameRef.current !== null)
        cancelAnimationFrame(openProgressFrameRef.current);
      if (openingTimeoutRef.current !== null)
        window.clearTimeout(openingTimeoutRef.current);
      if (launchCompleteTimeoutRef.current !== null)
        window.clearTimeout(launchCompleteTimeoutRef.current);
      if (deniedPackTimeoutRef.current !== null)
        window.clearTimeout(deniedPackTimeoutRef.current);
      clearLockAnimationTimeouts();
    };
  }, []);

  useEffect(() => {
    const stage = wheelStageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setWheelStageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(stage);
    return () => resizeObserver.disconnect();
  }, [isOpened]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function refreshUserGroupFromServer() {
      try {
        const data = await getCardPackCurrentUser<User>(token);
        const nextGroupId = data?.user?.groupId
          ? String(data.user.groupId)
          : null;
        if (!cancelled && nextGroupId) setServerGroupId(nextGroupId);
      } catch (error) {
        console.error("同步使用者小組資料失敗：", error);
      }
    }

    refreshUserGroupFromServer();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function syncGroupLockNow(
    options: { showMessage?: boolean; autoOpenIfLocked?: boolean } = {},
  ) {
    if (!token || syncGroupLockInFlightRef.current) return null;

    syncGroupLockInFlightRef.current = true;
    try {
      const data = await getGroupCardPackLock(token, { cache: "no-store" });
      const lock = data?.lock as GroupCardPackLock | null | undefined;
      const selectedCardIds = Array.isArray(lock?.selectedCardIds)
        ? lock.selectedCardIds.map(String)
        : [];
      const lockedAt = lock?.lockedAt ? String(lock.lockedAt) : "";

      if (!lock || !lockedAt || selectedCardIds.length !== 3) return null;

      const lockGroupId = lock.groupId ? String(lock.groupId) : null;
      queueOrApplyIncomingGroupLock(lockGroupId, selectedCardIds, lockedAt, {
        showMessage: options.showMessage !== false,
        autoOpenIfLocked: options.autoOpenIfLocked === true,
        allowGroupSwitch: true,
      });
      return lock;
    } catch (error) {
      console.error("立即同步小組卡包鎖定狀態失敗：", error);
      return null;
    } finally {
      syncGroupLockInFlightRef.current = false;
    }
  }

  function stopWheelInertia() {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }

  function startWheelInertia(initialVelocity: number) {
    stopWheelInertia();
    let velocity = Math.max(-3.2, Math.min(3.2, initialVelocity));
    let lastTime: number | null = null;

    const tick = (time: number) => {
      const dt = lastTime === null ? 16 : Math.min(32, time - lastTime);
      lastTime = time;
      setWheelRotation((prev) => prev + velocity * dt);
      velocity *= 0.94;

      if (Math.abs(velocity) > 0.018) {
        inertiaFrameRef.current = requestAnimationFrame(tick);
      } else {
        inertiaFrameRef.current = null;
      }
    };

    inertiaFrameRef.current = requestAnimationFrame(tick);
  }

  function clearLockAnimationTimeouts() {
    lockAnimationTimeoutsRef.current.forEach((timeoutId) =>
      window.clearTimeout(timeoutId),
    );
    lockAnimationTimeoutsRef.current = [];
  }

  function scheduleLockAnimationStep(callback: () => void, delay: number) {
    const timeoutId = window.setTimeout(() => {
      lockAnimationTimeoutsRef.current =
        lockAnimationTimeoutsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    lockAnimationTimeoutsRef.current.push(timeoutId);
  }

  function runLockedCardExitAnimation(keptCardIds: string[]) {
    clearLockAnimationTimeouts();

    const keptIdSet = new Set(keptCardIds);
    const nonSelectedIds = cards
      .filter((card) => !keptIdSet.has(card.id))
      .map((card) => card.id);

    setIsOpened(true);
    setIsLocked(true);
    setSelectedIds(keptCardIds);
    setHiddenCardIds([]);
    setFadingCardIds([]);
    setDisappearingCardIds([]);

    scheduleLockAnimationStep(() => {
      setFlippedIds((prev) => {
        const next = new Set(prev);
        nonSelectedIds.forEach((id) => next.add(id));
        return next;
      });

      scheduleLockAnimationStep(() => {
        setDisappearingCardIds(nonSelectedIds);

        scheduleLockAnimationStep(() => {
          setFadingCardIds(nonSelectedIds);

          scheduleLockAnimationStep(() => {
            setHiddenCardIds(nonSelectedIds);
          }, 720);
        }, 240);
      }, 520);
    }, 80);
  }

  function mergeLockedCardsIntoInventory(keptCardIds: string[]) {
    const keptIdSet = new Set(keptCardIds);
    const keptCards = cards.filter((card) => keptIdSet.has(card.id));

    setUnlockedCards((prev) => {
      const unlockedIdSet = new Set(prev.map(normalizeCardId));
      const additions = keptCards
        .filter((card) => !unlockedIdSet.has(card.id))
        .map((card) => ({
          id: card.id,
          content: card.frontText,
          unlockedAt: new Date().toISOString(),
          source: "group_card_pack",
          groupId: group,
        }));

      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }

  function finalizeGroupLock(
    selectedCardIds: string[],
    options: { showMessage?: boolean; autoOpenIfLocked?: boolean } = {},
  ) {
    runLockedCardExitAnimation(selectedCardIds);
    mergeLockedCardsIntoInventory(selectedCardIds);
    if (options.showMessage !== false) {
      setMessage("已鎖定這三張卡牌。");
    }
  }

  function inferGroupFromCardIds(selectedCardIds: string[]): GroupKey | null {
    const firstCardGroup = selectedCardIds
      .map((id) => String(id).match(/^([a-zA-Z]+)-pack-\d+$/)?.[1])
      .find(Boolean);
    return firstCardGroup ? resolveGroup(firstCardGroup) : null;
  }

  function queueOrApplyIncomingGroupLock(
    lockGroupId: string | null,
    selectedCardIds: string[],
    optionsLockedAt: string,
    options: {
      showMessage?: boolean;
      autoOpenIfLocked?: boolean;
      allowGroupSwitch?: boolean;
      forceApply?: boolean;
    } = {},
  ) {
    const lockedAt = String(optionsLockedAt || "");
    if (selectedCardIds.length !== 3 || !lockedAt) return;

    const resolvedLockGroup = lockGroupId
      ? resolveGroup(lockGroupId)
      : inferGroupFromCardIds(selectedCardIds) || group;
    const shouldShowMessage = options.showMessage !== false;
    const lockSignature = createLockSignature(
      resolvedLockGroup,
      selectedCardIds,
      lockedAt,
    );
    const isAlreadyShowingThisLock =
      lastAppliedLockSignatureRef.current === lockSignature &&
      isLockedRef.current &&
      areSameCardIdSet(selectedIdsRef.current, selectedCardIds);

    if (isAlreadyShowingThisLock && !options.forceApply) return;

    if (resolvedLockGroup !== group) {
      if (!options.allowGroupSwitch) return;

      pendingIncomingGroupLockRef.current = {
        groupId: resolvedLockGroup,
        selectedCardIds: selectedCardIds.map(String),
        lockedAt,
        showMessage: shouldShowMessage,
      };
      setServerGroupId(resolvedLockGroup);
      return;
    }

    const normalizedIds = Array.from(
      new Set(selectedCardIds.map(String)),
    ).filter((id) => cards.some((card) => card.id === id));

    if (normalizedIds.length !== 3) {
      const inferredGroup = inferGroupFromCardIds(selectedCardIds);
      pendingIncomingGroupLockRef.current = {
        groupId: inferredGroup || resolvedLockGroup,
        selectedCardIds: selectedCardIds.map(String),
        lockedAt,
        showMessage: shouldShowMessage,
      };
      if (options.allowGroupSwitch && inferredGroup && inferredGroup !== group)
        setServerGroupId(inferredGroup);
      return;
    }

    pendingIncomingGroupLockRef.current = null;
    lastAppliedLockAtRef.current = lockedAt;
    lastAppliedLockSignatureRef.current = lockSignature;
    applyGroupLock(normalizedIds, {
      showMessage: shouldShowMessage,
      autoOpenIfLocked: options.autoOpenIfLocked === true,
    });
  }

  function applyGroupLock(
    selectedCardIds: string[],
    options: { showMessage?: boolean; autoOpenIfLocked?: boolean } = {},
  ) {
    const normalizedIds = Array.from(
      new Set(selectedCardIds.map(String)),
    ).filter((id) => cards.some((card) => card.id === id));
    if (normalizedIds.length !== 3) return;

    const shouldShowMessage = options.showMessage !== false;

    // 組員端若還停在卡包封面，先完整滑開/彈出卡包，再立刻自動套用組長鎖定的三張卡。
    // 只有「主動同步」或「已經在開包動畫中」才自動開包，避免組長一送出就強迫組員離開原本畫面。
    if (
      !isGroupLeader &&
      (!isOpenedRef.current ||
        isCuttingPackRef.current ||
        isLaunchingCardsRef.current)
    ) {
      pendingGroupLockIdsRef.current = normalizedIds;
      pendingGroupLockShouldMessageRef.current = shouldShowMessage;
      if (shouldShowMessage) {
        setMessage("組長已完成選牌，開包後會同步顯示三張最終決策卡。");
      }
      if (
        options.autoOpenIfLocked &&
        !isOpenedRef.current &&
        !isCuttingPackRef.current &&
        !isLaunchingCardsRef.current
      ) {
        openPack({ silentActivityLog: true, syncLockAfterOpen: true });
      }
      return;
    }

    finalizeGroupLock(normalizedIds, {
      showMessage: shouldShowMessage,
    });
  }

  function updateOpenProgress(
    nextProgress: number,
    options: { immediate?: boolean } = {},
  ) {
    const clampedProgress = Math.max(0, Math.min(nextProgress, 1));
    pendingOpenProgressRef.current = clampedProgress;

    if (options.immediate) {
      if (openProgressFrameRef.current !== null) {
        window.cancelAnimationFrame(openProgressFrameRef.current);
        openProgressFrameRef.current = null;
      }
      openProgressValueRef.current = clampedProgress;
      setOpenProgress(clampedProgress);
      return;
    }

    // 指標移動事件可能一秒觸發數十次；用 requestAnimationFrame 合併更新，
    // 避免每一個像素移動都讓整個卡包頁面重新 render。
    if (openProgressFrameRef.current !== null) return;

    openProgressFrameRef.current = window.requestAnimationFrame(() => {
      openProgressFrameRef.current = null;
      const progress = pendingOpenProgressRef.current;
      if (
        Math.abs(progress - openProgressValueRef.current) < 0.012 &&
        progress < 0.96
      )
        return;
      openProgressValueRef.current = progress;
      setOpenProgress(progress);
    });
  }

  function resetGroupLock(options: { showMessage?: boolean } = {}) {
    clearLockAnimationTimeouts();
    stopWheelInertia();
    setIsOpened(true);
    setIsCuttingPack(false);
    setIsLaunchingCards(false);
    updateOpenProgress(1, { immediate: true });
    setIsLocked(false);
    setSelectedIds([]);
    setFadingCardIds([]);
    setHiddenCardIds([]);
    setDisappearingCardIds([]);
    setFlippedIds(new Set<string>());
    setCardSwipePreview({ cardId: null, offsetX: 0 });
    setShowLockConfirmDialog(false);
    setLockReason("");
    pendingGroupLockIdsRef.current = null;
    pendingGroupLockShouldMessageRef.current = true;
    pendingIncomingGroupLockRef.current = null;
    lastAppliedLockAtRef.current = null;
    lastAppliedLockSignatureRef.current = null;
    if (options.showMessage !== false) {
      setMessage(
        "教師已解除卡牌決策鎖定，請重新從九張卡牌中選擇。由組長負責後續鎖定。",
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    async function syncGroupLock() {
      if (!token || syncGroupLockInFlightRef.current) return;

      syncGroupLockInFlightRef.current = true;
      try {
        const data = await getGroupCardPackLock(token);
        const lock = data?.lock as GroupCardPackLock | null | undefined;
        const selectedCardIds = Array.isArray(lock?.selectedCardIds)
          ? lock.selectedCardIds.map(String)
          : [];
        const lockedAt = lock?.lockedAt ? String(lock.lockedAt) : "";

        if (cancelled) return;
        if (!lock || !lockedAt || selectedCardIds.length !== 3) {
          if (
            isLocked ||
            hiddenCardIds.length > 0 ||
            disappearingCardIds.length > 0 ||
            fadingCardIds.length > 0
          ) {
            resetGroupLock({ showMessage: true });
          }
          return;
        }
        const lockGroupId = lock?.groupId ? String(lock.groupId) : null;
        queueOrApplyIncomingGroupLock(lockGroupId, selectedCardIds, lockedAt, {
          showMessage: true,
          allowGroupSwitch: true,
        });
      } catch (error) {
        console.error("同步小組卡包鎖定狀態失敗：", error);
      } finally {
        syncGroupLockInFlightRef.current = false;
      }
    }

    syncGroupLock();
    // 鎖定/解鎖以 SSE 即時推送為主；5 秒備援可避免網路短暫斷線時組員等太久。
    intervalId = window.setInterval(syncGroupLock, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncGroupLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
    // 這個備援輪詢需要穩定維持 5 秒一次；queue/reset 會讀取最新畫面狀態，
    // 但不應讓每次卡牌動畫 render 都重建 interval，否則組員同步動畫可能被中斷。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    group,
    cards,
    isLocked,
    hiddenCardIds.length,
    disappearingCardIds.length,
    fadingCardIds.length,
  ]);

  useEffect(() => {
    if (!token) return;

    return subscribeRealtime(token, (event) => {
      if (event.type !== "group-card-pack-lock") return;
      const payload = (event.payload || {}) as {
        groupId?: unknown;
        lock?: { selectedCardIds?: unknown[]; lockedAt?: unknown } | null;
      };
      const eventGroupId = payload.groupId ? String(payload.groupId) : null;

      if (!payload.lock) {
        if (eventGroupId && resolveGroup(eventGroupId) !== group) return;
        lastAppliedLockAtRef.current = null;
        lastAppliedLockSignatureRef.current = null;
        resetGroupLock({ showMessage: true });
        return;
      }

      const selectedCardIds = Array.isArray(payload.lock.selectedCardIds)
        ? payload.lock.selectedCardIds.map(String)
        : [];
      const lockedAt = payload.lock.lockedAt
        ? String(payload.lock.lockedAt)
        : "";
      if (selectedCardIds.length !== 3 || !lockedAt) return;

      queueOrApplyIncomingGroupLock(eventGroupId, selectedCardIds, lockedAt, {
        showMessage: true,
        allowGroupSwitch: true,
        forceApply: !isGroupLeader && isOpenedRef.current,
      });
    });
    // SSE 訂閱只需要在 token 或小組切換時重建；事件處理函式會使用當前 render 的狀態，
    // 避免加入 queue/reset 後造成每次選牌或動畫更新都重新訂閱。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, token]);

  useEffect(() => {
    if (!token || isGroupLeader || !isOpened || isLocked) return;

    let cancelled = false;
    let intervalId: number | null = null;

    async function pollOpenedPackLock() {
      if (openedLockPollInFlightRef.current) return;

      openedLockPollInFlightRef.current = true;
      try {
        const data = await getGroupCardPackLock(token, { cache: "no-store" });
        if (cancelled) return;

        const lock = data?.lock as GroupCardPackLock | null | undefined;
        const selectedCardIds = Array.isArray(lock?.selectedCardIds)
          ? lock.selectedCardIds.map(String)
          : [];
        const lockedAt = lock?.lockedAt ? String(lock.lockedAt) : "";
        if (!lock || selectedCardIds.length !== 3 || !lockedAt) return;

        const lockGroupId = lock.groupId ? String(lock.groupId) : null;
        queueOrApplyIncomingGroupLock(lockGroupId, selectedCardIds, lockedAt, {
          showMessage: true,
          allowGroupSwitch: true,
          forceApply: true,
        });
      } catch (error) {
        console.error("?郊撠??∪?????仃??", error);
      } finally {
        openedLockPollInFlightRef.current = false;
      }
    }

    void pollOpenedPackLock();
    intervalId = window.setInterval(pollOpenedPackLock, 900);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
    // 這條輪詢只服務「組員已打開九張卡、但尚未鎖定」的即時同步保底。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isGroupLeader, isOpened, isLocked, group, cards]);

  useEffect(() => {
    if (!realtimeLockSignal) return;

    queueOrApplyIncomingGroupLock(
      realtimeLockSignal.groupId,
      realtimeLockSignal.selectedCardIds,
      realtimeLockSignal.lockedAt,
      {
        showMessage: true,
        allowGroupSwitch: true,
        forceApply: !isGroupLeader && isOpenedRef.current,
      },
    );
    // 首頁即時通道收到組長鎖定後，直接推進目前卡包頁狀態；
    // queueOrApplyIncomingGroupLock 會用最新 refs 判斷是否已經真的鎖定。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeLockSignal?.nonce]);

  useEffect(() => {
    const pendingLock = pendingIncomingGroupLockRef.current;
    if (!pendingLock) return;
    if (pendingLock.groupId && pendingLock.groupId !== group) return;
    const pendingLockSignature = createLockSignature(
      pendingLock.groupId || group,
      pendingLock.selectedCardIds,
      pendingLock.lockedAt,
    );
    if (
      lastAppliedLockSignatureRef.current === pendingLockSignature &&
      isLockedRef.current &&
      areSameCardIdSet(selectedIdsRef.current, pendingLock.selectedCardIds)
    ) {
      pendingIncomingGroupLockRef.current = null;
      return;
    }

    const normalizedIds = Array.from(
      new Set(pendingLock.selectedCardIds.map(String)),
    ).filter((id) => cards.some((card) => card.id === id));

    if (normalizedIds.length !== 3) return;

    pendingIncomingGroupLockRef.current = null;
    lastAppliedLockAtRef.current = pendingLock.lockedAt;
    lastAppliedLockSignatureRef.current = pendingLockSignature;
    applyGroupLock(normalizedIds, {
      showMessage: pendingLock.showMessage,
    });
    // 這裡只在小組或卡牌資料切換後補套用暫存鎖定；applyGroupLock 會讀最新狀態，
    // 不應因動畫中的狀態變化反覆觸發。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, cards]);

  function handleWheelPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isOpened) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('[data-card-button="true"]') ||
      target.closest('[data-lock-button="true"]')
    )
      return;

    stopWheelInertia();
    wheelDragRef.current = {
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleWheelPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = wheelDragRef.current;
    if (!drag) return;

    const now = performance.now();
    const dx = event.clientX - drag.lastX;
    const totalDx = event.clientX - drag.startX;
    const dt = Math.max(1, now - drag.lastTime);
    const rotationDelta = dx * 0.42;

    if (!drag.dragging && Math.abs(totalDx) > 8) drag.dragging = true;
    if (!drag.dragging) return;

    drag.velocity = rotationDelta / dt;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    setWheelRotation((prev) => prev + rotationDelta);
  }

  function handleWheelPointerUp() {
    const drag = wheelDragRef.current;
    if (drag?.dragging) {
      startWheelInertia(drag.velocity * 18);
    }
    wheelDragRef.current = null;
  }

  function handleUnauthorizedPackAttempt(packKey: GroupKey) {
    if (packKey === group) return;
    if (deniedPackTimeoutRef.current !== null) {
      window.clearTimeout(deniedPackTimeoutRef.current);
      deniedPackTimeoutRef.current = null;
    }

    setDeniedPackId(packKey);
    setMessage("沒有權限開啟此卡包，請去開啟屬於自己的卡包。");
    deniedPackTimeoutRef.current = window.setTimeout(() => {
      setDeniedPackId((current) => (current === packKey ? null : current));
      deniedPackTimeoutRef.current = null;
    }, 760);
  }

  async function openPackForGroup(packKey: GroupKey) {
    if (packKey !== group) {
      handleUnauthorizedPackAttempt(packKey);
      return;
    }

    // 組員手動劃開/點開卡包的瞬間，先主動查一次伺服器。
    // 如果組長已經鎖定，這次開包動畫結束後會直接只留下組長選的三張牌。
    if (!isGroupLeader) {
      void syncGroupLockNow({ showMessage: true, autoOpenIfLocked: false });
    }

    openPack();
  }

  function openPack(
    options: { silentActivityLog?: boolean; syncLockAfterOpen?: boolean } = {},
  ) {
    if (
      isOpenedRef.current ||
      isCuttingPackRef.current ||
      isLaunchingCardsRef.current
    )
      return;

    updateOpenProgress(1, { immediate: true });
    setIsCuttingPack(true);
    setIsLaunchingCards(false);

    setMessage("正在解鎖卡包⋯⋯");

    openingTimeoutRef.current = window.setTimeout(
      () => {
        openingTimeoutRef.current = null;
        // 保持切開狀態到卡牌彈射結束，避免卡包在彈射期間又合回去。
        setEnergyBurstActive(true);
        setIsLaunchingCards(true);

        launchCompleteTimeoutRef.current = window.setTimeout(
          () => {
            launchCompleteTimeoutRef.current = null;
            setIsLaunchingCards(false);
            setEnergyBurstActive(false);
            setIsOpened(true);
            isOpenedRef.current = true;
            isCuttingPackRef.current = false;
            isLaunchingCardsRef.current = false;

            const pendingLockIds = pendingGroupLockIdsRef.current;
            if (pendingLockIds?.length === 3) {
              pendingGroupLockIdsRef.current = null;
              const shouldShowMessage =
                pendingGroupLockShouldMessageRef.current;
              window.setTimeout(() => {
                finalizeGroupLock(pendingLockIds, {
                  showMessage: shouldShowMessage,
                });
              }, 120);
              return;
            }

            if (!isGroupLeader) {
              void syncGroupLockNow({
                showMessage: true,
                autoOpenIfLocked: false,
              }).then((lock) => {
                if (lock) return;
                setMessage(`請組長與組員討論出共識後，選擇三張卡牌。`);
              });
            } else {
              setMessage(`請組長與組員討論出共識後，選擇三張卡牌。`);
            }

            if (!options.silentActivityLog) {
              onActivityLog?.({
                eventType: "card_pack_open",
                eventLabel: "開啟角色卡包",
                targetType: "role_card_pack",
                targetId: group,
                metadata: { groupId: group, packTitle: meta.title },
              });
            }
          },
          options.syncLockAfterOpen ? 620 : 980,
        );
      },
      options.syncLockAfterOpen ? 260 : 420,
    );
  }

  function handleLightBarPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (isOpened || isCuttingPack) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const edgeSize = rect.width * 0.26;
    const direction =
      x <= edgeSize
        ? "left-to-right"
        : x >= rect.width - edgeSize
          ? "right-to-left"
          : null;

    lightBarSwipeRef.current = {
      startX: x,
      direction,
      barWidth: rect.width,
    };
    updateOpenProgress(0, { immediate: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleLightBarPointerMove(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const swipe = lightBarSwipeRef.current;
    if (!swipe || isOpened || isCuttingPack) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = Math.max(
      0,
      Math.min(rect.width, event.clientX - rect.left),
    );
    const rawProgress =
      swipe.direction === "left-to-right"
        ? (currentX - swipe.startX) / Math.max(1, swipe.barWidth - swipe.startX)
        : swipe.direction === "right-to-left"
          ? (swipe.startX - currentX) / Math.max(1, swipe.startX)
          : Math.abs(currentX - swipe.startX) / Math.max(1, swipe.barWidth);
    const progress = Math.max(0, Math.min(rawProgress, 1));
    updateOpenProgress(progress);

    if (swipe.direction && progress >= 0.96) {
      lightBarSwipeRef.current = null;
      void openPackForGroup(group);
    }
  }

  function handleLightBarPointerUp() {
    lightBarSwipeRef.current = null;
    if (!isOpened && !isCuttingPack && openProgressValueRef.current < 0.96) {
      updateOpenProgress(0, { immediate: true });
    }
  }

  function toggleCardSelect(cardId: string) {
    if (!isOpened || isLocked) return;
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 3) {
        setMessage("最多只能選擇三張卡牌。再次點擊已選卡可以取消。");
        return prev;
      }
      setMessage("");
      return [...prev, cardId];
    });
  }

  function toggleFlip(cardId: string) {
    if (!isOpened) return;
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function handleCardPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    if (!isOpened) return;
    cardSwipeRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCardPointerMove(
    event: React.PointerEvent<HTMLButtonElement>,
    cardId: string,
  ) {
    const swipe = cardSwipeRef.current;
    if (!swipe || swipe.cardId !== cardId) return;

    const dx = event.clientX - swipe.startX;
    const dy = event.clientY - swipe.startY;
    const isHorizontalSwipe =
      Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2;

    if (!swipe.dragging && isHorizontalSwipe) {
      swipe.dragging = true;
      suppressCardClickRef.current = cardId;
    }

    if (!swipe.dragging) return;

    const offsetX = Math.max(-90, Math.min(90, dx));
    setCardSwipePreview({ cardId, offsetX });
  }

  function handleCardPointerUp(cardId: string) {
    const swipe = cardSwipeRef.current;
    if (
      swipe?.cardId === cardId &&
      swipe.dragging &&
      Math.abs(cardSwipePreview.offsetX) >= 52
    ) {
      toggleFlip(cardId);
    }

    cardSwipeRef.current = null;
    setCardSwipePreview({ cardId: null, offsetX: 0 });
  }

  function handleCardClick(cardId: string) {
    if (suppressCardClickRef.current === cardId) {
      suppressCardClickRef.current = null;
      return;
    }
    toggleCardSelect(cardId);
  }

  function requestLockSelection() {
    if (!isGroupLeader) {
      setMessage("只有組長可以鎖定卡牌。");
      return;
    }

    if (!canLock) return;

    setShowLockConfirmDialog(true);
  }

  async function lockSelection() {
    if (!isGroupLeader) {
      setMessage("只有組長可以鎖定卡牌。");
      return;
    }
    if (!canLock) return;

    if (lockReason.trim().length < 20) {
      setMessage("鎖定理由至少需要 20 個字。");
      return;
    }

    setShowLockConfirmDialog(false);

    const lockedSelectedIds = [...selectedIds];
    const nextCards: UnlockedCardData[] = (() => {
      const unlockedIdSet = new Set(unlockedCards.map(normalizeCardId));
      return [
        ...unlockedCards,
        ...selectedCards
          .filter((card) => !unlockedIdSet.has(card.id))
          .map((card) => ({
            id: card.id,
            content: card.frontText,
            unlockedAt: new Date().toISOString(),
            source: "group_card_pack",
            groupId: group,
          })),
      ];
    })();

    applyGroupLock(lockedSelectedIds, { showMessage: false });
    setUnlockedCards(nextCards);
    setMessage(
      "已鎖定三張卡牌！其餘卡牌正在翻成背面並消失，同組成員也會同步看到效果。",
    );
    onActivityLog?.({
      eventType: "card_pack_lock",
      eventLabel: "鎖定石虎卡包三張卡牌",
      targetType: "role_card_pack",
      targetId: group,
      newValue: {
        selectedCardIds: lockedSelectedIds,
        reason: trimmedLockReason,
      },
      metadata: {
        groupId: group,
        cards: selectedCards,
        reason: trimmedLockReason,
      },
    });

    try {
      const lockData = await saveGroupCardPackLock(token, {
        selectedCardIds: lockedSelectedIds,
        reason: trimmedLockReason,
      });
      const serverLockedAt = lockData?.lock?.lockedAt
        ? String(lockData.lock.lockedAt)
        : null;
      if (serverLockedAt) {
        lastAppliedLockAtRef.current = serverLockedAt;
        lastAppliedLockSignatureRef.current = createLockSignature(
          group,
          lockedSelectedIds,
          serverLockedAt,
        );
      }

      await saveInquiryCards(token, nextCards);
    } catch (error) {
      console.error("儲存卡包卡牌失敗：", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "卡牌已在畫面鎖定，但同步伺服器失敗，請稍後再試。",
      );
    }
  }

  return (
    <main className="game-adventure-page uiux-page-shell relative min-h-screen overflow-x-hidden px-3 py-3 text-white sm:px-6 sm:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(252,211,77,0.22),transparent_26%),radial-gradient(circle_at_18%_72%,rgba(34,197,94,0.16),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(125,211,252,0.16),transparent_34%)]" />
      {energyBurstActive ? (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0] }}
            transition={{ duration: 0.45 }}
          />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-amber-100/80"
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 5.2, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 opacity-35 bg-[linear-gradient(120deg,transparent_0_12px,rgba(255,255,255,0.06)_13px,transparent_14px)] bg-[size:36px_36px]" />

      <div className="relative z-20 mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr] items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black tracking-[0.12em] text-black/85 backdrop-blur transition hover:bg-white/16"
        >
          <ArrowLeft className="h-4 w-4" /> 回首頁
        </button>

        <h1 className="justify-self-center rounded-[28px] border border-white/28 bg-black/34 px-4 py-2 text-center font-serif text-2xl font-black tracking-[0.08em] text-white shadow-[0_10px_34px_rgba(0,0,0,0.32),0_0_28px_rgba(255,255,255,0.12)] backdrop-blur-sm sm:px-5 sm:py-3 sm:text-5xl lg:text-6xl">
          {isOpened ? meta.title : "角色卡包"}
        </h1>

        <div className="hidden w-[104px] sm:block" aria-hidden="true" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-72px)] w-full max-w-6xl flex-col items-center justify-start gap-4 pb-3 pt-4">
        {!isOpened ? (
          <div className="flex w-full flex-col items-center gap-5">
            <p className="rounded-full border border-cyan-100/30 bg-white/10 px-5 py-2 text-center text-sm font-black tracking-[0.12em] text-cyan-50 shadow-[0_0_30px_rgba(125,211,252,0.18)] backdrop-blur">
              請開啟自己組別的發光卡包；其他組別卡包只能觀看，不能滑開。
            </p>

            {message ? (
              <p className="rounded-full border border-amber-100/60 bg-amber-50/92 px-5 py-2 text-center text-sm font-black tracking-[0.08em] text-[#4a2d12] shadow-[0_0_28px_rgba(251,191,36,0.25)]">
                {message}
              </p>
            ) : null}

            <div className="uiux-pack-grid max-w-6xl">
              {GROUP_ORDER.map((packKey) => {
                const packMeta = GROUP_PACK_META[packKey];
                const isOwnPack = packKey === group;
                const isDeniedPack = deniedPackId === packKey;
                const packOpenProgress = isOwnPack ? openProgress : 0;

                return (
                  <motion.div
                    key={packKey}
                    animate={
                      isDeniedPack
                        ? { x: [0, -12, 11, -9, 7, -4, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.42 }}
                    className="relative flex min-h-[min(78vw,440px)] flex-col items-center justify-center border-0 border-transparent bg-transparent p-2 shadow-none outline-none ring-0"
                  >
                    <motion.div
                      className="relative h-[min(58vw,360px)] w-[min(76vw,282px)] overflow-visible border-0 border-transparent bg-transparent shadow-none outline-none ring-0 transition"
                      aria-label={`${packMeta.title}外包裝`}
                      animate={{ y: 0, rotate: 0 }}
                      transition={{ duration: 0 }}
                    >
                      {isOwnPack ? (
                        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[82%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(253,224,71,0.34),rgba(34,197,94,0.20)_58%,transparent_76%)] blur-2xl" />
                      ) : null}

                      {!isOwnPack ? (
                        <div className="absolute inset-0 z-10 overflow-visible border-0 border-transparent bg-transparent shadow-none outline-none ring-0">
                          <img
                            src={packMeta.coverImage}
                            alt={`${packMeta.title}封面`}
                            className="h-full w-full object-contain [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.26))]"
                            draggable={false}
                          />
                        </div>
                      ) : null}

                      {isOwnPack ? (
                        <>
                          <motion.div
                            className="pointer-events-none absolute left-1/2 top-[24%] z-30 h-[2px] w-[90%] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_22px_rgba(255,255,255,0.95),0_0_48px_rgba(125,211,252,0.82)]"
                            animate={{
                              scaleX: isCuttingPack
                                ? 1.08
                                : Math.max(0.08, packOpenProgress),
                              opacity:
                                packOpenProgress > 0 || isCuttingPack ? 1 : 0.7,
                            }}
                            style={{ transformOrigin: "center" }}
                          />
                          <motion.div
                            className="pointer-events-none absolute left-1/2 top-[24%] z-30 h-12 w-[92%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.70),rgba(125,211,252,0.30)_36%,transparent_72%)] blur-md"
                            animate={{
                              opacity:
                                packOpenProgress > 0
                                  ? 0.38 + packOpenProgress * 0.55
                                  : 0.2,
                            }}
                          />
                          <motion.div
                            className="pointer-events-none absolute left-1/2 top-[24%] z-30 h-[3px] w-[90%] -translate-x-1/2 rounded-full bg-black/30"
                            animate={{
                              opacity: isCuttingPack
                                ? 1
                                : packOpenProgress > 0.18
                                  ? packOpenProgress
                                  : 0,
                              scaleX: isCuttingPack ? 1 : packOpenProgress,
                            }}
                          />
                        </>
                      ) : null}

                      <div
                        role="button"
                        tabIndex={0}
                        onPointerDown={
                          isOwnPack
                            ? handleLightBarPointerDown
                            : () => handleUnauthorizedPackAttempt(packKey)
                        }
                        onPointerMove={
                          isOwnPack ? handleLightBarPointerMove : undefined
                        }
                        onPointerUp={
                          isOwnPack ? handleLightBarPointerUp : undefined
                        }
                        onPointerCancel={
                          isOwnPack ? handleLightBarPointerUp : undefined
                        }
                        onClick={() => openPackForGroup(packKey)}
                        className={`absolute inset-0 z-40 touch-none outline-none ${
                          isOwnPack ? "cursor-ew-resize" : "cursor-not-allowed"
                        }`}
                        aria-label={
                          isOwnPack
                            ? "左右滑動光條切開自己的卡包"
                            : "沒有權限開啟此卡包"
                        }
                      >
                        {isOwnPack ? (
                          <div className="absolute left-4 right-4 top-[calc(24%-16px)] h-8 rounded-full bg-transparent">
                            <motion.div
                              className="absolute top-1/2 h-10 w-16 -translate-y-1/2 rounded-full bg-white/82 shadow-[0_0_22px_rgba(255,255,255,0.95),0_0_46px_rgba(125,211,252,0.88)]"
                              animate={{
                                left: `calc(${packOpenProgress * 100}% - 32px)`,
                                opacity: packOpenProgress > 0 ? 1 : 0.72,
                              }}
                              transition={{ duration: 0.08 }}
                            />
                          </div>
                        ) : null}
                      </div>

                      {isOwnPack ? (
                        <motion.div
                          className="pointer-events-none absolute -inset-y-8 inset-x-0 z-20 overflow-visible"
                          animate={
                            isCuttingPack
                              ? { scale: 1.025, opacity: 0.9 }
                              : { scale: 1, opacity: 1 }
                          }
                          transition={{
                            duration: 0.65,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        >
                          <motion.img
                            src={packMeta.coverImage}
                            alt={`${packMeta.title}封面`}
                            className="h-[calc(100%-64px)] w-full object-contain [filter:drop-shadow(0_0_28px_rgba(253,224,71,0.72))_drop-shadow(0_18px_24px_rgba(0,0,0,0.28))]"
                            style={{ marginTop: 32 }}
                            draggable={false}
                            animate={{ opacity: isCuttingPack ? 0 : 1 }}
                            transition={{ duration: 0.16 }}
                          />
                          <motion.div
                            className="pointer-events-none absolute inset-x-0 top-8 h-[calc(100%-64px)] overflow-hidden opacity-80"
                            style={{
                              WebkitMaskImage: `url(${packMeta.coverImage})`,
                              maskImage: `url(${packMeta.coverImage})`,
                              WebkitMaskRepeat: "no-repeat",
                              maskRepeat: "no-repeat",
                              WebkitMaskPosition: "center",
                              maskPosition: "center",
                              WebkitMaskSize: "contain",
                              maskSize: "contain",
                            }}
                            animate={{ opacity: isCuttingPack ? 0 : 0.82 }}
                            transition={{ duration: 0.16 }}
                          >
                            <motion.div
                              className="absolute -top-1/4 h-[150%] w-[28%] -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),rgba(255,255,255,0.72),rgba(255,245,157,0.38),transparent)]"
                              initial={{ x: "-180%" }}
                              animate={{ x: ["-180%", "460%"] }}
                              transition={{
                                duration: 2.6,
                                repeat: Infinity,
                                repeatDelay: 0.55,
                                ease: "linear",
                              }}
                            />
                          </motion.div>
                          <motion.div
                            className="pointer-events-none absolute inset-x-0 top-8 h-[calc(100%-64px)] bg-contain bg-center bg-no-repeat"
                            style={{
                              backgroundImage: `url(${packMeta.coverImage})`,
                              clipPath: "polygon(0 0, 100% 0, 100% 24%, 0 24%)",
                              transformOrigin: "50% 24%",
                              filter:
                                "drop-shadow(0 18px 24px rgba(0,0,0,0.30))",
                            }}
                            initial={false}
                            animate={
                              isCuttingPack
                                ? {
                                    opacity: 1,
                                    y: -18,
                                    rotate: -1.6,
                                    scale: 1.012,
                                  }
                                : { opacity: 0, y: 0, rotate: 0, scale: 1 }
                            }
                            transition={{
                              duration: 0.54,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                          <motion.div
                            className="pointer-events-none absolute inset-x-0 top-8 h-[calc(100%-64px)] bg-contain bg-center bg-no-repeat"
                            style={{
                              backgroundImage: `url(${packMeta.coverImage})`,
                              clipPath:
                                "polygon(0 24%, 100% 24%, 100% 100%, 0 100%)",
                              transformOrigin: "50% 24%",
                              filter:
                                "drop-shadow(0 18px 24px rgba(0,0,0,0.30))",
                            }}
                            initial={false}
                            animate={
                              isCuttingPack
                                ? {
                                    opacity: 1,
                                    y: 18,
                                    rotate: 1.1,
                                    scale: 1.012,
                                  }
                                : { opacity: 0, y: 0, rotate: 0, scale: 1 }
                            }
                            transition={{
                              duration: 0.54,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          />
                          <motion.div
                            className="pointer-events-none absolute left-1/2 top-[calc(24%+8px)] h-[12px] w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 shadow-[0_0_18px_rgba(255,255,255,0.52)]"
                            initial={false}
                            animate={{
                              opacity: isCuttingPack
                                ? 0.95
                                : packOpenProgress > 0.2
                                  ? packOpenProgress * 0.42
                                  : 0,
                              scaleX: isCuttingPack
                                ? 1
                                : Math.max(0.05, packOpenProgress),
                            }}
                            transition={{ duration: 0.18 }}
                            style={{ transformOrigin: "center" }}
                          />
                          <motion.div
                            className="pointer-events-none absolute left-1/2 top-[calc(24%+8px)] h-[28px] w-[96%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72),rgba(125,211,252,0.28)_36%,transparent_70%)] blur-sm"
                            initial={false}
                            animate={{
                              opacity: isCuttingPack ? [0, 0.9, 0.18] : 0,
                            }}
                            transition={{ duration: 0.48 }}
                          />
                        </motion.div>
                      ) : null}

                      {isOwnPack && isLaunchingCards ? (
                        <div className="pointer-events-none absolute inset-0 z-[70] overflow-visible [transform:translateZ(0)]">
                          <motion.div
                            className="absolute left-1/2 top-[56%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/35 bg-cyan-100/18"
                            initial={{ scale: 0.12, opacity: 0 }}
                            animate={{
                              scale: [0.12, 1.05, 1.72, 2.35],
                              opacity: [0, 0.9, 0.42, 0],
                            }}
                            transition={{
                              duration: 1.55,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                          <motion.div
                            className="absolute left-1/2 top-[56%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-[16px] border-amber-100/30"
                            initial={{ scale: 0.04, rotate: 0, opacity: 0 }}
                            animate={{
                              scale: [0.04, 1.18, 2.05],
                              rotate: [0, 180, 360],
                              opacity: [0, 0.75, 0],
                            }}
                            transition={{ duration: 1.65, ease: "easeOut" }}
                          />
                          {cards.map((card, index) => {
                            const angle =
                              (index / Math.max(cards.length, 1)) *
                                Math.PI *
                                2 -
                              Math.PI / 2;
                            const targetX =
                              Math.cos(angle) * (220 + (index % 3) * 18);
                            const targetY =
                              Math.sin(angle) * (182 + (index % 2) * 16);
                            const overshootX =
                              Math.cos(angle) * (275 + (index % 3) * 22);
                            const overshootY =
                              Math.sin(angle) * (230 + (index % 2) * 18);
                            const delay = index * 0.055;

                            return (
                              <motion.div
                                key={`launch-${card.id}`}
                                className={`absolute left-1/2 top-[58%] h-36 w-24 -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-white/70 bg-gradient-to-br ${meta.cardFace} shadow-[0_10px_24px_rgba(0,0,0,0.30)] will-change-transform`}
                                initial={{
                                  x: -42,
                                  y: -52,
                                  scale: 0.1,
                                  rotate: -28 + index * 7,
                                  opacity: 0,
                                }}
                                animate={{
                                  x: [0, overshootX, targetX],
                                  y: [-16, overshootY, targetY],
                                  scale: [0.08, 1.32, 1.08],
                                  rotate: [
                                    -28 + index * 7,
                                    420 + index * 38,
                                    -26 + index * 10,
                                  ],
                                  opacity: [0, 1, 1, 0],
                                }}
                                transition={{
                                  duration: 1.24,
                                  delay,
                                  ease: [0.16, 1, 0.3, 1],
                                  times: [0, 0.54, 0.82, 1],
                                }}
                              >
                                <div className="absolute inset-1 rounded-[13px] border border-white/50 bg-white/18" />
                                <div className="absolute inset-x-3 top-4 h-2 rounded-full bg-white/60" />
                                <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/25" />
                                <div className="absolute inset-x-4 bottom-4 h-8 rounded-lg bg-white/25" />
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : null}

                      {isOwnPack ? (
                        <motion.div
                          className="pointer-events-none absolute inset-0 z-50 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.92),rgba(125,211,252,0.34)_24%,transparent_56%)]"
                          animate={{
                            opacity: isCuttingPack ? [0, 1, 0.12] : 0,
                          }}
                          transition={{ duration: 0.72 }}
                        />
                      ) : null}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-full">
            <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-[28px] border border-white/45 bg-[#fffaf0]/92 px-4 py-4 text-[#2f251c] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row">
              <div>
                <p className="text-xs font-black tracking-[0.28em] text-[#846b31]">
                  SELECT THREE CARDS
                </p>
                <p className="mt-1 text-lg font-black text-[#2f251c]">
                  已選擇 {selectedIds.length} / 3 張
                </p>
                {!isGroupLeader ? (
                  <p className="mt-1 text-xs font-bold text-[#6b5a44]">
                    你可以翻看與選牌，但只有組長可以鎖定。
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {message ? (
                  <span className="rounded-full border border-[#d8c79f] bg-white px-3 py-2 text-xs font-black text-[#4a3828] shadow-sm">
                    {message}
                  </span>
                ) : null}
                <button
                  type="button"
                  data-lock-button="true"
                  onClick={requestLockSelection}
                  disabled={!canLock}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-yellow-100 bg-[linear-gradient(135deg,#fde047,#f59e0b)] px-6 py-3 text-sm font-black tracking-[0.14em] text-[#2f1600] shadow-[0_0_0_3px_rgba(255,255,255,0.55),0_0_34px_rgba(250,204,21,0.58),0_14px_34px_rgba(120,53,15,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-none disabled:bg-white/12 disabled:text-white/38 disabled:shadow-none disabled:hover:translate-y-0"
                >
                  <Lock className="h-4 w-4" /> 鎖定
                </button>
              </div>
            </div>

            <div
              ref={wheelStageRef}
              className="relative mx-auto w-full max-w-[min(94vw,760px)] cursor-grab touch-none select-none overflow-hidden rounded-[clamp(26px,5vw,42px)] border border-white/10 bg-white/[0.035] shadow-[inset_0_0_80px_rgba(255,255,255,0.04)] active:cursor-grabbing"
              style={{
                height: "clamp(360px, min(82vw, calc(100vh - 250px)), 680px)",
              }}
              onPointerDown={handleWheelPointerDown}
              onPointerMove={handleWheelPointerMove}
              onPointerUp={handleWheelPointerUp}
              onPointerCancel={handleWheelPointerUp}
              aria-label="卡牌轉盤空白區，左右滑動可以旋轉整組卡牌"
            >
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full ${meta.stageGlow}`}
              />

              {cards.map((card, index) => {
                if (hiddenCardIds.includes(card.id)) return null;

                const selected = selectedIds.includes(card.id);
                const selectedOrderIndex = selectedIds.indexOf(card.id);
                const flipped = flippedIds.has(card.id);
                const shouldCenterLockedCard =
                  isLocked && selected && selectedOrderIndex >= 0;
                const orbitAngle = wheelRotation + index * (360 / cards.length);
                const angleRad = ((orbitAngle - 90) * Math.PI) / 180;
                const orbitX = Math.cos(angleRad) * wheelMetrics.radius;
                const orbitY = Math.sin(angleRad) * wheelMetrics.radius;
                const centerSpacing = Math.min(
                  wheelMetrics.cardWidth + 34,
                  Math.max(
                    96,
                    (wheelStageSize.width - wheelMetrics.cardWidth - 40) / 2,
                  ),
                );
                const lockedX = (selectedOrderIndex - 1) * centerSpacing;
                const x = shouldCenterLockedCard ? lockedX : orbitX;
                const y = shouldCenterLockedCard ? 0 : orbitY;
                const mainTextSize = Math.round(
                  Math.max(13, Math.min(17, wheelMetrics.cardWidth * 0.112)),
                );
                const titleTextSize = Math.round(
                  Math.max(10, Math.min(12, wheelMetrics.cardWidth * 0.078)),
                );
                const shouldShowCrispText =
                  !flipped && cardSwipePreview.cardId !== card.id;
                return (
                  <div
                    key={card.id}
                    className="absolute left-1/2 top-1/2 transition-transform duration-500 ease-out"
                    style={{
                      zIndex: shouldCenterLockedCard
                        ? 40 + selectedOrderIndex
                        : 10,
                      width: `${wheelMetrics.cardWidth}px`,
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    }}
                  >
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -220,
                        scale: 0.52,
                        rotate: -18 + index * 4,
                        rotateY: 0,
                      }}
                      animate={
                        disappearingCardIds.includes(card.id)
                          ? {
                              opacity: fadingCardIds.includes(card.id) ? 0 : 1,
                              y: -42,
                              scale: 0.62,
                              rotate: 12 + index * 4,
                              rotateY: 180,
                            }
                          : shouldCenterLockedCard
                            ? {
                                opacity: 1,
                                y: 0,
                                scale: 1.08,
                                rotate: 0,
                                rotateY: 0,
                              }
                            : {
                                opacity: 1,
                                y: 0,
                                scale: 1,
                                rotate: 0,
                                rotateY: 0,
                              }
                      }
                      transition={{
                        delay: disappearingCardIds.includes(card.id)
                          ? 0
                          : shouldCenterLockedCard
                            ? 0.2 + selectedOrderIndex * 0.14
                            : index * 0.09,
                        type: "spring",
                        stiffness: 210,
                        damping: 17,
                      }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div className="relative">
                        {selected ? (
                          <>
                            <div className="pointer-events-none absolute -inset-3 rounded-[30px] bg-[conic-gradient(from_90deg,rgba(255,255,255,0.15),#facc15,#fff7ad,#f59e0b,#ffffff,#facc15,rgba(255,255,255,0.15))] opacity-100 blur-[1px]" />
                            <div className="pointer-events-none absolute -inset-1.5 z-10 rounded-[27px] border-[5px] border-yellow-300 shadow-[0_0_0_3px_rgba(255,255,255,0.92),0_0_30px_rgba(250,204,21,0.95),0_0_70px_rgba(245,158,11,0.42)]" />
                          </>
                        ) : null}
                        <button
                          type="button"
                          data-card-button="true"
                          onPointerDown={(event) =>
                            handleCardPointerDown(event, card.id)
                          }
                          onPointerMove={(event) =>
                            handleCardPointerMove(event, card.id)
                          }
                          onPointerUp={() => handleCardPointerUp(card.id)}
                          onPointerCancel={() => handleCardPointerUp(card.id)}
                          onClick={() => handleCardClick(card.id)}
                          disabled={isLocked}
                          className={`group relative block aspect-[3/4] w-full touch-pan-y overflow-hidden rounded-[24px] border p-[clamp(3px,1.2vmin,7px)] text-left transition ${selected ? "border-yellow-200 shadow-[0_0_0_4px_rgba(250,204,21,0.62),0_0_36px_rgba(253,224,71,0.92),0_0_90px_rgba(255,255,255,0.28)]" : "border-white/35 shadow-[0_18px_44px_rgba(0,0,0,0.28),0_0_22px_rgba(255,255,255,0.12)] hover:-translate-y-1"} disabled:cursor-default`}
                        >
                          <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-70">
                            <div className="absolute left-[10%] top-[10%] h-[clamp(4px,1.2vw,6px)] w-[clamp(4px,1.2vw,6px)] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.95)]" />
                            <div className="absolute right-[14%] top-[32%] h-[clamp(5px,1.5vw,8px)] w-[clamp(5px,1.5vw,8px)] rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.95)]" />
                            <div className="absolute bottom-[12%] left-[33%] h-[clamp(4px,1.2vw,6px)] w-[clamp(4px,1.2vw,6px)] rounded-full bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
                          </div>
                          <div className="h-full w-full overflow-hidden rounded-[20px] [perspective:1200px]">
                            <motion.div
                              animate={{
                                rotateY:
                                  (flipped ? 180 : 0) +
                                  (cardSwipePreview.cardId === card.id
                                    ? (cardSwipePreview.offsetX / 90) * 72
                                    : 0),
                              }}
                              transition={{
                                duration:
                                  cardSwipePreview.cardId === card.id
                                    ? 0
                                    : 0.58,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="card-pack-card-rotator relative h-full w-full min-h-0 min-w-0 [transform-style:preserve-3d]"
                            >
                              <div
                                className={`card-pack-card-face absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] border border-white/70 bg-gradient-to-br ${meta.cardFace} p-[clamp(5px,1.5vmin,10px)] ${meta.cardText} shadow-[inset_0_0_24px_rgba(255,255,255,0.34)] [backface-visibility:hidden]`}
                              >
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_22%),radial-gradient(circle_at_82%_86%,rgba(255,255,255,0.34),transparent_26%)]" />
                                <div className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 rotate-12 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.70),transparent)] opacity-60 transition-transform duration-700 group-hover:translate-x-[420%]" />
                                <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[clamp(10px,2.4vmin,18px)] bg-white/62 px-[clamp(4px,1.35vmin,8px)] py-[clamp(4px,1.35vmin,8px)] text-center shadow-sm">
                                  <p
                                    className="card-pack-card-front-text max-h-full max-w-full select-none overflow-hidden break-words text-center text-[clamp(0.52rem,2.05vmin,0.86rem)] font-black leading-[1.22] opacity-0 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8]"
                                    aria-hidden="true"
                                  >
                                    {card.frontText}
                                  </p>
                                </div>
                                <div className="relative z-10 mt-[clamp(3px,1.1vmin,7px)] flex h-[clamp(18px,4.1vmin,26px)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/58 px-[clamp(4px,1.25vmin,8px)]">
                                  <p
                                    className={`card-pack-card-front-text w-full select-none truncate text-center text-[clamp(0.46rem,1.55vmin,0.66rem)] font-black tracking-[0.08em] opacity-0 ${meta.cardMutedText}`}
                                    aria-hidden="true"
                                  >
                                    {card.title}
                                  </p>
                                </div>
                              </div>
                              <div className="card-pack-card-face card-pack-card-back-face absolute inset-0 overflow-hidden rounded-[20px] border border-white/30 bg-stone-900 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[20px]">
                                  <img
                                    src={CARD_BACK_IMAGE}
                                    alt="石虎卡牌背面"
                                    className="card-pack-back-image h-full w-full object-contain"
                                    draggable={false}
                                  />
                                </div>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.32),transparent_35%)]" />
                              </div>
                            </motion.div>
                          </div>

                          <motion.div
                            className={`card-pack-card-crisp-text pointer-events-none absolute z-30 rounded-[20px] ${meta.cardText}`}
                            initial={false}
                            animate={{ opacity: shouldShowCrispText ? 1 : 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            style={{
                              inset:
                                "calc(clamp(3px, 1.2vmin, 7px) + clamp(5px, 1.5vmin, 10px))",
                              WebkitFontSmoothing: "antialiased",
                              MozOsxFontSmoothing: "grayscale",
                              textRendering: "geometricPrecision",
                            }}
                          >
                            <div
                              className="absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden rounded-[clamp(10px,2.4vmin,18px)] bg-transparent px-[clamp(4px,1.35vmin,8px)] py-[clamp(4px,1.35vmin,8px)] text-center"
                              style={{
                                bottom:
                                  "calc(clamp(18px,4.1vmin,26px) + clamp(3px,1.1vmin,7px))",
                              }}
                            >
                              <p
                                className="max-h-full max-w-full overflow-hidden break-words text-center font-black [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8]"
                                style={{
                                  fontSize: `${mainTextSize}px`,
                                  lineHeight: 1.22,
                                }}
                              >
                                {card.frontText}
                              </p>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 flex h-[clamp(18px,4.1vmin,26px)] items-center justify-center overflow-hidden rounded-full bg-transparent px-[clamp(4px,1.25vmin,8px)]">
                              <p
                                className={`w-full truncate text-center font-black tracking-[0.08em] ${meta.cardMutedText}`}
                                style={{ fontSize: `${titleTextSize}px` }}
                              >
                                {card.title}
                              </p>
                            </div>
                          </motion.div>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {showLockConfirmDialog ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="確認送出鎖定卡牌"
          onClick={() => setShowLockConfirmDialog(false)}
        >
          <div
            className="w-full max-w-3xl rounded-[34px] border border-[#ead7a7] bg-[#fff8e6] p-6 text-center text-[#332417] shadow-[0_28px_90px_rgba(59,35,13,0.28),0_0_54px_rgba(251,191,36,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-2xl shadow-[0_0_30px_rgba(251,191,36,0.25)]">
              🔒
            </div>

            <h2 className="text-2xl font-black tracking-[0.08em] text-[#3f2412]">
              確認送出鎖定卡牌？
            </h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-[#6b4b2f]">
              鎖定後會將這三張卡牌同步給所有組員。確定要鎖定目前選擇的三張卡牌嗎？
            </p>

            <div className="mt-5 grid max-h-[44vh] gap-3 overflow-y-auto rounded-[26px] border border-amber-200 bg-white/72 p-3 text-left shadow-inner md:grid-cols-3">
              {selectedCards.map((card) => (
                <div
                  key={card.id}
                  className={`overflow-hidden rounded-[22px] border border-white/75 bg-gradient-to-br ${meta.cardFace} p-3 shadow-[0_10px_24px_rgba(120,53,15,0.12)]`}
                >
                  <div className="mb-2">
                    <span className={`text-sm font-black ${meta.cardText}`}>
                      {card.title}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-3 py-3 shadow-sm">
                    <p
                      className={`text-sm font-black leading-6 ${meta.cardText}`}
                    >
                      {card.frontText}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <textarea
              value={lockReason}
              onChange={(event) => setLockReason(event.target.value)}
              placeholder="請輸入至少 20 字，說明為什麼選擇這三張牌..."
              className="mt-5 h-32 w-full rounded-2xl border-2 border-amber-200 bg-white p-4 text-sm font-bold text-[#3f3023] outline-none placeholder:text-[#9a7a55] focus:border-amber-400 focus:ring-4 focus:ring-amber-200/55"
            />

            <p
              className={`mt-2 text-xs font-bold tracking-[0.12em] ${trimmedLockReason.length >= 20 ? "text-emerald-700" : "text-amber-700"}`}
            >
              目前字數：{trimmedLockReason.length} / 至少 20 字
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowLockConfirmDialog(false)}
                className="rounded-2xl border border-[#d8c79f] bg-white px-4 py-3 text-sm font-black tracking-[0.12em] text-[#5b4630] transition hover:bg-[#fff1d4]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={lockSelection}
                disabled={!canConfirmLock}
                className="rounded-2xl border border-amber-300 bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black tracking-[0.12em] text-[#3f2412] shadow-[0_0_28px_rgba(251,191,36,0.34)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-none disabled:bg-stone-100 disabled:text-stone-400 disabled:shadow-none disabled:hover:translate-y-0"
              >
                確認送出鎖定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
