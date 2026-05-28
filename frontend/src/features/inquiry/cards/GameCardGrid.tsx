/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 GameCardGrid，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { EvidenceSnapshotMeta } from "@/features/inquiry/snapshots/snapshotBuilder";
import React, { memo, useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import {
  categoryCardThemeMap,
  categoryListThemeMap,
  writtenCardStateMap,
  type CategoryKey,
  type CategoryMeta,
} from "@/features/inquiry/cards/cardPresentation";
import {
  buildRegionFilterOptions,
  filterCardsByStudentSelection,
  getQuestionFilterOptions,
  shouldShowCardFilter,
  shouldShowRegionFilter,
  type CardQuestionFilter,
  type CardRegionFilter,
} from "@/features/inquiry/cards/cardFilters";
import { ProgressiveCardImage } from "@/features/inquiry/cards/ProgressiveCardImage";
import { WaterLiveSnapshotCardPreview } from "@/features/inquiry/water/WaterLiveSnapshotViews";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";

export type GameCardGridCard = {
  id: string;
  category: CategoryKey;
  title: string;
  revealedTitle: string;
  imageSrc: string;
  localId: number;
  content: string;
  unlocked: boolean;
  unlockedAt: string | null;
  sourceType?: "fixedImage" | "interactiveSnapshot";
  snapshotMeta?: EvidenceSnapshotMeta;
};

function shouldUseWaterLiveSnapshotPreview(card?: GameCardGridCard | null) {
  return (
    isWaterLiveSnapshotMeta(card?.snapshotMeta) ||
    card?.sourceType === "interactiveSnapshot"
  );
}

function getDisplayTitle(card: GameCardGridCard) {
  return card.unlocked ? card.revealedTitle : card.title;
}

const preloadedCardImageUrls = new Set<string>();

function preloadCardImage(src: string) {
  if (!src || preloadedCardImageUrls.has(src)) return;
  preloadedCardImageUrls.add(src);

  const image = new Image();
  image.decoding = "async";
  image.src = src;

  if (typeof image.decode === "function") {
    image.decode().catch(() => {
      // 圖片預解碼失敗時交給瀏覽器正常載入，不中斷卡牌顯示。
    });
  }
}

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleCardImagePreload(cards: GameCardGridCard[]) {
  const idleWindow = window as IdleWindow;
  const imageSources = Array.from(
    new Set(
      cards
        .filter((card) => !shouldUseWaterLiveSnapshotPreview(card))
        .map((card) => card.imageSrc)
        .filter(Boolean),
    ),
  );
  let index = 0;
  let cancelled = false;
  let idleId: number | null = null;
  let timeoutId: number | null = null;

  const runBatch = () => {
    if (cancelled) return;

    const end = Math.min(index + 6, imageSources.length);
    while (index < end) {
      preloadCardImage(imageSources[index]);
      index += 1;
    }

    if (index < imageSources.length) {
      scheduleNextBatch();
    }
  };

  const scheduleNextBatch = () => {
    if (cancelled) return;

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(runBatch, { timeout: 600 });
      return;
    }

    timeoutId = globalThis.setTimeout(runBatch, 80);
  };

  scheduleNextBatch();

  return () => {
    cancelled = true;
    if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
      idleWindow.cancelIdleCallback(idleId);
    }
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  };
}

