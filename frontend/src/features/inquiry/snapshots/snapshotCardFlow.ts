import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { EvidenceSnapshotMeta } from "./snapshotBuilder";
import type { SnapshotGameCard } from "./snapshotCardFactory";

export type SnapshotBalanceEffect = {
  development: number;
  conservation: number;
};

export type SnapshotActivityLogPayload = {
  eventType: string;
  eventLabel: string;
  targetType: string;
  targetId: string;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

export type SnapshotCardCreationOptions<
  TCard extends SnapshotGameCard,
  TStoredUnlockedCard extends { id: string } | string = string,
> = {
  meta: EvidenceSnapshotMeta;
  reason: string;
  snapshotImageUrl?: string;
  currentInquiryOrder: number;
  orientationCreatedAt: string | null;
  createSnapshotCard: (meta: EvidenceSnapshotMeta, reason: string, snapshotImageUrl?: string) => TCard;
  setCards: Dispatch<SetStateAction<TCard[]>>;
  addCardToCurrentRoundAndCheckReflection: (cardId: string) => void;
  setUnlockedCardIds: Dispatch<SetStateAction<TStoredUnlockedCard[]>>;
  serializeUnlockedCard: (card: TCard, currentInquiryOrder: number) => TStoredUnlockedCard;
  setHasNewCollectedContent: (value: boolean) => void;
  notifyAiHelperCardUnlocked: (card: TCard, eventType: "interactive_snapshot_unlock") => void;
  setJustUnlockedId: (cardId: string | null) => void;
  shouldShowTitleRewardAnimationRef: MutableRefObject<boolean>;
  snapshotCardScrollTimerRef: MutableRefObject<number | null>;
  setFlashingSnapshotCardId: (cardId: string | null) => void;
  getBalanceEffect: (category: TCard["category"]) => SnapshotBalanceEffect;
  setDevelopmentScore: Dispatch<SetStateAction<number>>;
  setConservationScore: Dispatch<SetStateAction<number>>;
  onActivityLog?: (payload: SnapshotActivityLogPayload) => void;
  persistInvestigationCardsNow: (cards: TCard[]) => Promise<unknown>;
};

function scheduleSnapshotCardFocus({
  cardId,
  snapshotCardScrollTimerRef,
  setFlashingSnapshotCardId,
}: {
  cardId: string;
  snapshotCardScrollTimerRef: MutableRefObject<number | null>;
  setFlashingSnapshotCardId: (cardId: string | null) => void;
}) {
  if (snapshotCardScrollTimerRef.current !== null) {
    window.clearTimeout(snapshotCardScrollTimerRef.current);
  }

  snapshotCardScrollTimerRef.current = window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-game-card-id="${CSS.escape(cardId)}"]`,
    );
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    window.setTimeout(() => {
      setFlashingSnapshotCardId(cardId);
      window.setTimeout(() => setFlashingSnapshotCardId(null), 2100);
    }, 780);
    snapshotCardScrollTimerRef.current = null;
  }, 520);
}

export function applySnapshotCardCreation<
  TCard extends SnapshotGameCard,
  TStoredUnlockedCard extends { id: string } | string = string,
>(
  options: SnapshotCardCreationOptions<TCard, TStoredUnlockedCard>,
) {
  const snapshotCard = options.createSnapshotCard(
    options.meta,
    options.reason,
    options.snapshotImageUrl,
  );

  options.setCards((prev) => [...prev, snapshotCard]);
  options.addCardToCurrentRoundAndCheckReflection(snapshotCard.id);
  options.setUnlockedCardIds((prev) => {
    const next = prev.filter((item) =>
      typeof item === "string"
        ? item !== snapshotCard.id
        : item.id !== snapshotCard.id,
    );
    return [
      ...next,
      options.serializeUnlockedCard(snapshotCard, options.currentInquiryOrder),
    ];
  });
  options.setHasNewCollectedContent(true);
  options.notifyAiHelperCardUnlocked(snapshotCard, "interactive_snapshot_unlock");
  options.setJustUnlockedId(snapshotCard.id);
  window.setTimeout(() => options.setJustUnlockedId(null), 900);
  options.shouldShowTitleRewardAnimationRef.current = true;

  scheduleSnapshotCardFocus({
    cardId: snapshotCard.id,
    snapshotCardScrollTimerRef: options.snapshotCardScrollTimerRef,
    setFlashingSnapshotCardId: options.setFlashingSnapshotCardId,
  });

  const effect = options.getBalanceEffect(snapshotCard.category);
  options.setDevelopmentScore((prev) => prev + effect.development);
  options.setConservationScore((prev) => prev + effect.conservation);

  options.onActivityLog?.({
    eventType: "interactive_snapshot_unlock",
    eventLabel: "擷取互動圖表成證據卡",
    targetType: "interactiveSnapshot",
    targetId: snapshotCard.id,
    newValue: options.reason.trim(),
    metadata: {
      title: snapshotCard.revealedTitle,
      category: snapshotCard.category,
      townName: options.meta.townName,
      subcategory: options.meta.subcategory,
      metric: options.meta.metric,
      inquiryOrder: options.currentInquiryOrder,
      orientationCreatedAt: options.orientationCreatedAt || null,
    },
  });

  void options.persistInvestigationCardsNow([snapshotCard]).catch((error) => {
    console.error("同步互動快照卡到 investigation 失敗", error);
  });
}
