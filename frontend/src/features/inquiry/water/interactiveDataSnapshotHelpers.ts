import { createCardFromStoredSnapshotCard } from "@/features/inquiry/snapshots/snapshotCardFactory";
import {
  buildSnapshotSvgDataUrl as buildSnapshotSvgDataUrlFromBuilder,
  formatRpiNumber,
  getRainfallLevelColor,
  getRpiLevel,
  roundRpiValue,
  type SnapshotBuilderDependencies,
} from "@/features/inquiry/snapshots/snapshotBuilder";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";
import type {
  CategoryKey,
  EvidenceCardSummary,
  EvidenceSnapshotMeta,
  EvidenceSourceType,
  GameCard,
  StoredUnlockedCard,
  WaterQualityStationStatusRecord,
} from "@/features/inquiry/inquiryDataTypes";
import { WATER_RPI_GIS_RIVER_SHAPES } from "@/data/waterRpiGisRiverShapes";
import { labelPositions, regions } from "@/data/miaoliMapView";
import { categoryMetaMap } from "@/features/inquiry/cards/cardPresentation";
import { CATEGORY_KEYS, createAllCards } from "@/features/inquiry/cards/cardCatalog";
import {
  ALL_TOWNS_LABEL,
  ALL_WATER_TOWNS_LABEL,
  INTERACTIVE_TOWN_OPTIONS,
  LATEST_WATER_DATA_MONTH,
  MIAOLI_TOWNS,
  RECENT_WATER_MONTH_LABELS,
  formatMonthOnlyLabel,
  formatRainfallAmount,
  getRainfallValueForTownSelection,
  getWaterTownRecordsForMonth,
  normalizeStationMonth,
  parseCsvRecords,
  splitStationList,
  toFiniteNumber,
  type WaterTownMonthlyRecord,
} from "@/features/inquiry/water/waterResources";
import {
  getPersistableImageSrc,
  getStoredCardContent,
  getStoredCardImage,
  getStoredCardSnapshot,
  getStoredCardSource,
  nowIsoTimestamp,
  stripLargeSnapshotPayload,
  toIsoTimestamp,
} from "@/features/inquiry/cards/cardSerialization";

export type InteractiveSelection = string;

