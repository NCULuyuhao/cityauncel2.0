/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一共用型別，集中定義卡片、草稿、前導回答、調查書與證據資料結構。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import type { Dispatch, SetStateAction } from "react";
import type {
  CategoryKey,
  TitleReward,
} from "@/features/inquiry/cards/cardPresentation";
import type {
  EvidenceSnapshotMeta,
  WaterQualityStationSnapshotRecord,
} from "@/features/inquiry/snapshots/snapshotBuilder";

export type { CategoryKey, EvidenceSnapshotMeta };
export type WaterQualityStationStatusRecord = WaterQualityStationSnapshotRecord;

export type InquiryIntroStageRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

export type InquiryIntroStageRecord = {
  records: InquiryIntroStageRecordItem[];
};

export type CollectionReflectionRecord = {
  id: string;
  createdAt: string;
  inquiryOrder: number;
  cardIds: string[];
  reason: string;
};

export type InquiryPurpose =
  | "task1_yes"
  | "task1_no"
  | "task2"
  | "task3_crisis"
  | "task3_suspect"
  | "task3_other"
  | "task4_yes"
  | "task4_no"
  | "free"
  | "find_suspect"
  | "investigate_crisis"
  | "unknown"
  | "other"
  | "";

export type SuspectAnswer = "yes" | "no" | "";
export type InquiryFlowStage = "purpose" | "followUp" | "ready" | "cards";

export type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

export type EvidenceSourceType = "fixedImage" | "interactiveSnapshot";

export type GameCard = {
  id: string;
  localId: number;
  category: CategoryKey;
  title: string;
  revealedTitle: string;
  content: string;
  unlocked: boolean;
  unlockedAt: string | null;
  imageSrc: string;
  sourceType?: EvidenceSourceType;
  snapshotMeta?: EvidenceSnapshotMeta;
  sharedFromOtherPlayer?: boolean;
  sharedAuthorName?: string;
};

export type EvidenceCardSummary =
  | string
  | {
      id: string;
      title?: string;
      imageSrc?: string;
      image?: string;
      content?: string;
      note?: string;
      category?: CategoryKey;
      type?: CategoryKey;
      sourceType?: GameCard["sourceType"];
      source?: GameCard["sourceType"];
      snapshotMeta?: EvidenceSnapshotMeta | null;
      snapshot?: EvidenceSnapshotMeta | null;
    };

export type StoredUnlockedCard = {
  id: string;
  content?: string;
  note?: string;
  studentNote?: string;
  reflectionNote?: string;
  unlockedAt?: string | number | null;
  unlockedInInquiryOrder?: number | null;
  round?: number | null;
  localId?: number;
  category?: CategoryKey;
  type?: CategoryKey;
  title?: string;
  revealedTitle?: string;
  imageSrc?: string;
  image?: string;
  sourceType?: EvidenceSourceType;
  source?: EvidenceSourceType;
  snapshotMeta?: EvidenceSnapshotMeta;
  snapshot?: EvidenceSnapshotMeta;
  unlocked?: boolean;
  sharedFromOtherPlayer?: boolean;
  sharedAuthorName?: string;
};

export type FinalSummary = {
  orientationMainChoice: string;
  orientationTextInput: string;
  introStage?: InquiryIntroStageRecord | null;
  orientationCreatedAt: string | null;
  recordOrder?: number | null;
  investigationCreatedAt?: string | null;
  conclusionCreatedAt?: string | null;
  investigationCards?: Array<StoredUnlockedCard | string>;
  evidenceCards: EvidenceCardSummary[];
  conclusion: string;
  collectionReflections?: CollectionReflectionRecord[];
};

export type InquiryDataProps = {
  token?: string;
  orientationMainChoice?: string;
  orientationTextInput?: string;
  currentInquiryOrder?: number;
  draftStorageKey?: string;
  inquiryRecordOrder?: number | null;
  onInquiryPlanCreated?: (introStage: InquiryIntroStageRecord) => void;
  onBackToHome?: () => void;
  onSubmitSummary: (summary: FinalSummary) => void;
  onTitleRewardsChange?: (titles: TitleReward[]) => void;
  onActivityLog?: (payload: ActivityLogPayload) => void;
  onAiHelperAvailabilityChange?: (available: boolean) => void;
  unlockedCardIds: Array<string | StoredUnlockedCard>;
  setUnlockedCardIds: Dispatch<
    SetStateAction<Array<string | StoredUnlockedCard>>
  >;
};

export type InquiryDataDraft = {
  version: 1;
  savedAt: number;
  currentInquiryOrder?: number;
  flowStage: InquiryFlowStage;
  isFinished: boolean;
  introStage: InquiryIntroStageRecord | null;
  orientationCreatedAt: string | null;
  inquiryPurpose: InquiryPurpose;
  suspectAnswer: SuspectAnswer;
  selectedSuspects: string[];
  task3Targets: string[];
  suspectReason: string;
  suspectOtherDraft: string;
  suspectOtherText: string;
  task3OtherDraft: string;
  task3OtherText: string;
  possibleCrisis: string;
  otherPurpose: string;
  readyMessage: string;
  conclusion: string;
  dataListCountdownDeadline: number | null;
  dataListCountdownRemainingMs?: number | null;
  dataListCountdownPausedAt?: number | null;
  flippedEvidenceIds: string[];
  selectedEvidenceIds: string[];
  confirmedEvidenceIds: string[];
  currentRoundCardIds: string[];
  collectionReflectionRecords?: CollectionReflectionRecord[];
  cards: GameCard[];
  activeCategory: CategoryKey | null;
  activeId: string | null;
  inputValue: string;
  newInputValue: string;
  developmentScore: number;
  conservationScore: number;
  earnedTitles: TitleReward[];
  hasNewCollectedContent: boolean;
  hasNewTitleReward: boolean;
};
