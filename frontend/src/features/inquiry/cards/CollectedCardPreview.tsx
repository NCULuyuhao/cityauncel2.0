/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 CollectedCardPreview，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { EvidenceSnapshotMeta } from "@/features/inquiry/snapshots/snapshotBuilder";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  categoryCardThemeMap,
  categoryMetaMap,
  writtenCardStateMap,
  type CategoryKey,
} from "@/features/inquiry/cards/cardPresentation";
import { WaterLiveSnapshotCardPreview } from "@/features/inquiry/water/WaterLiveSnapshotViews";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";

type PreviewGameCard = {
  category: CategoryKey;
  revealedTitle: string;
  content?: string;
  imageSrc: string;
  sourceType?: string;
  snapshotMeta?: EvidenceSnapshotMeta;
};

function shouldUseWaterLiveSnapshotPreview(card?: PreviewGameCard | null) {
  return (
    card?.sourceType === "interactiveSnapshot" &&
    isWaterLiveSnapshotMeta(card?.snapshotMeta)
  );
}

export function CollectedCardPreview({
  card,
  onClose,
}: {
  card: PreviewGameCard | null;
  onClose: () => void;
}) {
  const cardTheme = card ? categoryCardThemeMap[card.category] : null;
  const writtenTheme = card ? writtenCardStateMap[card.category] : null;
  const isWaterLivePreview = isWaterLiveSnapshotMeta(card?.snapshotMeta);

  return (
    <AnimatePresence>
      {card ? (
        <motion.div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-[#2f2418]/42 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${isWaterLivePreview ? "max-w-6xl" : "max-w-3xl"} rounded-[32px] p-[1px] shadow-[0_30px_100px_rgba(15,23,42,0.18)] ${
              cardTheme?.previewShell ?? "bg-white border border-slate-200"
            }`}
          >
            <div className="rounded-[31px] bg-white/95 p-8 backdrop-blur-xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mt-3 flex items-start gap-3">
                    <span
                      className={`mt-1 h-7 w-7 shrink-0 ${writtenTheme?.iconText ?? "text-slate-600"}`}
                    >
                      {categoryMetaMap[card.category].icon}
                    </span>
                    <div>
                      <div className="mb-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${writtenTheme?.badge ?? "border border-slate-200 bg-slate-50 text-slate-700"}`}
                        >
                          {categoryMetaMap[card.category].label}
                        </span>
                      </div>
                      <h3 className="text-3xl font-bold text-slate-800">
                        {card.revealedTitle}
                      </h3>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-black transition-colors hover:bg-slate-100"
                  style={{ color: "#000000" }}
                  aria-label="關閉預覽"
                >
                  <X className="h-5 w-5" color="#000000" strokeWidth={2.4} />
                </button>
              </div>

              <div
                className={`rounded-[24px] p-6 ${
                  writtenTheme?.previewBox ??
                  "border border-slate-200 bg-slate-50"
                }`}
              >
                <div
                  className={`flex flex-col gap-5 md:flex-row md:items-start ${isWaterLivePreview ? "md:gap-6" : ""}`}
                >
                  <div
                    className={`${isWaterLivePreview ? "w-full md:w-[68%]" : "flex shrink-0 justify-center md:w-[280px]"}`}
                  >
                    {shouldUseWaterLiveSnapshotPreview(card) ? (
                      <div className="mx-auto aspect-[6/5] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#fffdf8] shadow-inner">
                        <WaterLiveSnapshotCardPreview
                          meta={card.snapshotMeta!}
                          className="h-full w-full"
                        />
                      </div>
                    ) : (
                      <img
                        src={card.imageSrc}
                        alt={card.revealedTitle}
                        className="max-h-[260px] w-full object-contain rounded-2xl bg-white"
                      />
                    )}
                  </div>

                  <div
                    className={`${isWaterLivePreview ? "min-w-[220px] md:flex-1" : "min-w-0 flex-1"}`}
                  >
                    <p
                      className={`text-sm font-semibold ${writtenTheme?.hintText ?? "text-slate-500"}`}
                    >
                      卡牌完整內容
                    </p>

                    <div className="mt-4 max-h-[360px] overflow-y-auto pr-2">
                      <p className="whitespace-pre-wrap break-words break-all text-lg leading-8 text-slate-700">
                        {card.content || "已收藏這張數據卡"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
