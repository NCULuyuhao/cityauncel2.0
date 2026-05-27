import { authHeaders, requestJson } from "./apiClient";

type CachedApiResponse<T = unknown> = {
  value: T;
  savedAt: number;
};

type CacheFirstOptions = {
  cacheKey?: string;
  revalidate?: boolean;
};

const CACHE_PREFIX = "cityauncel_api_cache_v1:";

function currentCacheOwnerKey() {
  if (typeof window === "undefined") return "guest";

  try {
    const raw = window.localStorage.getItem("cityauncel_user");
    if (!raw) return "guest";
    const user = JSON.parse(raw) as Record<string, unknown>;
    return String(user.id ?? user.username ?? user.email ?? "guest");
  } catch {
    return "guest";
  }
}

function storageKey(key: string) {
  return `${CACHE_PREFIX}${currentCacheOwnerKey()}:${key}`;
}

export function readApiCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedApiResponse<T>;
    return parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeApiCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey(key),
      JSON.stringify({ value, savedAt: Date.now() } satisfies CachedApiResponse<T>),
    );
  } catch {
    // Cache writes are best effort; the live request result remains authoritative.
  }
}

export function removeApiCache(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // Cache removal is best effort.
  }
}

export function clearApiCacheForCurrentUser() {
  if (typeof window === "undefined") return;
  const prefix = `${CACHE_PREFIX}${currentCacheOwnerKey()}:`;

  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    });
  } catch {
    // Cache cleanup is best effort.
  }
}

export async function requestJsonCacheFirst<T>(
  token: string,
  path: string,
  options: RequestInit = {},
  cacheOptions: CacheFirstOptions = {},
): Promise<T> {
  const key = cacheOptions.cacheKey ?? path;
  const cached = readApiCache<T>(key);
  const requestOptions = {
    ...options,
    headers: options.headers ?? authHeaders(token),
  };

  const fetchFresh = async () => {
    const fresh = await requestJson<T>(path, requestOptions);
    writeApiCache(key, fresh);
    return fresh;
  };

  if (cached !== null) {
    if (cacheOptions.revalidate !== false) {
      void fetchFresh().catch(() => undefined);
    }
    return cached;
  }

  return fetchFresh();
}
