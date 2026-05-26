import { formatRainfallAmount } from "@/features/inquiry/water/waterResources";

export type SnapshotCategoryKey = "water" | "land" | "leopard" | "rumor" | "other";

export type EvidenceSnapshotPoint = {
  label: string;
  value: number;
};

export type WaterQualityStationSnapshotRecord = {
  siteId: string;
  siteName: string;
  county: string;
  township: string;
  basin: string;
  river: string;
  longitude: number;
  latitude: number;
  mapX: number;
  mapY: number;
  siteAddress: string;
  statusOfUse: string;
  statusCode: string;
  processedMethod: string;
};

export type EvidenceSnapshotMeta = {
  townName: string;
  category: SnapshotCategoryKey;
  categoryLabel: string;
  subcategory: string;
  metric: string;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  filterLabel: string;
  interpretationText?: string;
  chartData: EvidenceSnapshotPoint[];
  activeTimeIndex?: number;
  mapTownValues?: Record<string, number>;
  mapRiverValues?: Record<string, number>;
  showRegionLabels?: boolean;
  waterQualityStations?: WaterQualityStationSnapshotRecord[];
  waterQualityStationListScrollTop?: number;
  waterQualityStationVisibleStationIds?: string[];
  photoSnapshotDataUrl?: string;
  photoSnapshotImageUrl?: string;
  photoSnapshotRelativeUrl?: string;
  photoSnapshotFilename?: string;
  createdAt: string;
};

type SnapshotMapRegion = {
  name: string;
  d: string;
};

type SnapshotMapLabel = {
  x: number;
  y: number;
  size: number;
  vertical?: boolean;
};

type SnapshotMapOverlay = {
  paths: { id?: string; points: string; color?: string; width?: number }[];
  areas: {
    id?: string;
    d: string;
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  }[];
  markers: {
    id?: string;
    x: number;
    y: number;
    label: string;
    color?: string;
    kind?: string;
    selected?: boolean;
    hideLabel?: boolean;
    labelDx?: number;
    labelDy?: number;
    labelAnchor?: "start" | "middle" | "end";
    labelWidth?: number;
  }[];
};

export type SnapshotBuilderDependencies = {
  allTownsLabel: string;
  allWaterQualityStationsLabel: string;
  regions: SnapshotMapRegion[];
  labelPositions: Record<string, SnapshotMapLabel>;
  getWaterMapOverlay: (
    subcategory: string,
    selectedName: string,
    rpiSnapshotValues?: Record<string, number>,
  ) => SnapshotMapOverlay;
  getWaterQualityStationMapOverlay: (
    selectedName: string,
    records: WaterQualityStationSnapshotRecord[],
  ) => SnapshotMapOverlay;
};

export function roundRpiValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatRpiNumber(value: number) {
  return roundRpiValue(value).toFixed(1);
}


export function getRpiLevel(value: number) {
  if (value <= 2) {
    return {
      label: "未受或稍受污染",
      color: "#d7f1e2",
      text: "水質壓力低",
    };
  }
  if (value <= 3.1) {
    return { label: "輕度污染", color: "#fff0b8", text: "需要注意" };
  }
  if (value <= 6) {
    return { label: "中度污染", color: "#ffd7ba", text: "污染壓力明顯" };
  }
  return { label: "嚴重污染", color: "#ffc4c4", text: "污染壓力高" };
}

export const rpiLegend = [
  { label: "≤2", text: "未受或稍受污染", color: "#d7f1e2" },
  { label: "2–3.1", text: "輕度污染", color: "#fff0b8" },
  { label: "3.1–6", text: "中度污染", color: "#ffd7ba" },
  { label: ">6", text: "嚴重污染", color: "#ffc4c4" },
];

const interactiveTimeColorHexes = [
  "#7dd3fc",
  "#22d3ee",
  "#2dd4bf",
  "#34d399",
  "#fbbf24",
  "#fb923c",
];

