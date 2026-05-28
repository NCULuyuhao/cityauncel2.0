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
