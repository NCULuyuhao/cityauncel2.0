/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能元件 HomeHeader，負責任務入口、稱號或首頁區塊呈現。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type HomeHeaderProps = {
  classSuspectVerdictCard: ReactNode;
  isCardPackOpen: boolean;
  onOpenCardPack: () => void;
  stats: ReactNode;
  userControls: ReactNode;
};

export function HomeHeader({
  classSuspectVerdictCard,
  isCardPackOpen,
  onOpenCardPack,
  stats,
  userControls,
}: HomeHeaderProps) {
  return (
    <header className="game-stage-card mb-4 overflow-hidden rounded-[28px] p-4 sm:mb-6 sm:rounded-[38px] sm:p-6 backdrop-blur-xl">
      <div className="uiux-home-header-grid min-w-0">
        <div className="order-2 hidden min-w-0 justify-center min-[700px]:order-1 min-[700px]:flex min-[700px]:justify-start">
          {classSuspectVerdictCard}
        </div>

        <div className="order-1 min-w-0 text-center min-[700px]:order-2">
          <h1 className="game-title-text game-major-title whitespace-nowrap text-[clamp(2.35rem,5.4vw,4.6rem)] font-black leading-tight tracking-[0.14em] md:tracking-[0.18em]">
            淺山守望者
          </h1>
          <div className="mx-auto mt-3 h-px w-[min(12rem,70%)] bg-gradient-to-r from-transparent via-stone-400 to-transparent" />
          <AnimatePresence>
            {isCardPackOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.28 }}
                className="mt-5 flex justify-center"
              >
                <button
                  type="button"
                  onClick={onOpenCardPack}
                  className="card-pack-sparkle-button game-primary-button relative flex h-[52px] min-w-[190px] items-center justify-center rounded-2xl px-6 text-sm font-black tracking-[0.18em] active:translate-y-0 active:scale-[0.98] sm:text-base"
                >
                  角色卡包
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="order-3 flex min-w-0 flex-col items-center gap-2 min-[700px]:items-end">
          {stats}
          {userControls}
        </div>
      </div>
    </header>
  );
}
