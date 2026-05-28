import {
  readStorageJson,
  readStorageString,
  removeStorageItem,
  writeStorageJson,
  writeStorageString,
} from "@/storage/browserStorage";

export type Page =
  | "home"
  | "cards"
  | "cardPack"
  | "map"
  | "ending"
  | "teacherGroups"
  | "teacherStudentData";

const RESTORABLE_PAGES = new Set<Page>([
  "home",
  "cards",
  "cardPack",
  "map",
  "ending",
  "teacherGroups",
  "teacherStudentData",
]);

export type MapChoice = "保育" | "開發" | "我不知道";
export type MapState = Record<string, MapChoice>;

export type HomeUiState = {
  activeInquiryRecordOrder?: number | null;
  reportPageIndex?: number;
  mapPreviewPageIndex?: number;
  openedReportIndex?: number | null;
};

function pageStorageKey(userId?: string | number | null) {
  return `cityauncel_current_page_${userId || "guest"}`;
}

function homeUiStorageKey(userId?: string | number | null) {
  return `cityauncel_home_ui_${userId || "guest"}`;
}

function isRestorablePage(value: unknown): value is Page {
  return typeof value === "string" && RESTORABLE_PAGES.has(value as Page);
}

export function readStoredPage(userId?: string | number | null): Page {
  const value = readStorageString(pageStorageKey(userId));
  return isRestorablePage(value) ? value : "home";
}

export function saveStoredPage(
  userId: string | number | null | undefined,
  page: Page,
) {
  writeStorageString(pageStorageKey(userId), page);
}

export function clearStoredPage(userId?: string | number | null) {
  removeStorageItem(pageStorageKey(userId));
}

export function readHomeUiState(userId?: string | number | null): HomeUiState {
  const parsed = readStorageJson<HomeUiState>(homeUiStorageKey(userId), {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

export function saveHomeUiState(
  userId: string | number | null | undefined,
  state: HomeUiState,
) {
  writeStorageJson(homeUiStorageKey(userId), state);
}

export function clearHomeUiState(userId?: string | number | null) {
  removeStorageItem(homeUiStorageKey(userId));
}

export function stableMapText(map: MapState) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
