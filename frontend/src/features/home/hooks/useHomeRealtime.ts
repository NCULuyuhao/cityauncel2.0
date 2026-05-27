/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能 hook useHomeRealtime，封裝首頁狀態、即時事件或教師控制資料。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect } from "react";
import { subscribeRealtime } from "@/api/realtime";
import type { FinalDecisionSettlementApi, MapChoiceApi, VotingStatusApi } from "@/api/homeApi";

type MutableRef<T> = { current: T };

type HomeRealtimeUser = {
  id?: number | string | null;
  role?: string | null;
  groupId?: string | null;
};

type UseHomeRealtimeOptions = {
  token: string | null;
  currentUser: HomeRealtimeUser | null;
  isTeacher: boolean;
  loadVotingStatus: () => void;
  applyVotingStatus: (status: VotingStatusApi) => void;
  handleFinalSettlementForStudent: (settlement: FinalDecisionSettlementApi) => void;
  applyRealtimeFinalMapDecision: (patch: {
    mode: "group" | "class";
    groupId?: string | null;
    districtName: string;
    choice: MapChoiceApi | "";
  }) => void;
  handleRealtimeGroupCardPackLock: (payload: {
    groupId?: string | null;
    lock?: {
      selectedCardIds?: string[];
      lockedAt?: string | null;
    } | null;
  }) => void;
  scheduleGroupAndClassMapRefresh: () => void;
  clearHandledFinalSettlementKey: (userId?: number | string | null) => void;
  clearHomeProgressCache: () => void;
  stableMapText: (map: Record<string, never>) => string;
  activeFinalSettlementKeyRef: MutableRef<string | null>;
  lastSavedMapTextRef: MutableRef<string>;
  resetAfterDatabaseCleared: () => void;
  setFinalDecisionSettlement: (value: FinalDecisionSettlementApi | { isFinalized: false }) => void;
  setFinalEndingCountdown: (value: number | null) => void;
  setIsCardPackOpen: (isOpen: boolean) => void;
  setIsInquiryTaskOpen: (isOpen: boolean) => void;
  setIsMapTaskOpen: (isOpen: boolean) => void;
  setIsStudentScreenLocked: (isLocked: boolean) => void;
};

export function useHomeRealtime({
  token,
  currentUser,
  isTeacher,
  loadVotingStatus,
  applyVotingStatus,
  handleFinalSettlementForStudent,
  applyRealtimeFinalMapDecision,
  handleRealtimeGroupCardPackLock,
  scheduleGroupAndClassMapRefresh,
  clearHandledFinalSettlementKey,
  clearHomeProgressCache,
  stableMapText,
  activeFinalSettlementKeyRef,
  lastSavedMapTextRef,
  resetAfterDatabaseCleared,
  setFinalDecisionSettlement,
  setFinalEndingCountdown,
  setIsCardPackOpen,
  setIsInquiryTaskOpen,
  setIsMapTaskOpen,
  setIsStudentScreenLocked,
}: UseHomeRealtimeOptions) {
  useEffect(() => {
    if (!token || !currentUser?.id) return;

    return subscribeRealtime(token, (event) => {
      const payload = (event.payload || {}) as Record<string, unknown> & {
        isOpen?: boolean;
        isLocked?: boolean;
        isFinalized?: boolean;
        userId?: unknown;
        voting?: VotingStatusApi;
        groupId?: unknown;
        lock?: unknown;
      };

      if (event.type === "inquiry-task-status") {
        setIsInquiryTaskOpen(payload.isOpen !== false);
        return;
      }
      if (event.type === "map-task-status") {
        setIsMapTaskOpen(Boolean(payload.isOpen));
        return;
      }
      if (event.type === "card-pack-status") {
        setIsCardPackOpen(Boolean(payload.isOpen));
        return;
      }
      if (event.type === "student-screen-lock") {
        setIsStudentScreenLocked(Boolean(payload.isLocked));
        return;
      }
      if (event.type === "final-decision-settlement") {
        const settlement = { ...payload, isFinalized: Boolean(payload.isFinalized) } as FinalDecisionSettlementApi;
        setFinalDecisionSettlement(
          settlement.isFinalized ? settlement : { isFinalized: false },
        );
        if (!isTeacher && settlement.isFinalized) {
          handleFinalSettlementForStudent(settlement);
        } else {
          activeFinalSettlementKeyRef.current = null;
          clearHandledFinalSettlementKey(currentUser.id);
          setFinalEndingCountdown(null);
        }
        return;
      }
      if (event.type === "suspect-voting-status") {
        loadVotingStatus();
        return;
      }
      if (event.type === "suspect-votes-updated") {
        if (Number(payload.userId) === Number(currentUser.id) && payload.voting) {
          applyVotingStatus(payload.voting);
        } else if (currentUser.role === "teacher") {
          loadVotingStatus();
        }
        return;
      }
      if (event.type === "database-data-cleared") {
        clearHomeProgressCache();
        resetAfterDatabaseCleared();
        lastSavedMapTextRef.current = stableMapText({});
        return;
      }
      if (event.type === "group-card-pack-lock") {
        const selectedCardIds = Array.isArray(
          (payload.lock as { selectedCardIds?: unknown[] } | null | undefined)?.selectedCardIds,
        )
          ? (payload.lock as { selectedCardIds?: unknown[] }).selectedCardIds?.map(String)
          : [];
        const lockedAtValue = (payload.lock as { lockedAt?: unknown } | null | undefined)?.lockedAt;
        handleRealtimeGroupCardPackLock({
          groupId: payload.groupId ? String(payload.groupId) : null,
          lock: payload.lock
            ? {
                selectedCardIds,
                lockedAt: lockedAtValue ? String(lockedAtValue) : null,
              }
            : null,
        });
        return;
      }
      if (event.type === "map-user-updated") {
        const eventGroupId = payload.groupId ? String(payload.groupId) : null;
        if (!eventGroupId || eventGroupId === currentUser.groupId) {
          scheduleGroupAndClassMapRefresh();
        }
        return;
      }
      if (
        event.type === "map-group-final-updated" ||
        event.type === "map-class-final-updated"
      ) {
        const districtName = typeof payload.districtName === "string" ? payload.districtName : "";
        const choice = typeof payload.choice === "string" ? payload.choice as MapChoiceApi : "";

        if (districtName && event.type === "map-group-final-updated") {
          const eventGroupId = payload.groupId ? String(payload.groupId) : null;
          if (!eventGroupId || eventGroupId === currentUser.groupId) {
            applyRealtimeFinalMapDecision({
              mode: "group",
              groupId: eventGroupId,
              districtName,
              choice,
            });
          }
        }

        if (districtName && event.type === "map-class-final-updated") {
          applyRealtimeFinalMapDecision({
            mode: "class",
            districtName,
            choice,
          });
        }

        scheduleGroupAndClassMapRefresh();
      }
    });
  }, [
    activeFinalSettlementKeyRef,
    applyVotingStatus,
    applyRealtimeFinalMapDecision,
    handleRealtimeGroupCardPackLock,
    clearHandledFinalSettlementKey,
    clearHomeProgressCache,
    currentUser,
    handleFinalSettlementForStudent,
    isTeacher,
    lastSavedMapTextRef,
    loadVotingStatus,
    resetAfterDatabaseCleared,
    scheduleGroupAndClassMapRefresh,
    setFinalDecisionSettlement,
    setFinalEndingCountdown,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
    stableMapText,
    token,
  ]);
}
