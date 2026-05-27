/**
 * CityAuncel maintainability notes
 * 檔案用途：水資源探究模組 WaterMapPanel，處理水資源地圖、圖表、快照或資料守門。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { ReactNode } from "react";
import MiaoliDistrictSelectorMap from "@/components/MiaoliDistrictSelectorMap";
import WaterRpiRiverMap, {
  type RpiMapArea,
  type RpiMapMarker,
} from "@/components/WaterRpiRiverMap";

type WaterDistrictOverlay = {
  paths?: Array<{
    id: string;
    points: string;
    color?: string;
    width?: number;
  }>;
  areas?: Array<{
    id: string;
    d: string;
    color?: string;
    opacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
  }>;
  markers?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    color?: string;
    selected?: boolean;
    selectValue?: string;
    kind?: "river" | "stream" | "station";
    hideLabel?: boolean;
    labelDx?: number;
    labelDy?: number;
    labelAnchor?: "start" | "middle" | "end";
    labelWidth?: number;
  }>;
};

type EvidenceCreatorTheme = {
  sectionPanel: string;
  header: string;
  heading: string;
  toggleButton: string;
  badgeSoft: string;
};

type WaterMapPanelProps = {
  theme: EvidenceCreatorTheme;
  selectedName: string;
  mapTitle: string;
  selectedTownForDistrictMap: string;
  isRpiSubcategory: boolean;
  isRainfallSubcategory: boolean;
  isStationSubcategory: boolean;
  isTimeSeries: boolean;
  activePlaybackLabel?: string;
  shouldControlRegionLabels: boolean;
  showRegionLabels: boolean;
  onToggleRegionLabels: () => void;
  onSelectRiver: (nextSelection: string) => void;
  onSelectTown: (nextTown: string) => void;
  onSelectMarker: (nextSelection: string) => void;
  rpiOverlay: {
    areas: RpiMapArea[];
    markers: RpiMapMarker[];
  };
  districtOverlay: WaterDistrictOverlay;
  rpiLegendNode?: ReactNode;
  rainfallLegendNode?: ReactNode;
  rainfallRegionFillMap?: Record<string, string>;
};

export default function WaterMapPanel({
  theme,
  selectedName,
  mapTitle,
  selectedTownForDistrictMap,
  isRpiSubcategory,
  isRainfallSubcategory,
  isStationSubcategory,
  isTimeSeries,
  activePlaybackLabel,
  shouldControlRegionLabels,
  showRegionLabels,
  onToggleRegionLabels,
  onSelectRiver,
  onSelectTown,
  onSelectMarker,
  rpiOverlay,
  districtOverlay,
  rpiLegendNode,
  rainfallLegendNode,
  rainfallRegionFillMap,
}: WaterMapPanelProps) {
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${theme.sectionPanel}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-t-[24px] px-3 py-2 ${theme.header}`}
      >
        <p
          className={`whitespace-nowrap text-xs font-black tracking-[0.14em] ${theme.heading}`}
        >
          {mapTitle}
        </p>
        <div className="flex items-center gap-2">
          {shouldControlRegionLabels ? (
            <button
              type="button"
              onClick={onToggleRegionLabels}
              className={theme.toggleButton}
            >
              {showRegionLabels ? "關閉區域名稱" : "開啟區域名稱"}
            </button>
          ) : null}
          {isTimeSeries && activePlaybackLabel ? (
            <span
              className={`${theme.badgeSoft} rounded-full px-2.5 py-1 text-[10px] font-black`}
            >
              {activePlaybackLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {isRpiSubcategory ? (
          <WaterRpiRiverMap
            selectedRiver={selectedName}
            onSelectRiver={onSelectRiver}
            areas={rpiOverlay.areas}
            markers={rpiOverlay.markers}
            legend={rpiLegendNode}
            showRegionLabels={showRegionLabels}
            mapHeight="100%"
            townFill="#ffffff"
            townStroke="#eadfcf"
          />
        ) : (
          <MiaoliDistrictSelectorMap
            selectedTown={selectedTownForDistrictMap}
            onSelectTown={onSelectTown}
            onSelectMarker={onSelectMarker}
            title={mapTitle}
            description=""
            className="!border-0 !bg-transparent !shadow-none"
            compact
            mapHeight="100%"
            fullBleedMap
            noMapFrame
            hideHeader
            fillMapFrame
            mapScale={1}
            legend={isRainfallSubcategory ? rainfallLegendNode : undefined}
            regionFillMap={rainfallRegionFillMap}
            selectedTownFill={isStationSubcategory ? "#d9f99d" : undefined}
            selectedTownStroke={isStationSubcategory ? "#3f6212" : undefined}
            selectedTownValueLabel={undefined}
            idleRegionFill={
              isRainfallSubcategory || isStationSubcategory ? "#ffffff" : undefined
            }
            hoverRegionFill={
              isRainfallSubcategory || isStationSubcategory ? "#f6fbff" : undefined
            }
            activeLabel={isTimeSeries ? activePlaybackLabel : undefined}
            showCurrentBadge={false}
            disableSelectedHighlight={
              !(isRainfallSubcategory || isStationSubcategory)
            }
            selectedFloatOnly={isRainfallSubcategory}
            hideRegionLabels={
              shouldControlRegionLabels ? !showRegionLabels : false
            }
            backgroundImageSrc={undefined}
            interactionRegions={undefined}
            transparentRegionButtons={false}
            overlayPaths={districtOverlay.paths}
            overlayAreas={districtOverlay.areas}
            overlayMarkers={districtOverlay.markers}
          />
        )}
      </div>
    </div>
  );
}
