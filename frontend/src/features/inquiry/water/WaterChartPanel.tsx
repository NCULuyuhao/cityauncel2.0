import type { Dispatch, RefObject, SetStateAction } from "react";

type CategoryKey = "water" | "land" | "leopard" | "rumor" | "other";

type EvidenceSnapshotPoint = {
  label: string;
  value: number;
};

type EvidenceSnapshotMetaLike = {
  filterLabel: string;
  unit: string;
  chartData: EvidenceSnapshotPoint[];
};

type InteractiveDataStats = {
  maxPoint: EvidenceSnapshotPoint;
  minPoint: EvidenceSnapshotPoint;
  average: number;
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

type WaterQualityStationGroup = {
  basinName: string;
  stations: WaterQualityStationStatusRecord[];
  active: number;
  inactive: number;
};

type WaterQualityStationSummary = {
  total: number;
  active: number;
  inactive: number;
};

type ThemeClasses = Record<string, string>;

type WaterChartPanelProps = {
  activeCategory: CategoryKey;
  activePlaybackPoint?: EvidenceSnapshotPoint;
  chartScaleMaxValue: number;
  dataStats: InteractiveDataStats;
  displayedWaterQualityStations: WaterQualityStationStatusRecord[];
  evidenceCreatorTheme: ThemeClasses;
  formatRpiNumber: (value: number) => string;
  getInteractiveChartFillHex: (category: CategoryKey, index: number) => string;
  getRainfallLevelColor: (value: number) => string;
  getRpiLevel: (value: number) => { color: string };
  getWaterQualityStationStatusColor: (station: WaterQualityStationStatusRecord) => string;
  isPlaying: boolean;
  isRainfallSubcategory: boolean;
  isRpiSubcategory: boolean;
  isStationSubcategory: boolean;
  isTimeSeries: boolean;
  playbackIndex: number;
  selectedName: string;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setPlaybackIndex: Dispatch<SetStateAction<number>>;
  snapshotMeta: EvidenceSnapshotMetaLike;
  waterQualityStationGroups: WaterQualityStationGroup[];
  waterQualityStationListRef: RefObject<HTMLDivElement>;
  waterQualityStationSummary: WaterQualityStationSummary;
  waterStatusText: string;
  waterUnifiedCard: ThemeClasses;
};

export default function WaterChartPanel({
  activeCategory,
  activePlaybackPoint,
  chartScaleMaxValue,
  dataStats,
  displayedWaterQualityStations,
  evidenceCreatorTheme: EVIDENCE_CREATOR_THEME,
  formatRpiNumber,
  getInteractiveChartFillHex,
  getRainfallLevelColor,
  getRpiLevel,
  getWaterQualityStationStatusColor,
  isPlaying,
  isRainfallSubcategory,
  isRpiSubcategory,
  isStationSubcategory,
  isTimeSeries,
  playbackIndex,
  selectedName,
  setIsPlaying,
  setPlaybackIndex,
  snapshotMeta,
  waterQualityStationGroups,
  waterQualityStationListRef,
  waterQualityStationSummary,
  waterStatusText,
  waterUnifiedCard: WATER_UNIFIED_CARD,
}: WaterChartPanelProps) {
  return (
<div
  className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0] p-2 shadow-inner sm:p-3`}
>
  <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
    <div className="min-w-0">
      <p
        className={`text-xs font-black tracking-[0.14em] ${EVIDENCE_CREATOR_THEME.heading}`}
      >
        數據分析圖
      </p>
      {!isStationSubcategory ? (
        <h3
          className={`mt-1 truncate text-sm font-black sm:text-base ${EVIDENCE_CREATOR_THEME.titleText}`}
        >
          {snapshotMeta.filterLabel}
        </h3>
      ) : null}
    </div>
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${EVIDENCE_CREATOR_THEME.badgeSoft}`}
    >
      {snapshotMeta.unit}
    </span>
  </div>

  {activeCategory === "water" ? (
    <div
      className={`mb-2 h-[76px] shrink-0 overflow-y-auto px-3 py-2 sm:h-[86px] ${EVIDENCE_CREATOR_THEME.infoPanel}`}
    >
      <p className="text-xs font-black tracking-[0.14em] text-[#2f6f89]">
        資料解讀
      </p>
      <p className="mt-1 text-sm font-black leading-6 text-[#27546b]">
        {waterStatusText}
      </p>
    </div>
  ) : null}

  {isStationSubcategory ? (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${EVIDENCE_CREATOR_THEME.infoPanel}`}
      >
        <div className="min-w-[92px]">
          <p
            className={`text-[10px] font-black tracking-[0.14em] ${EVIDENCE_CREATOR_THEME.heading}`}
          >
            目前區域
          </p>
          <h4 className="mt-0.5 text-base font-black leading-tight text-[#332c24]">
            {selectedName}
          </h4>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 sm:max-w-[360px]">
          <div
            className={`px-2 py-1.5 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p className="text-[9px] font-black tracking-[0.1em] text-stone-400">
              測站總數
            </p>
            <p className="mt-0.5 text-sm font-black text-[#332c24]">
              {waterQualityStationSummary.total}站
            </p>
          </div>
          <div
            className={`px-2 py-1.5 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`text-[9px] font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              啟用
            </p>
            <p
              className={`mt-0.5 text-sm font-black ${WATER_UNIFIED_CARD.statusActiveText}`}
            >
              {waterQualityStationSummary.active}站
            </p>
          </div>
          <div
            className={`px-2 py-1.5 text-center ${EVIDENCE_CREATOR_THEME.statusBox}`}
          >
            <p
              className={`text-[9px] font-black tracking-[0.1em] ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              停用
            </p>
            <p
              className={`mt-0.5 text-sm font-black ${WATER_UNIFIED_CARD.statusInactiveText}`}
            >
              {waterQualityStationSummary.inactive}站
            </p>
          </div>
        </div>
      </div>

      <div
        className={`flex h-[240px] min-h-0 flex-col overflow-hidden p-3 sm:h-[280px] lg:h-[320px] ${EVIDENCE_CREATOR_THEME.listPanel}`}
      >
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`text-xs font-black tracking-[0.14em] ${EVIDENCE_CREATOR_THEME.heading}`}
            >
              測站清單
            </p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-stone-500">
              依流域分組，清單可上下捲動
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${EVIDENCE_CREATOR_THEME.badgeSoft}`}
          >
            {displayedWaterQualityStations.length} 站
          </span>
        </div>

        <div
          ref={waterQualityStationListRef}
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          {displayedWaterQualityStations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8cbb3] bg-[#fffdf8] px-3 py-5 text-center text-sm font-black text-stone-500">
              此區域監測站數為 0
            </div>
          ) : (
            <div className="space-y-3">
              {waterQualityStationGroups.map((group) => (
                <section
                  key={group.basinName}
                  className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2"
                >
                  <div
                    className={`sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 px-2.5 py-1.5 backdrop-blur ${EVIDENCE_CREATOR_THEME.inset}`}
                  >
                    <p
                      className={`min-w-0 truncate text-[11px] font-black tracking-[0.08em] ${EVIDENCE_CREATOR_THEME.heading}`}
                    >
                      {group.basinName}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-black">
                      <span className="rounded-full bg-[#fff7ea] px-2 py-0.5 text-stone-500">
                        {group.stations.length}站
                      </span>
                      <span className="rounded-full bg-[#eef6e7] px-2 py-0.5 text-emerald-700">
                        啟用{group.active}
                      </span>
                      <span className="rounded-full bg-[#faece7] px-2 py-0.5 text-rose-700">
                        停用{group.inactive}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-1.5 xl:grid-cols-2">
                    {group.stations.map((station) => (
                      <div
                        key={station.siteId}
                        className={`flex min-w-0 items-center justify-between gap-2 px-2.5 py-2 text-left ${EVIDENCE_CREATOR_THEME.listItem}`}
                        data-station-id={station.siteId}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow"
                            style={{
                              backgroundColor:
                                getWaterQualityStationStatusColor(
                                  station,
                                ),
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-black leading-tight text-[#332c24]">
                              {station.siteName}
                            </span>
                            <span className="block truncate text-[10.5px] font-bold leading-tight text-stone-500">
                              {station.township}｜
                              {station.basin || "未知流域"}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${station.statusOfUse === "啟用" ? "bg-[#eef6e7] text-emerald-700" : "bg-[#faece7] text-rose-700"}`}
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
  ) : (
    <>
      {!isRainfallSubcategory ? (
        <div className="mb-2 grid shrink-0 grid-cols-3 gap-1.5">
          <div
            className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
          >
            <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
              {snapshotMeta.unit === "RPI" ? "RPI最高月份" : "最高"}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
              {dataStats.maxPoint.label}｜
              {snapshotMeta.unit === "RPI"
                ? `RPI=${formatRpiNumber(dataStats.maxPoint.value)}`
                : `${dataStats.maxPoint.value}${snapshotMeta.unit}`}
            </p>
          </div>
          <div
            className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
          >
            <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
              {snapshotMeta.unit === "RPI" ? "RPI最低月份" : "最低"}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
              {dataStats.minPoint.label}｜
              {snapshotMeta.unit === "RPI"
                ? `RPI=${formatRpiNumber(dataStats.minPoint.value)}`
                : `${dataStats.minPoint.value}${snapshotMeta.unit}`}
            </p>
          </div>
          <div
            className={`min-w-0 px-2 py-1 sm:px-2.5 sm:py-1.5 ${EVIDENCE_CREATOR_THEME.inset}`}
          >
            <p className="truncate text-[9px] font-black tracking-[0.08em] text-stone-400 sm:text-[10px] sm:tracking-[0.12em]">
              {snapshotMeta.unit === "RPI" ? "整年RPI平均" : "平均"}
            </p>
            <p className="mt-0.5 truncate text-[10px] font-black text-[#332c24] sm:text-xs">
              {snapshotMeta.unit === "RPI"
                ? `RPI=${formatRpiNumber(dataStats.average)}`
                : `${dataStats.average}${snapshotMeta.unit}`}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 ${EVIDENCE_CREATOR_THEME.listPanel}`}
      >
        {isTimeSeries ? (
          <div
            className={`mb-2 shrink-0 px-2 py-1.5 sm:px-3 sm:py-2 ${EVIDENCE_CREATOR_THEME.inset}`}
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p
                className={`text-xs font-black tracking-[0.12em] ${EVIDENCE_CREATOR_THEME.heading}`}
              >
                時間線：{activePlaybackPoint?.label}
              </p>
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                className={EVIDENCE_CREATOR_THEME.timelineButton}
              >
                {isPlaying ? "暫停播放" : "繼續播放"}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(snapshotMeta.chartData.length - 1, 0)}
              value={playbackIndex}
              onChange={(event) => {
                setPlaybackIndex(Number(event.target.value));
                setIsPlaying(false);
              }}
              className="w-full accent-[#c89a3a]"
              aria-label="降雨量時間線"
            />
            <div className="mt-1 grid grid-cols-6 text-center text-[9px] font-black text-stone-500 sm:grid-cols-12 sm:text-[10px]">
              {snapshotMeta.chartData.map((point, index) => (
                <button
                  key={point.label}
                  type="button"
                  onClick={() => {
                    setPlaybackIndex(index);
                    setIsPlaying(false);
                  }}
                  className={`rounded-full px-1 py-0.5 transition ${index === playbackIndex ? EVIDENCE_CREATOR_THEME.timelineChipActive : EVIDENCE_CREATOR_THEME.timelineChipIdle}`}
                >
                  {point.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className={`min-h-[170px] flex-1 overflow-hidden p-1.5 sm:min-h-[190px] sm:p-2 ${EVIDENCE_CREATOR_THEME.chartFrame}`}
        >
          {(() => {
            const chartWidth = Math.max(
              snapshotMeta.chartData.length * 44,
              520,
            );
            const chartHeight = 210;
            const chartTop = 28;
            const chartBottom = 34;
            const chartLeft = 8;
            const chartRight = 8;
            const chartInnerHeight =
              chartHeight - chartTop - chartBottom;
            const slotWidth =
              (chartWidth - chartLeft - chartRight) /
              Math.max(snapshotMeta.chartData.length, 1);
            const barWidth = Math.max(
              14,
              Math.min(slotWidth * 0.58, 34),
            );

            return (
              <svg
                className="block h-full min-h-[160px] w-full overflow-visible"
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="數據長條圖"
              >
                <line
                  x1={chartLeft}
                  y1={chartTop + chartInnerHeight}
                  x2={chartWidth - chartRight}
                  y2={chartTop + chartInnerHeight}
                  stroke="rgba(120,113,108,0.22)"
                  strokeWidth="1"
                />
                {snapshotMeta.chartData.map((point, index) => {
                  const safeScale = Math.max(chartScaleMaxValue, 1);
                  const barHeight = Math.max(
                    12,
                    (point.value / safeScale) *
                      (chartInnerHeight - 18),
                  );
                  const centerX =
                    chartLeft + slotWidth * index + slotWidth / 2;
                  const x = centerX - barWidth / 2;
                  const y = chartTop + chartInnerHeight - barHeight;
                  const isActiveTimePoint =
                    activeCategory === "water" &&
                    index === playbackIndex;
                  const barColor = isRainfallSubcategory
                    ? getRainfallLevelColor(point.value)
                    : isRpiSubcategory
                      ? getRpiLevel(point.value).color
                      : getInteractiveChartFillHex(
                          activeCategory,
                          index,
                        );
                  const valueText =
                    snapshotMeta.unit === "RPI"
                      ? formatRpiNumber(point.value)
                      : String(point.value);

                  return (
                    <g
                      key={point.label}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer outline-none"
                      onClick={() => {
                        setPlaybackIndex(index);
                        setIsPlaying(false);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          setPlaybackIndex(index);
                          setIsPlaying(false);
                        }
                      }}
                    >
                      <title>{`${point.label}：${snapshotMeta.unit === "RPI" ? formatRpiNumber(point.value) : `${point.value}${snapshotMeta.unit}`}`}</title>
                      <rect
                        x={centerX - slotWidth / 2 + 2}
                        y={chartTop - 8}
                        width={Math.max(slotWidth - 4, 18)}
                        height={chartInnerHeight + chartBottom + 6}
                        rx="11"
                        fill={
                          isActiveTimePoint
                            ? "rgba(200,154,58,0.10)"
                            : "transparent"
                        }
                      />
                      <text
                        x={centerX}
                        y={Math.max(13, y - 6)}
                        textAnchor="middle"
                        fontSize={isRpiSubcategory ? 13 : 12}
                        fontWeight="900"
                        fill="#7b5b37"
                      >
                        {valueText}
                      </text>
                      <rect
                        x={x}
                        y={isActiveTimePoint ? y - 4 : y}
                        width={barWidth}
                        height={barHeight}
                        rx="9"
                        fill={barColor}
                        filter="drop-shadow(0 7px 8px rgba(45,41,34,0.16))"
                        stroke={
                          isActiveTimePoint
                            ? "rgba(74,56,43,0.35)"
                            : "transparent"
                        }
                        strokeWidth={isActiveTimePoint ? 3 : 0}
                      />
                      <text
                        x={centerX}
                        y={chartTop + chartInnerHeight + 23}
                        textAnchor="middle"
                        fontSize={isRpiSubcategory ? 13 : 12}
                        fontWeight="800"
                        fill="#78716c"
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>{" "}
      </div>
    </>
  )}
</div>
  );
}
