/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 controlApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { authHeaders, requestJson } from "./apiClient";
import type {
  ApiRecord,
  FinalDecisionSettlementApi,
  OpenStatusApi,
  ScreenLockStatusApi,
  VotingStatusApi,
} from "./homeApi";

export type TeacherControlStatuses = {
  inquiryTask: OpenStatusApi;
  mapTask: OpenStatusApi;
  cardPack: OpenStatusApi;
  voting: VotingStatusApi;
  screenLock: ScreenLockStatusApi;
  finalDecision: FinalDecisionSettlementApi;
};

export type TeacherGroupCardPackLockApi = ApiRecord & {
  groupId: "environment" | "government" | "farming" | "animal" | "greenEnergy" | "education";
  groupName: string;
  isLocked: boolean;
  selectedCardIds: string[];
  reason?: string;
  lockedBy?: number | string | null;
  lockedAt?: string | null;
  unlockVersion?: string | null;
};

export type TeacherGroupCardPackLocksApi = ApiRecord & {
  locks?: TeacherGroupCardPackLockApi[];
  groups?: TeacherGroupCardPackLockApi[];
};

export type TeacherPlayersApi = ApiRecord & {
  players?: Array<{
    id: number | string;
    name?: string;
    username?: string;
    email?: string;
    groupId?: string | number | null;
    isGroupLeader?: boolean;
  }>;
};

export type TeacherActionMessageApi = ApiRecord & {
  message?: string;
  title?: string;
  groups?: TeacherGroupCardPackLockApi[];
};

export async function getTeacherControlStatuses(token: string): Promise<TeacherControlStatuses> {
  const headers = { Authorization: `Bearer ${token}` };
  const [inquiryTask, mapTask, cardPack, voting, screenLock, finalDecision] = await Promise.all([
    requestJson<OpenStatusApi>("/api/inquiry-task-status", { headers }),
    requestJson<OpenStatusApi>("/api/map-task-status", { headers }),
    requestJson<OpenStatusApi>("/api/card-pack-status", { headers }),
    requestJson<VotingStatusApi>("/api/suspect-voting-status", { headers }),
    requestJson<ScreenLockStatusApi>("/api/student-screen-lock", { headers }),
    requestJson<FinalDecisionSettlementApi>("/api/final-decision-settlement", { headers }),
  ]);
  return { inquiryTask, mapTask, cardPack, voting, screenLock, finalDecision };
}

export function getTeacherGroupCardPackLocks(token: string) {
  return requestJson<TeacherGroupCardPackLocksApi>("/api/teacher/group-card-pack-locks", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function unlockTeacherGroupCardPack(token: string, groupId: string) {
  return requestJson<TeacherActionMessageApi>(`/api/teacher/group-card-pack-locks/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function unlockAllTeacherGroupCardPacks(token: string) {
  return requestJson<TeacherActionMessageApi>("/api/teacher/group-card-pack-locks", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateStudentScreenLock(token: string, isLocked: boolean) {
  return requestJson<ScreenLockStatusApi>("/api/student-screen-lock", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ isLocked }),
  });
}

export function updateInquiryTaskStatus(token: string, isOpen: boolean) {
  return requestJson<OpenStatusApi>("/api/inquiry-task-status", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ isOpen }),
  });
}

export function updateMapTaskStatus(token: string, isOpen: boolean) {
  return requestJson<OpenStatusApi>("/api/map-task-status", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ isOpen }),
  });
}

export function updateCardPackStatus(token: string, isOpen: boolean) {
  return requestJson<OpenStatusApi>("/api/card-pack-status", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ isOpen }),
  });
}

export function updateSuspectVotingStatus(token: string, isOpen: boolean) {
  return requestJson<VotingStatusApi>("/api/suspect-voting-status", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ isOpen }),
  });
}

export function finishSuspectVotingApi(token: string) {
  return requestJson<VotingStatusApi>("/api/suspect-voting-finish", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function finalizeDecisionSettlementApi(token: string) {
  return requestJson<FinalDecisionSettlementApi>("/api/final-decision-settlement", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function closeDecisionSettlementApi(token: string) {
  return requestJson<FinalDecisionSettlementApi>("/api/final-decision-settlement/close", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function clearTeacherDatabaseData(token: string, confirmText: string) {
  return requestJson<TeacherActionMessageApi>("/api/teacher/database-data", {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ confirmText }),
  });
}

export function getTeacherPlayers(token: string) {
  return requestJson<TeacherPlayersApi>("/api/teacher/players", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveTeacherPlayerGroups(token: string, assignments: unknown[]) {
  return requestJson<TeacherActionMessageApi>("/api/teacher/players/groups", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ assignments }),
  });
}

export function settleTeacherDecisionCardRound(token: string) {
  return requestJson<TeacherActionMessageApi>("/api/teacher/decision-card-round/settle", {
    method: "POST",
    headers: authHeaders(token),
  }, 60000);
}
