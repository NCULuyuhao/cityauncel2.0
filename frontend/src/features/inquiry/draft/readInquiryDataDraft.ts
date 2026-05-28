import { isSupportedInquiryTitleReward } from "@/features/inquiry/titleRewards/titleRewardStyles";
import { normalizeCountdownMs } from "@/features/inquiry/timer/dataListCountdownConfig";
import { readInquiryDraftJson } from "@/storage/inquiryDraftStorage";
import type {
  CollectionReflectionRecord,
  GameCard,
  InquiryDataDraft,
} from "@/features/inquiry/inquiryDataTypes";

type NormalizeDraftCards = (savedCards?: Partial<GameCard>[]) => GameCard[];

export function readInquiryDataDraft(
  storageKey: string | undefined,
  expectedInquiryOrder: number | undefined,
  normalizeDraftCards: NormalizeDraftCards,
): InquiryDataDraft | null {
  if (!storageKey || typeof window === "undefined") return null;

  try {
    const parsed = readInquiryDraftJson<Partial<InquiryDataDraft>>(storageKey);
    if (!parsed) return null;
    if (parsed.version !== 1) return null;
    if (
      expectedInquiryOrder &&
      Number(parsed.currentInquiryOrder || 0) !== Number(expectedInquiryOrder)
    ) {
      return null;
    }

    return {
      version: 1,
      savedAt: Number(parsed.savedAt) || Date.now(),
      currentInquiryOrder:
        Number(parsed.currentInquiryOrder || expectedInquiryOrder || 0) ||
        undefined,
      flowStage: parsed.flowStage ?? "purpose",
      isFinished: Boolean(parsed.isFinished),
      introStage: parsed.introStage ?? null,
      orientationCreatedAt: parsed.orientationCreatedAt
        ? String(parsed.orientationCreatedAt)
        : null,
      inquiryPurpose: parsed.inquiryPurpose ?? "",
      suspectAnswer: parsed.suspectAnswer ?? "",
      selectedSuspects: Array.isArray(parsed.selectedSuspects)
        ? parsed.selectedSuspects
        : [],
      task3Targets: Array.isArray(parsed.task3Targets)
        ? (parsed.task3Targets.filter((target) =>
            ["crisis", "suspect", "other"].includes(String(target)),
          ) as string[])
        : [],
      suspectReason: String(parsed.suspectReason ?? ""),
      suspectOtherDraft: String(
        parsed.suspectOtherDraft ?? parsed.suspectOtherText ?? "",
      ),
      suspectOtherText: String(parsed.suspectOtherText ?? ""),
      task3OtherDraft: String(
        parsed.task3OtherDraft ?? parsed.task3OtherText ?? "",
      ),
      task3OtherText: String(parsed.task3OtherText ?? ""),
      possibleCrisis: String(parsed.possibleCrisis ?? ""),
      otherPurpose: String(parsed.otherPurpose ?? ""),
      readyMessage: String(
        parsed.readyMessage ?? "準備好成為一位優秀的調查員了嗎？",
      ),
      conclusion: String(parsed.conclusion ?? ""),
      dataListCountdownDeadline: Number.isFinite(
        Number(parsed.dataListCountdownDeadline),
      )
        ? Number(parsed.dataListCountdownDeadline)
        : null,
      dataListCountdownRemainingMs: normalizeCountdownMs(
        parsed.dataListCountdownRemainingMs,
      ),
      dataListCountdownPausedAt: Number.isFinite(
        Number(parsed.dataListCountdownPausedAt),
      )
        ? Number(parsed.dataListCountdownPausedAt)
        : null,
      flippedEvidenceIds: Array.isArray(parsed.flippedEvidenceIds)
        ? parsed.flippedEvidenceIds
        : [],
      selectedEvidenceIds: Array.isArray(parsed.selectedEvidenceIds)
        ? parsed.selectedEvidenceIds
        : [],
      confirmedEvidenceIds: Array.isArray(parsed.confirmedEvidenceIds)
        ? parsed.confirmedEvidenceIds
        : [],
      currentRoundCardIds: Array.isArray(parsed.currentRoundCardIds)
        ? parsed.currentRoundCardIds
        : [],
      collectionReflectionRecords: Array.isArray(
        parsed.collectionReflectionRecords,
      )
        ? parsed.collectionReflectionRecords
            .filter((record): record is CollectionReflectionRecord =>
              Boolean(
                record &&
                  typeof record.id === "string" &&
                  typeof record.createdAt === "string" &&
                  Array.isArray(record.cardIds) &&
                  typeof record.reason === "string",
              ),
            )
            .map((record) => ({
              ...record,
              inquiryOrder: Number(
                record.inquiryOrder || expectedInquiryOrder || 1,
              ),
              cardIds: record.cardIds.filter((id) => typeof id === "string"),
            }))
        : [],
      cards: normalizeDraftCards(parsed.cards),
      activeCategory: parsed.activeCategory ?? null,
      activeId: parsed.activeId ?? null,
      inputValue: String(parsed.inputValue ?? ""),
      newInputValue: String(parsed.newInputValue ?? ""),
      developmentScore: Number(parsed.developmentScore) || 0,
      conservationScore: Number(parsed.conservationScore) || 0,
      earnedTitles: Array.isArray(parsed.earnedTitles)
        ? parsed.earnedTitles.filter(isSupportedInquiryTitleReward)
        : [],
      hasNewCollectedContent: Boolean(parsed.hasNewCollectedContent),
      hasNewTitleReward: Boolean(parsed.hasNewTitleReward),
    };
  } catch (error) {
    console.error("讀取探究草稿失敗", error);
    return null;
  }
}
