import { AnimatePresence, motion } from "framer-motion";
import { IntroCountdownButton } from "@/features/inquiry/intro/IntroCountdownButton";
import { InquiryStageTransitionFrame } from "@/features/inquiry/intro/InquiryIntroPages";
import type { InquiryIntroCase } from "@/features/inquiry/intro/inquiryIntroCases";

type InquiryReadyPageProps = {
  currentInquiryOrder: number;
  currentCase: InquiryIntroCase;
  readyMessage: string;
  stageKey: string;
  onBack: () => void;
  onStart: () => void;
};

export function InquiryReadyPage({
  currentInquiryOrder,
  currentCase,
  readyMessage,
  stageKey,
  onBack,
  onStart,
}: InquiryReadyPageProps) {
  return (
    <AnimatePresence mode="wait">
      <InquiryStageTransitionFrame stageKey={stageKey}>
        <div className="game-adventure-page uiux-page-shell inquiry-intro-shell flex min-h-[100svh] items-center justify-center overflow-x-hidden p-4 sm:p-6">
          <motion.div
            layout
            className="inquiry-intro-card w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"
          >
            <p className="text-xl font-black leading-8 text-stone-800">
              {readyMessage}
            </p>
            <div className="mt-5 rounded-3xl border border-[#e1d2b6] bg-[#fff8e8] px-6 py-5 text-center shadow-inner">
              <p className="text-center text-base font-black tracking-[0.14em] text-[#7c5f35]">
                {currentCase.readyNoticeTitle}
              </p>
              <div className="mt-3 space-y-3 text-sm font-bold leading-7 text-stone-700 sm:text-base">
                {currentCase.readyNoticeParagraphs.map((paragraph, index) => (
                  <p key={`${currentCase.id}-ready-notice-${index}`}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            <p className="mt-4 text-xs font-black tracking-[0.12em] text-stone-500">
              請先閱讀注意事項，倒數結束後即可開始任務。
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onBack}
                className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#d9c7a4] bg-gradient-to-br from-white via-[#fff8e8] to-[#f1e1bd] px-5 font-black text-[#6b5634] shadow-[0_8px_0_rgba(161,130,83,0.16),0_14px_28px_rgba(88,67,38,0.12)] transition hover:-translate-y-0.5 hover:border-[#c19a5d] hover:brightness-[1.02] active:translate-y-0 sm:w-40"
              >
                上一頁
              </button>
              <IntroCountdownButton
                resetKey={`ready-${currentInquiryOrder}-${currentCase.id}-${readyMessage}`}
                onClick={onStart}
                className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#9f8768] bg-gradient-to-br from-[#fff1bf] via-[#eacb86] to-[#cfa464] px-5 font-black text-[#3f3023] shadow-[0_8px_0_rgba(112,89,65,0.24),0_16px_30px_rgba(72,52,36,0.18)] transition hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 sm:w-40"
              >
                開始調查
              </IntroCountdownButton>
            </div>
          </motion.div>
        </div>
      </InquiryStageTransitionFrame>
    </AnimatePresence>
  );
}
