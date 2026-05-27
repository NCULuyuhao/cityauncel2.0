/**
 * CityAuncel maintainability notes
 * 檔案用途：跨頁共用元件 WaterRpiRiverMap，提供可重用的視覺或互動區塊。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { memo, type CSSProperties, type ReactNode, useEffect } from "react";
import {
  WATER_RPI_DEDICATED_VIEW_BOX,
  WATER_RPI_MIAOLI_TOWN_REGIONS,
} from "@/data/waterRpiDedicatedMapData";

export type RpiMapArea = {
  id: string;
  d: string;
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

export type RpiMapMarker = {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
  kind?: "river" | "stream" | "station";
  selected?: boolean;
  selectValue?: string;
  hideLabel?: boolean;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: "start" | "middle" | "end";
  labelWidth?: number;
};


const WATER_RPI_VIEW_BOX_NUMBERS = WATER_RPI_DEDICATED_VIEW_BOX.split(/\s+/).map(Number);
const WATER_RPI_VIEW_BOX_X = WATER_RPI_VIEW_BOX_NUMBERS[0] ?? 0;
const WATER_RPI_VIEW_BOX_Y = WATER_RPI_VIEW_BOX_NUMBERS[1] ?? 0;
const WATER_RPI_VIEW_BOX_WIDTH = WATER_RPI_VIEW_BOX_NUMBERS[2] ?? 380;
const WATER_RPI_VIEW_BOX_HEIGHT = WATER_RPI_VIEW_BOX_NUMBERS[3] ?? 300;

const RPI_MARKER_LABEL_WIDTH = 98;
const RPI_MARKER_LABEL_HEIGHT = 38;
const RPI_MARKER_LABEL_FONT_SIZE = 10.4;
const RPI_MARKER_LABEL_LINE_HEIGHT = 13;

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function splitRpiMarkerLabel(label: string) {
  const rpiMatch = label.match(/^(.*?)(?:\s+)?(RPI=.+)$/);
  if (!rpiMatch) return [label];
  return [rpiMatch[1].trim(), rpiMatch[2].trim()].filter(Boolean);
}

type WaterRpiRiverMapProps = {
  selectedRiver: string;
  onSelectRiver: (riverName: string) => void;
  areas: RpiMapArea[];
  markers: RpiMapMarker[];
  legend?: ReactNode;
  showRegionLabels?: boolean;
  mapHeight?: string;
  className?: string;
  interactive?: boolean;
  townFill?: string;
  townStroke?: string;
};

const rpiRiverMapStyles = `
.water-rpi-river-map {
  --rpi-map-height: 100%;
  --rpi-town-fill: #ffffff;
  --rpi-town-stroke: #d7e7f0;
  position: relative;
  width: 100%;
  height: var(--rpi-map-height);
  min-height: var(--rpi-map-height);
  overflow: hidden;
  background: #fffaf0;
  -webkit-tap-highlight-color: transparent;
}
.water-rpi-river-map svg {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}
.water-rpi-river-map__legend {
  position: absolute;
  right: .65rem;
  top: .65rem;
  z-index: 2;
}
.water-rpi-river-map__town-shape {
  fill: var(--rpi-town-fill);
  stroke: var(--rpi-town-stroke);
  stroke-width: .55;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.water-rpi-river-map__river-area {
  cursor: pointer;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  transition: opacity .18s ease, filter .18s ease, stroke-width .18s ease;
}
.water-rpi-river-map__river-area.is-selected {
  filter: drop-shadow(0 4px 7px rgba(2, 132, 199, .22));
}
.water-rpi-river-map__town-label {
  pointer-events: none;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, .96);
  stroke-width: 1.55px;
  stroke-linejoin: round;
  font-weight: 900;
  fill: #31556a;
  letter-spacing: .03em;
}
.water-rpi-river-map__marker-label {
  font-weight: 900;
  fill: #31556a;
  pointer-events: none;
}
.water-rpi-river-map__marker-callout {
  stroke: rgba(63, 107, 132, .38);
  stroke-width: 1.05;
  stroke-dasharray: 3 3;
  pointer-events: none;
}
.water-rpi-river-map__marker.is-selected .water-rpi-river-map__marker-callout {
  stroke: rgba(63, 107, 132, .38);
  stroke-width: 1.05;
  stroke-dasharray: 3 3;
}
.water-rpi-river-map__marker-label-bg {
  fill: rgba(255, 255, 255, .96);
  stroke: rgba(185, 215, 231, .95);
  stroke-width: 1.2;
  filter: drop-shadow(0 4px 8px rgba(45,41,34,.14));
  pointer-events: none;
}
.water-rpi-river-map__marker {
  outline: none !important;
}
.water-rpi-river-map__marker:focus,
.water-rpi-river-map__marker:focus-visible {
  outline: none !important;
}
`;

let rpiRiverMapStyleInjected = false;

function useRpiRiverMapStyles() {
  useEffect(() => {
    if (rpiRiverMapStyleInjected) return;
    const styleEl = document.createElement("style");
    styleEl.dataset.waterRpiRiverMap = "true";
    styleEl.textContent = rpiRiverMapStyles;
    document.head.appendChild(styleEl);
    rpiRiverMapStyleInjected = true;
  }, []);
}

function getRiverShapeIdFromAreaId(areaId: string) {
  return areaId.replace(/-area-\d+$/, "");
}

function getFallbackRiverNameFromShapeId(shapeId: string) {
  return shapeId.replace(/^gis-/, "");
}

const WaterRpiRiverMap = memo(function WaterRpiRiverMap({
  selectedRiver,
  onSelectRiver,
  areas,
  markers,
  legend,
  showRegionLabels = false,
  mapHeight = "100%",
  className = "",
  interactive = true,
  townFill = "#ffffff",
  townStroke = "#d7e7f0",
}: WaterRpiRiverMapProps) {
  useRpiRiverMapStyles();

  return (
    <div
      className={`water-rpi-river-map ${className}`}
      style={{
        "--rpi-map-height": mapHeight,
        "--rpi-town-fill": townFill,
        "--rpi-town-stroke": townStroke,
      } as CSSProperties}
    >
      {legend ? <div className="water-rpi-river-map__legend">{legend}</div> : null}
      <svg
        viewBox={WATER_RPI_DEDICATED_VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="河川水質汙染指數(RPI)互動式苗栗地圖"
      >
        <rect
          x={WATER_RPI_VIEW_BOX_X}
          y={WATER_RPI_VIEW_BOX_Y}
          width={WATER_RPI_VIEW_BOX_WIDTH}
          height={WATER_RPI_VIEW_BOX_HEIGHT}
          fill="#fffaf0"
        />
        <g className="water-rpi-river-map__town-layer">
          {WATER_RPI_MIAOLI_TOWN_REGIONS.map((region) => (
            <path
              key={region.name}
              className="water-rpi-river-map__town-shape"
              d={region.d}
              fill={townFill}
              stroke={townStroke}
              strokeWidth={0.55}
              fillRule="evenodd"
            />
          ))}
        </g>

        <g className="water-rpi-river-map__river-layer">
          {areas.map((area) => {
            const shapeId = getRiverShapeIdFromAreaId(area.id);
            const matchedMarker = markers.find((marker) => marker.id === `${shapeId}-marker`);
            const riverName = matchedMarker?.selectValue ?? matchedMarker?.label ?? getFallbackRiverNameFromShapeId(shapeId);
            const isSelected = selectedRiver === riverName;
            return (
              <path
                key={area.id}
                className={`water-rpi-river-map__river-area ${isSelected ? "is-selected" : ""}`}
                d={area.d}
                fillRule="evenodd"
                fill={area.color ?? "#1597d3"}
                stroke={area.strokeColor ?? area.color ?? "#1597d3"}
                strokeWidth={isSelected ? Math.max((area.strokeWidth ?? 0) + 0.35, 0.75) : area.strokeWidth ?? 0}
                opacity={isSelected ? 0.96 : area.opacity ?? 0.86}
                style={{ cursor: interactive ? "pointer" : "default" }}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={`選擇${riverName}`}
                onClick={interactive ? () => onSelectRiver(riverName) : undefined}
                onKeyDown={interactive ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRiver(riverName);
                  }
                } : undefined}
              />
            );
          })}
        </g>

        {showRegionLabels ? (
          <g className="water-rpi-river-map__town-label-layer">
            {WATER_RPI_MIAOLI_TOWN_REGIONS.map((region) => {
              const label = {
                x: region.cx,
                y: region.cy,
                size: 8.8,
              };
              return (
                <text
                  key={`${region.name}-label`}
                  className="water-rpi-river-map__town-label"
                  x={label.x}
                  y={label.y}
                  fontSize={label.size}
                  fill="#31556a"
                  stroke="rgba(255, 255, 255, .96)"
                  strokeWidth={1.05}
                  paintOrder="stroke fill"
                  style={{ paintOrder: "stroke fill" }}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  >
                  {region.name}
                </text>
              );
            })}
          </g>
        ) : null}

        <g className="water-rpi-river-map__marker-layer">
          {markers.map((marker) => {
            const labelDx = marker.labelDx ?? 12;
            const labelDy = marker.labelDy ?? -10;
            const requestedLabelX = marker.x + labelDx;
            const requestedLabelY = marker.y + labelDy;
            const labelAnchor = marker.labelAnchor ?? "start";
            const labelFontSize = RPI_MARKER_LABEL_FONT_SIZE;
            const labelLines = splitRpiMarkerLabel(marker.label);
            const estimatedLabelWidth = marker.labelWidth ?? RPI_MARKER_LABEL_WIDTH;
            const lineHeight = RPI_MARKER_LABEL_LINE_HEIGHT;
            const labelHeight = RPI_MARKER_LABEL_HEIGHT;
            const requestedLabelRectX =
              labelAnchor === "middle"
                ? requestedLabelX - estimatedLabelWidth / 2
                : labelAnchor === "end"
                  ? requestedLabelX - estimatedLabelWidth + 4
                  : requestedLabelX - 7;
            const requestedLabelRectY = requestedLabelY - labelHeight / 2;
            const labelPadding = 6;
            const legendSafeLeft = WATER_RPI_VIEW_BOX_X + WATER_RPI_VIEW_BOX_WIDTH - 142;
            const legendSafeBottom = WATER_RPI_VIEW_BOX_Y + 96;
            const labelRectX = clampNumber(
              requestedLabelRectX,
              WATER_RPI_VIEW_BOX_X + labelPadding,
              WATER_RPI_VIEW_BOX_X + WATER_RPI_VIEW_BOX_WIDTH - estimatedLabelWidth - labelPadding,
            );
            let labelRectY = clampNumber(
              requestedLabelRectY,
              WATER_RPI_VIEW_BOX_Y + labelPadding,
              WATER_RPI_VIEW_BOX_Y + WATER_RPI_VIEW_BOX_HEIGHT - labelHeight - labelPadding,
            );

            if (labelRectX + estimatedLabelWidth > legendSafeLeft && labelRectY < legendSafeBottom) {
              labelRectY = clampNumber(
                legendSafeBottom + 6,
                WATER_RPI_VIEW_BOX_Y + labelPadding,
                WATER_RPI_VIEW_BOX_Y + WATER_RPI_VIEW_BOX_HEIGHT - labelHeight - labelPadding,
              );
            }

            const labelX = labelRectX + estimatedLabelWidth / 2;
            const firstLineY = labelRectY + (labelLines.length === 1 ? labelHeight / 2 + labelFontSize / 3 : 14);
            const calloutTargetX =
              marker.x < labelRectX
                ? labelRectX
                : marker.x > labelRectX + estimatedLabelWidth
                  ? labelRectX + estimatedLabelWidth
                  : labelRectX + estimatedLabelWidth / 2;
            const calloutTargetY = labelRectY + labelHeight / 2;
            return (
              <g
                key={marker.id}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={`選擇${marker.label}`}
                onClick={interactive ? () => onSelectRiver(marker.selectValue ?? marker.label) : undefined}
                onKeyDown={interactive ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRiver(marker.selectValue ?? marker.label);
                  }
                } : undefined}
                className={`water-rpi-river-map__marker ${marker.selected ? "is-selected" : ""}`}
                style={{ cursor: interactive ? "pointer" : "default" }}
              >
                {!marker.hideLabel ? (
                  <>
                    <line
                      className="water-rpi-river-map__marker-callout"
                      x1={marker.x}
                      y1={marker.y}
                      x2={calloutTargetX}
                      y2={calloutTargetY}
                      stroke="rgba(63, 107, 132, .38)"
                      strokeWidth={1.05}
                      strokeDasharray="3 3"
                    />
                    <rect
                      className="water-rpi-river-map__marker-label-bg"
                      x={labelRectX}
                      y={labelRectY}
                      width={estimatedLabelWidth}
                      height={labelHeight}
                      rx={7}
                      ry={7}
                      fill="rgba(255, 255, 255, .96)"
                      stroke="rgba(185, 215, 231, .95)"
                      strokeWidth={1.2}
                    />
                    <rect
                      x={labelRectX}
                      y={labelRectY}
                      width={estimatedLabelWidth}
                      height={labelHeight}
                      rx={7}
                      ry={7}
                      fill="transparent"
                      pointerEvents="all"
                    />
                    <text
                      className="water-rpi-river-map__marker-label"
                      x={labelX}
                      y={firstLineY}
                      fontSize={labelFontSize}
                      fill="#31556a"
                      textAnchor="middle"
                    >
                      {labelLines.map((line, lineIndex) => (
                        <tspan key={line} x={labelX} dy={lineIndex === 0 ? 0 : lineHeight}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
});

export default WaterRpiRiverMap;
