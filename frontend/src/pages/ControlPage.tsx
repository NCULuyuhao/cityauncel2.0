/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 ControlPage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { MIAOLI_MAP_VIEW_BOX, labelPositions, regions } from "../data/miaoliMapView";
import { subscribeRealtime } from "../api/realtime";
import { getDecisionCardGameState } from "../api/cardPackApi";
import type { DecisionCardGameState } from "../api/cardPackApi";
import { buildPackCards, GROUP_ORDER, GROUP_PACK_META, resolveGroup } from "../features/cardPack/cardPackModel";
import {
  clearTeacherDatabaseData,
  closeDecisionSettlementApi,
  finalizeDecisionSettlementApi,
  finishSuspectVotingApi,
  getTeacherControlStatuses,
  getTeacherGroupCardPackLocks,
  getTeacherPlayers,
  saveTeacherPlayerGroups,
  unlockAllTeacherGroupCardPacks,
  unlockTeacherGroupCardPack,
  settleTeacherDecisionCardRound,
  updateCardPackStatus,
  updateInquiryTaskStatus,
  updateMapTaskStatus,
  updateStudentScreenLock,
  updateSuspectVotingStatus,
} from "../api/controlApi";
import type { VotingStatusApi } from "../api/homeApi";
import {
  clearControlPageBrowserDrafts,
  readTeacherGroupsDraft,
  removeTeacherGroupsDraft,
  saveTeacherGroupsDraft,
} from "../storage/controlPageStorage";

type GroupId =
  | "environment"
  | "government"
  | "farming"
  | "animal"
  | "greenEnergy"
  | "education";

type Player = {
  id: string;
  name: string;
  username?: string;
  email?: string;
  groupId: GroupId | "unassigned";
  isGroupLeader?: boolean;
};

type Group = {
  id: GroupId;
  name: string;
  icon: string;
  color: string;
};

type ControlPageProps = {
  onBack?: () => void;
  token?: string | null;
  initialPlayers?: Player[];
  onSaveGroups?: (players: Player[]) => void;
};

const MAX_GROUP_SIZE = 6;

const GAME_BTN =
  "relative overflow-hidden rounded-xl border px-5 py-3 text-sm font-semibold tracking-[0.12em] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]";
const GAME_BTN_BLUE =
  "border-stone-300 bg-white/85 text-stone-700 hover:border-stone-500 hover:bg-stone-50";
const GAME_BTN_AMBER =
  "border-[#d6a94f] bg-[#fff2c7] text-[#7a4b12] hover:border-[#b77b1b] hover:bg-[#ffe7a4]";
const CLEAR_DATABASE_CONFIRM_TEXT = "清空資料表";