export function buildWaterTownRainfallSnapshotMeta(
  selectedName: string,
  records: WaterTownMonthlyRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory: "降雨量",
    metric: "月累積雨量",
    unit: "mm",
    sourceName: "中央氣象署 CODiS 2025 年月報表、中央氣象署現存測站清單",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜地區平均月累積雨量`,
    chartData: RECENT_WATER_MONTH_LABELS.map((label) => ({
      label: formatMonthOnlyLabel(label),
      value: getRainfallValueForTownSelection(records, selectedName, label),
    })),
    createdAt: new Date().toISOString(),
  };
}

export function buildRainfallTownFillMap(
  records: WaterTownMonthlyRecord[],
  selectedName: string,
  monthLabel: string,
) {
  const monthRecords = getWaterTownRecordsForMonth(records, monthLabel).filter(
    (record) =>
      selectedName === ALL_WATER_TOWNS_LABEL || record.town === selectedName,
  );

  return Object.fromEntries(
    monthRecords.map((record) => [
      record.town,
      getRainfallLevelColor(record.rainfall),
    ]),
  );
}

export function getWaterRainfallStatusText(
  records: WaterTownMonthlyRecord[],
  selectedName: string,
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const monthText = formatMonthOnlyLabel(monthLabel);
  const displayName =
    selectedName === ALL_WATER_TOWNS_LABEL ? "整個苗栗縣" : selectedName;
  if (records.length === 0) {
    return `${displayName}，${monthText}的累積平均降雨量為0mm。`;
  }

  const rainfallValue = getRainfallValueForTownSelection(
    records,
    selectedName,
    monthLabel,
  );

  return `${displayName}，${monthText}的累積平均降雨量為${formatRainfallAmount(rainfallValue)}mm。`;
}

export type WaterRpiRiverMonthlyRecord = {
  river: string;
  basin: string;
  month: string;
  rpi: number;
  sourceSiteCount: number;
  sourceSiteNames: string[];
  rawSiteRpiValues: string;
  processedLevel: string;
  processedMethod: string;
  dataStatus: string;
};

export const ALL_WATER_RPI_LABEL = "全部河川溪流";
export const WATER_RPI_RIVER_LINE_COLOR = "#0284c7";
export const WATER_RPI_RIVER_LINE_WIDTH = 5.2;
export const WATER_RPI_STREAM_LINE_WIDTH = 3.8;
export const WATER_RPI_SUBCATEGORY_LABEL = "河川水質汙染指數(RPI)";
export const LEGACY_WATER_RPI_SUBCATEGORY_LABEL = "河川水質RPI";

// 河川水質 RPI 使用專用互動式苗栗地圖。
// 鄉鎮 SHP 與 RIVERPOLY 河川 SHP 已在 data 端以同一 CRS、同一 bounds、同一 scale/offset 產生 SVG path，前端不再做座標修正。
export const WATER_RPI_DEFAULT_ORDER = [
  "中港溪",
  "後龍溪",
  "西湖溪",
  "大安溪",
  "南港溪(苗)",
  "老庄溪",
];

export function parseWaterRpiRiverMonthlyCsv(
  csvText: string,
): WaterRpiRiverMonthlyRecord[] {
  return parseCsvRecords(csvText)
    .map((record): WaterRpiRiverMonthlyRecord | null => {
      const river = record.river?.trim() ?? "";
      const rpi = toFiniteNumber(record.processed_value);
      if (!river || rpi === null) return null;

      return {
        river,
        basin: record.basin?.trim() ?? "",
        month: normalizeStationMonth(record.month?.trim() ?? ""),
        rpi,
        sourceSiteCount: toFiniteNumber(record.source_site_count) ?? 0,
        sourceSiteNames: splitStationList(record.source_site_names ?? ""),
        rawSiteRpiValues: record.raw_site_rpi_values?.trim() ?? "",
        processedLevel: record.processed_level?.trim() ?? "",
        processedMethod: record.processed_method?.trim() ?? "",
        dataStatus: record.data_status?.trim() ?? "",
      };
    })
    .filter((record): record is WaterRpiRiverMonthlyRecord => record !== null);
}

export function getWaterRpiOptions(records: WaterRpiRiverMonthlyRecord[]) {
  const availableRivers = Array.from(
    new Set(records.map((record) => record.river)),
  );
  const orderedRivers = [
    ...WATER_RPI_DEFAULT_ORDER.filter((river) =>
      availableRivers.includes(river),
    ),
    ...availableRivers
      .filter((river) => !WATER_RPI_DEFAULT_ORDER.includes(river))
      .sort(),
  ];
  return [ALL_WATER_RPI_LABEL, ...orderedRivers];
}

export function getWaterRpiRecordsForMonth(
  records: WaterRpiRiverMonthlyRecord[],
  monthLabel: string,
) {
  return records.filter((record) => record.month === monthLabel);
}

export function getWaterRpiValueForSelection(
  records: WaterRpiRiverMonthlyRecord[],
  selectedName: string,
  monthLabel: string,
) {
  const monthRecords = getWaterRpiRecordsForMonth(records, monthLabel);
  if (monthRecords.length === 0) return 0;

  if (selectedName.startsWith("全部")) {
    return roundRpiValue(
      monthRecords.reduce((sum, record) => sum + record.rpi, 0) /
        Math.max(monthRecords.length, 1),
    );
  }

  const target = monthRecords.find((record) => record.river === selectedName);
  return target ? roundRpiValue(target.rpi) : 0;
}

export function getActiveMonthWaterRpiStats(
  records: WaterRpiRiverMonthlyRecord[],
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const points = getWaterRpiRecordsForMonth(records, monthLabel).map(
    (record) => ({
      label: record.river,
      value: roundRpiValue(record.rpi),
    }),
  );

  if (points.length === 0) {
    return {
      maxPoint: { label: "尚無資料", value: 0 },
      minPoint: { label: "尚無資料", value: 0 },
      average: 0,
    };
  }

  const maxPoint = points.reduce((highest, point) =>
    point.value > highest.value ? point : highest,
  );
  const minPoint = points.reduce((lowest, point) =>
    point.value < lowest.value ? point : lowest,
  );
  const average = roundRpiValue(
    points.reduce((sum, point) => sum + point.value, 0) /
      Math.max(points.length, 1),
  );

  return { maxPoint, minPoint, average };
}

export function buildWaterRpiSnapshotMeta(
  selectedName: string,
  subcategory: string,
  records: WaterRpiRiverMonthlyRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory,
    metric: "RPI",
    unit: "RPI",
    sourceName:
      "環境部環境資料開放平臺：河川水質監測資料 WQX_P_01；RPI公式依環境部河川污染指數說明",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜水質汙染指數RPI`,
    chartData: RECENT_WATER_MONTH_LABELS.map((label) => ({
      label: formatMonthOnlyLabel(label),
      value: getWaterRpiValueForSelection(records, selectedName, label),
    })),
    createdAt: new Date().toISOString(),
  };
}

