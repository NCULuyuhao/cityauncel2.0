/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 API 共用工具，負責 base URL、授權 header、媒體路徑與 JSON 請求處理。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// 後端保存的 /uploads 相對路徑會在這裡轉成完整可顯示網址。
export function mediaUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const value = url.trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return apiUrl(value);
  return value;
}

export function persistableMediaPath(url: unknown): string {
  if (typeof url !== "string") return "";
  const value = url.trim();
  if (!value || value.startsWith("data:image/") || value.startsWith("blob:")) return "";
  if (value.startsWith("/uploads/")) return value;

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/uploads/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Non-URL values such as /card/*.webp should be preserved as-is.
  }

  return value;
}

// 所有前端 API 請求共用逾時、錯誤訊息與 JSON 解析規則。
export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      signal: options.signal ?? controller.signal,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data as { message?: string })?.message || "伺服器操作失敗");
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("伺服器回應逾時，請稍後再試", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
