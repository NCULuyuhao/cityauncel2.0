/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁調查書總結模型，處理完成狀態、排序與 upsert 規則。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import type { EvidenceCardSummary } from "./evidenceCardSummary";

export type InquiryIntroStageRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

export type InquiryIntroStageRecord = {
  records: InquiryIntroStageRecordItem[];
};

export type FinalSummary = {
  orientationMainChoice: string;
  orientationTextInput: string;
  introStage?: InquiryIntroStageRecord | null;
  orientationCreatedAt?: string | null;
  recordOrder?: number | null;
  investigationCreatedAt?: string | null;
  conclusionCreatedAt?: string | null;
  investigationCards?: EvidenceCardSummary[];
  evidenceCards: EvidenceCardSummary[];
  conclusion: string;
};

export function isCompletedFinalSummary(summary: FinalSummary) {
  return Boolean(
    String(summary.conclusion || "").trim() ||
      (Array.isArray(summary.evidenceCards) && summary.evidenceCards.length > 0),
  );
}

function getFinalSummaryKey(summary: FinalSummary) {
  if (summary.orientationCreatedAt) {
    return `created:${summary.orientationCreatedAt}`;
  }
  if (summary.introStage) return `intro:${JSON.stringify(summary.introStage)}`;
  return "";
}

function mergeFinalSummary(
  previous: FinalSummary,
  next: FinalSummary,
): FinalSummary {
  return {
    ...previous,
    ...next,
    introStage: next.introStage || previous.introStage || null,
    orientationCreatedAt:
      next.orientationCreatedAt || previous.orientationCreatedAt || null,
    recordOrder: next.recordOrder ?? previous.recordOrder ?? null,
    investigationCreatedAt:
      next.investigationCreatedAt || previous.investigationCreatedAt || null,
    conclusionCreatedAt:
      next.conclusionCreatedAt || previous.conclusionCreatedAt || null,
    investigationCards:
      Array.isArray(next.investigationCards) &&
      next.investigationCards.length > 0
        ? next.investigationCards
        : previous.investigationCards,
    evidenceCards:
      Array.isArray(next.evidenceCards) && next.evidenceCards.length > 0
        ? next.evidenceCards
        : previous.evidenceCards,
    conclusion: String(next.conclusion || previous.conclusion || ""),
  };
}

export function upsertFinalSummary(
  summaries: FinalSummary[],
  nextSummary: FinalSummary,
) {
  const nextKey = getFinalSummaryKey(nextSummary);
  const index = summaries.findIndex((summary) => {
    const summaryKey = getFinalSummaryKey(summary);
    return nextKey && summaryKey && nextKey === summaryKey;
  });

  if (index < 0) return [...summaries, nextSummary];

  return summaries.map((summary, summaryIndex) =>
    summaryIndex === index ? mergeFinalSummary(summary, nextSummary) : summary,
  );
}
