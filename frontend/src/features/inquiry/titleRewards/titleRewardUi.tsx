import { AnimatePresence, motion } from "framer-motion";
import type { TitleReward } from "@/features/inquiry/cards/cardPresentation";

import { getTitleMedalStyle, getTitleTheme, getTitleTier } from "./titleRewardStyles";

export function TitleMedalStars({
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

function TitleEmblem({
  tier,
  theme,
}: {
  tier: "novice" | "advanced" | "master";
  theme: "water" | "land" | "leopard" | "rumor" | "cross";
}) {
  const style = getTitleMedalStyle(`${theme}_${tier}`);

  return (
    <div className="flex w-[58px] shrink-0 flex-col items-center">
      <div
        className={`relative mb-[-6px] h-12 w-12 rounded-full border-[3px] ${style.border} bg-gradient-to-br ${style.metal} shadow-[inset_0_3px_8px_rgba(255,255,255,0.75),inset_0_-7px_10px_rgba(0,0,0,0.14),0_8px_14px_rgba(45,41,34,0.16)]`}
      >
        <div className="absolute inset-1.5 rounded-full border border-white/55 bg-white/10" />
        <div
          className={`absolute inset-[10px] rounded-full border border-white/70 bg-gradient-to-br ${style.shine}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center px-1 font-black leading-none drop-shadow-sm ${style.starText}`}
        >
          <TitleMedalStars stars={style.stars} variant="small" />
        </div>
      </div>

      <div className="relative flex w-14 justify-center">
        <div
          className={`h-8 w-5 origin-top rotate-[8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
        />
        <div
          className={`-ml-1.5 h-8 w-5 origin-top rotate-[-8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
        />
      </div>
    </div>
  );
}

export function TitleBadgeCard({ title }: { title: TitleReward }) {
  const tier = getTitleTier(title.id);
  const theme = getTitleTheme(title.id);
  const style = getTitleMedalStyle(title);

  return (
    <div
      className={`group relative w-full min-w-0 overflow-hidden rounded-[22px] border bg-[#fffaf0] px-2.5 py-2 text-left transition duration-200 ${style.border} ${style.glow} hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,41,34,0.16)]`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.9),transparent_42%)] opacity-70" />

      <div className="relative flex min-h-[104px] items-center gap-2.5">
        <TitleEmblem tier={tier} theme={theme} />

        <div className="min-w-0 flex-1">
          <div
            className={`relative mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.13em] ${style.border} ${style.text} bg-white/55`}
          >
            {style.rank}
          </div>

          <p className="relative text-[13px] font-black leading-[1.28] text-[#332c24]">
            {title.name}
          </p>
          <p className="relative mt-0.5 line-clamp-2 text-[11px] leading-[1.28] text-[#746855]">
            {title.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TitleRewardCelebration({
  reward,
}: {
  reward: TitleReward | null;
}) {
  const style = getTitleMedalStyle(reward ?? "cross_novice");

  return (
    <AnimatePresence>
      {reward ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2f2418]/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.55 }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.08, x: "42vw", y: "38vh", opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md origin-center title-reward-popup"
          >
            <motion.div
              className="absolute left-8 top-8 text-2xl"
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              ★
            </motion.div>
            <motion.div
              className="absolute right-6 top-10 text-xl"
              initial={{ scale: 0, rotate: 45, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              ★
            </motion.div>

            <div className="relative overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] px-7 py-8 text-center shadow-[0_24px_70px_rgba(45,41,34,0.22)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.95),transparent_44%)] opacity-80" />

              <motion.div
                initial={{ rotate: -12, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 260,
                  damping: 14,
                }}
                className="relative mx-auto mb-4 flex w-32 flex-col items-center"
              >
                <div
                  className={`relative z-10 mb-[-10px] flex h-28 w-28 items-center justify-center rounded-full border-[5px] ${style.border} bg-gradient-to-br ${style.metal} text-5xl shadow-[inset_0_5px_12px_rgba(255,255,255,0.75),inset_0_-12px_16px_rgba(0,0,0,0.16),0_18px_30px_rgba(45,41,34,0.22)]`}
                >
                  <div className="absolute inset-3 rounded-full border border-white/60" />
                  <div
                    className={`absolute inset-[26px] rounded-full border border-white/70 bg-gradient-to-br ${style.shine}`}
                  />
                  <motion.span
                    className={`relative z-10 flex h-full w-full items-center justify-center ${style.starText}`}
                    animate={{ scale: [1, 1.18, 1] }}
                    transition={{ delay: 0.45, duration: 0.5 }}
                  >
                    <TitleMedalStars stars={style.stars} variant="large" />
                  </motion.span>
                </div>

                <div className="relative flex w-24 justify-center">
                  <div
                    className={`h-12 w-9 origin-top rotate-[8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-md`}
                  />
                  <div
                    className={`-ml-2 h-12 w-9 origin-top rotate-[-8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-md`}
                  />
                </div>
              </motion.div>

              <p
                className={`relative mx-auto mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-[0.2em] ${style.border} ${style.text} bg-white/60`}
              >
                {style.rank}
              </p>

              <h2 className="relative font-serif text-3xl font-bold tracking-[0.08em] text-[#332c24]">
                {reward.name}
              </h2>

              <p className="relative mt-2 text-sm font-semibold leading-6 text-[#746855]">
                {reward.description}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
