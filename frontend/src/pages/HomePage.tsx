/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 HomePage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomeHeader } from "@/features/home/HomeHeader";
import { useRafNumberState } from "@/features/home/hooks/useRafNumberState";
import { TaskOneCard } from "@/features/home/TaskOneCard";
import { TaskTwoMapPreview } from "@/features/home/TaskTwoMapPreview";
import { useHomeRealtime } from "@/features/home/hooks/useHomeRealtime";
import { useHomeTeacherControlState } from "@/features/home/hooks/useHomeTeacherControlState";
import {
  clearHomeUiState,
  clearStoredPage,
  readHomeUiState,
  readStoredPage,
  saveHomeUiState,
  saveStoredPage,
  stableMapText,
  type MapChoice,
  type MapState,
  type Page,
} from "@/features/home/homePageStateStorage";
import {
  isCompletedFinalSummary,
  upsertFinalSummary,
  type FinalSummary,
} from "@/features/home/finalSummaryModel";
import {
  getInvestigationCaseByOrder,
  getInvestigationCaseBySummary,
  getNextInvestigationCase,
} from "@/features/home/investigationCases";
import {
  FinalEndingCountdownOverlay,
  FinalEndingPage,
  StudentScreenLockOverlay,
} from "@/features/home/ending/FinalEndingViews";
import {
  clearHandledFinalSettlementKey,
  getFinalSettlementSignature,
  readHandledFinalSettlementKey,
  writeHandledFinalSettlementKey,
  type FinalDecisionSettlement,
} from "@/features/home/finalSettlement/finalSettlementModel";
import {
  isSupportedHomeTitleReward,
  type TitleReward,
} from "@/features/home/titleRewardModel";
import { TitleRewardToast } from "@/features/home/TitleRewardToast";
import {
  DEFAULT_SUSPECT_ROLE_RANKING,
  SUSPECT_GROUPS,
} from "@/features/home/suspectVoting/suspectVotingModel";
import { SuspectVotingModal } from "@/features/home/suspectVoting/SuspectVotingModal";
import {
  ReportPage,
  ReportPreviewModal,
  StatCard,
} from "@/features/home/report/ReportViews";
import { HomeTitleCollectionSection } from "@/features/home/titleCollection/HomeTitleCollectionSection";
import {
  getMapDecisionChoice,
  type ActivityLogPayload,
  type AuthUser,
  type GroupPersonalMap,
  type PendingReportReveal,
  type RealtimeCardPackLockSignal,
  type RegionDecisionMap,
  type SuspectVotingStatus,
} from "@/features/home/homePageTypes";
import { PageLoadingFallback, PageTransitionFrame } from "@/features/home/HomePageShell";
import {
  clamp,
  GAME_BTN,
  GAME_BTN_BLUE,
  GAME_BTN_DISABLED,
} from "@/features/home/homeUiConstants";

import MiaoliMap, { type MapUnlockedCardData } from "./MiaoliMap";
import {
  MIAOLI_MAP_VIEW_BOX,
  labelPositions,
  regions,
} from "../data/miaoliMapView";
import AuthPage from "./AuthPage";
import ControlPage, { TeacherManagementCenter } from "./ControlPage";
import BarrageLayer from "../components/BarrageLayer";
import AiInquiryAssistant from "@/features/inquiry/ai";
import { createInquiryRecord, loadInquiryData } from "../api/inquiryApi";
import { ApiRequestError } from "../api/apiClient";
import {
  getClassFinalDecisions,
  getClassGroupDecisions,
  getGroupPersonalMaps,
  getMapTaskStatus,
  getMe,
  getSuspectVotingStatus,
  getUserMap,
  lockGroupMap,
  lockUserMap,
  saveFinalMapDecision,
  saveUserMapState,
  submitSuspectVotes,
  writeActivityLog,
} from "../api/homeApi";
import type {
  ClassGroupDecisionItemApi,
  MapLockStatusApi,
  VotingStatusApi,
} from "../api/homeApi";
import {
  clearAuthSession,
  readStoredToken,
  readStoredUser,
  saveAuthSession,
  saveStoredUser,
} from "../storage/authStorage";
import {
  clearHomeProgressCache,
  readHomePageDraft,
  saveHomePageDraft,
} from "../storage/homeDraftStorage";
import { clearApiCacheForCurrentUser } from "../api/apiResponseCache";
import { flushPendingWrites, removePendingWritesByDedupeKey } from "../api/pendingWriteQueue";
import { normalizeActivityLogPayload } from "@/utils/payloadNormalization";
import {
  canUseBrowserFullscreen,
  shouldUseCssImmersiveMode,
} from "@/utils/displayMode";
type MapSyncStatus = {
  state: "live" | "syncing" | "synced" | "unstable";
  text: string;
  updatedAt?: number;
};

const preloadInquiryDataPage = () => import("./InquiryData");
const preloadCardPackPage = () => import("./CardPackPage");
const preloadBehaviorRecordPage = () => import("./BehaviorRecord");

const InquiryData = lazy(preloadInquiryDataPage);
const CardPackPage = lazy(preloadCardPackPage);
const BehaviorRecord = lazy(preloadBehaviorRecordPage);

