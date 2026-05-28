import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import WaterMapPanel from "@/features/inquiry/water/WaterMapPanel";
import WaterChartPanel from "@/features/inquiry/water/WaterChartPanel";
import SnapshotCaptureOverlay from "@/features/inquiry/snapshots/SnapshotCaptureOverlay";
import {
  captureElementAsImageDataUrl,
  waitForUiSequence,
} from "@/features/inquiry/snapshots/snapshotCapture";
import {
  cwaRainfallLegend,
  formatRpiNumber,
  getInteractiveChartFillHex,
  getInteractiveDataStats,
  getRainfallLevelColor,
  getRpiLevel,
  roundRpiValue,
  rpiLegend,
} from "@/features/inquiry/snapshots/snapshotBuilder";
import {
  EVIDENCE_CREATOR_THEME,
  WATER_UNIFIED_CARD,
} from "@/features/inquiry/snapshots/evidenceCreatorTheme";
import type {
  CategoryKey,
  EvidenceSnapshotMeta,
  WaterQualityStationStatusRecord,
} from "@/features/inquiry/inquiryDataTypes";
import { uploadClueSnapshotImage } from "@/api/inquiryApi";
import { stripLargeSnapshotPayload } from "@/features/inquiry/cards/cardSerialization";
import {
  ALL_TOWNS_LABEL,
  ALL_WATER_TOWNS_LABEL,
  INTERACTIVE_TOWN_OPTIONS,
  LATEST_WATER_DATA_MONTH,
  RECENT_WATER_MONTH_LABELS,
  getWaterTownRecordsForMonth,
  parseWaterTownMonthlyCsv,
  type WaterTownMonthlyRecord,
} from "@/features/inquiry/water/waterResources";
import {
  ALL_WATER_QUALITY_STATIONS_LABEL,
  ALL_WATER_RPI_LABEL,
  INTERACTIVE_DATA_OPTIONS,
  buildInteractiveSnapshotMeta,
  buildRainfallTownFillMap,
  buildSnapshotSvgDataUrl,
  buildWaterQualityStationSnapshotMeta,
  buildWaterRpiSnapshotMeta,
  buildWaterTownRainfallSnapshotMeta,
  fetchCsvText,
  filterWaterQualityStationsByTown,
  getInteractiveSelectorOptions,
  getVisibleStationIdsFromScrollContainer,
  getWaterMapOverlay,
  getWaterMetricForSubcategory,
  getWaterQualityStationMapOverlay,
  getWaterQualityStationOptions,
  getWaterQualityStationStatusColor,
  getWaterQualityStationStatusText,
  getWaterQualityStationSummary,
  getWaterRainfallStatusText,
  getWaterRpiMapOverlay,
  getWaterRpiOptions,
  getWaterRpiRecordsForMonth,
  getWaterRpiStatusText,
  getWaterSelectionConfig,
  getWaterSelectionStatusText,
  isTownSelection,
  isWaterRpiMap,
  isWaterSeasonalRainfall,
  isWaterStationMap,
  isWaterTimeSeries,
  parseWaterQualityStationStatusCsv,
  parseWaterRpiRiverMonthlyCsv,
  type InteractiveSelection,
  type WaterRpiRiverMonthlyRecord,
} from "@/features/inquiry/water/interactiveDataSnapshotHelpers";

