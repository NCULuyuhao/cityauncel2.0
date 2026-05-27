/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 realtime API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { apiUrl } from "./apiClient";

export type RealtimeEvent = {
  type: string;
  payload?: unknown;
  sentAt?: string;
};

export function subscribeRealtime(
  token: string | null | undefined,
  onEvent: (event: RealtimeEvent) => void,
): () => void {
  if (!token || typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => undefined;
  }

  const url = `${apiUrl("/api/events")}?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as RealtimeEvent;
      if (event.type !== "connected") onEvent(event);
    } catch (error) {
      console.warn("即時同步訊息解析失敗：", error);
    }
  };

  source.onerror = () => {
    // EventSource 會自動重連；保留少量輪詢作為備援即可。
  };

  return () => source.close();
}
