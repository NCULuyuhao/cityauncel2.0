import { categoryMetaMap } from "@/features/inquiry/cards/cardPresentation";
import { MIAOLI_TOWNS } from "@/features/inquiry/water/waterResources";

type AiHelperCardProfileInput = {
  category: keyof typeof categoryMetaMap;
  title?: string;
  revealedTitle?: string;
  content?: string;
};

export function inferAiHelperCardProfileForClient(
  card: AiHelperCardProfileInput,
) {
  const title = card.revealedTitle || card.title || "";
  const text = `${title} ${card.content || ""}`;
  const categoryLabel = categoryMetaMap[card.category]?.label || card.category;
  const town = MIAOLI_TOWNS.find((item) => text.includes(item)) || "";
  let dataType = "一般線索";
  let possibleUse = "可作為探究石虎危機的參考線索";
  const crisisLinks: string[] = [];
  const addLink = (link: string) => {
    if (!crisisLinks.includes(link)) crisisLinks.push(link);
  };

  if (/人口密度/.test(text)) {
    dataType = "人口密度";
    possibleUse = "判斷人類活動壓力是否較高";
    addLink("人類活動");
    addLink("開發壓力");
  } else if (/公路交通量|交通量|車流/.test(text)) {
    dataType = "公路交通量";
    possibleUse = "判斷道路與車流是否增加石虎移動風險";
    addLink("道路風險");
    addLink("路殺");
  } else if (/土地樣貌|土地使用|棲地/.test(text)) {
    dataType = text.includes("棲地") ? "棲地分布" : "土地樣貌";
    possibleUse = "觀察棲地、開發或土地利用變化";
    addLink("棲地破碎");
    addLink("土地開發");
  } else if (/石虎出沒|出沒位置/.test(text)) {
    dataType = "石虎出沒位置";
    possibleUse = "確認石虎活動位置與可能重疊風險";
    addLink("活動範圍");
    addLink("地區風險");
  } else if (/石虎意外|意外統計|意外報告|路殺/.test(text)) {
    dataType = text.includes("路殺") ? "路殺位置" : "石虎意外";
    possibleUse = "查看石虎已發生的傷亡或事故線索";
    addLink("道路風險");
    addLink("人獸衝突");
  } else if (/傳言|新聞|報導|雞|家禽|捕獲|圍網/.test(text)) {
    dataType = /新聞|報導/.test(text) ? "新聞報導" : "傳言/衝突線索";
    possibleUse = "了解人類看法、誤解或雞舍衝突";
    addLink("人獸衝突");
    addLink("傳言誤解");
  } else if (/觀光/.test(text)) {
    dataType = "觀光資料";
    possibleUse = "判斷遊客活動是否可能干擾棲地";
    addLink("人類活動");
    addLink("干擾壓力");
  } else if (/公路位置/.test(text)) {
    dataType = "公路位置";
    possibleUse = "對照道路與石虎棲地或出沒位置";
    addLink("道路切割");
    addLink("路殺");
  } else if (/通報|獎勵|巡守|友善農地/.test(text)) {
    dataType = "保育行動/通報";
    possibleUse = "了解人類如何回應石虎危機";
    addLink("保育行動");
    addLink("社區參與");
  } else if (
    /水|降雨|RPI|水質|河川|水庫|地下水|灌溉/.test(text) ||
    card.category === "water"
  ) {
    dataType = "水環境資料";
    possibleUse = "觀察水環境是否影響棲地條件";
    addLink("水環境");
    addLink("棲地條件");
  }

  return { categoryLabel, town, dataType, possibleUse, crisisLinks };
}
