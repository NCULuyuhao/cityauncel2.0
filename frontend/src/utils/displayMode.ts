/**
 * CityAuncel maintainability notes
 * 檔案用途：前端工具函式 displayMode，提供跨功能重用的資料轉換或環境判斷。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function isAppleTouchDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const navigatorWithStandalone = navigator as NavigatorWithStandalone;

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

export function shouldUseCssImmersiveMode() {
  return isAppleTouchDevice() || isStandaloneDisplayMode();
}

export function canUseBrowserFullscreen() {
  if (typeof document === "undefined") return false;
  return Boolean(document.documentElement.requestFullscreen);
}
