/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能 hook useHomeRealtime，封裝首頁狀態、即時事件或教師控制資料。
 * 維護重點：SSE 連線只應跟 token 綁定；會變動的使用者/小組/回呼狀態一律透過 ref 讀取，避免資料同步時反覆斷線重連。
 */

import { useEffect, useRef } from "react";
import { subscribeRealtime, type RealtimeConnectionStatus } from "@/api/realtime";
import type { FinalDecisionSettlementApi, MapChoiceApi, VotingStatusApi } from "@/api/homeApi";

type MutableRef<T> = { current: T };

type HomeRealtimeUser = {
  id?: number | string | null;
  role?: string | null;
  groupId?: string | null;
};

type MapSyncStatus = {
  state: "live" | "syncing" | "synced" | "unstable";
  text: string;
  updatedAt?: number;
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
  applyRealtimeMapLockSnapshot: (payload: Record<string, unknown>) => void;
  updateMapSyncStatus: (status: MapSyncStatus) => void;
  handleRealtimeGroupCardPackLock: (payload: {
    groupId?: string | null;
    lock?: {
      selectedCardIds?: string[];
      lockedAt?: string | null;
    } | null;
  }) => void;
  scheduleGroupAndClassMapRefresh: (delayMs?: number) => void;
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

function normalizeId(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

export function useHomeRealtime(options: UseHomeRealtimeOptions) {
  const latestRef = useRef(options);

  useEffect(() => {
    latestRef.current = options;
  });

  useEffect(() => {
    if (!options.token) return;

    const handleConnectionStatus = (status: RealtimeConnectionStatus) => {
      const { updateMapSyncStatus } = latestRef.current;
      if (status === "open") {
        updateMapSyncStatus({ state: "live", text: "即時同步中", updatedAt: Date.now() });
        return;
      }
      if (status === "connecting") {
        updateMapSyncStatus({ state: "syncing", text: "正在建立即時同步…", updatedAt: Date.now() });
        return;
      }
      updateMapSyncStatus({ state: "unstable", text: "連線不穩，正在用備援同步", updatedAt: Date.now() });
    };

    return subscribeRealtime(options.token, (event) => {
      const latest = latestRef.current;
      const {
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
        resetAfterDatabaseCleared,
        setFinalDecisionSettlement,
        setFinalEndingCountdown,
        setIsCardPackOpen,
        setIsInquiryTaskOpen,
        setIsMapTaskOpen,
        setIsStudentScreenLocked,
      } = latest;

      if (!currentUser?.id) return;

      const payload = (event.payload || {}) as Record<string, unknown> & {
        isOpen?: boolean;
        isLocked?: boolean;
        isFinalized?: boolean;
        userId?: unknown;
        voting?: VotingStatusApi;
        groupId?: unknown;
        lock?: unknown;
        scope?: unknown;
        affectedGroupIds?: unknown;
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
        const lockPayload = payload.lock as { selectedCardIds?: unknown[]; lockedAt?: unknown } | null | undefined;
        const selectedCardIds = Array.isArray(lockPayload?.selectedCardIds)
          ? lockPayload.selectedCardIds.map(String)
          : [];
        const lockedAtValue = lockPayload?.lockedAt;
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
      if (event.type === "map-lock-updated") {
        const scope = typeof payload.scope === "string" ? payload.scope : "";
        const eventGroupId = normalizeId(payload.groupId);
        const currentGroupId = normalizeId(currentUser.groupId);
        const affectedGroupIds = Array.isArray(payload.affectedGroupIds)
          ? payload.affectedGroupIds.map(String)
          : [];
        const isRelevantPersonalLock = scope === "personal" && (!eventGroupId || eventGroupId === currentGroupId || isTeacher);
        const isRelevantAssignment = scope === "assignment" && (isTeacher || !currentGroupId || affectedGroupIds.includes(currentGroupId));
        const isRelevantClassLevelLock = scope === "group" || scope === "class";

        if (!isRelevantPersonalLock && !isRelevantAssignment && !isRelevantClassLevelLock) {
          return;
        }

        applyRealtimeMapLockSnapshot(payload);
        updateMapSyncStatus({ state: "synced", text: "剛剛已更新", updatedAt: Date.now() });
        scheduleGroupAndClassMapRefresh(scope === "personal" || scope === "group" ? 80 : 150);
        return;
      }
      if (event.type === "map-user-updated") {
        const eventGroupId = payload.groupId ? String(payload.groupId) : null;
        if (!eventGroupId || eventGroupId === currentUser.groupId || isTeacher) {
          updateMapSyncStatus({ state: "syncing", text: "同步地圖資料中…", updatedAt: Date.now() });
          scheduleGroupAndClassMapRefresh(150);
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
          if (!eventGroupId || eventGroupId === currentUser.groupId || isTeacher) {
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

        updateMapSyncStatus({ state: "synced", text: "剛剛已更新", updatedAt: Date.now() });
        scheduleGroupAndClassMapRefresh(80);
      }
    }, handleConnectionStatus);
  }, [options.token]);
}
