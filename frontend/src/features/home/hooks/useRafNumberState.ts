/**
 * CityAuncel maintainability notes
 * 檔案用途：requestAnimationFrame 數值狀態 hook，用於進度條等需要平滑更新的 UI。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps fast pointer-move updates from forcing React to render more than once
 * per animation frame. Useful for drag offsets and other visual-only numbers.
 */
export function useRafNumberState(initialValue = 0) {
  const [value, setValue] = useState(initialValue);
  const latestValueRef = useRef(initialValue);
  const frameRef = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current === null || typeof window === "undefined") return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setNow = useCallback(
    (nextValue: number) => {
      latestValueRef.current = nextValue;
      cancelFrame();
      setValue(nextValue);
    },
    [cancelFrame],
  );

  const schedule = useCallback(
    (nextValue: number) => {
      latestValueRef.current = nextValue;

      if (typeof window === "undefined") {
        setValue(nextValue);
        return;
      }

      if (frameRef.current !== null) return;

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setValue(latestValueRef.current);
      });
    },
    [],
  );

  useEffect(() => cancelFrame, [cancelFrame]);

  return [value, schedule, setNow] as const;
}
