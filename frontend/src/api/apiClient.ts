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