// 首頁負責讀取登入者狀態、任務進度與教師端控制後的入口顯示。
export default function HomePage() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    readStoredUser(),
  );
  type UnlockedCardData =
    | string
    | {
        id: string;
        content?: string;
        note?: string;
        studentNote?: string;
        reflectionNote?: string;
        unlockedAt?: string | number | null;
      };

  const initialHomeDraft = readHomePageDraft(currentUser?.id);
  const initialHomeUiState = readHomeUiState(currentUser?.id);
  const [unlockedCards, setUnlockedCards] = useState<UnlockedCardData[]>([]);
  const [page, setPage] = useState<Page>(() => {
    const storedPage = readStoredPage(currentUser?.id);
    if (
      currentUser?.role !== "teacher" &&
      (storedPage === "teacherGroups" || storedPage === "teacherStudentData")
    ) {
      return "home";
    }
    return storedPage;
  });
  const [orientationMainChoice, setOrientationMainChoice] = useState(
    initialHomeDraft?.orientationMainChoice ?? "",
  );
  const [orientationTextInput, setOrientationTextInput] = useState(
    initialHomeDraft?.orientationTextInput ?? "",
  );
  const [finalSummaries, setFinalSummaries] = useState<FinalSummary[]>([]);
  const [activeInquiryRecordOrder, setActiveInquiryRecordOrder] = useState<
    number | null
  >(
    initialHomeUiState.activeInquiryRecordOrder != null &&
      Number.isFinite(Number(initialHomeUiState.activeInquiryRecordOrder))
      ? Number(initialHomeUiState.activeInquiryRecordOrder)
      : null,
  );
  const [isInquiryTaskOpen, setIsInquiryTaskOpen] = useState(true);
  const [inquiryLockHint, setInquiryLockHint] = useState(false);
  const [isMapTaskOpen, setIsMapTaskOpen] = useState(false);
  const [isCardPackOpen, setIsCardPackOpen] = useState(false);
  const [isStudentScreenLocked, setIsStudentScreenLocked] = useState(false);
  const [isAiHelperAvailable, setIsAiHelperAvailable] = useState(false);
  const [votingStatus, setVotingStatus] = useState<SuspectVotingStatus>({
    isOpen: false,
    isFinalized: false,
    finalizedSuspects: [],
    finalizedAt: null,
    totals: {},
    totalVoters: 0,
    totalEligibleVoters: 0,
    myVotes: [],
  });
  const [finalDecisionSettlement, setFinalDecisionSettlement] =
    useState<FinalDecisionSettlement>({ isFinalized: false });
  const [finalEndingCountdown, setFinalEndingCountdown] = useState<
    number | null
  >(null);
  const [draftSuspectVotes, setDraftSuspectVotes] = useState<string[]>([]);
  const [suspectVoteMessage, setSuspectVoteMessage] = useState("");
  const [isSubmittingSuspectVote, setIsSubmittingSuspectVote] = useState(false);
  const [reportPageIndex, setReportPageIndex] = useState(
    Number.isFinite(Number(initialHomeUiState.reportPageIndex))
      ? Math.max(0, Number(initialHomeUiState.reportPageIndex))
      : 0,
  );
  const [mapPreviewPageIndex, setMapPreviewPageIndex] = useState(
    Number.isFinite(Number(initialHomeUiState.mapPreviewPageIndex))
      ? Math.max(0, Number(initialHomeUiState.mapPreviewPageIndex))
      : 0,
  );
  const [reportDragOffset, scheduleReportDragOffset, setReportDragOffsetNow] =
    useRafNumberState(0);
  const [mapDragOffset, scheduleMapDragOffset, setMapDragOffsetNow] =
    useRafNumberState(0);
  const reportDragStartXRef = useRef<number | null>(null);
  const reportPressReportIndexRef = useRef<number | null>(null);
  const mapDragStartXRef = useRef<number | null>(null);
  const reportDidDragRef = useRef(false);
  const mapDidDragRef = useRef(false);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const titleCollectionSectionRef = useRef<HTMLElement | null>(null);
  const reportRevealTimerRef = useRef<number | null>(null);
  const [pendingReportReveal, setPendingReportReveal] =
    useState<PendingReportReveal | null>(null);
  const [openedReportIndex, setOpenedReportIndex] = useState<number | null>(
    initialHomeUiState.openedReportIndex != null &&
      Number.isFinite(Number(initialHomeUiState.openedReportIndex))
      ? Math.max(0, Number(initialHomeUiState.openedReportIndex))
      : null,
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [earnedHomeTitles, setEarnedHomeTitles] = useState<TitleReward[]>([]);
  const [titleRewardToast, setTitleRewardToast] = useState<TitleReward | null>(
    null,
  );
  const [isTitleRewardSequenceActive, setIsTitleRewardSequenceActive] =
    useState(false);
  const titleRewardDismissTimerRef = useRef<number | null>(null);
  const isLoadingUserDataRef = useRef(false);
  const hasLoadedUserDataRef = useRef(false);
  const lastSavedMapTextRef = useRef("");
  const [isDraftPersistenceReady, setIsDraftPersistenceReady] = useState(false);

  const shouldUseCssImmersive = shouldUseCssImmersiveMode();
  const canUseFullscreen = shouldUseCssImmersive || canUseBrowserFullscreen();

  const [mapState, setMapState] = useState<MapState>({});
  const [groupPersonalData, setGroupPersonalData] = useState<
    GroupPersonalMap[]
  >([]);
  const [classGroupData, setClassGroupData] = useState<RegionDecisionMap[]>([]);
  const [groupFinalChoices, setGroupFinalChoices] = useState<GroupPersonalMap>(
    {},
  );
  const [classFinalChoices, setClassFinalChoices] = useState<GroupPersonalMap>(
    {},
  );
  const [isPersonalMapLocked, setIsPersonalMapLocked] = useState(false);
  const isPersonalMapLockedRef = useRef(false);
  useEffect(() => {
    isPersonalMapLockedRef.current = isPersonalMapLocked;
  }, [isPersonalMapLocked]);
  const [personalLockSummary, setPersonalLockSummary] = useState({
    lockedCount: 0,
    totalCount: 0,
    unlockedCount: 0,
    allLocked: false,
  });
  const [isGroupReady, setIsGroupReady] = useState(false);
  const [isGroupMapLocked, setIsGroupMapLocked] = useState(false);
  const [groupLockSummary, setGroupLockSummary] = useState({
    lockedCount: 0,
    totalCount: 0,
    unlockedCount: 0,
    allLocked: false,
  });
  const [groupLockStatuses, setGroupLockStatuses] = useState<MapLockStatusApi[]>([]);
  const [allGroupsLocked, setAllGroupsLocked] = useState(false);
  const [mapFlowMessage, setMapFlowMessage] = useState<{ type: "info" | "success" | "error"; text: string } | null>(null);
  const [mapSyncStatus, setMapSyncStatus] = useState<MapSyncStatus>({
    state: "live",
    text: "即時同步中",
  });
  const mapSyncStatusTimerRef = useRef<number | null>(null);
  const [isMapLockSubmitting, setIsMapLockSubmitting] = useState(false);
  const [isGroupMapLockSubmitting, setIsGroupMapLockSubmitting] = useState(false);
  const [realtimeCardPackLockSignal, setRealtimeCardPackLockSignal] =
    useState<RealtimeCardPackLockSignal>(null);
  const groupMapRefreshTimerRef = useRef<number | null>(null);
  const latestGroupMapRequestIdRef = useRef(0);
  const activeFinalSettlementKeyRef = useRef<string | null>(null);
  const isTeacher = currentUser?.role === "teacher";

  useEffect(() => {
    if (!currentUser?.id) return;
    if (
      !isTeacher &&
      (page === "teacherGroups" || page === "teacherStudentData")
    ) {
      saveStoredPage(currentUser.id, "home");
      const timer = window.setTimeout(() => setPage("home"), 0);
      return () => window.clearTimeout(timer);
    }
    saveStoredPage(currentUser.id, page);
  }, [currentUser?.id, isTeacher, page]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveHomeUiState(currentUser.id, {
      activeInquiryRecordOrder,
      reportPageIndex,
      mapPreviewPageIndex,
      openedReportIndex,
    });
  }, [
    activeInquiryRecordOrder,
    currentUser?.id,
    mapPreviewPageIndex,
    openedReportIndex,
    reportPageIndex,
  ]);

  useEffect(() => {
    if (!token || !currentUser) return undefined;

    let cancelled = false;
    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    const preloadGameplayPages = () => {
      if (cancelled) return;
      void preloadInquiryDataPage();
      void preloadCardPackPage();
      if (isTeacher) void preloadBehaviorRecordPage();
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(preloadGameplayPages, {
        timeout: 1800,
      });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timerId = window.setTimeout(preloadGameplayPages, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [currentUser, isTeacher, token]);

  const forceFinalEndingPage = useCallback(() => {
    window.history.replaceState({ page: "ending" }, "", window.location.href);
    window.history.pushState({ page: "ending" }, "", window.location.href);
    setPage("ending");
  }, []);

  const handleFinalSettlementForStudent = useCallback(
    (settlement: FinalDecisionSettlement) => {
      if (isTeacher || !settlement.isFinalized) return;

      const settlementKey = getFinalSettlementSignature(settlement);
      if (!settlementKey) return;

      const handledKey = readHandledFinalSettlementKey(currentUser?.id);
      if (handledKey === settlementKey) {
        activeFinalSettlementKeyRef.current = settlementKey;
        setFinalEndingCountdown(null);
        forceFinalEndingPage();
        return;
      }

      if (
        activeFinalSettlementKeyRef.current === settlementKey &&
        finalEndingCountdown !== null
      ) {
        return;
      }

      activeFinalSettlementKeyRef.current = settlementKey;
      window.history.replaceState(
        { page: "endingCountdown" },
        "",
        window.location.href,
      );
      window.history.pushState(
        { page: "endingCountdown" },
        "",
        window.location.href,
      );
      setFinalEndingCountdown(5);
    },
    [currentUser?.id, finalEndingCountdown, forceFinalEndingPage, isTeacher],
  );

  useEffect(() => {
    if (isTeacher || finalEndingCountdown === null) return;

    if (finalEndingCountdown <= 0) {
      const settlementKey =
        activeFinalSettlementKeyRef.current ||
        getFinalSettlementSignature(finalDecisionSettlement);
      if (settlementKey)
        writeHandledFinalSettlementKey(currentUser?.id, settlementKey);
      const finishTimer = window.setTimeout(() => {
        forceFinalEndingPage();
        setFinalEndingCountdown(null);
      }, 0);
      return () => window.clearTimeout(finishTimer);
    }

    const timer = window.setTimeout(() => {
      setFinalEndingCountdown((current) =>
        current === null ? null : Math.max(current - 1, 0),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    currentUser?.id,
    finalDecisionSettlement,
    finalEndingCountdown,
    forceFinalEndingPage,
    isTeacher,
  ]);
  const shouldShowSuspectVoteModal =
    Boolean(token) &&
    currentUser?.role === "student" &&
    votingStatus.isOpen &&
    !votingStatus.isFinalized &&
    votingStatus.myVotes.length === 0;
  const markedMapCount = Object.values(mapState).filter(
    (value) => value === "保育" || value === "開發" || value === "我不知道",
  ).length;
  const reportPageCount = finalSummaries.length + 1;
  const safeReportPageIndex = clamp(reportPageIndex, 0, reportPageCount - 1);
  const openedReport =
    openedReportIndex === null
      ? null
      : (finalSummaries[openedReportIndex] ?? null);

  function resolveMapVotes(votes: (MapChoice | "")[]): MapChoice | "" {
    const conserveCount = votes.filter((choice) => choice === "保育").length;
    const developCount = votes.filter((choice) => choice === "開發").length;
    const unknownCount = votes.filter((choice) => choice === "我不知道").length;
    const knownVotes = conserveCount + developCount;

    if (conserveCount > developCount) return "保育";
    if (developCount > conserveCount) return "開發";
    if (knownVotes === 0 && unknownCount === votes.length && votes.length > 0) {
      return "我不知道";
    }
    return "";
  }

  const buildGroupPreviewMap = useCallback((): MapState => {
    const next: MapState = {};

    regions.forEach((region) => {
      const votes = groupPersonalData.map(
        (student) => student[region.name] || "",
      );
      const autoChoice = resolveMapVotes(votes);
      const knownVotes = votes.filter(
        (choice) => choice === "保育" || choice === "開發",
      );
      const isActiveTie =
        knownVotes.length > 0 &&
        knownVotes.filter((choice) => choice === "保育").length ===
          knownVotes.filter((choice) => choice === "開發").length;
      const displayChoice =
        isActiveTie && groupFinalChoices[region.name]
          ? groupFinalChoices[region.name]
          : autoChoice;

      if (
        displayChoice === "保育" ||
        displayChoice === "開發" ||
        displayChoice === "我不知道"
      ) {
        next[region.name] = displayChoice;
      }
    });

    return next;
  }, [groupFinalChoices, groupPersonalData]);

  const buildClassPreviewMap = useCallback((): MapState => {
    const next: MapState = {};

    regions.forEach((region) => {
      const votes = classGroupData.map((group) =>
        getMapDecisionChoice(group[region.name]),
      );
      const autoChoice = resolveMapVotes(votes);
      const knownVotes = votes.filter(
        (choice) => choice === "保育" || choice === "開發",
      );
      const isActiveTie =
        knownVotes.length > 0 &&
        knownVotes.filter((choice) => choice === "保育").length ===
          knownVotes.filter((choice) => choice === "開發").length;
      const displayChoice =
        isActiveTie && classFinalChoices[region.name]
          ? classFinalChoices[region.name]
          : autoChoice;

      if (
        displayChoice === "保育" ||
        displayChoice === "開發" ||
        displayChoice === "我不知道"
      ) {
        next[region.name] = displayChoice;
      }
    });

    return next;
  }, [classFinalChoices, classGroupData]);

  const getIncompleteMapDistrictNames = useCallback((state: Record<string, MapChoice | "">) => {
    return regions
      .map((region) => region.name)
      .filter((name) => {
        const choice = state[name];
        return choice !== "保育" && choice !== "開發" && choice !== "我不知道";
      });
  }, []);

  const mapPreviewPages = useMemo(
    () => [
      { title: "我的石虎地圖", map: mapState, locked: false, lockReason: "" },
      {
        title: "小組地圖",
        subtitle: currentUser?.groupName || "小組共識地圖",
        map: buildGroupPreviewMap(),
        locked: !isGroupReady && !isGroupMapLocked,
        lockReason: `等待小組成員鎖定個人地圖：${personalLockSummary.lockedCount}/${personalLockSummary.totalCount || currentUser?.groupMembers?.length || 0}`,
      },
      {
        title: "全班共識彙整結果",
        map: buildClassPreviewMap(),
        locked: !allGroupsLocked,
        lockReason: `等待各局組長鎖定小組地圖：${groupLockSummary.lockedCount}/${groupLockSummary.totalCount || groupLockStatuses.length || 0}`,
      },
    ],
    [
      allGroupsLocked,
      mapState,
      buildClassPreviewMap,
      buildGroupPreviewMap,
      currentUser?.groupMembers?.length,
      currentUser?.groupName,
      groupLockStatuses.length,
      groupLockSummary.lockedCount,
      groupLockSummary.totalCount,
      isGroupMapLocked,
      isGroupReady,
      personalLockSummary.lockedCount,
      personalLockSummary.totalCount,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReportPageIndex((prev) => clamp(prev, 0, reportPageCount - 1));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reportPageCount]);

  useEffect(() => {
    if (!page || page === "home") return;

    // 離開首頁時若探究調查書拖曳被中斷，重設拖曳狀態，避免重新登入後卡在不可互動的空白位移。
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    const timer = window.setTimeout(() => setReportDragOffsetNow(0), 0);
    return () => window.clearTimeout(timer);
  }, [page, setReportDragOffsetNow]);

  useEffect(() => {
    if (!titleRewardToast) return;

    const activateTimer = window.setTimeout(() => {
      setIsTitleRewardSequenceActive(true);
    }, 0);

    if (titleRewardDismissTimerRef.current !== null) {
      window.clearTimeout(titleRewardDismissTimerRef.current);
    }

    titleRewardDismissTimerRef.current = window.setTimeout(() => {
      setTitleRewardToast(null);
      titleRewardDismissTimerRef.current = null;
    }, 3300);

    return () => {
      window.clearTimeout(activateTimer);
      if (titleRewardDismissTimerRef.current !== null) {
        window.clearTimeout(titleRewardDismissTimerRef.current);
        titleRewardDismissTimerRef.current = null;
      }
    };
  }, [titleRewardToast]);

  useEffect(() => {
    if (!pendingReportReveal || page !== "home") return;

    const shouldWaitForTitlePopup =
      pendingReportReveal.waitForTitleReward &&
      (isTitleRewardSequenceActive || Boolean(titleRewardToast));

    // 有獲得「見習調查員／資深調查員／首席調查官」時，
    // 只等待稱號彈窗完整退場，不再把畫面移到稱號收藏。
    if (shouldWaitForTitlePopup) {
      return;
    }

    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }

    const initialRevealTimer = window.setTimeout(() => {
      setReportPageIndex(pendingReportReveal.startIndex);
    }, 0);

    reportRevealTimerRef.current = window.setTimeout(
      () => {
        // 稱號彈窗結束後，才移動到 INQUIRYBOOK / 探究調查書的位置。
        reportSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        reportRevealTimerRef.current = window.setTimeout(() => {
          // 畫面定位完成後，先讓學生看見剛完成的成果約 0.5 秒，
          // 再執行任務 X → 任務 X+1 的換頁效果。
          setReportPageIndex(pendingReportReveal.targetIndex);

          reportRevealTimerRef.current = window.setTimeout(() => {
            setPendingReportReveal(null);
            reportRevealTimerRef.current = null;
          }, 520);
        }, 1300);
      },
      pendingReportReveal.waitForTitleReward ? 260 : 220,
    );

    return () => {
      window.clearTimeout(initialRevealTimer);
      if (reportRevealTimerRef.current !== null) {
        window.clearTimeout(reportRevealTimerRef.current);
        reportRevealTimerRef.current = null;
      }
    };
  }, [
    isTitleRewardSequenceActive,
    page,
    pendingReportReveal,
    titleRewardToast,
  ]);

  useEffect(() => {
    if (openedReportIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedReportIndex(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openedReportIndex]);

  useEffect(() => {
    let restoreHomeTimer: number | null = null;
    if (!finalDecisionSettlement.isFinalized) {
      window.history.replaceState(
        { page: page === "ending" ? "home" : page },
        "",
        window.location.href,
      );
      if (page === "ending") {
        restoreHomeTimer = window.setTimeout(() => setPage("home"), 0);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const nextPage =
        (event.state?.page as Page | "endingCountdown" | undefined) || "home";

      if (
        currentUser?.role !== "teacher" &&
        finalDecisionSettlement.isFinalized
      ) {
        if (finalEndingCountdown !== null) {
          window.history.pushState(
            { page: "endingCountdown" },
            "",
            window.location.href,
          );
          return;
        }

        forceFinalEndingPage();
        return;
      }

      if (
        (nextPage === "teacherGroups" || nextPage === "teacherStudentData") &&
        currentUser?.role !== "teacher"
      ) {
        setPage("home");
        return;
      }
      if (nextPage !== "endingCountdown") setPage(nextPage);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      if (restoreHomeTimer !== null) window.clearTimeout(restoreHomeTimer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    currentUser?.role,
    finalDecisionSettlement.isFinalized,
    finalEndingCountdown,
    forceFinalEndingPage,
    page,
  ]);

  useEffect(() => {
    if (shouldUseCssImmersive) return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [shouldUseCssImmersive]);

  const syncCurrentUser = useCallback(async () => {
    if (!token) return;

    try {
      const data = await getMe(token);
      if (!data.user) return;

      setCurrentUser((prev) => {
        const nextUser = data.user as AuthUser;
        const prevText = JSON.stringify(prev);
        const nextText = JSON.stringify(nextUser);
        if (prevText === nextText) return prev;
        saveStoredUser(nextUser);
        return nextUser;
      });
    } catch (error) {
      console.error("同步使用者資料發生錯誤：", error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const initialSyncTimer = window.setTimeout(() => {
      void syncCurrentUser();
    }, 0);

    // 即時同步已交給 SSE；這裡只保留低頻備援，避免背景輪詢卡住按鈕互動。
    const timer = window.setInterval(() => {
      syncCurrentUser();
    }, 15000);

    return () => {
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(timer);
    };
  }, [syncCurrentUser, token]);

  useEffect(() => {
    if (!token) return;

    const flush = () => {
      void flushPendingWrites(token);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") flush();
    };

    flush();
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  const updateMapSyncStatus = useCallback((status: MapSyncStatus) => {
    setMapSyncStatus({ ...status, updatedAt: status.updatedAt ?? Date.now() });

    if (mapSyncStatusTimerRef.current !== null) {
      window.clearTimeout(mapSyncStatusTimerRef.current);
      mapSyncStatusTimerRef.current = null;
    }

    if (status.state === "synced") {
      mapSyncStatusTimerRef.current = window.setTimeout(() => {
        setMapSyncStatus({ state: "live", text: "即時同步中", updatedAt: Date.now() });
        mapSyncStatusTimerRef.current = null;
      }, 2600);
    }
  }, []);

  const applyRealtimeMapLockSnapshot = useCallback((payload: Record<string, unknown>) => {
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    const eventGroupId = payload.groupId === null || payload.groupId === undefined ? null : String(payload.groupId);
    const currentGroupId = currentUser?.groupId === null || currentUser?.groupId === undefined ? null : String(currentUser.groupId);

    if (scope === "personal") {
      if (!isTeacher && eventGroupId && currentGroupId && eventGroupId !== currentGroupId) return;

      const nextMembers = Array.isArray(payload.members) ? payload.members : null;
      const personalLockSummaryPayload = payload.personalLockSummary as Partial<typeof personalLockSummary> | undefined;
      const personalLockStatuses = Array.isArray(payload.personalLockStatuses) ? payload.personalLockStatuses : [];

      if (personalLockSummaryPayload) {
        setPersonalLockSummary({
          lockedCount: Number(personalLockSummaryPayload.lockedCount || 0),
          totalCount: Number(personalLockSummaryPayload.totalCount || 0),
          unlockedCount: Number(personalLockSummaryPayload.unlockedCount || 0),
          allLocked: Boolean(personalLockSummaryPayload.allLocked || payload.isGroupReady),
        });
      }
      if (typeof payload.isGroupReady === "boolean") setIsGroupReady(payload.isGroupReady);

      const myStatus = personalLockStatuses.find((status) => {
        const row = status as { userId?: unknown };
        return String(row.userId) === String(currentUser?.id);
      }) as { isLocked?: boolean } | undefined;
      if (myStatus?.isLocked || String(payload.userId) === String(currentUser?.id)) {
        setIsPersonalMapLocked(true);
      }

      setCurrentUser((prev) => {
        if (!prev) return prev;
        const membersFromPayload = nextMembers || prev.groupMembers || [];
        const statusByUserId = new Map(
          personalLockStatuses.map((status) => {
            const row = status as { userId?: unknown; isLocked?: boolean; lockedAt?: unknown };
            return [String(row.userId), row];
          }),
        );
        const groupMembers = membersFromPayload.map((member, index) => {
          const source = member as Record<string, unknown>;
          const rawId = source.id ?? source.userId;
          const id = typeof rawId === "number" || typeof rawId === "string" ? rawId : `member-${index + 1}`;
          const username = typeof source.username === "string"
            ? source.username
            : typeof source.name === "string"
              ? source.name
              : `組員${index + 1}`;
          const name = typeof source.name === "string" ? source.name : username;
          const status = statusByUserId.get(String(id));
          return {
            id,
            username,
            name,
            email: typeof source.email === "string" ? source.email : undefined,
            isGroupLeader: Boolean(source.isGroupLeader),
            isPersonalMapLocked: Boolean(status?.isLocked ?? source.isPersonalMapLocked),
            personalMapLockedAt: typeof status?.lockedAt === "string" ? status.lockedAt : (source.personalMapLockedAt as string | null | undefined) ?? null,
          };
        });
        const nextUser = {
          ...prev,
          groupId: eventGroupId ?? prev.groupId ?? null,
          groupName: typeof payload.groupName === "string" ? payload.groupName : prev.groupName ?? null,
          groupMembers,
        };
        if (JSON.stringify(prev) === JSON.stringify(nextUser)) return prev;
        saveStoredUser(nextUser);
        return nextUser;
      });
    }

    if (scope === "group" || scope === "class" || scope === "assignment") {
      const groupLockSummaryPayload = payload.groupLockSummary as Partial<typeof groupLockSummary> | undefined;
      if (Array.isArray(payload.groupLockStatuses)) {
        setGroupLockStatuses(payload.groupLockStatuses as MapLockStatusApi[]);
      }
      if (groupLockSummaryPayload) {
        setGroupLockSummary({
          lockedCount: Number(groupLockSummaryPayload.lockedCount || 0),
          totalCount: Number(groupLockSummaryPayload.totalCount || 0),
          unlockedCount: Number(groupLockSummaryPayload.unlockedCount || 0),
          allLocked: Boolean(groupLockSummaryPayload.allLocked || payload.allGroupsLocked),
        });
      }
      if (typeof payload.allGroupsLocked === "boolean") setAllGroupsLocked(payload.allGroupsLocked);
      if (scope === "group" && eventGroupId && currentGroupId && eventGroupId === currentGroupId) {
        setIsGroupMapLocked(true);
      }
    }
  }, [currentUser?.groupId, currentUser?.id, isTeacher]);

  const loadGroupAndClassMapData = useCallback(async () => {
    if (!token) return;

    const requestId = latestGroupMapRequestIdRef.current + 1;
    latestGroupMapRequestIdRef.current = requestId;

    try {
      const data = await getGroupPersonalMaps(token);
      if (requestId !== latestGroupMapRequestIdRef.current) return;

      setGroupPersonalData(
        Array.isArray(data.personalData) ? data.personalData : [],
      );
      setGroupFinalChoices(data.groupFinalDecisions || data.finalChoices || {});
      setIsPersonalMapLocked(Boolean(data.isMyPersonalLocked));
      setPersonalLockSummary({
        lockedCount: Number(data.personalLockSummary?.lockedCount || 0),
        totalCount: Number(data.personalLockSummary?.totalCount || 0),
        unlockedCount: Number(data.personalLockSummary?.unlockedCount || 0),
        allLocked: Boolean(data.personalLockSummary?.allLocked || data.isGroupReady),
      });
      setIsGroupReady(Boolean(data.isGroupReady));
      setIsGroupMapLocked(Boolean(data.isGroupMapLocked));

      if (Array.isArray(data.members)) {
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const nextUser = {
            ...prev,
            groupId: data.groupId ?? prev.groupId ?? null,
            groupName: data.groupName ?? prev.groupName ?? null,
            groupMembers: data.members,
          };
          if (JSON.stringify(prev) === JSON.stringify(nextUser)) return prev;
          saveStoredUser(nextUser);
          return nextUser;
        });
      }

      const classData = await getClassGroupDecisions(token);
      if (requestId !== latestGroupMapRequestIdRef.current) return;

      const rawGroupData = Array.isArray(classData.groupData)
        ? classData.groupData
        : Array.isArray(classData.groupResults)
          ? classData.groupResults
          : [];

      setClassGroupData(
        rawGroupData.map(
          (item: ClassGroupDecisionItemApi) => item?.decisions ?? item,
        ),
      );

      setGroupLockSummary({
        lockedCount: Number(classData.groupLockSummary?.lockedCount || 0),
        totalCount: Number(classData.groupLockSummary?.totalCount || 0),
        unlockedCount: Number(classData.groupLockSummary?.unlockedCount || 0),
        allLocked: Boolean(classData.groupLockSummary?.allLocked || classData.allGroupsLocked),
      });
      setGroupLockStatuses(Array.isArray(classData.groupLockStatuses) ? classData.groupLockStatuses : []);
      setAllGroupsLocked(Boolean(classData.allGroupsLocked));

      if (classData.classFinalChoices) {
        setClassFinalChoices(classData.classFinalChoices);
      } else {
        const finalData = await getClassFinalDecisions(token);
        if (requestId !== latestGroupMapRequestIdRef.current) return;
        setClassFinalChoices(finalData || {});
      }
      updateMapSyncStatus({ state: "synced", text: "剛剛已更新", updatedAt: Date.now() });
    } catch (error) {
      console.error("讀取小組/全班地圖資料發生錯誤：", error);
      updateMapSyncStatus({ state: "unstable", text: "連線不穩，正在用備援同步", updatedAt: Date.now() });
      setMapFlowMessage({ type: "error", text: "地圖同步資料讀取失敗，請重新整理或稍後再試。" });
    }
  }, [token, updateMapSyncStatus]);

  const scheduleGroupAndClassMapRefresh = useCallback((delayMs = 250) => {
    if (!token) return;

    updateMapSyncStatus({ state: "syncing", text: "同步地圖資料中…", updatedAt: Date.now() });

    if (groupMapRefreshTimerRef.current !== null) {
      window.clearTimeout(groupMapRefreshTimerRef.current);
    }

    groupMapRefreshTimerRef.current = window.setTimeout(() => {
      groupMapRefreshTimerRef.current = null;
      loadGroupAndClassMapData();
    }, delayMs);
  }, [loadGroupAndClassMapData, token, updateMapSyncStatus]);

  const applyMyMapToGroupPersonalData = useCallback(
    (nextMapState: MapState) => {
      const myId = currentUser?.id;
      const members = currentUser?.groupMembers || [];
      if (!myId || members.length === 0) return;

      const myIndex = members.findIndex(
        (member) => String(member.id) === String(myId),
      );
      if (myIndex < 0) return;

      setGroupPersonalData((prev) => {
        const next = [...prev];
        while (next.length < members.length) next.push({});

        const previousMap = next[myIndex] || {};
        if (stableMapText(previousMap) === stableMapText(nextMapState)) {
          return prev;
        }

        next[myIndex] = nextMapState;
        return next;
      });
    },
    [currentUser?.groupMembers, currentUser?.id],
  );

  useEffect(() => {
    if (!token) {
      const resetTimer = window.setTimeout(() => {
        setGroupPersonalData([]);
        setClassGroupData([]);
        setGroupFinalChoices({});
        setClassFinalChoices({});
    setIsPersonalMapLocked(false);
    setPersonalLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setIsGroupReady(false);
    setIsGroupMapLocked(false);
    setGroupLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setAllGroupsLocked(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const initialLoadTimer = window.setTimeout(() => {
      void loadGroupAndClassMapData();
    }, 0);

    // 主要靠 SSE 即時推送；輪詢只當斷線備援。
    const timer = window.setInterval(() => {
      loadGroupAndClassMapData();
    }, 15000);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(timer);
      if (groupMapRefreshTimerRef.current !== null) {
        window.clearTimeout(groupMapRefreshTimerRef.current);
        groupMapRefreshTimerRef.current = null;
      }
    };
  }, [loadGroupAndClassMapData, token]);

  useEffect(() => {
    if (!token || !currentUser?.id) return;

    const authToken = token;
    const userId = currentUser.id;
    hasLoadedUserDataRef.current = false;
    const draftReadyResetTimer = window.setTimeout(() => {
      setIsDraftPersistenceReady(false);
    }, 0);

    async function loadUserData() {
      isLoadingUserDataRef.current = true;

      try {
        const data = await loadInquiryData(authToken);

        // localStorage 只保留尚未送出的文字草稿；稱號、卡牌、探究書、地圖都以資料庫為唯一來源。
        const localDraft = readHomePageDraft(userId);
        const serverFinalSummaries = Array.isArray(data.finalSummaries)
          ? (data.finalSummaries as FinalSummary[])
          : [];
        const serverEarnedTitles = Array.isArray(data.earnedTitles)
          ? (data.earnedTitles as TitleReward[])
          : [];
        const serverUnlockedCards = Array.isArray(data.unlockedCards)
          ? (data.unlockedCards as UnlockedCardData[])
          : [];

        setOrientationMainChoice(
          data.orientationMainChoice || localDraft?.orientationMainChoice || "",
        );
        setOrientationTextInput(
          data.orientationTextInput || localDraft?.orientationTextInput || "",
        );
        // 後端資料庫是探究調查書的唯一資料來源；避免 localStorage 舊草稿覆蓋正確資料。
        setFinalSummaries(serverFinalSummaries);
        // 登入後預設顯示最新一份探究調查書；沒有報告時維持在「建立新的探究探究調查書」。
        const restoredReportPageIndex = Number(
          readHomeUiState(userId).reportPageIndex,
        );
        setReportPageIndex(
          Number.isFinite(restoredReportPageIndex)
            ? clamp(
                restoredReportPageIndex,
                0,
                Math.max(0, serverFinalSummaries.length),
              )
            : serverFinalSummaries.length > 0
              ? serverFinalSummaries.length - 1
              : 0,
        );
        setEarnedHomeTitles(serverEarnedTitles);
        setUnlockedCards(serverUnlockedCards);

        const mapData = await getUserMap(authToken);
        const loadedMap = mapData.mapState || {};
        setMapState(loadedMap);
        setIsPersonalMapLocked(Boolean(mapData.isPersonalLocked));
        lastSavedMapTextRef.current = stableMapText(loadedMap);

        const taskData = await getMapTaskStatus(authToken);
        setIsMapTaskOpen(Boolean(taskData.isOpen));
      } catch (err) {
        console.error(err);
      } finally {
        window.setTimeout(() => {
          isLoadingUserDataRef.current = false;
          hasLoadedUserDataRef.current = true;
          setIsDraftPersistenceReady(true);
        }, 0);
      }
    }

    void loadUserData();

    return () => {
      window.clearTimeout(draftReadyResetTimer);
    };
  }, [token, currentUser?.id]);

  const loadVotingStatus = useCallback(async () => {
    if (!token || !currentUser?.id) return;

    try {
      const data = await getSuspectVotingStatus(token);
      applyVotingStatus(data);
    } catch (error) {
      console.error("讀取投票狀態失敗", error);
    }
  }, [currentUser?.id, token]);

  useHomeTeacherControlState({
    token,
    currentUserId: currentUser?.id,
    isTeacher,
    applyVotingStatus,
    handleFinalSettlementForStudent,
    clearHandledFinalSettlementKey,
    activeFinalSettlementKeyRef,
    setFinalEndingCountdown,
    setFinalDecisionSettlement,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  });

  const resetHomeStateAfterDatabaseCleared = useCallback(() => {
    setUnlockedCards([]);
    setFinalSummaries([]);
    setReportPageIndex(0);
    setEarnedHomeTitles([]);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    setMapState({});
    setFinalDecisionSettlement({ isFinalized: false });
    setFinalEndingCountdown(null);
    activeFinalSettlementKeyRef.current = null;
    clearHandledFinalSettlementKey(currentUser?.id);
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setIsPersonalMapLocked(false);
    setPersonalLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setIsGroupReady(false);
    setIsGroupMapLocked(false);
    setGroupLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setAllGroupsLocked(false);
    setDraftSuspectVotes([]);
    setSuspectVoteMessage("");
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      finalizedSuspects: [],
      finalizedAt: null,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
  }, [currentUser?.id]);

  const applyRealtimeFinalMapDecision = useCallback(
    ({
      mode,
      districtName,
      choice,
    }: {
      mode: "group" | "class";
      groupId?: string | null;
      districtName: string;
      choice: MapChoice | "";
    }) => {
      if (!districtName) return;

      const applyChoice = (prev: GroupPersonalMap) => {
        const next = { ...prev };
        if (choice) next[districtName] = choice;
        else delete next[districtName];
        return next;
      };

      if (mode === "group") {
        setGroupFinalChoices(applyChoice);
        setClassFinalChoices((prev) => {
          if (!prev[districtName]) return prev;
          const next = { ...prev };
          delete next[districtName];
          return next;
        });
        return;
      }

      setClassFinalChoices(applyChoice);
    },
    [],
  );

  const handleRealtimeGroupCardPackLock = useCallback(
    ({
      groupId,
      lock,
    }: {
      groupId?: string | null;
      lock?: { selectedCardIds?: string[]; lockedAt?: string | null } | null;
    }) => {
      const eventGroupId = groupId ? String(groupId) : null;
      const myGroupId = currentUser?.groupId
        ? String(currentUser.groupId)
        : null;
      if (eventGroupId && myGroupId && eventGroupId !== myGroupId) return;

      if (!lock) {
        setRealtimeCardPackLockSignal({
          nonce: Date.now(),
          groupId: eventGroupId,
          lock: null,
        });
        return;
      }

      const selectedCardIds = Array.isArray(lock.selectedCardIds)
        ? lock.selectedCardIds.map(String)
        : [];
      const lockedAt = lock.lockedAt ? String(lock.lockedAt) : "";
      if (selectedCardIds.length !== 3 || !lockedAt) return;

      setRealtimeCardPackLockSignal({
        nonce: Date.now(),
        groupId: eventGroupId,
        lock: {
          selectedCardIds,
          lockedAt,
        },
      });
    },
    [currentUser?.groupId],
  );

  useHomeRealtime({
    token,
    currentUser,
    isTeacher,
    loadVotingStatus,
    applyVotingStatus,
    handleFinalSettlementForStudent,
    applyRealtimeFinalMapDecision,
    applyRealtimeMapLockSnapshot,
    updateMapSyncStatus,
    handleRealtimeGroupCardPackLock,
    scheduleGroupAndClassMapRefresh,
    clearHandledFinalSettlementKey,
    clearHomeProgressCache,
    stableMapText,
    activeFinalSettlementKeyRef,
    lastSavedMapTextRef,
    resetAfterDatabaseCleared: resetHomeStateAfterDatabaseCleared,
    setFinalDecisionSettlement,
    setFinalEndingCountdown,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!votingStatus.isOpen || votingStatus.isFinalized) {
        setDraftSuspectVotes([]);
        setSuspectVoteMessage("");
        return;
      }

      if (votingStatus.myVotes.length === 0) {
        setDraftSuspectVotes((prev) =>
          prev.length === SUSPECT_GROUPS.length
            ? prev
            : DEFAULT_SUSPECT_ROLE_RANKING,
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    votingStatus.isFinalized,
    votingStatus.isOpen,
    votingStatus.myVotes.length,
  ]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (!isDraftPersistenceReady) return;

    saveHomePageDraft(currentUser.id, {
      orientationMainChoice,
      orientationTextInput,
    });
  }, [
    currentUser?.id,
    isDraftPersistenceReady,
    orientationTextInput,
    orientationMainChoice,
  ]);

  function handleLoginSuccess(nextToken: string, user: AuthUser) {
    isLoadingUserDataRef.current = false;
    hasLoadedUserDataRef.current = false;
    setIsDraftPersistenceReady(false);
    setMapState({});
    lastSavedMapTextRef.current = stableMapText({});
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setIsPersonalMapLocked(false);
    setPersonalLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setIsGroupReady(false);
    setIsGroupMapLocked(false);
    setGroupLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setAllGroupsLocked(false);
    setIsInquiryTaskOpen(true);
    setIsMapTaskOpen(false);
    setIsCardPackOpen(false);
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
    setMapPreviewPageIndex(0);
    setReportPageIndex(0);
    setReportDragOffsetNow(0);
    setPendingReportReveal(null);
    setOpenedReportIndex(null);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    const restoredPage = readStoredPage(user.id);
    const restoredHomeUiState = readHomeUiState(user.id);
    setActiveInquiryRecordOrder(
      restoredHomeUiState.activeInquiryRecordOrder != null &&
        Number.isFinite(Number(restoredHomeUiState.activeInquiryRecordOrder))
        ? Number(restoredHomeUiState.activeInquiryRecordOrder)
        : null,
    );
    setReportPageIndex(
      Number.isFinite(Number(restoredHomeUiState.reportPageIndex))
        ? Math.max(0, Number(restoredHomeUiState.reportPageIndex))
        : 0,
    );
    setMapPreviewPageIndex(
      Number.isFinite(Number(restoredHomeUiState.mapPreviewPageIndex))
        ? Math.max(0, Number(restoredHomeUiState.mapPreviewPageIndex))
        : 0,
    );
    setOpenedReportIndex(
      restoredHomeUiState.openedReportIndex != null &&
        Number.isFinite(Number(restoredHomeUiState.openedReportIndex))
        ? Math.max(0, Number(restoredHomeUiState.openedReportIndex))
        : null,
    );
    setPage(
      user.role !== "teacher" &&
        (restoredPage === "teacherGroups" ||
          restoredPage === "teacherStudentData")
        ? "home"
        : restoredPage,
    );
    setToken(nextToken);
    setCurrentUser(user);
    saveAuthSession(nextToken, user);
  }

  function handleLogout() {
    clearStoredPage(currentUser?.id);
    clearHomeUiState(currentUser?.id);
    clearApiCacheForCurrentUser();
    clearAuthSession();
    isLoadingUserDataRef.current = false;
    hasLoadedUserDataRef.current = false;
    setIsDraftPersistenceReady(false);
    setToken(null);
    setCurrentUser(null);
    setMapState({});
    lastSavedMapTextRef.current = stableMapText({});
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setIsPersonalMapLocked(false);
    setPersonalLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setIsGroupReady(false);
    setIsGroupMapLocked(false);
    setGroupLockSummary({ lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false });
    setAllGroupsLocked(false);
    setIsInquiryTaskOpen(true);
    setIsMapTaskOpen(false);
    setIsCardPackOpen(false);
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
    setMapPreviewPageIndex(0);
    setReportPageIndex(0);
    setReportDragOffsetNow(0);
    setPendingReportReveal(null);
    setOpenedReportIndex(null);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    setPage("home");
  }

  const logActivity = useCallback(
    async (payload: ActivityLogPayload) => {
      if (!token) return;

      try {
        await writeActivityLog(token, normalizeActivityLogPayload(payload));
      } catch (error) {
        console.error("活動紀錄寫入失敗：", error);
      }
    },
    [token],
  );

  const saveUserMap = useCallback(
    async (nextMapState: MapState) => {
      if (!token || isPersonalMapLocked) return;

      const nextText = stableMapText(nextMapState);
      if (lastSavedMapTextRef.current === nextText) return;

      // 先記錄，避免 React StrictMode 或重複事件在資料庫寫入前連續送出兩次。
      lastSavedMapTextRef.current = nextText;

      try {
        await saveUserMapState(token, nextMapState);
        setMapFlowMessage(null);

        // 儲存成功後先把自己的地圖直接覆蓋進目前小組資料，
        // 讓使用者切到「小組地圖」時不用等下一輪輪詢。
        // 再用短延遲重抓一次後端資料，確認送出其他成員與全班結果也同步。
        applyMyMapToGroupPersonalData(nextMapState);
        scheduleGroupAndClassMapRefresh();
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 423) {
          // 鎖定成功後，較早送出的自動儲存請求可能稍晚回來並被後端拒絕。
          // 這代表資料已由鎖定流程接管，不能再把它顯示成失敗。
          removePendingWritesByDedupeKey("user-map");
          if (isPersonalMapLockedRef.current) return;
          setIsPersonalMapLocked(true);
          return;
        }

        lastSavedMapTextRef.current = "";
        console.error("儲存個人地圖發生錯誤：", error);
        setMapFlowMessage({ type: "error", text: "個人地圖同步失敗，請確認網路後再試一次。" });
      }
    },
    [
      applyMyMapToGroupPersonalData,
      isPersonalMapLocked,
      scheduleGroupAndClassMapRefresh,
      token,
    ],
  );

  const handleMapDecisionsChange = useCallback(
    ({
      mode,
      personalState,
    }: {
      mode: "personal" | "group" | "class";
      personalState: Record<string, "保育" | "開發" | "我不知道" | "">;
    }) => {
      if (mode !== "personal" || isPersonalMapLocked) return;

      const cleaned = Object.fromEntries(
        Object.entries(personalState).filter(
          ([, value]) =>
            value === "保育" || value === "開發" || value === "我不知道",
        ),
      ) as MapState;

      const nextText = stableMapText(cleaned);
      const changedDistrictNames = regions
        .map((region) => region.name)
        .filter((name) => (mapState[name] || "") !== (cleaned[name] || ""));

      // 個人地圖是小組/全班結果的最新來源；只要個人選擇改變，
      // 該地區先前的組長/教師覆蓋都要在前端立即視為過期，後端也會同步清除。
      if (changedDistrictNames.length > 0) {
        setGroupFinalChoices((prev) => {
          const next = { ...prev };
          changedDistrictNames.forEach((name) => delete next[name]);
          return next;
        });
        setClassFinalChoices((prev) => {
          const next = { ...prev };
          changedDistrictNames.forEach((name) => delete next[name]);
          return next;
        });
      }

      setMapState((prev) => {
        const prevText = stableMapText(prev);
        return prevText === nextText ? prev : cleaned;
      });

      saveUserMap(cleaned);
    },
    [isPersonalMapLocked, mapState, saveUserMap],
  );

  const handleManualDecisionChange = useCallback(
    async ({
      mode,
      districtName,
      choice,
    }: {
      mode: "group" | "class";
      districtName: string;
      choice: MapChoice | "";
    }) => {
      if (!token || !districtName) return;

      // 小組/全班最終決策只允許「保育」「開發」或清空
      // 不允許「我不知道」送進最終決策 API
      if (choice === "我不知道") return;

      if (mode === "group") {
        setGroupFinalChoices((prev) => {
          const next = { ...prev };
          if (choice) next[districtName] = choice;
          else delete next[districtName];
          return next;
        });
        // 小組決策是全班地圖的輸入；小組決策一變，該地區舊的教師全班覆蓋先失效。
        setClassFinalChoices((prev) => {
          if (!prev[districtName]) return prev;
          const next = { ...prev };
          delete next[districtName];
          return next;
        });
      }

      if (mode === "class") {
        setClassFinalChoices((prev) => {
          const next = { ...prev };
          if (choice) next[districtName] = choice;
          else delete next[districtName];
          return next;
        });
      }

      try {
        await saveFinalMapDecision(token, mode, districtName, choice || null);
        setMapFlowMessage({
          type: "success",
          text: choice
            ? `✅ ${districtName} 已決定為「${choice}」！${mode === "group" ? "小組" : "全班"}地圖已同步更新。`
            : `✅ ${districtName} 的${mode === "group" ? "小組" : "全班"}決策已清除，地圖已同步更新。`,
        });
        loadGroupAndClassMapData();
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "儲存最終決策失敗，請稍後再試。";
        console.error("儲存最終決策發生錯誤：", error);
        setMapFlowMessage({ type: "error", text: message });
      }
    },
    [loadGroupAndClassMapData, token],
  );

  const handleLockPersonalMap = useCallback(async (latestMapState?: Record<string, MapChoice | "">) => {
    if (!token || isPersonalMapLocked || isMapLockSubmitting) return;

    const mapStateToLock = Object.fromEntries(
      Object.entries(latestMapState || mapState).filter(([, value]) =>
        value === "保育" || value === "開發" || value === "我不知道",
      ),
    ) as MapState;
    const incompleteDistricts = getIncompleteMapDistrictNames(mapStateToLock);
    if (incompleteDistricts.length > 0) {
      setMapFlowMessage({
        type: "error",
        text: `還有 ${incompleteDistricts.length} 個鄉鎮市尚未完成：${incompleteDistricts.slice(0, 4).join("、")}${incompleteDistricts.length > 4 ? "…" : ""}`,
      });
      return;
    }

    setIsMapLockSubmitting(true);
    setMapFlowMessage({ type: "info", text: "正在送出並鎖定你的個人地圖…" });

    try {
      await lockUserMap(token, mapStateToLock);
      removePendingWritesByDedupeKey("user-map");
      lastSavedMapTextRef.current = stableMapText(mapStateToLock);
      setIsPersonalMapLocked(true);
      setMapFlowMessage({ type: "success", text: "個人地圖已鎖定，正在等待小組成員完成。" });
      applyMyMapToGroupPersonalData(mapStateToLock);
      scheduleGroupAndClassMapRefresh(80);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "鎖定個人地圖失敗，請稍後再試。";
      console.error("鎖定個人地圖發生錯誤：", error);
      setMapFlowMessage({ type: "error", text: message });
    } finally {
      setIsMapLockSubmitting(false);
    }
  }, [
    applyMyMapToGroupPersonalData,
    getIncompleteMapDistrictNames,
    isMapLockSubmitting,
    isPersonalMapLocked,
    mapState,
    scheduleGroupAndClassMapRefresh,
    token,
  ]);

  const handleLockGroupMap = useCallback(async () => {
    if (!token || isGroupMapLocked || isGroupMapLockSubmitting) return;

    setIsGroupMapLockSubmitting(true);
    setMapFlowMessage({ type: "info", text: "正在鎖定小組地圖…" });

    try {
      await lockGroupMap(token);
      setIsGroupMapLocked(true);
      setMapFlowMessage({ type: "success", text: "小組地圖已鎖定，正在等待其他組長完成。" });
      scheduleGroupAndClassMapRefresh(80);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "鎖定小組地圖失敗，請稍後再試。";
      console.error("鎖定小組地圖發生錯誤：", error);
      setMapFlowMessage({ type: "error", text: message });
    } finally {
      setIsGroupMapLockSubmitting(false);
    }
  }, [isGroupMapLockSubmitting, isGroupMapLocked, scheduleGroupAndClassMapRefresh, token]);

  function applyVotingStatus(data: VotingStatusApi) {
    setVotingStatus({
      isOpen: Boolean(data.isOpen),
      isFinalized: Boolean(data.isFinalized),
      finalizedSuspects: Array.isArray(data.finalizedSuspects)
        ? data.finalizedSuspects
        : [],
      finalizedAt: data.finalizedAt || null,
      totals: data.totals || {},
      totalVoters: Number(data.totalVoters) || 0,
      totalEligibleVoters: Number(data.totalEligibleVoters) || 0,
      myVotes: Array.isArray(data.myVotes) ? data.myVotes : [],
    });
  }

  function moveDraftSuspectRole(roleId: string, direction: -1 | 1) {
    setDraftSuspectVotes((prev) => {
      const ranking =
        prev.length === SUSPECT_GROUPS.length
          ? [...prev]
          : [...DEFAULT_SUSPECT_ROLE_RANKING];
      const currentIndex = ranking.indexOf(roleId);
      if (currentIndex < 0) return ranking;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= ranking.length) return ranking;
      const [item] = ranking.splice(currentIndex, 1);
      ranking.splice(nextIndex, 0, item);
      return ranking;
    });
    setSuspectVoteMessage("");
  }

  async function submitSuspectVote() {
    const ranking =
      draftSuspectVotes.length === SUSPECT_GROUPS.length
        ? draftSuspectVotes
        : DEFAULT_SUSPECT_ROLE_RANKING;
    if (
      !token ||
      ranking.length !== SUSPECT_GROUPS.length ||
      isSubmittingSuspectVote
    ) {
      setSuspectVoteMessage("請將六個角色由最相關排到最不相關後再送出");
      return;
    }

    setIsSubmittingSuspectVote(true);
    setSuspectVoteMessage("正在送出我的判斷...");

    try {
      const data = await submitSuspectVotes(token, ranking);
      applyVotingStatus(data);
      setDraftSuspectVotes([]);
      setSuspectVoteMessage("排序已送出");
      logActivity({
        eventType: "suspect_vote_submit_click",
        eventLabel: "學生送出嫌犯排序投票",
        targetType: "suspectVoting",
        newValue: { ranking, topRoleId: ranking[0] },
      });
    } catch (error) {
      console.error(error);
      setSuspectVoteMessage(
        error instanceof Error ? error.message : "送出我的判斷失敗",
      );
    } finally {
      setIsSubmittingSuspectVote(false);
    }
  }

  function goPage(nextPage: Page) {
    if (
      !isTeacher &&
      finalDecisionSettlement.isFinalized &&
      nextPage !== "ending"
    ) {
      forceFinalEndingPage();
      return;
    }

    if (
      (nextPage === "teacherGroups" || nextPage === "teacherStudentData") &&
      !isTeacher
    ) {
      window.history.pushState({ page: "home" }, "", window.location.href);
      startTransition(() => setPage("home"));
      return;
    }

    window.history.pushState({ page: nextPage }, "", window.location.href);
    startTransition(() => setPage(nextPage));

    logActivity({
      eventType: "page_visit",
      eventLabel: "切換頁面",
      targetType: "page",
      targetId: nextPage,
      metadata: { from: page, to: nextPage },
    });
  }

  function goToReportPage(nextIndex: number) {
    setReportPageIndex(clamp(nextIndex, 0, reportPageCount - 1));
  }

  function getSuspectGroupLabel(groupId: string) {
    return (
      SUSPECT_GROUPS.find((group) => group.id === groupId)?.shortName ||
      SUSPECT_GROUPS.find((group) => group.id === groupId)?.name ||
      groupId
    );
  }

  function renderMySuspectVoteCard() {
    if (votingStatus.myVotes.length === 0) return null;

    return (
      <div className="relative w-full min-w-0 max-w-[9.5rem] overflow-hidden rounded-[18px] border-2 border-[#cbb894] bg-[#fffaf0]/92 px-3 py-2 text-left shadow-[0_10px_24px_rgba(45,41,34,0.10)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-[#9b2f2f]/10 blur-2xl" />
        <p className="relative truncate text-[9px] font-black tracking-[0.14em] text-[#8b5e34]">
          TOP SUSPECT
        </p>
        <p className="relative mt-1 break-words text-sm font-black leading-snug text-[#3b2f22]">
          {getSuspectGroupLabel(votingStatus.myVotes[0])}
        </p>
      </div>
    );
  }

  function renderClassSuspectVerdictCard() {
    if (!votingStatus.isFinalized) return null;
    const suspects = Array.isArray(votingStatus.finalizedSuspects)
      ? votingStatus.finalizedSuspects
      : [];
    if (suspects.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[26px] border-2 border-[#8b2f2f]/70 bg-[#fff7e6]/95 p-4 text-center shadow-[0_18px_42px_rgba(45,41,34,0.18)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(155,47,47,0.08)_0_1px,transparent_1px_18px)]" />
        <p className="relative text-[10px] font-black tracking-[0.28em] text-[#8b5e34]">
          CLASS VERDICT
        </p>
        <p className="relative mt-2 text-xs font-black text-stone-500">
          全班投票結果
        </p>
        <p className="relative mt-1 text-lg font-black leading-snug text-[#33251d]">
          {suspects
            .map(
              (suspect) =>
                suspect.roleName ||
                suspect.groupName ||
                getSuspectGroupLabel(suspect.roleId || suspect.groupId),
            )
            .join("、")}
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 1.8, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: -12 }}
          transition={{
            delay: 0.18,
            type: "spring",
            stiffness: 260,
            damping: 12,
          }}
          className="pointer-events-none absolute inset-2 flex items-center justify-center"
        >
          <div className="rotate-[-10deg] rounded-xl border-[6px] border-[#b42323]/85 px-7 py-4 text-5xl font-black tracking-[0.16em] text-[#b42323]/85 mix-blend-multiply shadow-[0_0_0_2px_rgba(180,35,35,0.12)] [text-shadow:0_2px_0_rgba(255,255,255,0.35)]">
            兇手
          </div>
        </motion.div>
      </motion.div>
    );
  }

  function startNewExploration() {
    if (!isInquiryTaskOpen && !isTeacher) return;

    const nextInquiryOrder = finalSummaries.length + 1;
    setOrientationMainChoice("");
    setOrientationTextInput("");
    setActiveInquiryRecordOrder(nextInquiryOrder);

    goPage("cards");

    window.setTimeout(() => {
      if (token) {
        void createInquiryRecord(token, nextInquiryOrder).catch((error) => {
          // The actual inquiry plan/final summary save paths are idempotent and can still
          // create/update this record. Do not block the page transition on cloud latency.
          console.error("背景建立新的案件調查紀錄失敗，後續儲存流程仍會重試：", error);
        });
      }

      logActivity({
        eventType: "exploration_start",
        eventLabel: `開始${getInvestigationCaseByOrder(nextInquiryOrder).title}`,
        targetType: "exploration",
      });
    }, 0);
  }

  async function toggleFullscreen() {
    if (!canUseFullscreen) return;

    if (shouldUseCssImmersive) {
      setIsFullscreen((current) => !current);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("無法切換全螢幕模式：", error);
    }
  }

  const updateHomeTitles = useCallback((titles: TitleReward[]) => {
    setEarnedHomeTitles((prev) => {
      const rewardMap = new Map(
        prev
          .filter(isSupportedHomeTitleReward)
          .map((title) => [title.id, title]),
      );

      titles
        .filter(isSupportedHomeTitleReward)
        .forEach((title) => rewardMap.set(title.id, title));

      const nextTitles = Array.from(rewardMap.values());

      const isSame =
        nextTitles.length === prev.length &&
        nextTitles.every((title, index) => title.id === prev[index]?.id);

      if (isSame) return prev;

      return nextTitles;
    });
  }, []);

  // InquiryData owns inquiry database writes through /api/inquiries/* .
  // HomePage keeps local UI state only and does not run the legacy /api/user-data sync.

  function handleSubmitSummary(summary: FinalSummary) {
    setFinalSummaries((prev) => {
      const next = upsertFinalSummary(prev, summary);
      const completedCount = next.filter(isCompletedFinalSummary).length;
      const newReportIndex = Math.max(0, next.length - 1);
      // 回首頁時必須先停在「剛完成的那份調查成果」，讓學生看見自己寫完的成果，
      // 之後才自動翻到下一份任務。原本第一次完成時會直接落在 next.length，
      // 導致畫面捲到 INQUIRYBOOK 時已經是任務二，看不到任務一 → 任務二的翻頁。
      const revealStartIndex = clamp(newReportIndex, 0, next.length);
      let reward: TitleReward | null = null;

      if (completedCount >= 5) {
        reward = {
          id: "investigation_master",
          name: "首席調查官",
          description: "完成 5 份探究調查成果",
        };
      } else if (completedCount >= 4) {
        reward = {
          id: "investigation_advanced",
          name: "資深調查員",
          description: "完成 4 份探究調查成果",
        };
      } else if (completedCount >= 1) {
        reward = {
          id: "investigation_novice",
          name: "見習調查員",
          description: "完成 1 份探究調查成果",
        };
      }

      const didEarnNewInvestigationTitle = Boolean(
        reward && !earnedHomeTitles.some((title) => title.id === reward?.id),
      );

      if (reward) {
        setEarnedHomeTitles((titlePrev) => {
          const alreadyHasReward = titlePrev.some(
            (title) => title.id === reward?.id,
          );

          if (alreadyHasReward) return titlePrev;
          setTitleRewardToast(reward);
          return [...titlePrev, reward];
        });
      }

      // 送出調查結論後，回首頁先定位到調查書區塊，
      // 再自動翻到下一份任務的建立頁。
      const nextTaskPageIndex = newReportIndex + 1;
      setReportPageIndex(revealStartIndex);
      setPendingReportReveal({
        startIndex: revealStartIndex,
        targetIndex: nextTaskPageIndex,
        waitForTitleReward: didEarnNewInvestigationTitle,
      });

      return next;
    });

    // final_summary_submit is written once by the backend after /api/inquiries/final-summaries succeeds.

    setActiveInquiryRecordOrder(null);
    goPage("home");
  }

  function renderHomePage() {
    return (
      <div
        className={`${shouldUseCssImmersive && isFullscreen ? "app-css-immersive-mode " : ""}game-adventure-page uiux-page-shell relative min-h-[100svh] overflow-x-hidden p-3 text-stone-800 sm:p-6`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.22),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.06)_0_1px,transparent_1px_32px)]" />
          <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-stone-300/20 blur-[90px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c1ad]/25 blur-[110px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <HomeHeader
            classSuspectVerdictCard={renderClassSuspectVerdictCard()}
            isCardPackOpen={isCardPackOpen}
            onOpenCardPack={() => goPage("cardPack")}
            stats={
              <div className="uiux-stats-grid">
                <StatCard
                  value={finalSummaries.length}
                  label="探究調查書"
                  color="blue"
                />
                <StatCard
                  value={markedMapCount}
                  label="石虎地圖"
                  color="emerald"
                />
                <StatCard
                  value={earnedHomeTitles.length}
                  label="稱號"
                  color="amber"
                />
              </div>
            }
            userControls={
              <div className="uiux-stats-grid">
                <div className="flex h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] min-w-0 items-center justify-center rounded-xl border border-stone-200 bg-white/70 px-2 text-center text-[11px] font-bold leading-tight text-stone-600 shadow-sm">
                  <span className="block truncate">
                    {currentUser?.username} 已登入
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${GAME_BTN} ${GAME_BTN_BLUE} flex h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] items-center justify-center px-2 py-0 text-[11px]`}
                >
                  登出
                </button>

                <div className="hidden h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] sm:block" />
              </div>
            }
          />

          <div className="mb-4 min-[700px]:hidden">
            {renderClassSuspectVerdictCard()}
          </div>

          <main className="grid gap-6">
            <div className="uiux-dashboard-grid">
              {renderReportSection()}
              {renderMapSection()}
            </div>
            <HomeTitleCollectionSection
              earnedHomeTitles={earnedHomeTitles}
              sectionRef={titleCollectionSectionRef}
            />
          </main>
        </div>

        <AnimatePresence>
          {openedReport ? (
            <ReportPreviewModal
              summary={openedReport}
              index={openedReportIndex ?? 0}
              onClose={() => setOpenedReportIndex(null)}
            />
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  function renderReportSection() {
    return (
      <TaskOneCard ref={reportSectionRef}>
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.08)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.06)_1px,transparent_1px)] bg-[size:26px_26px]" />
          <div className="absolute -left-20 top-12 h-52 w-52 rounded-full bg-[#8b6f47]/10 blur-[70px]" />
          <div className="home-small-label absolute right-8 top-8 rotate-[-12deg] rounded-md border-2 border-[#9b2f2f]/30 px-5 py-2 text-xs font-semibold tracking-[0.18em] text-[#9b2f2f]/32">
            CASE FILE
          </div>
        </div>

        <div className="relative mb-5 flex flex-col items-stretch justify-between gap-4 border-b border-[#cdbb9c] pb-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#c9b38e] bg-[#f8f1df] text-3xl shadow-sm">
              🔍
            </div>
            <div>
              <div className="home-eyebrow-label mb-2 inline-flex items-center gap-2 rounded-full border border-[#cbb894] bg-[#f8f1df]/80 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[#7a6a52]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7d8b6f]" />
                DETECTIVE DOSSIER
              </div>
              <h2 className="home-task-title text-[clamp(1.72rem,2.5vw,2rem)] font-semibold tracking-[0.04em] text-[#2f2a24]">
                任務一：調查
              </h2>
            </div>
          </div>
          {votingStatus.myVotes.length > 0 ? (
            <div className="relative z-20 flex w-full min-w-0 justify-start min-[700px]:w-auto min-[700px]:max-w-[9.5rem] min-[700px]:shrink-0 min-[700px]:justify-end">
              {renderMySuspectVoteCard()}
            </div>
          ) : null}
        </div>

        <div className="relative rounded-[30px] border border-[#c7b594] bg-[#d9c9a8] p-3 shadow-inner">
          <div className="home-tab-label absolute -top-3 left-10 z-10 rounded-t-2xl border-x border-t border-[#c7b594] bg-[#d9c9a8] px-8 py-2 text-xs font-semibold tracking-[0.13em] text-[#6d5e49] shadow-sm">
            INQUIRY BOOK
          </div>
          <div className="absolute left-4 top-16 z-10 h-20 w-3 rounded-full bg-[#9b2f2f]/65 shadow-sm" />
          <div className="absolute bottom-10 left-4 z-10 h-20 w-3 rounded-full bg-[#9b2f2f]/65 shadow-sm" />

          <div className="overflow-hidden rounded-[24px] border border-[#bba985] bg-[#fbf5e8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]">
            <div
              className="flex items-stretch cursor-grab touch-pan-y select-none active:cursor-grabbing"
              style={{
                width: `${reportPageCount * 100}%`,
                transform: `translateX(calc(-${safeReportPageIndex * (100 / reportPageCount)}% + ${reportDragOffset}px))`,
                transition:
                  reportDragStartXRef.current === null
                    ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "none",
              }}
              onPointerDown={(event) => {
                const reportCard = (event.target as HTMLElement).closest(
                  "[data-report-page-index]",
                );
                const reportIndex = reportCard?.getAttribute(
                  "data-report-page-index",
                );

                reportPressReportIndexRef.current =
                  reportIndex === undefined || reportIndex === null
                    ? null
                    : Number(reportIndex);
                reportDragStartXRef.current = event.clientX;
                setReportDragOffsetNow(0);
                reportDidDragRef.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (reportDragStartXRef.current === null) return;
                const offset = event.clientX - reportDragStartXRef.current;
                reportDidDragRef.current = Math.abs(offset) > 12;
                scheduleReportDragOffset(offset);
              }}
              onPointerUp={(event) => {
                if (reportDragStartXRef.current === null) return;
                const offset = event.clientX - reportDragStartXRef.current;
                const wasDragging = Math.abs(offset) > 12;
                reportDragStartXRef.current = null;
                reportDidDragRef.current = wasDragging;
                setReportDragOffsetNow(0);

                if (offset < -80) {
                  setReportPageIndex((prev) =>
                    clamp(prev + 1, 0, reportPageCount - 1),
                  );
                } else if (offset > 80) {
                  setReportPageIndex((prev) =>
                    clamp(prev - 1, 0, reportPageCount - 1),
                  );
                } else if (!wasDragging) {
                  const reportIndex = reportPressReportIndexRef.current;
                  if (
                    reportIndex !== null &&
                    Number.isFinite(reportIndex) &&
                    reportIndex >= 0 &&
                    reportIndex < finalSummaries.length
                  ) {
                    setOpenedReportIndex(reportIndex);
                  }
                }

                reportPressReportIndexRef.current = null;

                window.setTimeout(
                  () => {
                    reportDidDragRef.current = false;
                  },
                  wasDragging ? 160 : 0,
                );
              }}
              onPointerCancel={() => {
                reportDragStartXRef.current = null;
                reportPressReportIndexRef.current = null;
                setReportDragOffsetNow(0);
                window.setTimeout(() => {
                  reportDidDragRef.current = false;
                }, 0);
              }}
              onClickCapture={(event) => {
                if (!reportDidDragRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {finalSummaries.map((summary, index) => (
                <div
                  key={`report-${index}`}
                  data-report-page-index={index}
                  className="shrink-0"
                  style={{ width: `${100 / reportPageCount}%` }}
                >
                  <ReportPage
                    summary={summary}
                    caseMeta={getInvestigationCaseBySummary(summary, index)}
                    onOpen={() => {
                      if (!reportDidDragRef.current)
                        setOpenedReportIndex(index);
                    }}
                  />
                </div>
              ))}

              <div
                className="shrink-0 self-stretch px-1"
                style={{ width: `${100 / reportPageCount}%` }}
              >
                <div className="group relative flex h-full min-h-[450px] w-full flex-col items-center justify-center overflow-hidden rounded-[26px] bg-[#fffaf0] p-6">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_30px]" />
                  <div className="pointer-events-none absolute right-8 top-8 rotate-[-10deg] rounded-md border-2 border-[#9b2f2f]/25 px-4 py-2 text-xs font-black tracking-[0.26em] text-[#9b2f2f]/25">
                    NEW CASE
                  </div>
                  <button
                    type="button"
                    aria-disabled={!isInquiryTaskOpen && !isTeacher}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();

                      if (!isInquiryTaskOpen && !isTeacher) {
                        setInquiryLockHint(true);
                        return;
                      }

                      setInquiryLockHint(false);
                      void startNewExploration();
                    }}
                    className={`relative mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#b8a37d] bg-gradient-to-br from-[#fff8e8] to-[#e9dcc1] text-6xl font-semibold leading-none text-[#4f4333] shadow-[0_14px_30px_rgba(72,56,34,0.18)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(72,56,34,0.22)] active:translate-y-0 ${!isInquiryTaskOpen && !isTeacher ? "cursor-not-allowed grayscale opacity-45 hover:translate-y-0" : ""}`}
                  >
                    +
                  </button>
                  {inquiryLockHint && !isInquiryTaskOpen && !isTeacher ? (
                    <p className="relative -mt-2 mb-4 rounded-full border border-amber-200 bg-amber-50/90 px-4 py-2 text-center text-xs font-black tracking-[0.08em] text-amber-700 shadow-sm">
                      老師開啟任務後就可以開始調查
                    </p>
                  ) : null}
                  <p className="relative font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
                    {getNextInvestigationCase(finalSummaries.length).title}
                  </p>
                  <p className="relative mt-2 text-sm text-[#756957]">
                    {getNextInvestigationCase(finalSummaries.length).task}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center overflow-hidden px-2">
            <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-[#b79f7a]/55 bg-[#fffaf0]/58 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(72,52,36,0.14)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Array.from({ length: reportPageCount }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToReportPage(index)}
                  aria-label={`前往第 ${index + 1} 頁`}
                  className={`shrink-0 rounded-full p-0 transition ${
                    safeReportPageIndex === index
                      ? "bg-[#6f5b42] shadow-[0_0_0_3px_rgba(255,250,240,0.92),0_4px_12px_rgba(72,52,36,0.22)]"
                      : "border border-[#8f7a5d]/40 bg-white/58 hover:bg-[#fffaf0]/82"
                  }`}
                  style={{
                    width: safeReportPageIndex === index ? 32 : 10,
                    minWidth: safeReportPageIndex === index ? 32 : 10,
                    height: 10,
                    minHeight: 10,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </TaskOneCard>
    );
  }

  function renderMapSection() {
    const safeMapPreviewPageIndex = clamp(
      mapPreviewPageIndex,
      0,
      Math.max(mapPreviewPages.length - 1, 0),
    );
    const currentMapPreviewPage =
      mapPreviewPages[safeMapPreviewPageIndex] ?? mapPreviewPages[0];

    return (
      <TaskTwoMapPreview>
        <div className="pointer-events-none absolute inset-0 opacity-75">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(99,91,71,0.07)_1px,transparent_1px),linear-gradient(rgba(99,91,71,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.52),transparent_32%),radial-gradient(circle_at_82%_78%,rgba(111,123,98,0.18),transparent_34%)]" />
        </div>

        <div className="relative mb-5 flex shrink-0 flex-col items-stretch justify-between gap-4 border-b border-[#c5bba3] pb-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#bdb294] bg-[#f7f1e3] text-2xl shadow-sm sm:h-14 sm:w-14 sm:text-3xl">
              🗺️
            </div>

            <div className="min-w-0 flex-1">
              <div className="home-eyebrow-label mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#bbb296] bg-[#f7f1e3]/85 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-[#68614f] sm:text-[11px]">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isMapTaskOpen ? "bg-[#77866b]" : "bg-stone-400"
                  }`}
                />
                <span className="whitespace-nowrap">MYSTERY MAP</span>
              </div>

              <h2 className="home-task-title whitespace-nowrap text-[clamp(1.55rem,4.2vw,1.95rem)] font-semibold leading-tight tracking-[0.035em] text-[#2f2a24]">
                任務二：繪製地圖
              </h2>
            </div>
          </div>

          <div className="relative z-20 flex w-full min-w-0 justify-start lg:w-auto lg:max-w-[9.5rem] lg:shrink-0 lg:justify-end">
            <button
              type="button"
              disabled={!isMapTaskOpen}
              onClick={() => goPage("map")}
              className={`${GAME_BTN} home-action-label flex h-[42px] w-full max-w-[9.5rem] min-w-0 items-center justify-center rounded-xl px-2 py-0 text-center text-[11px] font-semibold leading-tight tracking-[0.055em] sm:text-xs ${
                isMapTaskOpen
                  ? "border-[#a9b39a] bg-[#f4f7ef] text-[#46513e] hover:border-[#7d8b6f] hover:bg-[#edf3e6]"
                  : GAME_BTN_DISABLED
              }`}
            >
              <span className="block min-w-0 break-words">
                {isMapTaskOpen ? "出發畫地圖" : "地圖任務準備中"}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`uiux-home-map-stage relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-[24px] border transition sm:min-h-[514px] sm:rounded-[30px] ${
            isMapTaskOpen
              ? "border-[#d9d2b8] bg-[#fff8e8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.62)]"
              : "border-stone-200 bg-stone-100"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
            <div className="absolute inset-0 bg-[#fff8e8]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(247,241,227,0.85),transparent_28%),radial-gradient(circle_at_72%_68%,rgba(151,183,129,0.16),transparent_35%),radial-gradient(circle_at_44%_82%,rgba(244,211,107,0.18),transparent_30%)]" />
            <div className="absolute inset-0 opacity-35 bg-[repeating-linear-gradient(25deg,transparent_0_11px,rgba(105,126,85,0.09)_12px,transparent_13px),repeating-linear-gradient(-18deg,transparent_0_18px,rgba(255,255,255,0.18)_19px,transparent_20px)]" />
            <div className="absolute inset-x-8 top-8 h-px bg-[#b8a87d]/25" />
            <div className="absolute inset-x-8 bottom-12 h-px bg-[#b8a87d]/25" />
          </div>

          {!isMapTaskOpen ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/20 backdrop-blur-sm">
              <div className="rounded-3xl border border-white/70 bg-[#fffaf0]/92 px-6 py-5 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#c8b48f] bg-[#efe5d1] text-3xl">
                  🔒
                </div>
                <p className="text-lg font-semibold text-stone-700">
                  地圖小任務還沒開門喔
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  等待任務開啟就可以出發囉
                </p>
              </div>
            </div>
          ) : null}

          {currentMapPreviewPage ? (
            <div
              className={`relative z-10 flex h-full min-h-[420px] w-full cursor-grab touch-pan-y select-none items-center justify-center overflow-hidden active:cursor-grabbing sm:min-h-[514px] ${
                isMapTaskOpen ? "" : "pointer-events-none grayscale"
              }`}
              style={{ opacity: isMapTaskOpen ? 1 : 0.35 }}
              onPointerDown={(event) => {
                if (!isMapTaskOpen) return;
                mapDragStartXRef.current = event.clientX;
                setMapDragOffsetNow(0);
                mapDidDragRef.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!isMapTaskOpen || mapDragStartXRef.current === null) return;
                const offset = event.clientX - mapDragStartXRef.current;
                if (Math.abs(offset) > 4) mapDidDragRef.current = true;
                scheduleMapDragOffset(offset);
              }}
              onPointerUp={(event) => {
                if (!isMapTaskOpen || mapDragStartXRef.current === null) return;
                const offset = event.clientX - mapDragStartXRef.current;
                mapDragStartXRef.current = null;
                setMapDragOffsetNow(0);

                if (offset < -80) {
                  setMapPreviewPageIndex((prev) =>
                    Math.min(prev + 1, mapPreviewPages.length - 1),
                  );
                } else if (offset > 80) {
                  setMapPreviewPageIndex((prev) => Math.max(prev - 1, 0));
                }

                window.setTimeout(() => {
                  mapDidDragRef.current = false;
                }, 0);
              }}
              onPointerCancel={() => {
                mapDragStartXRef.current = null;
                setMapDragOffsetNow(0);
                window.setTimeout(() => {
                  mapDidDragRef.current = false;
                }, 0);
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentMapPreviewPage.title}
                  className="uiux-home-map-slide relative flex h-full min-h-[420px] w-full flex-col items-center justify-center overflow-hidden sm:min-h-[514px]"
                  initial={{ opacity: 0, x: mapDragOffset < 0 ? 36 : -36 }}
                  animate={{ opacity: 1, x: mapDragOffset }}
                  exit={{ opacity: 0, x: mapDragOffset < 0 ? -36 : 36 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="absolute left-5 top-16 z-20 rounded-2xl border border-[#d7c6a3]/55 bg-[#fffdf6]/84 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
                    <p className="home-small-label text-[10px] font-semibold tracking-[0.14em] text-[#68614f]">
                      {currentMapPreviewPage.title}
                    </p>

                    {safeMapPreviewPageIndex === 1 &&
                    currentMapPreviewPage.subtitle ? (
                      <p className="mt-[2px] text-[9px] font-semibold text-[#5f5a4a]">
                        {currentMapPreviewPage.subtitle}
                      </p>
                    ) : null}
                  </div>

                  {currentMapPreviewPage.locked ? (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f8f1e3]/72 backdrop-blur-[3px]">
                      <div className="max-w-[82%] rounded-[26px] border border-[#b7aa8e]/70 bg-[#fffaf0]/92 px-6 py-5 text-center shadow-[0_18px_44px_rgba(72,52,36,0.18)]">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#c8b48f] bg-[#efe5d1] text-2xl">🔒</div>
                        <p className="text-base font-black tracking-[0.05em] text-[#4f4a3c]">尚未開啟</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[#706852]">{currentMapPreviewPage.lockReason}</p>
                      </div>
                    </div>
                  ) : null}

                  <svg
                    viewBox={MIAOLI_MAP_VIEW_BOX}
                    className={`uiux-home-map-svg h-full w-full transform-gpu transition ${currentMapPreviewPage.locked ? "opacity-35 grayscale" : ""}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <pattern
                        id={`map-paper-grid-${safeMapPreviewPageIndex}`}
                        width="16"
                        height="16"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 16 0 L 0 0 0 16"
                          fill="none"
                          stroke="#b9aa8c"
                          strokeWidth="0.35"
                          opacity="0.22"
                        />
                      </pattern>
                    </defs>

                    <rect
                      x="12"
                      y="74"
                      width="352"
                      height="272"
                      fill={`url(#map-paper-grid-${safeMapPreviewPageIndex})`}
                      opacity="0.24"
                    />

                    <g>
                      {regions.map((region: (typeof regions)[number]) => {
                        const state = currentMapPreviewPage.map[region.name];

                        return (
                          <g key={`shape-${region.name}`}>
                            <path
                              d={region.d}
                              fill={
                                state === "保育"
                                  ? "#cfe9c4"
                                  : state === "開發"
                                    ? "#f4c8b7"
                                    : state === "我不知道"
                                      ? "#d9dee7"
                                      : "#fffdf6"
                              }
                              stroke="#b7a783"
                              strokeWidth="0.85"
                              vectorEffect="non-scaling-stroke"
                            />
                            <path
                              d={region.d}
                              fill={`url(#map-paper-grid-${safeMapPreviewPageIndex})`}
                              opacity="0.28"
                              stroke="#fff8e8"
                              strokeWidth="0.35"
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        );
                      })}
                    </g>

                    <g className="pointer-events-none">
                      {regions.map((region: (typeof regions)[number]) => {
                        const pos = labelPositions[region.name];

                        return (
                          <text
                            key={`label-${region.name}`}
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={pos.size}
                            fontWeight="900"
                            fill="#3f4a37"
                            stroke="#fffdf6"
                            strokeWidth="2.4"
                            paintOrder="stroke"
                          >
                            {region.name}
                          </text>
                        );
                      })}
                    </g>
                  </svg>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : null}

          {isMapTaskOpen ? (
            <div className="uiux-home-map-pager absolute bottom-16 left-1/2 z-20 w-[min(92%,520px)] -translate-x-1/2 rounded-[22px] border border-[#d7c6a3]/55 bg-[#fffdf6]/82 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(72,52,36,0.16)] backdrop-blur-md">
              <div className="grid grid-cols-3 gap-2">
                {mapPreviewPages.map((pageInfo, index) => {
                  const active = safeMapPreviewPageIndex === index;

                  return (
                    <button
                      key={pageInfo.title}
                      type="button"
                      onClick={() => setMapPreviewPageIndex(index)}
                      className={`group min-w-0 rounded-[16px] border px-2 py-2 text-center transition-all duration-300 ${
                        active
                          ? "border-[#78a46d] bg-[#eef9e8] text-[#365a3f] shadow-[0_5px_14px_rgba(72,52,36,0.16)]"
                          : pageInfo.locked
                            ? "border-[#d7c6a3]/35 bg-white/40 text-[#9a8f75]"
                            : "border-[#d7c6a3]/40 bg-white/58 text-[#746b59] hover:bg-[#fffdf6]/86"
                      }`}
                      aria-label={`切換到${pageInfo.title}`}
                    >
                      <span
                        className={`mx-auto mb-1 block h-1.5 rounded-full transition-all duration-300 ${
                          active ? "w-full bg-[#78a46d]" : "w-8 bg-[#bcb39b]"
                        }`}
                      />
                      <span className="block truncate text-[10px] font-black leading-tight tracking-[0.08em] sm:text-[11px]">
                        {index + 1}. {pageInfo.locked ? "🔒 " : ""}{pageInfo.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="absolute left-5 top-5 z-10 rounded-2xl border border-[#d7c6a3]/55 bg-[#fffdf6]/84 px-3 py-2 home-small-label text-[10px] font-semibold tracking-[0.14em] text-[#68614f] shadow-sm backdrop-blur-sm">
            MIAOLI COUNTY
          </div>

          <div className="uiux-home-map-legend absolute bottom-3 left-1/2 z-10 flex w-[94%] max-w-[520px] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl sm:gap-5 sm:rounded-full border border-[#d7c6a3]/50 bg-[#fffdf6]/86 px-6 py-2 text-xs font-semibold text-[#5f5a4a] shadow-sm backdrop-blur-sm">
            <Legend
              color="bg-[#fffdf6] border border-[#d7c6a3]"
              label="未標記"
            />
            <Legend color="bg-[#cfe9c4] border border-[#8ab27d]" label="保育" />
            <Legend color="bg-[#f4c8b7] border border-[#cf967f]" label="開發" />
            <Legend
              color="bg-[#d9dee7] border border-[#aab3c0]"
              label="我不知道"
            />
          </div>
        </div>
      </TaskTwoMapPreview>
    );
  }


  function renderActivePage() {
    if (page === "home") {
      return isTeacher ? (
        <TeacherManagementCenter
          token={token!}
          currentUser={currentUser!}
          isFullscreen={isFullscreen}
          canUseFullscreen={canUseFullscreen}
          onLogout={handleLogout}
          onToggleFullscreen={toggleFullscreen}
          onOpenGroups={() => goPage("teacherGroups")}
          onOpenStudentData={() => goPage("teacherStudentData")}
          onOpenMap={() => goPage("map")}
          onActivityLog={logActivity}
        />
      ) : (
        renderHomePage()
      );
    }

    if (page === "cards") {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <InquiryData
            token={token!}
            currentInquiryOrder={
              activeInquiryRecordOrder ?? finalSummaries.length + 1
            }
            orientationMainChoice={orientationMainChoice}
            orientationTextInput={orientationTextInput}
            draftStorageKey={`cityauncel_inquiry_draft_${currentUser!.id}`}
            inquiryRecordOrder={activeInquiryRecordOrder}
            onBackToHome={() => {
              setActiveInquiryRecordOrder(null);
              goPage("home");
            }}
            onTitleRewardsChange={updateHomeTitles}
            onSubmitSummary={handleSubmitSummary}
            unlockedCardIds={unlockedCards}
            setUnlockedCardIds={setUnlockedCards}
            onActivityLog={logActivity}
            onAiHelperAvailabilityChange={setIsAiHelperAvailable}
          />
        </Suspense>
      );
    }

    if (page === "cardPack") {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <CardPackPage
            token={token!}
            currentUser={currentUser!}
            unlockedCards={unlockedCards}
            setUnlockedCards={setUnlockedCards}
            realtimeLockSignal={realtimeCardPackLockSignal}
            onBack={() => goPage("home")}
            onActivityLog={logActivity}
          />
        </Suspense>
      );
    }

    if (page === "ending" && finalDecisionSettlement.isFinalized) {
      return (
        <FinalEndingPage
          settlement={finalDecisionSettlement}
          isTeacher={isTeacher}
          onBackHome={() => goPage("home")}
        />
      );
    }

    if (page === "map") {
      return (
        <MiaoliMap
          uiStorageKey={`cityauncel_map_ui_${currentUser?.id || "guest"}`}
          onBack={() => goPage("home")}
          groupName={currentUser?.groupName ?? null}
          isGroupLeader={Boolean(currentUser?.isGroupLeader)}
          isTeacher={isTeacher}
          groupMembers={currentUser?.groupMembers ?? []}
          initialState={mapState}
          personalData={groupPersonalData}
          groupData={classGroupData}
          groupFinalChoices={groupFinalChoices}
          classFinalChoices={classFinalChoices}
          isPersonalMapLocked={isPersonalMapLocked}
          personalLockSummary={personalLockSummary}
          isGroupReady={isGroupReady}
          isGroupMapLocked={isGroupMapLocked}
          groupLockSummary={groupLockSummary}
          groupLockStatuses={groupLockStatuses}
          allGroupsLocked={allGroupsLocked}
          unlockedCards={unlockedCards as MapUnlockedCardData[]}
          mapFlowMessage={mapFlowMessage}
          mapSyncStatus={mapSyncStatus}
          isLockPersonalMapPending={isMapLockSubmitting}
          isLockGroupMapPending={isGroupMapLockSubmitting}
          onDecisionsChange={handleMapDecisionsChange}
          onManualDecisionChange={handleManualDecisionChange}
          onLockPersonalMap={handleLockPersonalMap}
          onLockGroupMap={handleLockGroupMap}
        />
      );
    }

    if (page === "teacherGroups" && isTeacher) {
      return <ControlPage token={token!} onBack={() => goPage("home")} />;
    }

    if (page === "teacherStudentData" && isTeacher) {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <BehaviorRecord token={token!} onBack={() => goPage("home")} />
        </Suspense>
      );
    }

    return renderHomePage();
  }

  if (!token || !currentUser) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <BarrageLayer token={token} />
      {!isTeacher && page === "cards" && isAiHelperAvailable ? (
        <AiInquiryAssistant
          token={token}
          currentPage={page}
          currentPageLabel="數據清單"
          roundKey={`round-${activeInquiryRecordOrder ?? finalSummaries.length + 1}-cards`}
        />
      ) : null}

      <AnimatePresence
        onExitComplete={() => {
          setIsTitleRewardSequenceActive(false);
        }}
      >
        {titleRewardToast ? (
          <TitleRewardToast
            key={titleRewardToast.id}
            title={titleRewardToast}
          />
        ) : null}
      </AnimatePresence>

      <PageTransitionFrame key={page}>{renderActivePage()}</PageTransitionFrame>

      {!isTeacher && isStudentScreenLocked ? (
        <StudentScreenLockOverlay />
      ) : null}

      {!isTeacher && finalEndingCountdown !== null ? (
        <FinalEndingCountdownOverlay seconds={finalEndingCountdown} />
      ) : null}

      {shouldShowSuspectVoteModal ? (
        <SuspectVotingModal
          ranking={
            draftSuspectVotes.length === SUSPECT_GROUPS.length
              ? draftSuspectVotes
              : DEFAULT_SUSPECT_ROLE_RANKING
          }
          message={suspectVoteMessage}
          isSubmitting={isSubmittingSuspectVote}
          onMoveRole={moveDraftSuspectRole}
          onSubmit={submitSuspectVote}
        />
      ) : null}
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </div>
  );
}