export function getWaterRpiStatusText(
  records: WaterRpiRiverMonthlyRecord[],
  selectedName: string,
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const monthText = formatMonthOnlyLabel(monthLabel);
  if (records.length === 0) {
    return "目前正在讀取環境部河川水質監測資料整理後的RPI資料。";
  }

  if (selectedName.startsWith("全部")) {
    const stats = getActiveMonthWaterRpiStats(records, activeIndex);
    return `${monthText} 顯示各河川／溪流平均 RPI=${formatRpiNumber(stats.average)}；最高為 ${stats.maxPoint.label} RPI=${formatRpiNumber(stats.maxPoint.value)}，最低為 ${stats.minPoint.label} RPI=${formatRpiNumber(stats.minPoint.value)}。`;
  }

  const target = records.find(
    (record) => record.river === selectedName && record.month === monthLabel,
  );
  if (!target) return `${selectedName} 在 ${monthText} 尚無可用RPI資料。`;
  const level = target.processedLevel || getRpiLevel(target.rpi).label;
  return `${selectedName} 在 ${monthText} 的平均 RPI=${formatRpiNumber(target.rpi)}，屬於「${level}」。`;
}

export function getWaterRpiMapOverlay(
  selectedName: string,
  records: WaterRpiRiverMonthlyRecord[],
  monthLabel: string,
) {
  const selectedRiver = selectedName.startsWith("全部") ? "" : selectedName;
  const shapes = selectedRiver
    ? WATER_RPI_GIS_RIVER_SHAPES.filter(
        (shape) => shape.label === selectedRiver,
      )
    : WATER_RPI_GIS_RIVER_SHAPES;
  const monthRecords = getWaterRpiRecordsForMonth(records, monthLabel);

  const getShapeValue = (label: string) => {
    const matchedRecord = monthRecords.find((record) => record.river === label);
    return matchedRecord ? roundRpiValue(matchedRecord.rpi) : null;
  };

  return {
    paths: [],
    areas: shapes.flatMap((shape) => {
      const value = getShapeValue(shape.label);
      const level = value === null ? null : getRpiLevel(value);
      return shape.paths.map((d, pathIndex) => ({
        id: `${shape.id}-area-${pathIndex}`,
        d,
        color: level?.color ?? "#e5e7eb",
        strokeColor: WATER_RPI_RIVER_LINE_COLOR,
        strokeWidth:
          shape.kind === "river"
            ? WATER_RPI_RIVER_LINE_WIDTH / 12.5
            : WATER_RPI_STREAM_LINE_WIDTH / 11.2,
        opacity:
          selectedRiver && shape.label !== selectedRiver
            ? 0.18
            : value === null
              ? 0.36
              : 0.86,
      }));
    }),
    markers: shapes.map((shape) => {
      const value = getShapeValue(shape.label);
      return {
        id: `${shape.id}-marker`,
        label:
          value === null
            ? `${shape.label} 無RPI資料`
            : `${shape.label} RPI=${formatRpiNumber(value)}`,
        x: shape.x,
        y: shape.y,
        color: WATER_RPI_RIVER_LINE_COLOR,
        kind: shape.kind,
        selected: selectedRiver === shape.label,
        selectValue: shape.label,
        labelDx: shape.labelDx,
        labelDy: shape.labelDy,
        labelAnchor: shape.labelAnchor,
        labelWidth: shape.labelWidth,
      };
    }),
  };
}

export const ALL_WATER_QUALITY_STATIONS_LABEL = "全地區";

export async function fetchCsvText(path: string, label: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    throw new Error(`${label}讀取失敗：${response.status}`);
  }
  return response.text();
}

export function parseWaterQualityStationStatusCsv(
  csvText: string,
): WaterQualityStationStatusRecord[] {
  return parseCsvRecords(csvText)
    .map((record): WaterQualityStationStatusRecord | null => {
      const siteId = record.site_id?.trim() ?? "";
      const siteName = record.site_name?.trim() ?? "";
      const longitude = toFiniteNumber(record.longitude);
      const latitude = toFiniteNumber(record.latitude);
      const mapX = toFiniteNumber(record.map_x);
      const mapY = toFiniteNumber(record.map_y);
      if (
        !siteId ||
        !siteName ||
        longitude === null ||
        latitude === null ||
        mapX === null ||
        mapY === null
      ) {
        return null;
      }

      return {
        siteId,
        siteName,
        county: record.county?.trim() ?? "",
        township: record.township?.trim() ?? "",
        basin: record.basin?.trim() ?? "",
        river: record.river?.trim() ?? "",
        longitude,
        latitude,
        mapX,
        mapY,
        siteAddress: record.site_address?.trim() ?? "",
        statusOfUse: record.status_of_use?.trim() ?? "",
        statusCode: record.status_code?.trim() ?? "",
        processedMethod: record.processed_method?.trim() ?? "",
      };
    })
    .filter(
      (record): record is WaterQualityStationStatusRecord => record !== null,
    );
}

export function getWaterQualityStationOptions() {
  return INTERACTIVE_TOWN_OPTIONS;
}

