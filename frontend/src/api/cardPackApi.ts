import { authHeaders, requestJson } from "./apiClient";

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
  return requestJson<GroupCardPackLockResponse>("/api/group-card-pack-lock", {
    headers: { Authorization: `Bearer ${token}` },
    cache: options.cache,
  });
}

export function saveGroupCardPackLock(
  token: string,
  payload: { selectedCardIds: string[]; reason: string },
) {
  return requestJson<GroupCardPackLockResponse>("/api/group-card-pack-lock", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
