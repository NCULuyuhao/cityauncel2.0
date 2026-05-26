export type WaterRpiGisRiverShape = {
  id: string;
  label: string;
  kind: "river" | "stream";
  sourceNames: string[];
  paths: string[];
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: "start" | "middle" | "end";
  labelWidth?: number;
};

type WaterRpiGisRiverShapesPayload = {
  WATER_RPI_GIS_RIVER_SHAPES: WaterRpiGisRiverShape[];
};

async function loadWaterRpiGisRiverShapes(): Promise<WaterRpiGisRiverShapesPayload> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/waterRpiGisRiverShapes.json`);
  if (!response.ok) {
    throw new Error(`無法載入河川水質 RPI 河川圖層資料：${response.status}`);
  }
  return (await response.json()) as WaterRpiGisRiverShapesPayload;
}

const waterRpiGisRiverShapes = await loadWaterRpiGisRiverShapes();

// 大型河川 path 改放 public/data，以免打進前端 JS bundle。
export const WATER_RPI_GIS_RIVER_SHAPES = waterRpiGisRiverShapes.WATER_RPI_GIS_RIVER_SHAPES;
