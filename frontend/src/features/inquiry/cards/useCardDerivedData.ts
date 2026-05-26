import { useMemo } from "react";
import { CATEGORY_KEYS } from "@/features/inquiry/cards/cardCatalog";
import type { CategoryKey } from "@/features/inquiry/cards/cardPresentation";

export type DerivedDataGameCard = {
  id: string;
  category: CategoryKey;
  unlocked: boolean;
  sourceType?: "fixedImage" | "interactiveSnapshot";
};

export type CardDerivedData<TCard extends DerivedDataGameCard> = {
  cardById: Map<string, TCard>;
  categoryCardsByCategory: Record<CategoryKey, TCard[]>;
  unlockedCountByCategory: Record<CategoryKey, number>;
  totalCountByCategory: Record<CategoryKey, number>;
  totalUnlockedCount: number;
  totalCardCount: number;
  unlockedCardsWithContent: TCard[];
  allUnlockedCardsWithContent: TCard[];
  confirmedEvidenceCards: TCard[];
  activeCard: TCard | null;
  pendingCollectionReflectionCards: TCard[];
};

export function shouldShowCardInCategoryList(card: DerivedDataGameCard) {
  // 水資源分類的卡牌來源改為「使用者點我快照線索產生的快照卡」。
  // 原本 /card/image1~30 的固定水資源卡仍可相容舊資料，但不再進入分類清單、計數與收藏顯示。
  return card.category !== "water" || card.sourceType === "interactiveSnapshot";
}

function createCategoryRecord<TValue>(factory: () => TValue) {
  return CATEGORY_KEYS.reduce(
    (record, category) => {
      record[category] = factory();
      return record;
    },
    {} as Record<CategoryKey, TValue>,
  );
}

export function useCardDerivedData<TCard extends DerivedDataGameCard>({
  cards,
  confirmedEvidenceIds,
  currentRoundCardIds,
  activeId,
  pendingCollectionReflectionCardIds,
}: {
  cards: TCard[];
  confirmedEvidenceIds: string[];
  currentRoundCardIds: string[];
  activeId: string | null;
  pendingCollectionReflectionCardIds: string[];
}): CardDerivedData<TCard> {
  return useMemo(() => {
    const currentRoundIdSet = new Set(currentRoundCardIds);
    const confirmedEvidenceIdSet = new Set(confirmedEvidenceIds);
    const cardById = new Map<string, TCard>();
    const categoryCardsByCategory = createCategoryRecord<TCard[]>(() => []);
    const unlockedCountByCategory = createCategoryRecord<number>(() => 0);
    const totalCountByCategory = createCategoryRecord<number>(() => 0);
    const unlockedCardsWithContent: TCard[] = [];
    const allUnlockedCardsWithContent: TCard[] = [];
    const confirmedEvidenceCards: TCard[] = [];
    let totalUnlockedCount = 0;
    let visibleTotalCardCount = 0;

    cards.forEach((card) => {
      cardById.set(card.id, card);

      if (!shouldShowCardInCategoryList(card)) return;

      visibleTotalCardCount += 1;
      totalCountByCategory[card.category] += 1;
      categoryCardsByCategory[card.category].push(card);

      if (!card.unlocked) return;

      allUnlockedCardsWithContent.push(card);
      totalUnlockedCount += 1;
      unlockedCountByCategory[card.category] += 1;

      if (currentRoundIdSet.has(card.id)) {
        unlockedCardsWithContent.push(card);
        if (confirmedEvidenceIdSet.has(card.id)) {
          confirmedEvidenceCards.push(card);
        }
      }
    });

    const activeCard = activeId ? (cardById.get(activeId) ?? null) : null;
    const pendingCollectionReflectionCards = pendingCollectionReflectionCardIds
      .map((cardId) => cardById.get(cardId))
      .filter((card): card is TCard => Boolean(card));

    return {
      cardById,
      categoryCardsByCategory,
      unlockedCountByCategory,
      totalCountByCategory,
      totalUnlockedCount,
      totalCardCount: visibleTotalCardCount,
      unlockedCardsWithContent,
      allUnlockedCardsWithContent,
      confirmedEvidenceCards,
      activeCard,
      pendingCollectionReflectionCards,
    };
  }, [
    activeId,
    cards,
    confirmedEvidenceIds,
    currentRoundCardIds,
    pendingCollectionReflectionCardIds,
  ]);
}
