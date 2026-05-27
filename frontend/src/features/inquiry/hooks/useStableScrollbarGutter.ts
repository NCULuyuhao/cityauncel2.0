/**
 * CityAuncel maintainability notes
 * 檔案用途：探究流程 hook useStableScrollbarGutter，封裝草稿、前導任務、送出流程或畫面穩定化邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect } from "react";

export function useStableScrollbarGutter() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
    const previousBodyScrollbarGutter = body.style.scrollbarGutter;

    html.style.scrollbarGutter = "stable";
    body.style.scrollbarGutter = "stable";

    return () => {
      html.style.scrollbarGutter = previousHtmlScrollbarGutter;
      body.style.scrollbarGutter = previousBodyScrollbarGutter;
    };
  }, []);
}
