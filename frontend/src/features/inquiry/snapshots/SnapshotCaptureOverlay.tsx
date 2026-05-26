import { AnimatePresence, motion } from "framer-motion";
import {
  WaterLiveSnapshotView,
  type EvidenceSnapshotMetaLike,
} from "@/features/inquiry/water/WaterLiveSnapshotViews";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";

type CapturePreviewPhase = "capturing" | "complete";

type SnapshotCaptureOverlayProps = {
  snapshot: EvidenceSnapshotMetaLike | null;
  imageSrc: string;
  phase: CapturePreviewPhase;
  buildSnapshotSvgDataUrl: (snapshot: EvidenceSnapshotMetaLike) => string;
};

const capturedImageMotion = {
  initial: {
    filter: "saturate(0.78) brightness(1.04) contrast(0.96)",
    scale: 1.045,
  },
  animate: {
    filter: [
      "saturate(0.78) brightness(1.04) contrast(0.96)",
      "saturate(1.18) brightness(1.26) contrast(1.06)",
      "saturate(1) brightness(1) contrast(1)",
      "saturate(0.94) brightness(0.96) contrast(1.04)",
    ],
    scale: [1.045, 1.012, 1, 0.985],
  },
  transition: {
    duration: 1.22,
    times: [0, 0.34, 0.72, 1],
    ease: "easeOut",
  },
};

