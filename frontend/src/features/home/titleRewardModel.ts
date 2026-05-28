export type TitleReward = {
  id: string;
  name: string;
  description: string;
};

export const HOME_TITLE_REWARDS: TitleReward[] = [
  {
    id: "water_novice",
    name: "略懂水性",
    description: "蒐集 3 張水資源卡牌",
  },
  {
    id: "water_advanced",
    name: "有點水準",
    description: "蒐集 7 張水資源卡牌",
  },
  {
    id: "water_master",
    name: "水很深",
    description: "蒐集 10 張水資源卡牌",
  },
  {
    id: "land_novice",
    name: "腳踏實地",
    description: "蒐集 3 張土地資料卡牌",
  },
  {
    id: "land_advanced",
    name: "有土有真相",
    description: "蒐集 7 張土地資料卡牌",
  },
  {
    id: "land_master",
    name: "地頭蛇",
    description: "蒐集 10 張土地資料卡牌",
  },
  {
    id: "leopard_novice",
    name: "初生之虎",
    description: "蒐集 3 張石虎相關資料卡牌",
  },
  {
    id: "leopard_advanced",
    name: "虎視眈眈",
    description: "蒐集 7 張石虎相關資料卡牌",
  },
  {
    id: "leopard_master",
    name: "如虎添翼",
    description: "蒐集 10 張石虎相關資料卡牌",
  },
  {
    id: "rumor_novice",
    name: "小耳朵",
    description: "蒐集 3 張 NPC 傳言卡牌",
  },
  {
    id: "rumor_advanced",
    name: "三姑六婆",
    description: "蒐集 7 張 NPC 傳言卡牌",
  },
  {
    id: "rumor_master",
    name: "八卦王",
    description: "蒐集 10 張 NPC 傳言卡牌",
  },
  {
    id: "cross_novice",
    name: "東張西望",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 2 張卡牌",
  },
  {
    id: "cross_advanced",
    name: "略懂略懂",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 4 張卡牌",
  },
  {
    id: "cross_master",
    name: "四界都有你",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 6 張卡牌",
  },
  {
    id: "investigation_novice",
    name: "見習調查員",
    description: "完成 1 份探究調查書",
  },
  {
    id: "investigation_advanced",
    name: "資深調查員",
    description: "完成 4 份探究調查書",
  },
  {
    id: "investigation_master",
    name: "首席調查官",
    description: "完成 5 份探究調查書",
  },
];

export function isSupportedHomeTitleReward(
  title: TitleReward | null | undefined,
) {
  return Boolean(title?.id) && !String(title?.id).startsWith("other_");
}

export function getMedalStyle(title: TitleReward) {
  const isMaster = title.id.includes("master") || title.name.includes("大師");
  const isAdvanced =
    title.id.includes("advanced") || title.name.includes("老手");

  if (isMaster) {
    return {
      rank: "MASTER",
      label: "大師級勳章",
      shine: "from-[#fff4c0] via-[#d8a93b] to-[#8b6320]",
      metal: "from-[#fff7cf] via-[#d8aa3d] to-[#8b6422]",
      border: "border-[#b7892e]",
      ribbon: "from-[#7b2f2f] via-[#9f4a3f] to-[#5d2323]",
      text: "text-[#5f4217]",
      glow: "shadow-[0_14px_28px_rgba(139,100,34,0.24)]",
      star: "★ ★ ★",
      starText:
        "text-[#fff2a8] [text-shadow:0_1px_0_rgba(95,66,23,0.55),0_0_6px_rgba(255,244,192,0.85)]",
    };
  }

  if (isAdvanced) {
    return {
      rank: "VETERAN",
      label: "老手級勳章",
      shine: "from-[#ffffff] via-[#c9c9c4] to-[#8c8d88]",
      metal: "from-[#ffffff] via-[#c9c9c4] to-[#7f817c]",
      border: "border-[#9a9c96]",
      ribbon: "from-[#3f4f5e] via-[#607082] to-[#2f3b48]",
      text: "text-[#4f514c]",
      glow: "shadow-[0_14px_28px_rgba(75,85,99,0.18)]",
      star: "★ ★",
      starText:
        "text-[#f7f7ef] [text-shadow:0_1px_0_rgba(79,81,76,0.55),0_0_6px_rgba(255,255,255,0.85)]",
    };
  }

  return {
    rank: "ROOKIE",
    label: "新手級勳章",
    shine: "from-[#ffe4c4] via-[#b9784b] to-[#7a442b]",
    metal: "from-[#ffe2bf] via-[#b9784b] to-[#764126]",
    border: "border-[#9a5f3d]",
    ribbon: "from-[#5d4a3f] via-[#8a6b58] to-[#49382f]",
    text: "text-[#70452c]",
    glow: "shadow-[0_14px_28px_rgba(120,65,38,0.18)]",
    star: "★",
    starText:
      "text-[#ffd7a3] [text-shadow:0_1px_0_rgba(112,69,44,0.6),0_0_5px_rgba(255,226,191,0.75)]",
  };
}
