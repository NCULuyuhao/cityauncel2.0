/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 InquiryData，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Unlock, X, MessageCircle } from "lucide-react";
import { inferAiHelperCardProfileForClient } from "@/features/inquiry/ai/aiHelperCardProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  createCardFromStoredSnapshotCard,
  createSnapshotGameCard,
} from "@/features/inquiry/snapshots/snapshotCardFactory";
import { applySnapshotCardCreation } from "@/features/inquiry/snapshots/snapshotCardFlow";
import {
  WaterLiveSnapshotCardPreview,
  WaterLiveSnapshotView,
} from "@/features/inquiry/water/WaterLiveSnapshotViews";
import type {
  CategoryKey,
  CollectionReflectionRecord,
  EvidenceSnapshotMeta,
  FinalSummary,
  GameCard,
  InquiryDataDraft,
  InquiryDataProps,
  InquiryFlowStage,
  InquiryIntroStageRecord,
  InquiryPurpose,
  StoredUnlockedCard,
  SuspectAnswer,
} from "@/features/inquiry/inquiryDataTypes";
import { readInquiryDataDraft } from "@/features/inquiry/draft/readInquiryDataDraft";
import { useInquiryDraftAutosave } from "@/features/inquiry/hooks/useInquiryDraftAutosave";
import { useInquiryTitleSync } from "@/features/inquiry/hooks/useInquiryTitleSync";
import { useInquiryIntroFlow } from "@/features/inquiry/hooks/useInquiryIntroFlow";
import { useInquirySubmission } from "@/features/inquiry/hooks/useInquirySubmission";
import { useInquiryHistoryNavigation } from "@/features/inquiry/hooks/useInquiryHistoryNavigation";
import { useStableScrollbarGutter } from "@/features/inquiry/hooks/useStableScrollbarGutter";
import { DataListCountdownTimer } from "@/features/inquiry/timer/DataListCountdownTimer";
import {
  resolveRestoredDataListCountdown,
} from "@/features/inquiry/timer/dataListCountdownConfig";
import { useDataListCountdown } from "@/features/inquiry/timer/useDataListCountdown";
import { InquiryReadyPage } from "@/features/inquiry/intro/InquiryReadyPage";
import { getInvestigationCaseByOrder } from "@/features/inquiry/intro/inquiryIntroCases";
import { getIntroStageDisplay } from "@/features/inquiry/intro/introStageDisplay";
import {
  InquiryFollowUpPage,
  InquiryPurposePage,
  InquiryStageTransitionFrame,
} from "@/features/inquiry/intro/InquiryIntroPages";
import { INQUIRY_SUSPECT_GROUPS } from "@/features/inquiry/intro/inquiryIntroConstants";
import { SubmitConfirmDialog } from "@/features/inquiry/summary/SubmitConfirmDialog";
import {
  COLLECTION_REFLECTION_BATCH_SIZE,
  CONCLUSION_MIN_LENGTH,
  NO_EVIDENCE_CONCLUSION,
  getCollectionReflectionMinLength,
} from "@/features/inquiry/summary/collectionReflectionRules";
import { saveInquiryDraftJson } from "@/storage/inquiryDraftStorage";
import {
  createFinalSummary,
  createInquiryPlan,
  saveInvestigationSummary,
  saveInquiryCards,
  saveInquiryTitles,
} from "../api/inquiryApi";

import {
  categoryListThemeMap,
  categoryMetaMap,
  categoryTabThemeMap,
  writtenCardStateMap,
  type TitleReward,
} from "@/features/inquiry/cards/cardPresentation";
import { TitleRewardCelebration } from "@/features/inquiry/titleRewards/titleRewardUi";
import { TrophyPanel } from "@/features/inquiry/titleRewards/TrophyPanel";
import {
  getRewardChecks,
  isSupportedInquiryTitleReward,
} from "@/features/inquiry/titleRewards/titleRewardStyles";
import { CollectedCardsPanel } from "@/features/inquiry/cards/CollectedCardsPanel";
import { CollectedCardPreview } from "@/features/inquiry/cards/CollectedCardPreview";
import { CategoryTabs } from "@/features/inquiry/cards/CategoryTabs";
import { GameCardGrid } from "@/features/inquiry/cards/GameCardGrid";
import { BalanceScaleBackground } from "@/features/inquiry/BalanceScaleBackground";
import {
  preloadGameCardImages,
  type ImagePreloadPriority,
} from "@/features/inquiry/cards/gameCardImagePreload";
import { useCardDerivedData } from "@/features/inquiry/cards/useCardDerivedData";
import {
  ALL_CARD_IMAGE_PRELOAD_CARDS,
  CATEGORY_KEYS,
  createAllCards,
} from "@/features/inquiry/cards/cardCatalog";

import {
  getStoredCardContent,
  getStoredCardImage,
  getStoredCardRound,
  getStoredCardSnapshot,
  getStoredCardSource,
  nowIsoTimestamp,
  toIsoTimestamp,
} from "@/features/inquiry/cards/cardSerialization";
import { InteractiveDataSnapshotPanel } from "@/features/inquiry/water/InteractiveDataSnapshotPanel";
import {
  buildSnapshotSvgDataUrl,
  getBalanceEffect,
  getCompactDraftCards,
  getCompactEvidenceCardSummary,
  getCompactStoredUnlockedCard,
  isCategoryKey,
  normalizeDraftCards,
  serializeUnlockedCard,
  shouldUseWaterLiveSnapshotPreview,
} from "@/features/inquiry/water/interactiveDataSnapshotHelpers";

const MemoizedBalanceScaleBackground = memo(BalanceScaleBackground);
const MemoizedCategoryTabs = memo(CategoryTabs);
const MemoizedCollectedCardsPanel = memo(CollectedCardsPanel);
const MemoizedTrophyPanel = memo(TrophyPanel);
const MemoizedTitleRewardCelebration = memo(TitleRewardCelebration);
const MemoizedCollectedCardPreview = memo(CollectedCardPreview);

