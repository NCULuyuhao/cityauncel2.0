/**
 * 首頁調查書摘要卡片整理工具。
 * 將調查書中的證據卡資料轉成首頁可直接顯示的縮圖、標題與內容。
 */

import { mediaUrl } from "@/api/apiClient";

export type EvidenceSnapshotMeta = {
  category?: string;
  type?: string;
  subcategory?: string;
  filterLabel?: string;
  townName?: string;
  metric?: string;
  unit?: string;
  sourceName?: string;
  interpretationText?: string;
  chartData?: { label: string; value: number }[];
  photoSnapshotDataUrl?: string;
  photoSnapshotImageUrl?: string;
  photoSnapshotRelativeUrl?: string;
  photoSnapshotFilename?: string;
};

export type EvidenceCardSummary =
  | string
  | {
      id: string;
      title?: string;
      imageSrc?: string;
      image?: string;
      content?: string;
      note?: string;
      category?: string;
      type?: string;
      sourceType?: string;
      source?: string;
      snapshotMeta?: EvidenceSnapshotMeta | null;
      snapshot?: EvidenceSnapshotMeta | null;
    };

export type DisplayEvidenceCardSummary = {
  id: string;
  title: string;
  imageSrc: string;
  content: string;
};

const CARD_IMAGE_FILES_BY_CATEGORY: Record<string, string[]> = {
  water: [],
  land: [
    "dahu_development_population_density.webp",
    "dahu_development_traffic_volume.webp",
    "dahu_land_01.webp",
    "gongguan_development_population_density.webp",
    "gongguan_development_traffic_volume.webp",
    "gongguan_land_01.webp",
    "houlong_development_population_density.webp",
    "houlong_development_traffic_volume.webp",
    "houlong_land_01.webp",
    "miaoli_development_population_density.webp",
    "miaoli_development_traffic_volume.webp",
    "miaoli_land_01.webp",
    "nanzhuang_development_population_density.webp",
    "nanzhuang_land_01.webp",
    "sanwan_development_population_density.webp",
    "sanwan_development_traffic_volume.webp",
    "sanwan_land_01.webp",
    "sanyi_development_population_density.webp",
    "sanyi_development_traffic_volume.webp",
    "sanyi_land_01.webp",
    "shitan_development_population_density.webp",
    "shitan_development_traffic_volume.webp",
    "shitan_land_01.webp",
    "taian_development_population_density.webp",
    "taian_land_01.webp",
    "toufen_development_population_density.webp",
    "toufen_development_traffic_volume.webp",
    "tongluo_development_population_density.webp",
    "tongluo_development_traffic_volume.webp",
    "tongluo_land_01.webp",
    "tongxiao_development_population_density.webp",
    "tongxiao_development_traffic_volume.webp",
    "tongxiao_land_01.webp",
    "toufen_land_01.webp",
    "touwu_development_population_density.webp",
    "touwu_land_01.webp",
    "xihu_development_population_density.webp",
    "xihu_development_traffic_volume.webp",
    "xihu_land_01.webp",
    "yuanli_development_population_density.webp",
    "yuanli_development_traffic_volume.webp",
    "yuanli_land_01.webp",
    "zaoqiao_development_population_density.webp",
    "zaoqiao_development_traffic_volume.webp",
    "zaoqiao_land_01.webp",
    "zhunan_development_population_density.webp",
    "zhunan_development_traffic_volume.webp",
    "zhunan_land_01.webp",
    "zhuolan_development_population_density.webp",
    "zhuolan_development_traffic_volume.webp",
    "zhuolan_land_01.webp",
  ],
  leopard: [
    "dahu_leopard_01.webp",
    "dahu_leopard_03.webp",
    "gongguan_leopard_01.webp",
    "gongguan_leopard_03.webp",
    "houlong_leopard_01.webp",
    "houlong_leopard_02_1.webp",
    "houlong_leopard_02_2.webp",
    "houlong_leopard_02_3.webp",
    "houlong_leopard_03.webp",
    "miaoli_leopard_01.webp",
    "miaoli_leopard_03.webp",
    "nanzhuang_leopard_01.webp",
    "nanzhuang_leopard_03.webp",
    "sanwan_leopard_01.webp",
    "sanwan_leopard_03.webp",
    "sanyi_leopard_01.webp",
    "sanyi_leopard_02_1.webp",
    "sanyi_leopard_03.webp",
    "shitan_leopard_01.webp",
    "shitan_leopard_02_1.webp",
    "shitan_leopard_03.webp",
    "taian_leopard_03.webp",
    "tongluo_leopard_01.webp",
    "tongluo_leopard_03.webp",
    "tongxiao_leopard_01.webp",
    "tongxiao_leopard_02_1.webp",
    "tongxiao_leopard_02_2.webp",
    "tongxiao_leopard_02_3.webp",
    "tongxiao_leopard_03.webp",
    "toufen_leopard_01.webp",
    "toufen_leopard_03.webp",
    "touwu_leopard_01.webp",
    "touwu_leopard_03.webp",
    "xihu_leopard_01.webp",
    "xihu_leopard_03.webp",
    "yuanli_leopard_01.webp",
    "yuanli_leopard_02_1.webp",
    "yuanli_leopard_03.webp",
    "zaoqiao_leopard_01.webp",
    "zaoqiao_leopard_03.webp",
    "zhunan_leopard_03.webp",
    "zhuolan_leopard_01.webp",
    "zhuolan_leopard_02_1.webp",
    "zhuolan_leopard_03.webp",
  ],
  rumor: [
    "rumor_01.webp",
    "rumor_02.webp",
    "rumor_03.webp",
    "rumor_04.webp",
    "rumor_05.webp",
    "rumor_06.webp",
    "rumor_07.webp",
    "rumor_08.webp",
    "rumor_09.webp",
    "rumor_10.webp",
    "rumor_11.webp",
    "rumor_12.webp",
    "rumor_13.webp",
    "rumor_14.webp",
    "rumor_15.webp",
    "rumor_16.webp",
    "rumor_17.webp",
    "rumor_18.webp",
    "news_01.webp",
    "news_02.webp",
    "news_03.webp",
    "news_04.webp",
    "news_05.webp",
    "news_06.webp",
    "news_07.webp",
    "news_08.webp",
    "news_09.webp",
    "news_10.webp",
    "news_11.webp",
    "news_12.webp",
    "news_13.webp",
    "news_14.webp",
    "news_15.webp",
  ],
  other: [
    "Global_Card_01.webp",
    "Global_Card_02.webp",
    "Global_Card_03.webp",
    "Global_Card_04.webp",
    "Global_Card_05.webp",
    "Global_Card_06.webp",
    "Global_Card_07.webp",
    "Global_Card_08.webp",
    "Global_Card_09.webp",
    "Global_Card_10.webp",
    "Global_Card_11.webp",
    "Global_Card_12.webp",
    "Global_Card_13.webp",
  ],
};

