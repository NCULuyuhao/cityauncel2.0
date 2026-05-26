export type WaterRpiMiaoliTownRegion = {
  name: string;
  d: string;
  cx: number;
  cy: number;
};

type WaterRpiDedicatedMapPayload = {
  WATER_RPI_DEDICATED_VIEW_BOX: string;
  WATER_RPI_MIAOLI_TOWN_REGIONS: WaterRpiMiaoliTownRegion[];
};

async function loadWaterRpiDedicatedMapData(): Promise<WaterRpiDedicatedMapPayload> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/waterRpiDedicatedMapData.json`);
  if (!response.ok) {
    throw new Error(`無法載入河川水質 RPI 專用地圖資料：${response.status}`);
  }
  return (await response.json()) as WaterRpiDedicatedMapPayload;
}

const waterRpiDedicatedMapData = await loadWaterRpiDedicatedMapData();

// 大型鄉鎮 SVG path 改放 public/data，以免打進前端 JS bundle。
export const WATER_RPI_DEDICATED_VIEW_BOX = waterRpiDedicatedMapData.WATER_RPI_DEDICATED_VIEW_BOX;
export const WATER_RPI_MIAOLI_TOWN_REGIONS = waterRpiDedicatedMapData.WATER_RPI_MIAOLI_TOWN_REGIONS;
