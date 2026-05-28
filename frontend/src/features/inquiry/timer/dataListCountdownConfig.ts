export const DATA_LIST_COUNTDOWN_MS = 8 * 60 * 1000;
export const DATA_LIST_THREE_MINUTE_MS = 3 * 60 * 1000;
export const DATA_LIST_ONE_MINUTE_MS = 60 * 1000;

export type DataListTimerNotice = "three" | "one" | "done" | null;

type CountdownDraftSnapshot = {
  currentInquiryOrder?: number | string | null;
  dataListCountdownDeadline?: number | string | null;
  dataListCountdownRemainingMs?: number | string | null;
  dataListCountdownPausedAt?: number | string | null;
};

export function getNavigationType() {
  if (typeof window === "undefined" || !window.performance) return "navigate";

  const navigationEntry = window.performance.getEntriesByType?.("navigation")?.[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navigationEntry?.type) return navigationEntry.type;

  const legacyNavigation = window.performance.navigation;
  if (legacyNavigation?.type === legacyNavigation.TYPE_RELOAD) return "reload";
  if (legacyNavigation?.type === legacyNavigation.TYPE_BACK_FORWARD) {
    return "back_forward";
  }
  return "navigate";
}

export function normalizeCountdownMs(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.min(DATA_LIST_COUNTDOWN_MS, numberValue));
}

export function resolveRestoredDataListCountdown(
  draft: CountdownDraftSnapshot | null,
  currentInquiryOrder: number,
) {
  const draftOrder = Number(draft?.currentInquiryOrder || currentInquiryOrder);
  if (!draft || draftOrder !== Number(currentInquiryOrder)) {
    return { deadline: null as number | null, remainingMs: DATA_LIST_COUNTDOWN_MS };
  }

  const pausedAt = Number(draft.dataListCountdownPausedAt);
  const pausedRemainingMs = normalizeCountdownMs(draft.dataListCountdownRemainingMs);
  const restoredDeadline = Number.isFinite(Number(draft.dataListCountdownDeadline))
    ? Number(draft.dataListCountdownDeadline)
    : null;
  const isReload = getNavigationType() === "reload";

  if (!isReload && Number.isFinite(pausedAt) && pausedRemainingMs !== null) {
    return {
      deadline: Date.now() + pausedRemainingMs,
      remainingMs: pausedRemainingMs,
    };
  }

  if (restoredDeadline !== null) {
    return {
      deadline: restoredDeadline,
      remainingMs: Math.max(0, restoredDeadline - Date.now()),
    };
  }

  return { deadline: null as number | null, remainingMs: DATA_LIST_COUNTDOWN_MS };
}

export function formatCountdownTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
