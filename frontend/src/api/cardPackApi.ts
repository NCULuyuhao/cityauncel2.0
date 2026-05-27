/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 cardPackApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

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