export default function InquiryData({
  token,
  orientationMainChoice = "",
  orientationTextInput = "",
  currentInquiryOrder = 1,
  draftStorageKey,
  onInquiryPlanCreated,
  onBackToHome,
  onSubmitSummary,
  onTitleRewardsChange,
  unlockedCardIds,
  setUnlockedCardIds,
  onActivityLog,
  onAiHelperAvailabilityChange,
  inquiryRecordOrder = null,
}: InquiryDataProps) {
  const currentCase = getInvestigationCaseByOrder(currentInquiryOrder);
  const [initialDraft] = useState<InquiryDataDraft | null>(() =>
    readInquiryDataDraft(draftStorageKey, currentInquiryOrder, normalizeDraftCards),
  );
  const restoredDataListCountdown = useMemo(
    () => resolveRestoredDataListCountdown(initialDraft, currentInquiryOrder),
    [currentInquiryOrder, initialDraft],
  );
  const [flowStage, setFlowStage] = useState<InquiryFlowStage>(
    initialDraft?.flowStage ?? "purpose",
  );
  const [introStage, setIntroStage] = useState<InquiryIntroStageRecord | null>(
    initialDraft?.introStage ?? null,
  );
  const [orientationCreatedAt, setOrientationCreatedAt] = useState<
    string | null
  >(initialDraft?.orientationCreatedAt ?? null);
  const [inquiryPurpose, setInquiryPurpose] = useState<InquiryPurpose>(
    initialDraft?.inquiryPurpose ?? "",
  );
  const [suspectAnswer, setSuspectAnswer] = useState<SuspectAnswer>(
    initialDraft?.suspectAnswer ?? "",
  );
  const [selectedSuspects, setSelectedSuspects] = useState<string[]>(
    initialDraft?.selectedSuspects ?? [],
  );
  const [task3Targets, setTask3Targets] = useState<string[]>(
    initialDraft?.task3Targets ?? [],
  );
  const [suspectReason, setSuspectReason] = useState(
    initialDraft?.suspectReason ?? "",
  );
  const [suspectOtherDraft, setSuspectOtherDraft] = useState(
    initialDraft?.suspectOtherDraft ?? "",
  );
  const [suspectOtherText, setSuspectOtherText] = useState(
    initialDraft?.suspectOtherText ?? "",
  );
  const [task3OtherDraft, setTask3OtherDraft] = useState(
    initialDraft?.task3OtherDraft ?? "",
  );
  const [task3OtherText, setTask3OtherText] = useState(
    initialDraft?.task3OtherText ?? "",
  );
  const [possibleCrisis, setPossibleCrisis] = useState(
    initialDraft?.possibleCrisis ?? "",
  );
  const [otherPurpose, setOtherPurpose] = useState(
    initialDraft?.otherPurpose ?? "",
  );
  const [readyMessage, setReadyMessage] = useState(
    initialDraft?.readyMessage ?? "準備好成為一位優秀的調查員了嗎？",
  );
  const [isFinished, setIsFinished] = useState(
    initialDraft?.isFinished ?? false,
  );
  const [conclusion, setConclusion] = useState(initialDraft?.conclusion ?? "");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const handleDataListCountdownEndRef = useRef<() => void>(() => {});
  const {
    dataListCountdownDeadline,
    dataListRemainingMs,
    dataListTimerNotice,
  } = useDataListCountdown({
    isActive: flowStage === "cards" && !isFinished,
    currentInquiryOrder,
    restoredCountdown: restoredDataListCountdown,
    onCountdownEnd: () => handleDataListCountdownEndRef.current(),
    onActivityLog,
  });

  useEffect(() => {
    const isAiHelperAvailable = flowStage === "cards" && !isFinished;
    onAiHelperAvailabilityChange?.(isAiHelperAvailable);
  }, [flowStage, isFinished, onAiHelperAvailabilityChange]);

  useEffect(() => {
    return () => onAiHelperAvailabilityChange?.(false);
  }, [onAiHelperAvailabilityChange]);
  const [flippedEvidenceIds, setFlippedEvidenceIds] = useState<string[]>(
    initialDraft?.flippedEvidenceIds ?? [],
  );
  const [evidencePreviewFlippedIds, setEvidencePreviewFlippedIds] = useState<
    string[]
  >([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(
    initialDraft?.selectedEvidenceIds ?? [],
  );
  const [confirmedEvidenceIds, setConfirmedEvidenceIds] = useState<string[]>(
    initialDraft?.confirmedEvidenceIds ?? [],
  );
  const [currentRoundCardIds, setCurrentRoundCardIds] = useState<string[]>(
    initialDraft?.currentRoundCardIds ?? [],
  );
  const [collectionReflectionRecords, setCollectionReflectionRecords] =
    useState<CollectionReflectionRecord[]>(
      initialDraft?.collectionReflectionRecords ?? [],
    );
  const [showCollectionReflectionPrompt, setShowCollectionReflectionPrompt] =
    useState(false);
  const [
    pendingCollectionReflectionCardIds,
    setPendingCollectionReflectionCardIds,
  ] = useState<string[]>([]);
  const [collectionReflectionText, setCollectionReflectionText] = useState("");
  const [
    returnToFinishAfterCollectionReflection,
    setReturnToFinishAfterCollectionReflection,
  ] = useState<"none" | "confirm" | "summary">("none");
  const [cards, setCards] = useState<GameCard[]>(
    initialDraft?.cards ?? createAllCards,
  );

  useEffect(() => {
    if (isFinished) return;

    // 在學生回答前導問題、閱讀準備頁時，就先用瀏覽器空閒時間預載與解碼卡牌圖片。
    // 這樣真正點擊分類展開時，畫面主要只需要做 DOM/動畫，不會再被圖片載入卡住。
    const preloadPriority: ImagePreloadPriority =
      flowStage === "cards" ? "fast" : "gentle";

    // 只預載固定圖片清單，不綁 cards 狀態。
    // cards 會因解鎖、輸入內容、同步資料而更新；若把 cards 放進 dependency，
    // 預載排程會被反覆取消/重建，分類切換時更容易和動畫搶主執行緒。
    return preloadGameCardImages(ALL_CARD_IMAGE_PRELOAD_CARDS, preloadPriority);
  }, [flowStage, isFinished]);

  useEffect(() => {
    if (unlockedCardIds.length === 0) return;

    const timer = window.setTimeout(() => {
      setCards((prev) => {
        const cardMap = new Map(prev.map((card) => [card.id, card]));

        unlockedCardIds.forEach((savedCard) => {
          const savedId =
            typeof savedCard === "string" ? savedCard : savedCard.id;
          const existing = cardMap.get(savedId);

          if (existing) {
            const isSavedString = typeof savedCard === "string";
            const shouldBeUnlocked = isSavedString
              ? true
              : Boolean(savedCard.unlocked ?? true);

            cardMap.set(savedId, {
              ...existing,
              unlocked: shouldBeUnlocked,
              content: isSavedString
                ? existing.content
                : getStoredCardContent(savedCard) || existing.content,
              unlockedAt: shouldBeUnlocked
                ? isSavedString
                  ? (existing.unlockedAt ?? nowIsoTimestamp())
                  : (toIsoTimestamp(savedCard.unlockedAt) ??
                    existing.unlockedAt ??
                    nowIsoTimestamp())
                : null,
              imageSrc: isSavedString
                ? existing.imageSrc
                : getStoredCardImage(savedCard) || existing.imageSrc,
              sourceType: isSavedString
                ? (existing.sourceType ?? "fixedImage")
                : (getStoredCardSource(savedCard) ??
                  existing.sourceType ??
                  "fixedImage"),
              snapshotMeta: isSavedString
                ? existing.snapshotMeta
                : (getStoredCardSnapshot(savedCard) ?? existing.snapshotMeta),
              sharedFromOtherPlayer: isSavedString
                ? existing.sharedFromOtherPlayer
                : Boolean(savedCard.sharedFromOtherPlayer),
              sharedAuthorName: isSavedString
                ? existing.sharedAuthorName
                : (savedCard.sharedAuthorName ?? existing.sharedAuthorName),
            });
            return;
          }

          if (typeof savedCard !== "string") {
            const dynamicCard = createCardFromStoredSnapshotCard(savedCard, {
              buildSnapshotSvgDataUrl,
              isCategoryKey,
            }) as GameCard | null;
            if (dynamicCard) cardMap.set(dynamicCard.id, dynamicCard);
          }
        });

        return Array.from(cardMap.values());
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [unlockedCardIds]);

  useEffect(() => {
    if (!initialDraft) return;

    const draftUnlockedCards = initialDraft.cards
      .filter((card) => card.unlocked)
      .map((card) => serializeUnlockedCard(card, currentInquiryOrder));

    if (draftUnlockedCards.length === 0) return;

    setUnlockedCardIds((prev) => {
      const nextById = new Map<string, (typeof draftUnlockedCards)[number]>();

      prev.forEach((item) => {
        if (typeof item === "string") {
          nextById.set(item, {
            id: item,
            content: "",
            unlockedAt: nowIsoTimestamp(),
            unlockedInInquiryOrder: currentInquiryOrder,
          });
        } else {
          nextById.set(item.id, {
            ...item,
            id: item.id,
            content: getStoredCardContent(item),
            unlockedAt: toIsoTimestamp(item.unlockedAt) ?? nowIsoTimestamp(),
            unlockedInInquiryOrder: getStoredCardRound(
              item,
              currentInquiryOrder,
            ),
          });
        }
      });

      draftUnlockedCards.forEach((item) => nextById.set(item.id, item));
      return Array.from(nextById.values());
    });
  }, [currentInquiryOrder, initialDraft, setUnlockedCardIds]);

  // 進入數據探究頁時不要自動恢復上次停留的分類，
  // 避免一進頁面就渲染分類卡片並開始載入 21～30 張圖片。
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(
    null,
  );
  const [mountedCategories, setMountedCategories] = useState<Set<CategoryKey>>(
    () => new Set(),
  );
  const [activeId, setActiveId] = useState<string | null>(
    initialDraft?.activeId ?? null,
  );
  const [isModalReady, setIsModalReady] = useState(false);
  const [inputValue, setInputValue] = useState(initialDraft?.inputValue ?? "");
  const [newInputValue, setNewInputValue] = useState(
    initialDraft?.newInputValue ?? "",
  );
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [justUnlockedId, setJustUnlockedId] = useState<string | null>(null);
  const [flashingSnapshotCardId, setFlashingSnapshotCardId] = useState<
    string | null
  >(null);
  const [categoryFlipKey, setCategoryFlipKey] = useState<CategoryKey | null>(
    null,
  );
  const [developmentScore, setDevelopmentScore] = useState(
    initialDraft?.developmentScore ?? 0,
  );
  const [conservationScore, setConservationScore] = useState(
    initialDraft?.conservationScore ?? 0,
  );
  const [earnedTitles, setEarnedTitles] = useState<TitleReward[]>(
    (initialDraft?.earnedTitles ?? []).filter(isSupportedInquiryTitleReward),
  );
  const [pendingReward, setPendingReward] = useState<TitleReward | null>(null);
  const [previewCard, setPreviewCard] = useState<GameCard | null>(null);
  const [hasNewCollectedContent, setHasNewCollectedContent] = useState(
    initialDraft?.hasNewCollectedContent ?? false,
  );
  const [hasNewTitleReward, setHasNewTitleReward] = useState(
    initialDraft?.hasNewTitleReward ?? false,
  );
  const shouldShowTitleRewardAnimationRef = useRef(false);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotCardScrollTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastSavedDraftJsonRef = useRef<string | null>(null);
  const [showFallingLock, setShowFallingLock] = useState(false);
  const [showUnlockBurst, setShowUnlockBurst] = useState(false);
  const pendingCardUpdateRef = useRef<null | {
    targetCard: GameCard;
    content: string;
    wasUnlocked: boolean;
  }>(null);
  const evidenceSwipeRef = useRef<null | {
    cardId: string;
    startX: number;
    startY: number;
    pointerId: number;
  }>(null);

  const {
    categoryCardsByCategory,
    unlockedCountByCategory,
    totalCountByCategory,
    totalUnlockedCount,
    totalCardCount,
    unlockedCardsWithContent,
    allUnlockedCardsWithContent,
    confirmedEvidenceCards,
    activeCard,
    pendingCollectionReflectionCards,
  } = useCardDerivedData({
    cards,
    confirmedEvidenceIds,
    currentRoundCardIds,
    activeId,
    pendingCollectionReflectionCardIds,
  });
  const noEvidenceSummaryMode =
    isFinished &&
    unlockedCardsWithContent.length === 0 &&
    confirmedEvidenceCards.length === 0;

  const getCollectionReflectionForCard = useCallback(
    (cardId: string) =>
      collectionReflectionRecords.find((record) =>
        record.cardIds.includes(cardId),
      ) || null,
    [collectionReflectionRecords],
  );

  const getCollectionReflectionReasonForCard = useCallback(
    (cardId: string) =>
      getCollectionReflectionForCard(cardId)?.reason ||
      "這張卡還沒有完成同批蒐集理由。",
    [getCollectionReflectionForCard],
  );

  useStableScrollbarGutter();

  const buildCurrentInquiryDraft = (options?: { pauseCountdown?: boolean }) => {
    const remainingMs =
      dataListCountdownDeadline !== null
        ? Math.max(0, dataListCountdownDeadline - Date.now())
        : null;

    return {
      version: 1 as const,
      savedAt: Date.now(),
      currentInquiryOrder,
      flowStage,
      isFinished,
      introStage,
      orientationCreatedAt,
      inquiryPurpose,
      suspectAnswer,
      selectedSuspects,
      task3Targets,
      suspectReason,
      suspectOtherDraft,
      suspectOtherText,
      task3OtherDraft,
      task3OtherText,
      possibleCrisis,
      otherPurpose,
      readyMessage,
      conclusion,
      dataListCountdownDeadline,
      dataListCountdownRemainingMs: remainingMs,
      dataListCountdownPausedAt:
        options?.pauseCountdown && remainingMs !== null ? Date.now() : null,
      flippedEvidenceIds,
      selectedEvidenceIds,
      confirmedEvidenceIds,
      currentRoundCardIds,
      collectionReflectionRecords,
      cards: getCompactDraftCards(cards),
      activeCategory: null,
      activeId: null,
      inputValue,
      newInputValue,
      developmentScore,
      conservationScore,
      earnedTitles,
      hasNewCollectedContent,
      hasNewTitleReward,
    };
  };

  useInquiryDraftAutosave<InquiryDataDraft>({
    storageKey: draftStorageKey,
    buildDraft: () => buildCurrentInquiryDraft(),
    buildFallbackDraft: (draft) => ({ ...draft, cards: [] }),
    lastSavedJsonRef: lastSavedDraftJsonRef,
    delay: 900,
    deps: [
      cards,
      confirmedEvidenceIds,
      conservationScore,
      currentRoundCardIds,
      collectionReflectionRecords,
      currentInquiryOrder,
      developmentScore,
      earnedTitles,
      conclusion,
      dataListCountdownDeadline,
      flippedEvidenceIds,
      flowStage,
      hasNewCollectedContent,
      hasNewTitleReward,
      inputValue,
      orientationCreatedAt,
      inquiryPurpose,
      introStage,
      isFinished,
      newInputValue,
      otherPurpose,
      possibleCrisis,
      readyMessage,
      selectedEvidenceIds,
      selectedSuspects,
      suspectAnswer,
      suspectReason,
      suspectOtherDraft,
      suspectOtherText,
      task3OtherDraft,
      task3OtherText,
      task3Targets,
    ],
  });

  useEffect(() => {
    if (!draftStorageKey) return;

    const savePausedCountdownDraft = () => {
      if (
        flowStage !== "cards" ||
        isFinished ||
        dataListCountdownDeadline === null
      ) {
        return;
      }

      const draft = buildCurrentInquiryDraft({ pauseCountdown: true });
      const saveResult = saveInquiryDraftJson({
        storageKey: draftStorageKey,
        draft,
        fallbackDraft: { ...draft, cards: [] },
        lastSavedJson: null,
      });

      if (saveResult.savedJson) {
        lastSavedDraftJsonRef.current = saveResult.savedJson;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") savePausedCountdownDraft();
    };

    window.addEventListener("pagehide", savePausedCountdownDraft);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", savePausedCountdownDraft);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // buildCurrentInquiryDraft 會隨渲染重建；這裡保留明確欄位依賴，避免每次渲染都重新綁定 pagehide。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cards,
    confirmedEvidenceIds,
    conservationScore,
    currentRoundCardIds,
    collectionReflectionRecords,
    currentInquiryOrder,
    dataListCountdownDeadline,
    developmentScore,
    draftStorageKey,
    earnedTitles,
    conclusion,
    flippedEvidenceIds,
    flowStage,
    hasNewCollectedContent,
    hasNewTitleReward,
    inputValue,
    orientationCreatedAt,
    inquiryPurpose,
    introStage,
    isFinished,
    newInputValue,
    otherPurpose,
    possibleCrisis,
    readyMessage,
    selectedEvidenceIds,
    selectedSuspects,
    suspectAnswer,
    suspectReason,
    suspectOtherDraft,
    suspectOtherText,
    task3OtherDraft,
    task3OtherText,
    task3Targets,
  ]);

  const { goInquiryStage } = useInquiryHistoryNavigation<InquiryFlowStage>({
    cardsStage: "cards",
    flowStage,
    isFinished,
    setFlowStage,
    setIsFinished,
    setShowFinishConfirm,
    setShowSubmitConfirm,
  });
  const {
    finishInquiryIntro,
    resetFollowUpAnswers,
    toggleSelectedSuspect,
    toggleTask3Target,
  } = useInquiryIntroFlow<
    InquiryPurpose,
    SuspectAnswer,
    InquiryIntroStageRecord
  >({
    inquiryPurpose,
    currentInquiryOrder,
    currentCaseTitle: currentCase.title,
    suspectGroups: INQUIRY_SUSPECT_GROUPS,
    selectedSuspects,
    task3Targets,
    suspectReason,
    suspectOtherText,
    task3OtherText,
    possibleCrisis,
    otherPurpose,
    setSuspectAnswer,
    setSelectedSuspects,
    setTask3Targets,
    setSuspectReason,
    setSuspectOtherDraft,
    setSuspectOtherText,
    setTask3OtherDraft,
    setTask3OtherText,
    setPossibleCrisis,
    setOtherPurpose,
    setInquiryPurpose,
    setIntroStage,
    setReadyMessage,
    goInquiryStage,
  });

  useInquiryTitleSync<TitleReward>({
    token,
    titles: earnedTitles,
    onTitleRewardsChange,
    isSupportedTitle: isSupportedInquiryTitleReward,
    saveTitles: saveInquiryTitles,
  });

  useEffect(() => {
    if (!token) return;
    const ownedUnlockedCards = unlockedCardIds
      .filter((card) => {
        if (typeof card === "string") return true;
        return card.unlocked !== false && card.sharedFromOtherPlayer !== true;
      })
      .map((card) =>
        typeof card === "string" ? card : getCompactStoredUnlockedCard(card),
      );
    void saveInquiryCards(token, ownedUnlockedCards).catch((error) => {
      console.error("儲存探究卡牌失敗", error);
    });
  }, [token, unlockedCardIds]);

  useEffect(() => {
    const rewardChecks = getRewardChecks(unlockedCountByCategory);

    const supportedEarnedTitles = earnedTitles.filter(
      isSupportedInquiryTitleReward,
    );
    if (supportedEarnedTitles.length !== earnedTitles.length) {
      const timer = window.setTimeout(() => {
        setEarnedTitles(supportedEarnedTitles);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const newlyEarned = rewardChecks.filter(({ reward, isUnlocked }) => {
      const alreadyHas = supportedEarnedTitles.some(
        (title) => title.id === reward.id,
      );
      return isUnlocked && !alreadyHas;
    });

    if (newlyEarned.length === 0) return;

    const timer = window.setTimeout(() => {
      setEarnedTitles((prev) => [
        ...prev,
        ...newlyEarned.map((item) => item.reward),
      ]);

      if (shouldShowTitleRewardAnimationRef.current) {
        setPendingReward(newlyEarned[0].reward);
        setHasNewTitleReward(true);
        shouldShowTitleRewardAnimationRef.current = false;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [earnedTitles, unlockedCountByCategory]);

  useEffect(() => {
    return () => {
      if (snapshotCardScrollTimerRef.current !== null) {
        window.clearTimeout(snapshotCardScrollTimerRef.current);
        snapshotCardScrollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingReward) return;

    if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);

    rewardTimerRef.current = setTimeout(() => {
      setPendingReward(null);
      rewardTimerRef.current = null;
    }, 3000);

    return () => {
      if (rewardTimerRef.current) {
        clearTimeout(rewardTimerRef.current);
        rewardTimerRef.current = null;
      }
    };
  }, [pendingReward]);

  const openCollectedPreview = useCallback((card: GameCard) => {
    setPreviewCard(card);
  }, []);

  const closeCollectedPreview = useCallback(() => {
    setPreviewCard(null);
  }, []);

  const handleChangeCategory = useCallback(
    (category: CategoryKey) => {
      if (category === activeCategory) return;

      // 已點過的分類會保留在 DOM 裡，之後切回來只改可見狀態，
      // 不會清空 rows 或重新掛載圖片，所以畫面不會有白屏重刷感。
      setMountedCategories((previous) => {
        if (previous.has(category)) return previous;
        const next = new Set(previous);
        next.add(category);
        return next;
      });
      setActiveCategory(category);
      setCategoryFlipKey(null);

      onActivityLog?.({
        eventType: "card_category_change",
        eventLabel: "切換小卡分類",
        targetType: "cardCategory",
        targetId: category,
        previousValue: activeCategory,
        newValue: category,
      });
    },
    [activeCategory, onActivityLog],
  );

  const openCard = useCallback(
    (card: GameCard) => {
      onActivityLog?.({
        eventType: "card_open",
        eventLabel: "打開數據卡牌",
        targetType: "card",
        targetId: card.id,
        metadata: {
          title: card.revealedTitle,
          category: card.category,
          unlocked: card.unlocked,
        },
      });

      // 卡牌點擊要像遊戲互動一樣立即回應；圖片在清單階段已預載，
      // 不再等兩個 animation frame 才填入內容，避免學生覺得點了卡片後慢半拍。
      setInputValue(card.content || "");
      setNewInputValue("");
      setIsModalReady(true);
      setActiveId(card.id);
      setIsUnlocking(false);
    },
    [
      onActivityLog,
      setActiveId,
      setInputValue,
      setIsModalReady,
      setIsUnlocking,
      setNewInputValue,
    ],
  );

  const closeCard = useCallback(() => {
    if (isUnlocking) return;
    setActiveId(null);
    setInputValue("");
    setNewInputValue("");
  }, [isUnlocking]);

  const getUnreflectedCollectionCardIds = useCallback(
    (
      roundCardIds: string[],
      records: CollectionReflectionRecord[] = collectionReflectionRecords,
    ) => {
      const reflectedIdSet = new Set(
        records.flatMap((record) => record.cardIds),
      );
      return roundCardIds.filter((cardId) => !reflectedIdSet.has(cardId));
    },
    [collectionReflectionRecords],
  );

  const openCollectionReflectionPrompt = useCallback(
    (
      cardIds: string[],
      options?: {
        force?: boolean;
        finishMode?: "confirm" | "summary";
        returnToFinish?: boolean;
      },
    ) => {
      const force = Boolean(options?.force);
      const finishMode =
        options?.finishMode ?? (options?.returnToFinish ? "confirm" : "none");
      if (!force && cardIds.length < COLLECTION_REFLECTION_BATCH_SIZE) return;
      const pendingIds = force
        ? cardIds
        : cardIds.slice(0, COLLECTION_REFLECTION_BATCH_SIZE);
      if (pendingIds.length === 0) return;

      setPendingCollectionReflectionCardIds(pendingIds);
      setCollectionReflectionText("");
      setReturnToFinishAfterCollectionReflection(finishMode);
      setShowCollectionReflectionPrompt(true);

      onActivityLog?.({
        eventType: "collection_reflection_prompt_show",
        eventLabel:
          finishMode === "summary"
            ? "時間到要求說明未完成理由"
            : force
              ? "結束探究前要求說明未滿五張理由"
              : "收藏滿五張要求說明理由",
        targetType: "collectionBatch",
        targetId: `inquiry-${currentInquiryOrder}-batch`,
        metadata: {
          inquiryOrder: currentInquiryOrder,
          cardIds: pendingIds,
          force,
          finishMode,
          returnToFinish: finishMode !== "none",
        },
      });
    },
    [
      currentInquiryOrder,
      onActivityLog,
      setCollectionReflectionText,
      setPendingCollectionReflectionCardIds,
      setReturnToFinishAfterCollectionReflection,
      setShowCollectionReflectionPrompt,
    ],
  );

  const checkCollectionReflectionRequirement = useCallback(
    (nextRoundCardIds: string[]) => {
      if (showCollectionReflectionPrompt) return;
      const unreflectedIds = getUnreflectedCollectionCardIds(nextRoundCardIds);
      if (unreflectedIds.length >= COLLECTION_REFLECTION_BATCH_SIZE) {
        openCollectionReflectionPrompt(unreflectedIds);
      }
    },
    [
      getUnreflectedCollectionCardIds,
      openCollectionReflectionPrompt,
      showCollectionReflectionPrompt,
    ],
  );

  const addCardToCurrentRoundAndCheckReflection = useCallback(
    (cardId: string) => {
      setCurrentRoundCardIds((prev) => {
        const next = prev.includes(cardId) ? prev : [...prev, cardId];
        window.setTimeout(() => checkCollectionReflectionRequirement(next), 0);
        return next;
      });
    },
    [checkCollectionReflectionRequirement],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkCollectionReflectionRequirement(currentRoundCardIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checkCollectionReflectionRequirement, currentRoundCardIds]);

  const {
    persistInvestigationCardsNow,
    persistCurrentInvestigation,
    submitFinalSummary,
  } = useInquirySubmission<
    GameCard,
    GameCard,
    FinalSummary,
    InquiryIntroStageRecord | null
  >({
    token,
    draftStorageKey,
    conclusion: noEvidenceSummaryMode ? NO_EVIDENCE_CONCLUSION : conclusion,
    cards,
    confirmedEvidenceCards,
    currentRoundCardIds,
    collectionReflectionRecords,
    currentInquiryOrder,
    inquiryRecordOrder,
    orientationMainChoice,
    orientationTextInput,
    introStage,
    orientationCreatedAt,
    getIntroStageDisplay,
    getCompactEvidenceCardSummary,
    serializeUnlockedCard,
    isUnlockedRoundCard: (card, roundCardIds) =>
      card.unlocked && roundCardIds.includes(card.id),
    createFinalSummary,
    saveInvestigationSummary,
    onSubmitSummary,
    allowEmptyEvidenceSummary: noEvidenceSummaryMode,
  });

  const submitCollectionReflection = useCallback(() => {
    const reason = collectionReflectionText.trim();
    const requiredLength = getCollectionReflectionMinLength(
      pendingCollectionReflectionCardIds.length,
    );
    if (
      reason.length < requiredLength ||
      pendingCollectionReflectionCardIds.length === 0
    )
      return;

    const record: CollectionReflectionRecord = {
      id: `collection-reflection-${currentInquiryOrder}-${Date.now()}`,
      createdAt: nowIsoTimestamp(),
      inquiryOrder: currentInquiryOrder,
      cardIds: pendingCollectionReflectionCardIds,
      reason,
    };

    const finishModeAfterReflection = returnToFinishAfterCollectionReflection;
    const reflectedCardIds = new Set(record.cardIds);

    setUnlockedCardIds((prev) =>
      prev.map((item) => {
        const cardId = typeof item === "string" ? item : item.id;
        if (!reflectedCardIds.has(cardId)) return item;

        return {
          ...(typeof item === "string" ? { id: item } : item),
          note: reason,
          studentNote: reason,
          reflectionNote: reason,
        };
      }),
    );

    setCollectionReflectionRecords((prev) => [...prev, record]);
    setShowCollectionReflectionPrompt(false);
    setPendingCollectionReflectionCardIds([]);
    setCollectionReflectionText("");
    setReturnToFinishAfterCollectionReflection("none");

    onActivityLog?.({
      eventType: "collection_reflection_submit",
      eventLabel: "說明收藏五張數據卡的理由",
      targetType: "collectionBatch",
      targetId: record.id,
      newValue: reason,
      metadata: {
        inquiryOrder: currentInquiryOrder,
        cardIds: record.cardIds,
      },
    });

    void persistInvestigationCardsNow([], "card_change", [
      ...collectionReflectionRecords,
      record,
    ]).catch((error) => {
      console.error("同步五張卡蒐集理由失敗", error);
    });

    window.setTimeout(() => {
      if (finishModeAfterReflection === "summary") {
        void persistCurrentInvestigation()
          .catch((error) => {
            console.error("時間到後同步調查紀錄失敗", error);
          })
          .finally(() => {
            goInquiryStage("summary");
          });
        return;
      }

      if (finishModeAfterReflection === "confirm") {
        setShowFinishConfirm(true);
        return;
      }

      const latestUnreflectedIds = getUnreflectedCollectionCardIds(
        currentRoundCardIds,
        [...collectionReflectionRecords, record],
      );
      if (latestUnreflectedIds.length >= COLLECTION_REFLECTION_BATCH_SIZE) {
        openCollectionReflectionPrompt(latestUnreflectedIds);
      }
    }, 0);
  }, [
    collectionReflectionRecords,
    collectionReflectionText,
    currentInquiryOrder,
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    onActivityLog,
    openCollectionReflectionPrompt,
    pendingCollectionReflectionCardIds,
    persistCurrentInvestigation,
    persistInvestigationCardsNow,
    returnToFinishAfterCollectionReflection,
    goInquiryStage,
    setUnlockedCardIds,
    setCollectionReflectionText,
    setPendingCollectionReflectionCardIds,
    setReturnToFinishAfterCollectionReflection,
    setShowCollectionReflectionPrompt,
    setShowFinishConfirm,
  ]);

  const hasPendingCollectionReflection =
    showCollectionReflectionPrompt &&
    pendingCollectionReflectionCardIds.length > 0;
  const pendingCollectionReflectionMinLength = getCollectionReflectionMinLength(
    pendingCollectionReflectionCardIds.length,
  );
  const collectionReflectionTextLength = collectionReflectionText.trim().length;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const toAiCard = (card: GameCard) => {
      const profile = inferAiHelperCardProfileForClient(card);
      return {
        id: card.id,
        title: card.revealedTitle,
        category: card.category,
        categoryLabel: profile.categoryLabel,
        town: profile.town,
        dataType: profile.dataType,
        possibleUse: profile.possibleUse,
        crisisLinks: profile.crisisLinks,
        inquiryOrder: getStoredCardRound(card, currentInquiryOrder),
        collectionReason: getCollectionReflectionReasonForCard(card.id),
        content: String(card.content || "").slice(0, 180),
      };
    };

    const checkpointCardsForAi = pendingCollectionReflectionCards.map(toAiCard);
    const unlockedCardsForAi = unlockedCardsWithContent.map(toAiCard);
    const allUnlockedCardsForAi = allUnlockedCardsWithContent.map(toAiCard);
    const selectedCardsForAi = unlockedCardsWithContent
      .filter((card) => selectedEvidenceIds.includes(card.id))
      .map(toAiCard);
    const activeContextCards = hasPendingCollectionReflection
      ? checkpointCardsForAi
      : unlockedCardsForAi;

    window.dispatchEvent(
      new CustomEvent("cityauncel:ai-context", {
        detail: {
          pageKey: "cards",
          pageLabel: "數據清單",
          currentInquiryOrder,
          activeContextScope: hasPendingCollectionReflection
            ? "checkpoint"
            : "unlocked",
          activeContextLabel: hasPendingCollectionReflection
            ? "蒐集檢查站目前顯示的數據卡"
            : "本回合全部已解鎖數據卡",
          isCollectionCheckpointOpen: hasPendingCollectionReflection,
          activeContextCards,
          selectedCards: hasPendingCollectionReflection
            ? checkpointCardsForAi
            : selectedCardsForAi,
          unlockedCards: unlockedCardsForAi,
          allUnlockedCards: allUnlockedCardsForAi,
          checkpointCards: checkpointCardsForAi,
          selectedEvidenceCount: selectedCardsForAi.length,
          checkpointCardCount: checkpointCardsForAi.length,
          unlockedCardCount: unlockedCardsWithContent.length,
          allUnlockedCardCount: allUnlockedCardsWithContent.length,
          collectionReflectionText,
          collectionReflectionMinLength: pendingCollectionReflectionMinLength,
          focusText: hasPendingCollectionReflection
            ? collectionReflectionText
            : conclusion || inputValue || newInputValue || "",
        },
      }),
    );
  }, [
    currentInquiryOrder,
    selectedEvidenceIds,
    unlockedCardsWithContent,
    allUnlockedCardsWithContent,
    pendingCollectionReflectionCards,
    hasPendingCollectionReflection,
    collectionReflectionText,
    pendingCollectionReflectionMinLength,
    conclusion,
    inputValue,
    newInputValue,
    getCollectionReflectionReasonForCard,
  ]);
  const notifyAiHelperCardUnlocked = useCallback(
    (
      card: GameCard,
      source: "card_unlock" | "card_reunlock" | "interactive_snapshot_unlock",
    ) => {
      if (typeof window === "undefined") return;
      const profile = inferAiHelperCardProfileForClient(card);
      window.dispatchEvent(
        new CustomEvent("cityauncel:ai-helper-card-unlocked", {
          detail: {
            source,
            id: card.id,
            title: card.revealedTitle,
            category: card.category,
            categoryLabel: profile.categoryLabel,
            town: profile.town,
            dataType: profile.dataType,
            inquiryOrder: currentInquiryOrder,
          },
        }),
      );
    },
    [currentInquiryOrder],
  );

  const isConclusionTooShort =
    !noEvidenceSummaryMode && conclusion.trim().length <= CONCLUSION_MIN_LENGTH;

  useEffect(() => {
    if (!noEvidenceSummaryMode) return;
    if (conclusion.trim() === NO_EVIDENCE_CONCLUSION) return;

    const timer = window.setTimeout(() => {
      setConclusion(NO_EVIDENCE_CONCLUSION);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [conclusion, noEvidenceSummaryMode]);

  const handleRequestFinishInquiry = useCallback(() => {
    const unreflectedIds = getUnreflectedCollectionCardIds(currentRoundCardIds);
    if (unreflectedIds.length > 0) {
      setShowFinishConfirm(false);
      openCollectionReflectionPrompt(unreflectedIds, {
        force: true,
        finishMode: "confirm",
      });
      return;
    }

    setShowFinishConfirm(true);
  }, [
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    openCollectionReflectionPrompt,
    setShowFinishConfirm,
  ]);

  const handleDataListCountdownEnd = useCallback(() => {
    const unreflectedIds = getUnreflectedCollectionCardIds(currentRoundCardIds);
    setShowFinishConfirm(false);

    if (unreflectedIds.length > 0) {
      openCollectionReflectionPrompt(unreflectedIds, {
        force: true,
        finishMode: "summary",
      });
      return;
    }

    void persistCurrentInvestigation()
      .catch((error) => {
        console.error("時間到後同步調查紀錄失敗", error);
      })
      .finally(() => {
        goInquiryStage("summary");
      });
  }, [
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    goInquiryStage,
    openCollectionReflectionPrompt,
    persistCurrentInvestigation,
    setShowFinishConfirm,
  ]);
  useEffect(() => {
    handleDataListCountdownEndRef.current = handleDataListCountdownEnd;
  }, [handleDataListCountdownEnd]);

  const handleOpenCollectedPanel = useCallback(() => {
    setHasNewCollectedContent(false);
    onActivityLog?.({
      eventType: "collection_panel_open",
      eventLabel: "打開卡牌內容收藏",
      targetType: "panel",
      targetId: "collectedCards",
    });
  }, [onActivityLog]);

  const handleOpenTrophyPanel = useCallback(() => {
    setHasNewTitleReward(false);
    onActivityLog?.({
      eventType: "title_panel_open",
      eventLabel: "打開稱號收藏",
      targetType: "panel",
      targetId: "titles",
    });
  }, [onActivityLog]);

  const applyPendingCardUpdate = useCallback(() => {
    const pending = pendingCardUpdateRef.current;
    if (!pending) return;

    pendingCardUpdateRef.current = null;

    const { targetCard, content, wasUnlocked } = pending;

    if (!wasUnlocked) {
      setJustUnlockedId(targetCard.id);

      window.setTimeout(() => {
        setJustUnlockedId(null);
      }, 900);
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === targetCard.id
          ? {
              ...card,
              content,
              unlocked: true,
              unlockedAt: wasUnlocked
                ? card.unlockedAt
                : (targetCard.unlockedAt ?? nowIsoTimestamp()),
              sharedFromOtherPlayer: wasUnlocked
                ? card.sharedFromOtherPlayer
                : false,
            }
          : card,
      ),
    );
    setUnlockedCardIds((prev) => {
      const next = prev.filter((item) =>
        typeof item === "string"
          ? item !== targetCard.id
          : item.id !== targetCard.id,
      );

      return [
        ...next,
        serializeUnlockedCard(
          {
            ...targetCard,
            content,
            unlocked: true,
            unlockedAt: wasUnlocked
              ? (targetCard.unlockedAt ?? nowIsoTimestamp())
              : (targetCard.unlockedAt ?? nowIsoTimestamp()),
            sharedFromOtherPlayer: wasUnlocked
              ? targetCard.sharedFromOtherPlayer
              : false,
          },
          currentInquiryOrder,
        ),
      ];
    });

    if (!wasUnlocked) {
      shouldShowTitleRewardAnimationRef.current = true;

      const effect = getBalanceEffect(targetCard.category);
      setDevelopmentScore((prev) => prev + effect.development);
      setConservationScore((prev) => prev + effect.conservation);
    }

    addCardToCurrentRoundAndCheckReflection(targetCard.id);

    setHasNewCollectedContent(true);
    notifyAiHelperCardUnlocked(
      { ...targetCard, content, unlocked: true },
      wasUnlocked ? "card_reunlock" : "card_unlock",
    );
  }, [
    addCardToCurrentRoundAndCheckReflection,
    currentInquiryOrder,
    notifyAiHelperCardUnlocked,
    setUnlockedCardIds,
  ]);

  const handleReuseUnlockedCard = useCallback(async () => {
    if (!activeCard || !activeCard.unlocked || hasPendingCollectionReflection)
      return;

    addCardToCurrentRoundAndCheckReflection(activeCard.id);
    setHasNewCollectedContent(true);
    setJustUnlockedId(activeCard.id);
    window.setTimeout(() => setJustUnlockedId(null), 520);

    const content = activeCard.content.trim();

    setUnlockedCardIds((prev) => {
      const next = prev.filter((item) =>
        typeof item === "string"
          ? item !== activeCard.id
          : item.id !== activeCard.id,
      );

      return [
        ...next,
        serializeUnlockedCard(
          {
            ...activeCard,
            content,
            unlocked: true,
            unlockedAt: activeCard.unlockedAt ?? nowIsoTimestamp(),
          },
          currentInquiryOrder,
        ),
      ];
    });
    notifyAiHelperCardUnlocked(
      { ...activeCard, content, unlocked: true },
      "card_reunlock",
    );

    onActivityLog?.({
      eventType: "card_reunlock",
      eventLabel: "再次解鎖已解鎖卡牌",
      targetType: "card",
      targetId: activeCard.id,
      newValue: { cardId: activeCard.id },
      metadata: {
        title: activeCard.revealedTitle,
        category: activeCard.category,
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
      },
    });

    setActiveId(null);
    setInputValue("");
    setNewInputValue("");

    try {
      await persistInvestigationCardsNow([
        {
          ...activeCard,
          content,
          unlocked: true,
          unlockedAt: activeCard.unlockedAt ?? nowIsoTimestamp(),
        },
      ]);
    } catch (error) {
      console.error("同步再次解鎖卡牌到 investigation 失敗", error);
    }
  }, [
    activeCard,
    addCardToCurrentRoundAndCheckReflection,
    currentInquiryOrder,
    hasPendingCollectionReflection,
    notifyAiHelperCardUnlocked,
    onActivityLog,
    orientationCreatedAt,
    persistInvestigationCardsNow,
    setUnlockedCardIds,
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeCard || hasPendingCollectionReflection) return;

    const latestCard = cards.find((card) => card.id === activeCard.id);
    if (!latestCard) return;

    if (latestCard.unlocked) {
      await handleReuseUnlockedCard();
      return;
    }

    const targetCard = latestCard;
    const content = targetCard.content.trim();
    const unlockedAt = nowIsoTimestamp();

    setIsUnlocking(false);
    setShowFallingLock(false);
    setShowUnlockBurst(false);

    // 先關閉數據卡彈窗；等彈窗退場完成後，再由 AnimatePresence.onExitComplete
    // 呼叫 applyPendingCardUpdate，讓列表上的卡片才開始翻面。
    pendingCardUpdateRef.current = {
      targetCard: {
        ...targetCard,
        unlockedAt,
        sharedFromOtherPlayer: false,
      },
      content,
      wasUnlocked: false,
    };

    setActiveId(null);
    setInputValue("");
    setNewInputValue("");

    onActivityLog?.({
      eventType: "card_unlock",
      eventLabel: "直接解鎖數據卡",
      targetType: "card",
      targetId: targetCard.id,
      newValue: { cardId: targetCard.id },
      metadata: {
        title: targetCard.revealedTitle,
        category: targetCard.category,
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
      },
    });

    try {
      await persistInvestigationCardsNow([
        {
          ...targetCard,
          content,
          unlocked: true,
          unlockedAt,
          sharedFromOtherPlayer: false,
        },
      ]);
    } catch (error) {
      console.error("同步解鎖卡牌到 investigation 失敗", error);
    }
  };

  function handleCreateSnapshotCard(
    meta: EvidenceSnapshotMeta,
    reason: string,
    snapshotImageUrl?: string,
  ) {
    applySnapshotCardCreation<GameCard, StoredUnlockedCard | string>({
      meta,
      reason,
      snapshotImageUrl,
      currentInquiryOrder,
      orientationCreatedAt,
      createSnapshotCard: (cardMeta, cardReason, imageUrl) =>
        createSnapshotGameCard(cardMeta, cardReason, imageUrl, {
          buildSnapshotSvgDataUrl,
        }) as GameCard,
      setCards,
      addCardToCurrentRoundAndCheckReflection,
      setUnlockedCardIds,
      serializeUnlockedCard,
      setHasNewCollectedContent,
      notifyAiHelperCardUnlocked,
      setJustUnlockedId,
      shouldShowTitleRewardAnimationRef,
      snapshotCardScrollTimerRef,
      setFlashingSnapshotCardId,
      getBalanceEffect,
      setDevelopmentScore,
      setConservationScore,
      onActivityLog,
      persistInvestigationCardsNow,
    });
  }

  const isConclusionLocked =
    confirmedEvidenceCards.length === 0 && !noEvidenceSummaryMode;

  const introSummary = getIntroStageDisplay(introStage);

  function toggleEvidenceCard(cardId: string) {
    onActivityLog?.({
      eventType: "evidence_card_toggle",
      eventLabel: "勾選或取消證據卡牌",
      targetType: "evidenceCard",
      targetId: cardId,
    });

    setSelectedEvidenceIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function confirmEvidenceCards() {
    setConfirmedEvidenceIds(selectedEvidenceIds);
    onActivityLog?.({
      eventType: "evidence_cards_confirm",
      eventLabel: "確認數據探究證據卡牌",
      targetType: "evidenceCards",
      newValue: selectedEvidenceIds,
      metadata: {
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
        evidenceCards: unlockedCardsWithContent
          .filter((card) => selectedEvidenceIds.includes(card.id))
          .map((card) => ({
            id: card.id,
            title: card.revealedTitle,
            category: card.category,
            note: getCollectionReflectionReasonForCard(card.id),
          })),
      },
    });
  }
  function toggleEvidenceFlip(cardId: string) {
    setFlippedEvidenceIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function toggleEvidencePreviewFlip(cardId: string) {
    setEvidencePreviewFlippedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function handleEvidencePreviewPointerDown(
    cardId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    evidenceSwipeRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleEvidencePreviewPointerUp(
    cardId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const swipe = evidenceSwipeRef.current;
    evidenceSwipeRef.current = null;

    if (
      !swipe ||
      swipe.cardId !== cardId ||
      swipe.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (isHorizontalSwipe) {
      event.preventDefault();
      event.stopPropagation();
      toggleEvidencePreviewFlip(cardId);
      return;
    }

    if (confirmedEvidenceIds.length === 0) {
      toggleEvidenceCard(cardId);
    }
  }

  function handleEvidencePreviewPointerCancel(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    evidenceSwipeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  if (flowStage === "purpose") {
    return (
      <AnimatePresence mode="wait">
        <InquiryStageTransitionFrame
          stageKey={`purpose-${currentInquiryOrder}`}
        >
          <InquiryPurposePage
            selectedPurpose={inquiryPurpose}
            currentInquiryOrder={currentInquiryOrder}
            onSelect={(purpose) => {
              setInquiryPurpose(purpose);
              resetFollowUpAnswers();
              goInquiryStage("followUp");
            }}
            onBack={onBackToHome}
          />
        </InquiryStageTransitionFrame>
      </AnimatePresence>
    );
  }

  if (flowStage === "followUp") {
    return (
      <AnimatePresence mode="wait">
        <InquiryStageTransitionFrame
          stageKey={`followUp-${currentInquiryOrder}-${inquiryPurpose || "none"}`}
        >
          <InquiryFollowUpPage
            purpose={inquiryPurpose}
            currentInquiryOrder={currentInquiryOrder}
            selectedSuspects={selectedSuspects}
            task3Targets={task3Targets}
            suspectReason={suspectReason}
            suspectOtherDraft={suspectOtherDraft}
            suspectOtherText={suspectOtherText}
            task3OtherDraft={task3OtherDraft}
            possibleCrisis={possibleCrisis}
            otherPurpose={otherPurpose}
            onPurposeChange={setInquiryPurpose}
            onToggleSuspect={toggleSelectedSuspect}
            onToggleTask3Target={toggleTask3Target}
            onSuspectReasonChange={setSuspectReason}
            onSuspectOtherDraftChange={setSuspectOtherDraft}
            onSuspectOtherTextChange={setSuspectOtherText}
            onTask3OtherDraftChange={(value) => {
              setTask3OtherDraft(value);
              if (task3OtherText && value.trim() !== task3OtherText.trim())
                setTask3OtherText("");
            }}
            onTask3OtherTextChange={setTask3OtherText}
            onPossibleCrisisChange={setPossibleCrisis}
            onOtherPurposeChange={setOtherPurpose}
            onBack={() => goInquiryStage("purpose")}
            onNext={() => {
              const safeOrder = Math.max(1, Number(currentInquiryOrder || 1));

              if (safeOrder === 1 && inquiryPurpose === "task1_yes") {
                finishInquiryIntro("很好，讓我們來驗證你的想法吧~");
                return;
              }

              if (safeOrder === 1 && inquiryPurpose === "task1_no") {
                finishInquiryIntro("沒關係，讓我們開始蒐集線索吧~", "task1_no");
                return;
              }

              if (safeOrder === 2) {
                if (
                  selectedSuspects.length === 1 &&
                  selectedSuspects[0] === "unknown"
                ) {
                  finishInquiryIntro(
                    "沒關係，讓我們調查證據後再來抓犯人吧~",
                    "task2",
                  );
                  return;
                }

                finishInquiryIntro(
                  "很好，讓我們來用證據證明你的懷疑是對的吧~",
                  "task2",
                );
                return;
              }

              if (safeOrder === 3) {
                finishInquiryIntro("很好，讓我們繼續追查證據吧~");
                return;
              }

              if (safeOrder === 4) {
                finishInquiryIntro("你確定你的看法是正確的嗎?再去調查看看吧~");
                return;
              }

              if (safeOrder > 4) {
                finishInquiryIntro(
                  "很好，讓我們帶著這個目的開始探究吧~",
                  "free",
                );
              }
            }}
          />
        </InquiryStageTransitionFrame>
      </AnimatePresence>
    );
  }

  if (flowStage === "ready") {
    return (
      <InquiryReadyPage
        currentInquiryOrder={currentInquiryOrder}
        currentCase={currentCase}
        readyMessage={readyMessage}
        stageKey={`ready-${currentInquiryOrder}-${introStage || "none"}`}
        onBack={() => goInquiryStage("followUp")}
        onStart={() => {
          const nextOrientationCreatedAt = new Date().toISOString();
          setOrientationCreatedAt(nextOrientationCreatedAt);
          if (introStage) {
            onInquiryPlanCreated?.(introStage);
            if (token) {
              void createInquiryPlan(
                token,
                introStage,
                nextOrientationCreatedAt,
                inquiryRecordOrder || currentInquiryOrder,
              ).catch((error) => {
                console.error("儲存探究前導問題失敗", error);
              });
            }
            // inquiry_plan_create 由後端 /api/inquiry/plans 在成功儲存後統一寫入 student_activity_logs。
            // 這裡不要再呼叫 onActivityLog，避免同一個前導問題被前端 /api/activity-log 與後端 /api/inquiry/plans 各寫一次。
          }
          goInquiryStage("cards");
        }}
      />
    );
  }

  if (isFinished) {
    return (
      <div className="uiux-page-shell relative min-h-[100svh] overflow-x-hidden bg-[#f3efe6] px-3 py-4 text-stone-800 sm:px-4 sm:py-6 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.22),transparent_30%)]" />
          <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-stone-300/20 blur-[90px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c1ad]/25 blur-[110px]" />
        </div>
        <SubmitConfirmDialog
          open={showSubmitConfirm}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => {
            setShowSubmitConfirm(false);
            submitFinalSummary();
          }}
        />
        <div className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#fff8ec]/96 p-4 sm:rounded-[34px] sm:p-6 lg:p-8 shadow-[0_22px_70px_rgba(45,41,34,0.11)] backdrop-blur-md">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#d8cbb3]/80 pb-6">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-[#d8cbb3] bg-[#fffaf0] px-4 py-1 text-xs font-black tracking-[0.18em] text-[#7b5b37]">
                CASE CONCLUSION
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-[0.12em] text-[#332c24]">
                {currentCase.title}
              </h1>
            </div>
            <div className="rounded-2xl border border-[#d8cbb3] bg-white/62 px-4 py-3 text-sm font-black text-stone-600">
              已選證據：{confirmedEvidenceCards.length} 張
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
                <h2 className="mb-3 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                  {introSummary.firstTitle}
                </h2>

                <div className="relative min-h-[68px] overflow-hidden rounded-2xl border-2 border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.82)_10px_20px)] p-4 pr-24 font-medium leading-7 text-stone-600">
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-2.5 py-1 text-[11px] font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3 w-3" />
                    已鎖定
                  </span>
                  {introSummary.firstAnswer}
                </div>
              </section>
              <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
                <h2 className="mb-3 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                  {introSummary.secondTitle}
                </h2>

                <div className="relative min-h-[68px] overflow-hidden rounded-2xl border-2 border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.82)_10px_20px)] p-4 pr-24 font-medium leading-7 text-stone-600">
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-2.5 py-1 text-[11px] font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3 w-3" />
                    已鎖定
                  </span>
                  {introSummary.secondAnswer}
                </div>
              </section>
            </div>

            <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
              <h2 className="mb-4 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                3. 已解鎖的數據（挑選要當證據的數據）
              </h2>

              {unlockedCardsWithContent.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {unlockedCardsWithContent.map((card) => {
                    const isSelected = selectedEvidenceIds.includes(card.id);
                    const isPreviewFlipped = evidencePreviewFlippedIds.includes(
                      card.id,
                    );

                    return (
                      <div
                        key={card.id}
                        className={`relative min-h-[222px] w-full min-w-0 rounded-[22px] border-2 p-2 text-left transition [perspective:1100px] ${
                          isSelected
                            ? "scale-[1.01] border-[#4a382b] bg-[#fff4d8] shadow-[0_0_0_4px_rgba(216,203,179,0.78),0_16px_32px_rgba(74,56,43,0.18)] ring-2 ring-[#7b5b37] ring-offset-2 ring-offset-[#fffaf0]"
                            : "border-[#e2d4bd] bg-white/78 shadow-[0_10px_24px_rgba(45,41,34,0.07)] hover:border-[#b49a78] hover:bg-[#fffaf0]"
                        }`}
                      >
                        {isSelected ? (
                          <span className="absolute -right-2 -top-2 z-20 rounded-full border-2 border-[#fffaf0] bg-[#4a382b] px-3 py-1 text-xs font-black tracking-[0.12em] text-[#fffaf0] shadow-[0_8px_18px_rgba(74,56,43,0.28)]">
                            已選取
                          </span>
                        ) : null}

                        <div
                          role="button"
                          tabIndex={confirmedEvidenceIds.length > 0 ? -1 : 0}
                          aria-pressed={isSelected}
                          onPointerDown={(event) =>
                            handleEvidencePreviewPointerDown(card.id, event)
                          }
                          onPointerUp={(event) =>
                            handleEvidencePreviewPointerUp(card.id, event)
                          }
                          onPointerCancel={handleEvidencePreviewPointerCancel}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (confirmedEvidenceIds.length === 0) {
                                toggleEvidenceCard(card.id);
                              }
                            }
                          }}
                          className="block w-full touch-pan-y select-none rounded-[18px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#7b5b37]"
                          title="點擊卡牌可選取為證據；手指左右滑動圖片可翻面查看文字"
                        >
                          <motion.div
                            animate={{ rotateY: isPreviewFlipped ? 180 : 0 }}
                            transition={{ duration: 0.45 }}
                            className="relative h-[182px] w-full rounded-[18px] transform-gpu"
                            style={{ transformStyle: "preserve-3d" }}
                          >
                            <div
                              className="absolute inset-0 flex flex-col overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fff7ea]"
                              style={{ backfaceVisibility: "hidden" }}
                            >
                              <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryTabThemeMap[card.category].badge}`}
                                >
                                  {categoryMetaMap[card.category].label}
                                </span>

                                <h3 className="min-w-0 truncate text-xs font-black text-[#332c24]">
                                  {card.revealedTitle}
                                </h3>
                              </div>

                              <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-1.5">
                                {shouldUseWaterLiveSnapshotPreview(card) ? (
                                  <WaterLiveSnapshotCardPreview
                                    meta={card.snapshotMeta!}
                                    className="pointer-events-none h-full w-full"
                                  />
                                ) : (
                                  <img
                                    src={card.imageSrc}
                                    alt={card.revealedTitle}
                                    draggable={false}
                                    className="pointer-events-none h-full max-h-[145px] w-full object-contain"
                                  />
                                )}
                              </div>

                              <p className="shrink-0 border-t border-[#eadfcf] bg-white/55 px-2 py-0.5 text-center text-[10px] font-black tracking-[0.08em] text-[#7b5b37]">
                                左右滑動查看收藏狀態
                              </p>
                            </div>

                            <div
                              className="absolute inset-0 flex flex-col rounded-[18px] border border-[#eadfcf] bg-[#fff7ea] p-2.5"
                              style={{
                                transform: "rotateY(180deg)",
                                backfaceVisibility: "hidden",
                              }}
                            >
                              <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryTabThemeMap[card.category].badge}`}
                                >
                                  {categoryMetaMap[card.category].label}
                                </span>
                                <h3 className="min-w-0 truncate text-xs font-black text-[#332c24]">
                                  {card.revealedTitle}
                                </h3>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-[#eadfcf] bg-white/94 p-2.5 pr-1.5">
                                <p className="whitespace-pre-wrap break-words text-xs font-medium leading-5 text-stone-700">
                                  {getCollectionReflectionReasonForCard(
                                    card.id,
                                  )}
                                </p>
                              </div>

                              <p className="mt-1.5 shrink-0 text-center text-[10px] font-black tracking-[0.08em] text-[#7b5b37]">
                                左右滑動返回圖片
                              </p>
                            </div>
                          </motion.div>
                        </div>

                        <div
                          className={`mt-1.5 shrink-0 rounded-full px-3 py-0.5 text-center text-[11px] font-black tracking-[0.08em] ${
                            isSelected
                              ? "bg-[#4a382b] text-[#fffaf0]"
                              : "bg-[#fffaf0] text-[#7b5b37]"
                          }`}
                        >
                          {isSelected
                            ? "目前已選取這筆數據"
                            : "點擊數據選取證據"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 font-bold leading-7 text-amber-800">
                  這次探究沒有解鎖任何數據卡，因此不需要選擇證據卡。系統會以「本次探究無任何發現」完成本案調查書。
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={confirmEvidenceCards}
                  disabled={
                    selectedEvidenceIds.length === 0 ||
                    confirmedEvidenceIds.length > 0
                  }
                  className="rounded-2xl border-2 border-[#3e3025] bg-gradient-to-br from-[#6f523d] to-[#3f3023] px-5 py-3 font-black text-[#fffaf0] shadow-[0_7px_0_rgba(47,36,27,0.30),0_12px_24px_rgba(47,36,27,0.20)] hover:from-[#7f6048] hover:to-[#4a382b] disabled:cursor-not-allowed disabled:border-[#b8aa94] disabled:bg-none disabled:bg-[#d8cbb3] disabled:text-[#7a6754] disabled:opacity-100"
                >
                  {confirmedEvidenceIds.length > 0 ? "已鎖定選擇" : "鎖定選取"}
                </Button>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
              <h2 className="mb-4 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                4. 本次案件已選定的證據
              </h2>

              {confirmedEvidenceCards.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {confirmedEvidenceCards.map((card) => {
                    const isFlipped = flippedEvidenceIds.includes(card.id);

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => toggleEvidenceFlip(card.id)}
                        className="aspect-[22/21] w-full min-w-0 rounded-[24px] text-left [perspective:1000px] sm:w-[calc((100%_-_1rem)_/_2)] lg:w-[calc((100%_-_3rem)_/_4)]"
                      >
                        <motion.div
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.45 }}
                          className="relative h-full w-full rounded-[24px] transform-gpu"
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          <div
                            className="absolute inset-0 flex flex-col overflow-hidden rounded-[24px] border border-[#e2d4bd] bg-[#fff7ea] p-1.5 shadow-[0_12px_30px_rgba(45,41,34,0.08)]"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fffaf0]">
                              {shouldUseWaterLiveSnapshotPreview(card) ? (
                                <WaterLiveSnapshotCardPreview
                                  meta={card.snapshotMeta!}
                                  className="h-full w-full"
                                />
                              ) : (
                                <img
                                  src={card.imageSrc}
                                  alt={card.revealedTitle}
                                  className="h-full w-full object-contain"
                                />
                              )}
                            </div>

                            <div className="shrink-0 px-2 pb-1.5 pt-1">
                              <h3 className="line-clamp-2 w-full text-center text-sm font-black leading-5 text-[#332c24]">
                                {card.revealedTitle}
                              </h3>

                              <p className="mt-0.5 text-center text-[11px] font-bold leading-4 text-stone-400">
                                點擊查看圖片與收藏狀態
                              </p>
                            </div>
                          </div>
                          <div
                            className="absolute inset-0 flex flex-col overflow-hidden rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0] p-1.5 shadow-[0_12px_30px_rgba(45,41,34,0.08)]"
                            style={{
                              transform: "rotateY(180deg)",
                              backfaceVisibility: "hidden",
                            }}
                          >
                            <div className="shrink-0 px-2 pb-1 pt-0.5">
                              <p className="text-center text-xs font-black leading-4 text-[#7b5b37]">
                                收藏狀態
                              </p>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[18px] border border-[#eadfcf] bg-white/78 p-2.5">
                              <p className="whitespace-pre-wrap break-words text-xs font-medium leading-5 text-stone-700">
                                {getCollectionReflectionReasonForCard(card.id)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e2d4bd] bg-white/70 p-4 font-medium text-stone-500">
                  {noEvidenceSummaryMode
                    ? "本次探究沒有可選擇的證據卡。"
                    : "尚未選定證據"}
                </div>
              )}
            </section>

            <section
              className={`rounded-[28px] border p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)] ${
                isConclusionLocked
                  ? "border-[#b8aa94] bg-[#eee5d6]/88"
                  : "border-[#d8cbb3] bg-[#fffaf0]/86"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
                  5. 本案的結論是什麼？
                </h2>
                {isConclusionLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-3 py-1 text-xs font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3.5 w-3.5" />
                    先選定證據才可撰寫
                  </span>
                ) : noEvidenceSummaryMode ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black tracking-[0.12em] text-amber-800">
                    無發現結案
                  </span>
                ) : null}
              </div>

              {isConclusionLocked ? (
                <p className="mb-3 rounded-2xl border border-dashed border-[#b8aa94] bg-[#fffaf0]/72 px-4 py-3 text-sm font-black text-stone-600">
                  目前此區塊已鎖定，請先在第 3 題選取數據並按下「鎖定選取」。
                </p>
              ) : noEvidenceSummaryMode ? (
                <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-black leading-6 text-amber-800">
                  因為本次探究沒有解鎖任何數據卡，結論已由系統填入。請直接送出調查書完成本次探究。
                </p>
              ) : null}

              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                placeholder={
                  isConclusionLocked
                    ? "此區塊尚未開放撰寫"
                    : currentCase.conclusionPrompt
                }
                rows={8}
                disabled={isConclusionLocked || noEvidenceSummaryMode}
                className={`w-full rounded-2xl border p-4 text-base font-medium leading-7 outline-none transition ${
                  isConclusionLocked || noEvidenceSummaryMode
                    ? "cursor-not-allowed border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.78)_10px_20px)] text-stone-500 placeholder:text-stone-500"
                    : "border-[#d8cbb3] bg-white/78 text-stone-800 focus:border-[#9b7b55] focus:ring-4 focus:ring-[#d8cbb3]/35"
                }`}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-stone-500">
                <span>
                  {noEvidenceSummaryMode
                    ? "無發現結案不需補寫字數"
                    : `結論撰寫須至少 ${CONCLUSION_MIN_LENGTH} 字以上`}
                </span>
                <span
                  className={
                    isConclusionTooShort && !isConclusionLocked
                      ? "text-amber-700"
                      : "text-stone-500"
                  }
                >
                  {conclusion.trim().length} / {CONCLUSION_MIN_LENGTH + 1}
                </span>
              </div>
            </section>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={
                  isConclusionTooShort ||
                  (confirmedEvidenceCards.length === 0 &&
                    !noEvidenceSummaryMode)
                }
                className="rounded-2xl border-2 border-[#2f241b] bg-gradient-to-br from-[#70513b] to-[#3f3023] px-6 py-4 font-black text-[#fffaf0] shadow-[0_8px_0_rgba(47,36,27,0.32),0_14px_28px_rgba(47,36,27,0.20)] hover:from-[#806048] hover:to-[#4a382b] disabled:cursor-not-allowed disabled:border-[#b8aa94] disabled:bg-none disabled:bg-[#d8cbb3] disabled:text-[#7a6754] disabled:opacity-100"
              >
                送出調查書
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inquiryPageBackgroundColor = activeCategory
    ? categoryListThemeMap[activeCategory].pageBg
    : "rgba(255, 243, 207, 0.92)";

  return (
    <div
      className="relative min-h-[100svh] overflow-x-hidden text-stone-800"
      style={{ backgroundColor: inquiryPageBackgroundColor }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.78),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.18),transparent_30%)]" />
        <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-white/32 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c99a]/24 blur-[110px]" />
      </div>
      {!activeCard ? (
        <>
          <MemoizedBalanceScaleBackground
            developmentScore={developmentScore}
            conservationScore={conservationScore}
          />
        </>
      ) : null}

      {dataListCountdownDeadline !== null || dataListTimerNotice === "done" ? (
        <DataListCountdownTimer
          remainingMs={dataListRemainingMs}
          notice={dataListTimerNotice}
        />
      ) : null}

      {!activeCard ? (
        <>
          <MemoizedCollectedCardsPanel
            cards={cards}
            currentRoundCardIds={currentRoundCardIds}
            onOpenCard={openCollectedPreview}
            hasNewContent={hasNewCollectedContent}
            onOpenPanel={handleOpenCollectedPanel}
          />

          <MemoizedTrophyPanel
            titles={earnedTitles}
            hasNewTitle={hasNewTitleReward}
            onOpenPanel={handleOpenTrophyPanel}
          />
        </>
      ) : null}

      <MemoizedTitleRewardCelebration reward={pendingReward} />

      <MemoizedCollectedCardPreview
        card={previewCard}
        onClose={closeCollectedPreview}
      />

      <AnimatePresence>
        {hasPendingCollectionReflection ? (
          <motion.div
            className="fixed inset-0 z-[92] flex items-center justify-center bg-[#2f2418]/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="flex max-h-[calc(100svh-1.5rem)] w-[min(860px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[32px] border border-amber-200 bg-[#fffaf0] shadow-[0_28px_80px_rgba(69,39,16,0.28)]"
              initial={{ y: 28, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-4 overscroll-contain sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-3xl bg-amber-100 p-3 text-amber-700">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black tracking-[0.22em] text-amber-700">
                      蒐集檢查站
                    </p>
                    <h2 className="mt-1 text-xl font-black text-stone-900 sm:text-2xl">
                      你目前蒐集了 {pendingCollectionReflectionCards.length}{" "}
                      張數據卡！
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-stone-600">
                      辛苦了，先停一下，說明你為什麼蒐集這些卡。完成後，才能繼續調查喔~
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {pendingCollectionReflectionCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-amber-100 bg-white p-1.5 shadow-sm"
                    >
                      <div className="flex h-[clamp(5.5rem,18svh,8rem)] items-center justify-center overflow-hidden rounded-xl bg-[#fffdf8]">
                        {shouldUseWaterLiveSnapshotPreview(card) ? (
                          <WaterLiveSnapshotCardPreview
                            meta={card.snapshotMeta!}
                            className="h-full w-full"
                          />
                        ) : (
                          <img
                            src={card.imageSrc}
                            alt={card.revealedTitle}
                            className="h-full w-full object-contain"
                          />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-center text-xs font-bold leading-5 text-stone-700">
                        {card.revealedTitle}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl border border-amber-100 bg-white p-3">
                  <label className="text-sm font-black text-stone-800">
                    為什麼你想蒐集這些數據卡？
                  </label>
                  <textarea
                    value={collectionReflectionText}
                    onChange={(event) =>
                      setCollectionReflectionText(event.target.value)
                    }
                    rows={3}
                    placeholder="例如：我想知道這些地區是不是和石虎危機有關，這些卡可以幫我比較道路、土地或石虎出現的線索。"
                    className="mt-2 w-full resize-none rounded-2xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm font-medium leading-5 text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-400 focus:bg-white"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-stone-500">
                    <span>
                      {"蒐集 "}
                      {pendingCollectionReflectionCardIds.length}
                      {" 張數據卡，至少寫 "}
                      {pendingCollectionReflectionMinLength}
                      {" 個字說明理由。"}
                    </span>
                    <span>
                      {collectionReflectionTextLength} /{" "}
                      {pendingCollectionReflectionMinLength}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end bg-[#fffaf0] px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
                <Button
                  type="button"
                  onClick={submitCollectionReflection}
                  disabled={
                    collectionReflectionTextLength <
                    pendingCollectionReflectionMinLength
                  }
                  className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-white shadow-[0_12px_28px_rgba(245,158,11,0.28)] hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
                >
                  寫好了，繼續調查
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showFinishConfirm ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2418]/42 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] p-6 shadow-[0_24px_70px_rgba(45,41,34,0.18)]"
            >
              <h2 className="font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
                確定本次案件都調查完了嗎？
              </h2>

              <p className="mt-3 text-sm font-medium leading-7 text-stone-600">
                確認結束後會進入案件結論畫面，為你的調查做最終的整理
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowFinishConfirm(false)}
                  className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
                >
                  繼續追查
                </Button>

                <Button
                  type="button"
                  onClick={async () => {
                    setShowFinishConfirm(false);
                    await persistCurrentInvestigation();
                    goInquiryStage("summary");
                  }}
                  className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
                >
                  確認結束
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.div
        className={`relative z-10 mx-auto w-full max-w-7xl overflow-x-hidden px-6 pb-12 pt-10 ${
          activeCard ? "pointer-events-none" : ""
        } ${!activeCategory ? "flex min-h-[100svh] flex-col justify-center" : ""}`}
      >
        <div>
          <MemoizedCategoryTabs
            activeCategory={activeCategory}
            onChange={handleChangeCategory}
            unlockedCountByCategory={unlockedCountByCategory}
            totalCountByCategory={totalCountByCategory}
            totalUnlockedCount={totalUnlockedCount}
            totalCardCount={totalCardCount}
            currentInquiryTitle={currentCase.title}
            onRequestFinish={handleRequestFinishInquiry}
          />
        </div>

        {activeCategory === "water" ? <div className="mb-6" /> : null}

        {activeCategory ? (
          <div className="w-full">
            {activeCategory === "water" ? (
              <InteractiveDataSnapshotPanel
                key={activeCategory}
                activeCategory={activeCategory}
                token={token}
                onCreateSnapshotCard={handleCreateSnapshotCard}
              />
            ) : null}

            {CATEGORY_KEYS.map((category) =>
              mountedCategories.has(category) ? (
                <GameCardGrid
                  key={category}
                  categoryCards={categoryCardsByCategory[category]}
                  activeId={activeId}
                  activeCategoryMeta={categoryMetaMap[category]}
                  onOpenCard={openCard}
                  justUnlockedId={justUnlockedId}
                  flashingSnapshotCardId={flashingSnapshotCardId}
                  categoryFlipKey={categoryFlipKey}
                  isActive={activeCategory === category}
                />
              ) : null,
            )}
          </div>
        ) : null}
      </motion.div>

      <AnimatePresence
        onExitComplete={() => {
          setIsModalReady(false);
          applyPendingCardUpdate();
        }}
      >
        {activeCard ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#2f2418]/42 p-3 sm:p-4"
            onClick={closeCard}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-[min(94vw,1180px)] transform-gpu will-change-transform"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {isModalReady ? (
                <div className="max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-[26px] border border-white/70 bg-[#f8fafc]/96 p-3 shadow-[0_24px_76px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:rounded-[30px] md:max-h-[calc(100svh-2rem)]">
                  <div className="mb-2.5 flex items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:px-5">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-slate-400">
                        DATA CARD
                      </p>
                      <h1 className="mt-1 text-lg font-black tracking-[0.04em] text-slate-900 sm:text-xl">
                        數據卡預覽與蒐集
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={closeCard}
                      disabled={isUnlocking}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-black shadow-sm transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                      style={{ color: "#000000" }}
                      aria-label="關閉數據卡"
                    >
                      <X
                        className="h-5 w-5"
                        color="#000000"
                        strokeWidth={2.4}
                      />
                    </button>
                  </div>

                  <div className="uiux-card-modal-grid min-[700px]:items-stretch">
                    <section className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_16px_46px_rgba(15,23,42,0.1)]">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                        <div>
                          <p className="text-xs font-black tracking-[0.16em] text-slate-400">
                            預覽數據卡
                          </p>
                          <p className="mt-1 text-base font-black leading-snug text-slate-800 sm:text-lg">
                            {activeCard.unlocked
                              ? activeCard.revealedTitle
                              : activeCard.title}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                            writtenCardStateMap[activeCard.category].badge
                          }`}
                        >
                          {categoryMetaMap[activeCard.category].label}
                        </span>
                      </div>

                      <div className="relative flex h-[clamp(260px,50svh,520px)] w-full items-center justify-center overflow-hidden rounded-[22px] border border-[#e2d4bd] bg-[linear-gradient(135deg,#fffdf8_0%,#fffaf0_54%,#fff4df_100%)] shadow-inner md:h-[clamp(340px,58svh,560px)]">
                        <div className="flex h-full w-full min-w-0 items-center justify-center overflow-auto p-3 sm:p-4">
                          {shouldUseWaterLiveSnapshotPreview(activeCard) ? (
                            activeCard.imageSrc ? (
                              <img
                                src={activeCard.imageSrc}
                                alt={activeCard.title}
                                loading="eager"
                                decoding="async"
                                className="block h-auto max-h-full w-auto max-w-full object-contain transform-gpu will-change-transform"
                              />
                            ) : (
                              <div className="h-full w-full overflow-auto rounded-2xl bg-[#fffdf8] p-2">
                                <WaterLiveSnapshotView
                                  meta={activeCard.snapshotMeta!}
                                />
                              </div>
                            )
                          ) : (
                            <img
                              src={activeCard.imageSrc}
                              alt={activeCard.title}
                              loading="eager"
                              decoding="async"
                              className="block h-auto max-h-full w-auto max-w-full object-contain transform-gpu will-change-transform"
                            />
                          )}
                        </div>

                        <AnimatePresence>
                          {showFallingLock && !showUnlockBurst ? (
                            <motion.div
                              className="absolute left-1/2 top-[3%] z-20 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border border-sky-200 bg-sky-50 shadow-[0_10px_26px_rgba(56,189,248,0.24)]"
                              initial={{
                                y: 0,
                                scale: 1,
                                rotate: -8,
                                opacity: 1,
                              }}
                              animate={{
                                y: 205,
                                scale: 1.25,
                                rotate: 0,
                                opacity: 1,
                              }}
                              exit={{ opacity: 0, scale: 1.45 }}
                              transition={{
                                duration: 0.32,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <Lock
                                className={`h-12 w-12 ${writtenCardStateMap[activeCard.category].iconText}`}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>

                        <AnimatePresence>
                          {showUnlockBurst ? (
                            <motion.div
                              className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                              initial={{ opacity: 0, scale: 0.75 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.25 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                              <motion.div
                                className={`flex h-28 w-28 items-center justify-center rounded-full border shadow-[0_0_48px_rgba(56,189,248,0.55)] ${writtenCardStateMap[activeCard.category].iconBg}`}
                                animate={{
                                  scale: [1, 1.18, 1],
                                  rotate: [0, -8, 8, 0],
                                }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              >
                                <Unlock
                                  className={`h-14 w-14 ${writtenCardStateMap[activeCard.category].iconText}`}
                                />
                              </motion.div>

                              <motion.div
                                className="absolute h-40 w-40 rounded-full border-4 border-sky-200/70"
                                initial={{ scale: 0.5, opacity: 0.9 }}
                                animate={{ scale: 1.45, opacity: 0 }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              />

                              <motion.div
                                className="absolute h-56 w-56 rounded-full bg-sky-200/20 blur-2xl"
                                initial={{ scale: 0.4, opacity: 0.8 }}
                                animate={{ scale: 1.4, opacity: 0 }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </section>

                    <Card className="min-w-0 border-slate-200 bg-white text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,0.11)]">
                      <CardContent className="flex h-full flex-col p-4 lg:p-5">
                        <div className="mb-3">
                          <p className="text-xs font-black tracking-[0.16em] text-slate-400">
                            DATA COLLECTION
                          </p>
                          <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
                            要收藏這張數據卡嗎？
                          </h2>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                            請先預覽這張數據卡，先把覺得有用的蒐集起來
                          </p>
                        </div>

                        <form
                          onSubmit={handleSubmit}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-full flex-col space-y-3"
                        >
                          <div className="grid gap-2 2xl:grid-cols-[minmax(135px,0.4fr)_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <label className="text-sm font-black tracking-[0.08em] text-slate-700">
                                小卡分類
                              </label>
                              <div
                                className={`flex min-h-[46px] items-center rounded-2xl border px-3 py-2 text-sm font-black ${
                                  writtenCardStateMap[activeCard.category].badge
                                }`}
                              >
                                <span
                                  className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${writtenCardStateMap[activeCard.category].iconBg}`}
                                >
                                  <span
                                    className={
                                      writtenCardStateMap[activeCard.category]
                                        .iconText
                                    }
                                  >
                                    {categoryMetaMap[activeCard.category].icon}
                                  </span>
                                </span>
                                {categoryMetaMap[activeCard.category].label}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-black tracking-[0.08em] text-slate-700">
                                小卡名字
                              </label>
                              <div className="flex min-h-[46px] items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black leading-relaxed text-slate-800">
                                {activeCard.unlocked
                                  ? activeCard.revealedTitle
                                  : activeCard.title}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-sky-100 bg-sky-50/70 px-4 py-4 text-sm font-medium leading-6 text-slate-700">
                            {activeCard.unlocked ? (
                              currentRoundCardIds.includes(activeCard.id) ? (
                                <>
                                  這張卡已經放進本次收藏。等你累積到{" "}
                                  {COLLECTION_REFLECTION_BATCH_SIZE}
                                  張，系統會請你整理一次蒐集理由。
                                </>
                              ) : (
                                <>
                                  這張卡以前已經解鎖過。這一輪如果還想使用它，請按「再次解鎖」放進本次收藏。
                                </>
                              )
                            ) : (
                              <>
                                判斷數據卡對你的調查是否有幫助，"有"就直接收藏起來，"沒有"就去蒐集其他有用的數據卡吧~
                              </>
                            )}
                          </div>

                          {hasPendingCollectionReflection ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                              你已經蒐集滿 {COLLECTION_REFLECTION_BATCH_SIZE}
                              張卡，請先完成「蒐集檢查站」，再繼續解鎖其他數據卡。
                            </div>
                          ) : null}

                          <div className="mt-auto flex flex-col justify-end gap-2 pt-2 sm:flex-row sm:gap-3">
                            <Button
                              type="submit"
                              onClick={(e) => e.stopPropagation()}
                              disabled={
                                isUnlocking ||
                                hasPendingCollectionReflection ||
                                (activeCard.unlocked &&
                                  currentRoundCardIds.includes(activeCard.id))
                              }
                              className="rounded-2xl border border-amber-300 bg-amber-100 px-5 py-4 font-black text-amber-900 shadow-[0_10px_24px_rgba(217,119,6,0.12)] hover:bg-amber-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              {activeCard.unlocked
                                ? currentRoundCardIds.includes(activeCard.id)
                                  ? "已成為本次線索"
                                  : "再次蒐集"
                                : "蒐集這張數據卡"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex h-[min(520px,58svh)] min-h-[320px] items-center justify-center rounded-[24px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)] sm:rounded-[32px]">
                  <div className="text-sm font-medium text-slate-500">
                    小卡準備中...
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
