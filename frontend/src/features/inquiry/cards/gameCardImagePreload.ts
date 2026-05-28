/**
 * 數據卡圖片預載工具。
 * 讓圖片解碼排在瀏覽器空閒時間執行，避免學生切換分類或滑動時才大量載圖。
 */

import { runWhenBrowserIsIdle } from "@/utils/browserIdle";
import { CATEGORY_KEYS } from "@/features/inquiry/cards/cardCatalog";
import type { CategoryKey } from "@/features/inquiry/cards/cardPresentation";

type PreloadableGameCard = {
  category: CategoryKey;
  imageSrc: string;
};

export type ImagePreloadPriority = "gentle" | "fast";

const loadedImageCategoryKeys = new Set<CategoryKey>();
const preloadedCardImageSrcs = new Set<string>();
const preloadingCardImageSrcs = new Set<string>();

function markPreloadedCategoryIfComplete(
  category: CategoryKey,
  imageSrcsByCategory: Record<CategoryKey, string[]>,
) {
  const categoryImageSrcs = imageSrcsByCategory[category];
  if (categoryImageSrcs.every((src) => preloadedCardImageSrcs.has(src))) {
    loadedImageCategoryKeys.add(category);
  }
}

export function preloadGameCardImages(
  cardsToPreload: PreloadableGameCard[],
  priority: ImagePreloadPriority = "gentle",
) {
  if (typeof window === "undefined") return () => undefined;

  const imageSrcsByCategory = CATEGORY_KEYS.reduce(
    (groupedSrcs, category) => {
      groupedSrcs[category] = cardsToPreload
        .filter((card) => card.category === category)
        .map((card) => card.imageSrc);
      return groupedSrcs;
    },
    {} as Record<CategoryKey, string[]>,
  );

  // 讓分類平均預載，而不是先把某一類全部載完才輪到後面的分類。
  const maxCategoryImageCount = Math.max(
    ...CATEGORY_KEYS.map((category) => imageSrcsByCategory[category].length),
  );
  const orderedImageJobs = Array.from({ length: maxCategoryImageCount })
    .flatMap((_, index) =>
      CATEGORY_KEYS.flatMap((category) => {
        const src = imageSrcsByCategory[category][index];
        return src ? [{ category, src }] : [];
      }),
    )
    .filter(({ src }) => !preloadedCardImageSrcs.has(src));

  if (orderedImageJobs.length === 0) {
    CATEGORY_KEYS.forEach((category) =>
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory),
    );
    return () => undefined;
  }

  let didCancel = false;
  let nextJobIndex = 0;
  let cancelIdleBatch = () => undefined as void;
  let batchTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const preloadOneImage = (category: CategoryKey, src: string) => {
    if (preloadedCardImageSrcs.has(src) || preloadingCardImageSrcs.has(src)) {
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory);
      return;
    }

    preloadingCardImageSrcs.add(src);
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";

    const markDone = () => {
      preloadingCardImageSrcs.delete(src);
      preloadedCardImageSrcs.add(src);
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory);
    };

    image.onload = markDone;
    image.onerror = markDone;
    image.src = src;

    // decode() 會把圖片解碼工作提前做掉，避免點分類展開時才解碼造成頓一下。
    if (typeof image.decode === "function") {
      void image
        .decode()
        .then(markDone)
        .catch(() => undefined);
    }
  };

  const runBatch = () => {
    if (didCancel) return;

    const batchSize = priority === "fast" ? 10 : 4;
    const batchDelay = priority === "fast" ? 24 : 120;
    const batchEnd = Math.min(
      nextJobIndex + batchSize,
      orderedImageJobs.length,
    );

    for (; nextJobIndex < batchEnd; nextJobIndex += 1) {
      const job = orderedImageJobs[nextJobIndex];
      preloadOneImage(job.category, job.src);
    }

    if (nextJobIndex >= orderedImageJobs.length) return;

    batchTimer = globalThis.setTimeout(() => {
      cancelIdleBatch = runWhenBrowserIsIdle(
        runBatch,
        priority === "fast" ? 80 : 240,
      );
    }, batchDelay);
  };

  cancelIdleBatch = runWhenBrowserIsIdle(
    runBatch,
    priority === "fast" ? 80 : 240,
  );

  return () => {
    didCancel = true;
    cancelIdleBatch();
    if (batchTimer !== null) globalThis.clearTimeout(batchTimer);
  };
}
