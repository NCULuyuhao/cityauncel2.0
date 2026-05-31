/**
 * CityAuncel maintainability notes
 * 檔案用途：瀏覽器 storage 安全存取工具，統一處理 JSON parse 失敗與無 storage 環境。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readStorageString(key: string) {
  try {
    return getLocalStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorageString(key: string, value: string) {
  try {
    getLocalStorage()?.setItem(key, value);
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

export function removeStorageItem(key: string) {
  try {
    getLocalStorage()?.removeItem(key);
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

export function readStorageJson<T>(key: string, fallback: T): T {
  const raw = readStorageString(key);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson<T>(key: string, value: T) {
  writeStorageString(key, JSON.stringify(value));
}
