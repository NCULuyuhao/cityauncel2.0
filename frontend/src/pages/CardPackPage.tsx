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
  getDecisionCardGameLiveState,
  saveDecisionCardVotes,
} from "../api/cardPackApi";
import type { DecisionCardGameState, DecisionCardVoteType } from "../api/cardPackApi";

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
  const initialCardPackUiState = useMemo(() => readCardPackUiState(currentUser.id), [currentUser.id]);
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
  const [coreCardId, setCoreCardId] = useState<string>(
    typeof initialCardPackUiState.coreCardId === "string" ? initialCardPackUiState.coreCardId : "",
  );
  const [decisionGameState, setDecisionGameState] = useState<DecisionCardGameState | null>(null);
  const [draftVotes, setDraftVotes] = useState<Record<string, DecisionCardVoteType | "">>({});
  const [selectedBoardGroupId, setSelectedBoardGroupId] = useState<GroupKey | null>(null);
  const [showAcceptedDecisionPanel, setShowAcceptedDecisionPanel] = useState(false);
  const [isVoteSubmitting, setIsVoteSubmitting] = useState(false);
  const [submittedVoteRound, setSubmittedVoteRound] = useState<number | null>(null);
  const draftVotesDirtyRef = useRef(false);
  const lastDecisionRoundRef = useRef<number | null>(null);
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
      coreCardId,
      flippedIds: Array.from(flippedIds),
      lockReason,
      wheelRotation,
      roundNo: decisionGameState?.roundNo || 1,
    });
  }, [
    currentUser.id,
    coreCardId,
    flippedIds,
    isOpened,
    lockReason,
    selectedIds,
    wheelRotation,
    decisionGameState?.roundNo,
  ]);

  const acceptedOwnCardIds = useMemo(
    () => new Set((decisionGameState?.acceptedCards || []).filter((card) => card.groupId === group).map((card) => String(card.cardId))),
    [decisionGameState?.acceptedCards, group],
  );
  const availableCards = useMemo(() => cards.filter((card) => !acceptedOwnCardIds.has(card.id)), [cards, acceptedOwnCardIds]);
  const availableCardCount = Math.max(availableCards.length, 1);
  const selectedCards = availableCards.filter((card) => selectedIds.includes(card.id));
  const trimmedLockReason = lockReason.trim();
  const canLock = isGroupLeader && selectedCards.length === 3 && selectedIds.length === 3 && !isLocked && !isLockSubmitting;
  const canConfirmLock = canLock && trimmedLockReason.length >= 20 && selectedIds.includes(coreCardId);

  useEffect(() => {
    const availableIdSet = new Set(availableCards.map((card) => card.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => availableIdSet.has(id));
      return areSameCardIdSet(prev, next) ? prev : next;
    });
    if (coreCardId && !availableIdSet.has(coreCardId)) {
      setCoreCardId("");
    }
  }, [availableCards, coreCardId]);

  const wheelMetrics = useMemo(() => {
    const width = Math.max(320, wheelStageSize.width || 320);
    const height = Math.max(360, wheelStageSize.height || 360);
    const shortest = Math.min(width, height);
    const longest = Math.max(width, height);
    const cardWidth = Math.round(
      Math.max(104, Math.min(150, shortest * 0.22, width * 0.24)),
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

    const frameId = window.requestAnimationFrame(updateSize);
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(stage);
    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [isOpened, decisionGameState?.roundNo, availableCards.length]);

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


  async function refreshDecisionGameState() {
    if (!token || isVoteSubmitting) return;
    try {
      const data = await getDecisionCardGameLiveState(token);
      setDecisionGameState(data);
      const roundNo = Number(data.roundNo) || 1;
      const ownVotes: Record<string, DecisionCardVoteType | ""> = {};
      (data.myVotes || []).forEach((vote) => {
        ownVotes[String(vote.cardId)] = vote.voteType;
      });
      const hasServerSubmission = (data.voteSubmissions || []).some(
        (submission) =>
          (Number(submission.roundNo) || 1) === roundNo &&
          String(submission.voterGroupId) === String(group),
      );

      // 備援輪詢會定期重抓遊戲狀態，但不能覆蓋組長正在點選中的 O／X／△ 暫存。
      // 只有尚未開始本地投票、或伺服器已確認本組完成送出時，才同步 myVotes。
      if (!draftVotesDirtyRef.current || hasServerSubmission || submittedVoteRound === roundNo) {
        setDraftVotes(ownVotes);
        if (hasServerSubmission) {
          draftVotesDirtyRef.current = false;
          setSubmittedVoteRound(roundNo);
        }
      }
    } catch (error) {
      console.error("讀取決策卡遊戲狀態失敗：", error);
    }
  }

  useEffect(() => {
    void refreshDecisionGameState();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDecisionGameState();
    }, 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, group, isVoteSubmitting]);

  useEffect(() => {
    const roundNo = Number(decisionGameState?.roundNo) || 0;
    if (!roundNo) return;
    if (lastDecisionRoundRef.current !== null && lastDecisionRoundRef.current !== roundNo) {
      setSubmittedVoteRound(null);
      setDraftVotes({});
      draftVotesDirtyRef.current = false;
      setSelectedIds([]);
      setCoreCardId("");
      setLockReason("");
      setIsLocked(false);
      setHiddenCardIds([]);
      setDisappearingCardIds([]);
      setFadingCardIds([]);
      setMessage(`已進入第 ${roundNo} 輪，請重新選擇本輪三張提案牌。`);
    }
    lastDecisionRoundRef.current = roundNo;
  }, [decisionGameState?.roundNo]);

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

  function finalizeGroupLock(selectedCardIds: string[]) {
    runLockedCardExitAnimation(selectedCardIds);
    mergeLockedCardsIntoInventory(selectedCardIds);
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
    applyGroupLock(normalizedIds);
  }

  function applyGroupLock(selectedCardIds: string[]) {
    const normalizedIds = Array.from(
      new Set(selectedCardIds.map(String)),
    ).filter((id) => cards.some((card) => card.id === id));
    if (normalizedIds.length !== 3) return;

    if (
      isLockedRef.current &&
      areSameCardIdSet(selectedIdsRef.current, normalizedIds)
    ) {
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
      if (!isOpenedRef.current && !isCuttingPackRef.current && !isLaunchingCardsRef.current) {
        openPack({ silentActivityLog: true, syncLockAfterOpen: true });
      }
      return;
    }

    finalizeGroupLock(normalizedIds);
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
    setCoreCardId("");
    setFadingCardIds([]);
    setHiddenCardIds([]);
    setDisappearingCardIds([]);
    setFlippedIds(new Set<string>());
    setCardSwipePreview({ cardId: null, offsetX: 0 });
    setShowLockConfirmDialog(false);
    setLockReason("");
    setIsLockSubmitting(false);
    pendingGroupLockIdsRef.current = null;
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
      if (event.type === "decision-card-game") {
        void refreshDecisionGameState();
        return;
      }
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
    applyGroupLock(normalizedIds);
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
              window.setTimeout(() => {
                finalizeGroupLock(pendingLockIds);
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
    if (acceptedOwnCardIds.has(cardId)) {
      setMessage("這張牌已通過並進入決策區，不能再選。");
      return;
    }
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) {
        if (coreCardId === cardId) setCoreCardId("");
        return prev.filter((id) => id !== cardId);
      }
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

    if (!selectedIds.includes(coreCardId)) {
      setMessage("請先從三張牌中標記一張核心牌。");
      return;
    }

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
        coreCardId,
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

      applyGroupLock(lockedSelectedIds);
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


  const proposalCards = useMemo(() => {
    const map = new Map<string, { id: string; title: string; frontText: string; groupId: string }>();
    GROUP_ORDER.forEach((groupId) => {
      buildPackCards(groupId).forEach((card) => map.set(card.id, { ...card, groupId }));
    });
    return map;
  }, []);

  const currentRoundProposals = useMemo(
    () => (decisionGameState?.proposals || []).filter((proposal) => (Number(proposal.roundNo) || 1) === (decisionGameState?.roundNo || 1)),
    [decisionGameState?.proposals, decisionGameState?.roundNo],
  );

  const hasOwnCurrentRoundProposal = currentRoundProposals.some(
    (proposal) => String(proposal.groupId) === String(group),
  );
  const showDecisionBoard = hasOwnCurrentRoundProposal || isLocked;

  useEffect(() => {
    const roundNo = Number(decisionGameState?.roundNo) || 0;
    if (!roundNo || hasOwnCurrentRoundProposal) return;
    const storedRoundNo = Number(initialCardPackUiState.roundNo) || 0;
    if (storedRoundNo && storedRoundNo === roundNo) return;

    // 舊版 localStorage 沒有 roundNo，或上一輪留下的選牌暫存，會造成下一輪明明只點 1 張卻顯示已選 3 張。
    // 當本組本輪尚未送出提案時，先清掉跨輪殘留的選取狀態。
    setSelectedIds([]);
    setCoreCardId("");
    setLockReason("");
  }, [decisionGameState?.roundNo, hasOwnCurrentRoundProposal, initialCardPackUiState.roundNo]);

  const completedVoteGroupIds = useMemo(() => {
    const ids = new Set<string>();
    (decisionGameState?.voteSubmissions || []).forEach((submission) => {
      if ((Number(submission.roundNo) || 1) === (decisionGameState?.roundNo || 1)) {
        ids.add(String(submission.voterGroupId));
      }
    });
    return ids;
  }, [decisionGameState?.roundNo, decisionGameState?.voteSubmissions, decisionGameState?.votes]);
  const hasSubmittedCurrentRoundVote =
    submittedVoteRound === (decisionGameState?.roundNo || 1) || completedVoteGroupIds.has(String(group));

  const votingGroupStatus = useMemo(() => {
    return GROUP_ORDER.map((groupId) => ({
      groupId,
      completed: completedVoteGroupIds.has(String(groupId)),
      meta: GROUP_PACK_META[resolveGroup(groupId)],
    }));
  }, [completedVoteGroupIds]);

  const boardCards = useMemo(
    () => currentRoundProposals.flatMap((proposal) =>
      (proposal.selectedCardIds || []).map((cardId) => ({
        proposal,
        cardId: String(cardId),
        card: proposalCards.get(String(cardId)),
      })),
    ),
    [currentRoundProposals, proposalCards],
  );

  const boardCardsByGroup = useMemo(() => {
    const map = new Map<string, typeof boardCards>();
    GROUP_ORDER.forEach((groupId) => map.set(groupId, []));
    boardCards.forEach((item) => {
      const groupId = resolveGroup(String(item.proposal.groupId || item.card?.groupId || ""));
      const list = map.get(groupId) || [];
      list.push(item);
      map.set(groupId, list);
    });
    return map;
  }, [boardCards]);

  const boardGroupSummaries = useMemo(() => {
    return GROUP_ORDER.map((groupId) => ({
      groupId,
      meta: GROUP_PACK_META[groupId],
      cards: boardCardsByGroup.get(groupId) || [],
    }));
  }, [boardCardsByGroup]);

  const submittedProposalGroupCount = boardGroupSummaries.filter((item) => item.cards.length > 0).length;
  const allGroupsSubmittedProposals = submittedProposalGroupCount >= GROUP_ORDER.length;

  const selectedBoardGroupCards = selectedBoardGroupId ? boardCardsByGroup.get(selectedBoardGroupId) || [] : [];

  useEffect(() => {
    if (selectedBoardGroupId && !(boardCardsByGroup.get(selectedBoardGroupId) || []).length) {
      setSelectedBoardGroupId(null);
    }
  }, [boardCardsByGroup, selectedBoardGroupId]);

  const publicVoteLiveRows = useMemo(() => {
    const voteCountMap = new Map(
      (decisionGameState?.voteCounts || []).map((item) => [String(item.cardId), item]),
    );
    return boardCards.map(({ proposal, cardId, card }) => {
      const aggregate = voteCountMap.get(String(cardId));
      const fallbackVotes = aggregate
        ? []
        : (decisionGameState?.votes || []).filter(
            (vote) => String(vote.cardId) === String(cardId) && (Number(vote.roundNo) || 1) === (decisionGameState?.roundNo || 1),
          );
      const agree = aggregate ? Number(aggregate.agree) || 0 : fallbackVotes.filter((vote) => vote.voteType === "agree").length;
      const reject = aggregate ? Number(aggregate.reject) || 0 : fallbackVotes.filter((vote) => vote.voteType === "reject").length;
      const keep = aggregate ? Number(aggregate.keep) || 0 : Math.max(0, GROUP_ORDER.length - 1 - agree - reject);
      const result = agree >= 3 ? "目前通過" : reject >= 3 ? "目前反對" : "目前保留";
      return { key: `${proposal.groupId}-${cardId}`, proposal, cardId, card, agree, reject, keep, result };
    });
  }, [boardCards, decisionGameState?.roundNo, decisionGameState?.voteCounts, decisionGameState?.votes]);

  const acceptedDecisionCards = useMemo(() => {
    return (decisionGameState?.acceptedCards || [])
      .map((accepted, index) => {
        const cardId = String(accepted.cardId || "");
        const card = proposalCards.get(cardId);
        const groupId = resolveGroup(String(accepted.groupId || card?.groupId || group));
        return {
          ...accepted,
          key: `${accepted.roundNo || 0}-${groupId}-${cardId}-${index}`,
          cardId,
          card,
          groupId,
          roundNo: Number(accepted.roundNo) || 1,
        };
      })
      .sort((a, b) => a.roundNo - b.roundNo || GROUP_ORDER.indexOf(a.groupId) - GROUP_ORDER.indexOf(b.groupId));
  }, [decisionGameState?.acceptedCards, group, proposalCards]);

  function formatBoardCardTitle(title?: string | null, fallback?: string) {
    return (title || fallback || "").replace(/卡包/g, "").trim();
  }

  function getLiveResultSymbol(result?: string | null) {
    if (String(result || "").includes("通過")) return "O";
    if (String(result || "").includes("反對")) return "X";
    return "△";
  }

  function getLiveResultSymbolClass(result?: string | null) {
    if (String(result || "").includes("通過")) return "border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_0_22px_rgba(16,185,129,0.28)]";
    if (String(result || "").includes("反對")) return "border-rose-300 bg-rose-100 text-rose-800 shadow-[0_0_22px_rgba(244,63,94,0.24)]";
    return "border-stone-300 bg-stone-100 text-stone-700 shadow-[0_0_18px_rgba(120,113,108,0.18)]";
  }

  function renderBoardCard(
    cardId: string,
    card: { id?: string; title?: string; frontText?: string; groupId?: string } | undefined,
    options: { groupId?: string | null; compact?: boolean; badge?: React.ReactNode; backText?: string | null } = {},
  ) {
    const cardGroup = resolveGroup(String(options.groupId || card?.groupId || group));
    const cardMeta = GROUP_PACK_META[cardGroup];
    const flipKey = `board-${cardId}-${options.groupId || cardGroup}`;
    const canFlip = Boolean(options.backText);
    const flipped = canFlip && flippedIds.has(flipKey);
    const displayTitle = formatBoardCardTitle(card?.title, cardId);

    const cardFace = (
      <div className={`absolute inset-0 overflow-hidden rounded-[24px] border border-white/60 bg-gradient-to-br ${cardMeta.cardFace} p-[clamp(5px,1.5vmin,10px)] ${cardMeta.cardText} shadow-[0_18px_42px_rgba(0,0,0,0.18),inset_0_0_24px_rgba(255,255,255,0.32)]`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_22%),radial-gradient(circle_at_82%_86%,rgba(255,255,255,0.34),transparent_26%)]" />
        {options.badge ? <div className="absolute right-2 top-2 z-20">{options.badge}</div> : null}
        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <div className="mb-2 flex h-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/62 px-2 shadow-sm">
            <p className={`w-full truncate text-center text-[0.66rem] font-black tracking-[0.08em] ${cardMeta.cardMutedText}`}>
              {displayTitle}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[18px] bg-white/62 px-2 py-2 text-center shadow-sm">
            <p className={`${options.compact ? "text-[0.72rem]" : "text-[0.8rem]"} max-h-full overflow-hidden break-words text-center font-black leading-[1.22] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8]`}>
              {card?.frontText || cardId}
            </p>
          </div>
          {canFlip ? <p className="mt-1 text-center text-[10px] font-black opacity-70">點擊翻面看理由</p> : null}
        </div>
      </div>
    );

    const cardBack = (
      <div className={`absolute inset-0 overflow-hidden rounded-[24px] border border-white/70 bg-gradient-to-br ${cardMeta.cardFace} p-[clamp(5px,1.5vmin,10px)] ${cardMeta.cardText} shadow-[0_18px_42px_rgba(0,0,0,0.18),inset_0_0_24px_rgba(255,255,255,0.32)]`}>
        <div className="relative z-10 flex h-full flex-col rounded-[18px] bg-white/72 px-3 py-3 text-center shadow-sm">
          <p className="text-[11px] font-black tracking-[0.12em] opacity-70">提案理由</p>
          <p className={`${options.compact ? "text-[0.66rem]" : "text-[0.76rem]"} mt-2 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-left font-black leading-[1.45]`}>
            {options.backText || "尚未填寫理由"}
          </p>
          <p className="mt-2 shrink-0 text-center text-[10px] font-black opacity-70">點擊回到牌面</p>
        </div>
      </div>
    );

    return (
      <div className={`${options.compact ? "w-full max-w-[150px]" : "w-full max-w-[180px]"}`}>
        <button
          type="button"
          onClick={() => {
            if (!canFlip) return;
            setFlippedIds((prev) => {
              const next = new Set(prev);
              if (next.has(flipKey)) next.delete(flipKey);
              else next.add(flipKey);
              return next;
            });
          }}
          className={`relative block aspect-[3/4] w-full text-left ${canFlip ? "cursor-pointer" : "cursor-default"}`}
        >
          {flipped ? cardBack : cardFace}
        </button>
      </div>
    );
  }

  function setVote(cardId: string, voteType: DecisionCardVoteType | "") {
    draftVotesDirtyRef.current = true;
    setDraftVotes((prev) => {
      const next = { ...prev };
      if (!voteType) delete next[cardId];
      else next[cardId] = voteType;
      const agreeCount = Object.values(next).filter((value) => value === "agree").length;
      const rejectCount = Object.values(next).filter((value) => value === "reject").length;
      if (agreeCount > 5 || rejectCount > 5) {
        setMessage("支持票與反對票各最多 5 張。取消其他票後再投。");
        return prev;
      }
      return next;
    });
  }

  async function submitVotes() {
    if (!token || !isGroupLeader || isVoteSubmitting || !allGroupsSubmittedProposals) return;
    setIsVoteSubmitting(true);
    try {
      const votes = Object.entries(draftVotes)
        .filter(([, voteType]) => voteType === "agree" || voteType === "reject")
        .map(([cardId, voteType]) => ({ cardId, voteType: voteType as DecisionCardVoteType }));
      const data = await saveDecisionCardVotes(token, votes);
      const roundNo = Number(data.roundNo || decisionGameState?.roundNo) || 1;
      draftVotesDirtyRef.current = false;
      const ownVotes: Record<string, DecisionCardVoteType | ""> = {};
      (data.myVotes || []).forEach((vote) => {
        ownVotes[String(vote.cardId)] = vote.voteType;
      });
      setDraftVotes(ownVotes);
      setSubmittedVoteRound(roundNo);
      setSelectedBoardGroupId(null);
      setDecisionGameState((prev) => ({ ...(prev || data), ...data, roundNo }));
      setMessage("投票已送出，現在可以查看公告欄票數實況。未投的牌會視為 △ 保留。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送出投票失敗");
    } finally {
      setIsVoteSubmitting(false);
    }
  }

  return (
    <main className="game-adventure-page uiux-page-shell relative min-h-screen overflow-x-hidden px-3 py-3 text-white sm:px-6 sm:py-4">
      <CardPackVisualEffects energyBurstActive={energyBurstActive} />
      <CardPackPageHeader
        isOpened={isOpened}
        packTitle={meta.title}
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
                          {availableCards.map((card, index) => {
                            const angle =
                              (index / availableCardCount) *
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
          <>
          {!showDecisionBoard ? (
          <div className="w-full">
            <div className="mb-5 flex flex-col items-center justify-between gap-3 rounded-[28px] border border-white/45 bg-[#fffaf0]/92 px-4 py-4 text-[#2f251c] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row">
              <div>
                <p className="text-xs font-black tracking-[0.28em] text-[#846b31]">
                  SELECT THREE CARDS
                </p>
                <p className="mt-1 text-lg font-black text-[#2f251c]">
                  第 {decisionGameState?.roundNo || 1} 輪｜已選擇 {selectedIds.length} / 3 張｜手牌 {availableCards.length} 張
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

              {availableCards.map((card, index) => {
                if (hiddenCardIds.includes(card.id)) return null;

                const selected = selectedIds.includes(card.id);
                const selectedOrderIndex = selectedIds.indexOf(card.id);
                const flipped = flippedIds.has(card.id);
                const shouldCenterLockedCard =
                  isLocked && selected && selectedOrderIndex >= 0;
                const orbitAngle = wheelRotation + index * (360 / availableCardCount);
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
                            <div className="pointer-events-none absolute -inset-3 rounded-[30px] bg-[conic-gradient(from_90deg,rgba(255,255,255,0.15),#facc15,#fff7ad,#f59e0b,#ffffff,#facc15,rgba(255,255,255,0.15))] opacity-100" />
                            <div className="pointer-events-none absolute -inset-1.5 z-10 rounded-[27px] border-[5px] border-yellow-300 shadow-[0_0_0_3px_rgba(255,255,255,0.92),0_0_30px_rgba(250,204,21,0.95),0_0_70px_rgba(245,158,11,0.42)]" />
                          </>
                        ) : null}
                        {selected ? (
                          <button
                            type="button"
                            data-card-button="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCoreCardId(card.id);
                            }}
                            className={`absolute -top-5 left-1/2 z-30 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-black shadow ${coreCardId === card.id ? "border-rose-200 bg-rose-500 text-white" : "border-white/70 bg-white/90 text-stone-700"}`}
                          >
                            {coreCardId === card.id ? "核心牌" : "設為核心"}
                          </button>
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
          ) : null}

            {showDecisionBoard ? (
            <section className="w-full">
              {!hasSubmittedCurrentRoundVote ? (
              <div className="rounded-[32px] border border-white/45 bg-[#fffaf0]/95 p-4 text-[#2f251c] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black tracking-[0.26em] text-[#846b31]">PUBLIC BOARD</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">公告欄投票</h2>
                      <p className={`rounded-full px-4 py-2 text-xs font-black ${allGroupsSubmittedProposals ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {allGroupsSubmittedProposals ? "六個局都已送出提案，可以送出投票" : `等待提案完成：${submittedProposalGroupCount}/${GROUP_ORDER.length} 局已送出`}
                      </p>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-7 text-[#6b5a44]">
                      第 {decisionGameState?.roundNo || 1} 輪公告欄。組長可對其他組的牌投 O 支持、X 反對、△ 保留；支持票與反對票各最多 5 張，未投視為 △。
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    {isGroupLeader ? (
                      <button
                        type="button"
                        onClick={submitVotes}
                        disabled={isVoteSubmitting || !allGroupsSubmittedProposals}
                        className={`min-w-[180px] rounded-[24px] border-2 px-6 py-3 text-base font-black shadow-[0_8px_0_rgba(47,37,28,0.25)] transition active:translate-y-1 active:shadow-[0_3px_0_rgba(47,37,28,0.22)] disabled:cursor-not-allowed disabled:shadow-none ${allGroupsSubmittedProposals ? "border-[#2f251c] bg-gradient-to-br from-[#4a3828] to-[#2f251c] text-white hover:-translate-y-0.5" : "border-stone-300 bg-stone-200 text-stone-500"}`}
                      >
                        {isVoteSubmitting ? "送出中..." : allGroupsSubmittedProposals ? "送出投票" : "等待六局提案"}
                      </button>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                      <span className="rounded-[20px] border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 px-4 py-2 text-sm font-black text-emerald-700 shadow-[0_6px_0_rgba(16,185,129,0.18)]">
                        O 支持 {Object.values(draftVotes).filter((value) => value === "agree").length}/5
                      </span>
                      <span className="rounded-[20px] border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100 px-4 py-2 text-sm font-black text-rose-700 shadow-[0_6px_0_rgba(244,63,94,0.18)]">
                        X 反對 {Object.values(draftVotes).filter((value) => value === "reject").length}/5
                      </span>
                      <span className="rounded-[20px] border-2 border-stone-300 bg-gradient-to-br from-white to-stone-100 px-4 py-2 text-sm font-black text-stone-600 shadow-[0_6px_0_rgba(120,113,108,0.16)]">
                        △ 保留不限
                      </span>
                    </div>
                  </div>
                </div>

                {message ? (
                  <div className="mt-4 rounded-2xl border border-[#d8c79f] bg-white px-4 py-3 text-sm font-black text-[#4a3828]">{message}</div>
                ) : null}

                <div className="mt-5 rounded-[30px] border border-[#d8c79f] bg-white/74 p-3 shadow-inner">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black tracking-[0.2em] text-[#846b31]">各局決策卡閱覽</p>
                      <p className="mt-1 text-sm font-bold text-[#6b5a44]">灰色代表該局尚未送出提案；亮起代表可以點開查看該局三張牌。</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {boardGroupSummaries.map((item) => {
                      const hasProposal = item.cards.length > 0;
                      const isSelected = selectedBoardGroupId === item.groupId;
                      return (
                        <button
                          key={item.groupId}
                          type="button"
                          disabled={!hasProposal}
                          onClick={() => hasProposal && setSelectedBoardGroupId(item.groupId)}
                          className={`relative overflow-hidden rounded-[28px] border px-4 py-4 text-left shadow-sm transition ${
                            hasProposal
                              ? `border-white/70 bg-gradient-to-br ${item.meta.cardFace} hover:-translate-y-1 hover:shadow-xl ${isSelected ? "ring-4 ring-amber-300/80" : ""}`
                              : "border-stone-200 bg-stone-200/85 opacity-75 grayscale"
                          }`}
                        >
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.65),transparent_28%)]" />
                          <div className="relative z-10 flex items-center justify-between gap-3">
                            <div>
                              <p className={`text-lg font-black ${hasProposal ? item.meta.cardText : "text-stone-500"}`}>{formatBoardCardTitle(item.meta.title)}</p>
                              <p className={`mt-1 text-xs font-black ${hasProposal ? item.meta.cardMutedText : "text-stone-500"}`}>
                                {hasProposal ? `已送出 ${item.cards.length} 張提案牌` : "尚未送出提案"}
                              </p>
                            </div>
                            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${hasProposal ? "bg-white/70" : "bg-stone-300 text-stone-500"}`}>{hasProposal ? item.meta.emoji : "—"}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedBoardGroupId ? (
                    <div className="mt-5 rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-black tracking-[0.2em] text-[#846b31]">目前開啟</p>
                          <h3 className="mt-1 text-xl font-black text-[#2f251c]">{formatBoardCardTitle(GROUP_PACK_META[selectedBoardGroupId].title)}</h3>
                        </div>
                        <p className="rounded-full bg-[#f3ead7] px-3 py-1 text-xs font-black text-[#6b5a44]">點擊卡牌可翻面看理由</p>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedBoardGroupCards.map(({ proposal, cardId, card }) => {
                          const isOwn = String(proposal.groupId) === String(group);
                          const vote = draftVotes[String(cardId)] || "";
                          return (
                            <article key={`${proposal.groupId}-${cardId}`} className="rounded-[28px] border border-[#d8c79f] bg-white/90 p-3 shadow-sm">
                              <div className="flex justify-center">
                                {renderBoardCard(String(cardId), card, { groupId: proposal.groupId, backText: proposal.reason || "尚未填寫理由" })}
                              </div>
                              {isGroupLeader && !isOwn ? (
                                <div className="mt-4 rounded-[24px] border border-[#ead9b5] bg-[#fff8e8] p-2 shadow-inner">
                                  <p className="mb-2 text-center text-[11px] font-black tracking-[0.16em] text-[#8a6b35]">選擇此牌立場</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setVote(String(cardId), vote === "agree" ? "" : "agree")}
                                      className={`group relative min-h-[72px] overflow-hidden rounded-[22px] border-2 px-2 py-2 text-center font-black transition active:translate-y-1 ${vote === "agree" ? "border-emerald-600 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_7px_0_rgba(4,120,87,0.42)]" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 shadow-[0_6px_0_rgba(16,185,129,0.16)] hover:-translate-y-0.5 hover:border-emerald-400"}`}
                                    >
                                      <span className="block text-3xl leading-none">O</span>
                                      <span className="mt-1 block text-xs">支持</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setVote(String(cardId), vote === "reject" ? "" : "reject")}
                                      className={`group relative min-h-[72px] overflow-hidden rounded-[22px] border-2 px-2 py-2 text-center font-black transition active:translate-y-1 ${vote === "reject" ? "border-rose-600 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-[0_7px_0_rgba(190,18,60,0.42)]" : "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 text-rose-700 shadow-[0_6px_0_rgba(244,63,94,0.16)] hover:-translate-y-0.5 hover:border-rose-400"}`}
                                    >
                                      <span className="block text-3xl leading-none">X</span>
                                      <span className="mt-1 block text-xs">反對</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setVote(String(cardId), "")}
                                      className={`group relative min-h-[72px] overflow-hidden rounded-[22px] border-2 px-2 py-2 text-center font-black transition active:translate-y-1 ${!vote ? "border-stone-500 bg-gradient-to-br from-stone-300 to-stone-500 text-white shadow-[0_7px_0_rgba(87,83,78,0.35)]" : "border-stone-200 bg-gradient-to-br from-white to-stone-100 text-stone-600 shadow-[0_6px_0_rgba(120,113,108,0.14)] hover:-translate-y-0.5 hover:border-stone-400"}`}
                                    >
                                      <span className="block text-3xl leading-none">△</span>
                                      <span className="mt-1 block text-xs">保留</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-3 rounded-2xl bg-stone-100 px-3 py-2 text-center text-xs font-black text-stone-500">
                                  {isOwn ? "自己的牌不可投票" : "等待組長投票"}
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {!boardCards.length ? <p className="mt-4 text-sm font-bold text-[#6b5a44]">目前公告欄還沒有提案。</p> : null}
                </div>
              </div>
              ) : null}

              {hasSubmittedCurrentRoundVote ? (
              <div className="mx-auto w-full max-w-5xl rounded-[32px] border border-white/45 bg-[#fffaf0]/95 p-4 text-[#2f251c] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:p-5">
                <p className="text-xs font-black tracking-[0.22em] text-[#846b31]">LIVE VOTE BOARD</p>
                <h2 className="mt-1 text-2xl font-black">公告欄票數實況</h2>
                <p className="mt-2 text-xs font-bold leading-6 text-[#6b5a44]">你已完成本輪投票。這裡會顯示每一張公告牌目前的 O／X／△ 票數，以及各局是否已完成投票。</p>

                <div className="mt-4 rounded-3xl border border-[#d8c79f] bg-white/90 p-3">
                  <p className="text-sm font-black text-[#2f251c]">各局投票完成狀態</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {votingGroupStatus.map((item) => (
                      <div key={item.groupId} className={`flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-gradient-to-br ${item.meta.cardFace} px-3 py-2 shadow-sm ${item.completed ? "opacity-100" : "opacity-70"}`}>
                        <span className={`text-xs font-black ${item.meta.cardText}`}>{formatBoardCardTitle(item.meta.title)}</span>
                        <span className={`text-xs font-black ${item.meta.cardText}`}>{item.completed ? "已完成投票" : "未完成投票"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-[#d8c79f] bg-white/90 p-3">
                  {publicVoteLiveRows.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {publicVoteLiveRows.map((row) => {
                        const groupMeta = GROUP_PACK_META[resolveGroup(row.proposal.groupId || row.card?.groupId || group)];
                        const boardTitle = formatBoardCardTitle(row.card?.title, row.cardId);
                        return (
                          <article key={row.key} className={`min-h-[190px] rounded-[24px] border border-white/60 bg-gradient-to-br ${groupMeta.cardFace} p-3 shadow-sm`}>
                            <div className="flex h-full flex-col justify-between gap-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`text-xs font-black tracking-[0.14em] ${groupMeta.cardMutedText}`}>{boardTitle}</p>
                                  <p className={`mt-2 line-clamp-3 text-base font-black leading-6 ${groupMeta.cardText}`}>{row.card?.frontText || row.cardId}</p>
                                </div>
                                <div className={`shrink-0 rounded-[22px] border-2 px-4 py-2 text-center ${getLiveResultSymbolClass(row.result)}`}>
                                  <p className="text-[10px] font-black tracking-[0.16em] opacity-75">目前</p>
                                  <p className="text-4xl font-black leading-none">{getLiveResultSymbol(row.result)}</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="grid min-h-[2.25rem] grid-cols-5 gap-1.5 rounded-2xl border border-white/70 bg-white/72 p-2 shadow-inner">
                                  {Array.from({ length: row.agree }).map((_, index) => <span key={`o-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 shadow-sm">O</span>)}
                                  {Array.from({ length: row.reject }).map((_, index) => <span key={`x-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-black text-rose-700 shadow-sm">X</span>)}
                                  {Array.from({ length: row.keep }).map((_, index) => <span key={`k-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-black text-stone-600 shadow-sm">△</span>)}
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center">
                                    <p className="text-[10px] font-black text-emerald-700">O 支持</p>
                                    <p className="mt-0.5 text-xl font-black text-emerald-700">{row.agree}</p>
                                  </div>
                                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-center">
                                    <p className="text-[10px] font-black text-rose-700">X 反對</p>
                                    <p className="mt-0.5 text-xl font-black text-rose-700">{row.reject}</p>
                                  </div>
                                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                                    <p className="text-[10px] font-black text-stone-600">△ 保留</p>
                                    <p className="mt-0.5 text-xl font-black text-stone-600">{row.keep}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-stone-50 px-4 py-6 text-center text-sm font-black text-stone-500">目前公告欄還沒有牌。</div>
                  )}
                </div>
              </div>
              ) : null}
            </section>
            ) : null}
          </>
        )}
      </section>

      {isOpened && decisionGameState ? (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
          {showAcceptedDecisionPanel ? (
            <div className="max-h-[72vh] w-[min(92vw,720px)] overflow-hidden rounded-[34px] border border-white/60 bg-[#fffaf0]/96 text-[#2f251c] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
              <div className="flex items-start justify-between gap-3 border-b border-[#ead8ad] px-5 py-4">
                <div>
                  <p className="text-xs font-black tracking-[0.22em] text-[#846b31]">ACCEPTED DECISIONS</p>
                  <h2 className="mt-1 text-xl font-black">通過決策</h2>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#6b5a44]">顯示目前所有已通過的牌，不分組別彙整。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAcceptedDecisionPanel(false)}
                  className="rounded-full border border-[#d8c79f] bg-white px-3 py-2 text-xs font-black text-[#5a452f] shadow-sm transition hover:-translate-y-0.5"
                >
                  收起
                </button>
              </div>
              <div className="max-h-[56vh] overflow-y-auto px-4 py-4">
                {acceptedDecisionCards.length ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {acceptedDecisionCards.map((item) => (
                      <article key={item.key} className="rounded-[28px] border border-[#d8c79f] bg-white/88 p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-800">第 {item.roundNo} 輪通過</span>
                          {item.coreCard ? <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">核心加分</span> : null}
                        </div>
                        <div className="flex justify-center">
                          {renderBoardCard(item.cardId, item.card, { groupId: item.groupId, compact: true })}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-[#d8c79f] bg-white/72 px-5 py-8 text-center">
                    <p className="text-sm font-black text-[#6b5a44]">目前還沒有通過的決策牌。</p>
                    <p className="mt-2 text-xs font-bold text-[#8a765a]">教師結算本輪後，通過牌會出現在這裡。</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setShowAcceptedDecisionPanel((value) => !value)}
            className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-300 via-lime-200 to-amber-200 text-3xl shadow-[0_18px_46px_rgba(0,0,0,0.28)] transition hover:-translate-y-1 hover:scale-105"
            aria-label="查看通過決策"
            title="查看通過決策"
          >
            <span className="absolute inset-1 rounded-full bg-white/30 blur-sm" />
            <span className="relative">🏛️</span>
            <span className="absolute -right-1 -top-1 flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-[#2f251c] px-2 text-xs font-black text-white shadow">
              {acceptedDecisionCards.length}
            </span>
            <span className="pointer-events-none absolute right-20 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full bg-[#2f251c] px-3 py-2 text-xs font-black text-white shadow-lg group-hover:block">
              通過決策
            </span>
          </button>
        </div>
      ) : null}

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