export function filterWaterQualityStationsByTown(
  records: WaterQualityStationStatusRecord[],
  selectedTown: string,
) {
  if (selectedTown === ALL_WATER_QUALITY_STATIONS_LABEL) return records;
  return records.filter((record) => record.township === selectedTown);
}

export function getWaterQualityStationSummary(
  records: WaterQualityStationStatusRecord[],
  selectedTown = ALL_WATER_QUALITY_STATIONS_LABEL,
) {
  const targetRecords = filterWaterQualityStationsByTown(records, selectedTown);
  const active = targetRecords.filter(
    (record) => record.statusOfUse === "啟用",
  ).length;
  const inactive = targetRecords.filter(
    (record) => record.statusOfUse === "停用",
  ).length;
  return { total: targetRecords.length, active, inactive };
}

export function getWaterQualityStationStatusColor(
  record: WaterQualityStationStatusRecord,
) {
  if (record.statusOfUse === "啟用") return "#22c55e";
  if (record.statusOfUse === "停用") return "#ef4444";
  return "#94a3b8";
}

export function getWaterQualityStationMapOverlay(
  selectedName: string,
  records: WaterQualityStationStatusRecord[],
) {
  const selectedRecords = filterWaterQualityStationsByTown(
    records,
    selectedName,
  );
  const shouldShowLabels = selectedName !== ALL_WATER_QUALITY_STATIONS_LABEL;
  const mapWidth = 380;
  const mapHeight = 300;
  const labelPadding = 5;
  const labelFontSize = 8.6;
  const labelHeight = labelFontSize + 9;
  const stationDotRadius = 7.2;
  const reservedLabelBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  const stationDotBoxes = selectedRecords.map((record) => ({
    id: record.siteId,
    x: record.mapX - stationDotRadius,
    y: record.mapY - stationDotRadius,
    width: stationDotRadius * 2,
    height: stationDotRadius * 2,
  }));
  const stationLabelCandidates = [
    { dx: 92, dy: -42 },
    { dx: -92, dy: -42 },
    { dx: 92, dy: 46 },
    { dx: -92, dy: 46 },
    { dx: 118, dy: -10 },
    { dx: -118, dy: -10 },
    { dx: 118, dy: 28 },
    { dx: -118, dy: 28 },
    { dx: 0, dy: -72 },
    { dx: 0, dy: 76 },
    { dx: 132, dy: -60 },
    { dx: -132, dy: -60 },
    { dx: 132, dy: 64 },
    { dx: -132, dy: 64 },
    { dx: 156, dy: -28 },
    { dx: -156, dy: -28 },
    { dx: 156, dy: 34 },
    { dx: -156, dy: 34 },
  ];
  const boxesOverlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    gap = 5,
  ) =>
    !(
      a.x + a.width + gap < b.x ||
      b.x + b.width + gap < a.x ||
      a.y + a.height + gap < b.y ||
      b.y + b.height + gap < a.y
    );
  const overlapArea = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => {
    const overlapWidth = Math.max(
      0,
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
    );
    return overlapWidth * overlapHeight;
  };
  const overlapScore = (
    box: { x: number; y: number; width: number; height: number },
    record: WaterQualityStationStatusRecord,
  ) => {
    const labelOverlap = reservedLabelBoxes.reduce(
      (score, reserved) => score + overlapArea(box, reserved) * 8,
      0,
    );
    const dotOverlap = stationDotBoxes.reduce(
      (score, dot) => score + overlapArea(box, dot) * 16,
      0,
    );
    const distancePenalty =
      Math.hypot(
        box.x + box.width / 2 - record.mapX,
        box.y + box.height / 2 - record.mapY,
      ) * 0.02;
    return labelOverlap + dotOverlap + distancePenalty;
  };
  const clampLabel = (
    record: WaterQualityStationStatusRecord,
    width: number,
    dx: number,
    dy: number,
  ) => {
    const x = Math.min(
      mapWidth - width / 2 - labelPadding,
      Math.max(width / 2 + labelPadding, record.mapX + dx),
    );
    const y = Math.min(
      mapHeight - labelPadding - labelHeight / 2,
      Math.max(labelPadding + labelHeight / 2, record.mapY + dy),
    );
    return {
      x,
      y,
      box: {
        x: x - width / 2,
        y: y - labelHeight / 2,
        width,
        height: labelHeight,
      },
    };
  };

  return {
    paths: [],
    areas: [],
    markers: selectedRecords.map((record) => {
      const labelWidth = 122;
      const candidates = stationLabelCandidates
        .map((candidate) =>
          clampLabel(record, labelWidth, candidate.dx, candidate.dy),
        )
        .sort(
          (a, b) => overlapScore(a.box, record) - overlapScore(b.box, record),
        );
      const selectedLabel =
        candidates.find(
          (candidate) =>
            reservedLabelBoxes.every(
              (reserved) => !boxesOverlap(candidate.box, reserved, 6),
            ) &&
            stationDotBoxes.every(
              (dot) => !boxesOverlap(candidate.box, dot, 6),
            ),
        ) ??
        candidates.find((candidate) =>
          stationDotBoxes.every((dot) => !boxesOverlap(candidate.box, dot, 3)),
        ) ??
        candidates[0] ??
        clampLabel(record, labelWidth, 0, -72);
      if (shouldShowLabels) reservedLabelBoxes.push(selectedLabel.box);

      return {
        id: `water-quality-station-${record.siteId}`,
        label: record.siteName,
        selectValue: record.township || selectedName,
        x: record.mapX,
        y: record.mapY,
        color: getWaterQualityStationStatusColor(record),
        kind: "station" as const,
        selected: false,
        hideLabel: !shouldShowLabels,
        labelDx: selectedLabel.x - record.mapX,
        labelDy: selectedLabel.y - record.mapY,
        labelAnchor: "middle" as const,
        labelWidth,
      };
    }),
  };
}

