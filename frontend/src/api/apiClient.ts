/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 API 基礎工具，集中處理 API base URL、授權 header、媒體網址、timeout 與錯誤物件。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

// 所有 API 都從同一個 base URL 出發；部署到 Vercel 時只要改 VITE_API_BASE_URL，不需要逐檔改網址。
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

// 後端上傳檔會以 /uploads/... 保存；畫面顯示時才補成完整後端網址。
export function mediaUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const value = url.trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/uploads/")) return apiUrl(value);
  return value;
}

// 寫回資料庫時只保存可攜的相對路徑，避免把 localhost 或部署網域硬寫進資料。
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

export class ApiRequestError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

// 統一 timeout、JSON 解析與錯誤格式，讓頁面可以用同一種方式處理 API 失敗。
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
      throw new ApiRequestError((data as { message?: string })?.message || "Request failed", res.status, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
