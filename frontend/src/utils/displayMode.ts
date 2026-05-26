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
