/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 teacherDashboardApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { requestJson } from "./apiClient";

export function getTeacherLearningDashboard<TDashboard = unknown>(token?: string) {
  return requestJson<TDashboard>("/api/teacher/learning-dashboard", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function getTeacherResearchAnalytics<TDashboard = unknown>(token?: string) {
  return requestJson<TDashboard>("/api/teacher/research-analytics", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
