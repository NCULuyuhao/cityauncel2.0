import type { MapChoice } from "./homePageStateStorage";

export type PendingReportReveal = {
  startIndex: number;
  targetIndex: number;
  waitForTitleReward: boolean;
};

export type GroupMember = {
  id: number | string;
  username?: string;
  name?: string;
  email?: string;
  isGroupLeader?: boolean;
  isPersonalMapLocked?: boolean;
  personalMapLockedAt?: string | null;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role?: "teacher" | "student";
  groupId?: string | null;
  groupName?: string | null;
  groupIcon?: string | null;
  isGroupLeader?: boolean;
  groupMembers?: GroupMember[];
};

export type GroupPersonalMap = Record<string, MapChoice>;

export type RealtimeCardPackLockSignal = {
  nonce: number;
  groupId: string | null;
  lock: {
    selectedCardIds: string[];
    lockedAt: string;
  } | null;
} | null;

export type RegionDecision = {
  result: MapChoice | "";
  locked: boolean;
  isTie: boolean;
  conserveCount: number;
  developCount: number;
  finalChoice?: MapChoice;
};

export type RegionDecisionValue = RegionDecision | MapChoice | "";
export type RegionDecisionMap = Record<string, RegionDecisionValue>;

export type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

export type SuspectVotingStatus = {
  isOpen: boolean;
  isFinalized: boolean;
  finalizedSuspects?: Array<{
    roleId?: string;
    roleName?: string;
    groupId: string;
    groupName: string;
    count: number;
  }>;
  finalizedAt?: string | null;
  totals: Record<string, number>;
  totalVoters: number;
  totalEligibleVoters: number;
  myVotes: string[];
};

export function getMapDecisionChoice(decision?: RegionDecisionValue): MapChoice | "" {
  if (
    decision === "保育" ||
    decision === "開發" ||
    decision === "我不知道" ||
    decision === ""
  ) {
    return decision;
  }

  return decision?.finalChoice || decision?.result || "";
}
