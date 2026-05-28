/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 CardPackPage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { saveInquiryCards } from "../api/inquiryApi";
import { subscribeRealtime } from "../api/realtime";
import {
  getCardPackCurrentUser,
  getGroupCardPackLock,
  saveGroupCardPackLock,
} from "../api/cardPackApi";

import {
  areSameCardIdSet,
  buildPackCards,
  CARD_BACK_IMAGE,
  createLockSignature,
  GROUP_ORDER,
  GROUP_PACK_META,
  normalizeCardId,
  preloadCardPackImages,
  readCardPackUiState,
  resolveGroup,
  saveCardPackUiState,
} from "../features/cardPack/cardPackModel";
import { CardPackLockConfirmDialog } from "../features/cardPack/CardPackLockConfirmDialog";
import { CardPackPageHeader } from "../features/cardPack/CardPackPageHeader";
import { CardPackVisualEffects } from "../features/cardPack/CardPackVisualEffects";
import type {
  CardPackPageProps,
  GroupCardPackLock,
  GroupKey,
  UnlockedCardData,
  User,
} from "../features/cardPack/cardPackModel";
export default function CardPackPage({
  token,
  currentUser,
  unlockedCards,
  setUnlockedCards,
  realtimeLockSignal,
  onBack,
  onActivityLog,
}: CardPackPageProps) {
  useEffect(() => {
    preloadCardPackImages();
  }, []);
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
  const [isLockSubmitting, setIsLockSubmitting] = useState(false);
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
  const canLock = isGroupLeader && selectedIds.length === 3 && !isLocked && !isLockSubmitting;
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
      lockAnimationTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
      lockAnimationTimeoutsRef.current = [];
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
    options: {
      showMessage?: boolean;
      autoOpenIfLocked?: boolean;
      resetIfUnlocked?: boolean;
    } = {},
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

      if (!lock || !lockedAt || selectedCardIds.length !== 3) {
        if (options.resetIfUnlocked && isLockedRef.current) {
          resetGroupLock({ showMessage: options.showMessage !== false });
        }
        return null;
      }

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


  function handleRealtimeGroupCardPackEvent(payload: unknown) {
    const data = (payload || {}) as {
      groupId?: unknown;
      lock?:
        | {
            selectedCardIds?: unknown[];
            lockedAt?: unknown;
          }
        | null;
    };
    const eventGroup = data.groupId ? resolveGroup(String(data.groupId)) : null;

    if (!data.lock) {
      // 教師解除單組鎖定時只重置該組；解除全部鎖定時 groupId 會是 null，全部卡包頁都要回到九張牌。
      if (!eventGroup || eventGroup === group) {
        resetGroupLock({ showMessage: true });
      }
      return;
    }

    if (eventGroup && eventGroup !== group) return;

    const selectedCardIds = Array.isArray(data.lock.selectedCardIds)
      ? data.lock.selectedCardIds.map(String)
      : [];
    const lockedAt = data.lock.lockedAt ? String(data.lock.lockedAt) : "";
    if (selectedCardIds.length !== 3 || !lockedAt) return;

    queueOrApplyIncomingGroupLock(
      eventGroup || group,
      selectedCardIds,
      lockedAt,
      {
        showMessage: true,
        autoOpenIfLocked: !isGroupLeader,
        allowGroupSwitch: false,
      },
    );
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
      setMessage("組長已鎖定本組三張卡牌，畫面已同步只保留最終卡牌。");
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

    if (
      isLockedRef.current &&
      areSameCardIdSet(selectedIdsRef.current, normalizedIds)
    ) {
      if (shouldShowMessage && !message.includes("已同步只保留最終卡牌")) {
        setMessage("組長已鎖定本組三張卡牌，畫面已同步只保留最終卡牌。");
      }
      return;
    }

    // 組員端收到組長鎖定時，無論目前停在封面或正在開包，都要同步進入
    //「開包動畫完成後只留下三張最終卡」的狀態。
    if (
      !isGroupLeader &&
      (!isOpenedRef.current ||
        isCuttingPackRef.current ||
        isLaunchingCardsRef.current)
    ) {
      pendingGroupLockIdsRef.current = normalizedIds;
      pendingGroupLockShouldMessageRef.current = shouldShowMessage;
      if (shouldShowMessage) {
        setMessage("組長已鎖定本組三張卡，正在同步開啟並套用最終決策卡。");
      }
      if (!isOpenedRef.current && !isCuttingPackRef.current && !isLaunchingCardsRef.current) {
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
    setIsLockSubmitting(false);
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
        const data = await getGroupCardPackLock(token, { cache: "no-store" });
        const lock = data?.lock as GroupCardPackLock | null | undefined;
        const selectedCardIds = Array.isArray(lock?.selectedCardIds)
          ? lock.selectedCardIds.map(String)
          : [];
        const lockedAt = lock?.lockedAt ? String(lock.lockedAt) : "";

        if (cancelled) return;
        if (!lock || !lockedAt || selectedCardIds.length !== 3) {
          if (isLockedRef.current) {
            resetGroupLock({ showMessage: true });
          }
          return;
        }
        const lockGroupId = lock?.groupId ? String(lock.groupId) : null;
        queueOrApplyIncomingGroupLock(lockGroupId, selectedCardIds, lockedAt, {
          showMessage: true,
          autoOpenIfLocked: !isGroupLeader,
          allowGroupSwitch: true,
        });
      } catch (error) {
        console.error("同步小組卡包鎖定狀態失敗：", error);
      } finally {
        syncGroupLockInFlightRef.current = false;
      }
    }

    syncGroupLock();
    // 鎖定/解鎖以 SSE 即時推送為主；備援輪詢只保留低頻校正，
    // 避免卡包頁在多人同時操作時產生過多 API 請求。
    intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") syncGroupLock();
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") syncGroupLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
    // 這個備援輪詢只跟 token / 組別 / 組長身分有關，避免動畫狀態變動時重建 interval。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, group, isGroupLeader]);

  // 卡包頁本身也直接訂閱卡包鎖定事件，讓正在卡包頁的組員不必依賴首頁轉發。
  // 同一筆鎖定仍會用 signature 去重，所以首頁轉發和本頁直連同時到達也只會播放一次動畫。
  useEffect(() => {
    if (!token) return;

    return subscribeRealtime(token, (event) => {
      if (event.type !== "group-card-pack-lock") return;
      handleRealtimeGroupCardPackEvent(event.payload);
    });
    // SSE 連線只跟 token 綁定；group / isGroupLeader 變動時，事件處理函式會讀最新 render 的值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 首頁也會轉發卡包鎖定事件；保留這條路徑，讓未來若卡包頁直連失敗仍可補同步。

  useEffect(() => {
    if (!realtimeLockSignal) return;

    handleRealtimeGroupCardPackEvent(
      {
        groupId: realtimeLockSignal.groupId,
        lock: realtimeLockSignal.lock,
      },
    );
    // 首頁全域 SSE 通道收到組長鎖定 / 教師解鎖後，直接推進目前卡包頁狀態。
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
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleWheelPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = wheelDragRef.current;
    if (!drag) return;

    const now = event.timeStamp;
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
      void syncGroupLockNow({ showMessage: true, autoOpenIfLocked: true });
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
    if (!isOpened || isLocked || isLockSubmitting) return;
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

    if (!canLock || isLockSubmitting) return;

    setShowLockConfirmDialog(true);
  }

  async function lockSelection() {
    if (!isGroupLeader) {
      setMessage("只有組長可以鎖定卡牌。");
      return;
    }
    if (!canLock || isLockSubmitting) return;

    const reasonForSave = lockReason.trim();
    if (reasonForSave.length < 20) {
      setMessage("鎖定理由至少需要 20 個字。");
      return;
    }

    const lockedSelectedIds = [...selectedIds];
    const lockedSelectedCards = cards.filter((card) =>
      lockedSelectedIds.includes(card.id),
    );
    if (lockedSelectedIds.length !== 3 || lockedSelectedCards.length !== 3) {
      setMessage("請確認已選滿三張卡牌後再送出。");
      return;
    }

    setShowLockConfirmDialog(false);
    setIsLockSubmitting(true);
    setMessage("正在送出鎖定結果，請稍候⋯⋯");

    try {
      const lockData = await saveGroupCardPackLock(token, {
        selectedCardIds: lockedSelectedIds,
        reason: reasonForSave,
      });
      const serverLockedAt = lockData?.lock?.lockedAt
        ? String(lockData.lock.lockedAt)
        : new Date().toISOString();

      lastAppliedLockAtRef.current = serverLockedAt;
      lastAppliedLockSignatureRef.current = createLockSignature(
        group,
        lockedSelectedIds,
        serverLockedAt,
      );

      const nextCards: UnlockedCardData[] = (() => {
        const unlockedIdSet = new Set(unlockedCards.map(normalizeCardId));
        return [
          ...unlockedCards,
          ...lockedSelectedCards
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
      setMessage(
        "已成功鎖定三張卡牌！其餘卡牌正在翻成背面並消失，同組成員也會同步看到效果。",
      );
      onActivityLog?.({
        eventType: "card_pack_lock",
        eventLabel: "鎖定石虎卡包三張卡牌",
        targetType: "role_card_pack",
        targetId: group,
        newValue: {
          selectedCardIds: lockedSelectedIds,
          reason: reasonForSave,
        },
        metadata: {
          groupId: group,
          cards: lockedSelectedCards,
          reason: reasonForSave,
        },
      });

      try {
        await saveInquiryCards(token, nextCards);
      } catch (cardSaveError) {
        console.error("卡包卡牌已鎖定，但寫入個人卡片資料失敗，將由 pending queue 補送：", cardSaveError);
      }
    } catch (error) {
      console.error("儲存卡包鎖定失敗：", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "送出鎖定失敗，畫面仍保留九張卡牌，請確認網路後再試一次。",
      );
    } finally {
      setIsLockSubmitting(false);
    }
  }

  return (
    <main className="game-adventure-page uiux-page-shell relative min-h-screen overflow-x-hidden px-3 py-3 text-white sm:px-6 sm:py-4">
      <CardPackVisualEffects energyBurstActive={energyBurstActive} />
      <CardPackPageHeader
        isOpened={isOpened}
        packTitle={meta.title}
        onBack={onBack}
      />

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
                            loading="eager"
                            decoding="async"
                            {...({ fetchpriority: isOwnPack ? "high" : "low" } as Record<string, string>)}
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
                            loading="eager"
                            decoding="async"
                            {...({ fetchpriority: "high" } as Record<string, string>)}
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
                  disabled={!canLock || isLockSubmitting}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-yellow-100 bg-[linear-gradient(135deg,#fde047,#f59e0b)] px-6 py-3 text-sm font-black tracking-[0.14em] text-[#2f1600] shadow-[0_0_0_3px_rgba(255,255,255,0.55),0_0_34px_rgba(250,204,21,0.58),0_14px_34px_rgba(120,53,15,0.22)] transition disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-none disabled:bg-white/12 disabled:text-white/38 disabled:shadow-none"
                >
                  <Lock className="h-4 w-4" /> {isLockSubmitting ? "送出中" : "鎖定"}
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
                          className={`relative block aspect-[3/4] w-full touch-pan-y overflow-hidden rounded-[24px] border p-[clamp(3px,1.2vmin,7px)] text-left transition ${selected ? "border-yellow-200 shadow-[0_0_0_4px_rgba(250,204,21,0.62),0_0_36px_rgba(253,224,71,0.92),0_0_90px_rgba(255,255,255,0.28)]" : "border-white/35 shadow-[0_18px_44px_rgba(0,0,0,0.28),0_0_22px_rgba(255,255,255,0.12)]"} disabled:cursor-default`}
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
                                    loading="eager"
                                    decoding="async"
                                    {...({ fetchpriority: "high" } as Record<string, string>)}
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
        <CardPackLockConfirmDialog
          selectedCards={selectedCards}
          meta={meta}
          lockReason={lockReason}
          trimmedLockReasonLength={trimmedLockReason.length}
          canConfirmLock={canConfirmLock}
          onLockReasonChange={setLockReason}
          onCancel={() => setShowLockConfirmDialog(false)}
          onConfirm={lockSelection}
        />
      ) : null}
    </main>
  );
}
