/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 realtime API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：SSE 必須避免瀏覽器原生 EventSource 在失敗時高速自動重連，
 * 因此這裡使用「受控重連 + 退避延遲」，防止 localhost 或教室網路不穩時出現連線風暴。
 */

import { apiUrl } from "./apiClient";

export type RealtimeEvent = {
  type: string;
  payload?: unknown;
  sentAt?: string;
};

export type RealtimeConnectionStatus = "connecting" | "open" | "error";

type RealtimeSubscriptionOptions = {
  /**
   * 測試或極端環境可調整；一般使用預設值即可。
   */
  initialRetryMs?: number;
  maxRetryMs?: number;
};

const DEFAULT_INITIAL_RETRY_MS = 1200;
const DEFAULT_MAX_RETRY_MS = 15000;

function withJitter(delayMs: number) {
  const jitterRatio = 0.25;
  const jitter = delayMs * jitterRatio * Math.random();
  return Math.round(delayMs + jitter);
}

export function subscribeRealtime(
  token: string | null | undefined,
  onEvent: (event: RealtimeEvent) => void,
  onConnectionStatus?: (status: RealtimeConnectionStatus) => void,
  options: RealtimeSubscriptionOptions = {},
): () => void {
  if (!token || typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => undefined;
  }

  const initialRetryMs = options.initialRetryMs ?? DEFAULT_INITIAL_RETRY_MS;
  const maxRetryMs = options.maxRetryMs ?? DEFAULT_MAX_RETRY_MS;
  const url = `${apiUrl("/api/events")}?token=${encodeURIComponent(token)}`;

  let source: EventSource | null = null;
  let retryTimer: number | null = null;
  let stopped = false;
  let retryMs = initialRetryMs;
  let hasOpenedOnce = false;

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const closeSource = () => {
    if (!source) return;
    source.onopen = null;
    source.onmessage = null;
    source.onerror = null;
    source.close();
    source = null;
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer !== null) return;
    const delay = withJitter(retryMs);
    retryMs = Math.min(Math.round(retryMs * 1.6), maxRetryMs);
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  function connect() {
    if (stopped) return;
    closeSource();
    onConnectionStatus?.(hasOpenedOnce ? "error" : "connecting");

    try {
      const nextSource = new EventSource(url);
      source = nextSource;

      nextSource.onopen = () => {
        if (stopped || source !== nextSource) return;
        hasOpenedOnce = true;
        retryMs = initialRetryMs;
        onConnectionStatus?.("open");
      };

      nextSource.onmessage = (message) => {
        if (stopped || source !== nextSource) return;
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event.type !== "connected") onEvent(event);
        } catch (error) {
          console.warn("即時同步訊息解析失敗：", error);
        }
      };

      nextSource.onerror = () => {
        if (stopped || source !== nextSource) return;
        // 不使用 EventSource 內建高速自動重連；手動 close 後用退避延遲重連，
        // 避免後端暫時不可用時 console 一直刷 net::ERR_ADDRESS_IN_USE。
        closeSource();
        onConnectionStatus?.("error");
        scheduleReconnect();
      };
    } catch {
      onConnectionStatus?.("error");
      scheduleReconnect();
    }
  }

  connect();

  return () => {
    stopped = true;
    clearRetryTimer();
    closeSource();
  };
}
