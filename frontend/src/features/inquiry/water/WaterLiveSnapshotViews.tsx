/**
 * CityAuncel maintainability notes
 * 檔案用途：水資源探究模組 WaterLiveSnapshotViews，處理水資源地圖、圖表、快照或資料守門。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import MiaoliDistrictSelectorMap from "@/components/MiaoliDistrictSelectorMap";
import WaterRpiRiverMap from "@/components/WaterRpiRiverMap";
import { mediaUrl } from "@/api/apiClient";
import { WATER_RPI_GIS_RIVER_SHAPES } from "@/data/waterRpiGisRiverShapes";
import { isWaterStationSnapshotMeta } from "./waterLiveSnapshotGuards";

type CategoryKey = "water" | "land" | "leopard" | "rumor" | "other";

type EvidenceSnapshotPoint = {
  label: string;
  value: number;
};

export type EvidenceSnapshotMetaLike = {
  townName: string;
  category: CategoryKey;
  categoryLabel: string;
  subcategory: string;
  metric: string;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  filterLabel: string;
  chartData: EvidenceSnapshotPoint[];
  createdAt: string;
  activeTimeIndex?: number;
  interpretationText?: string;
  mapTownValues?: Record<string, number>;
  mapRiverValues?: Record<string, number>;
  showRegionLabels?: boolean;
  waterQualityStations?: WaterQualityStationStatusRecord[];
  waterQualityStationListScrollTop?: number;
  waterQualityStationVisibleStationIds?: string[];
  photoSnapshotDataUrl?: string;
  photoSnapshotImageUrl?: string;
  photoSnapshotRelativeUrl?: string;
  photoSnapshotFilename?: string;
};

type WaterQualityStationStatusRecord = {
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

const WATER_RPI_RIVER_LINE_COLOR = "#0284c7";
const WATER_RPI_RIVER_LINE_WIDTH = 5.2;
const WATER_RPI_STREAM_LINE_WIDTH = 3.8;
const WATER_RPI_SUBCATEGORY_LABEL = "河川水質汙染指數(RPI)";
const LEGACY_WATER_RPI_SUBCATEGORY_LABEL = "河川水質RPI";
const ALL_WATER_QUALITY_STATIONS_LABEL = "全地區";

const rpiLegend = [
  { label: "≤2.0", text: "未受污染", color: "#9bd7ff" },
  { label: "2.1-3.0", text: "輕度污染", color: "#b8e6a5" },
  { label: "3.1-6.0", text: "中度污染", color: "#ffd166" },
  { label: ">6.0", text: "嚴重污染", color: "#ef476f" },
];

const WATER_UNIFIED_CARD = {
  statusActiveText: "text-emerald-700",
  statusInactiveText: "text-rose-700",
};

const EVIDENCE_CREATOR_THEME = {
  sectionPanel: "rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0]",
  header: "border-b border-[#eadfcf] bg-[#fff3dc]",
  heading: "text-[#7b5b37]",
  titleText: "text-[#332c24]",
  badgeSoft: "bg-[#fff0cf] text-[#7b5b37]",
  infoPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff7ea]",
  inset: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  chartFrame:
    "rounded-2xl border border-[#eadfcf] bg-[#fffdf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
  statusBox: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  listPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff8ef]",
  listItem:
    "rounded-xl border border-[#eadfcf] bg-[#fffdf8] shadow-[0_4px_12px_rgba(140,108,54,0.06)]",
  timelineChipActive: "bg-[#fff0cf] text-[#7b5b37]",
  timelineChipIdle: "text-[#7a6754]",
};

function roundRpiValue(value: number) {
  return Math.round(value * 10) / 10;
}

function formatRpiNumber(value: number) {
  return roundRpiValue(value).toFixed(1);
}

function getRpiLevel(value: number) {
  if (value <= 2) return { label: "未受污染", color: "#9bd7ff" };
  if (value <= 3) return { label: "輕度污染", color: "#b8e6a5" };
  if (value <= 6) return { label: "中度污染", color: "#ffd166" };
  return { label: "嚴重污染", color: "#ef476f" };
}

function getWaterMapOverlay(
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
  return { paths: [], areas: [], markers: [] };
}

function getPlaybackIndexFromMeta(meta: EvidenceSnapshotMetaLike) {
  if (typeof meta.activeTimeIndex !== "number") return 0;
  return Math.min(
    Math.max(meta.activeTimeIndex, 0),
    Math.max(meta.chartData.length - 1, 0),
  );
}

function getInteractiveDataStats(points: EvidenceSnapshotPoint[]) {
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

  return { maxPoint, minPoint, average };
}

function getWaterQualityStationStatusColor(
  record: WaterQualityStationStatusRecord,
) {
  if (record.statusOfUse === "啟用") return "#22c55e";
  if (record.statusOfUse === "停用") return "#ef4444";
  return "#94a3b8";
}


function filterWaterQualityStationsByTown(
  records: WaterQualityStationStatusRecord[],
  selectedTown: string,
) {
  if (selectedTown === ALL_WATER_QUALITY_STATIONS_LABEL) return records;
  return records.filter((record) => record.township === selectedTown);
}

function getWaterQualityStationSummary(
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

function getWaterQualityStationMapOverlay(
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

function getWaterQualityStationStatusText(
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

export function WaterLiveSnapshotView({
  meta,
  compact = false,
  className = "",
}: {
  meta: EvidenceSnapshotMetaLike;
  compact?: boolean;
  className?: string;
}) {
  if (isWaterStationSnapshotMeta(meta)) {
    return (
      <WaterQualityStationSnapshotLiveView
        meta={meta}
        compact={compact}
        className={className}
      />
    );
  }
  return (
    <WaterRpiSnapshotLiveView
      meta={meta}
      compact={compact}
      className={className}
    />
  );
}

export function WaterLiveSnapshotCardPreview({
  meta,
  className = "",
  muted = false,
}: {
  meta: EvidenceSnapshotMetaLike;
  className?: string;
  muted?: boolean;
}) {
  if (meta.photoSnapshotImageUrl || meta.photoSnapshotDataUrl) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] ${className}`}
      >
        <img
          src={mediaUrl(meta.photoSnapshotImageUrl) || meta.photoSnapshotDataUrl}
          alt={meta.filterLabel}
          className={`max-h-full max-w-full object-contain ${
            muted
              ? "opacity-70 saturate-75"
              : ""
          }`}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] ${className}`}
    >
      <div
        className={`pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left ${
          muted
            ? "opacity-70 saturate-75"
            : ""
        }`}
        style={{ transform: "scale(0.25)" }}
      >
        <WaterLiveSnapshotView meta={meta} className="h-full w-full" />
      </div>
    </div>
  );
}

function getWaterRpiSnapshotTitle(meta: EvidenceSnapshotMetaLike) {
  return `${meta.townName}｜水質汙染指數RPI`;
}

function WaterRpiSnapshotLiveView({
  meta,
  compact = false,
  className = "",
}: {
  meta: EvidenceSnapshotMetaLike;
  compact?: boolean;
  className?: string;
}) {
  const activeIndex = getPlaybackIndexFromMeta(meta);
  const activePoint = meta.chartData[activeIndex] ?? meta.chartData[0];
  const overlay = getWaterMapOverlay(
    meta.subcategory,
    meta.townName,
    meta.mapRiverValues,
  );
  const stats = getInteractiveDataStats(meta.chartData);
  const maxValue = Math.max(...meta.chartData.map((point) => point.value), 1);
  const title = getWaterRpiSnapshotTitle(meta);
  const interpretationText =
    meta.interpretationText ||
    `${activePoint?.label ?? "目前月份"} 顯示 ${title}。`;
  const rpiLegendNode = (
    <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2 text-[10px] font-black text-[#6d5e49] shadow-[0_10px_26px_rgba(45,41,34,0.08)]">
      <p className="mb-1 text-center tracking-[0.12em] text-[#7b5b37]">
        RPI圖例
      </p>
      <div className="space-y-1">
        {rpiLegend.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: item.color }}
            />
            {item.label}｜{item.text}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`grid w-full min-w-0 gap-3 ${compact ? "text-[10px]" : "grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]"} ${className}`}
    >
      <div
        className={`${compact ? "min-h-[180px]" : "min-h-[360px]"} flex flex-col overflow-hidden ${EVIDENCE_CREATOR_THEME.sectionPanel}`}
      >
        <div
          className={`${compact ? "px-2 py-1" : "px-3 py-2"} ${EVIDENCE_CREATOR_THEME.header} flex flex-wrap items-center justify-between gap-2 rounded-t-[24px]`}
        >
          <p
            className={`${compact ? "text-[9px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em] whitespace-nowrap`}
          >
            河川水質汙染指數(RPI)位置圖
          </p>
          {activePoint ? (
            <span
              className={`${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-1 text-[10px]"} ${EVIDENCE_CREATOR_THEME.badgeSoft} rounded-full font-black`}
            >
              {activePoint.label}
            </span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <WaterRpiRiverMap
            selectedRiver={meta.townName}
            onSelectRiver={() => undefined}
            areas={overlay.areas}
            markers={overlay.markers}
            legend={compact ? undefined : rpiLegendNode}
            showRegionLabels={Boolean(meta.showRegionLabels)}
            mapHeight="100%"
            interactive={false}
            townFill="#ffffff"
            townStroke="#eadfcf"
          />
        </div>
      </div>

      <div
        className={`${compact ? "p-2" : "p-3"} min-w-0 overflow-hidden ${EVIDENCE_CREATOR_THEME.sectionPanel}`}
      >
        <div
          className={`${compact ? "mb-1" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}
        >
          <div>
            <p
              className={`${compact ? "text-[9px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em]`}
            >
              數據分析圖
            </p>
            <h3
              className={`${compact ? "mt-0.5 text-[10px]" : "mt-1 text-base"} ${EVIDENCE_CREATOR_THEME.titleText} font-black`}
            >
              {title}
            </h3>
          </div>
          <span
            className={`${compact ? "px-1.5 py-0.5 text-[8px]" : "px-3 py-1 text-xs"} ${EVIDENCE_CREATOR_THEME.badgeSoft} rounded-full font-black`}
          >
            RPI
          </span>
        </div>

        <div
          className={`${compact ? "mb-1 px-2 py-1" : "mb-3 px-3 py-2"} ${EVIDENCE_CREATOR_THEME.infoPanel} w-full`}
        >
          <p
            className={`${compact ? "text-[8px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em]`}
          >
            資料解讀
          </p>
          <p
            className={`${compact ? "mt-0.5 line-clamp-2 text-[9px] leading-4" : "mt-1 text-sm leading-6"} text-[#6d5e49] font-black`}
          >
            {interpretationText}
          </p>
        </div>

        {!compact ? (
          <div className="mb-2 grid shrink-0 grid-cols-3 gap-1.5">
            <div
              className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
            >
              <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
                RPI最高月份
              </p>
              <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
                {stats.maxPoint.label}｜RPI=
                {formatRpiNumber(stats.maxPoint.value)}
              </p>
            </div>
            <div
              className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
            >
              <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
                RPI最低月份
              </p>
              <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
                {stats.minPoint.label}｜RPI=
                {formatRpiNumber(stats.minPoint.value)}
              </p>
            </div>
            <div
              className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
            >
              <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
                整年RPI平均
              </p>
              <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
                RPI={formatRpiNumber(stats.average)}
              </p>
            </div>
          </div>
        ) : null}

        <div
          className={`${compact ? "p-1.5" : "p-3"} ${EVIDENCE_CREATOR_THEME.listPanel} min-w-0 overflow-hidden`}
        >
          <div
            className={`${compact ? "mb-1 px-1.5 py-1" : "mb-3 px-3 py-2"} ${EVIDENCE_CREATOR_THEME.inset} rounded-2xl`}
          >
            <p
              className={`${compact ? "text-[8px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.12em]`}
            >
              時間線：{activePoint?.label}
            </p>
            {!compact ? (
              <div className="mt-2 grid grid-cols-6 text-center text-[10px] font-black text-stone-500 sm:grid-cols-12">
                {meta.chartData.map((point, index) => (
                  <span
                    key={point.label}
                    className={`rounded-full px-1 py-0.5 ${index === activeIndex ? EVIDENCE_CREATOR_THEME.timelineChipActive : EVIDENCE_CREATOR_THEME.timelineChipIdle}`}
                  >
                    {point.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className={
              compact
                ? "h-24 min-w-0 overflow-hidden"
                : "h-44 min-w-0 overflow-hidden"
            }
          >
            <div
              className={`${compact ? "gap-0.5" : "gap-1"} flex h-full min-w-0 items-end overflow-hidden`}
            >
              {meta.chartData.map((point, index) => {
                const barHeight = Math.max(
                  compact ? 6 : 10,
                  (point.value / maxValue) * (compact ? 54 : 104),
                );
                const isActiveTimePoint = index === activeIndex;
                const barColor = getRpiLevel(point.value).color;
                return (
                  <div
                    key={point.label}
                    className={`${compact ? "gap-0.5" : "gap-1"} flex h-full min-w-0 flex-1 flex-col justify-end rounded-xl px-0.5 text-left`}
                    aria-label={`${point.label}的RPI數據`}
                  >
                    <div
                      className={`${compact ? "text-[8px]" : "text-xs"} text-center font-black text-[#4a382b]`}
                    >
                      {formatRpiNumber(point.value)}
                    </div>
                    <div
                      className={`${isActiveTimePoint ? "ring-4 ring-[#4a382b]/25" : ""} mx-auto w-full max-w-[48px] rounded-t-2xl shadow-[0_8px_14px_rgba(45,41,34,0.12)]`}
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor: barColor,
                        transform:
                          isActiveTimePoint && !compact
                            ? "translateY(-4px)"
                            : undefined,
                      }}
                      title={`${point.label}：${formatRpiNumber(point.value)}`}
                    />
                    <div
                      className={`${compact ? "text-[8px]" : "text-[10px]"} min-w-0 whitespace-nowrap text-center font-bold text-stone-500`}
                    >
                      {point.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaterQualityStationSnapshotLiveView({
  meta,
  compact = false,
  className = "",
}: {
  meta: EvidenceSnapshotMetaLike;
  compact?: boolean;
  className?: string;
}) {
  const stations = useMemo(
    () => meta.waterQualityStations ?? [],
    [meta.waterQualityStations],
  );
  const selectedName = meta.townName || ALL_WATER_QUALITY_STATIONS_LABEL;
  const visibleStationIds = meta.waterQualityStationVisibleStationIds;
  const listStations = useMemo(() => {
    if (!visibleStationIds || visibleStationIds.length === 0) return stations;
    const visibleIdSet = new Set(visibleStationIds);
    return stations.filter((station) => visibleIdSet.has(station.siteId));
  }, [stations, visibleStationIds]);
  const overlay = getWaterQualityStationMapOverlay(selectedName, stations);
  const summary = getWaterQualityStationSummary(stations, selectedName);
  const groupedStations = useMemo(() => {
    const grouped = new Map<string, WaterQualityStationStatusRecord[]>();
    listStations.forEach((station) => {
      const basinName = station.basin || "未知流域";
      grouped.set(basinName, [...(grouped.get(basinName) ?? []), station]);
    });
    return Array.from(grouped.entries())
      .map(([basinName, groupStations]) => ({
        basinName,
        stations: groupStations.sort((a, b) => {
          const townshipCompare = a.township.localeCompare(
            b.township,
            "zh-Hant",
          );
          if (townshipCompare !== 0) return townshipCompare;
          return a.siteName.localeCompare(b.siteName, "zh-Hant");
        }),
        active: groupStations.filter(
          (station) => station.statusOfUse === "啟用",
        ).length,
        inactive: groupStations.filter(
          (station) => station.statusOfUse === "停用",
        ).length,
      }))
      .sort((a, b) => {
        if (a.basinName === "未知流域") return 1;
        if (b.basinName === "未知流域") return -1;
        return a.basinName.localeCompare(b.basinName, "zh-Hant");
      });
  }, [listStations]);
  const stationLegendNode = (
    <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2 text-[10px] font-black text-[#6d5e49] shadow-[0_10px_26px_rgba(45,41,34,0.08)]">
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className="h-2.5 w-2.5 rounded-full border border-white shadow"
            style={{ backgroundColor: "#22c55e" }}
          />
          啟用
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            className="h-2.5 w-2.5 rounded-full border border-white shadow"
            style={{ backgroundColor: "#ef4444" }}
          />
          停用
        </span>
      </div>
    </div>
  );
  const interpretationText =
    meta.interpretationText ||
    getWaterQualityStationStatusText(stations, selectedName);
  const stationListScrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const target = stationListScrollRef.current;
    if (!target) return;
    if (visibleStationIds && visibleStationIds.length > 0) {
      target.scrollTop = 0;
      return;
    }
    if (typeof meta.waterQualityStationListScrollTop !== "number") return;
    target.scrollTop = meta.waterQualityStationListScrollTop;
  }, [
    meta.waterQualityStationListScrollTop,
    stations.length,
    visibleStationIds,
  ]);

  return (
    <div
      className={`grid w-full min-w-0 gap-3 ${compact ? "text-[10px]" : "grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]"} ${className}`}
    >
      <div
        className={`${compact ? "min-h-[180px]" : "min-h-[360px]"} flex flex-col overflow-hidden ${EVIDENCE_CREATOR_THEME.sectionPanel}`}
      >
        <div
          className={`${compact ? "px-2 py-1" : "px-3 py-2"} ${EVIDENCE_CREATOR_THEME.header} flex flex-wrap items-center justify-between gap-2 rounded-t-[24px]`}
        >
          <p
            className={`${compact ? "text-[9px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em] whitespace-nowrap`}
          >
            水質監測站位置圖
          </p>
          <span
            className={`${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-1 text-[10px]"} ${EVIDENCE_CREATOR_THEME.badgeSoft} rounded-full font-black`}
          >
            {selectedName}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MiaoliDistrictSelectorMap
            selectedTown=""
            onSelectTown={() => undefined}
            onSelectMarker={() => undefined}
            title="水質監測站位置圖"
            description=""
            className="!border-0 !bg-transparent !shadow-none"
            compact
            mapHeight="100%"
            fullBleedMap
            noMapFrame
            hideHeader
            fillMapFrame
            mapScale={1}
            legend={compact ? undefined : stationLegendNode}
            disableSelectedHighlight
            hideRegionLabels={false}
            showCurrentBadge={false}
            idleRegionFill="#ffffff"
            hoverRegionFill="#fff7ea"
            overlayPaths={overlay.paths}
            overlayAreas={overlay.areas}
            overlayMarkers={overlay.markers}
          />
        </div>
      </div>

      <div
        className={`${compact ? "p-2" : "p-3"} flex min-h-0 flex-col overflow-hidden ${EVIDENCE_CREATOR_THEME.sectionPanel}`}
      >
        <div
          className={`${compact ? "mb-1" : "mb-2"} flex flex-wrap items-center justify-between gap-2`}
        >
          <div>
            <p
              className={`${compact ? "text-[9px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em]`}
            >
              數據分析圖
            </p>
            <h3
              className={`${compact ? "mt-0.5 text-[10px]" : "mt-1 text-base"} ${EVIDENCE_CREATOR_THEME.titleText} font-black`}
            >
              {selectedName}｜水質監測站
            </h3>
          </div>
          <span
            className={`${compact ? "px-1.5 py-0.5 text-[8px]" : "px-3 py-1 text-xs"} ${EVIDENCE_CREATOR_THEME.badgeSoft} rounded-full font-black`}
          >
            站
          </span>
        </div>

        <div
          className={`${compact ? "mb-1 gap-1" : "mb-2 gap-1.5"} grid shrink-0 grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,0.85fr))] items-stretch`}
        >
          <div className={`min-w-0 px-2 py-1 ${EVIDENCE_CREATOR_THEME.inset}`}>
            <p
              className={`${compact ? "text-[7px]" : "text-[9px]"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.1em]`}
            >
              目前區域
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 truncate font-black text-[#332c24]`}
            >
              {selectedName}
            </p>
          </div>
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[7px]" : "text-[9px]"} font-black tracking-[0.1em] text-stone-400`}
            >
              總數
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black text-[#332c24]`}
            >
              {summary.total}站
            </p>
          </div>
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[7px]" : "text-[9px]"} font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              啟用
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              {summary.active}站
            </p>
          </div>
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[7px]" : "text-[9px]"} font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              停用
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              {summary.inactive}站
            </p>
          </div>
        </div>

        <div
          className={`${compact ? "mb-1 px-2 py-1" : "mb-2 px-3 py-2"} ${EVIDENCE_CREATOR_THEME.infoPanel} w-full`}
        >
          <p
            className={`${compact ? "text-[8px]" : "text-xs"} ${EVIDENCE_CREATOR_THEME.heading} font-black tracking-[0.14em]`}
          >
            資料解讀
          </p>
          <p
            className={`${compact ? "mt-0.5 line-clamp-2 text-[9px] leading-4" : "mt-1 text-sm leading-6"} text-[#6d5e49] font-black`}
          >
            {interpretationText}
          </p>
        </div>

        <div
          className={`${compact ? "mb-1 gap-1" : "mb-2 gap-1.5"} grid shrink-0 grid-cols-3`}
        >
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[8px]" : "text-[9px]"} font-black tracking-[0.1em] text-stone-400`}
            >
              測站總數
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black text-[#332c24]`}
            >
              {summary.total}站
            </p>
          </div>
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[8px]" : "text-[9px]"} font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              啟用
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              {summary.active}站
            </p>
          </div>
          <div
            className={`px-2 py-1 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`${compact ? "text-[8px]" : "text-[9px]"} font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              停用
            </p>
            <p
              className={`${compact ? "text-[10px]" : "text-sm"} mt-0.5 font-black ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              {summary.inactive}站
            </p>
          </div>
        </div>

        <div
          ref={stationListScrollRef}
          className={`${compact ? "max-h-32" : "min-h-0 flex-1"} overflow-y-auto ${EVIDENCE_CREATOR_THEME.listPanel} p-2 pr-1`}
        >
          {listStations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8cbb3] bg-[#fffdf8] px-3 py-5 text-center text-sm font-black text-stone-500">
              此區域監測站數為 0
            </div>
          ) : (
            <div className="space-y-2">
              {groupedStations.map((group) => (
                <section
                  key={group.basinName}
                  className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2"
                >
                  <div
                    className={`mb-1.5 flex items-center justify-between gap-2 ${EVIDENCE_CREATOR_THEME.inset} px-2 py-1`}
                  >
                    <p className="min-w-0 truncate text-[11px] font-black tracking-[0.08em] text-[#7b5b37]">
                      {group.basinName}
                    </p>
                    <span className="shrink-0 rounded-full bg-[#fff7ea] px-2 py-0.5 text-[10px] font-black text-stone-500">
                      {group.stations.length}站
                    </span>
                  </div>
                  <div
                    className={`grid gap-1.5 ${compact ? "" : "xl:grid-cols-2"}`}
                  >
                    {group.stations.map((station) => (
                      <div
                        key={station.siteId}
                        data-station-id={station.siteId}
                        className={`flex min-w-0 items-center justify-between gap-2 px-2.5 py-2 text-left ${EVIDENCE_CREATOR_THEME.listItem}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow"
                            style={{
                              backgroundColor:
                                getWaterQualityStationStatusColor(station),
                            }}
                          />
                          <span className="min-w-0">
                            <span
                              className={`${compact ? "text-[10px]" : "text-[13px]"} block truncate font-black leading-tight text-[#332c24]`}
                            >
                              {station.siteName}
                            </span>
                            <span
                              className={`${compact ? "text-[8px]" : "text-[10.5px]"} block truncate font-bold leading-tight text-stone-500`}
                            >
                              {station.township}｜{station.basin || "未知流域"}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${station.statusOfUse === "啟用" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                        >
                          {station.statusOfUse || "未知"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
