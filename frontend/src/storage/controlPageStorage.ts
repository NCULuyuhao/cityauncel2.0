const TEACHER_GROUPS_STORAGE_KEY = "miaoli-teacher-groups-v1";
const HOME_DRAFT_PREFIX = "cityauncel_home_draft_";
const INQUIRY_DRAFT_PREFIX = "cityauncel_inquiry_draft_";
const BARRAGE_DRAFT_KEY = "cityauncel_barrage_text_draft";

export function clearControlPageBrowserDrafts() {
  if (typeof window === "undefined") return;

  const removablePrefixes = [
    HOME_DRAFT_PREFIX,
    INQUIRY_DRAFT_PREFIX,
    TEACHER_GROUPS_STORAGE_KEY,
  ];

  Object.keys(window.localStorage).forEach((key) => {
    if (removablePrefixes.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  });

  window.sessionStorage.removeItem(BARRAGE_DRAFT_KEY);
}

export function readTeacherGroupsDraft<T>() {
  if (typeof window === "undefined") return [] as T[];

  try {
    const saved = window.localStorage.getItem(TEACHER_GROUPS_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as T[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as T[];
  }
}

export function saveTeacherGroupsDraft<T>(players: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEACHER_GROUPS_STORAGE_KEY, JSON.stringify(players));
}

export function removeTeacherGroupsDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TEACHER_GROUPS_STORAGE_KEY);
}
