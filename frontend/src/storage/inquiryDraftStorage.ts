/**
 * CityAuncel maintainability notes
 * 檔案用途：前端暫存工具 inquiryDraftStorage，集中處理 localStorage 讀寫與資料格式保護。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

export function readInquiryDraftJson<TDraft>(storageKey?: string): TDraft | null {
  if (!storageKey || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as TDraft) : null;
  } catch (error) {
    console.error("讀取探究草稿失敗", error);
    return null;
  }
}

export function saveInquiryDraftJson<TDraft>({
  storageKey,
  draft,
  fallbackDraft,
  lastSavedJson,
}: {
  storageKey?: string;
  draft: TDraft;
  fallbackDraft?: TDraft;
  lastSavedJson?: string | null;
}): { savedJson: string | null; skipped: boolean } {
  if (!storageKey || typeof window === "undefined") {
    return { savedJson: null, skipped: true };
  }

  const draftJson = JSON.stringify(draft);
  if (draftJson === lastSavedJson) {
    return { savedJson: draftJson, skipped: true };
  }

  try {
    window.localStorage.setItem(storageKey, draftJson);
    return { savedJson: draftJson, skipped: false };
  } catch (error) {
    console.error("儲存探究草稿失敗", error);

    if (!fallbackDraft) throw error;

    try {
      const fallbackDraftJson = JSON.stringify(fallbackDraft);
      if (fallbackDraftJson === lastSavedJson) {
        return { savedJson: fallbackDraftJson, skipped: true };
      }

      window.localStorage.setItem(storageKey, fallbackDraftJson);
      return { savedJson: fallbackDraftJson, skipped: false };
    } catch (fallbackError) {
      console.error("儲存精簡探究草稿仍失敗", fallbackError);
      return { savedJson: null, skipped: true };
    }
  }
}

export function removeInquiryDraft(storageKey?: string) {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