type TeacherUser = {
  id: number;
  username: string;
  email: string;
  role?: "teacher" | "student";
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

type SuspectVotingStatus = {
  isOpen: boolean;
  isFinalized: boolean;
  finalizedSuspects?: Array<{ roleId?: string; roleName?: string; groupId: string; groupName: string; count: number }>;
  finalizedAt?: string | null;
  totals: Record<string, number>;
  totalVoters: number;
  totalEligibleVoters: number;
  myVotes: string[];
};

type GroupCardDecisionLockStatus = {
  groupId: GroupId;
  groupName: string;
  isLocked: boolean;
  selectedCardIds: string[];
  reason?: string;
  lockedBy?: number | string | null;
  lockedAt?: string | null;
  unlockVersion?: string | null;
};

type FinalDecisionSettlementStatus = {
  isFinalized: boolean;
  outcome?: { title?: string; id?: string };
  totalScore?: number;
  finalizedAt?: string | null;
};

type TeacherManagementCenterProps = {
  token: string | null;
  currentUser: TeacherUser | null;
  isFullscreen: boolean;
  canUseFullscreen: boolean;
  onLogout: () => void;
  onToggleFullscreen: () => void;
  onOpenGroups: () => void;
  onOpenStudentData: () => void;
  onOpenMap: () => void;
  onActivityLog?: (payload: ActivityLogPayload) => void;
};

type TeacherTaskControlPanel = "inquiry" | "map" | "cardPack" | "voting";
type BoardVoteViewMode = "live" | "history";

const VOTE_GROUPS = [
  { id: "public", name: "一般民眾" },
  { id: "developer", name: "建商/企業" },
  { id: "resident", name: "當地居民" },
  { id: "farmer", name: "農民" },
  { id: "authority", name: "地方主管機關" },
  { id: "media", name: "媒體" },
];


export function TeacherManagementCenter({
  token,
  currentUser,
  onLogout,
  onOpenGroups,
  onOpenStudentData,
  onOpenMap,
  onActivityLog,
}: TeacherManagementCenterProps) {
  const [isInquiryTaskOpen, setIsInquiryTaskOpen] = useState(true);
  const [isMapTaskOpen, setIsMapTaskOpen] = useState(false);
  const [isCardPackOpen, setIsCardPackOpen] = useState(false);
  const [isStudentScreenLocked, setIsStudentScreenLocked] = useState(false);
  const [votingStatus, setVotingStatus] = useState<SuspectVotingStatus>({
    isOpen: false,
    isFinalized: false,
    totals: {},
    totalVoters: 0,
    totalEligibleVoters: 0,
    myVotes: [],
  });
  const [isCardDecisionPanelOpen, setIsCardDecisionPanelOpen] = useState(false);
  const [isGroupScorePanelOpen, setIsGroupScorePanelOpen] = useState(false);
  const [isDecisionSettlementMenuOpen, setIsDecisionSettlementMenuOpen] = useState(false);
  const [activeTaskControlPanel, setActiveTaskControlPanel] =
    useState<TeacherTaskControlPanel | null>(null);
  const [boardVoteViewMode, setBoardVoteViewMode] = useState<BoardVoteViewMode>("live");
  const [selectedVoteHistoryRoundNo, setSelectedVoteHistoryRoundNo] = useState<number | null>(null);
  const [cardDecisionLocks, setCardDecisionLocks] = useState<GroupCardDecisionLockStatus[]>([]);
  const [decisionGameState, setDecisionGameState] = useState<DecisionCardGameState | null>(null);
  const [isLoadingCardDecisionLocks, setIsLoadingCardDecisionLocks] = useState(false);
  const [cardDecisionMessage, setCardDecisionMessage] = useState("");
  const [finalDecisionSettlement, setFinalDecisionSettlement] =
    useState<FinalDecisionSettlementStatus>({ isFinalized: false });
  const [isUpdatingTeacherControl, setIsUpdatingTeacherControl] =
    useState(false);
  const [showClearDatabaseModal, setShowClearDatabaseModal] = useState(false);
  const [clearDatabaseChecked, setClearDatabaseChecked] = useState(false);
  const [clearDatabaseInput, setClearDatabaseInput] = useState("");
  const [isClearingDatabase, setIsClearingDatabase] = useState(false);
  const [clearDatabaseMessage, setClearDatabaseMessage] = useState("");
  const [showVotingVisualizationModal, setShowVotingVisualizationModal] = useState(false);

  const applyVotingStatus = useCallback((data: VotingStatusApi) => {
    setVotingStatus({
      isOpen: Boolean(data.isOpen),
      isFinalized: Boolean(data.isFinalized),
      finalizedSuspects: Array.isArray(data.finalizedSuspects) ? data.finalizedSuspects : [],
      finalizedAt: data.finalizedAt || null,
      totals: data.totals || {},
      totalVoters: Number(data.totalVoters) || 0,
      totalEligibleVoters: Number(data.totalEligibleVoters) || 0,
      myVotes: Array.isArray(data.myVotes) ? data.myVotes : [],
    });
  }, []);

  const logActivity = useCallback(
    (payload: ActivityLogPayload) => {
      onActivityLog?.(payload);
    },
    [onActivityLog],
  );

  const loadTeacherControls = useCallback(async () => {
    if (!token) return;

    try {
      const {
        inquiryTask,
        mapTask,
        cardPack,
        voting,
        screenLock,
        finalDecision,
      } = await getTeacherControlStatuses(token);

      setIsInquiryTaskOpen(inquiryTask.isOpen !== false);
      setIsMapTaskOpen(Boolean(mapTask.isOpen));
      setIsCardPackOpen(Boolean(cardPack.isOpen));
      applyVotingStatus(voting);
      setIsStudentScreenLocked(Boolean(screenLock.isLocked));
      setFinalDecisionSettlement(finalDecision?.isFinalized ? finalDecision : { isFinalized: false });
    } catch (error) {
      console.error("讀取教師控制狀態失敗", error);
    }
  }, [applyVotingStatus, token]);

  useEffect(() => {
    if (!token) return;

    const initialLoadId = window.setTimeout(() => {
      void loadTeacherControls();
    }, 0);
    // 主要靠 SSE 即時同步；輪詢只保留低頻備援，避免按鈕點擊時背景重算。
    const timer = window.setInterval(loadTeacherControls, 20000);
    const handleFocus = () => void loadTeacherControls();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadTeacherControls, token]);

  useEffect(() => {
    if (!token) return;

    return subscribeRealtime(token, (event) => {
      const payload = (event.payload || {}) as Record<string, unknown> & {
        inquiryTaskOpen?: boolean;
        mapTaskOpen?: boolean;
        cardPackOpen?: boolean;
        studentScreenLocked?: boolean;
        suspectVoting?: Parameters<typeof applyVotingStatus>[0];
        finalDecisionSettlement?: FinalDecisionSettlementStatus;
        isOpen?: boolean;
        isLocked?: boolean;
        isFinalized?: boolean;
        groups?: GroupCardDecisionLockStatus[];
        proposals?: DecisionCardGameState["proposals"];
        votes?: DecisionCardGameState["votes"];
        acceptedCards?: DecisionCardGameState["acceptedCards"];
        roundNo?: number;
      };

      if (event.type === "teacher-controls") {
        if (typeof payload.inquiryTaskOpen === "boolean") setIsInquiryTaskOpen(payload.inquiryTaskOpen);
        if (typeof payload.mapTaskOpen === "boolean") setIsMapTaskOpen(payload.mapTaskOpen);
        if (typeof payload.cardPackOpen === "boolean") setIsCardPackOpen(payload.cardPackOpen);
        if (typeof payload.studentScreenLocked === "boolean") setIsStudentScreenLocked(payload.studentScreenLocked);
        if (payload.suspectVoting) applyVotingStatus(payload.suspectVoting);
        if (payload.finalDecisionSettlement) {
          setFinalDecisionSettlement(payload.finalDecisionSettlement);
        }
        return;
      }
      if (event.type === "inquiry-task-status") setIsInquiryTaskOpen(payload.isOpen !== false);
      if (event.type === "map-task-status") setIsMapTaskOpen(Boolean(payload.isOpen));
      if (event.type === "card-pack-status") setIsCardPackOpen(Boolean(payload.isOpen));
      if (event.type === "student-screen-lock") setIsStudentScreenLocked(Boolean(payload.isLocked));
      if (event.type === "suspect-voting-status") applyVotingStatus(payload);
      if (event.type === "final-decision-settlement") {
        setFinalDecisionSettlement(payload.isFinalized ? (payload as FinalDecisionSettlementStatus) : { isFinalized: false });
      }
      if (event.type === "database-data-cleared") {
        clearControlPageBrowserDrafts();
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
        setCardDecisionLocks([]);
        setFinalDecisionSettlement({ isFinalized: false });
        return;
      }
      if (event.type === "group-card-pack-lock" && Array.isArray(payload.groups)) {
        setCardDecisionLocks(payload.groups);
      }
      if (event.type === "decision-card-game") {
        setDecisionGameState((prev) => ({ ...(prev || { roundNo: 1, proposals: [], votes: [], myVotes: [], acceptedCards: [] }), ...payload } as DecisionCardGameState));
      }
    });
  }, [applyVotingStatus, token]);

  const loadCardDecisionLocks = useCallback(async () => {
    if (!token) return;
    setIsLoadingCardDecisionLocks(true);
    try {
      const [data, gameData] = await Promise.all([
        getTeacherGroupCardPackLocks(token),
        getDecisionCardGameState(token),
      ]);
      setCardDecisionLocks(Array.isArray(data.groups) ? data.groups : []);
      setDecisionGameState(gameData);
      setCardDecisionMessage("已更新卡牌決策鎖定與公告欄投票狀態");
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "讀取卡牌決策狀態失敗");
    } finally {
      setIsLoadingCardDecisionLocks(false);
    }
  }, [token]);

  const openCardDecisionUnlockPanel = useCallback(() => {
    setIsCardDecisionPanelOpen((open) => !open);
    setIsGroupScorePanelOpen(false);
    setIsDecisionSettlementMenuOpen(false);
    void loadCardDecisionLocks();
  }, [loadCardDecisionLocks]);

  const openGroupScorePanel = useCallback(() => {
    setIsGroupScorePanelOpen((open) => !open);
    setIsCardDecisionPanelOpen(false);
    setIsDecisionSettlementMenuOpen(false);
    void loadCardDecisionLocks();
  }, [loadCardDecisionLocks]);

  const openDecisionSettlementMenu = useCallback(() => {
    setIsDecisionSettlementMenuOpen((open) => !open);
    setIsCardDecisionPanelOpen(false);
    setIsGroupScorePanelOpen(false);
  }, []);

  const openTaskControlPanel = useCallback((panel: TeacherTaskControlPanel) => {
    setActiveTaskControlPanel((current) => (current === panel ? null : panel));
  }, []);

  async function unlockCardDecisionGroup(groupId: string) {
    if (!token) return;
    setIsLoadingCardDecisionLocks(true);
    try {
      const data = await unlockTeacherGroupCardPack(token, groupId);
      setCardDecisionMessage(data.message || "已解除小組卡牌決策鎖定");
      if (Array.isArray(data.groups)) setCardDecisionLocks(data.groups);
      void loadCardDecisionLocks();
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "解除小組卡牌決策鎖定失敗");
    } finally {
      setIsLoadingCardDecisionLocks(false);
    }
  }


  async function settleDecisionCardRound() {
    if (!token) return;
    if (!canSettleCurrentDecisionRound) {
      setCardDecisionMessage(`目前尚不能開始下一輪：${currentRoundProposalGroupCount}/${GROUP_ORDER.length} 局已送出提案，${completedDecisionVoteGroupIds.size}/${GROUP_ORDER.length} 局已完成投票。`);
      return;
    }
    setIsLoadingCardDecisionLocks(true);
    try {
      const data = await settleTeacherDecisionCardRound(token);
      setCardDecisionMessage(data.message || "本輪已結算，通過牌已進入決策區；拒絕與保留牌已回到各組手牌。");
      if (Array.isArray(data.groups)) setCardDecisionLocks(data.groups);
      setDecisionGameState((prev) => ({
        ...(prev || { roundNo: 1, proposals: [], votes: [], myVotes: [], acceptedCards: [] }),
        ...(data as Partial<DecisionCardGameState>),
      } as DecisionCardGameState));
      await loadCardDecisionLocks();
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "本輪決策卡結算失敗");
    } finally {
      setIsLoadingCardDecisionLocks(false);
    }
  }

  async function unlockAllCardDecisions() {
    if (!token) return;
    setIsLoadingCardDecisionLocks(true);
    try {
      const data = await unlockAllTeacherGroupCardPacks(token);
      setCardDecisionMessage(data.message || "已解除全部卡牌決策鎖定");
      if (Array.isArray(data.groups)) setCardDecisionLocks(data.groups);
      void loadCardDecisionLocks();
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "解除全部卡牌決策鎖定失敗");
    } finally {
      setIsLoadingCardDecisionLocks(false);
    }
  }

  useEffect(() => {
    if (!isCardDecisionPanelOpen) return;

    const initialLoadId = window.setTimeout(() => {
      void loadCardDecisionLocks();
    }, 0);
    // 解鎖/鎖定會由 SSE 立即推送，這裡只當斷線備援。
    const id = window.setInterval(() => void loadCardDecisionLocks(), 30000);
    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(id);
    };
  }, [isCardDecisionPanelOpen, loadCardDecisionLocks]);


  const decisionCardLookup = useMemo(() => {
    const map = new Map<string, { id: string; title: string; frontText: string; groupId: string }>();
    (["environment", "government", "farming", "animal", "greenEnergy", "education"] as const).forEach((groupId) => {
      buildPackCards(groupId).forEach((card) => map.set(card.id, { ...card, groupId }));
    });
    return map;
  }, []);

  const teacherBoardRows = useMemo(() => {
    const roundNo = decisionGameState?.roundNo || 1;
    const votes = decisionGameState?.votes || [];
    return (decisionGameState?.proposals || [])
      .filter((proposal) => (Number(proposal.roundNo) || 1) === roundNo)
      .flatMap((proposal) => (proposal.selectedCardIds || []).map((cardId) => {
        const cardVotes = votes.filter(
          (vote) => String(vote.cardId) === String(cardId) && (Number(vote.roundNo) || 1) === roundNo,
        );
        const agree = cardVotes.filter((vote) => vote.voteType === "agree").length;
        const reject = cardVotes.filter((vote) => vote.voteType === "reject").length;
        const keep = Math.max(0, GROUP_ORDER.length - 1 - agree - reject);
        let result = "目前保留";
        if (agree >= 3) result = "目前通過";
        else if (reject >= 3) result = "目前反對";
        return {
          key: `${proposal.groupId}-${cardId}`,
          roundNo,
          groupId: String(proposal.groupId || ""),
          cardId: String(cardId),
          card: decisionCardLookup.get(String(cardId)),
          agree,
          reject,
          keep,
          result,
          reason: proposal.reason || "",
        };
      }));
  }, [decisionCardLookup, decisionGameState]);

  const completedDecisionVoteGroupIds = useMemo(() => {
    const roundNo = decisionGameState?.roundNo || 1;
    const ids = new Set<string>();
    (decisionGameState?.voteSubmissions || []).forEach((submission) => {
      if ((Number(submission.roundNo) || 1) === roundNo) {
        ids.add(String(submission.voterGroupId));
      }
    });
    return ids;
  }, [decisionGameState?.roundNo, decisionGameState?.voteSubmissions, decisionGameState?.votes]);

  const decisionVotingGroupStatus = useMemo(() => {
    return GROUP_ORDER.map((groupId) => ({
      groupId,
      completed: completedDecisionVoteGroupIds.has(String(groupId)),
      meta: GROUP_PACK_META[resolveGroup(groupId)],
    }));
  }, [completedDecisionVoteGroupIds]);

  const currentRoundProposalGroupCount = useMemo(() => {
    const roundNo = decisionGameState?.roundNo || 1;
    const ids = new Set<string>();
    (decisionGameState?.proposals || []).forEach((proposal) => {
      if ((Number(proposal.roundNo) || 1) === roundNo && (proposal.selectedCardIds || []).length > 0) {
        ids.add(String(proposal.groupId));
      }
    });
    return ids.size;
  }, [decisionGameState?.proposals, decisionGameState?.roundNo]);

  const allCurrentRoundProposalsSubmitted = currentRoundProposalGroupCount >= GROUP_ORDER.length;
  const allCurrentRoundVotesSubmitted = completedDecisionVoteGroupIds.size >= GROUP_ORDER.length;
  const canSettleCurrentDecisionRound = allCurrentRoundProposalsSubmitted && allCurrentRoundVotesSubmitted;

  const decisionVoteHistoryByRound = useMemo(() => {
    const rows = [...(decisionGameState?.roundHistory || [])].sort((a, b) => {
      const roundDiff = (Number(b.roundNo) || 0) - (Number(a.roundNo) || 0);
      if (roundDiff !== 0) return roundDiff;
      return String(a.groupId || "").localeCompare(String(b.groupId || ""));
    });
    const map = new Map<number, typeof rows>();
    rows.forEach((row) => {
      const roundNo = Number(row.roundNo) || 1;
      const current = map.get(roundNo) || [];
      current.push(row);
      map.set(roundNo, current);
    });
    return Array.from(map.entries()).map(([roundNo, items]) => ({ roundNo, items }));
  }, [decisionGameState?.roundHistory]);

  const selectedVoteHistoryRound =
    decisionVoteHistoryByRound.find((round) => round.roundNo === selectedVoteHistoryRoundNo) ||
    decisionVoteHistoryByRound[0] ||
    null;

  useEffect(() => {
    if (!decisionVoteHistoryByRound.length) {
      if (selectedVoteHistoryRoundNo !== null) setSelectedVoteHistoryRoundNo(null);
      return;
    }
    if (!selectedVoteHistoryRoundNo || !decisionVoteHistoryByRound.some((round) => round.roundNo === selectedVoteHistoryRoundNo)) {
      setSelectedVoteHistoryRoundNo(decisionVoteHistoryByRound[0].roundNo);
    }
  }, [decisionVoteHistoryByRound, selectedVoteHistoryRoundNo]);

  const groupScoreRows = useMemo(() => {
    const scores = decisionGameState?.groupScores || [];
    return GROUP_ORDER.map((groupId) => {
      const meta = GROUP_PACK_META[resolveGroup(groupId)];
      const groupScores = scores
        .filter((score) => String(score.groupId) === String(groupId))
        .sort((a, b) => (Number(a.roundNo) || 0) - (Number(b.roundNo) || 0));
      const latest = groupScores[groupScores.length - 1];
      const acceptedCount = groupScores.reduce((sum, score) => sum + (Number(score.acceptedCount) || 0), 0);
      const rejectedCount = groupScores.reduce((sum, score) => sum + (Number(score.rejectedCount) || 0), 0);
      const coreBonus = groupScores.reduce((sum, score) => sum + (Number(score.coreBonus) || 0), 0);
      return {
        groupId,
        meta,
        rounds: groupScores,
        latestRound: Number(latest?.roundNo) || 0,
        acceptedCount,
        rejectedCount,
        coreBonus,
        cumulativeScore: Number(latest?.cumulativeScore) || 0,
        acceptedRoundText: groupScores
          .filter((score) => (Number(score.acceptedCount) || 0) > 0)
          .map((score) => `第${Number(score.roundNo) || 1}輪 ${Number(score.acceptedCount) || 0}張`)
          .join("、"),
        rejectedRoundText: groupScores
          .filter((score) => (Number(score.rejectedCount) || 0) > 0)
          .map((score) => `第${Number(score.roundNo) || 1}輪 ${Number(score.rejectedCount) || 0}張`)
          .join("、"),
      };
    });
  }, [decisionGameState?.groupScores]);

  const groupScoreScale = useMemo(() => {
    const scores = groupScoreRows.map((row) => Number(row.cumulativeScore) || 0);
    return {
      maxAbs: Math.max(1, ...scores.map((score) => Math.abs(score))),
    };
  }, [groupScoreRows]);

  function formatDecisionResultLabel(result?: string | null) {
    if (result === "accepted") return "通過";
    if (result === "rejected") return "反對";
    return "保留";
  }

  function getLiveResultSymbol(result?: string | null) {
    if (String(result || "").includes("通過") || result === "accepted") return "O";
    if (String(result || "").includes("反對") || result === "rejected") return "X";
    return "△";
  }

  function getLiveResultSymbolClass(result?: string | null) {
    if (String(result || "").includes("通過") || result === "accepted") return "border-emerald-300 bg-emerald-100 text-emerald-800 shadow-[0_0_22px_rgba(16,185,129,0.28)]";
    if (String(result || "").includes("反對") || result === "rejected") return "border-rose-300 bg-rose-100 text-rose-800 shadow-[0_0_22px_rgba(244,63,94,0.24)]";
    return "border-stone-300 bg-stone-100 text-stone-700 shadow-[0_0_18px_rgba(120,113,108,0.18)]";
  }

  function formatBoardCardTitle(title?: string | null, fallback?: string) {
    return (title || fallback || "").replace(/卡包/g, "").trim();
  }

  function formatGroupDisplayName(name?: string | null) {
    return (name || "").replace(/卡包/g, "").trim();
  }

  async function toggleStudentScreenLock() {
    if (!token || isUpdatingTeacherControl) return;

    const nextLocked = !isStudentScreenLocked;
    setIsStudentScreenLocked(nextLocked);
    setIsUpdatingTeacherControl(true);

    try {
      const data = await updateStudentScreenLock(token, nextLocked);

      setIsStudentScreenLocked(Boolean(data.isLocked));
      logActivity({
        eventType: "teacher_student_screen_lock_toggle",
        eventLabel: "教師切換學生畫面鎖定",
        targetType: "studentScreenLock",
        newValue: { isLocked: Boolean(data.isLocked) },
      });
    } catch (error) {
      setIsStudentScreenLocked(!nextLocked);
      console.error("更新學生畫面鎖定狀態發生錯誤：", error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function toggleInquiryTaskOpen() {
    if (!token || isUpdatingTeacherControl) return;

    const nextOpen = !isInquiryTaskOpen;
    setIsInquiryTaskOpen(nextOpen);
    setIsUpdatingTeacherControl(true);

    try {
      const data = await updateInquiryTaskStatus(token, nextOpen);

      setIsInquiryTaskOpen(data.isOpen !== false);
      logActivity({
        eventType: "teacher_inquiry_task_toggle",
        eventLabel: "教師切換任務一開關",
        targetType: "inquiryTask",
        newValue: { isOpen: data.isOpen !== false },
      });
    } catch (error) {
      setIsInquiryTaskOpen(!nextOpen);
      console.error("更新任務一狀態發生錯誤：", error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function toggleMapTaskOpen() {
    if (!token || isUpdatingTeacherControl) return;

    const nextOpen = !isMapTaskOpen;
    setIsMapTaskOpen(nextOpen);
    setIsUpdatingTeacherControl(true);

    try {
      const data = await updateMapTaskStatus(token, nextOpen);

      setIsMapTaskOpen(Boolean(data.isOpen));
      logActivity({
        eventType: "teacher_map_task_toggle",
        eventLabel: "教師切換地圖任務開關",
        targetType: "mapTask",
        newValue: { isOpen: nextOpen },
      });
    } catch (error) {
      setIsMapTaskOpen(!nextOpen);
      console.error("更新地圖任務狀態發生錯誤：", error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function toggleCardPackOpen() {
    if (!token || isUpdatingTeacherControl) return;

    const nextOpen = !isCardPackOpen;
    setIsCardPackOpen(nextOpen);
    setIsUpdatingTeacherControl(true);

    try {
      const data = await updateCardPackStatus(token, nextOpen);

      setIsCardPackOpen(Boolean(data.isOpen));
      logActivity({
        eventType: "teacher_card_pack_toggle",
        eventLabel: "教師切換抽卡開關",
        targetType: "cardPack",
        newValue: { isOpen: Boolean(data.isOpen) },
      });
    } catch (error) {
      setIsCardPackOpen(!nextOpen);
      console.error("更新抽卡狀態發生錯誤：", error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function toggleSuspectVotingOpen() {
    if (!token || isUpdatingTeacherControl) return;

    const nextOpen = !votingStatus.isOpen;
    setIsUpdatingTeacherControl(true);

    try {
      const data = await updateSuspectVotingStatus(token, nextOpen);

      applyVotingStatus(data);
      logActivity({
        eventType: "teacher_suspect_voting_toggle",
        eventLabel: "教師切換投票活動開關",
        targetType: "suspectVoting",
        newValue: { isOpen: nextOpen },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function finishSuspectVoting() {
    if (!token || isUpdatingTeacherControl) return;

    setIsUpdatingTeacherControl(true);

    try {
      const data = await finishSuspectVotingApi(token);

      applyVotingStatus(data);
      logActivity({
        eventType: "teacher_suspect_voting_finish",
        eventLabel: "教師結算投票活動",
        targetType: "suspectVoting",
        newValue: data,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function finalizeDecisionSettlement() {
    if (!token || isUpdatingTeacherControl) return;

    setIsUpdatingTeacherControl(true);
    setCardDecisionMessage("正在計算全班最後決策...");

    try {
      const data = await finalizeDecisionSettlementApi(token);

      setFinalDecisionSettlement(data);
      setCardDecisionMessage(typeof data.message === "string" && data.message ? data.message : `遊戲結束結算完成：${data?.outcome?.title || "已公布結局"}`);
      logActivity({
        eventType: "teacher_final_decision_settlement",
        eventLabel: "教師進行遊戲結束結算",
        targetType: "finalDecisionSettlement",
        newValue: data,
      });
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "遊戲結束結算失敗");
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  async function closeDecisionSettlement() {
    if (!token || isUpdatingTeacherControl) return;

    const confirmed = window.confirm(
      "確定要關閉遊戲結束嗎？關閉後，新的學生登入不會再被導向結局頁，已在結局頁的學生也會回到首頁流程。",
    );
    if (!confirmed) return;

    setIsUpdatingTeacherControl(true);
    setCardDecisionMessage("正在關閉遊戲結束...");

    try {
      const data = await closeDecisionSettlementApi(token);

      setFinalDecisionSettlement({ isFinalized: false });
      setCardDecisionMessage(typeof data.message === "string" && data.message ? data.message : "已關閉遊戲結束，學生端可回到遊戲流程。");
      logActivity({
        eventType: "teacher_close_final_decision_settlement",
        eventLabel: "教師關閉遊戲結束",
        targetType: "finalDecisionSettlement",
        newValue: data,
      });
    } catch (error) {
      setCardDecisionMessage(error instanceof Error ? error.message : "關閉遊戲結束結算失敗");
    } finally {
      setIsUpdatingTeacherControl(false);
    }
  }

  function openClearDatabaseModal() {
    setClearDatabaseChecked(false);
    setClearDatabaseInput("");
    setClearDatabaseMessage("");
    setShowClearDatabaseModal(true);
  }

  async function clearDatabaseTables() {
    if (!token || isClearingDatabase) return;
    if (
      !clearDatabaseChecked ||
      clearDatabaseInput !== CLEAR_DATABASE_CONFIRM_TEXT
    ) {
      setClearDatabaseMessage("請先勾選確認送出，並輸入「清空資料表」。");
      return;
    }

    setIsClearingDatabase(true);
    setClearDatabaseMessage("正在清空資料表...");

    try {
      const data = await clearTeacherDatabaseData(token, clearDatabaseInput);

      clearControlPageBrowserDrafts();
      setShowClearDatabaseModal(false);
      setClearDatabaseMessage(data.message || "資料表已清空");
      window.location.reload();
    } catch (error) {
      console.error(error);
      setClearDatabaseMessage(
        error instanceof Error ? error.message : "清空資料表失敗",
      );
    } finally {
      setIsClearingDatabase(false);
    }
  }

  return (
    <div className="game-adventure-page uiux-page-shell relative min-h-[100svh] overflow-x-hidden p-3 text-stone-800 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.22),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.06)_0_1px,transparent_1px_32px)]" />
        <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-stone-300/20 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c1ad]/25 blur-[110px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="game-stage-card mb-6 overflow-hidden rounded-[32px] p-4 backdrop-blur-xl sm:rounded-[38px] sm:p-7">
          <div className="grid gap-6 min-[700px]:grid-cols-[1fr_auto] min-[700px]:items-center">
            <div>
              <p className="text-sm font-black tracking-[0.22em] text-stone-500">
                TEACHER CONTROL PANEL
              </p>
              <h1 className="mt-2 break-words font-serif text-4xl font-semibold tracking-[0.10em] text-stone-800 sm:text-5xl sm:tracking-[0.16em] md:text-7xl">
                教師管理中心
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-stone-600">
                這裡集中教師需要的控制功能：公告欄投票閱覽、小組分數、遊戲結束、資料分析、小組管理與資料表清理。
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-4 lg:items-end">
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[520px] lg:grid-cols-2">
                <div className="flex min-h-[48px] items-center justify-center rounded-xl border border-stone-200 bg-white/70 px-3 py-2 text-center text-sm font-bold text-stone-600 shadow-sm">
                  {currentUser?.username} 已登入
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className={`${GAME_BTN} ${GAME_BTN_BLUE} justify-center text-center`} 
                >
                  登出
                </button>
                <button
                  type="button"
                  onClick={toggleStudentScreenLock}
                  disabled={isUpdatingTeacherControl}
                  className={`${GAME_BTN} justify-center text-center ${
                    isStudentScreenLocked
                      ? "border-[#8a3f2d] bg-[#fff2e8] text-[#8a3f2d] hover:border-[#6f2f21] hover:bg-[#ffe6d7]"
                      : "border-[#627256] bg-[#f1f7ed] text-[#4d6244] hover:border-[#465a3e] hover:bg-[#e5f0df]"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isStudentScreenLocked ? "解鎖學生畫面" : "鎖定學生畫面"}
                </button>
                <button
                  type="button"
                  onClick={openClearDatabaseModal}
                  disabled={isClearingDatabase}
                  className={`${GAME_BTN} justify-center border-[#9f2f2f] bg-[#fff1f1] text-[#8a2020] hover:border-[#7f1d1d] hover:bg-[#ffe1e1] disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  清空資料表
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 space-y-4">
          <div className="rounded-[28px] border border-[#d8d0c2] bg-white/78 p-4 shadow-[0_16px_34px_rgba(68,64,60,0.08)]">
            <SectionLabel eyebrow="GAME FLOW" title="遊戲流程" tone="warm" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TeacherQuickLinkButton
                icon="🔎"
                title="任務一：探究調查"
                description={isInquiryTaskOpen ? "學生端開放中" : "學生端已鎖定"}
                onClick={() => openTaskControlPanel("inquiry")}
                theme="green"
              />
              <TeacherQuickLinkButton
                icon="🗺️"
                title="任務二：繪製地圖"
                description={isMapTaskOpen ? "學生端開放中" : "學生端已鎖定"}
                onClick={() => openTaskControlPanel("map")}
                theme="blue"
              />
              <TeacherQuickLinkButton
                icon="🎴"
                title="任務三：角色卡包"
                description={isCardPackOpen ? "抽卡按鈕顯示中" : "抽卡按鈕已隱藏"}
                onClick={() => openTaskControlPanel("cardPack")}
                theme="amber"
              />
              <TeacherQuickLinkButton
                icon="🕵️"
                title="尋找兇手"
                description={votingStatus.isOpen ? "投票中" : votingStatus.isFinalized ? "已結算" : "尚未開啟"}
                onClick={() => openTaskControlPanel("voting")}
                theme="rose"
              />
              <TeacherQuickLinkButton
                icon="🗳️"
                title="公告欄投票閱覽"
                description="查看即時投票與歷史紀錄"
                onClick={openCardDecisionUnlockPanel}
                theme="blue"
              />
              <TeacherQuickLinkButton
                icon="🏆"
                title="小組分數"
                description="查看各局目前得分"
                onClick={openGroupScorePanel}
                theme="amber"
              />
              <TeacherQuickLinkButton
                icon="🏁"
                title="遊戲結束"
                description={finalDecisionSettlement.isFinalized ? `${finalDecisionSettlement.outcome?.title || "已公布結局"}` : "開啟結算操作選單"}
                onClick={openDecisionSettlementMenu}
                theme="rose"
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-[#cbd5e1] bg-white/78 p-4 shadow-[0_16px_34px_rgba(51,65,85,0.07)]">
            <SectionLabel eyebrow="MANAGEMENT TOOLS" title="功能管理" tone="cool" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <TeacherQuickLinkButton
                icon="📋"
                title="資料分析"
                description="行為統計與圖表"
                onClick={onOpenStudentData}
                theme="green"
              />
              <TeacherQuickLinkButton
                icon="👥"
                title="小組管理"
                description="分組與組長"
                onClick={onOpenGroups}
                theme="violet"
              />
            </div>
          </div>
        </section>

        {isDecisionSettlementMenuOpen ? (
          <section className="mb-6 overflow-hidden rounded-[32px] border border-[#d9b56b] bg-[#fff7df]/95 p-4 shadow-[0_18px_38px_rgba(122,75,18,0.16)] sm:p-6">
            <div className="flex flex-col gap-4 min-[700px]:flex-row min-[700px]:items-start min-[700px]:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-[#9b6b18]">FINAL SETTLEMENT MENU</p>
                <h2 className="mt-2 text-2xl font-black text-stone-900">遊戲結束操作</h2>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-stone-700">
                  這裡才是會觸發學生端結局畫面的操作區。請確認決策區通過牌與分數後，再公布全班最終結局。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void finalizeDecisionSettlement()}
                  disabled={isUpdatingTeacherControl}
                  className={`${GAME_BTN} ${GAME_BTN_AMBER} justify-center disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  公布遊戲結束
                </button>
                <button
                  type="button"
                  onClick={() => void closeDecisionSettlement()}
                  disabled={isUpdatingTeacherControl || !finalDecisionSettlement.isFinalized}
                  className={`${GAME_BTN} border-[#9f2f2f] bg-[#fff1f1] text-[#8a2020] hover:border-[#7f1d1d] hover:bg-[#ffe1e1] disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  關閉遊戲結束
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {finalDecisionSettlement.isFinalized ? (
          <section className="mb-6 overflow-hidden rounded-[28px] border border-[#d9b56b] bg-[#fff7df] p-4 shadow-[0_16px_34px_rgba(122,75,18,0.12)] sm:p-5">
            <div className="flex flex-col gap-4 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-[#9b6b18]">FINAL SETTLEMENT ACTIVE</p>
                <h2 className="mt-1 text-xl font-black text-stone-900">遊戲結束目前已開啟</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-stone-700">
                  學生登入或重新整理時會被導向遊戲結局。新一輪遊戲開始前，請先關閉遊戲結束，避免新使用者卡在結局畫面。
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                <button
                  type="button"
                  onClick={() => void closeDecisionSettlement()}
                  disabled={isUpdatingTeacherControl}
                  className={`${GAME_BTN} justify-center border-[#9f2f2f] bg-[#fff1f1] text-[#8a2020] hover:border-[#7f1d1d] hover:bg-[#ffe1e1] disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  關閉遊戲結束
                </button>
                <button
                  type="button"
                  onClick={() => void finalizeDecisionSettlement()}
                  disabled={isUpdatingTeacherControl}
                  className={`${GAME_BTN} ${GAME_BTN_AMBER} justify-center disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  重新公布一次
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {isGroupScorePanelOpen ? (
          <section className="mb-6 overflow-hidden rounded-[32px] border border-[#d9b56b] bg-[#fff7df]/95 p-4 shadow-[0_16px_34px_rgba(122,75,18,0.12)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-[#9b6b18]">GROUP SCORES</p>
                <h2 className="mt-2 text-2xl font-black text-stone-900">學生小組分數</h2>
                <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-stone-700">
                  這裡只顯示角色卡包回合結算後的小組得分。分數來源為已通過並進入決策區的牌；沒有通過的牌不會算入小組分。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadCardDecisionLocks()}
                  disabled={isLoadingCardDecisionLocks}
                  className={`${GAME_BTN} ${GAME_BTN_BLUE} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  重新整理分數
                </button>

              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupScoreRows.map((row) => (
                <div key={row.groupId} className={`rounded-3xl bg-gradient-to-r ${row.meta.cardFace} p-4 shadow-sm`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-black tracking-[0.16em] ${row.meta.cardMutedText}`}>{formatGroupDisplayName(row.meta.title)}</p>
                      <h3 className={`mt-1 text-3xl font-black ${row.meta.cardText}`}>{row.cumulativeScore} 分</h3>
                    </div>
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-stone-700">
                      已結算 {row.rounds.length} 輪
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm font-black text-stone-700">
                    <div className="rounded-2xl bg-white/65 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-stone-500">通過牌</span>
                        <span className="text-lg text-stone-900">{row.acceptedCount} 張</span>
                      </div>
                      <p className="mt-1 text-xs font-bold leading-5 text-stone-600">
                        {row.acceptedRoundText || "尚未有通過牌"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/65 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-stone-500">核心加分</span>
                        <span className="text-lg text-stone-900">{row.coreBonus} 分</span>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/65 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-stone-500">被拒絕牌</span>
                        <span className="text-lg text-stone-900">{row.rejectedCount} 張</span>
                      </div>
                      <p className="mt-1 text-xs font-bold leading-5 text-stone-600">
                        {row.rejectedRoundText || "尚未有被拒絕牌"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-[#e5d0a1] bg-white/90 p-4 text-stone-900 shadow-sm sm:p-5">
              <div>
                <div>
                  <p className="text-xs font-black tracking-[0.22em] text-[#9b6b18]">SCORE RANKING</p>
                  <h3 className="mt-1 text-xl font-black tracking-wide text-stone-900">所有局分數現況</h3>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-stone-200 bg-stone-50/80 px-3 py-4">
                <div className="space-y-3">
                {[...groupScoreRows]
                  .sort((a, b) => (Number(b.cumulativeScore) || 0) - (Number(a.cumulativeScore) || 0))
                  .map((row) => {
                  const score = Number(row.cumulativeScore) || 0;
                  const markerLeft = `${Math.min(96, Math.max(4, 50 + (score / groupScoreScale.maxAbs) * 46))}%`;
                  return (
                    <div
                      key={`score-chart-${row.groupId}`}
                      className={`grid gap-2 rounded-2xl border border-white/70 bg-gradient-to-r ${row.meta.cardFace} px-3 py-3 shadow-sm sm:grid-cols-[7.5rem_1fr_4rem] sm:items-center`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className={`truncate text-sm font-black ${row.meta.cardText}`}>{formatGroupDisplayName(row.meta.title)}</p>
                      </div>

                      <div className="relative h-14 rounded-full border border-stone-200 bg-stone-100 shadow-inner">
                        <div className="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-stone-300" />
                        <div className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-stone-400/60" />
                        <div
                          className="absolute top-2 h-10 w-10 -translate-x-1/2 rounded-full border-2 border-white bg-gradient-to-br shadow-md"
                          style={{ left: markerLeft }}
                        >
                          <span className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${row.meta.cardFace} text-sm font-black ${row.meta.cardText}`}>
                            {score}
                          </span>
                        </div>
                      </div>

                      <div className={`text-right text-lg font-black ${row.meta.cardText}`}>
                        {score} 分
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isCardDecisionPanelOpen ? (
          <section className="game-stage-card mb-6 overflow-hidden rounded-[32px] p-4 backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-4 min-[700px]:flex-row min-[700px]:items-start min-[700px]:justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-stone-500">LIVE VOTE BOARD</p>
                <h2 className="mt-2 text-2xl font-black text-stone-800">公告欄投票閱覽</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-stone-600">
                  這裡會顯示公告欄投票實況、各局完成投票狀態，以及每一輪的投票成果歷史紀錄。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadCardDecisionLocks()}
                  disabled={isLoadingCardDecisionLocks}
                  className={`${GAME_BTN} ${GAME_BTN_BLUE} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  重新整理一下狀態
                </button>
                <button
                  type="button"
                  onClick={() => void settleDecisionCardRound()}
                  disabled={isLoadingCardDecisionLocks || !canSettleCurrentDecisionRound}
                  className={`${GAME_BTN} ${GAME_BTN_AMBER} disabled:cursor-not-allowed disabled:opacity-50`}
                  title={canSettleCurrentDecisionRound ? "結算本輪並開始下一輪" : `等待提案 ${currentRoundProposalGroupCount}/${GROUP_ORDER.length}、投票 ${completedDecisionVoteGroupIds.size}/${GROUP_ORDER.length}`}
                >
                  {canSettleCurrentDecisionRound ? "開始下一輪選擇" : `等待完成 ${completedDecisionVoteGroupIds.size}/${GROUP_ORDER.length}`}
                </button>

                {false ? (
                  <button
                    type="button"
                    onClick={() => void unlockAllCardDecisions()}
                    disabled={isLoadingCardDecisionLocks}
                    className={`${GAME_BTN} border-[#9f2f2f] bg-[#fff1f1] text-[#8a2020] hover:border-[#7f1d1d] hover:bg-[#ffe1e1] disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    全部解鎖
                  </button>
                ) : null}

              </div>
            </div>

            {cardDecisionMessage ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-700">
                {cardDecisionMessage}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 rounded-[22px] border border-[#d8c79f] bg-white/78 p-3 text-sm font-black text-[#5f4a2f] sm:grid-cols-2">
              <div>提案進度：{currentRoundProposalGroupCount}/{GROUP_ORDER.length} 局已送出</div>
              <div>投票進度：{completedDecisionVoteGroupIds.size}/{GROUP_ORDER.length} 局已完成</div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBoardVoteViewMode("live")}
                className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                  boardVoteViewMode === "live"
                    ? "border-[#6f5a35] bg-[#2f251c] text-white"
                    : "border-[#d8c79f] bg-white/80 text-[#5f4a2f] hover:bg-white"
                }`}
              >
                實況轉播
              </button>
              <button
                type="button"
                onClick={() => setBoardVoteViewMode("history")}
                className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
                  boardVoteViewMode === "history"
                    ? "border-[#6f5a35] bg-[#2f251c] text-white"
                    : "border-[#d8c79f] bg-white/80 text-[#5f4a2f] hover:bg-white"
                }`}
              >
                成果紀錄
              </button>
            </div>

            {boardVoteViewMode === "live" ? (
            <div className="mx-auto mt-4 w-full max-w-5xl rounded-[32px] border border-stone-200 bg-[#fffaf0]/95 p-4 text-[#2f251c] shadow-sm sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.22em] text-[#846b31]">LIVE VOTE BOARD</p>
                  <h3 className="mt-1 text-xl font-black text-stone-900">公告欄票數實況</h3>
                  <p className="mt-2 text-xs font-bold leading-6 text-[#6b5a44]">這裡會顯示每一張公告牌目前的 O／X／△ 票數，以及各局是否已完成投票。</p>
                </div>
                <span className="rounded-full border border-[#d8c79f] bg-white px-3 py-1 text-xs font-black text-[#6b5a44]">
                  第 {decisionGameState?.roundNo || 1} 輪｜{teacherBoardRows.length} 張公告牌
                </span>
              </div>

              <div className="mt-4 rounded-3xl border border-[#d8c79f] bg-white/90 p-3">
                <p className="text-sm font-black text-[#2f251c]">各局投票完成狀態</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {decisionVotingGroupStatus.map((item) => (
                    <div key={item.groupId} className={`flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-gradient-to-br ${item.meta.cardFace} px-3 py-2 shadow-sm ${item.completed ? "opacity-100" : "opacity-70"}`}>
                      <span className={`text-xs font-black ${item.meta.cardText}`}>{formatBoardCardTitle(item.meta.title)}</span>
                      <span className={`text-xs font-black ${item.meta.cardText}`}>{item.completed ? "已完成投票" : "未完成投票"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-[#d8c79f] bg-white/90 p-3">
                {teacherBoardRows.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {teacherBoardRows.map((row) => {
                      const groupMeta = GROUP_PACK_META[resolveGroup(row.groupId)];
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
                                  <p className="text-[10px] font-black text-emerald-700">O 同意</p>
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

            {boardVoteViewMode === "history" ? (
            <div className="mx-auto mt-4 w-full max-w-6xl rounded-[32px] border border-stone-200 bg-[#fffaf0]/95 p-4 text-[#2f251c] shadow-sm sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.22em] text-[#846b31]">VOTE HISTORY</p>
                  <h3 className="mt-1 text-xl font-black text-stone-900">每輪投票成果紀錄</h3>
                  <p className="mt-2 text-xs font-bold leading-6 text-[#6b5a44]">選擇輪次後查看該輪公告牌的 O／X／△ 票數與最後結果。</p>
                </div>
                <span className="rounded-full border border-[#d8c79f] bg-white px-3 py-1 text-xs font-black text-[#6b5a44]">
                  已結算 {decisionVoteHistoryByRound.length} 輪
                </span>
              </div>

              {decisionVoteHistoryByRound.length ? (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {decisionVoteHistoryByRound.map((round) => (
                      <button
                        key={`round-tab-${round.roundNo}`}
                        type="button"
                        onClick={() => setSelectedVoteHistoryRoundNo(round.roundNo)}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          selectedVoteHistoryRound?.roundNo === round.roundNo
                            ? "border-[#6f5a35] bg-[#2f251c] text-white"
                            : "border-[#d8c79f] bg-white/80 text-[#5f4a2f] hover:bg-white"
                        }`}
                      >
                        第 {round.roundNo} 輪
                      </button>
                    ))}
                  </div>

                  {selectedVoteHistoryRound ? (
                    <div className="mt-4 rounded-3xl border border-[#d8c79f] bg-white/90 p-3">
                      <h4 className="text-sm font-black text-[#2f251c]">第 {selectedVoteHistoryRound.roundNo} 輪投票成果</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedVoteHistoryRound.items.map((item) => {
                          const groupMeta = GROUP_PACK_META[resolveGroup(item.groupId)];
                          const card = decisionCardLookup.get(String(item.cardId));
                          const boardTitle = formatBoardCardTitle(card?.title, item.cardId);
                          const agree = Number(item.agreeCount) || 0;
                          const reject = Number(item.rejectCount) || 0;
                          const keep = Number(item.keepCount) || 0;
                          const resultLabel = formatDecisionResultLabel(item.result);
                          return (
                            <article key={`${selectedVoteHistoryRound.roundNo}-${item.groupId}-${item.cardId}`} className={`min-h-[190px] rounded-[24px] border border-white/60 bg-gradient-to-br ${groupMeta.cardFace} p-3 shadow-sm`}>
                              <div className="flex h-full flex-col justify-between gap-3">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className={`text-xs font-black tracking-[0.14em] ${groupMeta.cardMutedText}`}>{boardTitle}</p>
                                      <p className={`mt-2 line-clamp-3 text-base font-black leading-6 ${groupMeta.cardText}`}>{card?.frontText || item.cardId}</p>
                                    </div>
                                    <span className={`shrink-0 rounded-[18px] border-2 px-3 py-2 text-center ${getLiveResultSymbolClass(item.result)}`}>
                                      <span className="block text-3xl font-black leading-none">{getLiveResultSymbol(item.result)}</span>
                                      <span className="mt-0.5 block text-[10px] font-black">{resultLabel}</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="grid min-h-[2.25rem] grid-cols-5 gap-1.5 rounded-2xl border border-white/70 bg-white/72 p-2 shadow-inner">
                                    {Array.from({ length: agree }).map((_, index) => <span key={`o-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 shadow-sm">O</span>)}
                                    {Array.from({ length: reject }).map((_, index) => <span key={`x-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs font-black text-rose-700 shadow-sm">X</span>)}
                                    {Array.from({ length: keep }).map((_, index) => <span key={`k-${index}`} className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-xs font-black text-stone-600 shadow-sm">△</span>)}
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center">
                                      <p className="text-[10px] font-black text-emerald-700">O 同意</p>
                                      <p className="mt-0.5 text-xl font-black text-emerald-700">{agree}</p>
                                    </div>
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-2 py-1.5 text-center">
                                      <p className="text-[10px] font-black text-rose-700">X 反對</p>
                                      <p className="mt-0.5 text-xl font-black text-rose-700">{reject}</p>
                                    </div>
                                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-2 py-1.5 text-center">
                                      <p className="text-[10px] font-black text-stone-600">△ 保留</p>
                                      <p className="mt-0.5 text-xl font-black text-stone-600">{keep}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-3xl border border-dashed border-[#d8c79f] bg-white/70 px-4 py-6 text-center text-sm font-black text-stone-500">
                  尚未結算任何輪次，等教師按下「開始下一輪選擇」後會出現歷史紀錄。
                </div>
              )}
            </div>
            ) : null}

            {false ? (
              <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {cardDecisionLocks.map((item) => (
                <div key={item.groupId} className="rounded-3xl border border-stone-200 bg-white/86 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-stone-800">{item.groupName}</h3>
                      <p className="mt-1 text-xs font-bold tracking-[0.12em] text-stone-500">
                        {item.isLocked ? "已鎖定" : "未鎖定"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${item.isLocked ? "bg-[#fff1d8] text-[#7a4b12]" : "bg-[#edf7ee] text-[#385b3d]"}`}>
                      {item.isLocked ? "LOCKED" : "OPEN"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm font-semibold text-stone-600">
                    <p>選取卡牌：{item.selectedCardIds?.length ? item.selectedCardIds.join("、") : "尚未鎖定"}</p>
                    <p>鎖定時間：{item.lockedAt ? new Date(item.lockedAt).toLocaleString("zh-TW") : "—"}</p>
                    {item.reason ? <p className="line-clamp-2">理由：{item.reason}</p> : null}
                  </div>
                  {false ? (
                    <button
                      type="button"
                      onClick={() => void unlockCardDecisionGroup(item.groupId)}
                      disabled={!item.isLocked || isLoadingCardDecisionLocks}
                      className={`${GAME_BTN} mt-4 w-full justify-center border-[#9f2f2f] bg-[#fff1f1] text-[#8a2020] hover:border-[#7f1d1d] hover:bg-[#ffe1e1] disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      解除此組鎖定
                    </button>
                  ) : null}
                </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTaskControlPanel ? (
          <section className="mb-6">
            {activeTaskControlPanel === "inquiry" ? (
              <TaskControlCard
                eyebrow="TASK 01"
                title="任務一：探究調查"
                description="控制學生端調查書任務開啟或關閉"
                isOpen={isInquiryTaskOpen}
                openText="關閉探究任務"
                closedText="開啟探究任務"
                onToggle={toggleInquiryTaskOpen}
                disabled={isUpdatingTeacherControl}
                previewType="inquiry"
              />
            ) : null}
            {activeTaskControlPanel === "map" ? (
              <TaskControlCard
                eyebrow="TASK 02"
                title="任務二：繪製地圖"
                description="控制學生端地圖任務開啟，並檢視全班地圖"
                isOpen={isMapTaskOpen}
                openText="關閉繪製地圖任務"
                closedText="開啟繪製地圖任務"
                onToggle={toggleMapTaskOpen}
                disabled={isUpdatingTeacherControl}
                secondaryText="前往地圖檢視"
                onSecondaryClick={onOpenMap}
                previewType="map"
              />
            ) : null}
            {activeTaskControlPanel === "cardPack" ? (
              <TaskControlCard
                eyebrow="CARD PACK"
                title="任務三：角色卡包"
                description="控制學生端的「角色卡包」按鈕是否出現"
                isOpen={isCardPackOpen}
                openText="關閉抽卡"
                closedText="開始抽卡"
                onToggle={toggleCardPackOpen}
                disabled={isUpdatingTeacherControl}
                previewType="cardPack"
              />
            ) : null}
            {activeTaskControlPanel === "voting" ? (
              <VotingControlCard
                votingStatus={votingStatus}
                disabled={isUpdatingTeacherControl}
                onOpenVisualization={() => setShowVotingVisualizationModal(true)}
                onToggle={toggleSuspectVotingOpen}
                onFinish={finishSuspectVoting}
              />
            ) : null}
          </section>
        ) : null}

      </div>

      {showVotingVisualizationModal ? (
        <VotingVisualizationModal
          votingStatus={votingStatus}
          onClose={() => setShowVotingVisualizationModal(false)}
        />
      ) : null}

      {showClearDatabaseModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border-4 border-red-900 bg-[#fffaf0] p-6 text-stone-800 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
            <p className="text-xs font-black tracking-[0.26em] text-red-700">
              DANGER ZONE
            </p>
            <h2 className="mt-2 text-2xl font-black">清空資料表</h2>
            <p className="mt-3 text-sm font-bold leading-7 text-stone-600">
              這個操作會清空學生遊戲歷程、探究紀錄、稱號、卡片、地圖紀錄、彈幕與
              coin。`users` 和 `game_settings` 會保留。
            </p>

            <div className="mt-5 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
              <label className="flex items-start gap-3 text-sm font-black text-red-800">
                <input
                  type="checkbox"
                  checked={clearDatabaseChecked}
                  onChange={(event) =>
                    setClearDatabaseChecked(event.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />
                我了解這會永久刪除除了 users 與 game_settings 以外的資料表內容
              </label>
            </div>

            <label className="mt-5 block text-sm font-black text-stone-700">
              請輸入「{CLEAR_DATABASE_CONFIRM_TEXT}」以確認送出
              <input
                value={clearDatabaseInput}
                onChange={(event) => setClearDatabaseInput(event.target.value)}
                className="mt-2 w-full rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 font-black outline-none focus:border-red-700"
                placeholder={CLEAR_DATABASE_CONFIRM_TEXT}
              />
            </label>

            {clearDatabaseMessage ? (
              <p className="mt-3 text-sm font-black text-red-700">
                {clearDatabaseMessage}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearDatabaseModal(false)}
                disabled={isClearingDatabase}
                className="rounded-2xl border-2 border-stone-300 bg-white px-5 py-3 font-black text-stone-700 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={clearDatabaseTables}
                disabled={
                  isClearingDatabase ||
                  !clearDatabaseChecked ||
                  clearDatabaseInput !== CLEAR_DATABASE_CONFIRM_TEXT
                }
                className="rounded-2xl border-2 border-red-900 bg-red-700 px-5 py-3 font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isClearingDatabase ? "清空中..." : "永久清空資料表"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskControlCard({
  eyebrow,
  title,
  description,
  isOpen,
  openText,
  closedText,
  onToggle,
  disabled,
  secondaryText,
  onSecondaryClick,
  previewType,
}: {
  eyebrow: string;
  title: string;
  description: string;
  isOpen: boolean;
  openText: string;
  closedText: string;
  onToggle: () => void;
  disabled: boolean;
  secondaryText?: string;
  onSecondaryClick?: () => void;
  previewType?: "inquiry" | "map" | "cardPack";
}) {
  return (
    <div className="flex h-full min-w-0 flex-col rounded-[28px] border border-[#d7c8ad] bg-[#fffaf0]/88 p-5 shadow-[0_18px_48px_rgba(45,41,34,0.10)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black tracking-[0.24em] text-[#84745c]">
            {eyebrow}
          </p>
          <h2 className="mt-2 break-words text-xl font-black text-stone-800">
            {title}
          </h2>
        </div>
        {previewType ? (
          <StatusPill
            isOpen={isOpen}
            openText="學生端開放"
            closedText="學生端鎖定"
          />
        ) : null}
      </div>
      <p className="mt-2 min-h-[20px] text-sm font-semibold leading-6 text-stone-600">
        {description}
      </p>

      <div className="flex-1">
      {previewType ? (
        <StudentTaskScreenPreview type={previewType} isOpen={isOpen} />
      ) : null}
      </div>

      <div
        className={`mt-5 grid gap-2 ${secondaryText ? "sm:grid-cols-2" : ""}`}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`${GAME_BTN} w-full ${
            isOpen
              ? "border-[#d7b8b1] bg-[#fbefed] text-[#8b4a43] hover:border-[#c98f85] hover:bg-[#f7e5e1]"
              : "border-[#a9b39a] bg-[#f4f7ef] text-[#46513e] hover:border-[#7d8b6f] hover:bg-[#edf3e6]"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isOpen ? openText : closedText}
        </button>

        {secondaryText && onSecondaryClick ? (
          <button
            type="button"
            onClick={onSecondaryClick}
            className={`${GAME_BTN} w-full border-[#bfa067] bg-[#fff7df] text-[#6d4e1f] hover:border-[#9f7a33] hover:bg-[#fff0bd]`}
          >
            {secondaryText}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({
  isOpen,
  openText,
  closedText,
}: {
  isOpen: boolean;
  openText: string;
  closedText: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
    >
      {isOpen ? openText : closedText}
    </span>
  );
}

function StudentTaskScreenPreview({
  type,
  isOpen,
}: {
  type: "inquiry" | "map" | "cardPack";
  isOpen: boolean;
}) {
  return (
    <div className="mt-4 min-h-[360px] overflow-hidden rounded-[22px] border-2 border-stone-300 bg-[#ede4d2] p-2 shadow-inner">
      <div className="rounded-[18px] border border-stone-200 bg-[#f8f3e8] p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black tracking-[0.16em] text-stone-500">
            學生端同步畫面
          </span>
        </div>

        {type === "inquiry" ? (
          <InquiryCreateButtonPreview isOpen={isOpen} />
        ) : type === "cardPack" ? (
          <CardPackButtonPreview isOpen={isOpen} />
        ) : (
          <CompactStudentMapPreview isOpen={isOpen} />
        )}
      </div>
    </div>
  );
}

function InquiryCreateButtonPreview({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d7c8ad] bg-[#fffaf0] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_24px]" />
      <div className="pointer-events-none absolute right-4 top-4 rotate-[-10deg] rounded-md border-2 border-[#9b2f2f]/25 px-3 py-1.5 text-[10px] font-black tracking-[0.22em] text-[#9b2f2f]/25">
        NEW CASE
      </div>

      <div className="relative flex min-h-[210px] flex-col items-center justify-center">
        <button
          type="button"
          disabled={!isOpen}
          aria-label={
            isOpen ? "建立新的探究探究調查書" : "建立新的探究探究調查書已鎖定"
          }
          className={`relative mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#b8a37d] bg-gradient-to-br from-[#fff8e8] to-[#e9dcc1] text-6xl font-semibold leading-none text-[#4f4333] shadow-[0_14px_30px_rgba(72,56,34,0.18)] transition ${
            isOpen
              ? "hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(72,56,34,0.22)] active:translate-y-0"
              : "cursor-not-allowed grayscale opacity-45"
          }`}
        >
          +
          {!isOpen ? (
            <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-red-700 text-base text-white shadow-lg">
              🔒
            </span>
          ) : null}
        </button>
        <p className="relative text-center font-serif text-xl font-semibold tracking-[0.08em] text-[#332c24] sm:text-2xl">
          建立新的探究探究調查書
        </p>
        <p
          className={`relative mt-2 rounded-full px-3 py-1 text-xs font-black ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
        >
          {isOpen ? "學生端＋號可點擊" : "學生端＋號已鎖定"}
        </p>
      </div>
    </div>
  );
}

function CardPackButtonPreview({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d7c8ad] bg-[#fffaf0] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,236,160,0.42),transparent_28%),radial-gradient(circle_at_70%_70%,rgba(122,137,103,0.20),transparent_35%)]" />
      <div className="relative flex min-h-[210px] flex-col items-center justify-center text-center">
        {isOpen ? (
          <button
            type="button"
            className="card-pack-sparkle-button flex h-14 min-w-[170px] items-center justify-center rounded-2xl border-2 border-[#e8bd44] bg-gradient-to-r from-[#fff7c7] via-[#fff0a6] to-[#ffe08a] px-5 text-sm font-black tracking-[0.16em] text-[#6b4617] shadow-[0_0_28px_rgba(244,211,125,0.78)]"
          >
            打開石虎寶物包
          </button>
        ) : (
          <div className="flex h-14 min-w-[170px] items-center justify-center rounded-2xl border-2 border-stone-200 bg-stone-100 px-5 text-sm font-black tracking-[0.16em] text-stone-400">
            按鈕不顯示
          </div>
        )}
        <p className={`mt-4 rounded-full px-3 py-1 text-xs font-black ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
          {isOpen ? "學生端按鈕顯示中" : "學生端按鈕已隱藏"}
        </p>
      </div>
    </div>
  );
}

function CompactStudentMapPreview({ isOpen }: { isOpen: boolean }) {
  const emptyMap = useMemo(() => ({}) as Record<string, string>, []);

  return (
    <div
      className={`relative min-h-[210px] overflow-hidden rounded-[28px] border-[3px] transition game-cute-font game-smooth-layer ${
        isOpen
          ? "border-[#6b4326] bg-[#f4d37e] shadow-[0_8px_0_rgba(74,46,27,0.22),0_24px_44px_rgba(46,33,24,0.18)]"
          : "border-stone-300 bg-stone-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ffe8a8] via-[#e7c172] to-[#94b86e]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(247,241,227,0.85),transparent_28%),radial-gradient(circle_at_72%_68%,rgba(122,137,103,0.22),transparent_35%),radial-gradient(circle_at_44%_82%,rgba(181,154,111,0.16),transparent_30%)]" />
        <div className="absolute inset-0 opacity-45 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.72),transparent_24%),radial-gradient(circle_at_85%_76%,rgba(74,46,27,0.12),transparent_28%),repeating-linear-gradient(25deg,transparent_0_12px,rgba(74,46,27,0.10)_13px,transparent_14px)]" />
      </div>

      <div
        className={`relative z-10 flex h-[240px] items-center justify-center transition ${isOpen ? "" : "pointer-events-none grayscale"}`}
        style={{ opacity: isOpen ? 1 : 0.35 }}
      >
        <svg
          viewBox={MIAOLI_MAP_VIEW_BOX}
          className="h-full w-full transform-gpu"
          preserveAspectRatio="xMidYMid meet"
          aria-label="學生端苗栗地圖預覽"
        >
          <defs>
            <pattern
              id="teacher-compact-map-paper-grid"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="#8b8a73"
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
            fill="url(#teacher-compact-map-paper-grid)"
            opacity="0.45"
          />

          {regions.map((region) => {
            const state = emptyMap[region.name];
            const pos = labelPositions[region.name];

            return (
              <g key={region.name}>
                <path
                  d={region.d}
                  fill={
                    state === "保育"
                      ? "#aebc9c"
                      : state === "開發"
                        ? "#c58f82"
                        : state === "我不知道"
                          ? "#b8b8b8"
                          : "#f6f0df"
                  }
                  stroke="#7a4f2a"
                  strokeWidth="2.1"
                />
                <path
                  d={region.d}
                  fill="url(#teacher-compact-map-paper-grid)"
                  opacity="0.35"
                  stroke="#fff7d6"
                  strokeWidth="0.9"
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={pos.size}
                  fontWeight="900"
                  fill="#2e2118"
                  stroke="#fff7d6"
                  strokeWidth="2.8"
                  paintOrder="stroke"
                >
                  {region.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {!isOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/20 p-4 backdrop-blur-sm">
          <div className="rounded-3xl border border-white/70 bg-[#fffaf0]/92 px-5 py-4 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#c8b48f] bg-[#efe5d1] text-2xl">
              🔒
            </div>
            <p className="text-base font-semibold text-stone-700">
              地圖小任務還沒開門喔
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              學生端地圖會變灰並無法操作
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 z-10 rounded-full border-2 border-[#6b4326]/45 bg-gradient-to-b from-[#fff8cf] to-[#ffd86d] px-3 py-2 text-[10px] font-black tracking-[0.18em] text-[#4a2e1b] shadow-[0_4px_0_rgba(74,46,27,0.16)]">
        🐾 石虎任務地圖
      </div>

      <div className="absolute bottom-3 left-1/2 z-10 flex w-[94%] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-[#6b4326]/30 bg-[#fff8df]/90 px-3 py-2 text-[10px] font-black text-[#4a2e1b] shadow-[0_4px_0_rgba(74,46,27,0.12)]">
        <Legend color="bg-[#f6f0df] border border-[#8f876f]" label="未標記" />
        <Legend color="bg-[#aebc9c] border border-[#7d8b6f]" label="保育" />
        <Legend color="bg-[#c58f82] border border-[#a66d64]" label="開發" />
        <Legend color="bg-[#b8b8b8] border border-[#888]" label="我不知道" />
      </div>
    </div>
  );
}

function VotingControlCard({
  votingStatus,
  disabled,
  onOpenVisualization,
  onToggle,
  onFinish,
}: {
  votingStatus: SuspectVotingStatus;
  disabled: boolean;
  onOpenVisualization: () => void;
  onToggle: () => void;
  onFinish: () => void;
}) {
  const turnout = votingStatus.totalEligibleVoters > 0
    ? Math.round((votingStatus.totalVoters / votingStatus.totalEligibleVoters) * 100)
    : 0;

  return (
    <div className="flex h-full min-w-0 flex-col rounded-[28px] border border-[#d7c8ad] bg-[#fffaf0]/88 p-5 shadow-[0_18px_48px_rgba(45,41,34,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.24em] text-[#84745c]">
            VOTING
          </p>
          <h2 className="mt-2 text-xl font-black text-stone-800">投票活動</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${votingStatus.isOpen ? "bg-emerald-100 text-emerald-700" : votingStatus.isFinalized ? "bg-stone-200 text-stone-600" : "bg-red-100 text-red-700"}`}
        >
          {votingStatus.isOpen
            ? "投票中"
            : votingStatus.isFinalized
              ? "已結算"
              : "未開啟"}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
        已投票 {votingStatus.totalVoters} / {votingStatus.totalEligibleVoters}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-[#d7c8ad] bg-white/65 p-2 text-center shadow-sm">
          <p className="text-[10px] font-black tracking-[0.12em] text-[#84745c]">已投票</p>
          <p className="mt-1 text-lg font-black text-stone-800">{votingStatus.totalVoters}</p>
        </div>
        <div className="rounded-2xl border border-[#d7c8ad] bg-white/65 p-2 text-center shadow-sm">
          <p className="text-[10px] font-black tracking-[0.12em] text-[#84745c]">總人數</p>
          <p className="mt-1 text-lg font-black text-stone-800">{votingStatus.totalEligibleVoters}</p>
        </div>
        <div className="rounded-2xl border border-[#d7c8ad] bg-white/65 p-2 text-center shadow-sm">
          <p className="text-[10px] font-black tracking-[0.12em] text-[#84745c]">投票率</p>
          <p className="mt-1 text-lg font-black text-stone-800">{turnout}%</p>
        </div>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 content-start gap-2 text-xs font-bold text-stone-600">
        {VOTE_GROUPS.map((group) => (
          <div
            key={group.id}
            className="rounded-xl border border-stone-200 bg-white/70 px-3 py-2"
          >
            <span className="block truncate">{group.name}</span>
            <span className="text-stone-900">
              {votingStatus.totals[group.id] || 0} 票
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenVisualization}
          className={`${GAME_BTN} w-full border-[#7c8fa7] bg-[#eef4fb] text-[#2f4e70] hover:border-[#55708f] hover:bg-[#e2eef8]`}
        >
          視覺化
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`${GAME_BTN} ${votingStatus.isOpen ? "border-[#d7b8b1] bg-[#fbefed] text-[#8b4a43]" : "border-[#a9b39a] bg-[#f4f7ef] text-[#46513e]"} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {votingStatus.isOpen ? "關閉投票" : "開啟/繼續投票"}
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={disabled || votingStatus.isFinalized}
          className={`${GAME_BTN} border-[#bfa067] bg-[#fff7df] text-[#6d4e1f] disabled:cursor-not-allowed disabled:opacity-50`}
        >
          投票結算
        </button>
      </div>
    </div>
  );
}

function VotingVisualizationModal({
  votingStatus,
  onClose,
}: {
  votingStatus: SuspectVotingStatus;
  onClose: () => void;
}) {
  const maxVotes = Math.max(1, ...VOTE_GROUPS.map((group) => votingStatus.totals[group.id] || 0));
  const totalVotes = VOTE_GROUPS.reduce((sum, group) => sum + (votingStatus.totals[group.id] || 0), 0);
  const turnout = votingStatus.totalEligibleVoters > 0
    ? Math.round((votingStatus.totalVoters / votingStatus.totalEligibleVoters) * 100)
    : 0;
  const winners = votingStatus.isFinalized && Array.isArray(votingStatus.finalizedSuspects)
    ? votingStatus.finalizedSuspects
    : [];

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="投票視覺化統計"
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-[#d7c8ad] bg-[#fffaf0] p-5 text-stone-800 shadow-[0_30px_100px_rgba(0,0,0,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_28px]" />
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#d8c29a]/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#9fb48a]/25 blur-3xl" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#c8b48f] bg-white/80 text-2xl font-black text-black shadow-sm transition hover:bg-white"
          aria-label="關閉投票視覺化"
        >
          ×
        </button>

        <div className="relative z-10">
          <p className="text-xs font-black tracking-[0.32em] text-[#8b5e34]">LIVE VOTING DASHBOARD</p>
          <h2 className="mt-2 text-3xl font-black tracking-[0.08em] text-stone-800">即時投票畫面</h2>
          <p className="mt-2 text-sm font-semibold text-stone-600">
            {votingStatus.isFinalized ? "投票已結算，結果已鎖定。" : votingStatus.isOpen ? "投票開放中，目前票數會即時同步。" : "投票目前關閉，顯示現有計算。"}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[#d7c8ad] bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-bold text-[#84745c]">已投票人數</p>
              <p className="mt-1 text-4xl font-black text-stone-800">{votingStatus.totalVoters}</p>
            </div>
            <div className="rounded-3xl border border-[#d7c8ad] bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-bold text-[#84745c]">可投票總人數</p>
              <p className="mt-1 text-4xl font-black text-stone-800">{votingStatus.totalEligibleVoters}</p>
            </div>
            <div className="rounded-3xl border border-[#d7c8ad] bg-white/70 p-4 shadow-sm">
              <p className="text-xs font-bold text-[#84745c]">投票率</p>
              <p className="mt-1 text-4xl font-black text-stone-800">{turnout}%</p>
            </div>
          </div>

          {winners.length > 0 ? (
            <div className="mt-5 rounded-3xl border-2 border-red-200 bg-red-50/80 p-4 text-center shadow-inner">
              <p className="text-xs font-black tracking-[0.22em] text-red-700">FINAL VERDICT</p>
              <p className="mt-2 text-2xl font-black text-red-800">
                目前結算兇手：{winners.map((winner) => winner.roleName || winner.groupName).join("、")}
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-3 rounded-3xl border border-[#d7c8ad] bg-[#f7ecd5] p-4 shadow-inner">
            {VOTE_GROUPS.map((group, index) => {
              const count = votingStatus.totals[group.id] || 0;
              const width = Math.max(count > 0 ? 8 : 2, Math.round((count / maxVotes) * 100));
              const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={group.id} className="grid gap-2 md:grid-cols-[160px_1fr_84px] md:items-center">
                  <div className="truncate text-sm font-black text-[#4d4438]">{group.name}</div>
                  <div className="relative h-9 overflow-hidden rounded-full border border-[#c8b48f] bg-[#fffaf0]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#bfa067] via-[#d8c29a] to-[#9fb48a] shadow-[0_0_18px_rgba(159,180,138,0.22)] transition-all duration-700"
                      style={{ width: `${width}%`, transitionDelay: `${index * 60}ms` }}
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center text-xs font-black text-[#4d4438]">{percent}%</div>
                  </div>
                  <div className="text-right text-2xl font-black text-stone-800">{count}<span className="ml-1 text-xs text-stone-500">票</span></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}


function SectionLabel({
  eyebrow,
  title,
  tone,
}: {
  eyebrow: string;
  title: string;
  tone: "warm" | "cool";
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        className={`h-9 w-1.5 rounded-full ${
          tone === "warm" ? "bg-[#c79a3d]" : "bg-[#55759d]"
        }`}
      />
      <div>
        <p
          className={`text-[11px] font-black tracking-[0.22em] ${
            tone === "warm" ? "text-[#8a641e]" : "text-[#355579]"
          }`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-lg font-black text-stone-900">{title}</h2>
      </div>
    </div>
  );
}

function TeacherQuickLinkButton({
  icon,
  title,
  description,
  onClick,
  theme,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  theme: "amber" | "green" | "blue" | "rose" | "violet";
}) {
  const styles = {
    amber: {
      card: "border-[#d7bd7a] bg-white text-[#6d4e1f] hover:border-[#b98b2d] hover:bg-[#fffaf0]",
      rail: "bg-[#c99a2e]",
      icon: "bg-[#fff3cf]",
    },
    green: {
      card: "border-[#a9c4ae] bg-white text-[#294d35] hover:border-[#5c8568] hover:bg-[#f4fbf5]",
      rail: "bg-[#4f8f5f]",
      icon: "bg-[#e4f3e7]",
    },
    blue: {
      card: "border-[#a9bed8] bg-white text-[#27496f] hover:border-[#5a789d] hover:bg-[#f4f8fd]",
      rail: "bg-[#4f79a8]",
      icon: "bg-[#e5eef8]",
    },
    rose: {
      card: "border-[#dfb1bd] bg-white text-[#743045] hover:border-[#b65c73] hover:bg-[#fff5f7]",
      rail: "bg-[#b85d73]",
      icon: "bg-[#fae7ec]",
    },
    violet: {
      card: "border-[#c9b7e1] bg-white text-[#4d357d] hover:border-[#8269ad] hover:bg-[#f8f4ff]",
      rail: "bg-[#7d68aa]",
      icon: "bg-[#eee6fb]",
    },
  };
  const selected = styles[theme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[78px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 pl-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 ${selected.card}`}
    >
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${selected.rail}`} />
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm ${selected.icon}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black tracking-[0.10em]">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-bold opacity-75">
          {description}
        </span>
      </span>
    </button>
  );
}

const GROUPS: Group[] = [
  {
    id: "environment",
    name: "棲地保育局",
    icon: "🌿",
    color: "border-emerald-300 bg-emerald-50",
  },
  {
    id: "government",
    name: "土地規劃局",
    icon: "🚧",
    color: "border-amber-300 bg-amber-50",
  },
  {
    id: "farming",
    name: "農業生計局",
    icon: "🐄",
    color: "border-orange-300 bg-orange-50",
  },
  {
    id: "animal",
    name: "犬貓管理局",
    icon: "🐕",
    color: "border-rose-300 bg-rose-50",
  },
  {
    id: "greenEnergy",
    name: "科技投資局",
    icon: "☀️",
    color: "border-yellow-300 bg-yellow-50",
  },
  {
    id: "education",
    name: "公眾教育局",
    icon: "🎓",
    color: "border-sky-300 bg-sky-50",
  },
];

function loadPlayers(): Player[] {
  try {
    const parsed = readTeacherGroupsDraft<Player>();
    return parsed.map((player) => ({
      ...player,
      isGroupLeader: Boolean(player.isGroupLeader),
    }));
  } catch {
    return [];
  }
}

function normalizeGroupId(value: unknown): Player["groupId"] {
  return GROUPS.some((group) => group.id === value)
    ? (value as GroupId)
    : "unassigned";
}

function normalizePlayers(players: Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    groupId: normalizeGroupId(player.groupId),
    isGroupLeader:
      player.groupId !== "unassigned" && Boolean(player.isGroupLeader),
  }));
}

export default function ControlPage({
  onBack,
  token,
  initialPlayers,
  onSaveGroups,
}: ControlPageProps) {
  const [players, setPlayers] = useState<Player[]>(() =>
    initialPlayers ? normalizePlayers(initialPlayers) : loadPlayers(),
  );
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const groupedPlayers = useMemo(() => {
    const result: Record<Player["groupId"], Player[]> = {
      unassigned: [],
      environment: [],
      government: [],
      farming: [],
      animal: [],
      greenEnergy: [],
      education: [],
    };

    players.forEach((player) => {
      result[player.groupId].push(player);
    });

    return result;
  }, [players]);

  const assignedCount = players.filter(
    (player) => player.groupId !== "unassigned",
  ).length;
  const leaderCount = players.filter(
    (player) => player.groupId !== "unassigned" && player.isGroupLeader,
  ).length;

  useEffect(() => {
    if (!token) {
      const idleId = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(idleId);
    }

    const activeToken = token;
    let ignore = false;

    async function loadStudents() {
      setIsLoading(true);
      setStatusMessage("正在讀取學生帳號...");

      try {
        const data = await getTeacherPlayers(activeToken);
        if (ignore) return;

        const nextPlayers = (data.players || []).map((player) => ({
          id: String(player.id),
          name: player.name || player.username || `學生 ${player.id}`,
          username: player.username,
          email: player.email,
          groupId: normalizeGroupId(player.groupId),
          isGroupLeader: Boolean(player.isGroupLeader),
        })) as Player[];

        const normalized = normalizePlayers(nextPlayers);
        setPlayers(normalized);
        saveTeacherGroupsDraft(normalized);
        setStatusMessage("已同步資料庫中的學生分組與組長設定");
      } catch (error) {
        console.error(error);
        setStatusMessage(
          error instanceof Error ? error.message : "讀取學生失敗",
        );
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadStudents();

    return () => {
      ignore = true;
    };
  }, [token]);

  function commitLocal(nextPlayers: Player[]) {
    const normalized = normalizePlayers(nextPlayers);
    setPlayers(normalized);
    saveTeacherGroupsDraft(normalized);
    onSaveGroups?.(normalized);
  }

  async function save(nextPlayers: Player[]) {
    const normalized = normalizePlayers(nextPlayers);
    commitLocal(normalized);

    if (!token) {
      setStatusMessage("已暫存到本機，尚未連接資料庫");
      return;
    }

    setIsSaving(true);
    setStatusMessage("正在儲存分組與組長設定...");

    try {
      await saveTeacherPlayerGroups(
        token,
        normalized
          .filter((player) => /^\d+$/.test(player.id))
          .map((player) => ({
            userId: Number(player.id),
            groupId: player.groupId === "unassigned" ? null : player.groupId,
            isGroupLeader:
              player.groupId !== "unassigned" &&
              Boolean(player.isGroupLeader),
          })),
      );
      setStatusMessage("分組與組長設定已儲存到資料庫");
    } catch (error) {
      console.error(error);
      setStatusMessage(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setIsSaving(false);
    }
  }

  function removePlayer(playerId: string) {
    save(
      players.map((player) =>
        player.id === playerId
          ? { ...player, groupId: "unassigned", isGroupLeader: false }
          : player,
      ),
    );
  }

  function movePlayer(playerId: string, groupId: Player["groupId"]) {
    const currentPlayer = players.find((player) => player.id === playerId);
    const isSameGroup = currentPlayer?.groupId === groupId;

    if (
      !isSameGroup &&
      groupId !== "unassigned" &&
      groupedPlayers[groupId].length >= MAX_GROUP_SIZE
    ) {
      alert("這一組已經有 6 位成員了");
      return;
    }

    save(
      players.map((player) =>
        player.id === playerId
          ? {
              ...player,
              groupId,
              isGroupLeader:
                groupId === "unassigned" ? false : player.isGroupLeader,
            }
          : player,
      ),
    );
  }

  function setGroupLeader(playerId: string, groupId: Player["groupId"]) {
    if (groupId === "unassigned") return;
    save(
      players.map((player) =>
        player.groupId !== groupId
          ? player
          : { ...player, isGroupLeader: player.id === playerId },
      ),
    );
  }

  function clearGroupLeader(groupId: GroupId) {
    save(
      players.map((player) =>
        player.groupId === groupId
          ? { ...player, isGroupLeader: false }
          : player,
      ),
    );
  }

  function autoAssignGroups() {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    save(
      shuffled.map((player, index) => ({
        ...player,
        groupId: GROUPS[index % GROUPS.length].id,
        isGroupLeader: false,
      })),
    );
  }

  function clearGroups() {
    save(
      players.map((player) => ({
        ...player,
        groupId: "unassigned",
        isGroupLeader: false,
      })),
    );
  }

  function reloadFromDatabase() {
    if (!token) return;
    setPlayers([]);
    removeTeacherGroupsDraft();
    window.location.reload();
  }

  return (
    <div className="uiux-page-shell min-h-[100svh] overflow-x-hidden bg-[#f3efe6] p-3 pb-28 text-stone-800 sm:p-5">
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <header className="mb-5 min-w-0 rounded-[22px] border-4 border-stone-700 bg-[#fffaf0] p-4 shadow-[0_8px_0_rgba(68,64,60,0.35)] sm:rounded-[28px] sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black tracking-[0.22em] text-stone-500">
                GROUP MANAGEMENT
              </p>
              <h1 className="mt-1 break-words text-2xl font-black tracking-wide text-stone-800 sm:text-3xl">
                教師端｜小組管理
              </h1>
              <p className="mt-2 text-sm font-semibold text-stone-600">
                這個頁面只用來分配學生小組與設定組長。目前共有 {players.length}{" "}
                位學生，已分配 {assignedCount} 位，未分配{" "}
                {groupedPlayers.unassigned.length} 位，已設定 {leaderCount}{" "}
                位組長。
              </p>
              {statusMessage ? (
                <p className="mt-2 text-xs font-black tracking-wide text-stone-500">
                  {statusMessage}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-2xl border-2 border-stone-400 bg-white px-4 py-2 font-black shadow-sm transition hover:-translate-y-0.5"
                >
                  回首頁
                </button>
              ) : null}
              {token ? (
                <button
                  type="button"
                  onClick={reloadFromDatabase}
                  disabled={isLoading || isSaving}
                  className="rounded-2xl border-2 border-blue-700 bg-blue-600 px-4 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  重新讀取資料庫
                </button>
              ) : null}
              <button
                type="button"
                onClick={autoAssignGroups}
                disabled={isLoading || isSaving || players.length === 0}
                className="rounded-2xl border-2 border-emerald-700 bg-emerald-600 px-4 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                自動平均分組
              </button>
              <button
                type="button"
                onClick={clearGroups}
                disabled={isLoading || isSaving || players.length === 0}
                className="rounded-2xl border-2 border-red-700 bg-red-600 px-4 py-2 font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                清空分組
              </button>
            </div>
          </div>
        </header>

        <section className="mb-5">
          <div className="min-w-0 rounded-[22px] border-4 border-stone-700 bg-white p-4 shadow-[0_6px_0_rgba(68,64,60,0.25)] sm:rounded-[24px]">
            <h2 className="mb-3 text-xl font-black">未分配學生</h2>
            <div className="flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
              {isLoading ? (
                <p className="text-sm font-bold text-stone-500">讀取中...</p>
              ) : groupedPlayers.unassigned.length === 0 ? (
                <p className="text-sm font-bold text-stone-500">
                  目前沒有未分配學生
                </p>
              ) : (
                groupedPlayers.unassigned.map((player) => (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    onRemove={() => removePlayer(player.id)}
                    onMove={(groupId) => movePlayer(player.id, groupId)}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map((group) => {
            const members = groupedPlayers[group.id];
            const leader = members.find((player) => player.isGroupLeader);

            return (
              <div
                key={group.id}
                className={`min-w-0 rounded-[22px] border-4 p-4 shadow-[0_6px_0_rgba(68,64,60,0.22)] sm:rounded-[24px] ${group.color}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">
                      <span className="mr-2">{group.icon}</span>
                      {group.name}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-stone-600">
                      {members.length} / {MAX_GROUP_SIZE} 人
                      <span className="mx-2">｜</span>組長：
                      {leader ? leader.name : "未設定"}
                    </p>
                  </div>
                  <div className="rounded-full border-2 border-stone-700 bg-white px-3 py-1 text-sm font-black">
                    {members.length >= MAX_GROUP_SIZE ? "已滿" : "可加入"}
                  </div>
                </div>

                <div className="min-h-48 space-y-2">
                  {members.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-white/60 p-4 text-center text-sm font-bold text-stone-500">
                      尚未分配成員
                    </div>
                  ) : (
                    members.map((player) => (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        onRemove={() => removePlayer(player.id)}
                        onMove={(groupId) => movePlayer(player.id, groupId)}
                        onSetLeader={() => setGroupLeader(player.id, group.id)}
                        onClearLeader={() => clearGroupLeader(group.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function PlayerChip({
  player,
  onRemove,
  onMove,
}: {
  player: Player;
  onRemove: () => void;
  onMove: (groupId: Player["groupId"]) => void;
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border-2 border-stone-300 bg-stone-50 px-3 py-2">
      <span className="min-w-0 break-words font-black">{player.name}</span>
      <GroupSelect value={player.groupId} onChange={onMove} />
      <button
        type="button"
        onClick={onRemove}
        className="font-black text-red-600"
      >
        ✕
      </button>
    </div>
  );
}

function PlayerRow({
  player,
  onRemove,
  onMove,
  onSetLeader,
  onClearLeader,
}: {
  player: Player;
  onRemove: () => void;
  onMove: (groupId: Player["groupId"]) => void;
  onSetLeader: () => void;
  onClearLeader: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-3 shadow-sm ${player.isGroupLeader ? "border-purple-400 bg-purple-50" : "border-white/80 bg-white/80"}`}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-stone-800">{player.name}</p>
            {player.isGroupLeader ? (
              <span className="rounded-full border border-purple-400 bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-700">
                👑 組長
              </span>
            ) : null}
          </div>
          {player.username || player.email ? (
            <p className="mt-0.5 text-xs font-semibold text-stone-500">
              {[player.username, player.email].filter(Boolean).join("｜")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-red-100 px-2 py-1 font-black text-red-700"
        >
          移除
        </button>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <GroupSelect value={player.groupId} onChange={onMove} />
        {player.isGroupLeader ? (
          <button
            type="button"
            onClick={onClearLeader}
            className="rounded-xl border-2 border-purple-300 bg-white px-3 py-1 text-sm font-black text-purple-700"
          >
            取消組長
          </button>
        ) : (
          <button
            type="button"
            onClick={onSetLeader}
            className="rounded-xl border-2 border-purple-700 bg-purple-600 px-3 py-1 text-sm font-black text-white"
          >
            設為組長
          </button>
        )}
      </div>
    </div>
  );
}

function GroupSelect({
  value,
  onChange,
}: {
  value: Player["groupId"];
  onChange: (groupId: Player["groupId"]) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Player["groupId"])}
      className="w-full min-w-0 rounded-xl border-2 border-stone-300 bg-white px-2 py-1 text-sm font-bold outline-none focus:border-stone-700"
    >
      <option value="unassigned">未分配</option>
      {GROUPS.map((group) => (
        <option key={group.id} value={group.id}>
          {group.icon} {group.name}
        </option>
      ))}
    </select>
  );
}