export function getWaterQualityStationStatusText(
  records: WaterQualityStationStatusRecord[],
  selectedName: string,
) {
  if (records.length === 0) return "目前正在讀取環境部河川水質測點基本資料。";
  const summary = getWaterQualityStationSummary(records, selectedName);
  if (selectedName === ALL_WATER_QUALITY_STATIONS_LABEL) {
    return `目前顯示全地區水質監測站，共 ${summary.total} 站，其中啟用 ${summary.active} 站、停用 ${summary.inactive} 站。`;
  }
  return `${selectedName} 目前水質監測站數為 ${summary.total}，其中啟用 ${summary.active} 站、停用 ${summary.inactive} 站。`;
}

export function buildWaterQualityStationSnapshotMeta(
  selectedName: string,
  records: WaterQualityStationStatusRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  const summary = getWaterQualityStationSummary(records, selectedName);
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory: "水質監測站",
    metric: "測站啟停用狀態",
    unit: "站",
    sourceName: "環境部環境資料開放平臺：河川水質測點基本資料 WQX_P_06",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜水質監測站`,
    chartData: [
      { label: "啟用", value: summary.active },
      { label: "停用", value: summary.inactive },
    ],
    createdAt: new Date().toISOString(),
  };
}

export const INTERACTIVE_DATA_OPTIONS: Record<
  CategoryKey,
  {
    subcategories: string[];
    metrics: string[];
    unit: string;
    sourceName: string;
    sourceUrl: string;
  }
> = {
  water: {
    subcategories: ["降雨量", WATER_RPI_SUBCATEGORY_LABEL, "水質監測站"],
    metrics: ["月雨量平均", "RPI", "測站狀態"],
    unit: "mm",
    sourceName: "中央氣象署、data.gov.tw、環境部環境資料開放平臺",
    sourceUrl:
      "https://data.gov.tw/dataset/9177；https://data.moenv.gov.tw/dataset/detail/WQX_P_01；https://data.moenv.gov.tw/dataset/detail/WQX_P_06",
  },
  land: {
    subcategories: ["人口壓力", "土地面積", "耕地面積", "開發壓力"],
    metrics: ["人口數", "人口密度", "耕地面積比", "開發壓力指標"],
    unit: "人 / % / 指標值",
    sourceName: "苗栗縣政府資料開放平臺、苗栗縣統計資訊服務網",
    sourceUrl:
      "https://data.gov.tw/dataset/177442；https://miaoli.dgbas.gov.tw/",
  },
  leopard: {
    subcategories: ["出沒網格", "潛在棲地", "路殺風險", "相機監測"],
    metrics: ["有紀錄網格", "棲地適合度", "道路風險", "監測紀錄"],
    unit: "格 / 指標值",
    sourceName: "苗栗縣政府農業處、林業及自然保育署",
    sourceUrl:
      "https://www.miaoli.gov.tw/agriculture/News_Content.aspx?n=5787&s=567043",
  },
  rumor: {
    subcategories: ["地方通報", "禽舍衝突", "遊蕩犬貓", "社區巡守"],
    metrics: ["通報件數", "衝突強度", "共域指標", "巡守紀錄"],
    unit: "件 / 指標值",
    sourceName: "113年苗栗縣瀕危物種及重要棲地生態服務給付推動計畫",
    sourceUrl: "https://ecollect.forest.gov.tw/",
  },
  other: {
    subcategories: ["補充資料", "人力與資源"],
    metrics: ["補充線索", "投入面向"],
    unit: "張 / 類型",
    sourceName: "遊戲內全域卡牌資料",
    sourceUrl: "public/card/Global_Card",
  },
};

export const WATER_STATION_OPTIONS = [ALL_WATER_QUALITY_STATIONS_LABEL];

export function getWaterSelectionStatusText(
  subcategory: string,
  selectedName: string,
) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    if (selectedName.startsWith("全部")) {
      return "目前正在讀取環境部河川水質監測資料整理後的RPI資料。";
    }
    return `${selectedName} 目前尚無可用RPI資料。`;
  }
  if (subcategory === "水質監測站") {
    if (selectedName === WATER_STATION_OPTIONS[0]) {
      return "目前顯示全地區水質監測站，學生可以先看各區域測站分布，再點選地區查看該區域清單。";
    }
    return `${selectedName}會依照資料中的水質監測站位置，顯示該區域的監測站總數與啟停用狀態。`;
  }
  return `${selectedName} 目前尚無可用水資源資料。`;
}

export function getWaterMetricForSubcategory(subcategory: string) {
  if (subcategory === "降雨量") return "月累積雨量";
  if (subcategory === "水質監測站") return "測站狀態";
  return "RPI";
}

export function getWaterSelectionConfig(subcategory: string) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    return {
      label: "河川／溪流選擇",
      options: [ALL_WATER_RPI_LABEL],
      allLabel: ALL_WATER_RPI_LABEL,
    };
  }
  if (subcategory === "水質監測站") {
    return {
      label: "地區選擇",
      options: INTERACTIVE_TOWN_OPTIONS,
      allLabel: ALL_WATER_QUALITY_STATIONS_LABEL,
    };
  }
  return {
    label: "地區選擇",
    options: INTERACTIVE_TOWN_OPTIONS,
    allLabel: ALL_WATER_TOWNS_LABEL,
  };
}

export function getWaterMapOverlay(
  subcategory: string,
  selectedName: string,
  rpiSnapshotValues?: Record<string, number>,
) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    const selectedRiver = selectedName.startsWith("全部") ? "" : selectedName;
    const shapes = selectedRiver
      ? WATER_RPI_GIS_RIVER_SHAPES.filter(
          (shape) => shape.label === selectedRiver,
        )
      : WATER_RPI_GIS_RIVER_SHAPES;

    return {
      paths: [],
      areas: shapes.flatMap((shape) => {
        const value = rpiSnapshotValues?.[shape.label] ?? null;
        const level = value === null ? null : getRpiLevel(value);
        return shape.paths.map((d, pathIndex) => ({
          id: `${shape.id}-snapshot-area-${pathIndex}`,
          d,
          color: level?.color ?? "#e5e7eb",
          strokeColor: WATER_RPI_RIVER_LINE_COLOR,
          strokeWidth:
            shape.kind === "river"
              ? WATER_RPI_RIVER_LINE_WIDTH / 12.5
              : WATER_RPI_STREAM_LINE_WIDTH / 11.2,
          opacity: value === null ? 0.36 : 0.86,
        }));
      }),
      markers: shapes.map((shape) => {
        const value = rpiSnapshotValues?.[shape.label] ?? null;
        return {
          id: `${shape.id}-snapshot-marker`,
          label:
            value === null
              ? `${shape.label} 無RPI資料`
              : `${shape.label} RPI=${formatRpiNumber(value)}`,
          x: shape.x,
          y: shape.y,
          color: WATER_RPI_RIVER_LINE_COLOR,
          kind: shape.kind,
          selected: selectedRiver === shape.label,
          selectValue: shape.label,
          labelDx: shape.labelDx,
          labelDy: shape.labelDy,
          labelAnchor: shape.labelAnchor,
          labelWidth: shape.labelWidth,
        };
      }),
    };
  }
  if (subcategory === "水質監測站") {
    return { paths: [], areas: [], markers: [] };
  }
  return { paths: [], areas: [], markers: [] };
}

export function getWaterChartLabels(subcategory: string, selectedName: string) {
  if (subcategory === "降雨量")
    return RECENT_WATER_MONTH_LABELS.map(formatMonthOnlyLabel);
  if (subcategory === "水質監測站")
    return ["監測正常", "資料完整", "近水系", "可比對", "需複查", "即時性"];
  if (selectedName.startsWith("全部")) {
    return WATER_RPI_DEFAULT_ORDER;
  }
  return RECENT_WATER_MONTH_LABELS;
}

export function getInteractiveSelectorOptions(
  category: CategoryKey,
  subcategory: string,
) {
  if (category === "water") return getWaterSelectionConfig(subcategory).options;
  return INTERACTIVE_TOWN_OPTIONS;
}

export function isTownSelection(category: CategoryKey, subcategory: string) {
  return (
    category !== "water" ||
    subcategory === "降雨量" ||
    subcategory === "水質監測站"
  );
}

export function isWaterTimeSeries(subcategory: string, selectedName: string) {
  return (
    subcategory === "降雨量" ||
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染" ||
    (!selectedName.startsWith("全部") && subcategory !== "水質監測站")
  );
}

export function isWaterSeasonalRainfall(category: CategoryKey, subcategory: string) {
  return category === "water" && subcategory === "降雨量";
}

export function isWaterRpiMap(category: CategoryKey, subcategory: string) {
  return (
    category === "water" &&
    (subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
      subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
      subcategory === "河川污染" ||
      subcategory === "溪流污染")
  );
}

export function isWaterStationMap(category: CategoryKey, subcategory: string) {
  return category === "water" && subcategory === "水質監測站";
}

export function isCategoryKey(value: unknown): value is CategoryKey {
  return (
    typeof value === "string" && CATEGORY_KEYS.includes(value as CategoryKey)
  );
}

export function shouldUseWaterLiveSnapshotPreview(
  card?: {
    imageSrc?: unknown;
    snapshotMeta?: EvidenceSnapshotMeta | null;
  } | null,
) {
  return (
    isWaterLiveSnapshotMeta(card?.snapshotMeta) &&
    !getPersistableImageSrc(card?.imageSrc)
  );
}

export function getDraftImageSrc(card: GameCard) {
  // localStorage 容量很小，探究草稿不能存任何 data URL 圖片。
  // 但後端已存好的 /uploads 快照 URL 很小，可以保留，讓重新整理後仍能顯示同一張 webp。
  const imageSrc = getPersistableImageSrc(card.imageSrc);
  if (imageSrc.startsWith("data:image/")) return "";
  return imageSrc;
}

export function getCompactStoredUnlockedCard(
  card: StoredUnlockedCard,
): StoredUnlockedCard | string {
  if (card.sourceType !== "interactiveSnapshot") return card.id;
  return {
    id: card.id,
    content: card.content,
    unlockedAt: card.unlockedAt,
    unlockedInInquiryOrder: card.unlockedInInquiryOrder,
    localId: card.localId,
    category: card.category,
    title: card.title,
    revealedTitle: card.revealedTitle,
    imageSrc: getPersistableImageSrc(card.imageSrc),
    sourceType: card.sourceType,
    snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
    unlocked: card.unlocked,
    sharedFromOtherPlayer: card.sharedFromOtherPlayer,
    sharedAuthorName: card.sharedAuthorName,
  };
}

export function getCompactEvidenceCardSummary(card: GameCard): EvidenceCardSummary {
  return {
    id: card.id,
    title: card.revealedTitle,
    imageSrc: getPersistableImageSrc(card.imageSrc),
    content: card.content,
    category: card.category,
    sourceType: card.sourceType,
    snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
  };
}

export function serializeUnlockedCard(
  card: GameCard,
  unlockedInInquiryOrder: number,
): StoredUnlockedCard {
  return {
    id: card.id,
    content: card.content,
    unlockedAt: toIsoTimestamp(card.unlockedAt) ?? nowIsoTimestamp(),
    unlockedInInquiryOrder,
    localId: card.localId,
    category: card.category,
    title: card.title,
    revealedTitle: card.revealedTitle,
    // 互動快照卡的 imageSrc 是由 snapshotMeta 產生的輕量 SVG data URL，
    // 下方數據列表、調查書選證據與首頁證據區都沿用這一張圖。
    imageSrc: getPersistableImageSrc(card.imageSrc),
    sourceType: card.sourceType ?? "fixedImage",
    snapshotMeta: card.snapshotMeta,
    unlocked: card.unlocked,
    sharedFromOtherPlayer: card.sharedFromOtherPlayer,
    sharedAuthorName: card.sharedAuthorName,
  };
}

export function getStableInteractiveValue(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
  index: number,
) {
  const key = `${category}-${townName}-${subcategory}-${metric}-${index}`;
  const seed = Array.from(key).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  if (category === "water") return 0;
  if (category === "land") return 12 + ((seed * 5 + index * 17) % 78);
  if (category === "leopard") return 3 + ((seed * 3 + index * 11) % 31);
  return 2 + ((seed * 2 + index * 13) % 45);
}

export function getInteractiveValueForSelection(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
  index: number,
) {
  if (townName !== ALL_TOWNS_LABEL) {
    return getStableInteractiveValue(
      category,
      townName,
      subcategory,
      metric,
      index,
    );
  }

  const values = MIAOLI_TOWNS.map((town) =>
    getStableInteractiveValue(category, town, subcategory, metric, index),
  );
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1),
  );
}

export function getInteractiveUnit(category: CategoryKey, metric: string) {
  if (category !== "water") return INTERACTIVE_DATA_OPTIONS[category].unit;
  if (metric === "月雨量平均" || metric === "月累積雨量") return "mm";
  if (metric === "RPI") return "RPI";
  return "%";
}

export function buildInteractiveSnapshotMeta(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS[category];
  const labels =
    category === "water"
      ? getWaterChartLabels(subcategory, townName)
      : ["指標1", "指標2", "指標3", "指標4", "指標5", "指標6"];

  return {
    townName,
    category,
    categoryLabel: categoryMetaMap[category].label,
    subcategory,
    metric,
    unit: getInteractiveUnit(category, metric),
    sourceName: options.sourceName,
    sourceUrl: options.sourceUrl,
    filterLabel: `${townName}｜${categoryMetaMap[category].label}｜${subcategory}｜${metric}`,
    chartData: labels.map((label, index) => ({
      label,
      value: getInteractiveValueForSelection(
        category,
        townName,
        subcategory,
        metric,
        index,
      ),
    })),
    createdAt: new Date().toISOString(),
  };
}

export const snapshotBuilderDependencies: SnapshotBuilderDependencies = {
  allTownsLabel: ALL_TOWNS_LABEL,
  allWaterQualityStationsLabel: ALL_WATER_QUALITY_STATIONS_LABEL,
  regions,
  labelPositions,
  getWaterMapOverlay,
  getWaterQualityStationMapOverlay,
};

export function buildSnapshotSvgDataUrl(meta: EvidenceSnapshotMeta) {
  return buildSnapshotSvgDataUrlFromBuilder(meta, snapshotBuilderDependencies);
}

export function normalizeDraftCards(savedCards?: Partial<GameCard>[]): GameCard[] {
  const baseCards = createAllCards();
  if (!Array.isArray(savedCards) || savedCards.length === 0) return baseCards;

  const baseById = new Map(baseCards.map((card) => [card.id, card]));
  const savedById = new Map(
    savedCards
      .filter(
        (card): card is Partial<GameCard> & { id: string } =>
          typeof card?.id === "string",
      )
      .map((card) => [card.id, card]),
  );

  const mergedBaseCards = baseCards.map((card) => {
    const saved = savedById.get(card.id);
    if (!saved) return card;

    return {
      ...card,
      content: getStoredCardContent(saved) || card.content,
      unlocked: Boolean(saved.unlocked),
      unlockedAt: toIsoTimestamp(saved.unlockedAt) ?? card.unlockedAt,
      imageSrc: getStoredCardImage(saved) || card.imageSrc,
      sourceType:
        getStoredCardSource<EvidenceSourceType>(saved) ??
        card.sourceType ??
        "fixedImage",
      snapshotMeta:
        getStoredCardSnapshot<EvidenceSnapshotMeta>(saved) ?? card.snapshotMeta,
      sharedFromOtherPlayer:
        saved.sharedFromOtherPlayer ?? card.sharedFromOtherPlayer,
      sharedAuthorName: saved.sharedAuthorName ?? card.sharedAuthorName,
    };
  });

  const dynamicCards = savedCards
    .filter((card) => typeof card?.id === "string" && !baseById.has(card.id))
    .map(
      (card) =>
        createCardFromStoredSnapshotCard(card as StoredUnlockedCard, {
          buildSnapshotSvgDataUrl,
          isCategoryKey,
        }) as GameCard | null,
    )
    .filter((card): card is GameCard => Boolean(card));

  return [...mergedBaseCards, ...dynamicCards];
}

export function getCompactDraftCards(cards: GameCard[]): GameCard[] {
  return cards
    .filter((card) => card.unlocked || card.content.trim())
    .map((card) => ({
      ...card,
      imageSrc: getDraftImageSrc(card),
      snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
    }));
}


export function getBalanceEffect(category: CategoryKey) {
  switch (category) {
    case "land":
      return { development: 1, conservation: 0 };

    case "leopard":
      return { development: 0, conservation: 1 };

    case "water":
    case "rumor":
    case "other":
      return { development: 1, conservation: 1 };
  }
}

export function getVisibleStationIdsFromScrollContainer(
  container: HTMLDivElement | null,
) {
  if (!container) return undefined;
  const containerRect = container.getBoundingClientRect();
  const visibleIds: string[] = [];

  container
    .querySelectorAll<HTMLElement>("[data-station-id]")
    .forEach((element) => {
      const rect = element.getBoundingClientRect();
      const visibleHeight =
        Math.min(rect.bottom, containerRect.bottom) -
        Math.max(rect.top, containerRect.top);
      if (visibleHeight > Math.min(rect.height * 0.35, 26)) {
        const stationId = element.dataset.stationId;
        if (stationId) visibleIds.push(stationId);
      }
    });

  return visibleIds.length > 0 ? visibleIds : undefined;
}
