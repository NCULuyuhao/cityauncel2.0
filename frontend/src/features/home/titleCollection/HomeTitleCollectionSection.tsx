/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁稱號收藏區塊，集中處理稱號收藏的畫面呈現。
 * 維護重點：只負責 UI 呈現，不處理稱號解鎖流程或資料寫入。
 */

import type { Ref } from "react";
import { motion } from "framer-motion";
import { TitleCollection } from "@/features/home/TitleCollection";
import {
  HOME_TITLE_REWARDS,
  getMedalStyle,
  type TitleReward,
} from "@/features/home/titleRewardModel";
import { MedalStars } from "@/features/home/TitleRewardToast";

type HomeTitleCollectionSectionProps = {
  earnedHomeTitles: TitleReward[];
  sectionRef: Ref<HTMLElement>;
};

export function HomeTitleCollectionSection({
  earnedHomeTitles,
  sectionRef,
}: HomeTitleCollectionSectionProps) {
  const earnedTitleIds = new Set(earnedHomeTitles.map((title) => title.id));

  return (
    <TitleCollection ref={sectionRef}>
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)] bg-[size:30px_30px]" />
        <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#d7c49a]/25 blur-[90px]" />
        <div className="absolute bottom-[-120px] left-20 h-72 w-72 rounded-full bg-[#8b7a5c]/12 blur-[90px]" />
      </div>

      <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#d6c7aa] pb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#c9b793] bg-[#fff8e8] text-3xl shadow-sm">
            🎖️
          </div>
          <div>
            <p className="home-eyebrow-label mb-2 text-xs font-semibold tracking-[0.18em] text-[#84745c]">
              HONOR ARCHIVE
            </p>
            <h2 className="home-reward-title text-[clamp(1.72rem,2.5vw,2rem)] font-semibold tracking-[0.035em] text-[#2f2a24]">
              稱號收藏
            </h2>
          </div>
        </div>

        <span className="home-chip-label rounded-full border border-[#cdbb9c] bg-[#fff8e8]/85 px-4 py-2 text-xs font-semibold tracking-[0.13em] text-[#6d5e49] shadow-sm">
          {earnedHomeTitles.length} / {HOME_TITLE_REWARDS.length}
        </span>
      </div>

      <div className="relative uiux-stats-grid min-h-[190px] rounded-[30px] border border-[#d7c8ad] bg-[#fbf7ee]/88 p-3 shadow-inner shadow-white/70 min-[901px]:grid-cols-6 min-[601px]:grid-cols-3">
        {HOME_TITLE_REWARDS.map((title) => {
          const earned = earnedTitleIds.has(title.id);
          const style = getMedalStyle(title);

          return (
            <motion.div
              key={title.id}
              data-title-id={title.id}
              initial={false}
              animate={
                earned
                  ? { opacity: 1, scale: 1, y: 0 }
                  : { opacity: 0.55, scale: 0.96, y: 2 }
              }
              transition={{ duration: 0.32, ease: "easeOut" }}
              className={`group relative overflow-hidden rounded-[22px] border bg-[#fffaf0] px-2.5 py-2 text-left transition duration-200 ${
                earned
                  ? `${style.border} ${style.glow} hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,41,34,0.16)]`
                  : "border-stone-300 bg-stone-100/90 grayscale shadow-[inset_0_0_0_1px_rgba(120,113,108,0.22)]"
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.9),transparent_42%)] opacity-70" />

              <div className="relative flex min-h-[104px] items-center gap-2.5">
                <div className="flex w-[54px] shrink-0 flex-col items-center">
                  <div
                    className={`relative mb-[-6px] h-12 w-12 rounded-full border-[3px] ${
                      earned ? style.border : "border-stone-300"
                    } bg-gradient-to-br ${
                      earned
                        ? style.metal
                        : "from-stone-100 via-stone-200 to-stone-300"
                    } shadow-[inset_0_3px_8px_rgba(255,255,255,0.75),inset_0_-7px_10px_rgba(0,0,0,0.14),0_8px_14px_rgba(45,41,34,0.16)]`}
                  >
                    <div className="absolute inset-1.5 rounded-full border border-white/55 bg-white/10" />
                    <div
                      className={`absolute inset-[10px] rounded-full border ${
                        earned ? "border-white/70" : "border-stone-300"
                      } bg-gradient-to-br ${earned ? style.shine : "from-stone-50 via-stone-200 to-stone-400"}`}
                    />
                    <div
                      className={`absolute inset-0 flex items-center justify-center px-1 font-black leading-none drop-shadow-sm ${earned ? style.starText : "text-stone-500"}`}
                    >
                      {earned ? (
                        <MedalStars stars={style.star} variant="small" />
                      ) : (
                        "🔒"
                      )}
                    </div>
                  </div>

                  <div className="relative flex w-14 justify-center">
                    <div
                      className={`h-8 w-5 origin-top rotate-[8deg] bg-gradient-to-b ${
                        earned ? style.ribbon : "from-stone-300 to-stone-400"
                      } [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
                    />
                    <div
                      className={`-ml-1.5 h-8 w-5 origin-top rotate-[-8deg] bg-gradient-to-b ${
                        earned ? style.ribbon : "from-stone-300 to-stone-400"
                      } [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={`home-chip-label relative mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] ${
                      earned
                        ? `${style.border} ${style.text} bg-white/55`
                        : "border-stone-400 bg-stone-100 text-stone-600"
                    }`}
                  >
                    {earned ? style.rank : "LOCKED"}
                  </div>

                  {earned ? (
                    <>
                      <p className="home-medal-title relative text-[13px] font-semibold leading-[1.32] text-[#332c24]">
                        {title.name}
                      </p>
                      <p className="relative mt-0.5 text-[11px] leading-[1.28] text-[#746855]">
                        {title.description}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </TitleCollection>
  );
}
