/**
 * CityAuncel maintainability notes
 * 檔案用途：稱號獲得提示元件，用於任務完成後給學生即時回饋。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getMedalStyle,
  type TitleReward,
} from "@/features/home/titleRewardModel";

export function MedalStars({
  stars,
  className = "",
  variant = "small",
}: {
  stars: string;
  className?: string;
  variant?: "small" | "large";
}) {
  const cleanStars = stars.replace(/\s/g, "");
  const starCount = Math.max(1, cleanStars.length);
  const starSymbol = cleanStars[0] || "★";

  if (starCount >= 3) {
    const wrapperClass =
      variant === "large"
        ? "text-[2.15rem] leading-[0.86] gap-0.5"
        : "text-[10px] leading-[0.82] gap-[1px]";
    const bottomClass =
      variant === "large" ? "gap-2 -mt-0.5" : "gap-1 -mt-[1px]";

    return (
      <span
        className={`inline-flex flex-col items-center justify-center ${wrapperClass} ${className}`}
        aria-label={stars}
      >
        <span>{starSymbol}</span>
        <span
          className={`inline-flex items-center justify-center ${bottomClass}`}
        >
          <span>{starSymbol}</span>
          <span>{starSymbol}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      aria-label={stars}
    >
      {cleanStars}
    </span>
  );
}

export function TitleRewardToast({ title }: { title: TitleReward }) {
  const style = getMedalStyle(title);
  const [exitTarget, setExitTarget] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const target = document.querySelector(`[data-title-id="${title.id}"]`);
    if (!(target instanceof HTMLElement)) return;

    const rect = target.getBoundingClientRect();
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;

    const timer = window.setTimeout(() => {
      setExitTarget({
        x: targetCenterX - window.innerWidth / 2,
        y: targetCenterY - window.innerHeight / 2,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [title.id]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/35 p-6 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <motion.div
        initial={{ scale: 0.45, y: 42, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, y: 0, x: 0, opacity: 1, rotate: 0 }}
        exit={{
          scale: 0.08,
          x: exitTarget.x,
          y: exitTarget.y,
          opacity: 0,
          rotate: 0,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className={`relative w-full max-w-[340px] overflow-hidden rounded-[34px] border ${style.border} bg-[#fffaf0] p-6 text-center ${style.glow}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.95),transparent_45%)]" />
        <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-white/45 blur-2xl" />
        <div className="absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl" />

        <motion.div
          className="absolute left-5 top-5 text-2xl"
          initial={{ scale: 0, rotate: -45, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          ✦
        </motion.div>
        <motion.div
          className="absolute right-6 top-8 text-xl"
          initial={{ scale: 0, rotate: 45, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          ✦
        </motion.div>

        <motion.div
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{
            delay: 0.15,
            type: "spring",
            stiffness: 260,
            damping: 14,
          }}
          className={`relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border-[5px] ${style.border} bg-gradient-to-br ${style.metal} text-5xl shadow-[inset_0_5px_12px_rgba(255,255,255,0.75),inset_0_-12px_16px_rgba(0,0,0,0.16),0_18px_30px_rgba(45,41,34,0.22)]`}
        >
          <div className="absolute inset-3 rounded-full border border-white/60" />
          <motion.span
            className={`flex h-full w-full items-center justify-center ${style.starText}`}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <MedalStars stars={style.star} variant="large" />
          </motion.span>
        </motion.div>

        <h3 className="relative font-serif text-3xl font-bold tracking-[0.08em] text-[#332c24]">
          {title.name}
        </h3>

        <p className="relative mt-2 text-sm font-semibold text-[#746855]">
          {title.description}
        </p>

        <p
          className={`relative mt-4 text-xs font-black tracking-[0.22em] ${style.text}`}
        >
          {style.star}
        </p>
      </motion.div>
    </motion.div>
  );
}
