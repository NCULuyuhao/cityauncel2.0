import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { TitleReward } from "@/features/inquiry/cards/cardPresentation";
import {
  TitleBadgeCard,
  TitleMedalStars,
} from "@/features/inquiry/titleRewards/titleRewardUi";
import { getTitleMedalStyle } from "@/features/inquiry/titleRewards/titleRewardStyles";

export function TrophyPanel({
  titles,
  hasNewTitle,
  onOpenPanel,
}: {
  titles: TitleReward[];
  hasNewTitle: boolean;
  onOpenPanel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleTogglePanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpenPanel();
      return next;
    });
  };
  const floatingMedalStyle = getTitleMedalStyle(
    titles[titles.length - 1]?.id ?? "cross_novice",
  );

  return (
    <div
      ref={containerRef}
      className="fixed bottom-5 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-5 md:bottom-6 md:right-6"
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="flex max-h-[min(520px,74svh)] w-[min(300px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.12)] flex-col sm:p-4"
          >
            <div className="mb-2 flex items-center gap-3">
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] ${floatingMedalStyle.border} bg-gradient-to-br ${floatingMedalStyle.metal} shadow-[inset_0_2px_6px_rgba(255,255,255,0.72),inset_0_-5px_8px_rgba(0,0,0,0.14)]`}
              >
                <TitleMedalStars
                  stars={floatingMedalStyle.stars}
                  className={floatingMedalStyle.starText}
                />
              </div>
              <div>
                <p className="system-major-title text-base font-black uppercase tracking-[0.24em] text-amber-600 sm:text-lg sm:tracking-[0.28em]">
                  稱號收藏
                </p>
              </div>
            </div>

            {titles.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
                {titles.map((title) => (
                  <TitleBadgeCard key={title.id} title={title} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                尚未獲得稱號
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        animate={
          hasNewTitle && !open
            ? {
                scale: [1, 1.06, 1],
                boxShadow: [
                  "0 10px 24px rgba(15,23,42,0.14)",
                  "0 0 0 6px rgba(251,191,36,0.12), 0 0 20px rgba(251,191,36,0.18)",
                  "0 10px 24px rgba(15,23,42,0.14)",
                ],
              }
            : {
                scale: 1,
                boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
              }
        }
        transition={
          hasNewTitle && !open
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        onClick={handleTogglePanel}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-[4px] ${floatingMedalStyle.border} bg-gradient-to-br ${floatingMedalStyle.metal} text-amber-800 shadow-[inset_0_4px_10px_rgba(255,255,255,0.75),inset_0_-10px_14px_rgba(0,0,0,0.16)]`}
      >
        <div className="absolute inset-2 rounded-full border border-white/60" />
        <div
          className={`absolute inset-[15px] rounded-full border border-white/70 bg-gradient-to-br ${floatingMedalStyle.shine}`}
        />
        {hasNewTitle && !open ? (
          <motion.span
            className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-500"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        {open ? (
          <ChevronDown className="relative z-10 h-6 w-6 text-white drop-shadow" />
        ) : (
          <TitleMedalStars
            stars={floatingMedalStyle.stars}
            variant="small"
            className={`relative z-10 text-xl ${floatingMedalStyle.starText}`}
          />
        )}
      </motion.button>
    </div>
  );
}