export default function SnapshotCaptureOverlay({
  snapshot,
  imageSrc,
  phase,
  buildSnapshotSvgDataUrl,
}: SnapshotCaptureOverlayProps) {
  return (
    <AnimatePresence>
      {snapshot ? (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[74] flex items-center justify-center overflow-hidden bg-slate-950/72 p-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(236,201,118,0.24),rgba(86,61,25,0.72)_58%,rgba(34,24,13,0.92)_100%)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            className="absolute inset-0 bg-[#fff8ef]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.96, 0.18, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.58,
              times: [0, 0.28, 0.36, 0.48, 1],
              ease: "easeOut",
            }}
          />

          <motion.div
            className="absolute inset-x-0 top-0 h-full bg-[linear-gradient(180deg,transparent_0%,rgba(236,201,118,0)_18%,rgba(236,201,118,0.48)_50%,rgba(255,255,255,0.76)_52%,rgba(236,201,118,0.34)_54%,transparent_78%)]"
            initial={{ y: "-92vh", opacity: 0 }}
            animate={{ y: ["-92vh", "8vh", "88vh"], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 1.06,
              times: [0, 0.45, 1],
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute inset-x-0 top-[18%] h-px bg-amber-200/80 shadow-[0_0_26px_rgba(236,201,118,0.8)]"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 1.08,
              times: [0, 0.18, 0.82, 1],
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute inset-y-0 left-[22%] w-px bg-amber-200/70 shadow-[0_0_22px_rgba(236,201,118,0.72)]"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 1.08,
              delay: 0.08,
              times: [0, 0.18, 0.82, 1],
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute inset-y-0 right-[22%] w-px bg-amber-200/70 shadow-[0_0_22px_rgba(236,201,118,0.72)]"
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 1.08,
              delay: 0.08,
              times: [0, 0.18, 0.82, 1],
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="relative w-full max-w-6xl rounded-[36px] border border-[#fff4df]/90 bg-[#fff4df]/16 p-4 shadow-[0_34px_110px_rgba(92,67,34,0.34)]"
            initial={{ scale: 0.88, y: 28, opacity: 0, rotateX: 5 }}
            animate={{
              scale: [0.88, 1.025, 0.985, 0.94],
              y: [28, 0, 0, 16],
              opacity: [0, 1, 1, 0.92],
              rotateX: [5, 0, 0, 0],
            }}
            exit={{ scale: 0.32, y: "22vh", opacity: 0, rotateX: 0 }}
            transition={{
              duration: 1.24,
              times: [0, 0.28, 0.76, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="absolute -left-1.5 -top-1.5 h-20 w-20 rounded-tl-[36px] border-l-[6px] border-t-[6px] border-amber-200 shadow-[-8px_-8px_26px_rgba(236,201,118,0.34)]"
              initial={{ x: -16, y: -16, opacity: 0 }}
              animate={{ x: [-16, 0, 0], y: [-16, 0, 0], opacity: [0, 1, 1] }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            />
            <motion.div
              className="absolute -right-1.5 -top-1.5 h-20 w-20 rounded-tr-[36px] border-r-[6px] border-t-[6px] border-amber-200 shadow-[8px_-8px_26px_rgba(236,201,118,0.34)]"
              initial={{ x: 16, y: -16, opacity: 0 }}
              animate={{ x: [16, 0, 0], y: [-16, 0, 0], opacity: [0, 1, 1] }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            />
            <motion.div
              className="absolute -bottom-1.5 -left-1.5 h-20 w-20 rounded-bl-[36px] border-b-[6px] border-l-[6px] border-amber-200 shadow-[-8px_8px_26px_rgba(236,201,118,0.34)]"
              initial={{ x: -16, y: 16, opacity: 0 }}
              animate={{ x: [-16, 0, 0], y: [16, 0, 0], opacity: [0, 1, 1] }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            />
            <motion.div
              className="absolute -bottom-1.5 -right-1.5 h-20 w-20 rounded-br-[36px] border-b-[6px] border-r-[6px] border-amber-200 shadow-[8px_8px_26px_rgba(236,201,118,0.34)]"
              initial={{ x: 16, y: 16, opacity: 0 }}
              animate={{ x: [16, 0, 0], y: [16, 0, 0], opacity: [0, 1, 1] }}
              transition={{ duration: 0.42, ease: "easeOut" }}
            />

            <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-100/90 bg-[#5c4322]/78 px-4 py-2 text-[11px] font-black tracking-[0.28em] text-amber-50 shadow-[0_12px_30px_rgba(92,67,34,0.24)] backdrop-blur">
              <motion.span
                className="h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_16px_rgba(236,201,118,0.9)]"
                animate={{
                  opacity: [0.35, 1, 0.35],
                  scale: [0.8, 1.24, 0.8],
                }}
                transition={{
                  duration: 0.42,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {phase === "complete" ? "CAPTURED" : "CAPTURING"}
            </div>

            <div className="overflow-hidden rounded-[26px] border border-[#f3e2be] bg-[#fffaf0] shadow-[0_24px_70px_rgba(92,67,34,0.28)]">
              {imageSrc ? (
                <motion.img
                  src={imageSrc}
                  alt="正在擷取互動數據畫面"
                  className="max-h-[78svh] w-full object-contain"
                  {...capturedImageMotion}
                />
              ) : isWaterLiveSnapshotMeta(snapshot) ? (
                <motion.div
                  className="max-h-[78svh] w-full overflow-hidden p-3"
                  {...capturedImageMotion}
                >
                  <WaterLiveSnapshotView meta={snapshot} />
                </motion.div>
              ) : (
                <motion.img
                  src={buildSnapshotSvgDataUrl(snapshot)}
                  alt="正在擷取互動數據畫面"
                  className="max-h-[78svh] w-full object-contain"
                  {...capturedImageMotion}
                />
              )}
            </div>

            <motion.div
              className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#fffaf0] shadow-[0_0_34px_rgba(255,255,255,0.95),0_0_52px_rgba(236,201,118,0.7)]"
              initial={{ y: "-33vh", opacity: 0 }}
              animate={{ y: ["-33vh", "0vh", "33vh"], opacity: [0, 1, 0] }}
              transition={{
                duration: 1.45,
                delay: 0.16,
                times: [0, 0.48, 1],
                ease: "easeInOut",
              }}
            />

            <motion.div
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full border border-amber-200/95 bg-[#fffaf0]/96 px-6 py-3.5 text-base font-black tracking-[0.18em] text-[#7b5b37] shadow-[0_18px_44px_rgba(92,67,34,0.22)]"
              initial={{ opacity: 0, scale: 0.76 }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0.76, 1, 1, 1, 0.94],
              }}
              transition={{ duration: 3.05, times: [0, 0.1, 0.58, 0.9, 1] }}
            >
              <motion.span
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c89a3a] text-white shadow-[0_0_18px_rgba(200,154,58,0.72)]"
                animate={
                  phase === "complete"
                    ? { rotate: [0, 0, 360], scale: [0.82, 1.06, 1] }
                    : { rotate: [0, 180, 360], scale: [0.88, 1.04, 0.88] }
                }
                transition={{
                  duration: 0.92,
                  repeat: phase === "complete" ? 0 : Infinity,
                  ease: "easeInOut",
                }}
              >
                {phase === "complete" ? "✓" : "⌁"}
              </motion.span>
              {phase === "complete" ? "擷取完成，正在縮小成線索卡" : "畫面擷取中"}
            </motion.div>

            <motion.div
              className="absolute bottom-5 left-1/2 h-2 w-[min(440px,62vw)] -translate-x-1/2 overflow-hidden rounded-full bg-[#fff7ea]/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 3.05, times: [0, 0.08, 0.92, 1] }}
            >
              <motion.div
                className="h-full rounded-full bg-amber-200 shadow-[0_0_18px_rgba(236,201,118,0.72)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.95, ease: "easeInOut" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
