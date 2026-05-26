export type MiaoliPreciseTownRegion = {
  name: string;
  d: string;
  cx: number;
  cy: number;
};

type MiaoliPreciseWaterMapPayload = {
  MIAOLI_WATER_BASEMAP_SRC: string;
  MIAOLI_PRECISE_TOWN_REGIONS: MiaoliPreciseTownRegion[];
};

async function loadMiaoliPreciseWaterMap(): Promise<MiaoliPreciseWaterMapPayload> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/miaoliPreciseWaterMap.json`);
  if (!response.ok) {
    throw new Error(`無法載入苗栗互動地圖資料：${response.status}`);
  }
  return (await response.json()) as MiaoliPreciseWaterMapPayload;
}

const miaoliPreciseWaterMap = await loadMiaoliPreciseWaterMap();

// 共用苗栗互動地圖資料。大型 SHP 轉換結果改放 public/data，以免打進前端 JS bundle。
export const MIAOLI_WATER_BASEMAP_SRC = miaoliPreciseWaterMap.MIAOLI_WATER_BASEMAP_SRC;
export const MIAOLI_PRECISE_TOWN_REGIONS = miaoliPreciseWaterMap.MIAOLI_PRECISE_TOWN_REGIONS;
