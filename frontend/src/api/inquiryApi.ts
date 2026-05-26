import { apiUrl, authHeaders, persistableMediaPath, requestJson } from "./apiClient";
import { normalizeInquirySummaryForSave, stripLargePayload } from "@/utils/payloadNormalization";


export type InquiryDataResponse = {
  orientationMainChoice?: string;
  orientationTextInput?: string;
  finalSummaries?: unknown[];
  earnedTitles?: unknown[];
  unlockedCards?: unknown[];
};

export type InquiryRecordResponse = {
  message: string;
  recordOrder: number;
  createdAt: string;
};

export async function loadInquiryData(token: string) {
  return requestJson<InquiryDataResponse>("/api/inquiries", {
    headers: authHeaders(token),
  });
}

export async function createInquiryRecord(token: string, recordOrder?: number) {
  return requestJson<InquiryRecordResponse>("/api/inquiries/records", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ recordOrder }),
  });
}

export async function createInquiryPlan(
  token: string,
  introStage: unknown,
  orientationCreatedAt: string,
  recordOrder?: number | null,
) {
  return requestJson<unknown>("/api/inquiries/plans", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ introStage, orientationCreatedAt, recordOrder }),
  });
}


export async function replaceInquiryPlans(token: string, inquiryPlans: unknown[]) {
  return requestJson<unknown>("/api/inquiries/plans", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ inquiryPlans }),
  });
}

export async function saveInvestigationSummary(token: string, summary: unknown) {
  return requestJson<unknown>("/api/inquiries/investigations", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ summary: stripLargePayload(normalizeInquirySummaryForSave(summary)) }),
  });
}

export async function createFinalSummary(token: string, summary: unknown) {
  return requestJson<unknown>("/api/inquiries/final-summaries", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ summary: stripLargePayload(normalizeInquirySummaryForSave(summary)) }),
  });
}

export async function replaceFinalSummaries(token: string, finalSummaries: unknown[]) {
  return requestJson<unknown>("/api/inquiries/final-summaries", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ finalSummaries: stripLargePayload(finalSummaries) }),
  });
}

export async function saveInquiryTitles(token: string, earnedTitles: unknown[]) {
  return requestJson<unknown>("/api/inquiries/titles", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ earnedTitles }),
  });
}

function stripLargeCardPayload(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const card = value as Record<string, unknown>;
  const id = String(card.id || card.cardId || card.card_id || card.key || "").trim();
  if (!id) return null;

  const source = String(card.source || card.sourceType || card.source_type || "fixedImage");
  const snapshot =
    card.snapshot && typeof card.snapshot === "object" && !Array.isArray(card.snapshot)
      ? { ...(card.snapshot as Record<string, unknown>) }
      : card.snapshotMeta && typeof card.snapshotMeta === "object" && !Array.isArray(card.snapshotMeta)
        ? { ...(card.snapshotMeta as Record<string, unknown>) }
        : undefined;
  if (snapshot) {
    delete snapshot.photoSnapshotDataUrl;
    if (typeof snapshot.photoSnapshotImageUrl === "string") {
      snapshot.photoSnapshotImageUrl = persistableMediaPath(snapshot.photoSnapshotImageUrl);
    }
  }

  // 固定資料卡只需要 id；互動快照卡保留圖片路徑與必要的快照描述資料。
  if (source !== "interactiveSnapshot") return id;

  return {
    id,
    type: card.type || card.category,
    source,
    title: card.title || card.revealedTitle,
    note: card.note || card.content,
    image: persistableMediaPath(typeof card.image === "string" ? card.image : typeof card.imageSrc === "string" ? card.imageSrc : ""),
    unlocked: card.unlocked,
    sharedFromOtherPlayer: card.sharedFromOtherPlayer,
    snapshot,
  };
}

export async function saveInquiryCards(token: string, unlockedCards: unknown[]) {
  const compactUnlockedCards = (Array.isArray(unlockedCards) ? unlockedCards : [])
    .map(stripLargeCardPayload)
    .filter(Boolean);

  return requestJson<unknown>("/api/inquiries/cards", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ unlockedCards: compactUnlockedCards }),
  });
}


export async function uploadClueSnapshotImage(
  token: string,
  payload: { imageDataUrl: string; cardId?: string; title?: string; meta?: unknown },
) {
  const response = await requestJson<{ imageUrl: string; relativeUrl: string; filename: string }>(
    "/api/clue-snapshots",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );

  return {
    ...response,
    imageUrl: response.imageUrl.startsWith("http") ? response.imageUrl : apiUrl(response.imageUrl),
  };
}
