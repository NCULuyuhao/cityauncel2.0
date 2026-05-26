import { MIAOLI_PRECISE_TOWN_REGIONS } from "./miaoliPreciseWaterMap";

export type Region = {
  name: string;
  d: string;
  originalFill?: string;
  cx?: number;
  cy?: number;
};

export type LabelPosition = {
  x: number;
  y: number;
  size: number;
  z?: number;
  vertical?: boolean;
};

const REGION_LABEL_SETTINGS: Record<string, Pick<LabelPosition, "size" | "vertical" | "z">> = {
  竹南鎮: { size: 9.0 },
  頭份市: { size: 8.9 },
  三灣鄉: { size: 8.9 },
  造橋鄉: { size: 9.2, z: 20 },
  後龍鎮: { size: 9.6 },
  苗栗市: { size: 9.4 },
  頭屋鄉: { size: 9.4 },
  南庄鄉: { size: 9.8 },
  西湖鄉: { size: 8.9, vertical: true },
  通霄鎮: { size: 9.6 },
  公館鄉: { size: 9.6 },
  獅潭鄉: { size: 8.9 },
  銅鑼鄉: { size: 9.4 },
  苑裡鎮: { size: 9.4 },
  三義鄉: { size: 8.9 },
  大湖鄉: { size: 10.0 },
  卓蘭鎮: { size: 9.2 },
  泰安鄉: { size: 10.2 },
};

export const MIAOLI_MAP_VIEW_BOX = "0 0 380 300";

export const regions: Region[] = MIAOLI_PRECISE_TOWN_REGIONS.map((region) => ({
  name: region.name,
  d: region.d,
  cx: region.cx,
  cy: region.cy,
  originalFill: "#fff8dd",
}));

export const labelPositions: Record<string, LabelPosition> = Object.fromEntries(
  MIAOLI_PRECISE_TOWN_REGIONS.map((region) => {
    const settings = REGION_LABEL_SETTINGS[region.name] ?? { size: 9.4 };

    return [
      region.name,
      {
        x: region.cx,
        y: region.cy,
        size: settings.size,
        z: settings.z,
        vertical: settings.vertical,
      },
    ];
  }),
) as Record<string, LabelPosition>;
