export const SUSPECT_GROUPS = [
  {
    id: "public",
    name: "一般民眾",
    shortName: "一般民眾",
    description:
      "為了生活、通勤、旅遊或送貨而使用道路的人，可能讓石虎移動時遇到更多危險。",
  },
  {
    id: "developer",
    name: "建商/企業",
    shortName: "建商/企業",
    description:
      "推動土地開發、建設或產業使用的角色，可能改變石虎原本的生活空間。",
  },
  {
    id: "resident",
    name: "當地居民",
    shortName: "當地居民",
    description:
      "和石虎住在同一片淺山的人，可能因家禽損失或生活不安與石虎產生衝突。",
  },
  {
    id: "farmer",
    name: "農民",
    shortName: "農民",
    description:
      "管理農地與作物的人，藥劑、毒鼠藥或陷阱可能造成看不見的環境傷害。",
  },
  {
    id: "authority",
    name: "地方主管機關",
    shortName: "地方主管機關",
    description:
      "負責道路、土地規劃、保育政策與管理的單位，規劃若忽略石虎需求，危機可能持續累積。",
  },
  {
    id: "media",
    name: "媒體",
    shortName: "媒體",
    description:
      "傳播消息並影響大眾看法的角色，未查證或放大衝突的報導可能讓石虎被誤解。",
  },
];

export const DEFAULT_SUSPECT_ROLE_RANKING = SUSPECT_GROUPS.map(
  (group) => group.id,
);
