export type HomePageDraft = {
  version: 2;
  savedAt: number;
  orientationMainChoice: string;
  orientationTextInput: string;
};

function getHomePageDraftKey(userId?: number | null) {
  return userId ? `cityauncel_home_draft_${userId}` : "";
}

export function readHomePageDraft(userId?: number | null): HomePageDraft | null {
  if (typeof window === "undefined") return null;

  const key = getHomePageDraftKey(userId);
  if (!key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HomePageDraft> & Record<string, unknown>;
    // v1 曾經把正式進度也放進 localStorage，會造成清空資料表後稱號/地圖/卡牌又被舊快取還原。
    // 從 v2 開始只保留尚未送出的前導輸入草稿，正式進度永遠以資料庫為準。
    if (parsed.version !== 2) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      version: 2,
      savedAt: Number(parsed.savedAt) || Date.now(),
      orientationMainChoice: String(parsed.orientationMainChoice ?? ""),
      orientationTextInput: String(parsed.orientationTextInput ?? ""),
    };
  } catch (error) {
    console.error("讀取首頁暫存資料失敗", error);
    return null;
  }
}

export function saveHomePageDraft(userId: number | null | undefined, draft: Omit<HomePageDraft, "version" | "savedAt">) {
  if (typeof window === "undefined") return;

  const key = getHomePageDraftKey(userId);
  if (!key) return;

  try {
    const nextDraft: HomePageDraft = {
      version: 2,
      savedAt: Date.now(),
      ...draft,
    };
    window.localStorage.setItem(key, JSON.stringify(nextDraft));
  } catch (error) {
    console.error("儲存首頁暫存資料失敗", error);
  }
}

export function clearHomeProgressCache() {
  if (typeof window === "undefined") return;

  ["cityauncel_home_draft_", "cityauncel_inquiry_draft_"].forEach((prefix) => {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    });
  });
}
