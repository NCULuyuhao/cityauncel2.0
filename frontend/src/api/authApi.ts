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
