/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 homeApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { authHeaders, requestJson } from "./apiClient";
import { removeApiCache } from "./apiResponseCache";
import { requestJsonWithPending } from "./pendingWriteQueue";

export type ApiRecord = Record<string, unknown>;
export type MapChoiceApi = "保育" | "開發" | "我不知道";
export type MapStateApi = Record<string, MapChoiceApi>;
export type GroupMemberApi = {
  id: number | string;
  username?: string;
  name?: string;
  email?: string;
  isGroupLeader?: boolean;
  isPersonalMapLocked?: boolean;
  personalMapLockedAt?: string | null;
};
export type MapLockStatusApi = {
  userId?: number | string;
  groupId?: string;
  username?: string;
  name?: string;
  groupName?: string;
  isGroupLeader?: boolean;
  isLocked: boolean;
  lockedAt?: string | null;
  lockedByUserId?: number | string | null;
};
export type MapLockSummaryApi = {
  lockedCount: number;
  totalCount: number;
  unlockedCount: number;
  allLocked?: boolean;
};
export type OpenStatusApi = ApiRecord & { isOpen?: boolean };
export type ScreenLockStatusApi = ApiRecord & { isLocked?: boolean; locked?: boolean };
export type FinalDecisionCardApi = {
  cardId: string;
  title: string;
  stance: "利己" | "利他" | "中立";
  score: number;
};
export type FinalDecisionGroupApi = {
  groupId: string;
  groupName: string;
  selectedCardIds: string[];
  cards: FinalDecisionCardApi[];
  score: number;
  lockedAt?: string | null;
  reason?: string;
};
export type FinalDecisionSettlementApi = ApiRecord & {
  isFinalized: boolean;
  finalizedAt?: string | null;
  totalScore?: number;
  outcome?: { id: string; title: string; subtitle: string };
  groups?: FinalDecisionGroupApi[];
};
export type VotingStatusApi = ApiRecord & {
  isOpen?: boolean;
  isFinalized?: boolean;
  finalizedSuspects?: Array<{ roleId?: string; roleName?: string; groupId: string; groupName: string; count: number }>;
  finalizedAt?: string | null;
  totals?: Record<string, number>;
  totalVoters?: number;
  totalEligibleVoters?: number;
  myVotes?: string[];
};
export type GroupPersonalMapsApi = ApiRecord & {
  personalData?: MapStateApi[];
  groupFinalDecisions?: MapStateApi;
  finalChoices?: MapStateApi;
  members?: GroupMemberApi[];
  groupId?: string | null;
  groupName?: string | null;
  personalLockStatuses?: MapLockStatusApi[];
  personalLockSummary?: MapLockSummaryApi;
  isGroupReady?: boolean;
  isMyPersonalLocked?: boolean;
  isGroupMapLocked?: boolean;
  groupMapLockedAt?: string | null;
  groupMapLockedByUserId?: number | string | null;
};
export type RegionDecisionValueApi = MapChoiceApi | "" | { result: MapChoiceApi | ""; locked: boolean; isTie: boolean; conserveCount: number; developCount: number; finalChoice?: MapChoiceApi };
export type RegionDecisionMapApi = Record<string, RegionDecisionValueApi>;
export type ClassGroupDecisionItemApi = RegionDecisionMapApi & { decisions?: RegionDecisionMapApi };
export type ClassGroupDecisionsApi = ApiRecord & {
  groupData?: ClassGroupDecisionItemApi[];
  groupResults?: ClassGroupDecisionItemApi[];
  classFinalChoices?: MapStateApi;
  groupLockStatuses?: MapLockStatusApi[];
  groupLockSummary?: MapLockSummaryApi;
  allGroupsLocked?: boolean;
};
export type UserMapApi = ApiRecord & {
  mapState?: MapStateApi;
  isPersonalLocked?: boolean;
  personalLockedAt?: string | null;
};

export function getMe(token: string) {
  return requestJson<{ user?: unknown }>("/api/me", {
    headers: authHeaders(token),
  });
}

export function getGroupPersonalMaps(token: string) {
  return requestJson<GroupPersonalMapsApi>("/api/group-personal-maps", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getClassGroupDecisions(token: string) {
  return requestJson<ClassGroupDecisionsApi>("/api/class-group-decisions", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getClassFinalDecisions(token: string) {
  return requestJson<MapStateApi>("/api/class-final-decisions", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getUserMap(token: string) {
  return requestJson<UserMapApi>("/api/user-map", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export async function saveUserMapState(token: string, mapState: unknown) {
  const response = await requestJsonWithPending<ApiRecord>(token, {
    path: "/api/user-map",
    method: "PUT",
    body: { mapState },
    dedupeKey: "user-map",
  });
  removeApiCache("/api/user-map");
  removeApiCache("/api/group-personal-maps");
  return response;
}

export async function lockUserMap(token: string, mapState?: unknown) {
  const response = await requestJsonWithPending<ApiRecord>(token, {
    path: "/api/user-map/lock",
    method: "POST",
    body: mapState ? { mapState } : {},
    dedupeKey: "user-map-lock",
  });
  removeApiCache("/api/user-map");
  removeApiCache("/api/group-personal-maps");
  removeApiCache("/api/class-group-decisions");
  return response;
}

export async function lockGroupMap(token: string) {
  const response = await requestJsonWithPending<ApiRecord>(token, {
    path: "/api/group-map/lock",
    method: "POST",
    body: {},
    dedupeKey: "group-map-lock",
  });
  removeApiCache("/api/group-personal-maps");
  removeApiCache("/api/class-group-decisions");
  removeApiCache("/api/class-final-decisions");
  return response;
}

export function getInquiryTaskStatus(token: string) {
  return requestJson<OpenStatusApi>("/api/inquiry-task-status", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getMapTaskStatus(token: string) {
  return requestJson<OpenStatusApi>("/api/map-task-status", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getCardPackStatus(token: string) {
  return requestJson<OpenStatusApi>("/api/card-pack-status", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getSuspectVotingStatus(token: string) {
  return requestJson<VotingStatusApi>("/api/suspect-voting-status", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getStudentScreenLock(token: string) {
  return requestJson<ScreenLockStatusApi>("/api/student-screen-lock", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function getFinalDecisionSettlement(token: string) {
  return requestJson<FinalDecisionSettlementApi>("/api/final-decision-settlement", {
    headers: authHeaders(token),
    cache: "no-store",
  });
}

export function writeActivityLog(token: string, payload: unknown) {
  return requestJsonWithPending<ApiRecord>(token, {
    path: "/api/activity-log",
    method: "POST",
    body: payload,
  });
}

export async function saveFinalMapDecision(
  token: string,
  mode: "group" | "class",
  districtName: string,
  choice: string | null,
) {
  const response = await requestJsonWithPending<ApiRecord>(token, {
    path: mode === "group" ? "/api/group-final-decision" : "/api/class-final-decision",
    method: mode === "group" ? "PUT" : "POST",
    body: { districtName, choice },
    dedupeKey: `final-map:${mode}:${districtName}`,
  });
  removeApiCache("/api/group-personal-maps");
  removeApiCache("/api/class-group-decisions");
  removeApiCache("/api/class-final-decisions");
  return response;
}

export function submitSuspectVotes(token: string, ranking: string[]) {
  return requestJsonWithPending<ApiRecord>(token, {
    path: "/api/suspect-votes",
    method: "POST",
    body: { ranking },
    dedupeKey: "suspect-votes",
  });
}
