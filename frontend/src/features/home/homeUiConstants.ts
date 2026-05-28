export const GAME_BTN =
  "relative overflow-hidden rounded-xl border px-5 py-3 text-sm font-semibold tracking-[0.12em] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]";
export const GAME_BTN_BLUE =
  "border-stone-300 bg-white/85 text-stone-700 hover:border-stone-500 hover:bg-stone-50";
export const GAME_BTN_DISABLED =
  "cursor-not-allowed border-stone-200 bg-stone-100/80 text-stone-400 shadow-none hover:translate-y-0 hover:shadow-none active:scale-100";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
