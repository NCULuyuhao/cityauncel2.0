/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 AiHelperNeedOptionPanel，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { Coins } from "lucide-react";
import { motion } from "framer-motion";
import type { AiNeedCategory, AiNeedType } from "./aiHelperTypes";

type NeedOption = {
  type: AiNeedType;
  title: string;
  desc: string;
  icon: string;
  category: AiNeedCategory;
};

type NeedOptionGroup = {
  label: string;
  options: NeedOption[];
};

type AiHelperNeedOptionPanelProps = {
  groupedNeedOptions: NeedOptionGroup[];
  helpCredits: number;
  coins: number;
  statusMessage: string;
  blockedNeed: AiNeedType | null;
  onChooseNeed: (needType: AiNeedType) => void;
  onRenew: () => void;
  isRenewing: boolean;
};

export function AiHelperNeedOptionPanel({
  groupedNeedOptions,
  helpCredits,
  coins,
  statusMessage,
  blockedNeed,
  onChooseNeed,
  onRenew,
  isRenewing,
}: AiHelperNeedOptionPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4 rounded-[24px] border border-[#ead6aa] bg-white/75 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#3d2b19]">
              請在下方清單選擇你最需要的幫助
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#7a6754]">
              剩餘 {helpCredits} 張 AI 幫助券
            </p>
          </div>
          <p className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff1ba] px-3 py-1 text-xs font-black text-[#6a4b20]">
            <Coins size={14} /> {coins}
          </p>
        </div>
        {statusMessage ? (
          <p className="mt-2 text-xs font-black text-red-700">
            {statusMessage}
          </p>
        ) : null}
      </div>

      {helpCredits <= 0 ? (
        <div className="mb-4 rounded-[24px] border border-[#e5c37d] bg-white/86 p-4 text-center shadow-sm">
          <p className="text-sm font-black text-[#3d2b19]">
            AI 幫助券已用完
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-[#7a6754]">
            目前只能閱覽先前紀錄。要開始新的幫助，需要再投 1 coin 續費。
          </p>
          <button
            type="button"
            onClick={onRenew}
            disabled={isRenewing || coins < 1}
            className="mt-3 rounded-full bg-[#6f4d25] px-5 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {isRenewing ? "檢查中" : coins < 1 ? "coin 不足" : "投 1 coin 續費"}
          </button>
        </div>
      ) : null}

      <div className="grid gap-3">
        {groupedNeedOptions.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="px-1 text-[11px] font-black tracking-[0.16em] text-[#8a622f]">
              {group.label}
            </p>
            {group.options.map((option) => (
              <motion.button
                key={option.type}
                type="button"
                onClick={() => onChooseNeed(option.type)}
                disabled={helpCredits <= 0}
                animate={
                  blockedNeed === option.type ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }
                }
                transition={{ duration: 0.42 }}
                className="group flex w-full items-center gap-3 rounded-[20px] border border-[#e5d2ad] bg-white/84 p-3 text-left shadow-[0_10px_24px_rgba(72,48,18,0.08)] transition hover:-translate-y-0.5 hover:border-[#c99d49] hover:bg-[#fff7dc] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0ba] text-xl shadow-inner">
                  {option.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-[#3d2b19]">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold leading-5 text-[#7a6754]">
                    {option.desc}
                  </span>
                </span>
              </motion.button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
