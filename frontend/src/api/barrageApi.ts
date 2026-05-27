/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 barrageApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

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
