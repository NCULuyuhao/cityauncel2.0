import { useEffect, type MutableRefObject } from "react";
import { saveInquiryDraftJson } from "@/storage/inquiryDraftStorage";

type SaveDraftOptions<TDraft> = {
  storageKey: string | null | undefined;
  buildDraft: () => TDraft;
  buildFallbackDraft?: (draft: TDraft) => TDraft;
  lastSavedJsonRef: MutableRefObject<string | null>;
  delay?: number;
  deps: readonly unknown[];
};

function runWhenBrowserIsIdle(callback: () => void, timeout = 240) {
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    callback();
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(run, { timeout });
    return () => {
      cancelled = true;
      window.cancelIdleCallback(idleId);
    };
  }

  const timeoutId = globalThis.setTimeout(run, timeout);
  return () => {
    cancelled = true;
    globalThis.clearTimeout(timeoutId);
  };
}

export function useInquiryDraftAutosave<TDraft>({
  storageKey,
  buildDraft,
  buildFallbackDraft,
  lastSavedJsonRef,
  delay = 900,
  deps,
}: SaveDraftOptions<TDraft>) {
  useEffect(() => {
    if (!storageKey) return;

    return runWhenBrowserIsIdle(() => {
      const draft = buildDraft();
      const saveResult = saveInquiryDraftJson({
        storageKey,
        draft,
        fallbackDraft: buildFallbackDraft ? buildFallbackDraft(draft) : undefined,
        lastSavedJson: lastSavedJsonRef.current,
      });
      if (saveResult.savedJson) {
        lastSavedJsonRef.current = saveResult.savedJson;
      }
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, delay, lastSavedJsonRef, ...deps]);
}
