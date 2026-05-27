/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 CollectedCardsPanel，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { EvidenceSnapshotMeta } from "@/features/inquiry/snapshots/snapshotBuilder";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArrowDownWideNarrow,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Droplets,
  Map,
  Newspaper,
  PawPrint,
  type LucideIcon,
} from "lucide-react";
import { timestampValue } from "@/features/inquiry/cards/cardSerialization";
import {
  categoryMetaMap,
  writtenCardStateMap,
  type CategoryKey,
} from "@/features/inquiry/cards/cardPresentation";
import { WaterLiveSnapshotCardPreview } from "@/features/inquiry/water/WaterLiveSnapshotViews";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";

type CollectionSortMode =
  | "latest"
  | "water"
  | "land"
  | "leopard"
  | "rumor"
  | "other";

type CollectedGameCard = {
  id: string;
  localId: number;
  category: CategoryKey;
  title: string;
  revealedTitle: string;
  content: string;
  imageSrc: string;
  sourceType?: "fixedImage" | "interactiveSnapshot";
  snapshotMeta?: EvidenceSnapshotMeta;
  unlocked: boolean;
  unlockedAt: string | null;
};

const COLLECTION_SORT_CATEGORY: Record<CollectionSortMode, CategoryKey | null> =
  {
    latest: null,
    water: "water",
    land: "land",
    leopard: "leopard",
    rumor: "rumor",
    other: "other",
  };

const COLLECTION_SORT_OPTIONS: Array<{
  mode: CollectionSortMode;
  label: string;
  icon: LucideIcon;
}> = [
  { mode: "latest", label: "最新", icon: ArrowDownWideNarrow },
  { mode: "water", label: "水資源", icon: Droplets },
  { mode: "land", label: "土地", icon: Map },
  { mode: "leopard", label: "石虎", icon: PawPrint },
  { mode: "rumor", label: "傳言", icon: Newspaper },
  { mode: "other", label: "其他", icon: Archive },
];

function getCollectionSortButtonClasses(
  mode: CollectionSortMode,
  isActive: boolean,
) {
  if (mode === "latest") {
    return isActive
      ? "border-slate-300 bg-white text-slate-800 shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
      : "border-transparent bg-transparent text-slate-500";
  }

  const classes: Record<CategoryKey, { active: string; idle: string }> = {
    water: {
      active:
        "border-sky-200 bg-white text-sky-800 shadow-[0_8px_18px_rgba(14,165,233,0.10)]",
      idle: "border-transparent bg-transparent text-sky-600",
    },
    land: {
      active:
        "border-lime-200 bg-white text-lime-800 shadow-[0_8px_18px_rgba(132,204,22,0.10)]",
      idle: "border-transparent bg-transparent text-lime-700",
    },
    leopard: {
      active:
        "border-orange-200 bg-white text-orange-800 shadow-[0_8px_18px_rgba(249,115,22,0.10)]",
      idle: "border-transparent bg-transparent text-orange-700",
    },
    rumor: {
      active:
        "border-violet-200 bg-white text-violet-800 shadow-[0_8px_18px_rgba(139,92,246,0.10)]",
      idle: "border-transparent bg-transparent text-violet-700",
    },
    other: {
      active:
        "border-amber-200 bg-white text-amber-800 shadow-[0_8px_18px_rgba(245,158,11,0.10)]",
      idle: "border-transparent bg-transparent text-amber-700",
    },
  };

  const category = COLLECTION_SORT_CATEGORY[mode];
  return category
    ? isActive
      ? classes[category].active
      : classes[category].idle
    : "";
}

function shouldUseWaterLiveSnapshotPreview(card?: CollectedGameCard | null) {
  return (
    card?.sourceType === "interactiveSnapshot" &&
    isWaterLiveSnapshotMeta(card?.snapshotMeta)
  );
}