export const cwaRainfallLegend = [
  { label: "<3", text: "黑色", color: "#d7dce2", min: 0 },
  { label: "≥3", text: "藍色", color: "#cbe7ff", min: 3 },
  { label: "≥15", text: "綠色", color: "#d5f1dc", min: 15 },
  { label: "≥40", text: "黃色", color: "#fff0b8", min: 40 },
  { label: "≥80", text: "紅色", color: "#ffd0c8", min: 80 },
  { label: "≥200", text: "紫色", color: "#e4d8ff", min: 200 },
];

export function getRainfallLevelColor(value: number) {
  if (value >= 200) return "#e4d8ff";
  if (value >= 80) return "#ffd0c8";
  if (value >= 40) return "#fff0b8";
  if (value >= 15) return "#d5f1dc";
  if (value >= 3) return "#cbe7ff";
  return "#d7dce2";
}

function getRainfallLevelText(value: number) {
  if (value >= 200) return "紫色｜劇烈雨量";
  if (value >= 80) return "紅色｜強降雨";
  if (value >= 40) return "黃色｜明顯降雨";
  if (value >= 15) return "綠色｜中等雨量";
  if (value >= 3) return "藍色｜小雨量";
  return "黑色｜微量或無雨";
}

function getPlaybackIndexFromMeta(meta: EvidenceSnapshotMeta) {
  if (typeof meta.activeTimeIndex !== "number") return 0;
  return Math.min(
    Math.max(meta.activeTimeIndex, 0),
    Math.max(meta.chartData.length - 1, 0),
  );
}

export function getInteractiveChartFillHex(category: SnapshotCategoryKey, index: number) {
  if (category === "water") {
    return interactiveTimeColorHexes[index % interactiveTimeColorHexes.length];
  }

  if (category === "land") return "#34d399";
  if (category === "leopard") return "#fb923c";
  return "#a78bfa";
}

function getSnapshotCategoryTheme(category: SnapshotCategoryKey) {
  if (category === "water") {
    return {
      page: "#fffaf0",
      panel: "#fffdf8",
      panelAlt: "#fff4df",
      border: "#e2d4bd",
      accent: "#9b7b55",
      dark: "#4a3828",
      soft: "#f7e8c4",
    };
  }
  if (category === "land") {
    return {
      page: "#f0fbf1",
      panel: "#f7fff7",
      panelAlt: "#e3f6e6",
      border: "#b9dfbf",
      accent: "#2f7d46",
      dark: "#245d37",
      soft: "#d7efd9",
    };
  }
  if (category === "leopard") {
    return {
      page: "#fff6e9",
      panel: "#fffaf2",
      panelAlt: "#fdebd0",
      border: "#e7c08a",
      accent: "#b86b21",
      dark: "#7a471f",
      soft: "#f6ddb9",
    };
  }
  return {
    page: "#f7f1ff",
    panel: "#fcf9ff",
    panelAlt: "#eee2ff",
    border: "#d5c1ef",
    accent: "#7152a6",
    dark: "#4f3a78",
    soft: "#e7dcf7",
  };
}

export function getInteractiveDataStats(points: EvidenceSnapshotPoint[]) {
  const values = points.map((point) => point.value);
  const maxPoint = points.reduce(
    (highest, point) => (point.value > highest.value ? point : highest),
    points[0],
  );
  const minPoint = points.reduce(
    (lowest, point) => (point.value < lowest.value ? point : lowest),
    points[0],
  );
  const average =
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) /
        Math.max(values.length, 1)) *
        100,
    ) / 100;
  const change =
    points.length >= 2 ? points[points.length - 1].value - points[0].value : 0;

  return { maxPoint, minPoint, average, change };
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapSvgText(value: string, maxCharsPerLine: number, maxLines: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const lines: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length && lines.length < maxLines) {
    const remainingLineCount = maxLines - lines.length;
    const remainingText = normalized.slice(cursor);

    if (remainingLineCount === 1 || remainingText.length <= maxCharsPerLine) {
      lines.push(
        remainingLineCount === 1 && remainingText.length > maxCharsPerLine
          ? `${remainingText.slice(0, Math.max(maxCharsPerLine - 1, 1))}…`
          : remainingText,
      );
      break;
    }

    lines.push(remainingText.slice(0, maxCharsPerLine));
    cursor += maxCharsPerLine;
  }

  return lines;
}

