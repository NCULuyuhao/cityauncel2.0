/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 authApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { requestJson } from "./apiClient";

export type LoginPayload = {
  account: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  password: string;
  gender: "male" | "female";
};

export type AuthResponse<TUser = unknown> = {
  token?: string;
  user?: TUser;
  message?: string;
};

export function login<TUser = unknown>(payload: LoginPayload, signal?: AbortSignal) {
  return requestJson<AuthResponse<TUser>>("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

export function register<TUser = unknown>(payload: RegisterPayload, signal?: AbortSignal) {
  return requestJson<AuthResponse<TUser>>("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}