export const GameCardGrid = memo(function GameCardGrid({
  categoryCards,
  activeId,
  activeCategoryMeta,
  onOpenCard,
  justUnlockedId,
  flashingSnapshotCardId,
  categoryFlipKey,
  isActive,
}: {
  categoryCards: GameCardGridCard[];
  activeId: string | null;
  activeCategoryMeta: CategoryMeta;
  onOpenCard: (card: GameCardGridCard) => void;
  justUnlockedId: string | null;
  flashingSnapshotCardId: string | null;
  categoryFlipKey: CategoryKey | null;
  isActive: boolean;
}) {
  const [regionFilter, setRegionFilter] = useState<CardRegionFilter>([]);
  const [questionFilter, setQuestionFilter] = useState<CardQuestionFilter>([]);

  const showStudentFilters = shouldShowCardFilter(activeCategoryMeta.key);
  const showRegionFilter = shouldShowRegionFilter(activeCategoryMeta.key);
  const regionFilterOptions = useMemo(
    () => buildRegionFilterOptions(categoryCards),
    [categoryCards],
  );
  const questionFilterOptions = useMemo(
    () => getQuestionFilterOptions(activeCategoryMeta.key),
    [activeCategoryMeta.key],
  );
  const filteredCategoryCards = useMemo(
    () =>
      filterCardsByStudentSelection(
        categoryCards,
        activeCategoryMeta.key,
        regionFilter,
        questionFilter,
      ),
    [activeCategoryMeta.key, categoryCards, questionFilter, regionFilter],
  );
  useEffect(() => {
    setRegionFilter([]);
    setQuestionFilter([]);
  }, [activeCategoryMeta.key]);
  useEffect(() => {
    if (!isActive) return undefined;

    // 分類第一次被開啟後就保留在 DOM 裡；這裡只把該分類所有固定圖片
    // 分批預載與預解碼，避免往下滑時才一張一張載入造成「慢慢浮出」。
    return scheduleCardImagePreload(categoryCards);
  }, [categoryCards, isActive]);

  const toggleMultiFilterValue = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((previous) => {
      if (value === "all") return [];
      return previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value];
    });
  };

  if (categoryCards.length === 0) {
    return (
      <div
        key={activeCategoryMeta.key}
        aria-hidden={!isActive}
        className="rounded-[28px] border border-dashed border-[#d8cbb3] bg-white/82 px-5 py-8 text-center shadow-[0_12px_28px_rgba(45,41,34,0.06)]"
        style={{ display: isActive ? "block" : "none" }}
      >
        <p className="text-xl font-black tracking-[0.06em] text-[#332c24]">
          {activeCategoryMeta.key === "water"
            ? "尚未擷取水資源線索卡"
            : "目前沒有可顯示的卡牌"}
        </p>
      </div>
    );
  }

  return (
    <div
      key={activeCategoryMeta.key}
      aria-hidden={!isActive}
      className="flex flex-col gap-8"
      style={
        {
          display: isActive ? "flex" : "none",
          width: "100%",
          opacity: 1,
          transform: "translate3d(0,0,0)",
        } as React.CSSProperties
      }
    >
      {showStudentFilters ? (
        <div className="rounded-[28px] border border-[#e2d4bd] bg-white/86 p-4 shadow-[0_12px_28px_rgba(45,41,34,0.06)]">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
                {activeCategoryMeta.key === "rumor"
                  ? "選擇要查看傳言或媒體報導"
                  : activeCategoryMeta.key === "other"
                    ? "選擇要查看補充資料或人力與資源"
                    : "選擇地區以及想看的數據類型"}
              </h3>
            </div>
            <p className="rounded-full border border-[#d8cbb3] bg-[#fffaf0] px-3 py-1.5 text-xs font-black text-[#6d5e49]">
              顯示 {filteredCategoryCards.length} / {categoryCards.length} 張
            </p>
          </div>

          <div
            className={`grid gap-4 ${showRegionFilter ? "min-[700px]:grid-cols-2" : "min-[700px]:grid-cols-1"}`}
          >
            {showRegionFilter ? (
              <div>
                <p className="mb-2 text-sm font-black text-[#4a3828]">
                  顯示區域數據
                </p>
                <div className="flex flex-wrap gap-2">
                  {regionFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        toggleMultiFilterValue(option.value, setRegionFilter)
                      }
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        (
                          option.value === "all"
                            ? regionFilter.length === 0
                            : regionFilter.includes(option.value)
                        )
                          ? "border-[#6f7d5f] bg-[#edf5df] text-[#445236] shadow-sm"
                          : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-black text-[#4a3828]">
                {activeCategoryMeta.key === "rumor"
                  ? "傳言&媒體報導"
                  : activeCategoryMeta.key === "other"
                    ? "補充資料&人力與資源"
                    : "數據分類與面向"}
              </p>
              <div className="flex flex-wrap gap-2">
                {questionFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      toggleMultiFilterValue(option.value, setQuestionFilter)
                    }
                    className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                      (
                        option.value === "all"
                          ? questionFilter.length === 0
                          : questionFilter.includes(option.value)
                      )
                        ? "border-[#9b7b55] bg-[#fff0cf] text-[#5f4528] shadow-sm"
                        : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showStudentFilters && filteredCategoryCards.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#d8cbb3] bg-white/82 px-5 py-8 text-center shadow-[0_12px_28px_rgba(45,41,34,0.06)]">
          <p className="text-xl font-black tracking-[0.06em] text-[#332c24]">
            這個篩選條件目前沒有資料卡
          </p>
          <p className="mt-2 text-sm font-medium text-[#7a6754]">
            可以取消部分篩選條件，或改看其他問題類型。
          </p>
        </div>
      ) : null}

      <div
        className="uiux-card-grid"
        style={
          {
            contain: "layout paint style",
            opacity: 1,
          } as React.CSSProperties
        }
      >
        {filteredCategoryCards.map((card, cardIndex) => {
          const isOpened = activeId === card.id;
          const displayTitle = getDisplayTitle(card);
          const cardTheme = categoryCardThemeMap[card.category];
          const isWritten = card.unlocked;
          const writtenTheme = writtenCardStateMap[card.category];
          const listTheme = categoryListThemeMap[card.category];
          const isPriorityImageRow = cardIndex < 8;
          const shouldRenderLockedFaceImage =
            !card.unlocked ||
            card.id === justUnlockedId ||
            card.category === categoryFlipKey;
          const shouldRenderUnlockedFaceImage = card.unlocked;

          return (
            <button
              key={card.id}
              type="button"
              data-game-card-id={card.id}
              onClick={() => onOpenCard(card)}
              className={`relative aspect-[6/5] text-left transition-transform duration-150 active:scale-[0.99] ${card.id === flashingSnapshotCardId ? "snapshot-card-glow-flash" : ""}`}
              style={{ contain: "layout paint style" }}
            >
              <div className="hidden" />

              <div className="relative h-full [perspective:1200px]">
                <div
                  className="relative h-full w-full rounded-[28px] transform-gpu"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: `rotateY(${card.unlocked ? 180 : 0}deg)`,
                    transitionProperty: "transform",
                    transitionDuration:
                      card.id === justUnlockedId ||
                      card.category === categoryFlipKey
                        ? "800ms"
                        : "0ms",
                    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                >
                  <div
                    className={`absolute inset-0 rounded-[28px] ${
                      isWritten ? writtenTheme.shell : cardTheme.lockedFace
                    }`}
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-[28px]">
                      <div className="flex items-center justify-between px-4 py-1 text-xs tracking-[0.25em] text-slate-500">
                        <span>{activeCategoryMeta.label.toUpperCase()}</span>
                        <span>#{String(cardIndex + 1).padStart(2, "0")}</span>
                      </div>

                      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#fffdf4]">
                        {shouldRenderLockedFaceImage ? (
                          shouldUseWaterLiveSnapshotPreview(card) ? (
                            <WaterLiveSnapshotCardPreview
                              meta={card.snapshotMeta!}
                              muted
                              className="h-full w-full"
                            />
                          ) : (
                            <ProgressiveCardImage
                              src={card.imageSrc}
                              alt={`${card.title}縮圖`}
                              priority={isPriorityImageRow}
                              className="h-full w-full scale-[1.03] object-contain opacity-60 saturate-75"
                            />
                          )
                        ) : null}

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/68 via-white/46 to-[#fff7e2]/88" />

                        <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-[#d8cbb3] bg-[#fffdf4] px-4 py-2 text-[12px] font-black tracking-[0.10em] text-[#4a3828]">
                          <Lock className="h-3.5 w-3.5" />
                          待解鎖
                        </div>

                        <div className="hidden" aria-hidden="true" />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`absolute inset-0 rounded-[28px] border-2 ${
                      isWritten
                        ? listTheme.unlockedFrame
                        : cardTheme.unlockedFace
                    }`}
                    style={{
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] bg-transparent p-2">
                      {shouldRenderUnlockedFaceImage ? (
                        <div className="min-h-0 flex flex-1 items-center justify-center overflow-hidden rounded-[20px] border border-[#eadfcf] bg-[#fffdf8] p-2">
                          {shouldUseWaterLiveSnapshotPreview(card) ? (
                            <WaterLiveSnapshotCardPreview
                              meta={card.snapshotMeta!}
                              className="h-full w-full"
                            />
                          ) : (
                            <ProgressiveCardImage
                              src={card.imageSrc}
                              alt={displayTitle}
                              priority={isPriorityImageRow}
                              className="max-h-full w-full object-contain"
                            />
                          )}
                        </div>
                      ) : null}
                      <div
                        className={`mt-2 shrink-0 rounded-[18px] border px-3 py-2 text-center ${listTheme.unlockedFooter}`}
                      >
                        <p className="line-clamp-2 text-sm font-black leading-5 text-[#332c24]">
                          {displayTitle}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!card.unlocked ? (
                <div className="game-card-direct-collect-hint pointer-events-none absolute bottom-2 left-2 right-2 z-20 rounded-2xl border border-[#e2d4bd] bg-[#fffdf4] px-3 py-2 text-center text-[11px] font-semibold leading-4 tracking-[0.03em] text-[#6f5b45] shadow-[0_4px_10px_rgba(70,52,32,0.08)]">
                  點擊數據卡直接收藏 ✨
                </div>
              ) : null}

              {isOpened ? (
                <div
                  className={`pointer-events-none absolute inset-0 rounded-[28px] ring-2 ${listTheme.activeRing}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