export function CollectedCardsPanel({
  cards,
  currentRoundCardIds,
  onOpenCard,
  hasNewContent,
  onOpenPanel,
}: {
  cards: CollectedGameCard[];
  currentRoundCardIds: string[];
  onOpenCard: (card: CollectedGameCard) => void;
  hasNewContent: boolean;
  onOpenPanel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sortMode, setSortMode] = useState<CollectionSortMode>("latest");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const collectedCards = useMemo(() => {
    const currentRoundIdSet = new Set(currentRoundCardIds);
    const base = cards.filter(
      (card) => currentRoundIdSet.has(card.id) && card.unlocked,
    );
    const preferredCategory = COLLECTION_SORT_CATEGORY[sortMode];

    return [...base].sort((a, b) => {
      if (sortMode === "latest") {
        const aTime = timestampValue(a.unlockedAt);
        const bTime = timestampValue(b.unlockedAt);

        if (aTime !== bTime) {
          return bTime - aTime;
        }

        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }

        return a.localId - b.localId;
      }

      const aPriority = a.category === preferredCategory ? 0 : 1;
      const bPriority = b.category === preferredCategory ? 0 : 1;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }

      return a.localId - b.localId;
    });
  }, [cards, currentRoundCardIds, sortMode]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleOpenCollectedCard = (card: CollectedGameCard) => {
    setOpen(false);
    onOpenCard(card);
  };

  const handleTogglePanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpenPanel();
      return next;
    });
  };
  const isPriorityCard = (card: CollectedGameCard) => {
    const preferredCategory = COLLECTION_SORT_CATEGORY[sortMode];
    return preferredCategory !== null && card.category === preferredCategory;
  };

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+4.5rem)] right-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3 md:bottom-28 md:right-6"
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="flex max-h-[min(620px,78svh)] w-[min(350px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.12)] flex-col"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-full bg-sky-50 p-2">
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold tracking-[0.2em] text-sky-700">
                    數據收藏
                  </p>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-center text-red-700">
                <p className="text-[10px] font-bold tracking-[0.14em]">
                  這回合收藏 {collectedCards.length} 張數據
                </p>
              </div>
            </div>

            <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-black tracking-[0.16em] text-slate-500">
                  排序
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  點選分類置頂
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {COLLECTION_SORT_OPTIONS.map(({ mode, label, icon: Icon }) => {
                const isSortActive = sortMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortMode(mode)}
                    className={`relative flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-black transition ${getCollectionSortButtonClasses(
                      mode,
                      isSortActive,
                    )}`}
                    aria-pressed={isSortActive}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                    {isSortActive ? (
                      <Check className="absolute right-1 top-1 h-3 w-3" />
                    ) : null}
                  </button>
                );
              })}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
              {collectedCards.length > 0 ? (
                collectedCards.map((card) => {
                  const theme = writtenCardStateMap[card.category];
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleOpenCollectedCard(card)}
                      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left ${theme.collectionItem}`}
                    >
                      <div className="pointer-events-none absolute inset-y-2 left-2 w-28 rounded-2xl bg-white/35 opacity-85 blur-xl" />

                      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-visible">
                        <div className="absolute inset-3 rounded-full bg-white/60 blur-md" />
                        <div className="relative flex h-full w-full items-center justify-center">
                          {shouldUseWaterLiveSnapshotPreview(card) ? (
                            <WaterLiveSnapshotCardPreview
                              meta={card.snapshotMeta!}
                              className="h-full w-full drop-shadow-sm"
                            />
                          ) : (
                            <img
                              src={card.imageSrc}
                              alt={card.revealedTitle}
                              loading="lazy"
                              className="max-h-full max-w-full object-contain drop-shadow-sm"
                            />
                          )}
                        </div>
                      </div>

                      <div className="relative min-w-0 flex-1 pr-7">
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${theme.collectionLabel}`}
                          >
                            {categoryMetaMap[card.category].label}
                          </span>
                          {isPriorityCard(card) ? (
                            <span
                              className={`text-[11px] font-bold ${theme.collectionHint}`}
                            >
                              優先排序
                            </span>
                          ) : null}
                        </div>
                        <div className="line-clamp-2 text-sm font-black leading-5 text-slate-800">
                          {card.revealedTitle}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] font-medium leading-5 text-slate-500">
                          {card.content || "已收藏這張數據卡"}
                        </div>
                      </div>

                      <div className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">
                        <ChevronRight
                          className={`h-4 w-4 ${theme.collectionArrow}`}
                        />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  還沒有收藏數據，請先解鎖圖片卡或擷取互動圖表快照。
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        animate={
          hasNewContent && !open
            ? {
                scale: [1, 1.06, 1],
                boxShadow: [
                  "0 10px 24px rgba(15,23,42,0.14)",
                  "0 0 0 6px rgba(14,165,233,0.10), 0 0 20px rgba(14,165,233,0.16)",
                  "0 10px 24px rgba(15,23,42,0.14)",
                ],
              }
            : {
                scale: 1,
                boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
              }
        }
        transition={
          hasNewContent && !open
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        onClick={handleTogglePanel}
        className="relative flex h-16 w-16 items-center justify-center rounded-full border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-100 text-sky-700"
      >
        {hasNewContent && !open ? (
          <motion.span
            className="absolute right-2 top-2 h-3 w-3 rounded-full bg-sky-500"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        {open ? (
          <ChevronDown className="h-6 w-6" />
        ) : (
          <BookOpen className="h-7 w-7" />
        )}
      </motion.button>
    </div>
  );
}