const CARD_CATEGORY_LABEL: Record<string, string> = {
  water: "水資源",
  land: "土地資料",
  leopard: "石虎相關資訊",
  rumor: "傳言",
  other: "其他",
};

function getFallbackCardImageSrc(category: string, localNumber: number) {
  const cardImageFiles = CARD_IMAGE_FILES_BY_CATEGORY[category] ?? [];
  const index =
    Number.isFinite(localNumber) && localNumber > 0 ? localNumber - 1 : 0;
  const fileName = cardImageFiles[index] ?? cardImageFiles[0];
  return fileName ? `/card/${fileName}` : "/card/card-back-leopard-cat.webp";
}

function escapeEvidenceSvgText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getEvidenceSnapshotThumbnailDataUrl(
  meta?: EvidenceSnapshotMeta | null,
) {
  if (!meta || typeof meta !== "object") return "";

  const chartData = Array.isArray(meta.chartData)
    ? meta.chartData
        .map((point) => ({
          label: String(point?.label ?? ""),
          value: Number(point?.value ?? 0),
        }))
        .filter((point) => point.label || Number.isFinite(point.value))
    : [];

  const width = 1200;
  const height = 780;
  const title = meta.filterLabel || meta.townName || "快照證據卡";
  const metaCategory = meta.category || meta.type || "";
  const subcategory =
    meta.subcategory || CARD_CATEGORY_LABEL[metaCategory] || "數據快照";
  const unit = meta.unit || "";
  const maxValue = Math.max(...chartData.map((point) => point.value), 1);
  const visiblePoints = chartData.slice(0, 12);
  const barWidth =
    visiblePoints.length > 0
      ? Math.max(28, 560 / visiblePoints.length - 10)
      : 36;
  const barSvg = visiblePoints
    .map((point, index) => {
      const barHeight = Math.max(
        14,
        Math.min(250, (point.value / maxValue) * 250),
      );
      const x = 590 + index * (barWidth + 10);
      const y = 560 - barHeight;
      return `<g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="12" fill="#9fc5d6" stroke="#6c9caf" stroke-width="2" />
        <text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-size="18" font-weight="900" fill="#4f4032">${escapeEvidenceSvgText(unit === "RPI" ? point.value.toFixed(1) : Math.round(point.value))}</text>
        <text x="${x + barWidth / 2}" y="600" text-anchor="middle" font-size="15" font-weight="800" fill="#6b6258">${escapeEvidenceSvgText(point.label)}</text>
      </g>`;
    })
    .join("");

  const source = meta.sourceName
    ? `資料來源：${meta.sourceName}`
    : "學生建立的快照線索";
  const interpretation =
    meta.interpretationText ||
    "這張證據卡來自學生在水資源互動資料中建立的線索快照。";
  const interpretationLines = String(interpretation)
    .replace(/\s+/g, " ")
    .slice(0, 72)
    .match(/.{1,24}/g) || [""];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="36" fill="#fff7df" />
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="32" fill="#fffaf0" stroke="#e0cfaa" stroke-width="4" />
    <text x="64" y="88" font-size="34" font-weight="900" fill="#332c24">${escapeEvidenceSvgText(title)}</text>
    <rect x="64" y="120" width="430" height="480" rx="26" fill="#ffffff" stroke="#d8c7a4" stroke-width="3" />
    <text x="92" y="168" font-size="25" font-weight="900" fill="#4f4032">${escapeEvidenceSvgText(subcategory)}位置圖</text>
    <rect x="112" y="210" width="332" height="290" rx="30" fill="#f4fbff" stroke="#c9dce8" stroke-width="3" />
    <path d="M197 270 C250 220 341 235 375 310 C415 398 348 458 267 448 C190 439 151 346 197 270 Z" fill="#ffffff" stroke="#b9d2de" stroke-width="7" />
    <circle cx="306" cy="344" r="30" fill="#9fc5d6" stroke="#4f8aa3" stroke-width="7" />
    <text x="278" y="548" font-size="24" font-weight="900" text-anchor="middle" fill="#4f4032">${escapeEvidenceSvgText(meta.townName || "水資源")}</text>
    <rect x="548" y="120" width="588" height="480" rx="26" fill="#ffffff" stroke="#d8c7a4" stroke-width="3" />
    <text x="584" y="168" font-size="25" font-weight="900" fill="#4f4032">數據分析圖</text>
    <line x1="584" y1="560" x2="1110" y2="560" stroke="#c9dce8" stroke-width="4" />
    ${barSvg}
    <rect x="64" y="630" width="1072" height="76" rx="22" fill="#f7ecd5" stroke="#d8c7a4" stroke-width="2" />
    <text x="92" y="660" font-size="20" font-weight="900" fill="#5c503e">資料解讀</text>
    <text x="92" y="688" font-size="19" font-weight="800" fill="#5c503e">${interpretationLines.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 23}">${escapeEvidenceSvgText(line)}</tspan>`).join("")}</text>
    <text x="1108" y="730" text-anchor="end" font-size="16" font-weight="800" fill="#8a7a62">${escapeEvidenceSvgText(source)}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveEvidenceCardSummary(
  card: EvidenceCardSummary,
): DisplayEvidenceCardSummary {
  const id = typeof card === "string" ? card : card.id;
  const [category, rawNumber] = id.split("-");
  const localNumber = Number(rawNumber);
  const fallbackImageSrc = getFallbackCardImageSrc(category, localNumber);
  const fallbackTitle = `${CARD_CATEGORY_LABEL[category] || "證據"}資料卡${Number.isFinite(localNumber) && localNumber > 0 ? ` ${localNumber}` : ""}`;

  if (typeof card === "string") {
    return {
      id,
      title: fallbackTitle,
      imageSrc: fallbackImageSrc,
      content: "",
    };
  }

  const snapshotMeta = card.snapshotMeta || card.snapshot || null;
  const snapshotPhotoImageSrc =
    snapshotMeta && typeof snapshotMeta.photoSnapshotImageUrl === "string"
      ? mediaUrl(snapshotMeta.photoSnapshotImageUrl)
      : snapshotMeta && typeof snapshotMeta.photoSnapshotDataUrl === "string"
        ? snapshotMeta.photoSnapshotDataUrl
        : "";
  const snapshotImageSrc = getEvidenceSnapshotThumbnailDataUrl(snapshotMeta);

  return {
    id,
    title: card.title || fallbackTitle,
    imageSrc:
      mediaUrl(card.imageSrc) ||
      mediaUrl(card.image) ||
      snapshotPhotoImageSrc ||
      snapshotImageSrc ||
      fallbackImageSrc,
    content: card.content || card.note || "",
  };
}