export function InteractiveDataSnapshotPanel({
  activeCategory,
  token,
  onCreateSnapshotCard,
}: {
  activeCategory: CategoryKey;
  token?: string;
  onCreateSnapshotCard: (
    meta: EvidenceSnapshotMeta,
    reason: string,
    snapshotImageUrl?: string,
  ) => void;
}) {
  const options = INTERACTIVE_DATA_OPTIONS[activeCategory];
  const initialSubcategory =
    activeCategory === "water" ? "降雨量" : options.subcategories[0];
  const [selectedName, setSelectedName] =
    useState<InteractiveSelection>(ALL_TOWNS_LABEL);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [metric, setMetric] = useState(
    activeCategory === "water"
      ? getWaterMetricForSubcategory(initialSubcategory)
      : options.metrics[0],
  );
  const [capturePreviewSnapshot, setCapturePreviewSnapshot] =
    useState<EvidenceSnapshotMeta | null>(null);
  const [capturePreviewImageSrc, setCapturePreviewImageSrc] = useState("");
  const [capturePreviewPhase, setCapturePreviewPhase] = useState<
    "capturing" | "complete"
  >("capturing");
  const [captureErrorMessage, setCaptureErrorMessage] = useState("");
  const captureEffectTimerRef = useRef<number | null>(null);
  const capturePhaseTimerRef = useRef<number | null>(null);
  const [isSavingSnapshotImage, setIsSavingSnapshotImage] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [waterTownMonthlyRecords, setWaterTownMonthlyRecords] = useState<
    WaterTownMonthlyRecord[]
  >([]);
  const [waterRpiRiverMonthlyRecords, setWaterRpiRiverMonthlyRecords] =
    useState<WaterRpiRiverMonthlyRecord[]>([]);
  const [waterQualityStationRecords, setWaterQualityStationRecords] = useState<
    WaterQualityStationStatusRecord[]
  >([]);
  const [showWaterMapRegionLabels, setShowWaterMapRegionLabels] =
    useState(true);
  const waterQualityStationListRef = useRef<HTMLDivElement | null>(null);
  const captureAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (captureEffectTimerRef.current !== null) {
        window.clearTimeout(captureEffectTimerRef.current);
        captureEffectTimerRef.current = null;
      }
      if (capturePhaseTimerRef.current !== null) {
        window.clearTimeout(capturePhaseTimerRef.current);
        capturePhaseTimerRef.current = null;
      }
      setCapturePreviewSnapshot(null);
      setCapturePreviewImageSrc("");
      setCapturePreviewPhase("capturing");
      setCaptureErrorMessage("");
      setCapturePreviewPhase("capturing");
    };
  }, []);

  useEffect(() => {
    if (activeCategory !== "water") return;
    if (
      waterTownMonthlyRecords.length > 0 &&
      waterRpiRiverMonthlyRecords.length > 0 &&
      waterQualityStationRecords.length > 0
    ) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      waterTownMonthlyRecords.length > 0
        ? Promise.resolve<WaterTownMonthlyRecord[] | null>(null)
        : fetchCsvText(
            "/data/miaoli_cwa_town_monthly_2025.csv",
            "水資源地區資料",
            controller.signal,
          ).then(parseWaterTownMonthlyCsv),
      waterRpiRiverMonthlyRecords.length > 0
        ? Promise.resolve<WaterRpiRiverMonthlyRecord[] | null>(null)
        : fetchCsvText(
            "/data/water_rpi_river_monthly_2025.csv",
            "水質RPI資料",
            controller.signal,
          ).then(parseWaterRpiRiverMonthlyCsv),
      waterQualityStationRecords.length > 0
        ? Promise.resolve<WaterQualityStationStatusRecord[] | null>(null)
        : fetchCsvText(
            "/data/water_quality_station_status_2025.csv",
            "水質監測站資料",
            controller.signal,
          ).then(parseWaterQualityStationStatusCsv),
    ])
      .then(([rainfallRecords, rpiRecords, stationRecords]) => {
        if (controller.signal.aborted) return;
        if (rainfallRecords) setWaterTownMonthlyRecords(rainfallRecords);
        if (rpiRecords) setWaterRpiRiverMonthlyRecords(rpiRecords);
        if (stationRecords) setWaterQualityStationRecords(stationRecords);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn(error);
        if (waterTownMonthlyRecords.length === 0)
          setWaterTownMonthlyRecords([]);
        if (waterRpiRiverMonthlyRecords.length === 0)
          setWaterRpiRiverMonthlyRecords([]);
        if (waterQualityStationRecords.length === 0)
          setWaterQualityStationRecords([]);
      });

    return () => controller.abort();
  }, [
    activeCategory,
    waterQualityStationRecords.length,
    waterRpiRiverMonthlyRecords.length,
    waterTownMonthlyRecords.length,
  ]);

  useEffect(() => {
    const nextOptions = INTERACTIVE_DATA_OPTIONS[activeCategory];
    const nextSubcategory =
      activeCategory === "water" ? "降雨量" : nextOptions.subcategories[0];

    const timer = window.setTimeout(() => {
      setSubcategory(nextSubcategory);
      setMetric(
        activeCategory === "water"
          ? getWaterMetricForSubcategory(nextSubcategory)
          : nextOptions.metrics[0],
      );
      setSelectedName(
        activeCategory === "water" ? ALL_WATER_TOWNS_LABEL : ALL_TOWNS_LABEL,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory]);
  const waterRpiOptions = useMemo(
    () => getWaterRpiOptions(waterRpiRiverMonthlyRecords),
    [waterRpiRiverMonthlyRecords],
  );
  const waterQualityStationOptions = useMemo(
    () => getWaterQualityStationOptions(),
    [],
  );
  const selectorOptions =
    activeCategory === "water" && subcategory === "降雨量"
      ? INTERACTIVE_TOWN_OPTIONS
      : activeCategory === "water" && isWaterRpiMap(activeCategory, subcategory)
        ? waterRpiOptions
        : activeCategory === "water" &&
            isWaterStationMap(activeCategory, subcategory)
          ? waterQualityStationOptions
          : getInteractiveSelectorOptions(activeCategory, subcategory);

  useEffect(() => {
    if (selectorOptions.includes(selectedName)) return;
    const timer = window.setTimeout(() => {
      setSelectedName(selectorOptions[0] ?? ALL_TOWNS_LABEL);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedName, selectorOptions]);
  const effectiveMetric =
    activeCategory === "water"
      ? getWaterMetricForSubcategory(subcategory)
      : metric;
  const isRainfallSubcategory = isWaterSeasonalRainfall(
    activeCategory,
    subcategory,
  );
  const isRpiSubcategory = isWaterRpiMap(activeCategory, subcategory);
  const isStationSubcategory = isWaterStationMap(activeCategory, subcategory);
  const shouldControlWaterMapRegionLabels = isRpiSubcategory;

  useEffect(() => {
    if (
      activeCategory === "water" &&
      isWaterRpiMap(activeCategory, subcategory)
    ) {
      const timer = window.setTimeout(() => {
        setShowWaterMapRegionLabels(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeCategory, subcategory]);

  const activeStationMonthLabel =
    RECENT_WATER_MONTH_LABELS[playbackIndex] ?? LATEST_WATER_DATA_MONTH;
  const mapOverlay = useMemo(() => {
    if (activeCategory !== "water")
      return { paths: [], areas: [], markers: [] };
    if (subcategory === "降雨量") {
      return {
        paths: [],
        areas: [],
        markers: [],
      };
    }
    if (isWaterRpiMap(activeCategory, subcategory)) {
      return getWaterRpiMapOverlay(
        selectedName,
        waterRpiRiverMonthlyRecords,
        activeStationMonthLabel,
      );
    }
    if (isWaterStationMap(activeCategory, subcategory)) {
      return getWaterQualityStationMapOverlay(
        selectedName,
        waterQualityStationRecords,
      );
    }
    return getWaterMapOverlay(subcategory, selectedName);
  }, [
    activeCategory,
    activeStationMonthLabel,
    selectedName,
    subcategory,
    waterQualityStationRecords,
    waterRpiRiverMonthlyRecords,
  ]);

  const snapshotMeta = useMemo(
    () =>
      activeCategory === "water" && subcategory === "降雨量"
        ? buildWaterTownRainfallSnapshotMeta(
            selectedName,
            waterTownMonthlyRecords,
          )
        : activeCategory === "water" &&
            isWaterRpiMap(activeCategory, subcategory)
          ? buildWaterRpiSnapshotMeta(
              selectedName,
              subcategory,
              waterRpiRiverMonthlyRecords,
            )
          : activeCategory === "water" &&
              isWaterStationMap(activeCategory, subcategory)
            ? buildWaterQualityStationSnapshotMeta(
                selectedName,
                waterQualityStationRecords,
              )
            : buildInteractiveSnapshotMeta(
                activeCategory,
                selectedName,
                subcategory,
                effectiveMetric,
              ),
    [
      activeCategory,
      effectiveMetric,
      selectedName,
      subcategory,
      waterQualityStationRecords,
      waterRpiRiverMonthlyRecords,
      waterTownMonthlyRecords,
    ],
  );
  const isTimeSeries =
    activeCategory === "water" && isWaterTimeSeries(subcategory, selectedName);

  useEffect(() => {
    const timer = window.setTimeout(() => setPlaybackIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory, effectiveMetric, subcategory]);

  useEffect(() => {
    if (!isTimeSeries || !isPlaying) return;
    const timer = window.setInterval(() => {
      setPlaybackIndex(
        (prev) => (prev + 1) % Math.max(snapshotMeta.chartData.length, 1),
      );
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isPlaying, isTimeSeries, snapshotMeta.chartData.length]);

  const maxValue = Math.max(
    ...snapshotMeta.chartData.map((point) => point.value),
    1,
  );
  const rainfallChartMaxValue = useMemo(
    () =>
      Math.max(
        ...waterTownMonthlyRecords.map((record) => record.rainfall),
        maxValue,
        1,
      ),
    [maxValue, waterTownMonthlyRecords],
  );
  const chartScaleMaxValue = isRainfallSubcategory
    ? rainfallChartMaxValue
    : maxValue;
  const dataStats = useMemo(
    () => getInteractiveDataStats(snapshotMeta.chartData),
    [snapshotMeta.chartData],
  );
  const activePlaybackPoint =
    snapshotMeta.chartData[playbackIndex] ?? snapshotMeta.chartData[0];
  const rainfallRegionFillMap = isRainfallSubcategory
    ? buildRainfallTownFillMap(
        waterTownMonthlyRecords,
        selectedName,
        activeStationMonthLabel,
      )
    : undefined;
  const rainfallLegendNode = isTimeSeries ? (
    <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2 text-[10px] font-black text-[#6d5e49] shadow-[0_10px_26px_rgba(45,41,34,0.08)]">
      <p className="mb-1 text-center tracking-[0.12em] text-[#7b5b37]">
        降雨量圖例
      </p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {cwaRainfallLegend.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1 whitespace-nowrap"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: item.color }}
            />
            {item.label}mm
          </span>
        ))}
      </div>
    </div>
  ) : null;
  const rpiLegendNode = isRpiSubcategory ? (
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
  ) : null;
  const waterStatusText =
    activeCategory === "water"
      ? subcategory === "降雨量"
        ? getWaterRainfallStatusText(
            waterTownMonthlyRecords,
            selectedName,
            playbackIndex,
          )
        : isWaterRpiMap(activeCategory, subcategory)
          ? getWaterRpiStatusText(
              waterRpiRiverMonthlyRecords,
              selectedName,
              playbackIndex,
            )
          : isWaterStationMap(activeCategory, subcategory)
            ? getWaterQualityStationStatusText(
                waterQualityStationRecords,
                selectedName,
              )
            : getWaterSelectionStatusText(subcategory, selectedName)
      : "";
  const displayedWaterQualityStations = useMemo(
    () =>
      filterWaterQualityStationsByTown(
        waterQualityStationRecords,
        selectedName,
      ),
    [selectedName, waterQualityStationRecords],
  );
  const waterQualityStationSummary = useMemo(
    () =>
      getWaterQualityStationSummary(waterQualityStationRecords, selectedName),
    [selectedName, waterQualityStationRecords],
  );
  const waterQualityStationGroups = useMemo(() => {
    const grouped = new Map<string, WaterQualityStationStatusRecord[]>();
    displayedWaterQualityStations.forEach((station) => {
      const basinName = station.basin || "未知流域";
      grouped.set(basinName, [...(grouped.get(basinName) ?? []), station]);
    });

    return Array.from(grouped.entries())
      .map(([basinName, stations]) => ({
        basinName,
        stations: stations.sort((a, b) => {
          const townshipCompare = a.township.localeCompare(
            b.township,
            "zh-Hant",
          );
          if (townshipCompare !== 0) return townshipCompare;
          return a.siteName.localeCompare(b.siteName, "zh-Hant");
        }),
        active: stations.filter((station) => station.statusOfUse === "啟用")
          .length,
        inactive: stations.filter((station) => station.statusOfUse === "停用")
          .length,
      }))
      .sort((a, b) => {
        if (a.basinName === "未知流域") return 1;
        if (b.basinName === "未知流域") return -1;
        return a.basinName.localeCompare(b.basinName, "zh-Hant");
      });
  }, [displayedWaterQualityStations]);

  const handleOpenCapture = async () => {
    if (isSavingSnapshotImage) return;

    const mapTownValues = isRainfallSubcategory
      ? Object.fromEntries(
          getWaterTownRecordsForMonth(
            waterTownMonthlyRecords,
            activeStationMonthLabel,
          )
            .filter(
              (record) =>
                selectedName === ALL_WATER_TOWNS_LABEL ||
                record.town === selectedName,
            )
            .map((record) => [record.town, record.rainfall]),
        )
      : undefined;
    const mapRiverValues = isRpiSubcategory
      ? Object.fromEntries(
          getWaterRpiRecordsForMonth(
            waterRpiRiverMonthlyRecords,
            activeStationMonthLabel,
          )
            .filter(
              (record) =>
                selectedName === ALL_WATER_RPI_LABEL ||
                selectedName.startsWith("全部") ||
                record.river === selectedName,
            )
            .map((record) => [record.river, roundRpiValue(record.rpi)]),
        )
      : undefined;

    const nextSnapshot: EvidenceSnapshotMeta = {
      ...snapshotMeta,
      activeTimeIndex: isTimeSeries ? playbackIndex : undefined,
      interpretationText: waterStatusText,
      mapTownValues,
      mapRiverValues,
      showRegionLabels: isRpiSubcategory ? showWaterMapRegionLabels : undefined,
      waterQualityStations: isStationSubcategory
        ? filterWaterQualityStationsByTown(
            waterQualityStationRecords,
            selectedName,
          )
        : undefined,
      waterQualityStationListScrollTop: isStationSubcategory
        ? (waterQualityStationListRef.current?.scrollTop ?? 0)
        : undefined,
      waterQualityStationVisibleStationIds: isStationSubcategory
        ? getVisibleStationIdsFromScrollContainer(
            waterQualityStationListRef.current,
          )
        : undefined,
    };

    if (captureEffectTimerRef.current !== null) {
      window.clearTimeout(captureEffectTimerRef.current);
      captureEffectTimerRef.current = null;
    }
    if (capturePhaseTimerRef.current !== null) {
      window.clearTimeout(capturePhaseTimerRef.current);
      capturePhaseTimerRef.current = null;
    }

    if (isTimeSeries) setIsPlaying(false);
    setIsSavingSnapshotImage(true);
    setCaptureErrorMessage("");
    setCapturePreviewPhase("capturing");

    try {
      const captureTarget = captureAreaRef.current;
      if (!captureTarget) {
        throw new Error("找不到可擷取的互動數據區域");
      }

      const directCapturedImageDataUrl =
        await captureElementAsImageDataUrl(captureTarget);
      setCapturePreviewSnapshot(nextSnapshot);
      setCapturePreviewImageSrc(directCapturedImageDataUrl);
      setCapturePreviewPhase("capturing");
      capturePhaseTimerRef.current = window.setTimeout(() => {
        setCapturePreviewPhase("complete");
        capturePhaseTimerRef.current = null;
      }, 1700);

      let snapshotImageSrc = directCapturedImageDataUrl;
      let snapshotImageUrl = "";
      let snapshotRelativeUrl = "";
      let snapshotFilename = "";
      if (token) {
        const uploaded = await uploadClueSnapshotImage(token, {
          imageDataUrl: directCapturedImageDataUrl,
          title: nextSnapshot.filterLabel,
          meta: stripLargeSnapshotPayload(nextSnapshot),
        });
        snapshotImageUrl = uploaded.imageUrl;
        snapshotRelativeUrl = uploaded.relativeUrl;
        snapshotFilename = uploaded.filename;
        snapshotImageSrc = uploaded.imageUrl;
      }

      const compactSnapshot = stripLargeSnapshotPayload({
        ...nextSnapshot,
        photoSnapshotImageUrl:
          snapshotImageUrl || nextSnapshot.photoSnapshotImageUrl,
        photoSnapshotRelativeUrl:
          snapshotRelativeUrl || nextSnapshot.photoSnapshotRelativeUrl,
        photoSnapshotFilename:
          snapshotFilename || nextSnapshot.photoSnapshotFilename,
      });

      // 先讓學生看見「畫面擷取中 → 擷取完成」的完整掃描演出，
      // 再把畫面交給下方卡片清單接續捲動與閃爍。
      await waitForUiSequence(3050);

      onCreateSnapshotCard(
        compactSnapshot,
        "系統自動擷取互動式數據探索畫面，已直接建立為解鎖線索卡。",
        snapshotImageSrc,
      );
    } catch (error) {
      console.error(
        "直接擷取互動數據畫面失敗，未建立快照卡，避免產生與畫面不一致的重畫圖。",
        error,
      );
      setCaptureErrorMessage(
        "目前瀏覽器無法直接擷取這個畫面，請重新整理後再試一次。這次沒有建立重畫版快照卡，避免和畫面不一致。",
      );
    } finally {
      captureEffectTimerRef.current = window.setTimeout(() => {
        setCapturePreviewSnapshot(null);
        setCapturePreviewImageSrc("");
        setCapturePreviewPhase("capturing");
        captureEffectTimerRef.current = null;
      }, 520);
      setIsSavingSnapshotImage(false);
    }
  };

  return (
    <>
      <section
        className={`mb-4 flex min-h-[clamp(760px,calc(100svh-96px),900px)] flex-col rounded-[24px] border p-2 shadow-[0_12px_32px_rgba(45,41,34,0.09)] sm:p-3 ${EVIDENCE_CREATOR_THEME.section}`}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-black tracking-[0.14em] ${EVIDENCE_CREATOR_THEME.badge}`}
            >
              互動式數據探索
            </p>
            <h2 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
              建立自己的證據卡
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              onClick={handleOpenCapture}
              disabled={isSavingSnapshotImage}
              className={EVIDENCE_CREATOR_THEME.primaryButton}
            >
              {isSavingSnapshotImage ? "正在擷取線索..." : "擷取線索"}
            </Button>
            {captureErrorMessage ? (
              <p className="max-w-[360px] rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black leading-5 text-red-700">
                {captureErrorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className={EVIDENCE_CREATOR_THEME.surface}>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
                  選擇地區以及想看的數據類型
                </h3>
              </div>
              <p className="rounded-full border border-[#d8cbb3] bg-[#fffaf0] px-3 py-1.5 text-xs font-black text-[#6d5e49]">
                目前：{selectedName}
              </p>
            </div>

            <div className="grid gap-4 min-[680px]:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-[#4a3828]">
                  顯示區域數據
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectorOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSelectedName(item)}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        selectedName === item
                          ? "border-[#6f7d5f] bg-[#edf5df] text-[#445236] shadow-sm"
                          : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49] hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-[#4a3828]">
                  數據分類與面向
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.subcategories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSubcategory(item);
                        if (activeCategory === "water") {
                          setMetric(getWaterMetricForSubcategory(item));
                          setSelectedName(
                            item === "降雨量"
                              ? ALL_WATER_TOWNS_LABEL
                              : item === "水質監測站"
                                ? ALL_WATER_QUALITY_STATIONS_LABEL
                                : getWaterSelectionConfig(item).allLabel,
                          );
                        }
                      }}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        subcategory === item
                          ? "border-[#9b7b55] bg-[#fff0cf] text-[#5f4528] shadow-sm"
                          : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49] hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeCategory !== "water" ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-black tracking-[0.14em] text-[#7b5b37]">
                  指標
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.metrics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMetric(item)}
                      className={`min-h-[42px] min-w-[96px] rounded-2xl border px-4 py-2 text-sm font-black transition ${
                        metric === item
                          ? "border-[#9b7b55] bg-[#fff0cf] text-[#5f4528]"
                          : "border-[#d8cbb3] bg-[#fffdf8] text-stone-600 hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div
            ref={captureAreaRef}
            className="uiux-inquiry-stage-grid uiux-map-chart-stage flex-1"
          >
            <WaterMapPanel
              theme={EVIDENCE_CREATOR_THEME}
              selectedName={selectedName}
              mapTitle={
                isRainfallSubcategory
                  ? "地區降雨量時間地圖"
                  : isRpiSubcategory
                    ? `${subcategory}位置圖`
                    : isStationSubcategory
                      ? "水質監測站位置圖"
                      : "地圖位置預覽"
              }
              selectedTownForDistrictMap={
                isTownSelection(activeCategory, subcategory) ? selectedName : ""
              }
              isRpiSubcategory={isRpiSubcategory}
              isRainfallSubcategory={isRainfallSubcategory}
              isStationSubcategory={isStationSubcategory}
              isTimeSeries={isTimeSeries}
              activePlaybackLabel={activePlaybackPoint?.label}
              shouldControlRegionLabels={shouldControlWaterMapRegionLabels}
              showRegionLabels={showWaterMapRegionLabels}
              onToggleRegionLabels={() =>
                setShowWaterMapRegionLabels((prev) => !prev)
              }
              onSelectRiver={(nextSelection) => setSelectedName(nextSelection)}
              onSelectTown={(nextTown) => {
                if (activeCategory === "water" && subcategory === "降雨量") {
                  if (INTERACTIVE_TOWN_OPTIONS.includes(nextTown))
                    setSelectedName(nextTown);
                  return;
                }
                if (isTownSelection(activeCategory, subcategory))
                  setSelectedName(nextTown);
              }}
              onSelectMarker={(nextSelection) => {
                if (
                  activeCategory === "water" &&
                  (subcategory === "降雨量" ||
                    isWaterStationMap(activeCategory, subcategory))
                ) {
                  setSelectedName(nextSelection);
                }
              }}
              rpiOverlay={{
                areas: mapOverlay.areas,
                markers: mapOverlay.markers,
              }}
              districtOverlay={mapOverlay}
              rpiLegendNode={rpiLegendNode}
              rainfallLegendNode={rainfallLegendNode}
              rainfallRegionFillMap={rainfallRegionFillMap}
            />

            <WaterChartPanel
              activeCategory={activeCategory}
              activePlaybackPoint={activePlaybackPoint}
              chartScaleMaxValue={chartScaleMaxValue}
              dataStats={dataStats}
              displayedWaterQualityStations={displayedWaterQualityStations}
              evidenceCreatorTheme={EVIDENCE_CREATOR_THEME}
              formatRpiNumber={formatRpiNumber}
              getInteractiveChartFillHex={getInteractiveChartFillHex}
              getRainfallLevelColor={getRainfallLevelColor}
              getRpiLevel={getRpiLevel}
              getWaterQualityStationStatusColor={
                getWaterQualityStationStatusColor
              }
              isPlaying={isPlaying}
              isRainfallSubcategory={isRainfallSubcategory}
              isRpiSubcategory={isRpiSubcategory}
              isStationSubcategory={isStationSubcategory}
              isTimeSeries={isTimeSeries}
              playbackIndex={playbackIndex}
              selectedName={selectedName}
              setIsPlaying={setIsPlaying}
              setPlaybackIndex={setPlaybackIndex}
              snapshotMeta={snapshotMeta}
              waterQualityStationGroups={waterQualityStationGroups}
              waterQualityStationListRef={waterQualityStationListRef}
              waterQualityStationSummary={waterQualityStationSummary}
              waterStatusText={waterStatusText}
              waterUnifiedCard={WATER_UNIFIED_CARD}
            />
          </div>
        </div>
      </section>

      <SnapshotCaptureOverlay
        snapshot={capturePreviewSnapshot}
        imageSrc={capturePreviewImageSrc}
        phase={capturePreviewPhase}
        buildSnapshotSvgDataUrl={buildSnapshotSvgDataUrl}
      />
    </>
  );
}
