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
