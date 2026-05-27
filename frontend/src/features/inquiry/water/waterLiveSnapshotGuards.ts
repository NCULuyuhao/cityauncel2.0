/**
 * CityAuncel maintainability notes
 * 檔案用途：水資源探究模組 waterLiveSnapshotGuards，處理水資源地圖、圖表、快照或資料守門。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import type { EvidenceSnapshotMetaLike } from "./WaterLiveSnapshotViews";

export function isWaterRpiSnapshotMeta(meta?: EvidenceSnapshotMetaLike | null) {
  return Boolean(meta && meta.category === "water" && meta.unit === "RPI");
}

export function isWaterStationSnapshotMeta(meta?: EvidenceSnapshotMetaLike | null) {
  return Boolean(
    meta && meta.category === "water" && meta.subcategory === "水質監測站",
  );
}

export function isWaterLiveSnapshotMeta(meta?: EvidenceSnapshotMetaLike | null) {
  return isWaterRpiSnapshotMeta(meta) || isWaterStationSnapshotMeta(meta);
}
