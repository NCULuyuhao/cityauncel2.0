import { useCallback } from "react";
import { removeInquiryDraft } from "@/storage/inquiryDraftStorage";

type IntroDisplay = {
  firstAnswer: string;
  secondAnswer: string;
};

type UseInquirySubmissionOptions<TCard, TEvidenceCard, TSummary, TIntroStage> = {
  token?: string | null;
  draftStorageKey?: string;
  conclusion: string;
  cards: TCard[];
  confirmedEvidenceCards: TEvidenceCard[];
  currentRoundCardIds: string[];
  collectionReflectionRecords: unknown[];
  currentInquiryOrder: number;
  inquiryRecordOrder: number | null;
  orientationMainChoice: string;
  orientationTextInput: string;
  introStage: TIntroStage;
  orientationCreatedAt: string | null;
  getIntroStageDisplay: (introStage: TIntroStage) => IntroDisplay;
  getCompactEvidenceCardSummary: (card: TEvidenceCard) => unknown;
  serializeUnlockedCard: (card: TCard, recordOrder: number) => unknown;
  isUnlockedRoundCard: (card: TCard, currentRoundCardIds: string[]) => boolean;
  createFinalSummary: (token: string, summary: TSummary) => Promise<unknown>;
  saveInvestigationSummary: (token: string, summary: unknown) => Promise<unknown>;
  onSubmitSummary: (summary: TSummary) => void;
};

export function useInquirySubmission<TCard, TEvidenceCard, TSummary, TIntroStage>({
  token,
  draftStorageKey,
  conclusion,
  cards,
  confirmedEvidenceCards,
  currentRoundCardIds,
  collectionReflectionRecords,
  currentInquiryOrder,
  inquiryRecordOrder,
  orientationMainChoice,
  orientationTextInput,
  introStage,
  orientationCreatedAt,
  getIntroStageDisplay,
  getCompactEvidenceCardSummary,
  serializeUnlockedCard,
  isUnlockedRoundCard,
  createFinalSummary,
  saveInvestigationSummary,
  onSubmitSummary,
}: UseInquirySubmissionOptions<TCard, TEvidenceCard, TSummary, TIntroStage>) {
  const buildCurrentRoundInvestigationCards = useCallback(
    (cardOverrides: TCard[] = []) => {
      const getCardId = (card: TCard) => String((card as { id?: unknown }).id || "");
      const overrideById = new Map(cardOverrides.map((card) => [getCardId(card), card]));
      const nextRoundCardIds = new Set(currentRoundCardIds);
      cardOverrides.forEach((card) => nextRoundCardIds.add(getCardId(card)));

      const nextCards = cards.map((card) => overrideById.get(getCardId(card)) ?? card);
      cardOverrides.forEach((card) => {
        const cardId = getCardId(card);
        if (!nextCards.some((item) => getCardId(item) === cardId)) nextCards.push(card);
      });

      return nextCards
        .filter((card) => isUnlockedRoundCard(card, Array.from(nextRoundCardIds)))
        .map((card) => serializeUnlockedCard(card, currentInquiryOrder));
    },
    [cards, currentInquiryOrder, currentRoundCardIds, isUnlockedRoundCard, serializeUnlockedCard],
  );

  const persistInvestigationCardsNow = useCallback(
    async (
      cardOverrides: TCard[] = [],
      syncReason: "card_change" | "finish" = "card_change",
      reflectionRecords: unknown[] = collectionReflectionRecords,
    ) => {
      if (!token) return;

      const currentRoundCards = buildCurrentRoundInvestigationCards(cardOverrides);
      if (currentRoundCards.length === 0) return;

      await saveInvestigationSummary(token, {
        orientationMainChoice,
        orientationTextInput,
        introStage,
        orientationCreatedAt: orientationCreatedAt || undefined,
        recordOrder: inquiryRecordOrder || currentInquiryOrder,
        investigationCreatedAt: new Date().toISOString(),
        investigationCards: currentRoundCards,
        collectionReflections: reflectionRecords,
        syncReason,
        evidenceCards: [],
        conclusion: "",
      });
    },
    [
      buildCurrentRoundInvestigationCards,
      collectionReflectionRecords,
      currentInquiryOrder,
      inquiryRecordOrder,
      introStage,
      orientationCreatedAt,
      orientationMainChoice,
      orientationTextInput,
      saveInvestigationSummary,
      token,
    ],
  );

  const persistCurrentInvestigation = useCallback(async () => {
    try {
      await persistInvestigationCardsNow([], "finish");
    } catch (error) {
      console.error("儲存本回合解鎖卡牌失敗", error);
    }
  }, [persistInvestigationCardsNow]);

  const submitFinalSummary = useCallback(async () => {
    if (!conclusion.trim()) return;
    if (confirmedEvidenceCards.length === 0) return;

    const introDisplay = getIntroStageDisplay(introStage);
    const currentRoundInvestigationCards = cards
      .filter((card) => isUnlockedRoundCard(card, currentRoundCardIds))
      .map((card) => serializeUnlockedCard(card, currentInquiryOrder));

    const summary = {
      orientationMainChoice: orientationMainChoice || introDisplay.firstAnswer,
      orientationTextInput: orientationTextInput || introDisplay.secondAnswer,
      introStage,
      orientationCreatedAt: orientationCreatedAt || undefined,
      recordOrder: inquiryRecordOrder || currentInquiryOrder,
      conclusionCreatedAt: new Date().toISOString(),
      investigationCards: currentRoundInvestigationCards,
      evidenceCards: confirmedEvidenceCards.map(getCompactEvidenceCardSummary),
      conclusion: conclusion.trim(),
      collectionReflections: collectionReflectionRecords,
    } as TSummary;

    if (token) {
      try {
        await createFinalSummary(token, summary);
        window.dispatchEvent(new CustomEvent("cityauncel:coin-updated"));
      } catch (error) {
        console.error("儲存探究總結失敗", error);
        return;
      }
    }

    onSubmitSummary(summary);
    if (draftStorageKey) removeInquiryDraft(draftStorageKey);
  }, [
    cards,
    collectionReflectionRecords,
    conclusion,
    confirmedEvidenceCards,
    createFinalSummary,
    currentInquiryOrder,
    currentRoundCardIds,
    draftStorageKey,
    getCompactEvidenceCardSummary,
    getIntroStageDisplay,
    inquiryRecordOrder,
    introStage,
    isUnlockedRoundCard,
    onSubmitSummary,
    orientationCreatedAt,
    orientationMainChoice,
    orientationTextInput,
    serializeUnlockedCard,
    token,
  ]);

  return {
    buildCurrentRoundInvestigationCards,
    persistInvestigationCardsNow,
    persistCurrentInvestigation,
    submitFinalSummary,
  };
}
