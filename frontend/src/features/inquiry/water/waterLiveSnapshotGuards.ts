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
