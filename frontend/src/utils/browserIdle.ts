/**
 * Browser idle scheduling helper.
 * 使用 requestIdleCallback（若瀏覽器支援）延後非即時工作，例如草稿儲存與圖片預載。
 */

type BrowserIdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function runWhenBrowserIsIdle(callback: () => void, timeout = 240) {
  if (typeof window === "undefined") return () => undefined;

  const browserWindow = window as BrowserIdleWindow;
  let didCancel = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let idleId: number | null = null;

  const run = () => {
    if (!didCancel) callback();
  };

  if (typeof browserWindow.requestIdleCallback === "function") {
    idleId = browserWindow.requestIdleCallback(run, { timeout });
  } else {
    timeoutId = globalThis.setTimeout(run, timeout);
  }

  return () => {
    didCancel = true;
    if (
      idleId !== null &&
      typeof browserWindow.cancelIdleCallback === "function"
    ) {
      browserWindow.cancelIdleCallback(idleId);
    }
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  };
}
