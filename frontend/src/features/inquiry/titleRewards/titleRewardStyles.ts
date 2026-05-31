/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一稱號樣式與條件設定，集中管理獎勵外觀。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import {
  titleRewardPool,
  type TitleReward,
} from "@/features/inquiry/cards/cardPresentation";
import { TITLE_REWARD_CATEGORY_KEYS } from "@/features/inquiry/cards/cardCatalog";

type TitleTier = "novice" | "advanced" | "master";
type TitleTheme = "water" | "land" | "leopard" | "rumor" | "cross";

export function getTitleTier(titleId: string): TitleTier {
  if (titleId.includes("master")) return "master";
  if (titleId.includes("advanced")) return "advanced";
  return "novice";
}

export function isSupportedInquiryTitleReward(
  title: TitleReward | null | undefined,
) {
  return Boolean(title?.id) && !String(title?.id).startsWith("other_");
}

export function getTitleTheme(titleId: string): TitleTheme {
  if (titleId.includes("water")) return "water";
  if (titleId.includes("land")) return "land";
  if (titleId.includes("leopard")) return "leopard";
  if (titleId.includes("rumor")) return "rumor";
  return "cross";
}

export function getTitleMedalStyle(titleOrId: TitleReward | string) {
  const id = typeof titleOrId === "string" ? titleOrId : titleOrId.id;
  const tier = getTitleTier(id);

  if (tier === "master") {
    return {
      rank: "MASTER",
      metal: "from-[#fff7cf] via-[#d8aa3d] to-[#8b6422]",
      shine: "from-[#fff4c0] via-[#d8a93b] to-[#8b6320]",
      border: "border-[#b7892e]",
      ribbon: "from-[#7b2f2f] via-[#9f4a3f] to-[#5d2323]",
      text: "text-[#5f4217]",
      glow: "shadow-[0_14px_28px_rgba(139,100,34,0.24)]",
      stars: "★★★",
      starText:
        "text-[#fff2a8] [text-shadow:0_1px_0_rgba(95,66,23,0.55),0_0_6px_rgba(255,244,192,0.85)]",
    };
  }

  if (tier === "advanced") {
    return {
      rank: "VETERAN",
      metal: "from-[#ffffff] via-[#c9c9c4] to-[#7f817c]",
      shine: "from-[#ffffff] via-[#c9c9c4] to-[#8c8d88]",
      border: "border-[#9a9c96]",
      ribbon: "from-[#3f4f5e] via-[#607082] to-[#2f3b48]",
      text: "text-[#4f514c]",
      glow: "shadow-[0_14px_28px_rgba(75,85,99,0.18)]",
      stars: "★★",
      starText:
        "text-[#f7f7ef] [text-shadow:0_1px_0_rgba(79,81,76,0.55),0_0_6px_rgba(255,255,255,0.85)]",
    };
  }

  return {
    rank: "ROOKIE",
    metal: "from-[#ffe2bf] via-[#b9784b] to-[#764126]",
    shine: "from-[#ffe4c4] via-[#b9784b] to-[#7a442b]",
    border: "border-[#9a5f3d]",
    ribbon: "from-[#5d4a3f] via-[#8a6b58] to-[#49382f]",
    text: "text-[#70452c]",
    glow: "shadow-[0_14px_28px_rgba(120,65,38,0.18)]",
    stars: "★",
    starText:
      "text-[#ffd7a3] [text-shadow:0_1px_0_rgba(112,69,44,0.6),0_0_5px_rgba(255,226,191,0.75)]",
  };
}

export function getRewardChecks(
  unlockedCountByCategory: Record<
    (typeof TITLE_REWARD_CATEGORY_KEYS)[number],
    number
  >,
) {
  const categoryChecks = TITLE_REWARD_CATEGORY_KEYS.flatMap((category) => [
    {
      reward: titleRewardPool[`${category}_novice`],
      isUnlocked: unlockedCountByCategory[category] >= 3,
    },
    {
      reward: titleRewardPool[`${category}_advanced`],
      isUnlocked: unlockedCountByCategory[category] >= 7,
    },
    {
      reward: titleRewardPool[`${category}_master`],
      isUnlocked: unlockedCountByCategory[category] >= 10,
    },
  ]);

  const crossChecks = [
    { reward: titleRewardPool.cross_novice, threshold: 2 },
    { reward: titleRewardPool.cross_advanced, threshold: 4 },
    { reward: titleRewardPool.cross_master, threshold: 6 },
  ].map(({ reward, threshold }) => ({
    reward,
    isUnlocked: TITLE_REWARD_CATEGORY_KEYS.every(
      (category) => unlockedCountByCategory[category] >= threshold,
    ),
  }));

  return [...categoryChecks, ...crossChecks];
}
