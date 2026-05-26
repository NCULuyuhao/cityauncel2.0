import { requestJson } from "./apiClient";

export function getTeacherLearningDashboard<TDashboard = unknown>(token?: string) {
  return requestJson<TDashboard>("/api/teacher/learning-dashboard", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
