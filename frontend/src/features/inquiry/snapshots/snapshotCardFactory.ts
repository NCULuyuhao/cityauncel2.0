import {
  getStoredCardContent,
  getStoredCardImage,
  getStoredCardSource,
  getStoredCardSnapshot,
  getStoredCardType,
  nowIsoTimestamp,
  stripLargeSnapshotPayload,
  toIsoTimestamp,
} from "@/features/inquiry/cards/cardSerialization";
import type {
  EvidenceSnapshotMeta,
  SnapshotCategoryKey,
} from "@/features/inquiry/snapshots/snapshotBuilder";

export type SnapshotCardSourceType = "fixedImage" | "interactiveSnapshot";

function isSnapshotCardSourceType(value: unknown): value is SnapshotCardSourceType {
  return value === "fixedImage" || value === "interactiveSnapshot";
}

export type SnapshotGameCard = {
  id: string;
  localId: number;
  category: SnapshotCategoryKey;
  title: string;
  revealedTitle: string;
  content: string;
  unlocked: boolean;
  unlockedAt: string | null;
  imageSrc: string;
  sourceType?: SnapshotCardSourceType;
  snapshotMeta?: EvidenceSnapshotMeta;
  sharedFromOtherPlayer?: boolean;
  sharedAuthorName?: string;
};

export type StoredSnapshotCardLike = {
  id?: unknown;
  content?: unknown;
  note?: unknown;
  unlockedAt?: unknown;
  unlockedInInquiryOrder?: unknown;
  round?: unknown;
  localId?: unknown;
  category?: unknown;
  type?: unknown;
  title?: unknown;
  revealedTitle?: unknown;
  imageSrc?: unknown;
  image?: unknown;
  sourceType?: unknown;
  source?: unknown;
  snapshotMeta?: unknown;
  snapshot?: unknown;
  unlocked?: unknown;
  sharedFromOtherPlayer?: unknown;
  sharedAuthorName?: unknown;
};

export type CreateSnapshotGameCardOptions = {
  buildSnapshotSvgDataUrl: (meta: EvidenceSnapshotMeta) => string;
  idFactory?: () => string;
};

export type CreateCardFromStoredSnapshotOptions = {
  buildSnapshotSvgDataUrl: (meta: EvidenceSnapshotMeta) => string;
  isCategoryKey: (value: unknown) => value is SnapshotCategoryKey;
};

function createDefaultSnapshotCardId() {
  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSnapshotLocalId(createdAt: number) {
  return 10000 + (createdAt % 100000);
}

export function createSnapshotGameCard(
  meta: EvidenceSnapshotMeta,
  reason: string,
  snapshotImageUrl: string | undefined,
  options: CreateSnapshotGameCardOptions,
): SnapshotGameCard {
  const createdAt = Date.now();
  const compactMeta = stripLargeSnapshotPayload({
    ...meta,
    photoSnapshotImageUrl: snapshotImageUrl || meta.photoSnapshotImageUrl,
  }) as EvidenceSnapshotMeta;

  return {
    id: options.idFactory?.() ?? createDefaultSnapshotCardId(),
    localId: createSnapshotLocalId(createdAt),
    category: meta.category,
    title: "學生擷取的互動數據快照",
    revealedTitle: meta.filterLabel,
    content: reason.trim(),
    unlocked: true,
    unlockedAt: nowIsoTimestamp(),
    imageSrc:
      snapshotImageUrl ||
      meta.photoSnapshotImageUrl ||
      options.buildSnapshotSvgDataUrl(compactMeta),
    sourceType: "interactiveSnapshot",
    snapshotMeta: compactMeta,
  };
}

export function createCardFromStoredSnapshotCard(
  saved: Partial<StoredSnapshotCardLike>,
  options: CreateCardFromStoredSnapshotOptions,
): SnapshotGameCard | null {
  if (typeof saved.id !== "string" || !saved.id.trim()) return null;

  const savedCategory = getStoredCardType(saved);
  if (!options.isCategoryKey(savedCategory)) return null;

  const savedSnapshot = getStoredCardSnapshot<EvidenceSnapshotMeta>(saved);
  const fallbackImageSrc = savedSnapshot
    ? options.buildSnapshotSvgDataUrl(savedSnapshot)
    : "";
  const savedImage = getStoredCardImage(saved);
  const imageSrc = savedImage || fallbackImageSrc;
  if (!imageSrc) return null;

  const savedSourceType = getStoredCardSource(saved);

  return {
    id: saved.id,
    localId:
      typeof saved.localId === "number" && Number.isFinite(saved.localId)
        ? saved.localId
        : 10000,
    category: savedCategory,
    title:
      typeof saved.title === "string" && saved.title.trim()
        ? saved.title
        : "學生快照證據卡",
    revealedTitle:
      typeof saved.revealedTitle === "string" && saved.revealedTitle.trim()
        ? saved.revealedTitle
        : typeof saved.title === "string" && saved.title.trim()
          ? saved.title
          : "學生快照證據卡",
    content: getStoredCardContent(saved),
    unlocked: Boolean(saved.unlocked ?? true),
    unlockedAt: toIsoTimestamp(saved.unlockedAt) ?? nowIsoTimestamp(),
    imageSrc,
    sourceType: isSnapshotCardSourceType(savedSourceType)
      ? savedSourceType
      : "interactiveSnapshot",
    snapshotMeta: savedSnapshot,
    sharedFromOtherPlayer: Boolean(saved.sharedFromOtherPlayer),
    sharedAuthorName:
      typeof saved.sharedAuthorName === "string"
        ? saved.sharedAuthorName
        : undefined,
  };
}
