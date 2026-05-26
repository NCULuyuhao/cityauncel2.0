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
