import { authHeaders, requestJson } from "./apiClient";

export type BarrageDto = {
  id: number;
  userId: number;
  username?: string | null;
  content: string;
  createdAt?: string;
};

export function getBarrageStatus(token: string) {
  return requestJson<{ coins?: number; message?: string }>("/api/barrage-status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getLatestBarrageId(token: string) {
  return requestJson<{ latestId?: number; message?: string }>("/api/barrages/latest-id", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getBarragesAfter(token: string, afterId: number) {
  return requestJson<{ barrages?: BarrageDto[]; message?: string }>(`/api/barrages?afterId=${encodeURIComponent(String(afterId))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function sendBarrageMessage(token: string, content: string) {
  return requestJson<{ barrage?: BarrageDto; coins?: number; message?: string }>("/api/barrages", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ content }),
  });
}
