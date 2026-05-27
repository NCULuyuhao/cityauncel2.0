/**
 * CityAuncel maintainability notes
 * 檔案用途：前端暫存工具 aiHelperStorage，集中處理 localStorage 讀寫與資料格式保護。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

export type AiHelperStoredUsageState<TNeed extends string = string> = {
  helpCredits: number;
  turnsInCurrentHelp: number;
  checksInCurrentHelp: number;
  selectedNeed: TNeed | null;
  helpEnded: boolean;
  goodbye: boolean;
  gapScope?: "round" | "overall" | null;
  messages?: Array<{
    id: string;
    role: "student" | "ai";
    text: string;
    needType?: TNeed;
    source?: "ai" | "fallback" | "system";
  }>;
};

export function readAiHelperUsage<TNeed extends string>(
  storageKey: string,
  parse: (raw: string | null) => AiHelperStoredUsageState<TNeed> | null,
) {
  if (typeof window === "undefined") return null;
  return parse(window.localStorage.getItem(storageKey));
}

export function saveAiHelperUsage<TNeed extends string>(
  storageKey: string,
  value: AiHelperStoredUsageState<TNeed>,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

export function removeAiHelperUsage(storageKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}
