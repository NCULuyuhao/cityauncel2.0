import { memo, type CSSProperties, type ReactNode, useEffect } from "react";
import { labelPositions, regions } from "../data/miaoliMapView";

type MapOverlayMarker = {
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

type MapOverlayPath = {
  id: string;
  points: string;
  color?: string;
  width?: number;
};

type MapOverlayArea = {
  id: string;
  d: string;
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

type MapInteractionRegion = {
  name: string;
  d: string;
  cx?: number;
  cy?: number;
};

type MiaoliDistrictSelectorMapProps = {
  selectedTown: string;
  onSelectTown: (townName: string) => void;
  className?: string;
  title?: string;
  description?: string;
  regionFillMap?: Record<string, string>;
  selectedTownFill?: string;
  selectedTownStroke?: string;
  selectedTownValueLabel?: string;
  activeLabel?: string;
  legend?: ReactNode;
  compact?: boolean;
  mapHeight?: string;
  showCurrentBadge?: boolean;
  disableSelectedHighlight?: boolean;
  fullBleedMap?: boolean;
  hideRegionLabels?: boolean;
  overlayMarkers?: MapOverlayMarker[];
  overlayPaths?: MapOverlayPath[];
  overlayAreas?: MapOverlayArea[];
  onSelectMarker?: (value: string) => void;
  mapScale?: number;
  noMapFrame?: boolean;
  hideHeader?: boolean;
  fillMapFrame?: boolean;
  selectedFloatOnly?: boolean;
  backgroundImageSrc?: string;
  interactionRegions?: MapInteractionRegion[];
  transparentRegionButtons?: boolean;
  idleRegionFill?: string;
  idleRegionStroke?: string;
  hoverRegionFill?: string;
};

const DEFAULT_SELECTOR_IDLE_FILL = "#fff8dd";
const DEFAULT_SELECTOR_IDLE_STROKE = "#cdb98d";
const DEFAULT_SELECTOR_ACTIVE_FILL = "#4a382b";
const DEFAULT_SELECTOR_ACTIVE_STROKE = "#f2c45b";
const DEFAULT_SELECTOR_TEXT_FILL = "#253244";
const DEFAULT_SELECTOR_ACTIVE_TEXT_FILL = "#fffaf0";
const DEFAULT_SELECTOR_MAP_BACKGROUND = "#fffaf0";

const selectorMapStyles = `
.miaoli-district-selector-map {
  --selector-idle: #fff8dd;
  --selector-idle-stroke: #cdb98d;
  --selector-active: #4a382b;
  --selector-active-stroke: #f2c45b;
  --selector-hover: #fff0a8;
  --selector-text: #253244;
  --selector-active-text: #fffaf0;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.miaoli-district-selector-map * {
  -webkit-tap-highlight-color: transparent;
}
.miaoli-district-selector-map svg {
  display: block;
  width: 100%;
  height: var(--selector-map-height, auto);
  max-width: 100%;
  max-height: var(--selector-map-max-height, none);
  object-fit: contain;
  transform: scale(var(--selector-map-scale, 1));
  transform-origin: center;
}
.miaoli-district-selector-map__map-frame {
  width: 100%;
  height: var(--selector-map-height, auto);
  min-height: var(--selector-map-height, auto);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.miaoli-district-selector-map__overlay-path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 2px 3px rgba(45,41,34,.08));
}
.miaoli-district-selector-map__overlay-area {
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}
.miaoli-district-selector-map__marker-label {
  font-weight: 900;
  fill: #253244;
  pointer-events: none;
}
.miaoli-district-selector-map__marker-callout {
  stroke: rgba(79, 70, 60, .42);
  stroke-width: 0.72;
  stroke-dasharray: 3 3;
  pointer-events: none;
}
.miaoli-district-selector-map__marker-label-bg {
  fill: rgba(255, 255, 255, .92);
  stroke: rgba(216, 203, 179, .9);
  stroke-width: 1.2;
  filter: drop-shadow(0 4px 8px rgba(45,41,34,.14));
  pointer-events: none;
}
.miaoli-district-selector-map__piece {
  cursor: pointer;
  outline: none !important;
  transition: transform .16s ease;
  transform-box: fill-box;
  transform-origin: center;
}
.miaoli-district-selector-map__piece:hover,
.miaoli-district-selector-map__piece.is-float-selected {
  transform: translate3d(0, -2px, 0) scale(1.008);
}
.miaoli-district-selector-map__shape {
  fill: var(--selector-idle);
  stroke: var(--selector-idle-stroke);
  stroke-width: 0.55;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  transition: fill .32s ease, stroke .2s ease, stroke-width .2s ease, filter .2s ease;
}
.miaoli-district-selector-map__background-image {
  pointer-events: none;
}
.miaoli-district-selector-map__piece.is-transparent-button,
.miaoli-district-selector-map__piece.is-transparent-button:hover,
.miaoli-district-selector-map__piece.is-transparent-button.is-selected,
.miaoli-district-selector-map__piece.is-transparent-button.is-float-selected {
  transform: none;
}
.miaoli-district-selector-map__piece.is-transparent-button .miaoli-district-selector-map__shape,
.miaoli-district-selector-map__piece.is-transparent-button:hover .miaoli-district-selector-map__shape,
.miaoli-district-selector-map__piece.is-transparent-button.is-selected .miaoli-district-selector-map__shape,
.miaoli-district-selector-map__piece.is-transparent-button.is-float-selected .miaoli-district-selector-map__shape {
  fill: rgba(255, 255, 255, 0) !important;
  stroke: rgba(255, 255, 255, 0) !important;
  stroke-width: 0 !important;
  filter: none !important;
  pointer-events: all;
}
.miaoli-district-selector-map__piece:hover .miaoli-district-selector-map__shape {
  fill: var(--selector-hover);
  stroke: #9b7b55;
  stroke-width: 0.72;
}
.miaoli-district-selector-map__piece.is-float-selected .miaoli-district-selector-map__shape {
  filter: drop-shadow(0 10px 13px rgba(74, 56, 43, .18));
}
.miaoli-district-selector-map__piece.is-selected {
  transform: translate3d(0, -2px, 0) scale(1.012);
}
.miaoli-district-selector-map__piece.is-selected .miaoli-district-selector-map__shape {
  fill: var(--selector-active);
  stroke: var(--selector-active-stroke);
  stroke-width: 0.95;
  filter: drop-shadow(0 10px 14px rgba(74, 56, 43, .22));
}
.miaoli-district-selector-map__label {
  pointer-events: none;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(255,255,255,.96);
  stroke-width: 1.9px;
  stroke-linejoin: round;
  font-weight: 900;
  fill: var(--selector-text);
  letter-spacing: .03em;
}
.miaoli-district-selector-map__label.is-selected {
  fill: var(--selector-active-text);
  stroke: rgba(35, 25, 18, .72);
  stroke-width: 2px;
}
.miaoli-district-selector-map__piece:focus,
.miaoli-district-selector-map__piece:focus-visible,
.miaoli-district-selector-map__marker:focus,
.miaoli-district-selector-map__marker:focus-visible {
  outline: none !important;
}
.miaoli-district-selector-map__piece:focus-visible .miaoli-district-selector-map__shape {
  filter: drop-shadow(0 10px 13px rgba(74, 56, 43, .18));
}
.miaoli-district-selector-map__piece.is-float-selected:focus-visible .miaoli-district-selector-map__shape {
  filter: drop-shadow(0 10px 13px rgba(74, 56, 43, .18));
}
.miaoli-district-selector-map__legend {
  position: absolute;
  right: .65rem;
  top: .65rem;
  z-index: 2;
}
@media (max-width: 640px) {
  .miaoli-district-selector-map svg {
    max-height: var(--selector-map-max-height, none);
  }
}
`;

let selectorMapStyleInjected = false;

function useSelectorMapStyles() {
  useEffect(() => {
    if (selectorMapStyleInjected) return;
    const styleEl = document.createElement("style");
    styleEl.dataset.miaoliDistrictSelectorMap = "true";
    styleEl.textContent = selectorMapStyles;
    document.head.appendChild(styleEl);
    selectorMapStyleInjected = true;
  }, []);
}

const MiaoliDistrictSelectorMap = memo(function MiaoliDistrictSelectorMap({
  selectedTown,
  onSelectTown,
  className = "",
  title = "選擇苗栗18鄉鎮市",
  description = "點擊地圖上的鄉鎮市，就會切換目前互動數據的地區。",
  regionFillMap,
  selectedTownFill,
  selectedTownStroke,
  selectedTownValueLabel,
  activeLabel,
  legend,
  compact = false,
  mapHeight,
  showCurrentBadge = true,
  disableSelectedHighlight = false,
  fullBleedMap = false,
  hideRegionLabels = false,
  overlayMarkers = [],
  overlayPaths = [],
  overlayAreas = [],
  onSelectMarker,
  mapScale = fullBleedMap ? 1.1 : 1,
  noMapFrame = false,
  hideHeader = false,
  fillMapFrame = false,
  selectedFloatOnly = false,
  backgroundImageSrc,
  interactionRegions,
  transparentRegionButtons = false,
  idleRegionFill,
  idleRegionStroke,
  hoverRegionFill,
}: MiaoliDistrictSelectorMapProps) {
  useSelectorMapStyles();
  const activeRegions = interactionRegions ?? regions;

  return (
    <div
      className={`miaoli-district-selector-map overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#fffaf0]/88 ${hideHeader && noMapFrame ? "p-0" : compact ? "p-2" : "p-3"} shadow-inner ${fillMapFrame ? "h-full" : ""} ${className}`}
      style={
        {
          "--selector-map-height": mapHeight ?? (compact ? "128px" : "auto"),
          "--selector-map-max-height":
            mapHeight ?? (compact ? "128px" : "none"),
          "--selector-map-scale": String(Math.min(mapScale, 1)),
          "--selector-idle": idleRegionFill ?? DEFAULT_SELECTOR_IDLE_FILL,
          "--selector-idle-stroke": idleRegionStroke ?? DEFAULT_SELECTOR_IDLE_STROKE,
          "--selector-hover": hoverRegionFill ?? "#fff0a8",
        } as CSSProperties
      }
    >
      {!hideHeader ? (
        <div
          className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2 px-1`}
        >
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-[#7b5b37]">
              {title}
            </p>
            {description ? (
              <p className="mt-1 text-xs font-bold leading-5 text-stone-500">
                {description}
              </p>
            ) : null}
          </div>
          {showCurrentBadge ? (
            <span className="rounded-full border border-[#4a382b] bg-[#4a382b] px-3 py-1 text-xs font-black text-[#fffaf0]">
              目前：{selectedTown}
              {activeLabel ? `｜${activeLabel}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={`miaoli-district-selector-map__map-frame relative ${fillMapFrame ? "h-full" : ""} ${noMapFrame ? "bg-[#fffaf0] p-0" : `rounded-[20px] border border-[#eadfcf] bg-[#fffaf0] ${fullBleedMap ? "p-0" : "p-2"}`}`}
      >
        {legend ? (
          <div className="miaoli-district-selector-map__legend">{legend}</div>
        ) : null}
        {selectedTownValueLabel ? (
          <div className="absolute left-3 top-3 z-[2] rounded-2xl border border-white/70 bg-[#2f2418]/82 px-3 py-2 text-xs font-black text-white shadow-lg">
            {selectedTownValueLabel}
          </div>
        ) : null}
        <svg
          viewBox="0 0 380 300"
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="苗栗18鄉鎮市地圖選擇器"
        >
          <rect x={0} y={0} width={380} height={300} fill={DEFAULT_SELECTOR_MAP_BACKGROUND} />
          {backgroundImageSrc ? (
            <image
              className="miaoli-district-selector-map__background-image"
              href={backgroundImageSrc}
              x={0}
              y={0}
              width={380}
              height={300}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
          {activeRegions.map((region) => {
            const isSelected = selectedTown === region.name;
            const regionFill = regionFillMap?.[region.name];
            const dynamicFill =
              isSelected && selectedTownFill ? selectedTownFill : regionFill;
            const dynamicStroke =
              isSelected && selectedTownStroke ? selectedTownStroke : undefined;
            const effectiveFill = transparentRegionButtons
              ? "rgba(255, 255, 255, 0)"
              : dynamicFill ?? (isSelected && !disableSelectedHighlight && !selectedFloatOnly
                ? DEFAULT_SELECTOR_ACTIVE_FILL
                : idleRegionFill ?? DEFAULT_SELECTOR_IDLE_FILL);
            const effectiveStroke = transparentRegionButtons
              ? "rgba(255, 255, 255, 0)"
              : dynamicStroke ?? (isSelected && !disableSelectedHighlight && !selectedFloatOnly
                ? DEFAULT_SELECTOR_ACTIVE_STROKE
                : idleRegionStroke ?? DEFAULT_SELECTOR_IDLE_STROKE);
            const effectiveStrokeWidth = transparentRegionButtons
              ? 0
              : isSelected && !disableSelectedHighlight && !selectedFloatOnly
                ? 0.95
                : 0.55;

            return (
              <g
                key={region.name}
                role="button"
                tabIndex={selectedFloatOnly ? -1 : 0}
                focusable={selectedFloatOnly ? "false" : undefined}
                aria-label={`選擇${region.name}`}
                aria-pressed={isSelected}
                className={`miaoli-district-selector-map__piece ${transparentRegionButtons ? "is-transparent-button" : ""} ${isSelected ? selectedFloatOnly ? "is-float-selected" : !disableSelectedHighlight ? "is-selected" : "" : ""}`}
                onMouseDown={(event) => {
                  if (selectedFloatOnly) event.preventDefault();
                }}
                onClick={(event) => {
                  if (selectedFloatOnly) {
                    event.currentTarget.blur();
                  }
                  onSelectTown(region.name);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectTown(region.name);
                  }
                }}
              >
                <path
                  className="miaoli-district-selector-map__shape"
                  d={region.d}
                  fill={effectiveFill}
                  stroke={effectiveStroke}
                  strokeWidth={effectiveStrokeWidth}
                  style={{ fill: effectiveFill, stroke: effectiveStroke, strokeWidth: effectiveStrokeWidth }}
                />
              </g>
            );
          })}
          {overlayAreas.map((area) => (
            <path
              key={area.id}
              className="miaoli-district-selector-map__overlay-area"
              d={area.d}
              fill={area.color ?? "#1597d3"}
              stroke={area.strokeColor ?? area.color ?? "#1597d3"}
              strokeWidth={area.strokeWidth ?? 0}
              opacity={area.opacity ?? 0.9}
            />
          ))}
          {overlayPaths.map((path) => (
            <polyline
              key={path.id}
              className="miaoli-district-selector-map__overlay-path"
              points={path.points}
              stroke={path.color ?? "#4aa3c7"}
              strokeWidth={path.width ?? 6}
              opacity={1}
            />
          ))}
          {!hideRegionLabels ? (
            <g className="miaoli-district-selector-map__label-layer">
              {activeRegions.map((region) => {
                const label = labelPositions[region.name] ?? {
                  x: region.cx ?? 0,
                  y: region.cy ?? 0,
                  size: 10,
                };
                const isSelected = selectedTown === region.name;
                const labelFill = isSelected && !disableSelectedHighlight && !transparentRegionButtons
                  ? DEFAULT_SELECTOR_ACTIVE_TEXT_FILL
                  : DEFAULT_SELECTOR_TEXT_FILL;
                const labelStroke = isSelected && !disableSelectedHighlight && !transparentRegionButtons
                  ? "rgba(35, 25, 18, .72)"
                  : "rgba(255,255,255,.96)";
                return (
                  <text
                    key={`${region.name}-label`}
                    className={`miaoli-district-selector-map__label ${isSelected && !disableSelectedHighlight && !transparentRegionButtons ? "is-selected" : ""}`}
                    x={label.x}
                    y={label.y}
                    fontSize={label.size}
                    fill={labelFill}
                    stroke={labelStroke}
                    strokeWidth={isSelected && !disableSelectedHighlight && !transparentRegionButtons ? 1.35 : 1.15}
                    paintOrder="stroke fill"
                    style={{ paintOrder: "stroke fill" }}
                    dominantBaseline="middle"
                    textAnchor="middle"
                    writingMode={label.vertical ? "vertical-rl" : undefined}
                  >
                    {region.name}
                  </text>
                );
              })}
            </g>
          ) : null}
          {overlayMarkers.map((marker) => {
            const fill =
              marker.color ??
              (marker.kind === "station"
                ? "#7c3aed"
                : marker.kind === "stream"
                  ? "#22c55e"
                  : "#0284c7");
            const canSelectMarker = Boolean(onSelectMarker);
            const labelDx = marker.labelDx ?? 12;
            const labelDy = marker.labelDy ?? -10;
            const requestedLabelX = marker.x + labelDx;
            const requestedLabelY = marker.y + labelDy;
            const labelAnchor = marker.labelAnchor ?? "start";
            const labelFontSize = marker.kind === "station" ? 8.6 : marker.selected ? 12 : 10.5;
            const estimatedLabelWidth =
              marker.labelWidth ?? Math.max(54, marker.label.length * labelFontSize * 0.72 + 14);
            const labelHeight = labelFontSize + 8;
            const rawLabelRectX =
              labelAnchor === "middle"
                ? requestedLabelX - estimatedLabelWidth / 2
                : labelAnchor === "end"
                  ? requestedLabelX - estimatedLabelWidth + 4
                  : requestedLabelX - 7;
            const labelPadding = 3;
            const labelRectX = Math.min(
              380 - estimatedLabelWidth - labelPadding,
              Math.max(labelPadding, rawLabelRectX),
            );
            const labelRectY = Math.min(
              300 - labelHeight - labelPadding,
              Math.max(labelPadding, requestedLabelY - labelHeight / 2),
            );
            const labelY = labelRectY + labelHeight / 2 + labelFontSize * 0.34;
            const labelX =
              labelAnchor === "middle"
                ? labelRectX + estimatedLabelWidth / 2
                : labelAnchor === "end"
                  ? labelRectX + estimatedLabelWidth - 7
                  : labelRectX + 7;
            return (
              <g
                key={marker.id}
                role={canSelectMarker ? "button" : undefined}
                tabIndex={canSelectMarker ? 0 : undefined}
                aria-label={canSelectMarker ? `選擇${marker.label}` : undefined}
                onClick={
                  canSelectMarker
                    ? () => onSelectMarker?.(marker.selectValue ?? marker.label)
                    : undefined
                }
                onKeyDown={
                  canSelectMarker
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectMarker?.(marker.selectValue ?? marker.label);
                        }
                      }
                    : undefined
                }
                className="miaoli-district-selector-map__marker"
                style={{ cursor: canSelectMarker ? "pointer" : undefined, outline: "none" }}
              >
                {!marker.hideLabel ? (
                  <>
                    <line
                      className="miaoli-district-selector-map__marker-callout"
                      x1={marker.x}
                      y1={marker.y}
                      x2={labelX}
                      y2={labelY - labelFontSize / 2}
                      stroke="rgba(79, 70, 60, .42)"
                      strokeWidth={0.72}
                      strokeDasharray="3 3"
                    />
                    <rect
                      className="miaoli-district-selector-map__marker-label-bg"
                      x={labelRectX}
                      y={labelRectY}
                      width={estimatedLabelWidth}
                      height={labelHeight}
                      rx={7}
                      ry={7}
                      fill="rgba(255, 255, 255, .92)"
                      stroke="rgba(216, 203, 179, .9)"
                      strokeWidth={1.2}
                    />
                    <text
                      className="miaoli-district-selector-map__marker-label"
                      x={labelX}
                      y={labelY}
                      fontSize={labelFontSize}
                      fill="#253244"
                      textAnchor={labelAnchor}
                    >
                      {marker.label}
                    </text>
                  </>
                ) : null}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={marker.kind === "station" ? 3.9 : marker.selected ? 10.5 : 6.5}
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth={marker.kind === "station" ? 1.2 : marker.selected ? 2.4 : 1.9}
                />
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={marker.kind === "station" ? 6.4 : marker.selected ? 16 : 10}
                  fill="none"
                  stroke={fill}
                  strokeWidth={marker.kind === "station" ? 0.8 : marker.selected ? 1.8 : 1.2}
                  opacity={marker.selected ? 0.68 : 0.42}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
});

export default MiaoliDistrictSelectorMap;
