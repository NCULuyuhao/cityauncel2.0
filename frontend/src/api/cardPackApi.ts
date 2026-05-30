/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 cardPackApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { authHeaders, requestJson } from "./apiClient";
import { requestJsonCacheFirst, writeApiCache } from "./apiResponseCache";
import { requestJsonWithPending } from "./pendingWriteQueue";

export type CardPackUserResponse<TUser = unknown> = {
  user?: TUser;
  message?: string;
};

export type GroupCardPackLock = {
  id?: number | string;
  groupId?: string | null;
  groupName?: string | null;
  selectedCardIds?: string[];
  reason?: string | null;
  lockedAt?: string | null;
  lockedBy?: number | string | null;
  lockedByUsername?: string | null;
};

export type GroupCardPackLockResponse = {
  lock?: GroupCardPackLock | null;
  message?: string;
};

export function getCardPackCurrentUser<TUser = unknown>(token: string) {
  return requestJson<CardPackUserResponse<TUser>>("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getGroupCardPackLock(token: string, options: { cache?: RequestCache } = {}) {
  if (options.cache === "no-store") {
    return requestJson<GroupCardPackLockResponse>("/api/group-card-pack-lock", {
      headers: { Authorization: `Bearer ${token}` },
      cache: options.cache,
    }).then((response) => {
      writeApiCache("/api/group-card-pack-lock", response);
      return response;
    });
  }

  return requestJsonCacheFirst<GroupCardPackLockResponse>(token, "/api/group-card-pack-lock", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveGroupCardPackLock(
  token: string,
  payload: { selectedCardIds: string[]; reason: string; coreCardId?: string },
) {
  return requestJsonWithPending<GroupCardPackLockResponse>(token, {
    path: "/api/group-card-pack-lock",
    method: "PUT",
    body: payload,
    dedupeKey: "group-card-pack-lock",
  }).then((response) => {
    writeApiCache("/api/group-card-pack-lock", response);
    return response;
  });
}

export type DecisionCardVoteType = "agree" | "reject";
export type DecisionCardVote = {
  roundNo: number;
  proposalGroupId: string;
  cardId: string;
  voterGroupId: string;
  voterUserId?: number | string;
  voteType: DecisionCardVoteType;
  votedAt?: string | null;
};
export type DecisionCardVoteCount = {
  cardId: string;
  agree: number;
  reject: number;
  keep: number;
};
export type DecisionCardVoteSubmission = {
  roundNo: number;
  voterGroupId: string;
  voterUserId?: number | string;
  submittedAt?: string | null;
};
export type DecisionCardAccepted = {
  roundNo: number;
  groupId: string;
  cardId: string;
  coreCard?: boolean;
  agreeCount?: number;
  rejectCount?: number;
  acceptedAt?: string | null;
};
export type DecisionCardRoundHistoryItem = {
  roundNo: number;
  groupId: string;
  cardId: string;
  coreCard?: boolean;
  agreeCount?: number;
  rejectCount?: number;
  keepCount?: number;
  result?: "accepted" | "rejected" | "reserved" | string;
  reason?: string | null;
  settledAt?: string | null;
};

export type DecisionCardGroupScore = {
  roundNo: number;
  groupId: string;
  acceptedCount?: number;
  rejectedCount?: number;
  reservedCount?: number;
  acceptedScore?: number;
  rejectedScore?: number;
  coreBonus?: number;
  scoreDelta?: number;
  cumulativeScore?: number;
  settledAt?: string | null;
};

export type DecisionCardProposal = GroupCardPackLock & {
  roundNo?: number;
  coreCardId?: string | null;
  selectedCardIds: string[];
};
export type DecisionCardGameState = {
  message?: string;
  groupId?: string | null;
  isGroupLeader?: boolean;
  roundNo: number;
  proposals: DecisionCardProposal[];
  votes: DecisionCardVote[];
  voteCounts?: DecisionCardVoteCount[];
  voteSubmissions?: DecisionCardVoteSubmission[];
  myVotes: DecisionCardVote[];
  acceptedCards: DecisionCardAccepted[];
  roundHistory?: DecisionCardRoundHistoryItem[];
  groupScores?: DecisionCardGroupScore[];
  roundPreview?: unknown;
};

export function getDecisionCardGameState(token: string) {
  return requestJson<DecisionCardGameState>("/api/decision-card-game", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }, 25000);
}

export function getDecisionCardGameLiveState(token: string) {
  return requestJson<DecisionCardGameState>("/api/decision-card-game/live", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }, 12000);
}

export function saveDecisionCardVotes(
  token: string,
  votes: Array<{ cardId: string; voteType: DecisionCardVoteType }>,
) {
  return requestJson<DecisionCardGameState>("/api/decision-card-game/votes", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ votes }),
  }, 30000);
}
