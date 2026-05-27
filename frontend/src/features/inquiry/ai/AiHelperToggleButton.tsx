/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 AiHelperToggleButton，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { Bot, CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type AiHelperToggleButtonProps = {
  isOpen: boolean;
  isUnlocked: boolean;
  helpCredits: number;
  onClick: () => void;
};

export function AiHelperToggleButton({
  isOpen,
  isUnlocked,
  helpCredits,
  onClick,
}: AiHelperToggleButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      className="group flex items-center gap-2 rounded-full border-2 border-[#f3d68d] bg-gradient-to-br from-[#6f4d25] to-[#3f2e1c] px-4 py-3 text-sm font-black tracking-[0.08em] text-white shadow-[0_14px_38px_rgba(61,44,22,0.32)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#ffe39a] text-[#4a3217] shadow-inner">
        <Bot size={20} />
      </span>
      <span className="leading-tight">
        {isOpen ? "收起幫幫忙" : "AI 幫幫忙"}
      </span>
      {isUnlocked && helpCredits > 0 ? (
        <CheckCircle2 size={16} className="text-[#9ef0b2]" />
      ) : (
        <Sparkles size={16} className="text-[#ffe39a]" />
      )}
    </motion.button>
  );
}
