/**
 * CityAuncel maintainability notes
 * 檔案用途：數據清單倒數顯示元件，負責呈現剩餘時間與狀態提示。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import {
  DATA_LIST_ONE_MINUTE_MS,
  DATA_LIST_THREE_MINUTE_MS,
  formatCountdownTime,
  type DataListTimerNotice,
} from "./dataListCountdownConfig";

export function DataListCountdownTimer({
  remainingMs,
  notice,
}: {
  remainingMs: number;
  notice: DataListTimerNotice;
}) {
  const isUrgent = remainingMs <= DATA_LIST_ONE_MINUTE_MS;
  const isWarning = remainingMs <= DATA_LIST_THREE_MINUTE_MS;
  const noticeText =
    notice === "three"
      ? "剩餘 3 分鐘，請把重要線索收藏起來"
      : notice === "one"
        ? "剩餘 1 分鐘，準備完成蒐集檢查"
        : notice === "done"
          ? "時間到，進入蒐集檢查站"
          : "";

  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[58] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2">
      <motion.div
        animate={
          isUrgent
            ? {
                scale: [1, 1.035, 1],
                boxShadow: [
                  "0 14px 34px rgba(127,47,47,0.22)",
                  "0 0 0 7px rgba(239,68,68,0.12), 0 18px 42px rgba(127,47,47,0.24)",
                  "0 14px 34px rgba(127,47,47,0.22)",
                ],
              }
            : { scale: 1 }
        }
        transition={
          isUrgent
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        className={`flex h-12 items-center gap-2 rounded-full border px-4 backdrop-blur-xl ${
          isUrgent
            ? "border-red-300 bg-red-50/95 text-red-800 shadow-[0_14px_34px_rgba(127,47,47,0.22)]"
            : isWarning
              ? "border-amber-300 bg-amber-50/95 text-amber-800 shadow-[0_12px_30px_rgba(180,83,9,0.16)]"
              : "border-sky-200 bg-white/92 text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
        }`}
      >
        {isWarning ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 text-sky-600" />
        )}
        <span className="text-xs font-black tracking-[0.16em]">蒐集時間</span>
        <span className="rounded-full bg-white/78 px-3 py-1 font-mono text-lg font-black leading-none tracking-[0.08em]">
          {formatCountdownTime(remainingMs)}
        </span>
      </motion.div>

      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className={`rounded-2xl border px-4 py-2 text-center text-sm font-black shadow-[0_14px_34px_rgba(15,23,42,0.16)] ${
              notice === "one" || notice === "done"
                ? "border-red-200 bg-red-50/96 text-red-800"
                : "border-amber-200 bg-amber-50/96 text-amber-800"
            }`}
          >
            {noticeText}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