function formatSnapshotValue(value: number, unit: string) {
  return unit === "RPI" ? `RPI=${formatRpiNumber(value)}` : `${value}${unit}`;
}

export function buildSnapshotSvgDataUrl(meta: EvidenceSnapshotMeta, deps: SnapshotBuilderDependencies) {
  // 所有互動快照統一使用同一套「降雨量式」版型：
  // 左側地圖、右側數據分析、下方來源。
  // RPI 與水質監測站只更換地圖疊層與圖表資料，避免各自重畫造成快照物件歪斜。
  const width = 1200;
  const height = 780;
  const activeIndex = getPlaybackIndexFromMeta(meta);
  const activePoint = meta.chartData[activeIndex] ?? meta.chartData[0];
  const activeValue = activePoint?.value ?? 0;
  const maxValue = Math.max(...meta.chartData.map((point) => point.value), 1);
  const snapshotTheme = getSnapshotCategoryTheme(meta.category);

  const chartTop = 252;
  const chartLeft = 626;
  const chartWidth = 500;
  const chartHeight = 326;
  // 快照左側「降雨量時間地圖」容器中的地圖定位。
  // 這裡不再用中心點或人工 translate，而是直接用苗栗地圖實際 path 邊界計算：
  // 左、右、下方留一樣的間距，上方自然保留較多空間；這版縮小等距留白，讓地圖再放大。
  const snapshotMapFrameX = 50;
  const snapshotMapFrameY = 232;
  const snapshotMapFrameWidth = 512;
  const snapshotMapFrameHeight = 402;
  const snapshotMapInnerGap = 0;

  const snapshotMapRawNumbers = deps.regions.flatMap((region) =>
    (region.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number),
  );
  const snapshotMapXValues = snapshotMapRawNumbers.filter(
    (_, index) => index % 2 === 0,
  );
  const snapshotMapYValues = snapshotMapRawNumbers.filter(
    (_, index) => index % 2 === 1,
  );
  const snapshotMapMinX = Math.min(...snapshotMapXValues, 0);
  const snapshotMapMaxX = Math.max(...snapshotMapXValues, 330);
  const snapshotMapMinY = Math.min(...snapshotMapYValues, 0);
  const snapshotMapMaxY = Math.max(...snapshotMapYValues, 340);
  const snapshotMapActualWidth = Math.max(snapshotMapMaxX - snapshotMapMinX, 1);
  const snapshotMapActualHeight = Math.max(
    snapshotMapMaxY - snapshotMapMinY,
    1,
  );

  const snapshotMapBaseScale = Math.min(
    (snapshotMapFrameWidth - snapshotMapInnerGap * 2) / snapshotMapActualWidth,
    (snapshotMapFrameHeight - snapshotMapInnerGap * 2) /
      snapshotMapActualHeight,
  );
  // 擷取線索彈窗左側地圖：比容器滿版比例再放大，並微幅下移；超出部分由 clipPath 裁切。
  const snapshotMapScale = snapshotMapBaseScale * 1.1;
  const snapshotMapRenderedWidth = snapshotMapActualWidth * snapshotMapScale;
  const snapshotMapRenderedHeight = snapshotMapActualHeight * snapshotMapScale;
  const snapshotMapTranslateX =
    snapshotMapFrameX +
    (snapshotMapFrameWidth - snapshotMapRenderedWidth) / 2 -
    snapshotMapMinX * snapshotMapScale;
  const snapshotMapTranslateY =
    snapshotMapFrameY +
    (snapshotMapFrameHeight - snapshotMapRenderedHeight) / 2 +
    18 -
    snapshotMapMinY * snapshotMapScale;
  const snapshotMapTransform = `translate(${snapshotMapTranslateX} ${snapshotMapTranslateY}) scale(${snapshotMapScale})`;
  const isRainfallSnapshot =
    meta.category === "water" && meta.subcategory === "降雨量";
  const isStationSnapshot =
    meta.category === "water" && meta.subcategory === "水質監測站";
  const isWaterPositionSnapshot =
    meta.category === "water" && meta.subcategory !== "降雨量";
  const snapshotOverlay = (
    meta.category === "water"
      ? isStationSnapshot
        ? deps.getWaterQualityStationMapOverlay(
            meta.townName || deps.allWaterQualityStationsLabel,
            meta.waterQualityStations ?? [],
          )
        : deps.getWaterMapOverlay(
            meta.subcategory,
            meta.townName,
            meta.mapRiverValues,
          )
      : { paths: [], areas: [], markers: [] }
  ) as {
    paths: { id?: string; points: string; color?: string; width?: number }[];
    areas: {
      id?: string;
      d: string;
      color?: string;
      strokeColor?: string;
      strokeWidth?: number;
      opacity?: number;
    }[];
    markers: {
      id?: string;
      x: number;
      y: number;
      label: string;
      color?: string;
      kind?: string;
      selected?: boolean;
      hideLabel?: boolean;
      labelDx?: number;
      labelDy?: number;
      labelAnchor?: "start" | "middle" | "end";
      labelWidth?: number;
    }[];
  };
  const barGap = meta.chartData.length > 8 ? 6 : 15;
  const barWidth = Math.max(
    meta.chartData.length > 8 ? 22 : 42,
    (chartWidth - barGap * (meta.chartData.length - 1)) / meta.chartData.length,
  );

  const mapPathSvg = deps.regions
    .map((region) => {
      const isSelected = region.name === meta.townName;
      const snapshotTownValue = meta.mapTownValues?.[region.name];
      const fill = isRainfallSnapshot
        ? meta.townName === deps.allTownsLabel
          ? typeof snapshotTownValue === "number"
            ? getRainfallLevelColor(snapshotTownValue)
            : "#ffffff"
          : isSelected
            ? getRainfallLevelColor(
                typeof snapshotTownValue === "number"
                  ? snapshotTownValue
                  : activeValue,
              )
            : "#ffffff"
        : isSelected && meta.category !== "water"
          ? "#efe5d3"
          : isStationSnapshot
            ? "#ffffff"
            : "#fff8dd";
      return `
      <path d="${region.d}" fill="${fill}" stroke="#cdb98d" stroke-width="1.05" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    `;
    })
    .join("");

  const shouldShowSnapshotRegionLabels =
    !isWaterPositionSnapshot ||
    isStationSnapshot ||
    Boolean(meta.showRegionLabels);

  const mapLabelSvg = shouldShowSnapshotRegionLabels
    ? deps.regions
        .map((region) => {
          const label = deps.labelPositions[region.name];
          return `
      <text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(label.size + 3, 13)}" font-weight="900" fill="#253244" paint-order="stroke" stroke="rgba(255,255,255,.95)" stroke-width="2.8" ${label.vertical ? 'writing-mode="tb"' : ""}>${escapeSvgText(region.name)}</text>
    `;
        })
        .join("")
    : "";

  const overlayAreaSvg = (
    "areas" in snapshotOverlay ? snapshotOverlay.areas : []
  )
    .map(
      (area) => `
    <path d="${area.d}" fill="${area.color ?? "#1597d3"}" stroke="${area.strokeColor ?? area.color ?? "#1597d3"}" stroke-width="${area.strokeWidth ?? 0}" opacity="${area.opacity ?? 0.9}" stroke-linejoin="round" stroke-linecap="round" />
  `,
    )
    .join("");

  const overlayPathSvg = snapshotOverlay.paths
    .map(
      (path) => `
    <polyline points="${path.points}" fill="none" stroke="${path.color ?? "#4aa3c7"}" stroke-width="${"width" in path ? path.width : 7}" stroke-linecap="round" stroke-linejoin="round" opacity="0.88" />
  `,
    )
    .join("");

  const clampSnapshotMarkerValue = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max < min ? min : max);
  const overlayMarkerSvg = snapshotOverlay.markers
    .map((marker) => {
      const fill =
        marker.color ??
        (marker.kind === "station"
          ? "#7c3aed"
          : marker.kind === "stream"
            ? "#22c55e"
            : "#0284c7");
      const dotRadius =
        marker.kind === "station" ? 4.8 : marker.selected ? 9 : 6.5;
      const haloRadius =
        marker.kind === "station" ? 7.6 : marker.selected ? 15 : 10.5;
      if (marker.hideLabel) {
        return `
    <circle cx="${marker.x}" cy="${marker.y}" r="${dotRadius}" fill="${fill}" stroke="#ffffff" stroke-width="1.8" />
    <circle cx="${marker.x}" cy="${marker.y}" r="${haloRadius}" fill="none" stroke="${fill}" stroke-width="1.7" opacity="0.42" />`;
      }

      const labelDx = marker.labelDx ?? 12;
      const labelDy = marker.labelDy ?? -10;
      const requestedLabelX = marker.x + labelDx;
      const requestedLabelY = marker.y + labelDy;
      const labelAnchor = marker.labelAnchor ?? "start";
      const labelFontSize =
        marker.kind === "station" ? 8.6 : marker.selected ? 11 : 10;
      const estimatedLabelWidth =
        marker.labelWidth ??
        Math.max(58, marker.label.length * labelFontSize * 0.72 + 14);
      const labelHeight = labelFontSize + 8;
      const rawLabelRectX =
        labelAnchor === "middle"
          ? requestedLabelX - estimatedLabelWidth / 2
          : labelAnchor === "end"
            ? requestedLabelX - estimatedLabelWidth + 4
            : requestedLabelX - 7;
      const labelPadding = 4;
      const labelRectX = clampSnapshotMarkerValue(
        rawLabelRectX,
        labelPadding,
        380 - estimatedLabelWidth - labelPadding,
      );
      const labelRectY = clampSnapshotMarkerValue(
        requestedLabelY - labelHeight / 2,
        labelPadding,
        300 - labelHeight - labelPadding,
      );
      const labelY = labelRectY + labelHeight / 2 + labelFontSize * 0.34;
      const labelX =
        labelAnchor === "middle"
          ? labelRectX + estimatedLabelWidth / 2
          : labelAnchor === "end"
            ? labelRectX + estimatedLabelWidth - 7
            : labelRectX + 7;
      return `
    <line x1="${marker.x}" y1="${marker.y}" x2="${labelX}" y2="${labelY - labelFontSize / 2}" stroke="rgba(79,70,60,.46)" stroke-width="1.05" stroke-dasharray="3 3" />
    <rect x="${labelRectX}" y="${labelRectY}" width="${estimatedLabelWidth}" height="${labelHeight}" rx="7" fill="rgba(255,255,255,.92)" stroke="rgba(184,220,236,.95)" stroke-width="1.2" />
    <text x="${labelX}" y="${labelY}" font-size="${labelFontSize}" font-weight="900" fill="#253244" text-anchor="${labelAnchor}">${escapeSvgText(marker.label)}</text>
    <circle cx="${marker.x}" cy="${marker.y}" r="${dotRadius}" fill="${fill}" stroke="#ffffff" stroke-width="1.8" />
    <circle cx="${marker.x}" cy="${marker.y}" r="${haloRadius}" fill="none" stroke="${fill}" stroke-width="1.7" opacity="0.42" />`;
    })
    .join("");

  const legendSvg = isRainfallSnapshot
    ? cwaRainfallLegend
        .map((item, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = 389 + col * 82;
          const y = 168 + row * 25;
          return `
        <rect x="${x}" y="${y}" width="15" height="15" rx="3" fill="${item.color}" stroke="#2f2418" stroke-opacity="0.16" />
        <text x="${x + 21}" y="${y + 12}" font-size="14" font-weight="900" fill="#332c24">${escapeSvgText(item.label)}mm</text>
      `;
        })
        .join("")
    : isWaterPositionSnapshot && meta.metric === "RPI"
      ? rpiLegend
          .map((item, index) => {
            const x = 392;
            const y = 168 + index * 31;
            return `
        <rect x="${x}" y="${y}" width="16" height="16" rx="3" fill="${item.color}" stroke="#2f2418" stroke-opacity="0.16" />
        <text x="${x + 24}" y="${y + 13}" font-size="13.2" font-weight="900" fill="#332c24">${escapeSvgText(item.label)}｜${escapeSvgText(item.text)}</text>
      `;
          })
          .join("")
      : "";

  const barSvg = meta.chartData
    .map((point, index) => {
      const barHeight = Math.max(10, (point.value / maxValue) * chartHeight);
      const x = chartLeft + index * (barWidth + barGap);
      const y = chartTop + chartHeight - barHeight;
      const fill = isRainfallSnapshot
        ? getRainfallLevelColor(point.value)
        : meta.metric === "RPI"
          ? getRpiLevel(point.value).color
          : isStationSnapshot
            ? point.label.includes("停")
              ? "#ef4444"
              : "#22c55e"
            : getInteractiveChartFillHex(meta.category, index);
      const isActive = isRainfallSnapshot && index === activeIndex;
      return `
        <rect x="${x}" y="${y - (isActive ? 5 : 0)}" width="${barWidth}" height="${barHeight + (isActive ? 5 : 0)}" rx="12" fill="${fill}" opacity="0.96" stroke="${isActive ? snapshotTheme.dark : "transparent"}" stroke-width="${isActive ? 2.4 : 0}" />
        <text x="${x + barWidth / 2}" y="${Math.max(y - 12, chartTop + 18)}" text-anchor="middle" font-size="18.5" font-weight="900" fill="#3f3023">${formatSnapshotValue(point.value, meta.unit)}</text>
        <text x="${x + barWidth / 2}" y="${chartTop + chartHeight + 28}" text-anchor="middle" font-size="${meta.chartData.length > 8 ? 12.5 : 16}" font-weight="800" fill="#557083">${escapeSvgText(point.label)}</text>
      `;
    })
    .join("");

  const rainfallLevelSummaryText = getRainfallLevelText(activeValue).replace(
    "｜",
    "區間｜",
  );
  const activeSummary =
    isRainfallSnapshot && activePoint
      ? `${activePoint.label}｜月平均${activeValue}${meta.unit}｜${rainfallLevelSummaryText}`
      : `${activePoint?.label ?? "目前狀態"}｜${formatSnapshotValue(activeValue, meta.unit)}`;
  const activeSummaryLines =
    isRainfallSnapshot && activePoint
      ? [
          `${activePoint.label}｜月平均${formatSnapshotValue(activeValue, meta.unit)}`,
          rainfallLevelSummaryText,
        ]
      : [activeSummary];
  const activeSummarySvg = activeSummaryLines
    .map(
      (line, index) =>
        `<tspan x="70" dy="${index === 0 ? 0 : 28}">${escapeSvgText(line)}</tspan>`,
    )
    .join("");
  const snapshotTitle = isRainfallSnapshot
    ? `${meta.townName}｜地區平均月累積雨量`
    : meta.filterLabel;
  const interpretationText =
    meta.interpretationText?.trim() ||
    (isRainfallSnapshot
      ? `${meta.townName}，${activePoint?.label ?? "目前月份"}的累積平均降雨量為${formatRainfallAmount(activeValue)}${meta.unit}。`
      : activeSummary);
  const interpretationHeaderLines = wrapSvgText(interpretationText, 34, 2);
  const interpretationHeaderSvg = interpretationHeaderLines
    .map(
      (line, index) =>
        `<tspan x="630" dy="${index === 0 ? 0 : 25}">${escapeSvgText(line)}</tspan>`,
    )
    .join("");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="34" fill="${snapshotTheme.page}" />
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="30" fill="${snapshotTheme.panel}" stroke="${snapshotTheme.border}" stroke-width="3" />
    <circle cx="1092" cy="86" r="58" fill="${snapshotTheme.soft}" opacity="0.74" />

    <text x="56" y="90" font-size="43" font-weight="900" fill="${snapshotTheme.dark}">${escapeSvgText(snapshotTitle)}</text>

    <defs>
      <clipPath id="snapshotMapClip">
        <rect x="${snapshotMapFrameX}" y="${snapshotMapFrameY}" width="${snapshotMapFrameWidth}" height="${snapshotMapFrameHeight}" rx="18" />
      </clipPath>
    </defs>
    <rect x="42" y="118" width="530" height="526" rx="24" fill="${snapshotTheme.panelAlt}" stroke="${snapshotTheme.border}" stroke-width="2" />
    <text x="70" y="158" font-size="26" font-weight="900" fill="${snapshotTheme.accent}">${isRainfallSnapshot ? "降雨量時間地圖" : isWaterPositionSnapshot ? `${escapeSvgText(meta.subcategory)}位置圖` : "地圖位置預覽"}</text>
    <text x="70" y="190" font-size="20" font-weight="800" fill="#557083">${activeSummarySvg}</text>
    <g clip-path="url(#snapshotMapClip)">
      <g transform="${snapshotMapTransform}">
        ${mapPathSvg}
        ${overlayAreaSvg}
        ${overlayPathSvg}
        ${overlayMarkerSvg}
        ${mapLabelSvg}
      </g>
    </g>
    ${
      legendSvg
        ? `
      <rect x="372" y="130" width="186" height="${isRainfallSnapshot ? 112 : 176}" rx="16" fill="rgba(255,255,255,.94)" stroke="${snapshotTheme.border}" />
      <text x="465" y="154" text-anchor="middle" font-size="18" font-weight="900" fill="${snapshotTheme.accent}">${isRainfallSnapshot ? "降雨量圖例" : "RPI圖例"}</text>
      ${legendSvg}
    `
        : ""
    }

    <rect x="602" y="118" width="556" height="526" rx="24" fill="${snapshotTheme.panelAlt}" stroke="${snapshotTheme.border}" stroke-width="2" />
    <text x="630" y="158" font-size="26" font-weight="900" fill="${snapshotTheme.accent}">數據分析圖</text>
    <text x="630" y="193" font-size="20" font-weight="900" fill="#27546b">${interpretationHeaderSvg}</text>
    <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartTop + chartHeight}" stroke="#b8dcec" stroke-width="2.4" />
    <line x1="${chartLeft}" y1="${chartTop + chartHeight}" x2="${chartLeft + chartWidth}" y2="${chartTop + chartHeight}" stroke="#b8dcec" stroke-width="2.4" />
    ${barSvg}


    <rect x="56" y="682" width="1088" height="56" rx="20" fill="${snapshotTheme.panelAlt}" stroke="${snapshotTheme.border}" />
    <text x="600" y="707" text-anchor="middle" font-size="15" font-weight="900" fill="#557083">資料來源：${escapeSvgText(meta.sourceName)}</text>
    <text x="600" y="730" text-anchor="middle" font-size="11" font-weight="800" fill="#9a8061">${escapeSvgText(meta.sourceUrl)}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
