/**
 * CityAuncel maintainability notes
 * 檔案用途：前端 inquiryApi API 封裝，讓頁面與功能模組不用直接撰寫 fetch 細節。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { apiUrl, authHeaders, persistableMediaPath, requestJson } from "./apiClient";
import { removeApiCache, requestJsonCacheFirst } from "./apiResponseCache";
import { requestJsonWithPending } from "./pendingWriteQueue";
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
  return requestJsonCacheFirst<InquiryDataResponse>(token, "/api/inquiries");
}

function getSummaryDedupeKey(summary: unknown) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return Date.now().toString();
  const value = summary as Record<string, unknown>;
  return String(
    value.recordOrder ??
      value.orientationCreatedAt ??
      value.createdAt ??
      value.id ??
      Date.now(),
  );
}

export async function createInquiryRecord(token: string, recordOrder?: number) {
  const response = await requestJsonWithPending<InquiryRecordResponse>(token, {
    path: "/api/inquiries/records",
    method: "POST",
    body: { recordOrder },
    dedupeKey: `inquiry-record:${recordOrder ?? "auto"}`,
  });
  removeApiCache("/api/inquiries");
  return response;
}

export async function createInquiryPlan(
  token: string,
  introStage: unknown,
  orientationCreatedAt: string,
  recordOrder?: number | null,
) {
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/plans",
    method: "POST",
    body: { introStage, orientationCreatedAt, recordOrder },
    dedupeKey: `inquiry-plan:${recordOrder ?? "unknown"}:${orientationCreatedAt}`,
  });
  removeApiCache("/api/inquiries");
  return response;
}


export async function replaceInquiryPlans(token: string, inquiryPlans: unknown[]) {
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/plans",
    method: "PUT",
    body: { inquiryPlans },
    dedupeKey: "inquiry-plans:replace",
  });
  removeApiCache("/api/inquiries");
  return response;
}

export async function saveInvestigationSummary(token: string, summary: unknown) {
  const normalizedSummary = stripLargePayload(normalizeInquirySummaryForSave(summary));
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/investigations",
    method: "POST",
    body: { summary: normalizedSummary },
    dedupeKey: `investigation:${getSummaryDedupeKey(normalizedSummary)}`,
  });
  removeApiCache("/api/inquiries");
  return response;
}

export async function createFinalSummary(token: string, summary: unknown) {
  const normalizedSummary = stripLargePayload(normalizeInquirySummaryForSave(summary));
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/final-summaries",
    method: "POST",
    body: { summary: normalizedSummary },
    dedupeKey: `final-summary:${getSummaryDedupeKey(normalizedSummary)}`,
  });
  removeApiCache("/api/inquiries");
  return response;
}

export async function replaceFinalSummaries(token: string, finalSummaries: unknown[]) {
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/final-summaries",
    method: "PUT",
    body: { finalSummaries: stripLargePayload(finalSummaries) },
    dedupeKey: "final-summaries:replace",
  });
  removeApiCache("/api/inquiries");
  return response;
}

export async function saveInquiryTitles(token: string, earnedTitles: unknown[]) {
  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/titles",
    method: "PUT",
    body: { earnedTitles },
    dedupeKey: "inquiry-titles",
  });
  removeApiCache("/api/inquiries");
  return response;
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

  const response = await requestJsonWithPending<unknown>(token, {
    path: "/api/inquiries/cards",
    method: "PUT",
    body: { unlockedCards: compactUnlockedCards },
    dedupeKey: "inquiry-cards",
  });
  removeApiCache("/api/inquiries");
  return response;
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
