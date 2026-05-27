/**
 * CityAuncel maintainability notes
 * 檔案用途：探究資料卡模組 cardSerialization，處理資料卡清單、篩選、呈現或送出資料格式。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { mediaUrl, persistableMediaPath } from "@/api/apiClient";

type StoredCardLike = {
  category?: unknown;
  type?: unknown;
  sourceType?: unknown;
  source?: unknown;
  content?: unknown;
  note?: unknown;
  imageSrc?: unknown;
  image?: unknown;
  snapshotMeta?: unknown;
  snapshot?: unknown;
  unlockedInInquiryOrder?: unknown;
  round?: unknown;
};

export function getStoredCardType(card: StoredCardLike): unknown {
  return card.category ?? card.type;
}

export function getStoredCardSource<TSource = unknown>(card: StoredCardLike): TSource | undefined {
  return (card.sourceType ?? card.source) as TSource | undefined;
}

export function getStoredCardContent(card: StoredCardLike) {
  return typeof card.content === "string"
    ? card.content
    : typeof card.note === "string"
      ? card.note
      : "";
}

export function getStoredCardImage(card: StoredCardLike) {
  const rawImage = typeof card.imageSrc === "string" && card.imageSrc.trim()
    ? card.imageSrc
    : typeof card.image === "string"
      ? card.image
      : "";
  return mediaUrl(rawImage);
}

export function getStoredCardSnapshot<TSnapshot = unknown>(card: StoredCardLike): TSnapshot | undefined {
  return (card.snapshotMeta ?? card.snapshot) as TSnapshot | undefined;
}

export function getStoredCardRound(card: StoredCardLike, fallback: number) {
  return typeof card.unlockedInInquiryOrder === "number"
    ? card.unlockedInInquiryOrder
    : typeof card.round === "number"
      ? card.round
      : fallback;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date =
    typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function nowIsoTimestamp() {
  return new Date().toISOString();
}

export function timestampValue(value: unknown) {
  const iso = toIsoTimestamp(value);
  return iso ? new Date(iso).getTime() : 0;
}

export function stripLargeSnapshotPayload<
  T extends { photoSnapshotDataUrl?: unknown } | undefined,
>(snapshotMeta: T): T {
  // 不保存 DOM 截圖型 photoSnapshotDataUrl，避免把 10MB 以上的 base64 圖塞進 localStorage/資料庫。
  // 水資源快照只保留後端產生的圖片 URL、相對路徑與檔名。
  if (!snapshotMeta || typeof snapshotMeta !== "object") return snapshotMeta;
  const {
    photoSnapshotDataUrl: _photoSnapshotDataUrl,
    ...compactSnapshotMeta
  } = snapshotMeta;
  void _photoSnapshotDataUrl;
  const persistableSnapshotMeta = compactSnapshotMeta as Record<string, unknown>;
  if (typeof persistableSnapshotMeta.photoSnapshotImageUrl === "string") {
    persistableSnapshotMeta.photoSnapshotImageUrl = persistableMediaPath(persistableSnapshotMeta.photoSnapshotImageUrl);
  }
  return persistableSnapshotMeta as T;
}

export function getPersistableImageSrc(imageSrc: unknown) {
  return persistableMediaPath(imageSrc);
}
