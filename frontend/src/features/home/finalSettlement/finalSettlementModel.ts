/**
 * CityAuncel maintainability notes
 * 檔案用途：任務二最終決策結算的資料型別與已處理狀態工具。
 * 維護重點：不處理畫面跳轉，只提供結算資料模型與 sessionStorage 讀寫。
 */

export type FinalDecisionCard = {
  cardId: string;
  title: string;
  stance: "利己" | "利他" | "中立";
  score: number;
};

export type FinalDecisionGroup = {
  groupId: string;
  groupName: string;
  selectedCardIds: string[];
  cards: FinalDecisionCard[];
  score: number;
  lockedAt?: string | null;
  reason?: string;
};

export type FinalDecisionOutcome = {
  id: "sustainable" | "partial" | "crisis" | string;
  title: string;
  subtitle: string;
  scoreRange?: string;
};

export type FinalDecisionSettlement = {
  isFinalized: boolean;
  finalizedAt?: string | null;
  totalScore?: number;
  outcome?: FinalDecisionOutcome;
  groups?: FinalDecisionGroup[];
};

export function getFinalSettlementSignature(
  settlement: FinalDecisionSettlement | null | undefined,
) {
  if (!settlement?.isFinalized) return "";
  if (settlement.finalizedAt) return settlement.finalizedAt;

  const groupSignature = (settlement.groups || [])
    .map(
      (group) => `${group.groupId}:${(group.selectedCardIds || []).join(",")}`,
    )
    .join("|");
  return `${settlement.outcome?.id || "unknown"}:${groupSignature}`;
}

function getFinalSettlementHandledStorageKey(userId?: number | string | null) {
  return userId ? `cityauncel_final_settlement_handled_${userId}` : "";
}

export function readHandledFinalSettlementKey(userId?: number | string | null) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

export function writeHandledFinalSettlementKey(
  userId: number | string | null | undefined,
  settlementKey: string,
) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey, settlementKey);
  } catch {
    // sessionStorage 失敗不影響主要流程。
  }
}

export function clearHandledFinalSettlementKey(userId?: number | string | null) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // sessionStorage 失敗不影響主要流程。
  }
}
