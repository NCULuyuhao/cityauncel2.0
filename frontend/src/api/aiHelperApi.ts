import { authHeaders, requestJson } from "./apiClient";

export type AiNeedType = "direction" | "reason" | "relation" | "clarity" | "gap";
export type AiNeedCategory = "dialogue" | "check" | "suggestion";
export type AiContextPayload = Record<string, unknown>;

export type AiHelperStatusResponse = {
  unlocked?: boolean;
  coins?: number;
  message?: string;
};

export type AiHelperUnlockResponse = {
  unlocked?: boolean;
  coins?: number;
  message?: string;
};

export type AiChatResponse = {
  reply?: string;
  source?: string;
  isFallback?: boolean;
  message?: string;
};

export type AiHelperEventPayload = {
  scope: string;
  roundKey: string;
  sessionId: string;
  needType?: AiNeedType | null;
  helpCategory?: AiNeedCategory;
  actionType: string;
  requestText?: string;
  responseText?: string;
  responseSource?: string;
  gapScope?: unknown;
  helpCredits?: number;
  turnsInHelp?: number;
  checksInHelp?: number;
  context?: AiContextPayload;
};

export type AiChatPayload = {
  message: string;
  needType: AiNeedType;
  context: AiContextPayload;
  scope: string;
  roundKey: string;
  sessionId: string;
  helpCredits: number;
  turnsInHelp: number;
  checksInHelp: number;
};

export function getAiHelperStatus(token: string, scope: string, roundKey: string) {
  const params = new URLSearchParams({ scope, roundKey });
  return requestJson<AiHelperStatusResponse>(`/api/ai-helper/status?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function unlockAiHelperPack(
  token: string,
  payload: {
    scope: string;
    roundKey: string;
    sessionId: string;
    forceCharge?: boolean;
  },
) {
  return requestJson<AiHelperUnlockResponse>("/api/ai-helper/unlock", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function recordAiHelperEvent(token: string, payload: AiHelperEventPayload) {
  return requestJson<{ ok?: boolean }>("/api/ai-helper/records/event", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function sendAiChat(token: string, payload: AiChatPayload) {
  return requestJson<AiChatResponse>("/api/ai/chat", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
