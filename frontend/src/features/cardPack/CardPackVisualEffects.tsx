import { motion } from "framer-motion";

type CardPackVisualEffectsProps = {
  energyBurstActive: boolean;
};

export function CardPackVisualEffects({
  energyBurstActive,
}: CardPackVisualEffectsProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(252,211,77,0.22),transparent_26%),radial-gradient(circle_at_18%_72%,rgba(34,197,94,0.16),transparent_30%),radial-gradient(circle_at_88%_80%,rgba(125,211,252,0.16),transparent_34%)]" />
      {energyBurstActive ? (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0] }}
            transition={{ duration: 0.45 }}
          />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 z-40 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-amber-100/80"
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 5.2, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 opacity-35 bg-[linear-gradient(120deg,transparent_0_12px,rgba(255,255,255,0.06)_13px,transparent_14px)] bg-[size:36px_36px]" />
    </>
  );
}
