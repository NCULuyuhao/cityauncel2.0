import { motion } from "framer-motion";
import { BookOpen, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  categoryListThemeMap,
  categoryMetaMap,
  categoryTabThemeMap,
} from "@/features/inquiry/cards/cardPresentation";
import { CATEGORY_KEYS } from "@/features/inquiry/cards/cardCatalog";

type CategoryKey = "water" | "land" | "leopard" | "rumor" | "other";

export function CategoryTabs({
  activeCategory,
  onChange,
  unlockedCountByCategory,
  totalCountByCategory,
  totalUnlockedCount,
  totalCardCount,
  currentInquiryTitle,
  onRequestFinish,
}: {
  activeCategory: CategoryKey | null;
  onChange: (category: CategoryKey) => void;
  unlockedCountByCategory: Record<CategoryKey, number>;
  totalCountByCategory: Record<CategoryKey, number>;
  totalUnlockedCount: number;
  totalCardCount: number;
  currentInquiryTitle: string;
  onRequestFinish: () => void;
}) {
  const activeListTheme = activeCategory
    ? categoryListThemeMap[activeCategory]
    : null;
  const listBackgroundColor =
    activeListTheme?.pageBg ?? "rgba(255, 243, 207, 0.78)";

  return (
    <div
      className={`relative mb-8 overflow-hidden rounded-[34px] border p-6 shadow-[0_22px_70px_rgba(45,41,34,0.09)] backdrop-blur-xl ${
        activeListTheme?.page ?? "border-[#dfd3bd]/80"
      }`}
      style={{ backgroundColor: listBackgroundColor }}
    >
      <div className="mb-5 rounded-[28px] border border-white/55 bg-white/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] sm:px-5">
        <div className="grid items-center gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_minmax(14rem,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(16rem,1.1fr)_minmax(0,1fr)]">
          <div className="order-2 flex min-w-0 items-center justify-center gap-2 text-center sm:gap-3 lg:order-1 lg:justify-start lg:text-left">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border sm:h-11 sm:w-11 ${
                activeListTheme?.headerIcon ??
                "border-[#bdb294] bg-[#f7f1e3] text-[#6f7d5f]"
              }`}
            >
              <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="truncate font-serif text-base font-semibold tracking-[0.08em] text-stone-700 sm:text-lg">
              數據清單
            </p>
          </div>

          <div className="order-1 min-w-0 overflow-hidden text-center lg:order-2">
            <p className="mx-auto max-w-full truncate text-xl font-[1000] leading-tight tracking-[0.03em] text-[#4f3f2c] drop-shadow-[0_1px_0_rgba(255,250,240,0.9)] sm:text-2xl md:text-[1.7rem] lg:text-3xl xl:text-[2rem]">
              {currentInquiryTitle}
            </p>
          </div>

          <div className="order-3 grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto] sm:justify-center lg:flex lg:flex-wrap lg:items-center lg:justify-end lg:gap-3">
            <div className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[#c8b48f] bg-[#fffaf0]/85 px-3 py-2 text-sm font-semibold text-[#5f5545] sm:px-4 lg:order-2">
              <BookOpen className="h-4 w-4 shrink-0 text-[#6f7d5f]" />
              <span className="whitespace-nowrap">已解鎖</span>
              <span
                className={`rounded-full border px-3 py-1 font-black ${
                  activeListTheme?.counter ??
                  "border-[#c8b48f] bg-white text-[#6f7d5f]"
                }`}
              >
                {totalUnlockedCount} / {totalCardCount}
              </span>
            </div>

            <Button
              type="button"
              onClick={onRequestFinish}
              className="min-h-[44px] rounded-2xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-2.5 font-black text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0 lg:order-1"
            >
              提前結束
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[780px]:grid-cols-3 xl:grid-cols-5">
        {CATEGORY_KEYS.map((key) => {
          const item = categoryMetaMap[key];
          const active = activeCategory === key;
          const theme = categoryTabThemeMap[key];
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(key)}
              className={[
                "relative overflow-hidden rounded-[26px] border px-4 py-4 text-left transition",
                active ? theme.active : theme.inactive,
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-full border border-stone-200 bg-white/80 p-2 text-stone-600">
                  {item.icon}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${theme.badge}`}
                  >
                    {unlockedCountByCategory[key]} / {totalCountByCategory[key]}
                  </span>
                  {active ? (
                    <span className="rounded-full border border-[#c8b48f] bg-[#fffaf0] px-3 py-1 text-xs font-medium text-[#6d5e49]">
                      目前分類
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <p className="font-serif text-xl font-semibold tracking-[0.06em] text-stone-800">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {item.subtitle}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
