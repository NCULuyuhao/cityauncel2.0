export type ActivityLogPayloadLike = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

const LARGE_PAYLOAD_KEYS = new Set([
  "photoSnapshotDataUrl",
  "canvasDataUrl",
  "screenshotDataUrl",
]);

const DISPLAY_ONLY_CARD_KEYS = new Set([
  "title",
  "revealedTitle",
  "frontText",
  "imageSrc",
  "image",
  "description",
  "sourceName",
  "displayTitle",
]);

const TEXT_LOG_EVENT_TYPES = new Set([
  "card_unlock",
  "card_content_update",
  "card_reunlock",
  "interactive_snapshot_unlock",
]);

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function compactText(value: unknown, previewLength = 120) {
  const text = typeof value === "string" ? value.trim() : "";
  return {
    length: text.length,
    hasText: text.length > 0,
    preview: text.slice(0, previewLength),
  };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function getCardId(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (!isPlainObject(value)) return "";
  return firstString(value.id, value.cardId, value.card_id, value.key);
}

function getCardType(value: PlainObject): string {
  return firstString(value.type, value.category, value.cardType, value.card_type);
}

function getCardSource(value: PlainObject): string {
  return firstString(value.source, value.sourceType, value.source_type) || "fixedImage";
}

function getCardNote(value: PlainObject): string {
  return firstString(value.note, value.content, value.text, value.answer);
}

function getCardTitle(value: PlainObject): string {
  return firstString(value.title, value.revealedTitle, value.displayTitle);
}

function getCardImage(value: PlainObject): string {
  return firstString(value.image, value.imageSrc, value.image_url);
}

function getCardSnapshot(value: PlainObject): unknown {
  return value.snapshot ?? value.snapshotMeta ?? value.meta;
}

function getCardRound(value: PlainObject): number | undefined {
  const raw = value.round ?? value.unlockedInInquiryOrder ?? value.inquiryOrder ?? value.recordOrder;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function normalizeIsoTime(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeSnapshotMeta(value: unknown): PlainObject | undefined {
  if (!isPlainObject(value)) return undefined;
  const result: PlainObject = {};
  for (const [key, raw] of Object.entries(value)) {
    if (LARGE_PAYLOAD_KEYS.has(key)) continue;
    if (typeof raw === "function") continue;
    const nextKey = key === "category" ? "type" : key;
    result[nextKey] = normalizeGenericValue(raw);
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeStoredCardForInquiry(value: unknown): unknown {
  const id = getCardId(value);
  if (!id) return null;
  if (!isPlainObject(value)) return { id };

  const source = getCardSource(value);
  const type = getCardType(value);
  const note = getCardNote(value);
  const title = getCardTitle(value);
  const image = getCardImage(value);
  const snapshot = normalizeSnapshotMeta(getCardSnapshot(value));
  const round = getCardRound(value);

  const result: PlainObject = { id };

  if (type) result.type = type;
  if (source) result.source = source;
  if (title) result.title = title;
  if (note) result.note = note;
  const unlockedAt = normalizeIsoTime(value.unlockedAt);
  if (unlockedAt) result.unlockedAt = unlockedAt;
  if (round !== undefined) result.round = round;

  if (source === "interactiveSnapshot") {
    if (snapshot) result.snapshot = snapshot;
    if (image && !image.startsWith("data:image/png") && !image.startsWith("data:image/jpeg")) result.image = image;
  }

  if (typeof value.sharedFromOtherPlayer === "boolean") result.sharedFromOtherPlayer = value.sharedFromOtherPlayer;
  if (typeof value.sharedAuthorName === "string" && value.sharedAuthorName.trim()) result.sharedAuthorName = value.sharedAuthorName.trim();

  return result;
}

function normalizeEvidenceCardForConclusion(value: unknown): unknown {
  const id = getCardId(value);
  if (!id) return null;
  if (!isPlainObject(value)) return id;

  const source = getCardSource(value);
  if (source !== "interactiveSnapshot") return id;

  const result: PlainObject = { id, source };
  const type = getCardType(value);
  const note = getCardNote(value);
  const title = getCardTitle(value);
  const image = getCardImage(value);
  const snapshot = normalizeSnapshotMeta(getCardSnapshot(value));

  if (type) result.type = type;
  if (title) result.title = title;
  if (note) result.note = note;
  if (snapshot) result.snapshot = snapshot;
  if (image && !image.startsWith("data:image/png") && !image.startsWith("data:image/jpeg")) result.image = image;

  return result;
}

function normalizeCardList(value: unknown, mode: "inquiry" | "conclusion" | "ids" = "ids") {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result: unknown[] = [];

  for (const item of list) {
    const normalized =
      mode === "inquiry"
        ? normalizeStoredCardForInquiry(item)
        : mode === "conclusion"
          ? normalizeEvidenceCardForConclusion(item)
          : getCardId(item);
    const id = getCardId(normalized);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(normalized);
  }

  return result;
}

export function normalizeInquirySummaryForSave(summary: unknown): unknown {
  if (!isPlainObject(summary)) return summary;

  const result: PlainObject = {};
  const passthroughKeys = [
    "recordOrder",
    "orientationMainChoice",
    "orientationTextInput",
    "introStage",
    "orientationCreatedAt",
    "investigationCreatedAt",
    "conclusionCreatedAt",
    "conclusion",
    "syncReason",
  ];

  for (const key of passthroughKeys) {
    if (summary[key] !== undefined && summary[key] !== null && summary[key] !== "") {
      result[key] = normalizeGenericValue(summary[key]);
    }
  }

  const investigationCards =
    Array.isArray(summary.investigationCards)
      ? summary.investigationCards
      : Array.isArray(summary.currentRoundUnlockedCards)
        ? summary.currentRoundUnlockedCards
        : Array.isArray(summary.unlockedCards)
          ? summary.unlockedCards
          : Array.isArray(summary.cards)
            ? summary.cards
            : [];
  result.cards = normalizeCardList(investigationCards, "inquiry");

  if (Array.isArray(summary.evidenceCards)) {
    result.evidenceCards = normalizeCardList(summary.evidenceCards, "conclusion");
  }

  if (Array.isArray(summary.collectionReflections)) {
    result.collectionReflections = summary.collectionReflections
      .map((record) => normalizeGenericValue(record))
      .filter(Boolean);
  }

  return result;
}

function normalizeKey(key: string) {
  const keyMap: Record<string, string> = {
    category: "type",
    cardType: "type",
    card_type: "type",
    sourceType: "source",
    source_type: "source",
    imageSrc: "image",
    image_url: "image",
    snapshotMeta: "snapshot",
    meta: "snapshot",
    content: "note",
    text: "note",
    answer: "note",
    studentNote: "note",
    unlockedInInquiryOrder: "round",
    inquiryOrder: "round",
  };
  return keyMap[key] || key;
}

export function normalizeGenericValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeGenericValue).filter((item) => item !== undefined);
  if (!isPlainObject(value)) return value;

  const cardId = getCardId(value);
  const looksLikeCard = Boolean(cardId) && Object.keys(value).some((key) => DISPLAY_ONLY_CARD_KEYS.has(key) || key === "content" || key === "note" || key === "snapshotMeta" || key === "snapshot");
  if (looksLikeCard) return normalizeStoredCardForInquiry(value);

  const result: PlainObject = {};
  for (const [key, raw] of Object.entries(value)) {
    if (LARGE_PAYLOAD_KEYS.has(key) || DISPLAY_ONLY_CARD_KEYS.has(key)) continue;
    if (key === "cards" || key === "evidenceCards" || key === "investigationCards" || key === "unlockedCards") {
      result[`${normalizeKey(key)}Ids`] = normalizeCardList(raw, "ids");
      continue;
    }
    const nextKey = normalizeKey(key);
    result[nextKey] = normalizeGenericValue(raw);
  }
  return result;
}


export function stripLargePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLargePayload);
  if (!isPlainObject(value)) return value;

  const result: PlainObject = {};
  for (const [key, raw] of Object.entries(value)) {
    if (LARGE_PAYLOAD_KEYS.has(key)) continue;

    // 固定圖卡與快照圖已經有 public/uploads 路徑即可辨識，不把 base64 大圖塞進資料庫。
    if ((key === "imageSrc" || key === "image") && typeof raw === "string" && raw.startsWith("data:image/")) {
      continue;
    }

    result[key] = stripLargePayload(raw);
  }
  return result;
}

function normalizeActivityValue(eventType: string, value: unknown): unknown {
  if (value == null) return value;

  if (TEXT_LOG_EVENT_TYPES.has(eventType) && typeof value === "string") {
    return compactText(value);
  }

  if (eventType === "evidence_cards_confirm") {
    return normalizeCardList(value, "ids");
  }

  if (Array.isArray(value)) return normalizeCardList(value, "ids");

  if (isPlainObject(value)) {
    const id = getCardId(value);
    if (id) return { id };
  }

  return normalizeGenericValue(value);
}

function normalizeActivityMetadata(metadata: unknown): PlainObject | undefined {
  if (!isPlainObject(metadata)) return undefined;
  const result: PlainObject = {};

  for (const [key, raw] of Object.entries(metadata)) {
    if (LARGE_PAYLOAD_KEYS.has(key) || DISPLAY_ONLY_CARD_KEYS.has(key)) continue;
    if (key === "evidenceCards" || key === "investigationCards" || key === "unlockedCards" || key === "cards") {
      result[`${normalizeKey(key)}Ids`] = normalizeCardList(raw, "ids");
      continue;
    }
    if (key === "content" || key === "reason" || key === "studentNote" || key === "note") {
      result.noteSummary = compactText(raw);
      continue;
    }
    result[normalizeKey(key)] = normalizeGenericValue(raw);
  }

  return result;
}

export function normalizeActivityLogPayload<T extends ActivityLogPayloadLike>(payload: T): T {
  return {
    ...payload,
    previousValue: normalizeActivityValue(payload.eventType, payload.previousValue),
    newValue: normalizeActivityValue(payload.eventType, payload.newValue),
    metadata: normalizeActivityMetadata(payload.metadata),
  };
}
