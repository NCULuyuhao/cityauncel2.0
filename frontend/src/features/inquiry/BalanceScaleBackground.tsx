/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一背景天秤視覺元件，將裝飾性背景與調查流程分離。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function BalanceScaleBackground({
  developmentScore,
  conservationScore,
}: {
  developmentScore: number;
  conservationScore: number;
}) {
  const difference = developmentScore - conservationScore;
  const rotate = clamp(difference * 4, -14, 14);
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId: number | null = null;

    const syncViewportMode = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        setIsCompactViewport((previous) => {
          const next = window.innerWidth < 768;
          return previous === next ? previous : next;
        });
      });
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode, { passive: true });

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", syncViewportMode);
    };
  }, []);

  const swayClassName = isCompactViewport
    ? "balance-scale-sway balance-scale-sway--compact"
    : "balance-scale-sway";

  return (
    <div
      className="inquiry-balance-background pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{ contain: "layout paint", transform: "translateZ(0)" }}
    >
      <style>{`
        @keyframes inquiry-balance-scale-sway {
          0%, 100% { transform: rotate(-0.48deg); }
          20% { transform: rotate(-0.22deg); }
          40% { transform: rotate(0.22deg); }
          60% { transform: rotate(0.48deg); }
          80% { transform: rotate(0.18deg); }
        }

        @keyframes inquiry-balance-scale-sway-compact {
          0%, 100% { transform: rotate(-0.28deg); }
          25% { transform: rotate(-0.12deg); }
          50% { transform: rotate(0.24deg); }
          75% { transform: rotate(0.1deg); }
        }

        .balance-scale-sway {
          animation: inquiry-balance-scale-sway 9.5s ease-in-out infinite;
          transform-origin: 50% 26px;
          will-change: transform;
        }

        .balance-scale-sway--compact {
          animation-name: inquiry-balance-scale-sway-compact;
          animation-duration: 12s;
        }
      `}</style>
      <div className="absolute left-[-14%] top-[6%] h-[560px] w-[560px] rounded-full bg-emerald-200/18 blur-[100px]" />
      <div className="absolute right-[-14%] top-[8%] h-[600px] w-[600px] rounded-full bg-orange-200/18 blur-[100px]" />
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/24 blur-[120px]" />

      <div className="absolute left-1/2 top-1/2 h-[700px] w-[1160px] origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.42] opacity-[0.23] sm:scale-[0.55] md:scale-[0.72] lg:scale-[0.88] xl:scale-100">
        <div className="absolute bottom-[22px] left-1/2 h-20 w-[620px] -translate-x-1/2 rounded-full bg-amber-950/18 blur-2xl" />

        <div className="absolute bottom-[96px] left-1/2 h-12 w-[330px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fde68a,#d97706,#78350f)] shadow-[0_14px_30px_rgba(120,53,15,0.28)]" />
        <div className="absolute bottom-[128px] left-1/2 h-8 w-[210px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fff7c2,#f59e0b,#92400e)] shadow-[0_10px_24px_rgba(120,53,15,0.22)]" />

        <div className="absolute left-1/2 top-[250px] h-[300px] w-12 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#451a03_0%,#92400e_12%,#fbbf24_28%,#fff7c2_45%,#d97706_62%,#78350f_82%,#451a03_100%)] shadow-[0_22px_55px_rgba(120,53,15,0.3)]">
          <div className="absolute left-3 top-8 h-[235px] w-2 rounded-full bg-white/50 blur-[1px]" />
          <div className="absolute right-2 top-8 h-[245px] w-1 rounded-full bg-amber-950/35" />
        </div>

        <div className="absolute left-1/2 top-[150px] h-36 w-36 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_34%_28%,#fffbe6_0%,#facc15_24%,#b45309_58%,#451a03_100%)] shadow-[0_20px_48px_rgba(120,53,15,0.35)]">
          <div className="absolute inset-[15px] rounded-full border border-amber-100/80 bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.86),rgba(255,255,255,0.22)_46%,rgba(120,53,15,0.2)_100%)]" />
          <div className="absolute left-9 top-8 h-6 w-6 rounded-full bg-white/80 blur-[1px]" />
          <div className="absolute bottom-5 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-amber-950/20" />
        </div>

        <motion.div
          animate={{ rotate }}
          transition={{ type: "spring", stiffness: 95, damping: 16 }}
          className="absolute left-1/2 top-[194px] h-[330px] w-[920px] -translate-x-1/2 transform-gpu will-change-transform"
          style={{ transformOrigin: "50% 26px" }}
        >
          <div
            className={`absolute inset-0 transform-gpu ${swayClassName}`}
            style={{
              transformOrigin: "50% 26px",
              animationPlayState: isPageVisible ? "running" : "paused",
            }}
          >
            <div className="absolute left-0 top-0 h-10 w-full rounded-full bg-[linear-gradient(180deg,#fff7c2_0%,#facc15_18%,#d97706_44%,#92400e_75%,#451a03_100%)] shadow-[0_22px_55px_rgba(120,53,15,0.3)]">
              <div className="absolute left-12 right-12 top-1.5 h-2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
              <div className="absolute bottom-1 left-10 right-10 h-1 rounded-full bg-amber-950/35" />
            </div>

            <div className="absolute -left-8 top-[-10px] h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_28%,#fffbe6,#fbbf24_34%,#92400e_74%,#451a03)] shadow-[0_14px_32px_rgba(120,53,15,0.32)]" />
            <div className="absolute -right-8 top-[-10px] h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_28%,#fffbe6,#fbbf24_34%,#92400e_74%,#451a03)] shadow-[0_14px_32px_rgba(120,53,15,0.32)]" />

            <div className="absolute left-1/2 top-[-22px] h-24 w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffbe6,#facc15_34%,#92400e_78%,#451a03)] shadow-[0_18px_40px_rgba(120,53,15,0.34)]">
              <div className="absolute inset-[16px] rounded-full border border-amber-100/80 bg-white/20" />
              <div className="absolute left-7 top-6 h-5 w-5 rounded-full bg-white/70 blur-[1px]" />
            </div>

            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 -rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#fffbe6,#f59e0b,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />

            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 -rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#fffbe6,#f59e0b,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />

            <div className="absolute left-[70px] top-[176px] flex w-[300px] flex-col items-center">
              <div className="relative h-[72px] w-[286px]">
                <div className="absolute left-1/2 top-0 h-14 w-[286px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fffbe6_0%,#facc15_24%,#b45309_62%,#451a03_100%)] shadow-[0_16px_34px_rgba(120,53,15,0.28)]">
                  <div className="absolute left-1/2 top-1 h-6 w-[246px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.22))]" />
                  <div className="absolute bottom-1 left-1/2 h-3 w-[230px] -translate-x-1/2 rounded-[50%] bg-amber-950/25" />
                </div>

                <div className="absolute left-1/2 top-[9px] h-9 w-[242px] -translate-x-1/2 rounded-[50%] border border-emerald-300/70 bg-[radial-gradient(ellipse_at_center,rgba(236,253,245,0.96)_0%,rgba(110,231,183,0.62)_52%,rgba(6,95,70,0.42)_100%)]" />
                <div className="absolute left-1/2 top-[16px] z-10 -translate-x-1/2 text-3xl font-black tracking-[0.18em] text-emerald-800 drop-shadow-[0_2px_3px_rgba(255,255,255,0.75)]">
                  保育
                </div>

                <div className="absolute left-1/2 top-[14px] h-2 w-[170px] -translate-x-1/2 rounded-full bg-white/75 blur-[1px]" />
                <div className="absolute left-[72px] top-[22px] h-5 w-14 rounded-full bg-white/20 blur-md" />

                <div className="absolute left-1/2 top-[41px] h-4 w-[232px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#b45309_0%,#78350f_72%,#451a03_100%)] opacity-80 shadow-[0_10px_20px_rgba(120,53,15,0.22)]" />
              </div>
            </div>

            <div className="absolute right-[70px] top-[176px] flex w-[300px] flex-col items-center">
              <div className="relative h-[72px] w-[286px]">
                <div className="absolute left-1/2 top-0 h-14 w-[286px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fffbe6_0%,#facc15_24%,#b45309_62%,#451a03_100%)] shadow-[0_16px_34px_rgba(120,53,15,0.28)]">
                  <div className="absolute left-1/2 top-1 h-6 w-[246px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.22))]" />
                  <div className="absolute bottom-1 left-1/2 h-3 w-[230px] -translate-x-1/2 rounded-[50%] bg-amber-950/25" />
                </div>

                <div className="absolute left-1/2 top-[9px] h-9 w-[242px] -translate-x-1/2 rounded-[50%] border border-orange-300/70 bg-[radial-gradient(ellipse_at_center,rgba(255,247,237,0.96)_0%,rgba(253,186,116,0.62)_52%,rgba(194,65,12,0.42)_100%)]" />

                <div className="absolute left-1/2 top-[16px] z-10 -translate-x-1/2 text-3xl font-black tracking-[0.18em] text-orange-800 drop-shadow-[0_2px_3px_rgba(255,255,255,0.75)]">
                  開發
                </div>

                <div className="absolute left-1/2 top-[14px] h-2 w-[170px] -translate-x-1/2 rounded-full bg-white/75 blur-[1px]" />
                <div className="absolute left-[72px] top-[22px] h-5 w-14 rounded-full bg-white/20 blur-md" />

                <div className="absolute left-1/2 top-[41px] h-4 w-[232px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#b45309_0%,#78350f_72%,#451a03_100%)] opacity-80 shadow-[0_10px_20px_rgba(120,53,15,0.22)]" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
