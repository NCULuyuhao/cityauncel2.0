/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 AiHelperCoinPrompt，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { Coins } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type AiHelperCoinPromptProps = {
  coins: number;
  statusMessage: string;
  isCoinDropping: boolean;
  onCancel: () => void;
  onUnlock: () => void;
};

export function AiHelperCoinPrompt({
  coins,
  statusMessage,
  isCoinDropping,
  onCancel,
  onUnlock,
}: AiHelperCoinPromptProps) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-6 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(252,211,77,0.24),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(125,211,252,0.20),transparent_34%)]" />
      <div className="relative w-full max-w-[310px] rounded-[28px] border border-[#e4c27e] bg-white/86 p-5 shadow-[0_18px_50px_rgba(72,48,18,0.18)]">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[30px] border-4 border-[#76542a] bg-[#fff1ba] shadow-inner">
          <div className="relative h-14 w-14 rounded-2xl bg-[#5c4631] shadow-inner">
            <div className="absolute left-1/2 top-2 h-2 w-10 -translate-x-1/2 rounded-full bg-[#1f1710]" />
            <AnimatePresence>
              {isCoinDropping ? (
                <motion.div
                  initial={{ y: -84, opacity: 0, rotate: -20 }}
                  animate={{ y: 4, opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: "easeIn" }}
                  className="absolute left-1/2 top-0 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-[#c5891f] bg-[#ffd35b] text-lg shadow-lg"
                >
                  🪙
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        <p className="text-xs font-black tracking-[0.18em] text-[#8a622f]">
          AI HELPER MACHINE
        </p>
        <h3 className="mt-2 text-2xl font-black text-[#3d2b19]">
          請投 1 枚硬幣
        </h3>
        <p className="mt-2 text-sm font-bold leading-6 text-[#6b5a42]">
          1 coin 可換 2 張 AI 幫助券。
        </p>
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#fff1ba] px-3 py-1 text-sm font-black text-[#6a4b20]">
          <Coins size={16} /> 目前 coin：{coins}
        </p>
        
        {statusMessage ? (
          <p className="mt-3 text-xs font-black text-red-700">
            {statusMessage}
          </p>
        ) : null}
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCoinDropping}
            className="rounded-full border border-[#d8c39a] bg-white px-5 py-2 text-sm font-black text-[#7a6754] transition hover:bg-[#fff7ea] disabled:opacity-60"
          >
            不要
          </button>
          <button
            type="button"
            onClick={onUnlock}
            disabled={isCoinDropping || coins < 1}
            className="rounded-full bg-[#6f4d25] px-5 py-2 text-sm font-black text-white shadow-[0_7px_0_rgba(61,42,18,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
          >
            {isCoinDropping ? "投幣中" : "好，投幣"}
          </button>
        </div>
      </div>
    </div>
  );
}
