import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Lock,
  Unlock,
  X,
  ChevronDown,
  Clock,
  BookOpen,
  Leaf,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import WaterMapPanel from "@/features/inquiry/water/WaterMapPanel";
import WaterChartPanel from "@/features/inquiry/water/WaterChartPanel";
import SnapshotCaptureOverlay from "@/features/inquiry/snapshots/SnapshotCaptureOverlay";
import {
  captureElementAsImageDataUrl,
  waitForUiSequence,
} from "@/features/inquiry/snapshots/snapshotCapture";
import {
  createCardFromStoredSnapshotCard,
  createSnapshotGameCard,
} from "@/features/inquiry/snapshots/snapshotCardFactory";
import { applySnapshotCardCreation } from "@/features/inquiry/snapshots/snapshotCardFlow";
import {
  buildSnapshotSvgDataUrl as buildSnapshotSvgDataUrlFromBuilder,
  cwaRainfallLegend,
  formatRpiNumber,
  getInteractiveChartFillHex,
  getInteractiveDataStats,
  getRainfallLevelColor,
  getRpiLevel,
  roundRpiValue,
  rpiLegend,
  type SnapshotBuilderDependencies,
} from "@/features/inquiry/snapshots/snapshotBuilder";
import {
  WaterLiveSnapshotCardPreview,
  WaterLiveSnapshotView,
} from "@/features/inquiry/water/WaterLiveSnapshotViews";
import { isWaterLiveSnapshotMeta } from "@/features/inquiry/water/waterLiveSnapshotGuards";
import { WATER_RPI_GIS_RIVER_SHAPES } from "@/data/waterRpiGisRiverShapes";
import { useInquiryDraftAutosave } from "@/features/inquiry/hooks/useInquiryDraftAutosave";
import { useInquiryTitleSync } from "@/features/inquiry/hooks/useInquiryTitleSync";
import { useInquiryIntroFlow } from "@/features/inquiry/hooks/useInquiryIntroFlow";
import { useInquirySubmission } from "@/features/inquiry/hooks/useInquirySubmission";
import { useStableScrollbarGutter } from "@/features/inquiry/hooks/useStableScrollbarGutter";
import { readInquiryDraftJson } from "@/storage/inquiryDraftStorage";
import { labelPositions, regions } from "../data/miaoliMapView";
import {
  createFinalSummary,
  createInquiryPlan,
  saveInvestigationSummary,
  saveInquiryCards,
  saveInquiryTitles,
  uploadClueSnapshotImage,
} from "../api/inquiryApi";

type CategoryKey = "water" | "land" | "leopard" | "rumor" | "other";
type TitleTier = "novice" | "advanced" | "master";
type TitleTheme = "water" | "land" | "leopard" | "rumor" | "cross";

type EvidenceCardSummary =
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

type InquiryIntroStageRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

type InquiryIntroStageRecord = {
  records: InquiryIntroStageRecordItem[];
};

type CollectionReflectionRecord = {
  id: string;
  createdAt: string;
  inquiryOrder: number;
  cardIds: string[];
  reason: string;
};

type FinalSummary = {
  orientationMainChoice: string;
  orientationTextInput: string;
  introStage?: InquiryIntroStageRecord | null;
  orientationCreatedAt?: string | null;
  recordOrder?: number | null;
  investigationCreatedAt?: string | null;
  conclusionCreatedAt?: string | null;
  investigationCards?: Array<StoredUnlockedCard | string>;
  evidenceCards: EvidenceCardSummary[];
  conclusion: string;
  collectionReflections?: CollectionReflectionRecord[];
};

const INVESTIGATION_CASE_FLOW = [
  {
    id: "discover_crisis",
    title: "任務一：發現危機",
    storyTitle: "山林裡的不尋常消息",
    storyParagraphs: [
      "苗栗的山林裡，最近出現了一些讓人擔心的線索",
      "有人說石虎越來越少被看見，也有人發現牠們的生活環境正在改變",
      "可是，石虎真正遇到的危機是什麼？現在還不能太快下結論",
      "在開始調查前，請先想一想：你覺得石虎可能遇到了什麼生存危機？",
    ],
    prompt: "對於石虎的生存危機，你有想法嗎?",
    readyNoticeTitle: "開始調查前，請記得",
    readyNoticeParagraphs: [
      "等一下你會看到不同類型的資料",
      "請試著想一想：這張資料跟石虎的生存危機有什麼關係？",
      "看資料時，請先慢慢讀，再做選擇。",
    ],
    conclusionPrompt:
      "請整理你在探究過程中發現的危機線索：哪些證據證明了石虎遇到甚麼危機呢？",
  },
  {
    id: "lock_suspect",
    title: "任務二：鎖定嫌疑犯",
    storyTitle: "誰讓危機發生？",
    storyParagraphs: [
      "你已經發現一些石虎可能遇到的危機",
      "但接下來要繼續追查：這些危機可能是誰或什麼原因造成的？",
      "道路、開發、人類活動、傳言或其他因素，都有可能成為調查方向",
      "在開始調查前，請先想一想：你目前有沒有懷疑的對象？",
    ],
    prompt: "請問你目前的這幾個對象裡面，你有懷疑的對象嗎？",
    readyNoticeTitle: "調查嫌疑犯前，請記得",
    readyNoticeParagraphs: [
      "懷疑只是調查的開始，不代表答案已經確定。",
      "請把你懷疑的對象，和你調查的資料線索連在一起。",
      "還不確定也沒關係，就去調查更多證據來確認兇手是誰吧",
    ],
    conclusionPrompt: "請說明你鎖定的嫌疑犯是誰，以及哪些證據讓你這樣判斷。",
  },
  {
    id: "trace_evidence",
    title: "任務三：追查證據",
    storyTitle: "不能只靠懷疑",
    storyParagraphs: [
      "有了危機和嫌疑犯，還不代表真相已經出現",
      "如果要讓別人相信你的判斷，你需要找到更清楚的證據",
      "這些證據可能和危機有關，也可能和兇手有關，甚至可能帶你發現新方向",
      "在開始調查前，請先決定：你這次最想追查哪一種證據？",
    ],
    prompt: "追查證據任務開始，你想追查的證據是關於？",
    readyNoticeTitle: "追查證據前，請記得",
    readyNoticeParagraphs: [
      "不是每一張資料都一定能成為好證據。",
      "你可以問自己：這張資料能證明什麼？它跟我的判斷有連起來嗎？",
      "請用清楚的理由，把零散線索變成有說服力的證據。",
    ],
    conclusionPrompt:
      "請說明你追查到哪些證據，這些證據如何支持或挑戰你的想法。",
  },
  {
    id: "revise_inference",
    title: "任務四：修正推論",
    storyTitle: "真相可能不只一種",
    storyParagraphs: [
      "調查越深入，事情可能越複雜。",
      "你可能更加確定原本的想法，也可能發現自己需要修正判斷。",
      "在最後一次調查之前",
      "請先想一想：你的想法有沒有改變？還是你更加確定了什麼？",
    ],
    prompt: "經過這幾次的調查有沒有改變甚麼想法？",
    readyNoticeTitle: "修正推論前，請記得",
    readyNoticeParagraphs: [
      "優秀的調查員會利用新證據調整想法，或是加強論述某個答案",
      "如果你的想法改變了，請說明為什麼",
      "如果更確定了，也請拿出更多的證據",
    ],
    conclusionPrompt:
      "請寫出修正後或更加確定的推論：石虎生存的危機是由哪些因素造成？",
  },
];

function getInvestigationCaseByOrder(order?: number | null) {
  const safeOrder = Math.max(1, Number(order || 1));
  if (safeOrder > INVESTIGATION_CASE_FLOW.length) {
    return {
      id: "free_inquiry",
      title: `延伸探究 ${safeOrder}`,
      storyTitle: "新的調查方向",
      storyParagraphs: [
        "主要任務已經完成，但仍可能有遺漏或是新的線索值得追查",
        "這一次，你可以自己決定想調查的方向。",
        "在開始前，請先寫下：這次想探究甚麼呢？",
      ],
      prompt: "請問你這次探究的目的是什麼呢？",
      readyNoticeTitle: "延伸探究前，請記得",
      readyNoticeParagraphs: [
        "自由的探究，帶著你的想法跟你的好奇心繼續去尋找線索吧~",
      ],
      conclusionPrompt: "請整理這次延伸探究的目的、證據與你的判斷。",
    };
  }
  return INVESTIGATION_CASE_FLOW[safeOrder - 1] || INVESTIGATION_CASE_FLOW[0];
}

const INTRO_COUNTDOWN_SECONDS = 3;

function useIntroCountdown(resetKey: string) {
  const [secondsLeft, setSecondsLeft] = useState(INTRO_COUNTDOWN_SECONDS);

  useEffect(() => {
    const resetTimerId = window.setTimeout(() => {
      setSecondsLeft(INTRO_COUNTDOWN_SECONDS);
    }, 0);

    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearTimeout(resetTimerId);
      window.clearInterval(timerId);
    };
  }, [resetKey]);

  return secondsLeft;
}

function IntroCountdownButton({
  resetKey,
  onClick,
  className,
  children,
}: {
  resetKey: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  const secondsLeft = useIntroCountdown(resetKey);
  const isLocked = secondsLeft > 0;

  return (
    <button
      type="button"
      onClick={() => {
        if (isLocked) return;
        onClick();
      }}
      disabled={isLocked}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0`}
    >
      {isLocked ? (
        <span className="inline-flex items-center justify-center gap-1">
          <span>{children}</span>
          <span className="rounded-full bg-white/55 px-2 py-0.5 text-xs">
            {secondsLeft}
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

type InquiryPurpose =
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
type SuspectAnswer = "yes" | "no" | "";
type InquiryFlowStage = "purpose" | "followUp" | "ready" | "cards";
type InquiryHistoryStage = InquiryFlowStage | "summary";

type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

type EvidenceSourceType = "fixedImage" | "interactiveSnapshot";

type EvidenceSnapshotPoint = {
  label: string;
  value: number;
};

type EvidenceSnapshotMeta = {
  townName: string;
  category: CategoryKey;
  categoryLabel: string;
  subcategory: string;
  metric: string;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  filterLabel: string;
  interpretationText?: string;
  chartData: EvidenceSnapshotPoint[];
  activeTimeIndex?: number;
  // 快照按下當下，地圖各鄉鎮實際使用的數值。
  // 目前主要用在水資源「降雨量」快照，保留按下快照當下 CSV 資料對應的地圖顏色。
  mapTownValues?: Record<string, number>;
  // 快照按下當下，河川水質 RPI 地圖各河川實際使用的數值。
  // 用在水資源「河川水質汙染指數(RPI)」快照，保留按下快照當下 CSV 資料對應的 RPI 顏色。
  mapRiverValues?: Record<string, number>;
  // RPI 快照是否顯示苗栗鄉鎮名稱，保持與學生按下擷取線索當下畫面一致。
  showRegionLabels?: boolean;
  // 水質監測站快照按下當下使用的測站資料，避免快照彈窗/卡牌重新用另一份資料重畫。
  waterQualityStations?: WaterQualityStationStatusRecord[];
  // 水質監測站快照按下當下，清單在學生畫面中的捲動位置。
  // 用來讓全地區快照保留學生當下正在看的測站清單位置。
  waterQualityStationListScrollTop?: number;
  // 水質監測站快照按下當下，學生清單視窗中實際看見的測站。
  // 用來讓全地區快照鎖定當下滾輪位置的可視清單，而不是重新顯示全清單。
  waterQualityStationVisibleStationIds?: string[];
  // 照片式快照：確認建立快照線索時，直接把彈窗左側預覽畫面轉成圖片。
  // 下方數據卡與點開預覽都使用這張圖片，避免重新繪圖造成畫面不一致。
  photoSnapshotDataUrl?: string;
  photoSnapshotImageUrl?: string;
  photoSnapshotRelativeUrl?: string;
  photoSnapshotFilename?: string;
  createdAt: string;
};

type StoredUnlockedCard = {
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

type InquiryDataProps = {
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
  setUnlockedCardIds: React.Dispatch<
    React.SetStateAction<Array<string | StoredUnlockedCard>>
  >;
};

const COLLECTION_REFLECTION_BATCH_SIZE = 6;
const INTRO_TEXT_MIN_LENGTH = 8;
const SUSPECT_REASON_PROMPT_PREFIX = "我懷疑的原因是：";
const SUSPECT_REASON_INTUITION_TEXT = "我靠的是直覺，沒有理由";
const COLLECTION_REFLECTION_BASE_MIN_LENGTH = 10;
const COLLECTION_REFLECTION_STEP_MIN_LENGTH = 5;
const COLLECTION_REFLECTION_MAX_MIN_LENGTH = 30;
const CONCLUSION_MIN_LENGTH = 30;
const DATA_LIST_COUNTDOWN_MS = 8 * 60 * 1000;
const DATA_LIST_THREE_MINUTE_MS = 3 * 60 * 1000;
const DATA_LIST_ONE_MINUTE_MS = 60 * 1000;

function getCollectionReflectionMinLength(cardCount: number) {
  if (cardCount <= 0) return COLLECTION_REFLECTION_BASE_MIN_LENGTH;
  return Math.min(
    COLLECTION_REFLECTION_BASE_MIN_LENGTH +
      (cardCount - 1) * COLLECTION_REFLECTION_STEP_MIN_LENGTH,
    COLLECTION_REFLECTION_MAX_MIN_LENGTH,
  );
}

function formatCountdownTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function DataListCountdownTimer({
  remainingMs,
  notice,
}: {
  remainingMs: number;
  notice: "three" | "one" | "done" | null;
}) {
  const isUrgent = remainingMs <= DATA_LIST_ONE_MINUTE_MS;
  const isWarning = remainingMs <= DATA_LIST_THREE_MINUTE_MS;
  const noticeText =
    notice === "three"
      ? "剩餘 3 分鐘，請把重要線索收藏起來"
      : notice === "one"
        ? "剩餘 1 分鐘，準備完成蒐集檢查"
        : notice === "done"
          ? "時間到，進入蒐集檢查站"
          : "";

  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[58] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2">
      <motion.div
        animate={
          isUrgent
            ? {
                scale: [1, 1.035, 1],
                boxShadow: [
                  "0 14px 34px rgba(127,47,47,0.22)",
                  "0 0 0 7px rgba(239,68,68,0.12), 0 18px 42px rgba(127,47,47,0.24)",
                  "0 14px 34px rgba(127,47,47,0.22)",
                ],
              }
            : { scale: 1 }
        }
        transition={
          isUrgent
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        className={`flex h-12 items-center gap-2 rounded-full border px-4 backdrop-blur-xl ${
          isUrgent
            ? "border-red-300 bg-red-50/95 text-red-800 shadow-[0_14px_34px_rgba(127,47,47,0.22)]"
            : isWarning
              ? "border-amber-300 bg-amber-50/95 text-amber-800 shadow-[0_12px_30px_rgba(180,83,9,0.16)]"
              : "border-sky-200 bg-white/92 text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
        }`}
      >
        {isWarning ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 text-sky-600" />
        )}
        <span className="text-xs font-black tracking-[0.16em]">蒐集時間</span>
        <span className="rounded-full bg-white/78 px-3 py-1 font-mono text-lg font-black leading-none tracking-[0.08em]">
          {formatCountdownTime(remainingMs)}
        </span>
      </motion.div>

      <AnimatePresence>
        {notice ? (
          <motion.div
            key={notice}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className={`rounded-2xl border px-4 py-2 text-center text-sm font-black shadow-[0_14px_34px_rgba(15,23,42,0.16)] ${
              notice === "one" || notice === "done"
                ? "border-red-200 bg-red-50/96 text-red-800"
                : "border-amber-200 bg-amber-50/96 text-amber-800"
            }`}
          >
            {noticeText}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const INQUIRY_SUSPECT_GROUPS = [
  { id: "public", name: "一般民眾", shortName: "一般民眾" },
  { id: "developer", name: "建商/企業", shortName: "建商/企業" },
  { id: "resident", name: "當地居民", shortName: "當地居民" },
  { id: "farmer", name: "農民", shortName: "農民" },
  { id: "authority", name: "地方主管機關", shortName: "地方主管機關" },
  { id: "media", name: "媒體", shortName: "媒體" },
];

type GameCard = {
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

type InquiryDataDraft = {
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

type TitleReward = {
  id: string;
  name: string;
  description: string;
};

import {
  categoryListThemeMap,
  categoryMetaMap,
  categoryTabThemeMap,
  titleRewardPool,
  writtenCardStateMap,
} from "@/features/inquiry/cards/cardPresentation";
import { CollectedCardsPanel } from "@/features/inquiry/cards/CollectedCardsPanel";
import { CollectedCardPreview } from "@/features/inquiry/cards/CollectedCardPreview";
import { GameCardGrid } from "@/features/inquiry/cards/GameCardGrid";
import { useCardDerivedData } from "@/features/inquiry/cards/useCardDerivedData";
import {
  ALL_CARD_IMAGE_PRELOAD_CARDS,
  CATEGORY_KEYS,
  TITLE_REWARD_CATEGORY_KEYS,
  createAllCards,
} from "@/features/inquiry/cards/cardCatalog";

import {
  ALL_TOWNS_LABEL,
  ALL_WATER_TOWNS_LABEL,
  INTERACTIVE_TOWN_OPTIONS,
  LATEST_WATER_DATA_MONTH,
  MIAOLI_TOWNS,
  RECENT_WATER_MONTH_LABELS,
  formatMonthOnlyLabel,
  formatRainfallAmount,
  getRainfallValueForTownSelection,
  getWaterTownRecordsForMonth,
  normalizeStationMonth,
  parseCsvRecords,
  parseWaterTownMonthlyCsv,
  splitStationList,
  toFiniteNumber,
  type WaterTownMonthlyRecord,
} from "@/features/inquiry/water/waterResources";
import {
  getPersistableImageSrc,
  getStoredCardContent,
  getStoredCardImage,
  getStoredCardRound,
  getStoredCardSnapshot,
  getStoredCardSource,
  nowIsoTimestamp,
  stripLargeSnapshotPayload,
  toIsoTimestamp,
} from "@/features/inquiry/cards/cardSerialization";
function inferAiHelperCardProfileForClient(card: GameCard) {
  const title = card.revealedTitle || card.title || "";
  const text = `${title} ${card.content || ""}`;
  const categoryLabel = categoryMetaMap[card.category]?.label || card.category;
  const town = MIAOLI_TOWNS.find((item) => text.includes(item)) || "";
  let dataType = "一般線索";
  let possibleUse = "可作為探究石虎危機的參考線索";
  const crisisLinks: string[] = [];
  const addLink = (link: string) => {
    if (!crisisLinks.includes(link)) crisisLinks.push(link);
  };

  if (/人口密度/.test(text)) {
    dataType = "人口密度";
    possibleUse = "判斷人類活動壓力是否較高";
    addLink("人類活動");
    addLink("開發壓力");
  } else if (/公路交通量|交通量|車流/.test(text)) {
    dataType = "公路交通量";
    possibleUse = "判斷道路與車流是否增加石虎移動風險";
    addLink("道路風險");
    addLink("路殺");
  } else if (/土地樣貌|土地使用|棲地/.test(text)) {
    dataType = text.includes("棲地") ? "棲地分布" : "土地樣貌";
    possibleUse = "觀察棲地、開發或土地利用變化";
    addLink("棲地破碎");
    addLink("土地開發");
  } else if (/石虎出沒|出沒位置/.test(text)) {
    dataType = "石虎出沒位置";
    possibleUse = "確認石虎活動位置與可能重疊風險";
    addLink("活動範圍");
    addLink("地區風險");
  } else if (/石虎意外|意外統計|意外報告|路殺/.test(text)) {
    dataType = text.includes("路殺") ? "路殺位置" : "石虎意外";
    possibleUse = "查看石虎已發生的傷亡或事故線索";
    addLink("道路風險");
    addLink("人獸衝突");
  } else if (/傳言|新聞|報導|雞|家禽|捕獲|圍網/.test(text)) {
    dataType = /新聞|報導/.test(text) ? "新聞報導" : "傳言/衝突線索";
    possibleUse = "了解人類看法、誤解或雞舍衝突";
    addLink("人獸衝突");
    addLink("傳言誤解");
  } else if (/觀光/.test(text)) {
    dataType = "觀光資料";
    possibleUse = "判斷遊客活動是否可能干擾棲地";
    addLink("人類活動");
    addLink("干擾壓力");
  } else if (/公路位置/.test(text)) {
    dataType = "公路位置";
    possibleUse = "對照道路與石虎棲地或出沒位置";
    addLink("道路切割");
    addLink("路殺");
  } else if (/通報|獎勵|巡守|友善農地/.test(text)) {
    dataType = "保育行動/通報";
    possibleUse = "了解人類如何回應石虎危機";
    addLink("保育行動");
    addLink("社區參與");
  } else if (
    /水|降雨|RPI|水質|河川|水庫|地下水|灌溉/.test(text) ||
    card.category === "water"
  ) {
    dataType = "水環境資料";
    possibleUse = "觀察水環境是否影響棲地條件";
    addLink("水環境");
    addLink("棲地條件");
  }

  return { categoryLabel, town, dataType, possibleUse, crisisLinks };
}

type InteractiveSelection = string;

function buildWaterTownRainfallSnapshotMeta(
  selectedName: string,
  records: WaterTownMonthlyRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory: "降雨量",
    metric: "月累積雨量",
    unit: "mm",
    sourceName: "中央氣象署 CODiS 2025 年月報表、中央氣象署現存測站清單",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜地區平均月累積雨量`,
    chartData: RECENT_WATER_MONTH_LABELS.map((label) => ({
      label: formatMonthOnlyLabel(label),
      value: getRainfallValueForTownSelection(records, selectedName, label),
    })),
    createdAt: new Date().toISOString(),
  };
}

function buildRainfallTownFillMap(
  records: WaterTownMonthlyRecord[],
  selectedName: string,
  monthLabel: string,
) {
  const monthRecords = getWaterTownRecordsForMonth(records, monthLabel).filter(
    (record) =>
      selectedName === ALL_WATER_TOWNS_LABEL || record.town === selectedName,
  );

  return Object.fromEntries(
    monthRecords.map((record) => [
      record.town,
      getRainfallLevelColor(record.rainfall),
    ]),
  );
}

function getWaterRainfallStatusText(
  records: WaterTownMonthlyRecord[],
  selectedName: string,
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const monthText = formatMonthOnlyLabel(monthLabel);
  const displayName =
    selectedName === ALL_WATER_TOWNS_LABEL ? "整個苗栗縣" : selectedName;
  if (records.length === 0) {
    return `${displayName}，${monthText}的累積平均降雨量為0mm。`;
  }

  const rainfallValue = getRainfallValueForTownSelection(
    records,
    selectedName,
    monthLabel,
  );

  return `${displayName}，${monthText}的累積平均降雨量為${formatRainfallAmount(rainfallValue)}mm。`;
}

type WaterRpiRiverMonthlyRecord = {
  river: string;
  basin: string;
  month: string;
  rpi: number;
  sourceSiteCount: number;
  sourceSiteNames: string[];
  rawSiteRpiValues: string;
  processedLevel: string;
  processedMethod: string;
  dataStatus: string;
};

const ALL_WATER_RPI_LABEL = "全部河川溪流";
const WATER_RPI_RIVER_LINE_COLOR = "#0284c7";
const WATER_RPI_RIVER_LINE_WIDTH = 5.2;
const WATER_RPI_STREAM_LINE_WIDTH = 3.8;
const WATER_RPI_SUBCATEGORY_LABEL = "河川水質汙染指數(RPI)";
const LEGACY_WATER_RPI_SUBCATEGORY_LABEL = "河川水質RPI";

// 河川水質 RPI 使用專用互動式苗栗地圖。
// 鄉鎮 SHP 與 RIVERPOLY 河川 SHP 已在 data 端以同一 CRS、同一 bounds、同一 scale/offset 產生 SVG path，前端不再做座標修正。
const WATER_RPI_DEFAULT_ORDER = [
  "中港溪",
  "後龍溪",
  "西湖溪",
  "大安溪",
  "南港溪(苗)",
  "老庄溪",
];

function parseWaterRpiRiverMonthlyCsv(
  csvText: string,
): WaterRpiRiverMonthlyRecord[] {
  return parseCsvRecords(csvText)
    .map((record): WaterRpiRiverMonthlyRecord | null => {
      const river = record.river?.trim() ?? "";
      const rpi = toFiniteNumber(record.processed_value);
      if (!river || rpi === null) return null;

      return {
        river,
        basin: record.basin?.trim() ?? "",
        month: normalizeStationMonth(record.month?.trim() ?? ""),
        rpi,
        sourceSiteCount: toFiniteNumber(record.source_site_count) ?? 0,
        sourceSiteNames: splitStationList(record.source_site_names ?? ""),
        rawSiteRpiValues: record.raw_site_rpi_values?.trim() ?? "",
        processedLevel: record.processed_level?.trim() ?? "",
        processedMethod: record.processed_method?.trim() ?? "",
        dataStatus: record.data_status?.trim() ?? "",
      };
    })
    .filter((record): record is WaterRpiRiverMonthlyRecord => record !== null);
}

function getWaterRpiOptions(records: WaterRpiRiverMonthlyRecord[]) {
  const availableRivers = Array.from(
    new Set(records.map((record) => record.river)),
  );
  const orderedRivers = [
    ...WATER_RPI_DEFAULT_ORDER.filter((river) =>
      availableRivers.includes(river),
    ),
    ...availableRivers
      .filter((river) => !WATER_RPI_DEFAULT_ORDER.includes(river))
      .sort(),
  ];
  return [ALL_WATER_RPI_LABEL, ...orderedRivers];
}

function getWaterRpiRecordsForMonth(
  records: WaterRpiRiverMonthlyRecord[],
  monthLabel: string,
) {
  return records.filter((record) => record.month === monthLabel);
}

function getWaterRpiValueForSelection(
  records: WaterRpiRiverMonthlyRecord[],
  selectedName: string,
  monthLabel: string,
) {
  const monthRecords = getWaterRpiRecordsForMonth(records, monthLabel);
  if (monthRecords.length === 0) return 0;

  if (selectedName.startsWith("全部")) {
    return roundRpiValue(
      monthRecords.reduce((sum, record) => sum + record.rpi, 0) /
        Math.max(monthRecords.length, 1),
    );
  }

  const target = monthRecords.find((record) => record.river === selectedName);
  return target ? roundRpiValue(target.rpi) : 0;
}

function getActiveMonthWaterRpiStats(
  records: WaterRpiRiverMonthlyRecord[],
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const points = getWaterRpiRecordsForMonth(records, monthLabel).map(
    (record) => ({
      label: record.river,
      value: roundRpiValue(record.rpi),
    }),
  );

  if (points.length === 0) {
    return {
      maxPoint: { label: "尚無資料", value: 0 },
      minPoint: { label: "尚無資料", value: 0 },
      average: 0,
    };
  }

  const maxPoint = points.reduce((highest, point) =>
    point.value > highest.value ? point : highest,
  );
  const minPoint = points.reduce((lowest, point) =>
    point.value < lowest.value ? point : lowest,
  );
  const average = roundRpiValue(
    points.reduce((sum, point) => sum + point.value, 0) /
      Math.max(points.length, 1),
  );

  return { maxPoint, minPoint, average };
}

function buildWaterRpiSnapshotMeta(
  selectedName: string,
  subcategory: string,
  records: WaterRpiRiverMonthlyRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory,
    metric: "RPI",
    unit: "RPI",
    sourceName:
      "環境部環境資料開放平臺：河川水質監測資料 WQX_P_01；RPI公式依環境部河川污染指數說明",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜水質汙染指數RPI`,
    chartData: RECENT_WATER_MONTH_LABELS.map((label) => ({
      label: formatMonthOnlyLabel(label),
      value: getWaterRpiValueForSelection(records, selectedName, label),
    })),
    createdAt: new Date().toISOString(),
  };
}

function getWaterRpiStatusText(
  records: WaterRpiRiverMonthlyRecord[],
  selectedName: string,
  activeIndex: number,
) {
  const monthLabel =
    RECENT_WATER_MONTH_LABELS[activeIndex] ?? LATEST_WATER_DATA_MONTH;
  const monthText = formatMonthOnlyLabel(monthLabel);
  if (records.length === 0) {
    return "目前正在讀取環境部河川水質監測資料整理後的RPI資料。";
  }

  if (selectedName.startsWith("全部")) {
    const stats = getActiveMonthWaterRpiStats(records, activeIndex);
    return `${monthText} 顯示各河川／溪流平均 RPI=${formatRpiNumber(stats.average)}；最高為 ${stats.maxPoint.label} RPI=${formatRpiNumber(stats.maxPoint.value)}，最低為 ${stats.minPoint.label} RPI=${formatRpiNumber(stats.minPoint.value)}。`;
  }

  const target = records.find(
    (record) => record.river === selectedName && record.month === monthLabel,
  );
  if (!target) return `${selectedName} 在 ${monthText} 尚無可用RPI資料。`;
  const level = target.processedLevel || getRpiLevel(target.rpi).label;
  return `${selectedName} 在 ${monthText} 的平均 RPI=${formatRpiNumber(target.rpi)}，屬於「${level}」。`;
}

function getWaterRpiMapOverlay(
  selectedName: string,
  records: WaterRpiRiverMonthlyRecord[],
  monthLabel: string,
) {
  const selectedRiver = selectedName.startsWith("全部") ? "" : selectedName;
  const shapes = selectedRiver
    ? WATER_RPI_GIS_RIVER_SHAPES.filter(
        (shape) => shape.label === selectedRiver,
      )
    : WATER_RPI_GIS_RIVER_SHAPES;
  const monthRecords = getWaterRpiRecordsForMonth(records, monthLabel);

  const getShapeValue = (label: string) => {
    const matchedRecord = monthRecords.find((record) => record.river === label);
    return matchedRecord ? roundRpiValue(matchedRecord.rpi) : null;
  };

  return {
    paths: [],
    areas: shapes.flatMap((shape) => {
      const value = getShapeValue(shape.label);
      const level = value === null ? null : getRpiLevel(value);
      return shape.paths.map((d, pathIndex) => ({
        id: `${shape.id}-area-${pathIndex}`,
        d,
        color: level?.color ?? "#e5e7eb",
        strokeColor: WATER_RPI_RIVER_LINE_COLOR,
        strokeWidth:
          shape.kind === "river"
            ? WATER_RPI_RIVER_LINE_WIDTH / 12.5
            : WATER_RPI_STREAM_LINE_WIDTH / 11.2,
        opacity:
          selectedRiver && shape.label !== selectedRiver
            ? 0.18
            : value === null
              ? 0.36
              : 0.86,
      }));
    }),
    markers: shapes.map((shape) => {
      const value = getShapeValue(shape.label);
      return {
        id: `${shape.id}-marker`,
        label:
          value === null
            ? `${shape.label} 無RPI資料`
            : `${shape.label} RPI=${formatRpiNumber(value)}`,
        x: shape.x,
        y: shape.y,
        color: WATER_RPI_RIVER_LINE_COLOR,
        kind: shape.kind,
        selected: selectedRiver === shape.label,
        selectValue: shape.label,
        labelDx: shape.labelDx,
        labelDy: shape.labelDy,
        labelAnchor: shape.labelAnchor,
        labelWidth: shape.labelWidth,
      };
    }),
  };
}

type WaterQualityStationStatusRecord = {
  siteId: string;
  siteName: string;
  county: string;
  township: string;
  basin: string;
  river: string;
  longitude: number;
  latitude: number;
  mapX: number;
  mapY: number;
  siteAddress: string;
  statusOfUse: string;
  statusCode: string;
  processedMethod: string;
};

const ALL_WATER_QUALITY_STATIONS_LABEL = "全地區";

async function fetchCsvText(path: string, label: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    throw new Error(`${label}讀取失敗：${response.status}`);
  }
  return response.text();
}

function parseWaterQualityStationStatusCsv(
  csvText: string,
): WaterQualityStationStatusRecord[] {
  return parseCsvRecords(csvText)
    .map((record): WaterQualityStationStatusRecord | null => {
      const siteId = record.site_id?.trim() ?? "";
      const siteName = record.site_name?.trim() ?? "";
      const longitude = toFiniteNumber(record.longitude);
      const latitude = toFiniteNumber(record.latitude);
      const mapX = toFiniteNumber(record.map_x);
      const mapY = toFiniteNumber(record.map_y);
      if (
        !siteId ||
        !siteName ||
        longitude === null ||
        latitude === null ||
        mapX === null ||
        mapY === null
      ) {
        return null;
      }

      return {
        siteId,
        siteName,
        county: record.county?.trim() ?? "",
        township: record.township?.trim() ?? "",
        basin: record.basin?.trim() ?? "",
        river: record.river?.trim() ?? "",
        longitude,
        latitude,
        mapX,
        mapY,
        siteAddress: record.site_address?.trim() ?? "",
        statusOfUse: record.status_of_use?.trim() ?? "",
        statusCode: record.status_code?.trim() ?? "",
        processedMethod: record.processed_method?.trim() ?? "",
      };
    })
    .filter(
      (record): record is WaterQualityStationStatusRecord => record !== null,
    );
}

function getWaterQualityStationOptions() {
  return INTERACTIVE_TOWN_OPTIONS;
}

function filterWaterQualityStationsByTown(
  records: WaterQualityStationStatusRecord[],
  selectedTown: string,
) {
  if (selectedTown === ALL_WATER_QUALITY_STATIONS_LABEL) return records;
  return records.filter((record) => record.township === selectedTown);
}

function getWaterQualityStationSummary(
  records: WaterQualityStationStatusRecord[],
  selectedTown = ALL_WATER_QUALITY_STATIONS_LABEL,
) {
  const targetRecords = filterWaterQualityStationsByTown(records, selectedTown);
  const active = targetRecords.filter(
    (record) => record.statusOfUse === "啟用",
  ).length;
  const inactive = targetRecords.filter(
    (record) => record.statusOfUse === "停用",
  ).length;
  return { total: targetRecords.length, active, inactive };
}

function getWaterQualityStationStatusColor(
  record: WaterQualityStationStatusRecord,
) {
  if (record.statusOfUse === "啟用") return "#22c55e";
  if (record.statusOfUse === "停用") return "#ef4444";
  return "#94a3b8";
}

function getWaterQualityStationMapOverlay(
  selectedName: string,
  records: WaterQualityStationStatusRecord[],
) {
  const selectedRecords = filterWaterQualityStationsByTown(
    records,
    selectedName,
  );
  const shouldShowLabels = selectedName !== ALL_WATER_QUALITY_STATIONS_LABEL;
  const mapWidth = 380;
  const mapHeight = 300;
  const labelPadding = 5;
  const labelFontSize = 8.6;
  const labelHeight = labelFontSize + 9;
  const stationDotRadius = 7.2;
  const reservedLabelBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  const stationDotBoxes = selectedRecords.map((record) => ({
    id: record.siteId,
    x: record.mapX - stationDotRadius,
    y: record.mapY - stationDotRadius,
    width: stationDotRadius * 2,
    height: stationDotRadius * 2,
  }));
  const stationLabelCandidates = [
    { dx: 92, dy: -42 },
    { dx: -92, dy: -42 },
    { dx: 92, dy: 46 },
    { dx: -92, dy: 46 },
    { dx: 118, dy: -10 },
    { dx: -118, dy: -10 },
    { dx: 118, dy: 28 },
    { dx: -118, dy: 28 },
    { dx: 0, dy: -72 },
    { dx: 0, dy: 76 },
    { dx: 132, dy: -60 },
    { dx: -132, dy: -60 },
    { dx: 132, dy: 64 },
    { dx: -132, dy: 64 },
    { dx: 156, dy: -28 },
    { dx: -156, dy: -28 },
    { dx: 156, dy: 34 },
    { dx: -156, dy: 34 },
  ];
  const boxesOverlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
    gap = 5,
  ) =>
    !(
      a.x + a.width + gap < b.x ||
      b.x + b.width + gap < a.x ||
      a.y + a.height + gap < b.y ||
      b.y + b.height + gap < a.y
    );
  const overlapArea = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => {
    const overlapWidth = Math.max(
      0,
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
    );
    return overlapWidth * overlapHeight;
  };
  const overlapScore = (
    box: { x: number; y: number; width: number; height: number },
    record: WaterQualityStationStatusRecord,
  ) => {
    const labelOverlap = reservedLabelBoxes.reduce(
      (score, reserved) => score + overlapArea(box, reserved) * 8,
      0,
    );
    const dotOverlap = stationDotBoxes.reduce(
      (score, dot) => score + overlapArea(box, dot) * 16,
      0,
    );
    const distancePenalty =
      Math.hypot(
        box.x + box.width / 2 - record.mapX,
        box.y + box.height / 2 - record.mapY,
      ) * 0.02;
    return labelOverlap + dotOverlap + distancePenalty;
  };
  const clampLabel = (
    record: WaterQualityStationStatusRecord,
    width: number,
    dx: number,
    dy: number,
  ) => {
    const x = Math.min(
      mapWidth - width / 2 - labelPadding,
      Math.max(width / 2 + labelPadding, record.mapX + dx),
    );
    const y = Math.min(
      mapHeight - labelPadding - labelHeight / 2,
      Math.max(labelPadding + labelHeight / 2, record.mapY + dy),
    );
    return {
      x,
      y,
      box: {
        x: x - width / 2,
        y: y - labelHeight / 2,
        width,
        height: labelHeight,
      },
    };
  };

  return {
    paths: [],
    areas: [],
    markers: selectedRecords.map((record) => {
      const labelWidth = 122;
      const candidates = stationLabelCandidates
        .map((candidate) =>
          clampLabel(record, labelWidth, candidate.dx, candidate.dy),
        )
        .sort(
          (a, b) => overlapScore(a.box, record) - overlapScore(b.box, record),
        );
      const selectedLabel =
        candidates.find(
          (candidate) =>
            reservedLabelBoxes.every(
              (reserved) => !boxesOverlap(candidate.box, reserved, 6),
            ) &&
            stationDotBoxes.every(
              (dot) => !boxesOverlap(candidate.box, dot, 6),
            ),
        ) ??
        candidates.find((candidate) =>
          stationDotBoxes.every((dot) => !boxesOverlap(candidate.box, dot, 3)),
        ) ??
        candidates[0] ??
        clampLabel(record, labelWidth, 0, -72);
      if (shouldShowLabels) reservedLabelBoxes.push(selectedLabel.box);

      return {
        id: `water-quality-station-${record.siteId}`,
        label: record.siteName,
        selectValue: record.township || selectedName,
        x: record.mapX,
        y: record.mapY,
        color: getWaterQualityStationStatusColor(record),
        kind: "station" as const,
        selected: false,
        hideLabel: !shouldShowLabels,
        labelDx: selectedLabel.x - record.mapX,
        labelDy: selectedLabel.y - record.mapY,
        labelAnchor: "middle" as const,
        labelWidth,
      };
    }),
  };
}

function getWaterQualityStationStatusText(
  records: WaterQualityStationStatusRecord[],
  selectedName: string,
) {
  if (records.length === 0) return "目前正在讀取環境部河川水質測點基本資料。";
  const summary = getWaterQualityStationSummary(records, selectedName);
  if (selectedName === ALL_WATER_QUALITY_STATIONS_LABEL) {
    return `目前顯示全地區水質監測站，共 ${summary.total} 站，其中啟用 ${summary.active} 站、停用 ${summary.inactive} 站。`;
  }
  return `${selectedName} 目前水質監測站數為 ${summary.total}，其中啟用 ${summary.active} 站、停用 ${summary.inactive} 站。`;
}

function buildWaterQualityStationSnapshotMeta(
  selectedName: string,
  records: WaterQualityStationStatusRecord[],
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS.water;
  const summary = getWaterQualityStationSummary(records, selectedName);
  return {
    townName: selectedName,
    category: "water",
    categoryLabel: categoryMetaMap.water.label,
    subcategory: "水質監測站",
    metric: "測站啟停用狀態",
    unit: "站",
    sourceName: "環境部環境資料開放平臺：河川水質測點基本資料 WQX_P_06",
    sourceUrl: options.sourceUrl,
    filterLabel: `${selectedName}｜水質監測站`,
    chartData: [
      { label: "啟用", value: summary.active },
      { label: "停用", value: summary.inactive },
    ],
    createdAt: new Date().toISOString(),
  };
}

const INTERACTIVE_DATA_OPTIONS: Record<
  CategoryKey,
  {
    subcategories: string[];
    metrics: string[];
    unit: string;
    sourceName: string;
    sourceUrl: string;
  }
> = {
  water: {
    subcategories: ["降雨量", WATER_RPI_SUBCATEGORY_LABEL, "水質監測站"],
    metrics: ["月雨量平均", "RPI", "測站狀態"],
    unit: "mm",
    sourceName: "中央氣象署、data.gov.tw、環境部環境資料開放平臺",
    sourceUrl:
      "https://data.gov.tw/dataset/9177；https://data.moenv.gov.tw/dataset/detail/WQX_P_01；https://data.moenv.gov.tw/dataset/detail/WQX_P_06",
  },
  land: {
    subcategories: ["人口壓力", "土地面積", "耕地面積", "開發壓力"],
    metrics: ["人口數", "人口密度", "耕地面積比", "開發壓力指標"],
    unit: "人 / % / 指標值",
    sourceName: "苗栗縣政府資料開放平臺、苗栗縣統計資訊服務網",
    sourceUrl:
      "https://data.gov.tw/dataset/177442；https://miaoli.dgbas.gov.tw/",
  },
  leopard: {
    subcategories: ["出沒網格", "潛在棲地", "路殺風險", "相機監測"],
    metrics: ["有紀錄網格", "棲地適合度", "道路風險", "監測紀錄"],
    unit: "格 / 指標值",
    sourceName: "苗栗縣政府農業處、林業及自然保育署",
    sourceUrl:
      "https://www.miaoli.gov.tw/agriculture/News_Content.aspx?n=5787&s=567043",
  },
  rumor: {
    subcategories: ["地方通報", "禽舍衝突", "遊蕩犬貓", "社區巡守"],
    metrics: ["通報件數", "衝突強度", "共域指標", "巡守紀錄"],
    unit: "件 / 指標值",
    sourceName: "113年苗栗縣瀕危物種及重要棲地生態服務給付推動計畫",
    sourceUrl: "https://ecollect.forest.gov.tw/",
  },
  other: {
    subcategories: ["補充資料", "人力與資源"],
    metrics: ["補充線索", "投入面向"],
    unit: "張 / 類型",
    sourceName: "遊戲內全域卡牌資料",
    sourceUrl: "public/card/Global_Card",
  },
};

const WATER_STATION_OPTIONS = [ALL_WATER_QUALITY_STATIONS_LABEL];

function getWaterSelectionStatusText(
  subcategory: string,
  selectedName: string,
  _metric: string,
  _activeIndex: number,
) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    if (selectedName.startsWith("全部")) {
      return "目前正在讀取環境部河川水質監測資料整理後的RPI資料。";
    }
    return `${selectedName} 目前尚無可用RPI資料。`;
  }
  if (subcategory === "水質監測站") {
    if (selectedName === WATER_STATION_OPTIONS[0]) {
      return "目前顯示全地區水質監測站，學生可以先看各區域測站分布，再點選地區查看該區域清單。";
    }
    return `${selectedName}會依照資料中的水質監測站位置，顯示該區域的監測站總數與啟停用狀態。`;
  }
  return `${selectedName} 目前尚無可用水資源資料。`;
}

function getWaterMetricForSubcategory(subcategory: string) {
  if (subcategory === "降雨量") return "月累積雨量";
  if (subcategory === "水質監測站") return "測站狀態";
  return "RPI";
}

function getWaterSelectionConfig(subcategory: string) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    return {
      label: "河川／溪流選擇",
      options: [ALL_WATER_RPI_LABEL],
      allLabel: ALL_WATER_RPI_LABEL,
    };
  }
  if (subcategory === "水質監測站") {
    return {
      label: "地區選擇",
      options: INTERACTIVE_TOWN_OPTIONS,
      allLabel: ALL_WATER_QUALITY_STATIONS_LABEL,
    };
  }
  return {
    label: "地區選擇",
    options: INTERACTIVE_TOWN_OPTIONS,
    allLabel: ALL_WATER_TOWNS_LABEL,
  };
}

function getWaterMapOverlay(
  subcategory: string,
  selectedName: string,
  rpiSnapshotValues?: Record<string, number>,
) {
  if (
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染"
  ) {
    const selectedRiver = selectedName.startsWith("全部") ? "" : selectedName;
    const shapes = selectedRiver
      ? WATER_RPI_GIS_RIVER_SHAPES.filter(
          (shape) => shape.label === selectedRiver,
        )
      : WATER_RPI_GIS_RIVER_SHAPES;

    return {
      paths: [],
      areas: shapes.flatMap((shape) => {
        const value = rpiSnapshotValues?.[shape.label] ?? null;
        const level = value === null ? null : getRpiLevel(value);
        return shape.paths.map((d, pathIndex) => ({
          id: `${shape.id}-snapshot-area-${pathIndex}`,
          d,
          color: level?.color ?? "#e5e7eb",
          strokeColor: WATER_RPI_RIVER_LINE_COLOR,
          strokeWidth:
            shape.kind === "river"
              ? WATER_RPI_RIVER_LINE_WIDTH / 12.5
              : WATER_RPI_STREAM_LINE_WIDTH / 11.2,
          opacity: value === null ? 0.36 : 0.86,
        }));
      }),
      markers: shapes.map((shape) => {
        const value = rpiSnapshotValues?.[shape.label] ?? null;
        return {
          id: `${shape.id}-snapshot-marker`,
          label:
            value === null
              ? `${shape.label} 無RPI資料`
              : `${shape.label} RPI=${formatRpiNumber(value)}`,
          x: shape.x,
          y: shape.y,
          color: WATER_RPI_RIVER_LINE_COLOR,
          kind: shape.kind,
          selected: selectedRiver === shape.label,
          selectValue: shape.label,
          labelDx: shape.labelDx,
          labelDy: shape.labelDy,
          labelAnchor: shape.labelAnchor,
          labelWidth: shape.labelWidth,
        };
      }),
    };
  }
  if (subcategory === "水質監測站") {
    return { paths: [], areas: [], markers: [] };
  }
  return { paths: [], areas: [], markers: [] };
}

function getWaterChartLabels(subcategory: string, selectedName: string) {
  if (subcategory === "降雨量")
    return RECENT_WATER_MONTH_LABELS.map(formatMonthOnlyLabel);
  if (subcategory === "水質監測站")
    return ["監測正常", "資料完整", "近水系", "可比對", "需複查", "即時性"];
  if (selectedName.startsWith("全部")) {
    return WATER_RPI_DEFAULT_ORDER;
  }
  return RECENT_WATER_MONTH_LABELS;
}

function getInteractiveSelectorOptions(
  category: CategoryKey,
  subcategory: string,
) {
  if (category === "water") return getWaterSelectionConfig(subcategory).options;
  return INTERACTIVE_TOWN_OPTIONS;
}

function isTownSelection(category: CategoryKey, subcategory: string) {
  return (
    category !== "water" ||
    subcategory === "降雨量" ||
    subcategory === "水質監測站"
  );
}

function isWaterTimeSeries(subcategory: string, selectedName: string) {
  return (
    subcategory === "降雨量" ||
    subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
    subcategory === "河川污染" ||
    subcategory === "溪流污染" ||
    (!selectedName.startsWith("全部") && subcategory !== "水質監測站")
  );
}

function isWaterSeasonalRainfall(category: CategoryKey, subcategory: string) {
  return category === "water" && subcategory === "降雨量";
}

function isWaterRpiMap(category: CategoryKey, subcategory: string) {
  return (
    category === "water" &&
    (subcategory === WATER_RPI_SUBCATEGORY_LABEL ||
      subcategory === LEGACY_WATER_RPI_SUBCATEGORY_LABEL ||
      subcategory === "河川污染" ||
      subcategory === "溪流污染")
  );
}

function isWaterStationMap(category: CategoryKey, subcategory: string) {
  return category === "water" && subcategory === "水質監測站";
}

function isCategoryKey(value: unknown): value is CategoryKey {
  return (
    typeof value === "string" && CATEGORY_KEYS.includes(value as CategoryKey)
  );
}

function shouldUseWaterLiveSnapshotPreview(
  card?: {
    imageSrc?: unknown;
    snapshotMeta?: EvidenceSnapshotMeta | null;
  } | null,
) {
  return (
    isWaterLiveSnapshotMeta(card?.snapshotMeta) &&
    !getPersistableImageSrc(card?.imageSrc)
  );
}

function getDraftImageSrc(card: GameCard) {
  // localStorage 容量很小，探究草稿不能存任何 data URL 圖片。
  // 但後端已存好的 /uploads 快照 URL 很小，可以保留，讓重新整理後仍能顯示同一張 webp。
  const imageSrc = getPersistableImageSrc(card.imageSrc);
  if (imageSrc.startsWith("data:image/")) return "";
  return imageSrc;
}

function getCompactStoredUnlockedCard(
  card: StoredUnlockedCard,
): StoredUnlockedCard | string {
  if (card.sourceType !== "interactiveSnapshot") return card.id;
  return {
    id: card.id,
    content: card.content,
    unlockedAt: card.unlockedAt,
    unlockedInInquiryOrder: card.unlockedInInquiryOrder,
    localId: card.localId,
    category: card.category,
    title: card.title,
    revealedTitle: card.revealedTitle,
    imageSrc: getPersistableImageSrc(card.imageSrc),
    sourceType: card.sourceType,
    snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
    unlocked: card.unlocked,
    sharedFromOtherPlayer: card.sharedFromOtherPlayer,
    sharedAuthorName: card.sharedAuthorName,
  };
}

function getCompactEvidenceCardSummary(card: GameCard): EvidenceCardSummary {
  return {
    id: card.id,
    title: card.revealedTitle,
    imageSrc: getPersistableImageSrc(card.imageSrc),
    content: card.content,
    category: card.category,
    sourceType: card.sourceType,
    snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
  };
}

function serializeUnlockedCard(
  card: GameCard,
  unlockedInInquiryOrder: number,
): StoredUnlockedCard {
  return {
    id: card.id,
    content: card.content,
    unlockedAt: toIsoTimestamp(card.unlockedAt) ?? nowIsoTimestamp(),
    unlockedInInquiryOrder,
    localId: card.localId,
    category: card.category,
    title: card.title,
    revealedTitle: card.revealedTitle,
    // 互動快照卡的 imageSrc 是由 snapshotMeta 產生的輕量 SVG data URL，
    // 下方數據列表、調查書選證據與首頁證據區都沿用這一張圖。
    imageSrc: getPersistableImageSrc(card.imageSrc),
    sourceType: card.sourceType ?? "fixedImage",
    snapshotMeta: card.snapshotMeta,
    unlocked: card.unlocked,
    sharedFromOtherPlayer: card.sharedFromOtherPlayer,
    sharedAuthorName: card.sharedAuthorName,
  };
}

function getStableInteractiveValue(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
  index: number,
) {
  const key = `${category}-${townName}-${subcategory}-${metric}-${index}`;
  const seed = Array.from(key).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  if (category === "water") return 0;
  if (category === "land") return 12 + ((seed * 5 + index * 17) % 78);
  if (category === "leopard") return 3 + ((seed * 3 + index * 11) % 31);
  return 2 + ((seed * 2 + index * 13) % 45);
}

function getInteractiveValueForSelection(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
  index: number,
) {
  if (townName !== ALL_TOWNS_LABEL) {
    return getStableInteractiveValue(
      category,
      townName,
      subcategory,
      metric,
      index,
    );
  }

  const values = MIAOLI_TOWNS.map((town) =>
    getStableInteractiveValue(category, town, subcategory, metric, index),
  );
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1),
  );
}

function getInteractiveUnit(category: CategoryKey, metric: string) {
  if (category !== "water") return INTERACTIVE_DATA_OPTIONS[category].unit;
  if (metric === "月雨量平均" || metric === "月累積雨量") return "mm";
  if (metric === "RPI") return "RPI";
  return "%";
}

function buildInteractiveSnapshotMeta(
  category: CategoryKey,
  townName: string,
  subcategory: string,
  metric: string,
): EvidenceSnapshotMeta {
  const options = INTERACTIVE_DATA_OPTIONS[category];
  const labels =
    category === "water"
      ? getWaterChartLabels(subcategory, townName)
      : ["指標1", "指標2", "指標3", "指標4", "指標5", "指標6"];

  return {
    townName,
    category,
    categoryLabel: categoryMetaMap[category].label,
    subcategory,
    metric,
    unit: getInteractiveUnit(category, metric),
    sourceName: options.sourceName,
    sourceUrl: options.sourceUrl,
    filterLabel: `${townName}｜${categoryMetaMap[category].label}｜${subcategory}｜${metric}`,
    chartData: labels.map((label, index) => ({
      label,
      value: getInteractiveValueForSelection(
        category,
        townName,
        subcategory,
        metric,
        index,
      ),
    })),
    createdAt: new Date().toISOString(),
  };
}

const WATER_UNIFIED_CARD = {
  shell:
    "rounded-[24px] border border-[#d7e7f0] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,251,255,1)_100%)] shadow-inner",
  panel: "rounded-[18px] border border-[#d6e8f2] bg-[#f4faff]",
  panelSoft: "rounded-[18px] border border-[#d6e8f2] bg-[#f8fcff]",
  inset: "rounded-xl border border-[#dce9f2] bg-white/92",
  chartFrame:
    "rounded-2xl border border-[#dce9f2] bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
  stat: "rounded-xl border border-[#dce9f2] bg-white/90",
  statStatus: "rounded-xl border border-[#dce9f2] bg-white/90",
  empty: "rounded-2xl border border-dashed border-[#b8dcec] bg-white/78",
  listItem:
    "rounded-xl border border-[#dce9f2] bg-white/88 shadow-[0_4px_12px_rgba(14,116,144,0.05)]",
  header: "bg-[#f3faff] border-b border-[#d9e7f0]",
  heading: "text-[#7b5b37]",
  mutedText: "text-slate-500",
  bodyText: "text-[#244f66]",
  titleText: "text-[#1f3442]",
  badge: "bg-sky-100 text-sky-800",
  timelineButton:
    "rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 transition hover:bg-sky-200",
  timelineChipActive: "bg-sky-100 text-sky-800",
  timelineChipIdle: "text-[#5f7f91] hover:bg-sky-50",
  statLabel: "text-[9px] font-black tracking-[0.1em] text-[#6b8798]",
  statValue: "mt-0.5 text-sm font-black text-[#1f3442]",
  statusDotBase:
    "inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow",
  statusActiveText: "text-emerald-700",
  statusInactiveText: "text-rose-700",
  statusActiveSoft: "bg-emerald-50/70 text-emerald-700",
  statusInactiveSoft: "bg-rose-50/70 text-rose-700",
};

const EVIDENCE_CREATOR_THEME = {
  section: "border-[#e2d4bd] bg-[#fffaf0]/96",
  badge: "border border-[#ead7b2] bg-[#fff2d8] text-[#7b5b37]",
  primaryButton:
    "rounded-2xl border border-[#c89a3a] bg-[#c89a3a] px-5 py-3 font-black text-white shadow-[0_7px_0_rgba(200,154,58,0.18)] hover:bg-[#b98b2b]",
  surface:
    "shrink-0 rounded-[28px] border border-[#e2d4bd] bg-[#fff7ea] p-4 shadow-[0_12px_28px_rgba(45,41,34,0.06)]",
  sectionPanel: "rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0]",
  header: "border-b border-[#eadfcf] bg-[#fff3dc]",
  heading: "text-[#7b5b37]",
  titleText: "text-[#332c24]",
  bodyText: "text-[#6d5e49]",
  badgeSoft: "bg-[#fff0cf] text-[#7b5b37]",
  toggleButton:
    "rounded-full border border-[#d8cbb3] bg-[#fffdf8] px-2.5 py-1 text-[10px] font-black text-[#5f5545] transition hover:border-[#c89a3a] hover:bg-[#fff1d6]",
  infoPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff7ea]",
  inset: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  chartFrame:
    "rounded-2xl border border-[#eadfcf] bg-[#fffdf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
  statusBox: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  listPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff8ef]",
  listItem:
    "rounded-xl border border-[#eadfcf] bg-[#fffdf8] shadow-[0_4px_12px_rgba(140,108,54,0.06)]",
  timelineButton:
    "rounded-full border border-[#d8cbb3] bg-[#fff0cf] px-3 py-1 text-xs font-black text-[#7b5b37] transition hover:bg-[#ffe6b2]",
  timelineChipActive: "bg-[#fff0cf] text-[#7b5b37]",
  timelineChipIdle: "text-[#7a6754] hover:bg-[#fff4df]",
  textarea:
    "min-h-[128px] rounded-2xl border border-[#d8cbb3] bg-[#fffdf8] px-3 py-3 text-sm font-medium leading-6 text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#9b7b55] focus:ring-4 focus:ring-[#ead7b2]/35",
  helperBox:
    "rounded-2xl border border-[#e2d4bd] bg-[#fff7ea] px-4 py-3 text-sm font-black text-stone-600",
  modalShell:
    "grid max-h-[calc(100svh-2rem)] w-full max-w-[78rem] grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] gap-3 overflow-x-auto overflow-y-auto rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0] p-3 shadow-[0_24px_80px_rgba(45,41,34,0.22)]",
  previewFrame:
    "flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[22px] border border-[#e2d4bd] bg-[#fff7ea] p-2",
  previewImage:
    "max-h-[68svh] max-w-full rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] object-contain",
  secondaryButton:
    "rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:bg-[#9b3b3b]",
  confirmButton:
    "rounded-xl border border-[#c89a3a] bg-[#c89a3a] px-5 py-3 text-white transition hover:bg-[#b98b2b] disabled:cursor-not-allowed disabled:border-[#f0e0b9] disabled:bg-[#f5e9cf] disabled:text-[#c3aa71] disabled:opacity-100",
  captureAccent: "rgba(236, 201, 118, 0.5)",
};

const snapshotBuilderDependencies: SnapshotBuilderDependencies = {
  allTownsLabel: ALL_TOWNS_LABEL,
  allWaterQualityStationsLabel: ALL_WATER_QUALITY_STATIONS_LABEL,
  regions,
  labelPositions,
  getWaterMapOverlay,
  getWaterQualityStationMapOverlay,
};

function buildSnapshotSvgDataUrl(meta: EvidenceSnapshotMeta) {
  return buildSnapshotSvgDataUrlFromBuilder(meta, snapshotBuilderDependencies);
}

function normalizeDraftCards(savedCards?: Partial<GameCard>[]): GameCard[] {
  const baseCards = createAllCards();
  if (!Array.isArray(savedCards) || savedCards.length === 0) return baseCards;

  const baseById = new Map(baseCards.map((card) => [card.id, card]));
  const savedById = new Map(
    savedCards
      .filter(
        (card): card is Partial<GameCard> & { id: string } =>
          typeof card?.id === "string",
      )
      .map((card) => [card.id, card]),
  );

  const mergedBaseCards = baseCards.map((card) => {
    const saved = savedById.get(card.id);
    if (!saved) return card;

    return {
      ...card,
      content: getStoredCardContent(saved) || card.content,
      unlocked: Boolean(saved.unlocked),
      unlockedAt: toIsoTimestamp(saved.unlockedAt) ?? card.unlockedAt,
      imageSrc: getStoredCardImage(saved) || card.imageSrc,
      sourceType: getStoredCardSource<EvidenceSourceType>(saved) ?? card.sourceType ?? "fixedImage",
      snapshotMeta: getStoredCardSnapshot<EvidenceSnapshotMeta>(saved) ?? card.snapshotMeta,
      sharedFromOtherPlayer:
        saved.sharedFromOtherPlayer ?? card.sharedFromOtherPlayer,
      sharedAuthorName: saved.sharedAuthorName ?? card.sharedAuthorName,
    };
  });

  const dynamicCards = savedCards
    .filter((card) => typeof card?.id === "string" && !baseById.has(card.id))
    .map((card) =>
      createCardFromStoredSnapshotCard(card as StoredUnlockedCard, {
        buildSnapshotSvgDataUrl,
        isCategoryKey,
      }) as GameCard | null,
    )
    .filter((card): card is GameCard => Boolean(card));

  return [...mergedBaseCards, ...dynamicCards];
}

function getCompactDraftCards(cards: GameCard[]): GameCard[] {
  return cards
    .filter((card) => card.unlocked || card.content.trim())
    .map((card) => ({
      ...card,
      imageSrc: getDraftImageSrc(card),
      snapshotMeta: stripLargeSnapshotPayload(card.snapshotMeta),
    }));
}

function readInquiryDataDraft(
  storageKey?: string,
  expectedInquiryOrder?: number,
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

function InquiryPurposePage({
  currentInquiryOrder,
  onSelect,
  onBack,
}: {
  selectedPurpose: InquiryPurpose;
  currentInquiryOrder: number;
  onSelect: (purpose: InquiryPurpose) => void;
  onBack?: () => void;
}) {
  const currentCase = getInvestigationCaseByOrder(currentInquiryOrder);
  const safeOrder = Math.max(1, Number(currentInquiryOrder || 1));
  const isFreeInquiry = safeOrder > 4;
  const storyParagraphs = currentCase.storyParagraphs;

  const handleNext = () => {
    if (safeOrder === 2) {
      onSelect("task2");
      return;
    }

    if (isFreeInquiry) {
      onSelect("free");
      return;
    }

    onSelect("");
  };

  return (
    <div className="game-adventure-page uiux-page-shell inquiry-intro-shell flex min-h-[100svh] items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <motion.div
        layout
        transition={{ layout: { duration: 0.34, ease: "easeInOut" } }}
        className="game-stage-card inquiry-intro-card w-full max-w-2xl rounded-[34px] p-8 text-center"
      >
        {isFreeInquiry ? (
          <p className="mb-2 text-sm font-black tracking-[0.18em] text-stone-500">
            延伸探究
          </p>
        ) : null}
        <h2 className="mb-2 text-3xl font-black text-stone-800">
          {currentCase.title}
        </h2>
        <p className="text-base font-black tracking-[0.16em] text-[#8b6f45]">
          {currentCase.storyTitle}
        </p>
        <div className="mx-auto mt-5 max-w-xl rounded-3xl border border-stone-200 bg-stone-50 px-6 py-5 text-center text-base font-bold leading-8 text-stone-700">
          {storyParagraphs.map((paragraph, index) => (
            <p
              key={`${currentCase.id}-story-${index}`}
              className={index > 0 ? "mt-3" : ""}
            >
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#d9c7a4] bg-gradient-to-br from-white via-[#fff8e8] to-[#f1e1bd] px-5 font-black text-[#6b5634] shadow-[0_8px_0_rgba(161,130,83,0.16),0_14px_28px_rgba(88,67,38,0.12)] transition hover:-translate-y-0.5 hover:border-[#c19a5d] hover:brightness-[1.02] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 sm:w-40"
          >
            上一頁
          </button>
          <IntroCountdownButton
            resetKey={`purpose-${currentInquiryOrder}-${currentCase.id}`}
            onClick={handleNext}
            className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#9f8768] bg-gradient-to-br from-[#fff1bf] via-[#eacb86] to-[#cfa464] px-5 font-black text-[#3f3023] shadow-[0_8px_0_rgba(112,89,65,0.24),0_16px_30px_rgba(72,52,36,0.18)] transition hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 sm:w-40"
          >
            下一步
          </IntroCountdownButton>
        </div>
      </motion.div>
    </div>
  );
}

function InquiryIntroExpandablePanel({
  show,
  panelKey,
  className,
  children,
}: {
  show: boolean;
  panelKey: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence initial={false} mode="sync">
      {show ? (
        <motion.div
          key={panelKey}
          layout="position"
          initial={{ height: 0, opacity: 0, y: -6, marginTop: 0 }}
          animate={{ height: "auto", opacity: 1, y: 0, marginTop: 24 }}
          exit={{ height: 0, opacity: 0, y: -4, marginTop: 0 }}
          transition={{
            height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            marginTop: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.16, ease: "easeOut" },
            y: { duration: 0.2, ease: "easeOut" },
          }}
          style={{ overflow: "hidden", transformOrigin: "top center" }}
          className={className}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function InquiryFollowUpPage({
  purpose,
  currentInquiryOrder,
  selectedSuspects,
  task3Targets,
  suspectReason,
  suspectOtherDraft,
  suspectOtherText,
  task3OtherDraft,
  possibleCrisis,
  otherPurpose,
  onPurposeChange,
  onToggleSuspect,
  onToggleTask3Target,
  onSuspectReasonChange,
  onSuspectOtherDraftChange,
  onSuspectOtherTextChange,
  onTask3OtherDraftChange,
  onTask3OtherTextChange,
  onPossibleCrisisChange,
  onOtherPurposeChange,
  onBack,
  onNext,
}: {
  purpose: InquiryPurpose;
  currentInquiryOrder: number;
  selectedSuspects: string[];
  task3Targets: string[];
  suspectReason: string;
  suspectOtherDraft: string;
  suspectOtherText: string;
  task3OtherDraft: string;
  possibleCrisis: string;
  otherPurpose: string;
  onPurposeChange: (purpose: InquiryPurpose) => void;
  onToggleSuspect: (groupId: string) => void;
  onToggleTask3Target: (targetId: string) => void;
  onSuspectReasonChange: (value: string) => void;
  onSuspectOtherDraftChange: (value: string) => void;
  onSuspectOtherTextChange: (value: string) => void;
  onTask3OtherDraftChange: (value: string) => void;
  onTask3OtherTextChange: (value: string) => void;
  onPossibleCrisisChange: (value: string) => void;
  onOtherPurposeChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const safeOrder = Math.max(1, Number(currentInquiryOrder || 1));
  const currentCase = getInvestigationCaseByOrder(currentInquiryOrder);
  const isTask1 = safeOrder === 1;
  const isTask1Idea = isTask1 && purpose === "task1_yes";
  const isTask2 = safeOrder === 2;
  const isTask3 = safeOrder === 3;
  const isTask3Other = isTask3 && task3Targets.includes("other");
  const isTask4 = safeOrder === 4;
  const isFreeInquiry = safeOrder > 4;
  const [isEditingSuspectOther, setIsEditingSuspectOther] = useState(false);
  const isTask2OtherSelected = isTask2 && selectedSuspects.includes("other");
  const confirmedSuspectOtherText = suspectOtherText.trim();
  const hasCustomSuspectOtherText =
    confirmedSuspectOtherText.length > 0 &&
    confirmedSuspectOtherText !== "其他";
  const onlyUnknownSelected =
    selectedSuspects.length === 1 && selectedSuspects[0] === "unknown";
  const shouldAskSuspectReason =
    isTask2 && selectedSuspects.length > 0 && !onlyUnknownSelected;

  const possibleCrisisLength = possibleCrisis.trim().length;
  const normalizedSuspectReason = suspectReason.trim();
  const suspectReasonLength = normalizedSuspectReason.length;
  const suspectReasonAdditionalTextLength = normalizedSuspectReason.startsWith(
    SUSPECT_REASON_PROMPT_PREFIX,
  )
    ? normalizedSuspectReason.slice(SUSPECT_REASON_PROMPT_PREFIX.length).trim()
        .length
    : suspectReasonLength;
  const suspectReasonMeetsMinLength =
    normalizedSuspectReason === SUSPECT_REASON_INTUITION_TEXT ||
    suspectReasonAdditionalTextLength >= INTRO_TEXT_MIN_LENGTH;
  const otherPurposeLength = otherPurpose.trim().length;
  const nextDisabled =
    (isTask1 && !purpose) ||
    (isTask1Idea && possibleCrisisLength < INTRO_TEXT_MIN_LENGTH) ||
    (isTask2 &&
      (selectedSuspects.length === 0 ||
        (isTask2OtherSelected && !hasCustomSuspectOtherText) ||
        (shouldAskSuspectReason && !suspectReasonMeetsMinLength))) ||
    (isTask3 && task3Targets.length === 0) ||
    (isTask4 && (!purpose || otherPurposeLength < INTRO_TEXT_MIN_LENGTH)) ||
    (isFreeInquiry && otherPurposeLength < INTRO_TEXT_MIN_LENGTH);

  const choiceButtonClass = (active: boolean) =>
    `inquiry-intro-choice-button flex min-h-[58px] items-center justify-center rounded-2xl border px-5 py-4 text-center text-base font-semibold transition-all duration-300 ease-out hover:shadow-md ${
      active
        ? "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-[inset_0_0_0_2px_rgba(16,185,129,0.22),0_6px_0_rgba(16,185,129,0.16)]"
        : "border-stone-300 bg-stone-50 text-stone-700 hover:border-emerald-300 hover:bg-emerald-50/50"
    }`;

  return (
    <div className="game-adventure-page uiux-page-shell inquiry-intro-shell flex min-h-[100svh] items-center justify-center overflow-x-hidden p-4 sm:p-6">
      <motion.div
        layout
        transition={{ layout: { duration: 0.34, ease: "easeInOut" } }}
        className="game-stage-card inquiry-intro-card w-full max-w-2xl rounded-[34px] p-8 text-center"
      >
        {isFreeInquiry ? (
          <p className="mb-2 text-sm font-black tracking-[0.18em] text-stone-500">
            延伸探究
          </p>
        ) : null}
        <h2 className="mb-4 text-2xl font-semibold">{currentCase.title}</h2>

        {isTask1 ? (
          <>
            <p className="mb-4 text-xl font-black leading-8 text-stone-800">
              對於石虎的生存危機，你有甚麼想法嗎?
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onPurposeChange("task1_yes")}
                className={choiceButtonClass(purpose === "task1_yes")}
              >
                有
              </button>
              <button
                type="button"
                onClick={() => {
                  onPossibleCrisisChange("");
                  onPurposeChange("task1_no");
                }}
                className={choiceButtonClass(purpose === "task1_no")}
              >
                沒有
              </button>
            </div>

            <InquiryIntroExpandablePanel
              show={isTask1Idea}
              panelKey="task1-idea-panel"
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <h3 className="mb-3 text-lg font-semibold text-stone-800">
                請寫下你的想法
              </h3>
              <textarea
                value={possibleCrisis}
                onChange={(event) => onPossibleCrisisChange(event.target.value)}
                placeholder="例如：我覺得石虎危機可能和道路、開發、謠言或人類活動有關..."
                className="min-h-36 w-full rounded-2xl border border-stone-300 p-4 text-base outline-none focus:border-stone-500"
              />
              <p className="mt-2 text-right text-xs font-black text-stone-500">
                {possibleCrisisLength} / {INTRO_TEXT_MIN_LENGTH} 字
              </p>
            </InquiryIntroExpandablePanel>
          </>
        ) : null}

        {isTask2 ? (
          <>
            <p className="mb-4 text-xl font-black leading-8 text-stone-800">
              目前的這幾位嫌疑人，有你懷疑的對象嗎？
            </p>
            <p className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm font-semibold leading-7 text-stone-600">
              從這些嫌疑人中選擇「一個」、「多個」、「其他」懷疑對象或是「我不確定」(可複選)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {INQUIRY_SUSPECT_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onToggleSuspect(group.id)}
                  className={choiceButtonClass(
                    selectedSuspects.includes(group.id),
                  )}
                >
                  {group.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onToggleSuspect("unknown")}
                className={choiceButtonClass(
                  selectedSuspects.includes("unknown"),
                )}
              >
                我不確定
              </button>
              {isEditingSuspectOther ? (
                <motion.div
                  role="button"
                  tabIndex={0}
                  aria-label="編輯其他嫌疑犯"
                  onClick={(event) => {
                    if (event.currentTarget !== event.target) return;
                    const trimmedValue = suspectOtherDraft.trim();
                    if (!trimmedValue && isTask2OtherSelected) {
                      onSuspectOtherTextChange("");
                      onSuspectOtherDraftChange("");
                      onToggleSuspect("other");
                    }
                    setIsEditingSuspectOther(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    onSuspectOtherDraftChange(
                      hasCustomSuspectOtherText
                        ? confirmedSuspectOtherText
                        : "",
                    );
                    setIsEditingSuspectOther(false);
                  }}
                  initial={{ opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    mass: 0.65,
                  }}
                  className="group flex h-[58px] cursor-pointer items-center gap-2 overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-3 py-2 text-base font-semibold text-emerald-950 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.20),0_6px_0_rgba(16,185,129,0.12)] outline-none transition hover:border-emerald-400 hover:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.28),0_8px_0_rgba(16,185,129,0.14)] focus-visible:ring-2 focus-visible:ring-emerald-200"
                  title="輸入自訂嫌疑犯；留空確認會回到「其他」並取消選取"
                >
                  <input
                    value={suspectOtherDraft}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onSuspectOtherDraftChange(
                          hasCustomSuspectOtherText
                            ? confirmedSuspectOtherText
                            : "",
                        );
                        setIsEditingSuspectOther(false);
                        return;
                      }
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const trimmedValue = suspectOtherDraft.trim();
                      if (!trimmedValue || trimmedValue === "其他") {
                        onSuspectOtherTextChange("");
                        onSuspectOtherDraftChange("");
                        if (isTask2OtherSelected) onToggleSuspect("other");
                        setIsEditingSuspectOther(false);
                        return;
                      }
                      onSuspectOtherTextChange(trimmedValue);
                      onSuspectOtherDraftChange(trimmedValue);
                      if (!isTask2OtherSelected) onToggleSuspect("other");
                      setIsEditingSuspectOther(false);
                    }}
                    onChange={(event) =>
                      onSuspectOtherDraftChange(event.target.value)
                    }
                    placeholder="輸入對象"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white/95 px-3 text-base font-black text-emerald-950 outline-none transition placeholder:text-emerald-700/45 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const trimmedValue = suspectOtherDraft.trim();
                      if (!trimmedValue || trimmedValue === "其他") {
                        onSuspectOtherTextChange("");
                        onSuspectOtherDraftChange("");
                        if (isTask2OtherSelected) onToggleSuspect("other");
                        setIsEditingSuspectOther(false);
                        return;
                      }
                      onSuspectOtherTextChange(trimmedValue);
                      onSuspectOtherDraftChange(trimmedValue);
                      if (!isTask2OtherSelected) onToggleSuspect("other");
                      setIsEditingSuspectOther(false);
                    }}
                    className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100"
                  >
                    確認
                  </button>
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSuspectOtherDraftChange(
                      hasCustomSuspectOtherText
                        ? confirmedSuspectOtherText
                        : "",
                    );
                    setIsEditingSuspectOther(true);
                  }}
                  className={choiceButtonClass(
                    isTask2OtherSelected && hasCustomSuspectOtherText,
                  )}
                  title={
                    hasCustomSuspectOtherText
                      ? "點擊文字可以再次編輯"
                      : "點擊後可輸入其他嫌疑犯"
                  }
                >
                  <span className="block truncate">
                    {hasCustomSuspectOtherText
                      ? confirmedSuspectOtherText
                      : "其他"}
                  </span>
                </button>
              )}
            </div>

            <InquiryIntroExpandablePanel
              show={shouldAskSuspectReason}
              panelKey="suspect-reason-panel"
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-stone-800">
                  為什麼懷疑這些人？
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSuspectReasonChange(SUSPECT_REASON_PROMPT_PREFIX)
                    }
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 transition hover:-translate-y-0.5 hover:bg-amber-100"
                  >
                    我懷疑的原因是：
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSuspectReasonChange(SUSPECT_REASON_INTUITION_TEXT)
                    }
                    className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-black text-stone-700 transition hover:-translate-y-0.5 hover:bg-stone-100"
                  >
                    我靠的是直覺，沒有理由
                  </button>
                </div>
              </div>
              <textarea
                value={suspectReason}
                onChange={(event) => onSuspectReasonChange(event.target.value)}
                placeholder="例如：我懷疑這些人，是因為他們的行為、地點或線索和石虎危機有關..."
                className="min-h-32 w-full rounded-2xl border border-stone-300 p-4 text-base outline-none focus:border-stone-500"
              />
              <p className="mt-2 text-right text-xs font-black text-stone-500">
                {normalizedSuspectReason === SUSPECT_REASON_INTUITION_TEXT
                  ? "已選擇直覺理由，可繼續下一步"
                  : normalizedSuspectReason.startsWith(
                        SUSPECT_REASON_PROMPT_PREFIX,
                      )
                    ? `補充內容 ${suspectReasonAdditionalTextLength} / ${INTRO_TEXT_MIN_LENGTH} 字`
                    : `${suspectReasonLength} / ${INTRO_TEXT_MIN_LENGTH} 字`}
              </p>
            </InquiryIntroExpandablePanel>
          </>
        ) : null}

        {isTask3 ? (
          <>
            <p className="mb-4 text-xl font-black leading-8 text-stone-800">
              追查證據任務開始，你想追查的證據是關於？
            </p>
            <p className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm font-semibold leading-7 text-stone-600">
              你可以專注在一個領域，也可以同時追查危機、兇手，或補充其他想法(可複選)
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => onToggleTask3Target("crisis")}
                className={choiceButtonClass(task3Targets.includes("crisis"))}
              >
                危機
              </button>
              <button
                type="button"
                onClick={() => onToggleTask3Target("suspect")}
                className={choiceButtonClass(task3Targets.includes("suspect"))}
              >
                兇手
              </button>
              <button
                type="button"
                onClick={() => onToggleTask3Target("other")}
                className={choiceButtonClass(task3Targets.includes("other"))}
              >
                其他
              </button>
            </div>

            <InquiryIntroExpandablePanel
              show={isTask3Other}
              panelKey="task3-other-panel"
              className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
            >
              <h3 className="mb-3 text-lg font-semibold text-emerald-950">
                請寫下你說的「其他」是什麼
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={task3OtherDraft}
                  onChange={(event) =>
                    onTask3OtherDraftChange(event.target.value)
                  }
                  placeholder="例如：我想追查媒體報導、居民說法、保育投入或其他線索..."
                  className="min-h-12 flex-1 rounded-2xl border border-emerald-200 bg-white px-4 text-base outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => onTask3OtherTextChange(task3OtherDraft.trim())}
                  className="rounded-2xl border border-emerald-300 bg-white px-5 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  送出
                </button>
              </div>
            </InquiryIntroExpandablePanel>
          </>
        ) : null}

        {isTask4 ? (
          <>
            <p className="mb-4 text-xl font-black leading-8 text-stone-800">
              經過這幾次的調查有沒有改變或新的想法？
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  onOtherPurposeChange("");
                  onPurposeChange("task4_yes");
                }}
                className={choiceButtonClass(purpose === "task4_yes")}
              >
                有
              </button>
              <button
                type="button"
                onClick={() => {
                  onOtherPurposeChange("");
                  onPurposeChange("task4_no");
                }}
                className={choiceButtonClass(purpose === "task4_no")}
              >
                沒有
              </button>
            </div>

            <InquiryIntroExpandablePanel
              show={purpose === "task4_yes" || purpose === "task4_no"}
              panelKey="task4-reflection-panel"
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <h3 className="mb-3 text-lg font-semibold text-stone-800">
                {purpose === "task4_yes"
                  ? "你改變了甚麼想法呢?"
                  : "所以你更加確定了甚麼事情呢?"}
              </h3>
              <textarea
                value={otherPurpose}
                onChange={(event) => onOtherPurposeChange(event.target.value)}
                placeholder={
                  purpose === "task4_yes"
                    ? "寫下你原本怎麼想，後來因為哪些調查或證據而改變..."
                    : "寫下你目前更確定的判斷，以及你為什麼這麼確定..."
                }
                className="min-h-36 w-full rounded-2xl border border-stone-300 p-4 text-base outline-none focus:border-stone-500"
              />
              <p className="mt-2 text-right text-xs font-black text-stone-500">
                {otherPurposeLength} / {INTRO_TEXT_MIN_LENGTH} 字
              </p>
            </InquiryIntroExpandablePanel>
          </>
        ) : null}

        {isFreeInquiry ? (
          <>
            <p className="mb-4 text-xl font-black leading-8 text-stone-800">
              這次探究的目的是什麼呢？
            </p>
            <textarea
              value={otherPurpose}
              onChange={(event) => onOtherPurposeChange(event.target.value)}
              placeholder="寫下這次你想探究的目的..."
              className="min-h-40 w-full rounded-2xl border border-stone-300 p-4 text-base outline-none focus:border-stone-500"
            />
            <p className="mt-2 text-right text-xs font-black text-stone-500">
              {otherPurposeLength} / {INTRO_TEXT_MIN_LENGTH} 字
            </p>
          </>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-full items-center justify-center rounded-[20px] border border-[#d9c7a4] bg-gradient-to-br from-white via-[#fff8e8] to-[#f1e1bd] px-5 font-black text-[#6b5634] shadow-[0_6px_0_rgba(161,130,83,0.14),0_12px_22px_rgba(88,67,38,0.10)] transition hover:-translate-y-0.5 hover:border-[#c19a5d] hover:brightness-[1.02] active:translate-y-0 sm:w-36"
          >
            上一頁
          </button>

          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className="flex h-12 w-full items-center justify-center rounded-[20px] border border-[#9f8768] bg-gradient-to-br from-[#fff1bf] via-[#eacb86] to-[#cfa464] px-5 font-black text-[#3f3023] shadow-[0_6px_0_rgba(112,89,65,0.22),0_12px_22px_rgba(72,52,36,0.16)] transition hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 sm:w-36"
          >
            下一步
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InquiryStageTransitionFrame({
  children,
  stageKey,
}: {
  children: ReactNode;
  stageKey: string;
}) {
  return (
    <motion.div
      key={stageKey}
      className="min-h-[100svh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTitleTier(titleId: string): TitleTier {
  if (titleId.includes("master")) return "master";
  if (titleId.includes("advanced")) return "advanced";
  return "novice";
}

function isSupportedInquiryTitleReward(title: TitleReward | null | undefined) {
  return Boolean(title?.id) && !String(title?.id).startsWith("other_");
}

function getTitleTheme(titleId: string): TitleTheme {
  if (titleId.includes("water")) return "water";
  if (titleId.includes("land")) return "land";
  if (titleId.includes("leopard")) return "leopard";
  if (titleId.includes("rumor")) return "rumor";
  return "cross";
}

function getTitleMedalStyle(titleOrId: TitleReward | string) {
  const id = typeof titleOrId === "string" ? titleOrId : titleOrId.id;
  const tier = getTitleTier(id);

  if (tier === "master") {
    return {
      rank: "MASTER",
      metal: "from-[#fff7cf] via-[#d8aa3d] to-[#8b6422]",
      shine: "from-[#fff4c0] via-[#d8a93b] to-[#8b6320]",
      border: "border-[#b7892e]",
      ribbon: "from-[#7b2f2f] via-[#9f4a3f] to-[#5d2323]",
      text: "text-[#5f4217]",
      glow: "shadow-[0_14px_28px_rgba(139,100,34,0.24)]",
      stars: "★★★",
      starText:
        "text-[#fff2a8] [text-shadow:0_1px_0_rgba(95,66,23,0.55),0_0_6px_rgba(255,244,192,0.85)]",
    };
  }

  if (tier === "advanced") {
    return {
      rank: "VETERAN",
      metal: "from-[#ffffff] via-[#c9c9c4] to-[#7f817c]",
      shine: "from-[#ffffff] via-[#c9c9c4] to-[#8c8d88]",
      border: "border-[#9a9c96]",
      ribbon: "from-[#3f4f5e] via-[#607082] to-[#2f3b48]",
      text: "text-[#4f514c]",
      glow: "shadow-[0_14px_28px_rgba(75,85,99,0.18)]",
      stars: "★★",
      starText:
        "text-[#f7f7ef] [text-shadow:0_1px_0_rgba(79,81,76,0.55),0_0_6px_rgba(255,255,255,0.85)]",
    };
  }

  return {
    rank: "ROOKIE",
    metal: "from-[#ffe2bf] via-[#b9784b] to-[#764126]",
    shine: "from-[#ffe4c4] via-[#b9784b] to-[#7a442b]",
    border: "border-[#9a5f3d]",
    ribbon: "from-[#5d4a3f] via-[#8a6b58] to-[#49382f]",
    text: "text-[#70452c]",
    glow: "shadow-[0_14px_28px_rgba(120,65,38,0.18)]",
    stars: "★",
    starText:
      "text-[#ffd7a3] [text-shadow:0_1px_0_rgba(112,69,44,0.6),0_0_5px_rgba(255,226,191,0.75)]",
  };
}

function TitleMedalStars({
  stars,
  className = "",
  variant = "small",
}: {
  stars: string;
  className?: string;
  variant?: "small" | "large";
}) {
  const cleanStars = stars.replace(/\s/g, "");
  const starCount = Math.max(1, cleanStars.length);
  const starSymbol = cleanStars[0] || "★";

  if (starCount >= 3) {
    const wrapperClass =
      variant === "large"
        ? "text-[2.15rem] leading-[0.86] gap-0.5"
        : "text-[10px] leading-[0.82] gap-[1px]";
    const bottomClass =
      variant === "large" ? "gap-2 -mt-0.5" : "gap-1 -mt-[1px]";

    return (
      <span
        className={`inline-flex flex-col items-center justify-center ${wrapperClass} ${className}`}
        aria-label={stars}
      >
        <span>{starSymbol}</span>
        <span
          className={`inline-flex items-center justify-center ${bottomClass}`}
        >
          <span>{starSymbol}</span>
          <span>{starSymbol}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center leading-none ${className}`}
      aria-label={stars}
    >
      {cleanStars}
    </span>
  );
}

function TitleEmblem({ tier, theme }: { tier: TitleTier; theme: TitleTheme }) {
  const style = getTitleMedalStyle(`${theme}_${tier}`);

  return (
    <div className="flex w-[58px] shrink-0 flex-col items-center">
      <div
        className={`relative mb-[-6px] h-12 w-12 rounded-full border-[3px] ${style.border} bg-gradient-to-br ${style.metal} shadow-[inset_0_3px_8px_rgba(255,255,255,0.75),inset_0_-7px_10px_rgba(0,0,0,0.14),0_8px_14px_rgba(45,41,34,0.16)]`}
      >
        <div className="absolute inset-1.5 rounded-full border border-white/55 bg-white/10" />
        <div
          className={`absolute inset-[10px] rounded-full border border-white/70 bg-gradient-to-br ${style.shine}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center px-1 font-black leading-none drop-shadow-sm ${style.starText}`}
        >
          <TitleMedalStars stars={style.stars} variant="small" />
        </div>
      </div>

      <div className="relative flex w-14 justify-center">
        <div
          className={`h-8 w-5 origin-top rotate-[8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
        />
        <div
          className={`-ml-1.5 h-8 w-5 origin-top rotate-[-8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
        />
      </div>
    </div>
  );
}

function TitleBadgeCard({ title }: { title: TitleReward }) {
  const tier = getTitleTier(title.id);
  const theme = getTitleTheme(title.id);
  const style = getTitleMedalStyle(title);

  return (
    <div
      className={`group relative w-full min-w-0 overflow-hidden rounded-[22px] border bg-[#fffaf0] px-2.5 py-2 text-left transition duration-200 ${style.border} ${style.glow} hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,41,34,0.16)]`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.9),transparent_42%)] opacity-70" />

      <div className="relative flex min-h-[104px] items-center gap-2.5">
        <TitleEmblem tier={tier} theme={theme} />

        <div className="min-w-0 flex-1">
          <div
            className={`relative mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.13em] ${style.border} ${style.text} bg-white/55`}
          >
            {style.rank}
          </div>

          <p className="relative text-[13px] font-black leading-[1.28] text-[#332c24]">
            {title.name}
          </p>
          <p className="relative mt-0.5 line-clamp-2 text-[11px] leading-[1.28] text-[#746855]">
            {title.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function getBalanceEffect(category: CategoryKey) {
  switch (category) {
    case "land":
      return { development: 1, conservation: 0 };

    case "leopard":
      return { development: 0, conservation: 1 };

    case "water":
    case "rumor":
    case "other":
      return { development: 1, conservation: 1 };
  }
}

function BalanceScaleBackground({
  developmentScore,
  conservationScore,
}: {
  developmentScore: number;
  conservationScore: number;
}) {
  const difference = developmentScore - conservationScore;
  const rotate = clamp(difference * 4, -14, 14);
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frameId: number | null = null;

    const syncViewportMode = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        setIsCompactViewport((previous) => {
          const next = window.innerWidth < 768;
          return previous === next ? previous : next;
        });
      });
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode, { passive: true });

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", syncViewportMode);
    };
  }, []);

  const swayClassName = isCompactViewport
    ? "balance-scale-sway balance-scale-sway--compact"
    : "balance-scale-sway";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      style={{ contain: "layout paint", transform: "translateZ(0)" }}
    >
      <style>{`
        @keyframes inquiry-balance-scale-sway {
          0%, 100% { transform: rotate(-0.48deg); }
          20% { transform: rotate(-0.22deg); }
          40% { transform: rotate(0.22deg); }
          60% { transform: rotate(0.48deg); }
          80% { transform: rotate(0.18deg); }
        }

        @keyframes inquiry-balance-scale-sway-compact {
          0%, 100% { transform: rotate(-0.28deg); }
          25% { transform: rotate(-0.12deg); }
          50% { transform: rotate(0.24deg); }
          75% { transform: rotate(0.1deg); }
        }

        .balance-scale-sway {
          animation: inquiry-balance-scale-sway 9.5s ease-in-out infinite;
          transform-origin: 50% 26px;
          will-change: transform;
        }

        .balance-scale-sway--compact {
          animation-name: inquiry-balance-scale-sway-compact;
          animation-duration: 12s;
        }
      `}</style>
      <div className="absolute left-[-14%] top-[6%] h-[560px] w-[560px] rounded-full bg-emerald-200/18 blur-[100px]" />
      <div className="absolute right-[-14%] top-[8%] h-[600px] w-[600px] rounded-full bg-orange-200/18 blur-[100px]" />
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100/24 blur-[120px]" />

      <div className="absolute left-1/2 top-1/2 h-[700px] w-[1160px] origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.42] opacity-[0.23] sm:scale-[0.55] md:scale-[0.72] lg:scale-[0.88] xl:scale-100">
        <div className="absolute bottom-[22px] left-1/2 h-20 w-[620px] -translate-x-1/2 rounded-full bg-amber-950/18 blur-2xl" />

        <div className="absolute bottom-[96px] left-1/2 h-12 w-[330px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fde68a,#d97706,#78350f)] shadow-[0_14px_30px_rgba(120,53,15,0.28)]" />
        <div className="absolute bottom-[128px] left-1/2 h-8 w-[210px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fff7c2,#f59e0b,#92400e)] shadow-[0_10px_24px_rgba(120,53,15,0.22)]" />

        <div className="absolute left-1/2 top-[250px] h-[300px] w-12 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#451a03_0%,#92400e_12%,#fbbf24_28%,#fff7c2_45%,#d97706_62%,#78350f_82%,#451a03_100%)] shadow-[0_22px_55px_rgba(120,53,15,0.3)]">
          <div className="absolute left-3 top-8 h-[235px] w-2 rounded-full bg-white/50 blur-[1px]" />
          <div className="absolute right-2 top-8 h-[245px] w-1 rounded-full bg-amber-950/35" />
        </div>

        <div className="absolute left-1/2 top-[150px] h-36 w-36 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_34%_28%,#fffbe6_0%,#facc15_24%,#b45309_58%,#451a03_100%)] shadow-[0_20px_48px_rgba(120,53,15,0.35)]">
          <div className="absolute inset-[15px] rounded-full border border-amber-100/80 bg-[radial-gradient(circle_at_34%_28%,rgba(255,255,255,0.86),rgba(255,255,255,0.22)_46%,rgba(120,53,15,0.2)_100%)]" />
          <div className="absolute left-9 top-8 h-6 w-6 rounded-full bg-white/80 blur-[1px]" />
          <div className="absolute bottom-5 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-amber-950/20" />
        </div>

        <motion.div
          animate={{ rotate }}
          transition={{ type: "spring", stiffness: 95, damping: 16 }}
          className="absolute left-1/2 top-[194px] h-[330px] w-[920px] -translate-x-1/2 transform-gpu will-change-transform"
          style={{ transformOrigin: "50% 26px" }}
        >
          <div
            className={`absolute inset-0 transform-gpu ${swayClassName}`}
            style={{
              transformOrigin: "50% 26px",
              animationPlayState: isPageVisible ? "running" : "paused",
            }}
          >
            <div className="absolute left-0 top-0 h-10 w-full rounded-full bg-[linear-gradient(180deg,#fff7c2_0%,#facc15_18%,#d97706_44%,#92400e_75%,#451a03_100%)] shadow-[0_22px_55px_rgba(120,53,15,0.3)]">
              <div className="absolute left-12 right-12 top-1.5 h-2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.9),rgba(255,255,255,0))]" />
              <div className="absolute bottom-1 left-10 right-10 h-1 rounded-full bg-amber-950/35" />
            </div>

            <div className="absolute -left-8 top-[-10px] h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_28%,#fffbe6,#fbbf24_34%,#92400e_74%,#451a03)] shadow-[0_14px_32px_rgba(120,53,15,0.32)]" />
            <div className="absolute -right-8 top-[-10px] h-16 w-16 rounded-full bg-[radial-gradient(circle_at_32%_28%,#fffbe6,#fbbf24_34%,#92400e_74%,#451a03)] shadow-[0_14px_32px_rgba(120,53,15,0.32)]" />

            <div className="absolute left-1/2 top-[-22px] h-24 w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffbe6,#facc15_34%,#92400e_78%,#451a03)] shadow-[0_18px_40px_rgba(120,53,15,0.34)]">
              <div className="absolute inset-[16px] rounded-full border border-amber-100/80 bg-white/20" />
              <div className="absolute left-7 top-6 h-5 w-5 rounded-full bg-white/70 blur-[1px]" />
            </div>

            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 -rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#fffbe6,#f59e0b,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[220px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />

            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 -rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#fffbe6,#f59e0b,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />
            <div className="absolute left-[700px] top-[30px] h-[184px] w-[3px] origin-top -translate-x-1/2 rotate-[34deg] rounded-full bg-[linear-gradient(180deg,#fff7c2,#d97706,#78350f)] shadow-[0_0_8px_rgba(251,191,36,0.35)]" />

            <div className="absolute left-[70px] top-[176px] flex w-[300px] flex-col items-center">
              <div className="relative h-[72px] w-[286px]">
                <div className="absolute left-1/2 top-0 h-14 w-[286px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fffbe6_0%,#facc15_24%,#b45309_62%,#451a03_100%)] shadow-[0_16px_34px_rgba(120,53,15,0.28)]">
                  <div className="absolute left-1/2 top-1 h-6 w-[246px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.22))]" />
                  <div className="absolute bottom-1 left-1/2 h-3 w-[230px] -translate-x-1/2 rounded-[50%] bg-amber-950/25" />
                </div>

                <div className="absolute left-1/2 top-[9px] h-9 w-[242px] -translate-x-1/2 rounded-[50%] border border-emerald-300/70 bg-[radial-gradient(ellipse_at_center,rgba(236,253,245,0.96)_0%,rgba(110,231,183,0.62)_52%,rgba(6,95,70,0.42)_100%)]" />
                <div className="absolute left-1/2 top-[16px] z-10 -translate-x-1/2 text-3xl font-black tracking-[0.18em] text-emerald-800 drop-shadow-[0_2px_3px_rgba(255,255,255,0.75)]">
                  保育
                </div>

                <div className="absolute left-1/2 top-[14px] h-2 w-[170px] -translate-x-1/2 rounded-full bg-white/75 blur-[1px]" />
                <div className="absolute left-[72px] top-[22px] h-5 w-14 rounded-full bg-white/20 blur-md" />

                <div className="absolute left-1/2 top-[41px] h-4 w-[232px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#b45309_0%,#78350f_72%,#451a03_100%)] opacity-80 shadow-[0_10px_20px_rgba(120,53,15,0.22)]" />
              </div>
            </div>

            <div className="absolute right-[70px] top-[176px] flex w-[300px] flex-col items-center">
              <div className="relative h-[72px] w-[286px]">
                <div className="absolute left-1/2 top-0 h-14 w-[286px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#fffbe6_0%,#facc15_24%,#b45309_62%,#451a03_100%)] shadow-[0_16px_34px_rgba(120,53,15,0.28)]">
                  <div className="absolute left-1/2 top-1 h-6 w-[246px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.22))]" />
                  <div className="absolute bottom-1 left-1/2 h-3 w-[230px] -translate-x-1/2 rounded-[50%] bg-amber-950/25" />
                </div>

                <div className="absolute left-1/2 top-[9px] h-9 w-[242px] -translate-x-1/2 rounded-[50%] border border-orange-300/70 bg-[radial-gradient(ellipse_at_center,rgba(255,247,237,0.96)_0%,rgba(253,186,116,0.62)_52%,rgba(194,65,12,0.42)_100%)]" />

                <div className="absolute left-1/2 top-[16px] z-10 -translate-x-1/2 text-3xl font-black tracking-[0.18em] text-orange-800 drop-shadow-[0_2px_3px_rgba(255,255,255,0.75)]">
                  開發
                </div>

                <div className="absolute left-1/2 top-[14px] h-2 w-[170px] -translate-x-1/2 rounded-full bg-white/75 blur-[1px]" />
                <div className="absolute left-[72px] top-[22px] h-5 w-14 rounded-full bg-white/20 blur-md" />

                <div className="absolute left-1/2 top-[41px] h-4 w-[232px] -translate-x-1/2 rounded-[50%] bg-[linear-gradient(180deg,#b45309_0%,#78350f_72%,#451a03_100%)] opacity-80 shadow-[0_10px_20px_rgba(120,53,15,0.22)]" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function CategoryTabs({
  activeCategory,
  onChange,
  unlockedCountByCategory,
  totalCountByCategory,
  totalUnlockedCount,
  totalCardCount,
  currentInquiryTitle,
  onRequestFinish,
}: {
  activeCategory: CategoryKey | null;
  onChange: (category: CategoryKey) => void;
  unlockedCountByCategory: Record<CategoryKey, number>;
  totalCountByCategory: Record<CategoryKey, number>;
  totalUnlockedCount: number;
  totalCardCount: number;
  currentInquiryTitle: string;
  onRequestFinish: () => void;
}) {
  const activeListTheme = activeCategory
    ? categoryListThemeMap[activeCategory]
    : null;
  const listBackgroundColor =
    activeListTheme?.pageBg ?? "rgba(255, 243, 207, 0.78)";

  return (
    <div
      className={`relative mb-8 overflow-hidden rounded-[34px] border p-6 shadow-[0_22px_70px_rgba(45,41,34,0.09)] backdrop-blur-xl ${
        activeListTheme?.page ?? "border-[#dfd3bd]/80"
      }`}
      style={{ backgroundColor: listBackgroundColor }}
    >
      <div className="mb-5 rounded-[28px] border border-white/55 bg-white/45 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] sm:px-5">
        <div className="grid items-center gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_minmax(14rem,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(16rem,1.1fr)_minmax(0,1fr)]">
          <div className="order-2 flex min-w-0 items-center justify-center gap-2 text-center sm:gap-3 lg:order-1 lg:justify-start lg:text-left">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border sm:h-11 sm:w-11 ${
                activeListTheme?.headerIcon ??
                "border-[#bdb294] bg-[#f7f1e3] text-[#6f7d5f]"
              }`}
            >
              <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="truncate font-serif text-base font-semibold tracking-[0.08em] text-stone-700 sm:text-lg">
              數據清單
            </p>
          </div>

          <div className="order-1 min-w-0 overflow-hidden text-center lg:order-2">
            <p className="mx-auto max-w-full truncate text-xl font-[1000] leading-tight tracking-[0.03em] text-[#4f3f2c] drop-shadow-[0_1px_0_rgba(255,250,240,0.9)] sm:text-2xl md:text-[1.7rem] lg:text-3xl xl:text-[2rem]">
              {currentInquiryTitle}
            </p>
          </div>

          <div className="order-3 grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto] sm:justify-center lg:flex lg:flex-wrap lg:items-center lg:justify-end lg:gap-3">
            <div className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[#c8b48f] bg-[#fffaf0]/85 px-3 py-2 text-sm font-semibold text-[#5f5545] sm:px-4 lg:order-2">
              <BookOpen className="h-4 w-4 shrink-0 text-[#6f7d5f]" />
              <span className="whitespace-nowrap">已解鎖</span>
              <span
                className={`rounded-full border px-3 py-1 font-black ${
                  activeListTheme?.counter ??
                  "border-[#c8b48f] bg-white text-[#6f7d5f]"
                }`}
              >
                {totalUnlockedCount} / {totalCardCount}
              </span>
            </div>

            <Button
              type="button"
              onClick={onRequestFinish}
              className="min-h-[44px] rounded-2xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-2.5 font-black text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0 lg:order-1"
            >
              提前結束
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[780px]:grid-cols-3 xl:grid-cols-5">
        {CATEGORY_KEYS.map((key) => {
          const item = categoryMetaMap[key];
          const active = activeCategory === key;
          const theme = categoryTabThemeMap[key];
          return (
            <motion.button
              key={key}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(key)}
              className={[
                "relative overflow-hidden rounded-[26px] border px-4 py-4 text-left transition hover:shadow-md",
                active ? theme.active : theme.inactive,
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="rounded-full border border-stone-200 bg-white/80 p-2 text-stone-600">
                  {item.icon}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${theme.badge}`}
                  >
                    {unlockedCountByCategory[key]} / {totalCountByCategory[key]}
                  </span>
                  {active ? (
                    <span className="rounded-full border border-[#c8b48f] bg-[#fffaf0] px-3 py-1 text-xs font-medium text-[#6d5e49]">
                      目前分類
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <p className="font-serif text-xl font-semibold tracking-[0.06em] text-stone-800">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {item.subtitle}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function TrophyPanel({
  titles,
  hasNewTitle,
  onOpenPanel,
}: {
  titles: TitleReward[];
  hasNewTitle: boolean;
  onOpenPanel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleTogglePanel = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpenPanel();
      return next;
    });
  };
  const floatingMedalStyle = getTitleMedalStyle(
    titles[titles.length - 1]?.id ?? "cross_novice",
  );

  return (
    <div
      ref={containerRef}
      className="fixed bottom-5 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-5 md:bottom-6 md:right-6"
    >
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="flex max-h-[min(520px,74svh)] w-[min(300px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.12)] flex-col sm:p-4"
          >
            <div className="mb-2 flex items-center gap-3">
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] ${floatingMedalStyle.border} bg-gradient-to-br ${floatingMedalStyle.metal} shadow-[inset_0_2px_6px_rgba(255,255,255,0.72),inset_0_-5px_8px_rgba(0,0,0,0.14)]`}
              >
                <TitleMedalStars
                  stars={floatingMedalStyle.stars}
                  className={floatingMedalStyle.starText}
                />
              </div>
              <div>
                <p className="system-major-title text-base font-black uppercase tracking-[0.24em] text-amber-600 sm:text-lg sm:tracking-[0.28em]">
                  稱號收藏
                </p>
              </div>
            </div>

            {titles.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
                {titles.map((title) => (
                  <TitleBadgeCard key={title.id} title={title} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                尚未獲得稱號
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        animate={
          hasNewTitle && !open
            ? {
                scale: [1, 1.06, 1],
                boxShadow: [
                  "0 10px 24px rgba(15,23,42,0.14)",
                  "0 0 0 6px rgba(251,191,36,0.12), 0 0 20px rgba(251,191,36,0.18)",
                  "0 10px 24px rgba(15,23,42,0.14)",
                ],
              }
            : {
                scale: 1,
                boxShadow: "0 10px 24px rgba(15,23,42,0.14)",
              }
        }
        transition={
          hasNewTitle && !open
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        onClick={handleTogglePanel}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border-[4px] ${floatingMedalStyle.border} bg-gradient-to-br ${floatingMedalStyle.metal} text-amber-800 shadow-[inset_0_4px_10px_rgba(255,255,255,0.75),inset_0_-10px_14px_rgba(0,0,0,0.16)]`}
      >
        <div className="absolute inset-2 rounded-full border border-white/60" />
        <div
          className={`absolute inset-[15px] rounded-full border border-white/70 bg-gradient-to-br ${floatingMedalStyle.shine}`}
        />
        {hasNewTitle && !open ? (
          <motion.span
            className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-500"
            animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.2, 0.9] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        {open ? (
          <ChevronDown className="relative z-10 h-6 w-6 text-white drop-shadow" />
        ) : (
          <TitleMedalStars
            stars={floatingMedalStyle.stars}
            variant="small"
            className={`relative z-10 text-xl ${floatingMedalStyle.starText}`}
          />
        )}
      </motion.button>
    </div>
  );
}

function getVisibleStationIdsFromScrollContainer(
  container: HTMLDivElement | null,
) {
  if (!container) return undefined;
  const containerRect = container.getBoundingClientRect();
  const visibleIds: string[] = [];

  container
    .querySelectorAll<HTMLElement>("[data-station-id]")
    .forEach((element) => {
      const rect = element.getBoundingClientRect();
      const visibleHeight =
        Math.min(rect.bottom, containerRect.bottom) -
        Math.max(rect.top, containerRect.top);
      if (visibleHeight > Math.min(rect.height * 0.35, 26)) {
        const stationId = element.dataset.stationId;
        if (stationId) visibleIds.push(stationId);
      }
    });

  return visibleIds.length > 0 ? visibleIds : undefined;
}

function InteractiveDataSnapshotPanel({
  activeCategory,
  token,
  onCreateSnapshotCard,
}: {
  activeCategory: CategoryKey;
  token?: string;
  onCreateSnapshotCard: (
    meta: EvidenceSnapshotMeta,
    reason: string,
    snapshotImageUrl?: string,
  ) => void;
}) {
  const options = INTERACTIVE_DATA_OPTIONS[activeCategory];
  const initialSubcategory =
    activeCategory === "water" ? "降雨量" : options.subcategories[0];
  const [selectedName, setSelectedName] =
    useState<InteractiveSelection>(ALL_TOWNS_LABEL);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [metric, setMetric] = useState(
    activeCategory === "water"
      ? getWaterMetricForSubcategory(initialSubcategory)
      : options.metrics[0],
  );
  const [capturePreviewSnapshot, setCapturePreviewSnapshot] =
    useState<EvidenceSnapshotMeta | null>(null);
  const [capturePreviewImageSrc, setCapturePreviewImageSrc] = useState("");
  const [capturePreviewPhase, setCapturePreviewPhase] = useState<
    "capturing" | "complete"
  >("capturing");
  const [captureErrorMessage, setCaptureErrorMessage] = useState("");
  const captureEffectTimerRef = useRef<number | null>(null);
  const capturePhaseTimerRef = useRef<number | null>(null);
  const [isSavingSnapshotImage, setIsSavingSnapshotImage] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [waterTownMonthlyRecords, setWaterTownMonthlyRecords] = useState<
    WaterTownMonthlyRecord[]
  >([]);
  const [waterRpiRiverMonthlyRecords, setWaterRpiRiverMonthlyRecords] =
    useState<WaterRpiRiverMonthlyRecord[]>([]);
  const [waterQualityStationRecords, setWaterQualityStationRecords] = useState<
    WaterQualityStationStatusRecord[]
  >([]);
  const [showWaterMapRegionLabels, setShowWaterMapRegionLabels] =
    useState(true);
  const waterQualityStationListRef = useRef<HTMLDivElement | null>(null);
  const captureAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (captureEffectTimerRef.current !== null) {
        window.clearTimeout(captureEffectTimerRef.current);
        captureEffectTimerRef.current = null;
      }
      if (capturePhaseTimerRef.current !== null) {
        window.clearTimeout(capturePhaseTimerRef.current);
        capturePhaseTimerRef.current = null;
      }
      setCapturePreviewSnapshot(null);
      setCapturePreviewImageSrc("");
      setCapturePreviewPhase("capturing");
      setCaptureErrorMessage("");
      setCapturePreviewPhase("capturing");
    };
  }, []);

  useEffect(() => {
    if (activeCategory !== "water") return;
    if (
      waterTownMonthlyRecords.length > 0 &&
      waterRpiRiverMonthlyRecords.length > 0 &&
      waterQualityStationRecords.length > 0
    ) {
      return;
    }

    const controller = new AbortController();

    Promise.all([
      waterTownMonthlyRecords.length > 0
        ? Promise.resolve<WaterTownMonthlyRecord[] | null>(null)
        : fetchCsvText(
            "/data/miaoli_cwa_town_monthly_2025.csv",
            "水資源地區資料",
            controller.signal,
          ).then(parseWaterTownMonthlyCsv),
      waterRpiRiverMonthlyRecords.length > 0
        ? Promise.resolve<WaterRpiRiverMonthlyRecord[] | null>(null)
        : fetchCsvText(
            "/data/water_rpi_river_monthly_2025.csv",
            "水質RPI資料",
            controller.signal,
          ).then(parseWaterRpiRiverMonthlyCsv),
      waterQualityStationRecords.length > 0
        ? Promise.resolve<WaterQualityStationStatusRecord[] | null>(null)
        : fetchCsvText(
            "/data/water_quality_station_status_2025.csv",
            "水質監測站資料",
            controller.signal,
          ).then(parseWaterQualityStationStatusCsv),
    ])
      .then(([rainfallRecords, rpiRecords, stationRecords]) => {
        if (controller.signal.aborted) return;
        if (rainfallRecords) setWaterTownMonthlyRecords(rainfallRecords);
        if (rpiRecords) setWaterRpiRiverMonthlyRecords(rpiRecords);
        if (stationRecords) setWaterQualityStationRecords(stationRecords);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn(error);
        if (waterTownMonthlyRecords.length === 0)
          setWaterTownMonthlyRecords([]);
        if (waterRpiRiverMonthlyRecords.length === 0)
          setWaterRpiRiverMonthlyRecords([]);
        if (waterQualityStationRecords.length === 0)
          setWaterQualityStationRecords([]);
      });

    return () => controller.abort();
  }, [
    activeCategory,
    waterQualityStationRecords.length,
    waterRpiRiverMonthlyRecords.length,
    waterTownMonthlyRecords.length,
  ]);

  useEffect(() => {
    const nextOptions = INTERACTIVE_DATA_OPTIONS[activeCategory];
    const nextSubcategory =
      activeCategory === "water" ? "降雨量" : nextOptions.subcategories[0];

    const timer = window.setTimeout(() => {
      setSubcategory(nextSubcategory);
      setMetric(
        activeCategory === "water"
          ? getWaterMetricForSubcategory(nextSubcategory)
          : nextOptions.metrics[0],
      );
      setSelectedName(
        activeCategory === "water" ? ALL_WATER_TOWNS_LABEL : ALL_TOWNS_LABEL,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory]);
  const waterRpiOptions = useMemo(
    () => getWaterRpiOptions(waterRpiRiverMonthlyRecords),
    [waterRpiRiverMonthlyRecords],
  );
  const waterQualityStationOptions = useMemo(
    () => getWaterQualityStationOptions(),
    [],
  );
  const selectorOptions =
    activeCategory === "water" && subcategory === "降雨量"
      ? INTERACTIVE_TOWN_OPTIONS
      : activeCategory === "water" && isWaterRpiMap(activeCategory, subcategory)
        ? waterRpiOptions
        : activeCategory === "water" &&
            isWaterStationMap(activeCategory, subcategory)
          ? waterQualityStationOptions
          : getInteractiveSelectorOptions(activeCategory, subcategory);

  useEffect(() => {
    if (selectorOptions.includes(selectedName)) return;
    const timer = window.setTimeout(() => {
      setSelectedName(selectorOptions[0] ?? ALL_TOWNS_LABEL);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedName, selectorOptions]);
  const effectiveMetric =
    activeCategory === "water"
      ? getWaterMetricForSubcategory(subcategory)
      : metric;
  const isRainfallSubcategory = isWaterSeasonalRainfall(
    activeCategory,
    subcategory,
  );
  const isRpiSubcategory = isWaterRpiMap(activeCategory, subcategory);
  const isStationSubcategory = isWaterStationMap(activeCategory, subcategory);
  const shouldControlWaterMapRegionLabels = isRpiSubcategory;

  useEffect(() => {
    if (
      activeCategory === "water" &&
      isWaterRpiMap(activeCategory, subcategory)
    ) {
      const timer = window.setTimeout(() => {
        setShowWaterMapRegionLabels(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeCategory, subcategory]);

  const activeStationMonthLabel =
    RECENT_WATER_MONTH_LABELS[playbackIndex] ?? LATEST_WATER_DATA_MONTH;
  const mapOverlay = useMemo(() => {
    if (activeCategory !== "water")
      return { paths: [], areas: [], markers: [] };
    if (subcategory === "降雨量") {
      return {
        paths: [],
        areas: [],
        markers: [],
      };
    }
    if (isWaterRpiMap(activeCategory, subcategory)) {
      return getWaterRpiMapOverlay(
        selectedName,
        waterRpiRiverMonthlyRecords,
        activeStationMonthLabel,
      );
    }
    if (isWaterStationMap(activeCategory, subcategory)) {
      return getWaterQualityStationMapOverlay(
        selectedName,
        waterQualityStationRecords,
      );
    }
    return getWaterMapOverlay(subcategory, selectedName);
  }, [
    activeCategory,
    activeStationMonthLabel,
    selectedName,
    subcategory,
    waterQualityStationRecords,
    waterRpiRiverMonthlyRecords,
  ]);

  const snapshotMeta = useMemo(
    () =>
      activeCategory === "water" && subcategory === "降雨量"
        ? buildWaterTownRainfallSnapshotMeta(
            selectedName,
            waterTownMonthlyRecords,
          )
        : activeCategory === "water" &&
            isWaterRpiMap(activeCategory, subcategory)
          ? buildWaterRpiSnapshotMeta(
              selectedName,
              subcategory,
              waterRpiRiverMonthlyRecords,
            )
          : activeCategory === "water" &&
              isWaterStationMap(activeCategory, subcategory)
            ? buildWaterQualityStationSnapshotMeta(
                selectedName,
                waterQualityStationRecords,
              )
            : buildInteractiveSnapshotMeta(
                activeCategory,
                selectedName,
                subcategory,
                effectiveMetric,
              ),
    [
      activeCategory,
      effectiveMetric,
      selectedName,
      subcategory,
      waterQualityStationRecords,
      waterRpiRiverMonthlyRecords,
      waterTownMonthlyRecords,
    ],
  );
  const isTimeSeries =
    activeCategory === "water" && isWaterTimeSeries(subcategory, selectedName);

  useEffect(() => {
    const timer = window.setTimeout(() => setPlaybackIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [activeCategory, effectiveMetric, subcategory]);

  useEffect(() => {
    if (!isTimeSeries || !isPlaying) return;
    const timer = window.setInterval(() => {
      setPlaybackIndex(
        (prev) => (prev + 1) % Math.max(snapshotMeta.chartData.length, 1),
      );
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isPlaying, isTimeSeries, snapshotMeta.chartData.length]);

  const maxValue = Math.max(
    ...snapshotMeta.chartData.map((point) => point.value),
    1,
  );
  const rainfallChartMaxValue = useMemo(
    () =>
      Math.max(
        ...waterTownMonthlyRecords.map((record) => record.rainfall),
        maxValue,
        1,
      ),
    [maxValue, waterTownMonthlyRecords],
  );
  const chartScaleMaxValue = isRainfallSubcategory
    ? rainfallChartMaxValue
    : maxValue;
  const dataStats = useMemo(
    () => getInteractiveDataStats(snapshotMeta.chartData),
    [snapshotMeta.chartData],
  );
  const activePlaybackPoint =
    snapshotMeta.chartData[playbackIndex] ?? snapshotMeta.chartData[0];
  const rainfallRegionFillMap = isRainfallSubcategory
    ? buildRainfallTownFillMap(
        waterTownMonthlyRecords,
        selectedName,
        activeStationMonthLabel,
      )
    : undefined;
  const rainfallLegendNode = isTimeSeries ? (
    <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2 text-[10px] font-black text-[#6d5e49] shadow-[0_10px_26px_rgba(45,41,34,0.08)]">
      <p className="mb-1 text-center tracking-[0.12em] text-[#7b5b37]">
        降雨量圖例
      </p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {cwaRainfallLegend.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1 whitespace-nowrap"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: item.color }}
            />
            {item.label}mm
          </span>
        ))}
      </div>
    </div>
  ) : null;
  const rpiLegendNode = isRpiSubcategory ? (
    <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf8] p-2 text-[10px] font-black text-[#6d5e49] shadow-[0_10px_26px_rgba(45,41,34,0.08)]">
      <p className="mb-1 text-center tracking-[0.12em] text-[#7b5b37]">
        RPI圖例
      </p>
      <div className="space-y-1">
        {rpiLegend.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: item.color }}
            />
            {item.label}｜{item.text}
          </span>
        ))}
      </div>
    </div>
  ) : null;
  const waterStatusText =
    activeCategory === "water"
      ? subcategory === "降雨量"
        ? getWaterRainfallStatusText(
            waterTownMonthlyRecords,
            selectedName,
            playbackIndex,
          )
        : isWaterRpiMap(activeCategory, subcategory)
          ? getWaterRpiStatusText(
              waterRpiRiverMonthlyRecords,
              selectedName,
              playbackIndex,
            )
          : isWaterStationMap(activeCategory, subcategory)
            ? getWaterQualityStationStatusText(
                waterQualityStationRecords,
                selectedName,
              )
            : getWaterSelectionStatusText(
                subcategory,
                selectedName,
                effectiveMetric,
                playbackIndex,
              )
      : "";
  const displayedWaterQualityStations = useMemo(
    () =>
      filterWaterQualityStationsByTown(
        waterQualityStationRecords,
        selectedName,
      ),
    [selectedName, waterQualityStationRecords],
  );
  const waterQualityStationSummary = useMemo(
    () =>
      getWaterQualityStationSummary(waterQualityStationRecords, selectedName),
    [selectedName, waterQualityStationRecords],
  );
  const waterQualityStationGroups = useMemo(() => {
    const grouped = new Map<string, WaterQualityStationStatusRecord[]>();
    displayedWaterQualityStations.forEach((station) => {
      const basinName = station.basin || "未知流域";
      grouped.set(basinName, [...(grouped.get(basinName) ?? []), station]);
    });

    return Array.from(grouped.entries())
      .map(([basinName, stations]) => ({
        basinName,
        stations: stations.sort((a, b) => {
          const townshipCompare = a.township.localeCompare(
            b.township,
            "zh-Hant",
          );
          if (townshipCompare !== 0) return townshipCompare;
          return a.siteName.localeCompare(b.siteName, "zh-Hant");
        }),
        active: stations.filter((station) => station.statusOfUse === "啟用")
          .length,
        inactive: stations.filter((station) => station.statusOfUse === "停用")
          .length,
      }))
      .sort((a, b) => {
        if (a.basinName === "未知流域") return 1;
        if (b.basinName === "未知流域") return -1;
        return a.basinName.localeCompare(b.basinName, "zh-Hant");
      });
  }, [displayedWaterQualityStations]);

  const handleOpenCapture = async () => {
    if (isSavingSnapshotImage) return;

    const mapTownValues = isRainfallSubcategory
      ? Object.fromEntries(
          getWaterTownRecordsForMonth(
            waterTownMonthlyRecords,
            activeStationMonthLabel,
          )
            .filter(
              (record) =>
                selectedName === ALL_WATER_TOWNS_LABEL ||
                record.town === selectedName,
            )
            .map((record) => [record.town, record.rainfall]),
        )
      : undefined;
    const mapRiverValues = isRpiSubcategory
      ? Object.fromEntries(
          getWaterRpiRecordsForMonth(
            waterRpiRiverMonthlyRecords,
            activeStationMonthLabel,
          )
            .filter(
              (record) =>
                selectedName === ALL_WATER_RPI_LABEL ||
                selectedName.startsWith("全部") ||
                record.river === selectedName,
            )
            .map((record) => [record.river, roundRpiValue(record.rpi)]),
        )
      : undefined;

    const nextSnapshot: EvidenceSnapshotMeta = {
      ...snapshotMeta,
      activeTimeIndex: isTimeSeries ? playbackIndex : undefined,
      interpretationText: waterStatusText,
      mapTownValues,
      mapRiverValues,
      showRegionLabels: isRpiSubcategory ? showWaterMapRegionLabels : undefined,
      waterQualityStations: isStationSubcategory
        ? filterWaterQualityStationsByTown(
            waterQualityStationRecords,
            selectedName,
          )
        : undefined,
      waterQualityStationListScrollTop: isStationSubcategory
        ? (waterQualityStationListRef.current?.scrollTop ?? 0)
        : undefined,
      waterQualityStationVisibleStationIds: isStationSubcategory
        ? getVisibleStationIdsFromScrollContainer(
            waterQualityStationListRef.current,
          )
        : undefined,
    };

    if (captureEffectTimerRef.current !== null) {
      window.clearTimeout(captureEffectTimerRef.current);
      captureEffectTimerRef.current = null;
    }
    if (capturePhaseTimerRef.current !== null) {
      window.clearTimeout(capturePhaseTimerRef.current);
      capturePhaseTimerRef.current = null;
    }

    if (isTimeSeries) setIsPlaying(false);
    setIsSavingSnapshotImage(true);
    setCaptureErrorMessage("");
    setCapturePreviewPhase("capturing");

    try {
      const captureTarget = captureAreaRef.current;
      if (!captureTarget) {
        throw new Error("找不到可擷取的互動數據區域");
      }

      const directCapturedImageDataUrl =
        await captureElementAsImageDataUrl(captureTarget);
      setCapturePreviewSnapshot(nextSnapshot);
      setCapturePreviewImageSrc(directCapturedImageDataUrl);
      setCapturePreviewPhase("capturing");
      capturePhaseTimerRef.current = window.setTimeout(() => {
        setCapturePreviewPhase("complete");
        capturePhaseTimerRef.current = null;
      }, 1700);

      let snapshotImageSrc = directCapturedImageDataUrl;
      let snapshotImageUrl = "";
      let snapshotRelativeUrl = "";
      let snapshotFilename = "";
      if (token) {
        const uploaded = await uploadClueSnapshotImage(token, {
          imageDataUrl: directCapturedImageDataUrl,
          title: nextSnapshot.filterLabel,
          meta: stripLargeSnapshotPayload(nextSnapshot),
        });
        snapshotImageUrl = uploaded.imageUrl;
        snapshotRelativeUrl = uploaded.relativeUrl;
        snapshotFilename = uploaded.filename;
        snapshotImageSrc = uploaded.imageUrl;
      }

      const compactSnapshot = stripLargeSnapshotPayload({
        ...nextSnapshot,
        photoSnapshotImageUrl:
          snapshotImageUrl || nextSnapshot.photoSnapshotImageUrl,
        photoSnapshotRelativeUrl:
          snapshotRelativeUrl || nextSnapshot.photoSnapshotRelativeUrl,
        photoSnapshotFilename:
          snapshotFilename || nextSnapshot.photoSnapshotFilename,
      });

      // 先讓學生看見「畫面擷取中 → 擷取完成」的完整掃描演出，
      // 再把畫面交給下方卡片清單接續捲動與閃爍。
      await waitForUiSequence(3050);

      onCreateSnapshotCard(
        compactSnapshot,
        "系統自動擷取互動式數據探索畫面，已直接建立為解鎖線索卡。",
        snapshotImageSrc,
      );
    } catch (error) {
      console.error(
        "直接擷取互動數據畫面失敗，未建立快照卡，避免產生與畫面不一致的重畫圖。",
        error,
      );
      setCaptureErrorMessage(
        "目前瀏覽器無法直接擷取這個畫面，請重新整理後再試一次。這次沒有建立重畫版快照卡，避免和畫面不一致。",
      );
    } finally {
      captureEffectTimerRef.current = window.setTimeout(() => {
        setCapturePreviewSnapshot(null);
        setCapturePreviewImageSrc("");
        setCapturePreviewPhase("capturing");
        captureEffectTimerRef.current = null;
      }, 520);
      setIsSavingSnapshotImage(false);
    }
  };

  return (
    <>
      <section
        className={`mb-4 flex min-h-[clamp(760px,calc(100svh-96px),900px)] flex-col rounded-[24px] border p-2 shadow-[0_12px_32px_rgba(45,41,34,0.09)] sm:p-3 ${EVIDENCE_CREATOR_THEME.section}`}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className={`mb-2 inline-flex rounded-full px-3 py-1 text-xs font-black tracking-[0.14em] ${EVIDENCE_CREATOR_THEME.badge}`}
            >
              互動式數據探索
            </p>
            <h2 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
              建立自己的證據卡
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              onClick={handleOpenCapture}
              disabled={isSavingSnapshotImage}
              className={EVIDENCE_CREATOR_THEME.primaryButton}
            >
              {isSavingSnapshotImage ? "正在擷取線索..." : "擷取線索"}
            </Button>
            {captureErrorMessage ? (
              <p className="max-w-[360px] rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-black leading-5 text-red-700">
                {captureErrorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className={EVIDENCE_CREATOR_THEME.surface}>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
                  選擇地區以及想看的數據類型
                </h3>
              </div>
              <p className="rounded-full border border-[#d8cbb3] bg-[#fffaf0] px-3 py-1.5 text-xs font-black text-[#6d5e49]">
                目前：{selectedName}
              </p>
            </div>

            <div className="grid gap-4 min-[680px]:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-black text-[#4a3828]">
                  顯示區域數據
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectorOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSelectedName(item)}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        selectedName === item
                          ? "border-[#6f7d5f] bg-[#edf5df] text-[#445236] shadow-sm"
                          : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49] hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-black text-[#4a3828]">
                  數據分類與面向
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.subcategories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSubcategory(item);
                        if (activeCategory === "water") {
                          setMetric(getWaterMetricForSubcategory(item));
                          setSelectedName(
                            item === "降雨量"
                              ? ALL_WATER_TOWNS_LABEL
                              : item === "水質監測站"
                                ? ALL_WATER_QUALITY_STATIONS_LABEL
                                : getWaterSelectionConfig(item).allLabel,
                          );
                        }
                      }}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition ${
                        subcategory === item
                          ? "border-[#9b7b55] bg-[#fff0cf] text-[#5f4528] shadow-sm"
                          : "border-[#e2d4bd] bg-[#fffdf8] text-[#6d5e49] hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeCategory !== "water" ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-black tracking-[0.14em] text-[#7b5b37]">
                  指標
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.metrics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMetric(item)}
                      className={`min-h-[42px] min-w-[96px] rounded-2xl border px-4 py-2 text-sm font-black transition ${
                        metric === item
                          ? "border-[#9b7b55] bg-[#fff0cf] text-[#5f4528]"
                          : "border-[#d8cbb3] bg-[#fffdf8] text-stone-600 hover:bg-[#fff4df]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div
            ref={captureAreaRef}
            className="uiux-inquiry-stage-grid uiux-map-chart-stage flex-1"
          >
            <WaterMapPanel
              theme={EVIDENCE_CREATOR_THEME}
              selectedName={selectedName}
              mapTitle={
                isRainfallSubcategory
                  ? "地區降雨量時間地圖"
                  : isRpiSubcategory
                    ? `${subcategory}位置圖`
                    : isStationSubcategory
                      ? "水質監測站位置圖"
                      : "地圖位置預覽"
              }
              selectedTownForDistrictMap={
                isTownSelection(activeCategory, subcategory) ? selectedName : ""
              }
              isRpiSubcategory={isRpiSubcategory}
              isRainfallSubcategory={isRainfallSubcategory}
              isStationSubcategory={isStationSubcategory}
              isTimeSeries={isTimeSeries}
              activePlaybackLabel={activePlaybackPoint?.label}
              shouldControlRegionLabels={shouldControlWaterMapRegionLabels}
              showRegionLabels={showWaterMapRegionLabels}
              onToggleRegionLabels={() =>
                setShowWaterMapRegionLabels((prev) => !prev)
              }
              onSelectRiver={(nextSelection) => setSelectedName(nextSelection)}
              onSelectTown={(nextTown) => {
                if (activeCategory === "water" && subcategory === "降雨量") {
                  if (INTERACTIVE_TOWN_OPTIONS.includes(nextTown))
                    setSelectedName(nextTown);
                  return;
                }
                if (isTownSelection(activeCategory, subcategory))
                  setSelectedName(nextTown);
              }}
              onSelectMarker={(nextSelection) => {
                if (
                  activeCategory === "water" &&
                  (subcategory === "降雨量" ||
                    isWaterStationMap(activeCategory, subcategory))
                ) {
                  setSelectedName(nextSelection);
                }
              }}
              rpiOverlay={{
                areas: mapOverlay.areas,
                markers: mapOverlay.markers,
              }}
              districtOverlay={mapOverlay}
              rpiLegendNode={rpiLegendNode}
              rainfallLegendNode={rainfallLegendNode}
              rainfallRegionFillMap={rainfallRegionFillMap}
            />

            <WaterChartPanel
              activeCategory={activeCategory}
              activePlaybackPoint={activePlaybackPoint}
              chartScaleMaxValue={chartScaleMaxValue}
              dataStats={dataStats}
              displayedWaterQualityStations={displayedWaterQualityStations}
              evidenceCreatorTheme={EVIDENCE_CREATOR_THEME}
              formatRpiNumber={formatRpiNumber}
              getInteractiveChartFillHex={getInteractiveChartFillHex}
              getRainfallLevelColor={getRainfallLevelColor}
              getRpiLevel={getRpiLevel}
              getWaterQualityStationStatusColor={
                getWaterQualityStationStatusColor
              }
              isPlaying={isPlaying}
              isRainfallSubcategory={isRainfallSubcategory}
              isRpiSubcategory={isRpiSubcategory}
              isStationSubcategory={isStationSubcategory}
              isTimeSeries={isTimeSeries}
              playbackIndex={playbackIndex}
              selectedName={selectedName}
              setIsPlaying={setIsPlaying}
              setPlaybackIndex={setPlaybackIndex}
              snapshotMeta={snapshotMeta}
              waterQualityStationGroups={waterQualityStationGroups}
              waterQualityStationListRef={waterQualityStationListRef}
              waterQualityStationSummary={waterQualityStationSummary}
              waterStatusText={waterStatusText}
              waterUnifiedCard={WATER_UNIFIED_CARD}
            />
          </div>
        </div>
      </section>

      <SnapshotCaptureOverlay
        snapshot={capturePreviewSnapshot}
        imageSrc={capturePreviewImageSrc}
        phase={capturePreviewPhase}
        buildSnapshotSvgDataUrl={buildSnapshotSvgDataUrl}
      />
    </>
  );
}

function TitleRewardCelebration({ reward }: { reward: TitleReward | null }) {
  const style = getTitleMedalStyle(reward ?? "cross_novice");

  return (
    <AnimatePresence>
      {reward ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2f2418]/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          transition={{ duration: 0.55 }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.08, x: "42vw", y: "38vh", opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md origin-center title-reward-popup"
          >
            <motion.div
              className="absolute left-8 top-8 text-2xl"
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              ★
            </motion.div>
            <motion.div
              className="absolute right-6 top-10 text-xl"
              initial={{ scale: 0, rotate: 45, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              ★
            </motion.div>

            <div className="relative overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] px-7 py-8 text-center shadow-[0_24px_70px_rgba(45,41,34,0.22)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.95),transparent_44%)] opacity-80" />

              <motion.div
                initial={{ rotate: -12, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 260,
                  damping: 14,
                }}
                className="relative mx-auto mb-4 flex w-32 flex-col items-center"
              >
                <div
                  className={`relative z-10 mb-[-10px] flex h-28 w-28 items-center justify-center rounded-full border-[5px] ${style.border} bg-gradient-to-br ${style.metal} text-5xl shadow-[inset_0_5px_12px_rgba(255,255,255,0.75),inset_0_-12px_16px_rgba(0,0,0,0.16),0_18px_30px_rgba(45,41,34,0.22)]`}
                >
                  <div className="absolute inset-3 rounded-full border border-white/60" />
                  <div
                    className={`absolute inset-[26px] rounded-full border border-white/70 bg-gradient-to-br ${style.shine}`}
                  />
                  <motion.span
                    className={`relative z-10 flex h-full w-full items-center justify-center ${style.starText}`}
                    animate={{ scale: [1, 1.18, 1] }}
                    transition={{ delay: 0.45, duration: 0.5 }}
                  >
                    <TitleMedalStars stars={style.stars} variant="large" />
                  </motion.span>
                </div>

                <div className="relative flex w-24 justify-center">
                  <div
                    className={`h-12 w-9 origin-top rotate-[8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-md`}
                  />
                  <div
                    className={`-ml-2 h-12 w-9 origin-top rotate-[-8deg] bg-gradient-to-b ${style.ribbon} [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-md`}
                  />
                </div>
              </motion.div>

              <p
                className={`relative mx-auto mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-[0.2em] ${style.border} ${style.text} bg-white/60`}
              >
                {style.rank}
              </p>

              <h2 className="relative font-serif text-3xl font-bold tracking-[0.08em] text-[#332c24]">
                {reward.name}
              </h2>

              <p className="relative mt-2 text-sm font-semibold leading-6 text-[#746855]">
                {reward.description}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

const loadedImageCategoryKeys = new Set<CategoryKey>();
const preloadedCardImageSrcs = new Set<string>();
const preloadingCardImageSrcs = new Set<string>();

function markPreloadedCategoryIfComplete(
  category: CategoryKey,
  imageSrcsByCategory: Record<CategoryKey, string[]>,
) {
  const categoryImageSrcs = imageSrcsByCategory[category];
  if (categoryImageSrcs.every((src) => preloadedCardImageSrcs.has(src))) {
    loadedImageCategoryKeys.add(category);
  }
}

type ImagePreloadPriority = "gentle" | "fast";

function preloadGameCardImages(
  cardsToPreload: GameCard[],
  priority: ImagePreloadPriority = "gentle",
) {
  if (typeof window === "undefined") return () => undefined;

  const imageSrcsByCategory = CATEGORY_KEYS.reduce(
    (groupedSrcs, category) => {
      groupedSrcs[category] = cardsToPreload
        .filter((card) => card.category === category)
        .map((card) => card.imageSrc);
      return groupedSrcs;
    },
    {} as Record<CategoryKey, string[]>,
  );

  // 讓四個分類平均預載，而不是先把水資源全部載完才輪到後面的分類。
  // 這樣學生很快進入數據探究時，石虎資料 / NPC 傳言也會先有前幾列圖片快取，
  // 點分類時的展開效果才會和水資源、動物資料一致。
  const maxCategoryImageCount = Math.max(
    ...CATEGORY_KEYS.map((category) => imageSrcsByCategory[category].length),
  );
  const orderedImageJobs = Array.from({ length: maxCategoryImageCount })
    .flatMap((_, index) =>
      CATEGORY_KEYS.flatMap((category) => {
        const src = imageSrcsByCategory[category][index];
        return src ? [{ category, src }] : [];
      }),
    )
    .filter(({ src }) => !preloadedCardImageSrcs.has(src));

  if (orderedImageJobs.length === 0) {
    CATEGORY_KEYS.forEach((category) =>
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory),
    );
    return () => undefined;
  }

  let didCancel = false;
  let nextJobIndex = 0;
  let cancelIdleBatch = () => undefined as void;
  let batchTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const preloadOneImage = (category: CategoryKey, src: string) => {
    if (preloadedCardImageSrcs.has(src) || preloadingCardImageSrcs.has(src)) {
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory);
      return;
    }

    preloadingCardImageSrcs.add(src);
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";

    const markDone = () => {
      preloadingCardImageSrcs.delete(src);
      preloadedCardImageSrcs.add(src);
      markPreloadedCategoryIfComplete(category, imageSrcsByCategory);
    };

    image.onload = markDone;
    image.onerror = markDone;
    image.src = src;

    // decode() 會把圖片解碼工作提前做掉，避免點分類展開時才解碼造成頓一下。
    if (typeof image.decode === "function") {
      void image
        .decode()
        .then(markDone)
        .catch(() => undefined);
    }
  };

  const runBatch = () => {
    if (didCancel) return;

    const batchSize = priority === "fast" ? 10 : 4;
    const batchDelay = priority === "fast" ? 24 : 120;
    const batchEnd = Math.min(
      nextJobIndex + batchSize,
      orderedImageJobs.length,
    );

    for (; nextJobIndex < batchEnd; nextJobIndex += 1) {
      const job = orderedImageJobs[nextJobIndex];
      preloadOneImage(job.category, job.src);
    }

    if (nextJobIndex >= orderedImageJobs.length) return;

    batchTimer = globalThis.setTimeout(() => {
      cancelIdleBatch = runWhenBrowserIsIdle(
        runBatch,
        priority === "fast" ? 80 : 240,
      );
    }, batchDelay);
  };

  cancelIdleBatch = runWhenBrowserIsIdle(
    runBatch,
    priority === "fast" ? 80 : 240,
  );

  return () => {
    didCancel = true;
    cancelIdleBatch();
    if (batchTimer !== null) globalThis.clearTimeout(batchTimer);
  };
}

type BrowserIdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function runWhenBrowserIsIdle(callback: () => void, timeout = 240) {
  if (typeof window === "undefined") return () => undefined;

  const browserWindow = window as BrowserIdleWindow;
  let didCancel = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let idleId: number | null = null;

  const run = () => {
    if (!didCancel) callback();
  };

  if (typeof browserWindow.requestIdleCallback === "function") {
    idleId = browserWindow.requestIdleCallback(run, { timeout });
  } else {
    timeoutId = globalThis.setTimeout(run, timeout);
  }

  return () => {
    didCancel = true;
    if (
      idleId !== null &&
      typeof browserWindow.cancelIdleCallback === "function"
    ) {
      browserWindow.cancelIdleCallback(idleId);
    }
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  };
}

function getRewardChecks(unlockedCountByCategory: Record<CategoryKey, number>) {
  const categoryChecks = TITLE_REWARD_CATEGORY_KEYS.flatMap((category) => [
    {
      reward: titleRewardPool[`${category}_novice`],
      isUnlocked: unlockedCountByCategory[category] >= 3,
    },
    {
      reward: titleRewardPool[`${category}_advanced`],
      isUnlocked: unlockedCountByCategory[category] >= 7,
    },
    {
      reward: titleRewardPool[`${category}_master`],
      isUnlocked: unlockedCountByCategory[category] >= 10,
    },
  ]);

  const crossChecks = [
    { reward: titleRewardPool.cross_novice, threshold: 2 },
    { reward: titleRewardPool.cross_advanced, threshold: 4 },
    { reward: titleRewardPool.cross_master, threshold: 6 },
  ].map(({ reward, threshold }) => ({
    reward,
    isUnlocked: TITLE_REWARD_CATEGORY_KEYS.every(
      (category) => unlockedCountByCategory[category] >= threshold,
    ),
  }));

  return [...categoryChecks, ...crossChecks];
}

const MemoizedBalanceScaleBackground = memo(BalanceScaleBackground);
const MemoizedCategoryTabs = memo(CategoryTabs);
const MemoizedCollectedCardsPanel = memo(CollectedCardsPanel);
const MemoizedTrophyPanel = memo(TrophyPanel);
const MemoizedTitleRewardCelebration = memo(TitleRewardCelebration);
const MemoizedCollectedCardPreview = memo(CollectedCardPreview);

function getRecordText(
  records: InquiryIntroStageRecordItem[],
  type: InquiryIntroStageRecordItem["type"],
  occurrence = 0,
) {
  const matches = records.filter((record) => record.type === type);
  const target = matches[occurrence];
  if (!target) return "";
  return Array.isArray(target.content)
    ? target.content.join("、")
    : String(target.content || "");
}

function getRecordOptions(records: InquiryIntroStageRecordItem[]) {
  const target = records.find((record) => record.type === "selectedOptions");
  if (!target) return [] as string[];
  return Array.isArray(target.content)
    ? target.content.map(String).filter(Boolean)
    : String(target.content || "")
        .split("、")
        .map((item) => item.trim())
        .filter(Boolean);
}

function getUniqueDisplayParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts
    .map((part) => String(part || "").trim())
    .filter((part) => {
      if (!part) return false;
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    });
}

function getTask2SuspectDisplayText(
  selectedOptions: string[],
  otherText: string,
) {
  const cleanedOtherText = String(otherText || "").trim();
  const optionParts = selectedOptions
    .map((option) => String(option || "").trim())
    .filter((option) => option && option !== "其他");
  return (
    getUniqueDisplayParts([...optionParts, cleanedOtherText]).join("、") ||
    "我不確定"
  );
}

function getIntroStageDisplay(introStage?: InquiryIntroStageRecord | null) {
  const emptyDisplay = {
    firstTitle: "1. 目前案件階段",
    firstAnswer: "",
    secondTitle: "2. 我的初步線索",
    secondAnswer: "",
  };

  if (!introStage) return emptyDisplay;

  const records = Array.isArray(introStage.records) ? introStage.records : [];
  const mainChoice = getRecordText(records, "mainChoice") || "";

  const selectedOptions = getRecordOptions(records);
  const answer = getRecordText(records, "answer") || "";
  const textInputs = records
    .filter((record) => record.type === "textInput")
    .map((record) =>
      Array.isArray(record.content)
        ? record.content.join("、")
        : String(record.content || ""),
    )
    .filter(Boolean);
  const firstTextInput = textInputs[0] || "";
  const secondTextInput = textInputs[1] || "";

  if (mainChoice.startsWith("任務一：")) {
    return {
      firstTitle: "1. 任務階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 一開始的想法",
      secondAnswer: firstTextInput || answer || "沒有，從調查危機開始",
    };
  }

  if (mainChoice.startsWith("任務二：")) {
    return {
      firstTitle: "1. 任務階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我目前懷疑的對象是",
      secondAnswer: getTask2SuspectDisplayText(selectedOptions, firstTextInput),
    };
  }

  if (mainChoice.startsWith("任務三：")) {
    return {
      firstTitle: "1. 任務階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我想追查的證據方向是",
      secondAnswer: firstTextInput || answer,
    };
  }

  if (mainChoice.startsWith("任務四：")) {
    return {
      firstTitle: "1. 任務階段",
      firstAnswer: mainChoice,
      secondTitle: answer === "有" ? "2. 我改變的想法是" : "2. 我更加確定的是",
      secondAnswer: firstTextInput || answer,
    };
  }

  if (mainChoice.startsWith("延伸探究")) {
    return {
      firstTitle: "1. 探究階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 這次探究目的",
      secondAnswer: firstTextInput,
    };
  }

  if (mainChoice === "案件二：鎖定嫌疑" || mainChoice === "我想揪出凶手") {
    const rawParts = [
      answer,
      selectedOptions.length > 0 ? selectedOptions.join("、") : "",
      secondTextInput || firstTextInput,
    ].filter(Boolean);

    return {
      firstTitle: "1. 目前案件階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我鎖定的嫌疑因素與原因是",
      secondAnswer: rawParts.join("｜"),
    };
  }

  if (
    mainChoice === "我想調查潛在危機" ||
    mainChoice === "我想調查淺在危機" ||
    mainChoice === "調查可能的潛在危機" ||
    mainChoice === "調查可能的淺在危機"
  ) {
    return {
      firstTitle: "1. 目前案件階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我目前發現的危機線索是",
      secondAnswer: firstTextInput,
    };
  }

  if (mainChoice === "我還不確定") {
    return {
      firstTitle: "1. 目前案件階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我的想法是",
      secondAnswer: "沒甚麼想法",
    };
  }

  if (mainChoice === "其他探究目的") {
    return {
      firstTitle: "1. 目前案件階段",
      firstAnswer: mainChoice,
      secondTitle: "2. 我的補充想法是",
      secondAnswer: firstTextInput,
    };
  }

  return {
    firstTitle: "1. 目前案件階段",
    firstAnswer: mainChoice,
    secondTitle: "2. 我初始的想法是",
    secondAnswer: firstTextInput || answer,
  };
}

export default function InquiryData({
  token,
  orientationMainChoice = "",
  orientationTextInput = "",
  currentInquiryOrder = 1,
  draftStorageKey,
  onInquiryPlanCreated,
  onBackToHome,
  onSubmitSummary,
  onTitleRewardsChange,
  unlockedCardIds,
  setUnlockedCardIds,
  onActivityLog,
  onAiHelperAvailabilityChange,
  inquiryRecordOrder = null,
}: InquiryDataProps) {
  const currentCase = getInvestigationCaseByOrder(currentInquiryOrder);
  const [initialDraft] = useState<InquiryDataDraft | null>(() =>
    readInquiryDataDraft(draftStorageKey, currentInquiryOrder),
  );
  const [flowStage, setFlowStage] = useState<InquiryFlowStage>(
    initialDraft?.flowStage ?? "purpose",
  );
  const [introStage, setIntroStage] = useState<InquiryIntroStageRecord | null>(
    initialDraft?.introStage ?? null,
  );
  const [orientationCreatedAt, setOrientationCreatedAt] = useState<
    string | null
  >(initialDraft?.orientationCreatedAt ?? null);
  const [inquiryPurpose, setInquiryPurpose] = useState<InquiryPurpose>(
    initialDraft?.inquiryPurpose ?? "",
  );
  const [suspectAnswer, setSuspectAnswer] = useState<SuspectAnswer>(
    initialDraft?.suspectAnswer ?? "",
  );
  const [selectedSuspects, setSelectedSuspects] = useState<string[]>(
    initialDraft?.selectedSuspects ?? [],
  );
  const [task3Targets, setTask3Targets] = useState<string[]>(
    initialDraft?.task3Targets ?? [],
  );
  const [suspectReason, setSuspectReason] = useState(
    initialDraft?.suspectReason ?? "",
  );
  const [suspectOtherDraft, setSuspectOtherDraft] = useState(
    initialDraft?.suspectOtherDraft ?? "",
  );
  const [suspectOtherText, setSuspectOtherText] = useState(
    initialDraft?.suspectOtherText ?? "",
  );
  const [task3OtherDraft, setTask3OtherDraft] = useState(
    initialDraft?.task3OtherDraft ?? "",
  );
  const [task3OtherText, setTask3OtherText] = useState(
    initialDraft?.task3OtherText ?? "",
  );
  const [possibleCrisis, setPossibleCrisis] = useState(
    initialDraft?.possibleCrisis ?? "",
  );
  const [otherPurpose, setOtherPurpose] = useState(
    initialDraft?.otherPurpose ?? "",
  );
  const [readyMessage, setReadyMessage] = useState(
    initialDraft?.readyMessage ?? "準備好成為一位優秀的調查員了嗎？",
  );
  const [isFinished, setIsFinished] = useState(
    initialDraft?.isFinished ?? false,
  );
  const [conclusion, setConclusion] = useState(initialDraft?.conclusion ?? "");
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [dataListCountdownDeadline, setDataListCountdownDeadline] = useState<
    number | null
  >(null);
  const [dataListRemainingMs, setDataListRemainingMs] = useState(
    DATA_LIST_COUNTDOWN_MS,
  );
  const [dataListTimerNotice, setDataListTimerNotice] = useState<
    "three" | "one" | "done" | null
  >(null);
  const dataListTimerWarnedRef = useRef({
    three: false,
    one: false,
    done: false,
  });
  const onActivityLogRef = useRef(onActivityLog);

  useEffect(() => {
    onActivityLogRef.current = onActivityLog;
  }, [onActivityLog]);

  useEffect(() => {
    const isAiHelperAvailable = flowStage === "cards" && !isFinished;
    onAiHelperAvailabilityChange?.(isAiHelperAvailable);
  }, [flowStage, isFinished, onAiHelperAvailabilityChange]);

  useEffect(() => {
    return () => onAiHelperAvailabilityChange?.(false);
  }, [onAiHelperAvailabilityChange]);
  const [flippedEvidenceIds, setFlippedEvidenceIds] = useState<string[]>(
    initialDraft?.flippedEvidenceIds ?? [],
  );
  const [evidencePreviewFlippedIds, setEvidencePreviewFlippedIds] = useState<
    string[]
  >([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>(
    initialDraft?.selectedEvidenceIds ?? [],
  );
  const [confirmedEvidenceIds, setConfirmedEvidenceIds] = useState<string[]>(
    initialDraft?.confirmedEvidenceIds ?? [],
  );
  const [currentRoundCardIds, setCurrentRoundCardIds] = useState<string[]>(
    initialDraft?.currentRoundCardIds ?? [],
  );
  const [collectionReflectionRecords, setCollectionReflectionRecords] =
    useState<CollectionReflectionRecord[]>(
      initialDraft?.collectionReflectionRecords ?? [],
    );
  const [showCollectionReflectionPrompt, setShowCollectionReflectionPrompt] =
    useState(false);
  const [
    pendingCollectionReflectionCardIds,
    setPendingCollectionReflectionCardIds,
  ] = useState<string[]>([]);
  const [collectionReflectionText, setCollectionReflectionText] = useState("");
  const [
    returnToFinishAfterCollectionReflection,
    setReturnToFinishAfterCollectionReflection,
  ] = useState<"none" | "confirm" | "summary">("none");
  const [cards, setCards] = useState<GameCard[]>(
    initialDraft?.cards ?? createAllCards,
  );

  useEffect(() => {
    if (isFinished) return;

    // 在學生回答前導問題、閱讀準備頁時，就先用瀏覽器空閒時間預載與解碼卡牌圖片。
    // 這樣真正點擊分類展開時，畫面主要只需要做 DOM/動畫，不會再被圖片載入卡住。
    const preloadPriority: ImagePreloadPriority =
      flowStage === "cards" ? "fast" : "gentle";

    // 只預載固定圖片清單，不綁 cards 狀態。
    // cards 會因解鎖、輸入內容、同步資料而更新；若把 cards 放進 dependency，
    // 預載排程會被反覆取消/重建，分類切換時更容易和動畫搶主執行緒。
    return preloadGameCardImages(ALL_CARD_IMAGE_PRELOAD_CARDS, preloadPriority);
  }, [flowStage, isFinished]);

  useEffect(() => {
    if (unlockedCardIds.length === 0) return;

    const timer = window.setTimeout(() => {
      setCards((prev) => {
      const cardMap = new Map(prev.map((card) => [card.id, card]));

      unlockedCardIds.forEach((savedCard) => {
        const savedId =
          typeof savedCard === "string" ? savedCard : savedCard.id;
        const existing = cardMap.get(savedId);

        if (existing) {
          const isSavedString = typeof savedCard === "string";
          const shouldBeUnlocked = isSavedString
            ? true
            : Boolean(savedCard.unlocked ?? true);

          cardMap.set(savedId, {
            ...existing,
            unlocked: shouldBeUnlocked,
            content: isSavedString
              ? existing.content
              : getStoredCardContent(savedCard) || existing.content,
            unlockedAt: shouldBeUnlocked
              ? isSavedString
                ? (existing.unlockedAt ?? nowIsoTimestamp())
                : (toIsoTimestamp(savedCard.unlockedAt) ??
                  existing.unlockedAt ??
                  nowIsoTimestamp())
              : null,
            imageSrc: isSavedString
              ? existing.imageSrc
              : getStoredCardImage(savedCard) || existing.imageSrc,
            sourceType: isSavedString
              ? (existing.sourceType ?? "fixedImage")
              : (getStoredCardSource(savedCard) ??
                existing.sourceType ??
                "fixedImage"),
            snapshotMeta: isSavedString
              ? existing.snapshotMeta
              : (getStoredCardSnapshot(savedCard) ?? existing.snapshotMeta),
            sharedFromOtherPlayer: isSavedString
              ? existing.sharedFromOtherPlayer
              : Boolean(savedCard.sharedFromOtherPlayer),
            sharedAuthorName: isSavedString
              ? existing.sharedAuthorName
              : (savedCard.sharedAuthorName ?? existing.sharedAuthorName),
          });
          return;
        }

        if (typeof savedCard !== "string") {
          const dynamicCard = createCardFromStoredSnapshotCard(savedCard, {
            buildSnapshotSvgDataUrl,
            isCategoryKey,
          }) as GameCard | null;
          if (dynamicCard) cardMap.set(dynamicCard.id, dynamicCard);
        }
      });

        return Array.from(cardMap.values());
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [unlockedCardIds]);

  useEffect(() => {
    if (!initialDraft) return;

    const draftUnlockedCards = initialDraft.cards
      .filter((card) => card.unlocked)
      .map((card) => serializeUnlockedCard(card, currentInquiryOrder));

    if (draftUnlockedCards.length === 0) return;

    setUnlockedCardIds((prev) => {
      const nextById = new Map<string, (typeof draftUnlockedCards)[number]>();

      prev.forEach((item) => {
        if (typeof item === "string") {
          nextById.set(item, {
            id: item,
            content: "",
            unlockedAt: nowIsoTimestamp(),
            unlockedInInquiryOrder: currentInquiryOrder,
          });
        } else {
          nextById.set(item.id, {
            ...item,
            id: item.id,
            content: getStoredCardContent(item),
            unlockedAt: toIsoTimestamp(item.unlockedAt) ?? nowIsoTimestamp(),
            unlockedInInquiryOrder: getStoredCardRound(
              item,
              currentInquiryOrder,
            ),
          });
        }
      });

      draftUnlockedCards.forEach((item) => nextById.set(item.id, item));
      return Array.from(nextById.values());
    });
  }, [currentInquiryOrder, initialDraft, setUnlockedCardIds]);

  // 進入數據探究頁時不要自動恢復上次停留的分類，
  // 避免一進頁面就渲染分類卡片並開始載入 21～30 張圖片。
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(
    null,
  );
  const [mountedCategories, setMountedCategories] = useState<Set<CategoryKey>>(
    () => new Set(),
  );
  const [activeId, setActiveId] = useState<string | null>(
    initialDraft?.activeId ?? null,
  );
  const [isModalReady, setIsModalReady] = useState(false);
  const [inputValue, setInputValue] = useState(initialDraft?.inputValue ?? "");
  const [newInputValue, setNewInputValue] = useState(
    initialDraft?.newInputValue ?? "",
  );
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [justUnlockedId, setJustUnlockedId] = useState<string | null>(null);
  const [flashingSnapshotCardId, setFlashingSnapshotCardId] = useState<
    string | null
  >(null);
  const [categoryFlipKey, setCategoryFlipKey] = useState<CategoryKey | null>(
    null,
  );
  const [developmentScore, setDevelopmentScore] = useState(
    initialDraft?.developmentScore ?? 0,
  );
  const [conservationScore, setConservationScore] = useState(
    initialDraft?.conservationScore ?? 0,
  );
  const [earnedTitles, setEarnedTitles] = useState<TitleReward[]>(
    (initialDraft?.earnedTitles ?? []).filter(isSupportedInquiryTitleReward),
  );
  const [pendingReward, setPendingReward] = useState<TitleReward | null>(null);
  const [previewCard, setPreviewCard] = useState<GameCard | null>(null);
  const [hasNewCollectedContent, setHasNewCollectedContent] = useState(
    initialDraft?.hasNewCollectedContent ?? false,
  );
  const [hasNewTitleReward, setHasNewTitleReward] = useState(
    initialDraft?.hasNewTitleReward ?? false,
  );
  const shouldShowTitleRewardAnimationRef = useRef(false);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotCardScrollTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastSavedDraftJsonRef = useRef<string | null>(null);
  const hasInitializedInquiryHistoryRef = useRef(false);
  const [showFallingLock, setShowFallingLock] = useState(false);
  const [showUnlockBurst, setShowUnlockBurst] = useState(false);
  const pendingCardUpdateRef = useRef<null | {
    targetCard: GameCard;
    content: string;
    wasUnlocked: boolean;
  }>(null);
  const evidenceSwipeRef = useRef<null | {
    cardId: string;
    startX: number;
    startY: number;
    pointerId: number;
  }>(null);

  const {
    categoryCardsByCategory,
    unlockedCountByCategory,
    totalCountByCategory,
    totalUnlockedCount,
    totalCardCount,
    unlockedCardsWithContent,
    allUnlockedCardsWithContent,
    confirmedEvidenceCards,
    activeCard,
    pendingCollectionReflectionCards,
  } = useCardDerivedData({
    cards,
    confirmedEvidenceIds,
    currentRoundCardIds,
    activeId,
    pendingCollectionReflectionCardIds,
  });

  const getCollectionReflectionForCard = useCallback(
    (cardId: string) =>
      collectionReflectionRecords.find((record) =>
        record.cardIds.includes(cardId),
      ) || null,
    [collectionReflectionRecords],
  );

  const getCollectionReflectionReasonForCard = useCallback(
    (cardId: string) =>
      getCollectionReflectionForCard(cardId)?.reason ||
      "這張卡還沒有完成同批蒐集理由。",
    [getCollectionReflectionForCard],
  );

  useStableScrollbarGutter();

  useInquiryDraftAutosave<InquiryDataDraft>({
    storageKey: draftStorageKey,
    buildDraft: () => ({
      version: 1,
      savedAt: Date.now(),
      currentInquiryOrder,
      flowStage,
      isFinished,
      introStage,
      orientationCreatedAt,
      inquiryPurpose,
      suspectAnswer,
      selectedSuspects,
      task3Targets,
      suspectReason,
      suspectOtherDraft,
      suspectOtherText,
      task3OtherDraft,
      task3OtherText,
      possibleCrisis,
      otherPurpose,
      readyMessage,
      conclusion,
      flippedEvidenceIds,
      selectedEvidenceIds,
      confirmedEvidenceIds,
      currentRoundCardIds,
      collectionReflectionRecords,
      cards: getCompactDraftCards(cards),
      activeCategory: null,
      activeId: null,
      inputValue,
      newInputValue,
      developmentScore,
      conservationScore,
      earnedTitles,
      hasNewCollectedContent,
      hasNewTitleReward,
    }),
    buildFallbackDraft: (draft) => ({ ...draft, cards: [] }),
    lastSavedJsonRef: lastSavedDraftJsonRef,
    delay: 900,
    deps: [
      cards,
      confirmedEvidenceIds,
      conservationScore,
      currentRoundCardIds,
      collectionReflectionRecords,
      currentInquiryOrder,
      developmentScore,
      earnedTitles,
      conclusion,
      flippedEvidenceIds,
      flowStage,
      hasNewCollectedContent,
      hasNewTitleReward,
      inputValue,
      orientationCreatedAt,
      inquiryPurpose,
      introStage,
      isFinished,
      newInputValue,
      otherPurpose,
      possibleCrisis,
      readyMessage,
      selectedEvidenceIds,
      selectedSuspects,
      suspectAnswer,
      suspectReason,
      suspectOtherDraft,
      suspectOtherText,
      task3OtherDraft,
      task3OtherText,
      task3Targets,
    ],
  });

  const applyInquiryStage = useCallback((stage: InquiryHistoryStage) => {
    setShowFinishConfirm(false);
    setShowSubmitConfirm(false);

    if (stage === "summary") {
      setFlowStage("cards");
      setIsFinished(true);
      return;
    }

    setIsFinished(false);
    setFlowStage(stage);
  }, [setFlowStage, setIsFinished, setShowFinishConfirm, setShowSubmitConfirm]);

  const writeInquiryHistory = useCallback(
    (stage: InquiryHistoryStage, mode: "push" | "replace" = "push") => {
      const currentState =
        typeof window.history.state === "object" && window.history.state
          ? window.history.state
          : {};

      const nextState = {
        ...currentState,
        page: "cards",
        inquiryStage: stage,
      };

      if (mode === "replace") {
        window.history.replaceState(nextState, "", window.location.href);
      } else {
        window.history.pushState(nextState, "", window.location.href);
      }
    },
    [],
  );

  const goInquiryStage = useCallback(
    (stage: InquiryHistoryStage, mode: "push" | "replace" = "push") => {
      applyInquiryStage(stage);
      writeInquiryHistory(stage, mode);
    },
    [applyInquiryStage, writeInquiryHistory],
  );

  useEffect(() => {
    if (hasInitializedInquiryHistoryRef.current) return;
    hasInitializedInquiryHistoryRef.current = true;

    // 初始化時以目前 React / 草稿狀態為主，不讀取可能殘留的
    // window.history.state.inquiryStage。舊的 history state 可能停在 purpose、
    // followUp 或 ready，若直接套用會讓使用者看起來像頁面莫名重新整理。
    const initialHistoryStage: InquiryHistoryStage = isFinished
      ? "summary"
      : flowStage;

    writeInquiryHistory(initialHistoryStage, "replace");
  }, [flowStage, isFinished, writeInquiryHistory]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.page !== "cards") return;

      const nextStage = event.state?.inquiryStage as
        | InquiryHistoryStage
        | undefined;

      if (nextStage) applyInquiryStage(nextStage);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyInquiryStage]);

  const {
    finishInquiryIntro,
    resetFollowUpAnswers,
    toggleSelectedSuspect,
    toggleTask3Target,
  } = useInquiryIntroFlow<InquiryPurpose, SuspectAnswer, InquiryIntroStageRecord>({
    inquiryPurpose,
    currentInquiryOrder,
    currentCaseTitle: currentCase.title,
    suspectGroups: INQUIRY_SUSPECT_GROUPS,
    selectedSuspects,
    task3Targets,
    suspectReason,
    suspectOtherText,
    task3OtherText,
    possibleCrisis,
    otherPurpose,
    setSuspectAnswer,
    setSelectedSuspects,
    setTask3Targets,
    setSuspectReason,
    setSuspectOtherDraft,
    setSuspectOtherText,
    setTask3OtherDraft,
    setTask3OtherText,
    setPossibleCrisis,
    setOtherPurpose,
    setInquiryPurpose,
    setIntroStage,
    setReadyMessage,
    goInquiryStage,
  });

  useInquiryTitleSync<TitleReward>({
    token,
    titles: earnedTitles,
    onTitleRewardsChange,
    isSupportedTitle: isSupportedInquiryTitleReward,
    saveTitles: saveInquiryTitles,
  });

  useEffect(() => {
    if (!token) return;
    const ownedUnlockedCards = unlockedCardIds
      .filter((card) => {
        if (typeof card === "string") return true;
        return card.unlocked !== false && card.sharedFromOtherPlayer !== true;
      })
      .map((card) =>
        typeof card === "string" ? card : getCompactStoredUnlockedCard(card),
      );
    void saveInquiryCards(token, ownedUnlockedCards).catch((error) => {
      console.error("儲存探究卡牌失敗", error);
    });
  }, [token, unlockedCardIds]);

  useEffect(() => {
    const rewardChecks = getRewardChecks(unlockedCountByCategory);

    const supportedEarnedTitles = earnedTitles.filter(
      isSupportedInquiryTitleReward,
    );
    if (supportedEarnedTitles.length !== earnedTitles.length) {
      const timer = window.setTimeout(() => {
        setEarnedTitles(supportedEarnedTitles);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const newlyEarned = rewardChecks.filter(({ reward, isUnlocked }) => {
      const alreadyHas = supportedEarnedTitles.some(
        (title) => title.id === reward.id,
      );
      return isUnlocked && !alreadyHas;
    });

    if (newlyEarned.length === 0) return;

    const timer = window.setTimeout(() => {
      setEarnedTitles((prev) => [
        ...prev,
        ...newlyEarned.map((item) => item.reward),
      ]);

      if (shouldShowTitleRewardAnimationRef.current) {
        setPendingReward(newlyEarned[0].reward);
        setHasNewTitleReward(true);
        shouldShowTitleRewardAnimationRef.current = false;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [earnedTitles, unlockedCountByCategory]);

  useEffect(() => {
    return () => {
      if (snapshotCardScrollTimerRef.current !== null) {
        window.clearTimeout(snapshotCardScrollTimerRef.current);
        snapshotCardScrollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingReward) return;

    if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);

    rewardTimerRef.current = setTimeout(() => {
      setPendingReward(null);
      rewardTimerRef.current = null;
    }, 3000);

    return () => {
      if (rewardTimerRef.current) {
        clearTimeout(rewardTimerRef.current);
        rewardTimerRef.current = null;
      }
    };
  }, [pendingReward]);

  const openCollectedPreview = useCallback((card: GameCard) => {
    setPreviewCard(card);
  }, []);

  const closeCollectedPreview = useCallback(() => {
    setPreviewCard(null);
  }, []);

  const handleChangeCategory = useCallback(
    (category: CategoryKey) => {
      if (category === activeCategory) return;

      // 已點過的分類會保留在 DOM 裡，之後切回來只改可見狀態，
      // 不會清空 rows 或重新掛載圖片，所以畫面不會有白屏重刷感。
      setMountedCategories((previous) => {
        if (previous.has(category)) return previous;
        const next = new Set(previous);
        next.add(category);
        return next;
      });
      setActiveCategory(category);
      setCategoryFlipKey(null);

      onActivityLog?.({
        eventType: "card_category_change",
        eventLabel: "切換小卡分類",
        targetType: "cardCategory",
        targetId: category,
        previousValue: activeCategory,
        newValue: category,
      });
    },
    [activeCategory, onActivityLog],
  );

  const openCard = useCallback(
    (card: GameCard) => {
      onActivityLog?.({
        eventType: "card_open",
        eventLabel: "打開數據卡牌",
        targetType: "card",
        targetId: card.id,
        metadata: {
          title: card.revealedTitle,
          category: card.category,
          unlocked: card.unlocked,
        },
      });

      setIsModalReady(false);
      setActiveId(card.id);
      setIsUnlocking(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInputValue(card.content || "");
          setNewInputValue("");
          setIsModalReady(true);
        });
      });
    },
    [onActivityLog, setActiveId, setInputValue, setIsModalReady, setIsUnlocking, setNewInputValue],
  );

  const closeCard = useCallback(() => {
    if (isUnlocking) return;
    setActiveId(null);
    setInputValue("");
    setNewInputValue("");
  }, [isUnlocking]);

  const getUnreflectedCollectionCardIds = useCallback(
    (
      roundCardIds: string[],
      records: CollectionReflectionRecord[] = collectionReflectionRecords,
    ) => {
      const reflectedIdSet = new Set(
        records.flatMap((record) => record.cardIds),
      );
      return roundCardIds.filter((cardId) => !reflectedIdSet.has(cardId));
    },
    [collectionReflectionRecords],
  );

  const openCollectionReflectionPrompt = useCallback(
    (
      cardIds: string[],
      options?: {
        force?: boolean;
        finishMode?: "confirm" | "summary";
        returnToFinish?: boolean;
      },
    ) => {
      const force = Boolean(options?.force);
      const finishMode =
        options?.finishMode ?? (options?.returnToFinish ? "confirm" : "none");
      if (!force && cardIds.length < COLLECTION_REFLECTION_BATCH_SIZE) return;
      const pendingIds = force
        ? cardIds
        : cardIds.slice(0, COLLECTION_REFLECTION_BATCH_SIZE);
      if (pendingIds.length === 0) return;

      setPendingCollectionReflectionCardIds(pendingIds);
      setCollectionReflectionText("");
      setReturnToFinishAfterCollectionReflection(finishMode);
      setShowCollectionReflectionPrompt(true);

      onActivityLog?.({
        eventType: "collection_reflection_prompt_show",
        eventLabel: finishMode === "summary"
          ? "時間到要求說明未完成理由"
          : force
          ? "結束探究前要求說明未滿五張理由"
          : "收藏滿五張要求說明理由",
        targetType: "collectionBatch",
        targetId: `inquiry-${currentInquiryOrder}-batch`,
        metadata: {
          inquiryOrder: currentInquiryOrder,
          cardIds: pendingIds,
          force,
          finishMode,
          returnToFinish: finishMode !== "none",
        },
      });
    },
    [
      currentInquiryOrder,
      onActivityLog,
      setCollectionReflectionText,
      setPendingCollectionReflectionCardIds,
      setReturnToFinishAfterCollectionReflection,
      setShowCollectionReflectionPrompt,
    ],
  );

  const checkCollectionReflectionRequirement = useCallback(
    (nextRoundCardIds: string[]) => {
      if (showCollectionReflectionPrompt) return;
      const unreflectedIds = getUnreflectedCollectionCardIds(nextRoundCardIds);
      if (unreflectedIds.length >= COLLECTION_REFLECTION_BATCH_SIZE) {
        openCollectionReflectionPrompt(unreflectedIds);
      }
    },
    [
      getUnreflectedCollectionCardIds,
      openCollectionReflectionPrompt,
      showCollectionReflectionPrompt,
    ],
  );

  const addCardToCurrentRoundAndCheckReflection = useCallback(
    (cardId: string) => {
      setCurrentRoundCardIds((prev) => {
        const next = prev.includes(cardId) ? prev : [...prev, cardId];
        window.setTimeout(() => checkCollectionReflectionRequirement(next), 0);
        return next;
      });
    },
    [checkCollectionReflectionRequirement],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkCollectionReflectionRequirement(currentRoundCardIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checkCollectionReflectionRequirement, currentRoundCardIds]);

  const {
    persistInvestigationCardsNow,
    persistCurrentInvestigation,
    submitFinalSummary,
  } = useInquirySubmission<GameCard, GameCard, FinalSummary, InquiryIntroStageRecord | null>({
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
    isUnlockedRoundCard: (card, roundCardIds) =>
      card.unlocked && roundCardIds.includes(card.id),
    createFinalSummary,
    saveInvestigationSummary,
    onSubmitSummary,
  });

  const submitCollectionReflection = useCallback(() => {
    const reason = collectionReflectionText.trim();
    const requiredLength = getCollectionReflectionMinLength(
      pendingCollectionReflectionCardIds.length,
    );
    if (
      reason.length < requiredLength ||
      pendingCollectionReflectionCardIds.length === 0
    )
      return;

    const record: CollectionReflectionRecord = {
      id: `collection-reflection-${currentInquiryOrder}-${Date.now()}`,
      createdAt: nowIsoTimestamp(),
      inquiryOrder: currentInquiryOrder,
      cardIds: pendingCollectionReflectionCardIds,
      reason,
    };

    const finishModeAfterReflection = returnToFinishAfterCollectionReflection;
    const reflectedCardIds = new Set(record.cardIds);

    setUnlockedCardIds((prev) =>
      prev.map((item) => {
        const cardId = typeof item === "string" ? item : item.id;
        if (!reflectedCardIds.has(cardId)) return item;

        return {
          ...(typeof item === "string" ? { id: item } : item),
          note: reason,
          studentNote: reason,
          reflectionNote: reason,
        };
      }),
    );

    setCollectionReflectionRecords((prev) => [...prev, record]);
    setShowCollectionReflectionPrompt(false);
    setPendingCollectionReflectionCardIds([]);
    setCollectionReflectionText("");
    setReturnToFinishAfterCollectionReflection("none");

    onActivityLog?.({
      eventType: "collection_reflection_submit",
      eventLabel: "說明收藏五張數據卡的理由",
      targetType: "collectionBatch",
      targetId: record.id,
      newValue: reason,
      metadata: {
        inquiryOrder: currentInquiryOrder,
        cardIds: record.cardIds,
      },
    });

    void persistInvestigationCardsNow([], "card_change", [
      ...collectionReflectionRecords,
      record,
    ]).catch((error) => {
      console.error("同步五張卡蒐集理由失敗", error);
    });

    window.setTimeout(() => {
      if (finishModeAfterReflection === "summary") {
        void persistCurrentInvestigation()
          .catch((error) => {
            console.error("時間到後同步調查紀錄失敗", error);
          })
          .finally(() => {
            goInquiryStage("summary");
          });
        return;
      }

      if (finishModeAfterReflection === "confirm") {
        setShowFinishConfirm(true);
        return;
      }

      const latestUnreflectedIds = getUnreflectedCollectionCardIds(
        currentRoundCardIds,
        [...collectionReflectionRecords, record],
      );
      if (latestUnreflectedIds.length >= COLLECTION_REFLECTION_BATCH_SIZE) {
        openCollectionReflectionPrompt(latestUnreflectedIds);
      }
    }, 0);
  }, [
    collectionReflectionRecords,
    collectionReflectionText,
    currentInquiryOrder,
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    onActivityLog,
    openCollectionReflectionPrompt,
    pendingCollectionReflectionCardIds,
    persistCurrentInvestigation,
    persistInvestigationCardsNow,
    returnToFinishAfterCollectionReflection,
    goInquiryStage,
    setUnlockedCardIds,
    setCollectionReflectionText,
    setPendingCollectionReflectionCardIds,
    setReturnToFinishAfterCollectionReflection,
    setShowCollectionReflectionPrompt,
    setShowFinishConfirm,
  ]);

  const hasPendingCollectionReflection =
    showCollectionReflectionPrompt &&
    pendingCollectionReflectionCardIds.length > 0;
  const pendingCollectionReflectionMinLength = getCollectionReflectionMinLength(
    pendingCollectionReflectionCardIds.length,
  );
  const collectionReflectionTextLength = collectionReflectionText.trim().length;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const toAiCard = (card: GameCard) => {
      const profile = inferAiHelperCardProfileForClient(card);
      return {
        id: card.id,
        title: card.revealedTitle,
        category: card.category,
        categoryLabel: profile.categoryLabel,
        town: profile.town,
        dataType: profile.dataType,
        possibleUse: profile.possibleUse,
        crisisLinks: profile.crisisLinks,
        inquiryOrder: getStoredCardRound(card, currentInquiryOrder),
        collectionReason: getCollectionReflectionReasonForCard(card.id),
        content: String(card.content || "").slice(0, 180),
      };
    };

    const checkpointCardsForAi = pendingCollectionReflectionCards.map(toAiCard);
    const unlockedCardsForAi = unlockedCardsWithContent.map(toAiCard);
    const allUnlockedCardsForAi = allUnlockedCardsWithContent.map(toAiCard);
    const selectedCardsForAi = unlockedCardsWithContent
      .filter((card) => selectedEvidenceIds.includes(card.id))
      .map(toAiCard);
    const activeContextCards = hasPendingCollectionReflection
      ? checkpointCardsForAi
      : unlockedCardsForAi;

    window.dispatchEvent(
      new CustomEvent("cityauncel:ai-context", {
        detail: {
          pageKey: "cards",
          pageLabel: "數據清單",
          currentInquiryOrder,
          activeContextScope: hasPendingCollectionReflection
            ? "checkpoint"
            : "unlocked",
          activeContextLabel: hasPendingCollectionReflection
            ? "蒐集檢查站目前顯示的數據卡"
            : "本回合全部已解鎖數據卡",
          isCollectionCheckpointOpen: hasPendingCollectionReflection,
          activeContextCards,
          selectedCards: hasPendingCollectionReflection
            ? checkpointCardsForAi
            : selectedCardsForAi,
          unlockedCards: unlockedCardsForAi,
          allUnlockedCards: allUnlockedCardsForAi,
          checkpointCards: checkpointCardsForAi,
          selectedEvidenceCount: selectedCardsForAi.length,
          checkpointCardCount: checkpointCardsForAi.length,
          unlockedCardCount: unlockedCardsWithContent.length,
          allUnlockedCardCount: allUnlockedCardsWithContent.length,
          collectionReflectionText,
          collectionReflectionMinLength: pendingCollectionReflectionMinLength,
          focusText: hasPendingCollectionReflection
            ? collectionReflectionText
            : conclusion || inputValue || newInputValue || "",
        },
      }),
    );
  }, [
    currentInquiryOrder,
    selectedEvidenceIds,
    unlockedCardsWithContent,
    allUnlockedCardsWithContent,
    pendingCollectionReflectionCards,
    hasPendingCollectionReflection,
    collectionReflectionText,
    pendingCollectionReflectionMinLength,
    conclusion,
    inputValue,
    newInputValue,
    getCollectionReflectionReasonForCard,
  ]);
  const notifyAiHelperCardUnlocked = useCallback(
    (
      card: GameCard,
      source: "card_unlock" | "card_reunlock" | "interactive_snapshot_unlock",
    ) => {
      if (typeof window === "undefined") return;
      const profile = inferAiHelperCardProfileForClient(card);
      window.dispatchEvent(
        new CustomEvent("cityauncel:ai-helper-card-unlocked", {
          detail: {
            source,
            id: card.id,
            title: card.revealedTitle,
            category: card.category,
            categoryLabel: profile.categoryLabel,
            town: profile.town,
            dataType: profile.dataType,
            inquiryOrder: currentInquiryOrder,
          },
        }),
      );
    },
    [currentInquiryOrder],
  );

  const isConclusionTooShort =
    conclusion.trim().length <= CONCLUSION_MIN_LENGTH;

  const handleRequestFinishInquiry = useCallback(() => {
    const unreflectedIds = getUnreflectedCollectionCardIds(currentRoundCardIds);
    if (unreflectedIds.length > 0) {
      setShowFinishConfirm(false);
      openCollectionReflectionPrompt(unreflectedIds, {
        force: true,
        finishMode: "confirm",
      });
      return;
    }

    setShowFinishConfirm(true);
  }, [
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    openCollectionReflectionPrompt,
    setShowFinishConfirm,
  ]);

  const handleDataListCountdownEnd = useCallback(() => {
    const unreflectedIds = getUnreflectedCollectionCardIds(currentRoundCardIds);
    setShowFinishConfirm(false);

    if (unreflectedIds.length > 0) {
      openCollectionReflectionPrompt(unreflectedIds, {
        force: true,
        finishMode: "summary",
      });
      return;
    }

    void persistCurrentInvestigation()
      .catch((error) => {
        console.error("時間到後同步調查紀錄失敗", error);
      })
      .finally(() => {
        goInquiryStage("summary");
      });
  }, [
    currentRoundCardIds,
    getUnreflectedCollectionCardIds,
    goInquiryStage,
    openCollectionReflectionPrompt,
    persistCurrentInvestigation,
    setShowFinishConfirm,
  ]);
  const handleDataListCountdownEndRef = useRef(handleDataListCountdownEnd);

  useEffect(() => {
    handleDataListCountdownEndRef.current = handleDataListCountdownEnd;
  }, [handleDataListCountdownEnd]);

  useEffect(() => {
    if (flowStage !== "cards" || isFinished) {
      setDataListCountdownDeadline(null);
      setDataListRemainingMs(DATA_LIST_COUNTDOWN_MS);
      setDataListTimerNotice(null);
      dataListTimerWarnedRef.current = {
        three: false,
        one: false,
        done: false,
      };
      return;
    }

    const deadline = Date.now() + DATA_LIST_COUNTDOWN_MS;
    setDataListCountdownDeadline(deadline);
    setDataListRemainingMs(DATA_LIST_COUNTDOWN_MS);
    setDataListTimerNotice(null);
    dataListTimerWarnedRef.current = {
      three: false,
      one: false,
      done: false,
    };
  }, [currentInquiryOrder, flowStage, isFinished]);

  useEffect(() => {
    if (
      flowStage !== "cards" ||
      isFinished ||
      dataListCountdownDeadline === null
    )
      return;

    const tick = () => {
      const remaining = Math.max(0, dataListCountdownDeadline - Date.now());
      setDataListRemainingMs(remaining);

      if (
        remaining <= DATA_LIST_THREE_MINUTE_MS &&
        remaining > DATA_LIST_ONE_MINUTE_MS &&
        !dataListTimerWarnedRef.current.three
      ) {
        dataListTimerWarnedRef.current.three = true;
        setDataListTimerNotice("three");
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_warning",
          eventLabel: "數據清單倒數剩餘三分鐘",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { remainingMinutes: 3, inquiryOrder: currentInquiryOrder },
        });
      }

      if (
        remaining <= DATA_LIST_ONE_MINUTE_MS &&
        remaining > 0 &&
        !dataListTimerWarnedRef.current.one
      ) {
        dataListTimerWarnedRef.current.one = true;
        setDataListTimerNotice("one");
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_warning",
          eventLabel: "數據清單倒數剩餘一分鐘",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { remainingMinutes: 1, inquiryOrder: currentInquiryOrder },
        });
      }

      if (remaining <= 0 && !dataListTimerWarnedRef.current.done) {
        dataListTimerWarnedRef.current.done = true;
        setDataListTimerNotice("done");
        setDataListCountdownDeadline(null);
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_end",
          eventLabel: "數據清單倒數結束並進入蒐集檢查",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { inquiryOrder: currentInquiryOrder },
        });
        handleDataListCountdownEndRef.current();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, [
    currentInquiryOrder,
    dataListCountdownDeadline,
    flowStage,
    isFinished,
  ]);

  useEffect(() => {
    if (dataListTimerNotice === null) return;
    const timer = window.setTimeout(() => {
      setDataListTimerNotice(null);
    }, dataListTimerNotice === "done" ? 3000 : 4500);
    return () => window.clearTimeout(timer);
  }, [dataListTimerNotice]);

  const handleOpenCollectedPanel = useCallback(() => {
    setHasNewCollectedContent(false);
    onActivityLog?.({
      eventType: "collection_panel_open",
      eventLabel: "打開卡牌內容收藏",
      targetType: "panel",
      targetId: "collectedCards",
    });
  }, [onActivityLog]);

  const handleOpenTrophyPanel = useCallback(() => {
    setHasNewTitleReward(false);
    onActivityLog?.({
      eventType: "title_panel_open",
      eventLabel: "打開稱號收藏",
      targetType: "panel",
      targetId: "titles",
    });
  }, [onActivityLog]);

  const applyPendingCardUpdate = useCallback(() => {
    const pending = pendingCardUpdateRef.current;
    if (!pending) return;

    pendingCardUpdateRef.current = null;

    const { targetCard, content, wasUnlocked } = pending;

    if (!wasUnlocked) {
      setJustUnlockedId(targetCard.id);

      window.setTimeout(() => {
        setJustUnlockedId(null);
      }, 900);
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === targetCard.id
          ? {
              ...card,
              content,
              unlocked: true,
              unlockedAt: wasUnlocked
                ? card.unlockedAt
                : (targetCard.unlockedAt ?? nowIsoTimestamp()),
              sharedFromOtherPlayer: wasUnlocked
                ? card.sharedFromOtherPlayer
                : false,
            }
          : card,
      ),
    );
    setUnlockedCardIds((prev) => {
      const next = prev.filter((item) =>
        typeof item === "string"
          ? item !== targetCard.id
          : item.id !== targetCard.id,
      );

      return [
        ...next,
        serializeUnlockedCard(
          {
            ...targetCard,
            content,
            unlocked: true,
            unlockedAt: wasUnlocked
              ? (targetCard.unlockedAt ?? nowIsoTimestamp())
              : (targetCard.unlockedAt ?? nowIsoTimestamp()),
            sharedFromOtherPlayer: wasUnlocked
              ? targetCard.sharedFromOtherPlayer
              : false,
          },
          currentInquiryOrder,
        ),
      ];
    });

    if (!wasUnlocked) {
      shouldShowTitleRewardAnimationRef.current = true;

      const effect = getBalanceEffect(targetCard.category);
      setDevelopmentScore((prev) => prev + effect.development);
      setConservationScore((prev) => prev + effect.conservation);
    }

    addCardToCurrentRoundAndCheckReflection(targetCard.id);

    setHasNewCollectedContent(true);
    notifyAiHelperCardUnlocked(
      { ...targetCard, content, unlocked: true },
      wasUnlocked ? "card_reunlock" : "card_unlock",
    );
  }, [
    addCardToCurrentRoundAndCheckReflection,
    currentInquiryOrder,
    notifyAiHelperCardUnlocked,
    setUnlockedCardIds,
  ]);

  const handleReuseUnlockedCard = useCallback(async () => {
    if (!activeCard || !activeCard.unlocked || hasPendingCollectionReflection)
      return;

    addCardToCurrentRoundAndCheckReflection(activeCard.id);
    setHasNewCollectedContent(true);
    setJustUnlockedId(activeCard.id);
    window.setTimeout(() => setJustUnlockedId(null), 520);

    const content = activeCard.content.trim();

    setUnlockedCardIds((prev) => {
      const next = prev.filter((item) =>
        typeof item === "string"
          ? item !== activeCard.id
          : item.id !== activeCard.id,
      );

      return [
        ...next,
        serializeUnlockedCard(
          {
            ...activeCard,
            content,
            unlocked: true,
            unlockedAt: activeCard.unlockedAt ?? nowIsoTimestamp(),
          },
          currentInquiryOrder,
        ),
      ];
    });
    notifyAiHelperCardUnlocked(
      { ...activeCard, content, unlocked: true },
      "card_reunlock",
    );

    onActivityLog?.({
      eventType: "card_reunlock",
      eventLabel: "再次解鎖已解鎖卡牌",
      targetType: "card",
      targetId: activeCard.id,
      newValue: { cardId: activeCard.id },
      metadata: {
        title: activeCard.revealedTitle,
        category: activeCard.category,
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
      },
    });

    setActiveId(null);
    setInputValue("");
    setNewInputValue("");

    try {
      await persistInvestigationCardsNow([
        {
          ...activeCard,
          content,
          unlocked: true,
          unlockedAt: activeCard.unlockedAt ?? nowIsoTimestamp(),
        },
      ]);
    } catch (error) {
      console.error("同步再次解鎖卡牌到 investigation 失敗", error);
    }
  }, [
    activeCard,
    addCardToCurrentRoundAndCheckReflection,
    currentInquiryOrder,
    hasPendingCollectionReflection,
    notifyAiHelperCardUnlocked,
    onActivityLog,
    orientationCreatedAt,
    persistInvestigationCardsNow,
    setUnlockedCardIds,
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeCard || hasPendingCollectionReflection) return;

    const latestCard = cards.find((card) => card.id === activeCard.id);
    if (!latestCard) return;

    if (latestCard.unlocked) {
      await handleReuseUnlockedCard();
      return;
    }

    const targetCard = latestCard;
    const content = targetCard.content.trim();
    const unlockedAt = nowIsoTimestamp();

    setIsUnlocking(false);
    setShowFallingLock(false);
    setShowUnlockBurst(false);

    // 先關閉數據卡彈窗；等彈窗退場完成後，再由 AnimatePresence.onExitComplete
    // 呼叫 applyPendingCardUpdate，讓列表上的卡片才開始翻面。
    pendingCardUpdateRef.current = {
      targetCard: {
        ...targetCard,
        unlockedAt,
        sharedFromOtherPlayer: false,
      },
      content,
      wasUnlocked: false,
    };

    setActiveId(null);
    setInputValue("");
    setNewInputValue("");

    onActivityLog?.({
      eventType: "card_unlock",
      eventLabel: "直接解鎖數據卡",
      targetType: "card",
      targetId: targetCard.id,
      newValue: { cardId: targetCard.id },
      metadata: {
        title: targetCard.revealedTitle,
        category: targetCard.category,
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
      },
    });

    try {
      await persistInvestigationCardsNow([
        {
          ...targetCard,
          content,
          unlocked: true,
          unlockedAt,
          sharedFromOtherPlayer: false,
        },
      ]);
    } catch (error) {
      console.error("同步解鎖卡牌到 investigation 失敗", error);
    }
  };

  function handleCreateSnapshotCard(
    meta: EvidenceSnapshotMeta,
    reason: string,
    snapshotImageUrl?: string,
  ) {
    applySnapshotCardCreation<GameCard, StoredUnlockedCard | string>({
      meta,
      reason,
      snapshotImageUrl,
      currentInquiryOrder,
      orientationCreatedAt,
      createSnapshotCard: (cardMeta, cardReason, imageUrl) =>
        createSnapshotGameCard(cardMeta, cardReason, imageUrl, {
          buildSnapshotSvgDataUrl,
        }) as GameCard,
      setCards,
      addCardToCurrentRoundAndCheckReflection,
      setUnlockedCardIds,
      serializeUnlockedCard,
      setHasNewCollectedContent,
      notifyAiHelperCardUnlocked,
      setJustUnlockedId,
      shouldShowTitleRewardAnimationRef,
      snapshotCardScrollTimerRef,
      setFlashingSnapshotCardId,
      getBalanceEffect,
      setDevelopmentScore,
      setConservationScore,
      onActivityLog,
      persistInvestigationCardsNow,
    });
  }

  const isConclusionLocked = confirmedEvidenceCards.length === 0;

  const introSummary = getIntroStageDisplay(introStage);

  function toggleEvidenceCard(cardId: string) {
    onActivityLog?.({
      eventType: "evidence_card_toggle",
      eventLabel: "勾選或取消證據卡牌",
      targetType: "evidenceCard",
      targetId: cardId,
    });

    setSelectedEvidenceIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function confirmEvidenceCards() {
    setConfirmedEvidenceIds(selectedEvidenceIds);
    onActivityLog?.({
      eventType: "evidence_cards_confirm",
      eventLabel: "確認數據探究證據卡牌",
      targetType: "evidenceCards",
      newValue: selectedEvidenceIds,
      metadata: {
        inquiryOrder: currentInquiryOrder,
        orientationCreatedAt: orientationCreatedAt || null,
        evidenceCards: unlockedCardsWithContent
          .filter((card) => selectedEvidenceIds.includes(card.id))
          .map((card) => ({
            id: card.id,
            title: card.revealedTitle,
            category: card.category,
            note: getCollectionReflectionReasonForCard(card.id),
          })),
      },
    });
  }
  function toggleEvidenceFlip(cardId: string) {
    setFlippedEvidenceIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function toggleEvidencePreviewFlip(cardId: string) {
    setEvidencePreviewFlippedIds((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId],
    );
  }

  function handleEvidencePreviewPointerDown(
    cardId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    evidenceSwipeRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleEvidencePreviewPointerUp(
    cardId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const swipe = evidenceSwipeRef.current;
    evidenceSwipeRef.current = null;

    if (
      !swipe ||
      swipe.cardId !== cardId ||
      swipe.pointerId !== event.pointerId
    ) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (isHorizontalSwipe) {
      event.preventDefault();
      event.stopPropagation();
      toggleEvidencePreviewFlip(cardId);
      return;
    }

    if (confirmedEvidenceIds.length === 0) {
      toggleEvidenceCard(cardId);
    }
  }

  function handleEvidencePreviewPointerCancel(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    evidenceSwipeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  if (flowStage === "purpose") {
    return (
      <AnimatePresence mode="wait">
        <InquiryStageTransitionFrame
          stageKey={`purpose-${currentInquiryOrder}`}
        >
          <InquiryPurposePage
            selectedPurpose={inquiryPurpose}
            currentInquiryOrder={currentInquiryOrder}
            onSelect={(purpose) => {
              setInquiryPurpose(purpose);
              resetFollowUpAnswers();
              goInquiryStage("followUp");
            }}
            onBack={onBackToHome}
          />
        </InquiryStageTransitionFrame>
      </AnimatePresence>
    );
  }

  if (flowStage === "followUp") {
    return (
      <AnimatePresence mode="wait">
        <InquiryStageTransitionFrame
          stageKey={`followUp-${currentInquiryOrder}-${inquiryPurpose || "none"}`}
        >
          <InquiryFollowUpPage
            purpose={inquiryPurpose}
            currentInquiryOrder={currentInquiryOrder}
            selectedSuspects={selectedSuspects}
            task3Targets={task3Targets}
            suspectReason={suspectReason}
            suspectOtherDraft={suspectOtherDraft}
            suspectOtherText={suspectOtherText}
            task3OtherDraft={task3OtherDraft}
            possibleCrisis={possibleCrisis}
            otherPurpose={otherPurpose}
            onPurposeChange={setInquiryPurpose}
            onToggleSuspect={toggleSelectedSuspect}
            onToggleTask3Target={toggleTask3Target}
            onSuspectReasonChange={setSuspectReason}
            onSuspectOtherDraftChange={setSuspectOtherDraft}
            onSuspectOtherTextChange={setSuspectOtherText}
            onTask3OtherDraftChange={(value) => {
              setTask3OtherDraft(value);
              if (task3OtherText && value.trim() !== task3OtherText.trim())
                setTask3OtherText("");
            }}
            onTask3OtherTextChange={setTask3OtherText}
            onPossibleCrisisChange={setPossibleCrisis}
            onOtherPurposeChange={setOtherPurpose}
            onBack={() => goInquiryStage("purpose")}
            onNext={() => {
              const safeOrder = Math.max(1, Number(currentInquiryOrder || 1));

              if (safeOrder === 1 && inquiryPurpose === "task1_yes") {
                finishInquiryIntro("很好，讓我們來驗證你的想法吧~");
                return;
              }

              if (safeOrder === 1 && inquiryPurpose === "task1_no") {
                finishInquiryIntro("沒關係，讓我們開始蒐集線索吧~", "task1_no");
                return;
              }

              if (safeOrder === 2) {
                if (
                  selectedSuspects.length === 1 &&
                  selectedSuspects[0] === "unknown"
                ) {
                  finishInquiryIntro(
                    "沒關係，讓我們調查證據後再來抓犯人吧~",
                    "task2",
                  );
                  return;
                }

                finishInquiryIntro(
                  "很好，讓我們來用證據證明你的懷疑是對的吧~",
                  "task2",
                );
                return;
              }

              if (safeOrder === 3) {
                finishInquiryIntro("很好，讓我們繼續追查證據吧~");
                return;
              }

              if (safeOrder === 4) {
                finishInquiryIntro("你確定你的看法是正確的嗎?再去調查看看吧~");
                return;
              }

              if (safeOrder > 4) {
                finishInquiryIntro(
                  "很好，讓我們帶著這個目的開始探究吧~",
                  "free",
                );
              }
            }}
          />
        </InquiryStageTransitionFrame>
      </AnimatePresence>
    );
  }

  if (flowStage === "ready") {
    return (
      <AnimatePresence mode="wait">
        <InquiryStageTransitionFrame
          stageKey={`ready-${currentInquiryOrder}-${introStage || "none"}`}
        >
          <div className="game-adventure-page uiux-page-shell inquiry-intro-shell flex min-h-[100svh] items-center justify-center overflow-x-hidden p-4 sm:p-6">
            <motion.div
              layout
              className="inquiry-intro-card w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"
            >
              <p className="text-xl font-black leading-8 text-stone-800">
                {readyMessage}
              </p>
              <div className="mt-5 rounded-3xl border border-[#e1d2b6] bg-[#fff8e8] px-6 py-5 text-center shadow-inner">
                <p className="text-center text-base font-black tracking-[0.14em] text-[#7c5f35]">
                  {currentCase.readyNoticeTitle}
                </p>
                <div className="mt-3 space-y-3 text-sm font-bold leading-7 text-stone-700 sm:text-base">
                  {currentCase.readyNoticeParagraphs.map((paragraph, index) => (
                    <p key={`${currentCase.id}-ready-notice-${index}`}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-xs font-black tracking-[0.12em] text-stone-500">
                請先閱讀注意事項，倒數結束後即可開始任務。
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => goInquiryStage("followUp")}
                  className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#d9c7a4] bg-gradient-to-br from-white via-[#fff8e8] to-[#f1e1bd] px-5 font-black text-[#6b5634] shadow-[0_8px_0_rgba(161,130,83,0.16),0_14px_28px_rgba(88,67,38,0.12)] transition hover:-translate-y-0.5 hover:border-[#c19a5d] hover:brightness-[1.02] active:translate-y-0 sm:w-40"
                >
                  上一頁
                </button>
                <IntroCountdownButton
                  resetKey={`ready-${currentInquiryOrder}-${currentCase.id}-${readyMessage}`}
                  onClick={() => {
                    const nextOrientationCreatedAt = new Date().toISOString();
                    setOrientationCreatedAt(nextOrientationCreatedAt);
                    if (introStage) {
                      onInquiryPlanCreated?.(introStage);
                      if (token) {
                        void createInquiryPlan(
                          token,
                          introStage,
                          nextOrientationCreatedAt,
                          inquiryRecordOrder || currentInquiryOrder,
                        ).catch((error) => {
                          console.error("儲存探究前導問題失敗", error);
                        });
                      }
                      // inquiry_plan_create 由後端 /api/inquiry/plans 在成功儲存後統一寫入 student_activity_logs。
                      // 這裡不要再呼叫 onActivityLog，避免同一個前導問題被前端 /api/activity-log 與後端 /api/inquiry/plans 各寫一次。
                    }
                    goInquiryStage("cards");
                  }}
                  className="flex h-14 w-full items-center justify-center rounded-[22px] border border-[#9f8768] bg-gradient-to-br from-[#fff1bf] via-[#eacb86] to-[#cfa464] px-5 font-black text-[#3f3023] shadow-[0_8px_0_rgba(112,89,65,0.24),0_16px_30px_rgba(72,52,36,0.18)] transition hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 sm:w-40"
                >
                  開始調查
                </IntroCountdownButton>
              </div>
            </motion.div>
          </div>
        </InquiryStageTransitionFrame>
      </AnimatePresence>
    );
  }

  if (isFinished) {
    return (
      <div className="uiux-page-shell relative min-h-[100svh] overflow-x-hidden bg-[#f3efe6] px-3 py-4 text-stone-800 sm:px-4 sm:py-6 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.22),transparent_30%)]" />
          <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-stone-300/20 blur-[90px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c1ad]/25 blur-[110px]" />
        </div>
        <AnimatePresence>
          {showSubmitConfirm ? (
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2418]/42 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.92, y: 18, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 10, opacity: 0 }}
                className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] p-6 shadow-[0_24px_70px_rgba(45,41,34,0.18)]"
              >
                <h2 className="font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
                  確認送出本案的調查結論？
                </h2>

                <p className="mt-3 text-sm font-medium leading-7 text-stone-600">
                  送出後，本次調查記錄會存到首頁的案件紀錄，隨時供翻閱。
                </p>

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    type="button"
                    onClick={() => setShowSubmitConfirm(false)}
                    className="rounded-xl border border-[#d8cbb3] bg-white px-5 py-3 text-[#5f4c3a] transition hover:-translate-y-0.5 hover:bg-[#fff3dc] active:translate-y-0"
                  >
                    繼續修改
                  </Button>

                  <Button
                    type="button"
                    onClick={() => {
                      setShowSubmitConfirm(false);
                      submitFinalSummary();
                    }}
                    className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
                  >
                    確認送出
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#fff8ec]/96 p-4 sm:rounded-[34px] sm:p-6 lg:p-8 shadow-[0_22px_70px_rgba(45,41,34,0.11)] backdrop-blur-md">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#d8cbb3]/80 pb-6">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-[#d8cbb3] bg-[#fffaf0] px-4 py-1 text-xs font-black tracking-[0.18em] text-[#7b5b37]">
                CASE CONCLUSION
              </p>
              <h1 className="font-serif text-4xl font-semibold tracking-[0.12em] text-[#332c24]">
                {currentCase.title}
              </h1>
            </div>
            <div className="rounded-2xl border border-[#d8cbb3] bg-white/62 px-4 py-3 text-sm font-black text-stone-600">
              已選證據：{confirmedEvidenceCards.length} 張
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
                <h2 className="mb-3 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                  {introSummary.firstTitle}
                </h2>

                <div className="relative min-h-[68px] overflow-hidden rounded-2xl border-2 border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.82)_10px_20px)] p-4 pr-24 font-medium leading-7 text-stone-600">
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-2.5 py-1 text-[11px] font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3 w-3" />
                    已鎖定
                  </span>
                  {introSummary.firstAnswer}
                </div>
              </section>
              <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
                <h2 className="mb-3 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                  {introSummary.secondTitle}
                </h2>

                <div className="relative min-h-[68px] overflow-hidden rounded-2xl border-2 border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.82)_10px_20px)] p-4 pr-24 font-medium leading-7 text-stone-600">
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-2.5 py-1 text-[11px] font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3 w-3" />
                    已鎖定
                  </span>
                  {introSummary.secondAnswer}
                </div>
              </section>
            </div>

            <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
              <h2 className="mb-4 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                3. 已解鎖的數據（挑選要當證據的數據）
              </h2>

              {unlockedCardsWithContent.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {unlockedCardsWithContent.map((card) => {
                    const isSelected = selectedEvidenceIds.includes(card.id);
                    const isPreviewFlipped = evidencePreviewFlippedIds.includes(
                      card.id,
                    );

                    return (
                      <div
                        key={card.id}
                        className={`relative min-h-[222px] w-full min-w-0 rounded-[22px] border-2 p-2 text-left transition [perspective:1100px] ${
                          isSelected
                            ? "scale-[1.01] border-[#4a382b] bg-[#fff4d8] shadow-[0_0_0_4px_rgba(216,203,179,0.78),0_16px_32px_rgba(74,56,43,0.18)] ring-2 ring-[#7b5b37] ring-offset-2 ring-offset-[#fffaf0]"
                            : "border-[#e2d4bd] bg-white/78 shadow-[0_10px_24px_rgba(45,41,34,0.07)] hover:border-[#b49a78] hover:bg-[#fffaf0]"
                        }`}
                      >
                        {isSelected ? (
                          <span className="absolute -right-2 -top-2 z-20 rounded-full border-2 border-[#fffaf0] bg-[#4a382b] px-3 py-1 text-xs font-black tracking-[0.12em] text-[#fffaf0] shadow-[0_8px_18px_rgba(74,56,43,0.28)]">
                            已選取
                          </span>
                        ) : null}

                        <div
                          role="button"
                          tabIndex={confirmedEvidenceIds.length > 0 ? -1 : 0}
                          aria-pressed={isSelected}
                          onPointerDown={(event) =>
                            handleEvidencePreviewPointerDown(card.id, event)
                          }
                          onPointerUp={(event) =>
                            handleEvidencePreviewPointerUp(card.id, event)
                          }
                          onPointerCancel={handleEvidencePreviewPointerCancel}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (confirmedEvidenceIds.length === 0) {
                                toggleEvidenceCard(card.id);
                              }
                            }
                          }}
                          className="block w-full touch-pan-y select-none rounded-[18px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[#7b5b37]"
                          title="點擊卡牌可選取為證據；手指左右滑動圖片可翻面查看文字"
                        >
                          <motion.div
                            animate={{ rotateY: isPreviewFlipped ? 180 : 0 }}
                            transition={{ duration: 0.45 }}
                            className="relative h-[182px] w-full rounded-[18px] transform-gpu"
                            style={{ transformStyle: "preserve-3d" }}
                          >
                            <div
                              className="absolute inset-0 flex flex-col overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fff7ea]"
                              style={{ backfaceVisibility: "hidden" }}
                            >
                              <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryTabThemeMap[card.category].badge}`}
                                >
                                  {categoryMetaMap[card.category].label}
                                </span>

                                <h3 className="min-w-0 truncate text-xs font-black text-[#332c24]">
                                  {card.revealedTitle}
                                </h3>
                              </div>

                              <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-1.5">
                                {shouldUseWaterLiveSnapshotPreview(card) ? (
                                  <WaterLiveSnapshotCardPreview
                                    meta={card.snapshotMeta!}
                                    className="pointer-events-none h-full w-full"
                                  />
                                ) : (
                                  <img
                                    src={card.imageSrc}
                                    alt={card.revealedTitle}
                                    draggable={false}
                                    className="pointer-events-none h-full max-h-[145px] w-full object-contain"
                                  />
                                )}
                              </div>

                              <p className="shrink-0 border-t border-[#eadfcf] bg-white/55 px-2 py-0.5 text-center text-[10px] font-black tracking-[0.08em] text-[#7b5b37]">
                                左右滑動查看收藏狀態
                              </p>
                            </div>

                            <div
                              className="absolute inset-0 flex flex-col rounded-[18px] border border-[#eadfcf] bg-[#fff7ea] p-2.5"
                              style={{
                                transform: "rotateY(180deg)",
                                backfaceVisibility: "hidden",
                              }}
                            >
                              <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryTabThemeMap[card.category].badge}`}
                                >
                                  {categoryMetaMap[card.category].label}
                                </span>
                                <h3 className="min-w-0 truncate text-xs font-black text-[#332c24]">
                                  {card.revealedTitle}
                                </h3>
                              </div>

                              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-[#eadfcf] bg-white/94 p-2.5 pr-1.5">
                                <p className="whitespace-pre-wrap break-words text-xs font-medium leading-5 text-stone-700">
                                  {getCollectionReflectionReasonForCard(
                                    card.id,
                                  )}
                                </p>
                              </div>

                              <p className="mt-1.5 shrink-0 text-center text-[10px] font-black tracking-[0.08em] text-[#7b5b37]">
                                左右滑動返回圖片
                              </p>
                            </div>
                          </motion.div>
                        </div>

                        <div
                          className={`mt-1.5 shrink-0 rounded-full px-3 py-0.5 text-center text-[11px] font-black tracking-[0.08em] ${
                            isSelected
                              ? "bg-[#4a382b] text-[#fffaf0]"
                              : "bg-[#fffaf0] text-[#7b5b37]"
                          }`}
                        >
                          {isSelected
                            ? "目前已選取這筆數據"
                            : "點擊數據選取證據"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e2d4bd] bg-white/70 p-4 font-medium text-stone-500">
                  尚未解鎖任何數據
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={confirmEvidenceCards}
                  disabled={
                    selectedEvidenceIds.length === 0 ||
                    confirmedEvidenceIds.length > 0
                  }
                  className="rounded-2xl border-2 border-[#3e3025] bg-gradient-to-br from-[#6f523d] to-[#3f3023] px-5 py-3 font-black text-[#fffaf0] shadow-[0_7px_0_rgba(47,36,27,0.30),0_12px_24px_rgba(47,36,27,0.20)] hover:from-[#7f6048] hover:to-[#4a382b] disabled:cursor-not-allowed disabled:border-[#b8aa94] disabled:bg-none disabled:bg-[#d8cbb3] disabled:text-[#7a6754] disabled:opacity-100"
                >
                  {confirmedEvidenceIds.length > 0 ? "已鎖定選擇" : "鎖定選取"}
                </Button>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0]/86 p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)]">
              <h2 className="mb-4 font-serif text-xl font-semibold tracking-[0.06em] text-[#332c24]">
                4. 本次案件已選定的證據
              </h2>

              {confirmedEvidenceCards.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {confirmedEvidenceCards.map((card) => {
                    const isFlipped = flippedEvidenceIds.includes(card.id);

                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => toggleEvidenceFlip(card.id)}
                        className="aspect-[22/21] w-full min-w-0 rounded-[24px] text-left [perspective:1000px] sm:w-[calc((100%_-_1rem)_/_2)] lg:w-[calc((100%_-_3rem)_/_4)]"
                      >
                        <motion.div
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.45 }}
                          className="relative h-full w-full rounded-[24px] transform-gpu"
                          style={{ transformStyle: "preserve-3d" }}
                        >
                          <div
                            className="absolute inset-0 flex flex-col overflow-hidden rounded-[24px] border border-[#e2d4bd] bg-[#fff7ea] p-1.5 shadow-[0_12px_30px_rgba(45,41,34,0.08)]"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[#eadfcf] bg-[#fffaf0]">
                              {shouldUseWaterLiveSnapshotPreview(card) ? (
                                <WaterLiveSnapshotCardPreview
                                  meta={card.snapshotMeta!}
                                  className="h-full w-full"
                                />
                              ) : (
                                <img
                                  src={card.imageSrc}
                                  alt={card.revealedTitle}
                                  className="h-full w-full object-contain"
                                />
                              )}
                            </div>

                            <div className="shrink-0 px-2 pb-1.5 pt-1">
                              <h3 className="line-clamp-2 w-full text-center text-sm font-black leading-5 text-[#332c24]">
                                {card.revealedTitle}
                              </h3>

                              <p className="mt-0.5 text-center text-[11px] font-bold leading-4 text-stone-400">
                                點擊查看圖片與收藏狀態
                              </p>
                            </div>
                          </div>
                          <div
                            className="absolute inset-0 flex flex-col overflow-hidden rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0] p-1.5 shadow-[0_12px_30px_rgba(45,41,34,0.08)]"
                            style={{
                              transform: "rotateY(180deg)",
                              backfaceVisibility: "hidden",
                            }}
                          >
                            <div className="shrink-0 px-2 pb-1 pt-0.5">
                              <p className="text-center text-xs font-black leading-4 text-[#7b5b37]">
                                收藏狀態
                              </p>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[18px] border border-[#eadfcf] bg-white/78 p-2.5">
                              <p className="whitespace-pre-wrap break-words text-xs font-medium leading-5 text-stone-700">
                                {getCollectionReflectionReasonForCard(card.id)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e2d4bd] bg-white/70 p-4 font-medium text-stone-500">
                  尚未選定證據
                </div>
              )}
            </section>

            <section
              className={`rounded-[28px] border p-6 shadow-[0_14px_36px_rgba(45,41,34,0.08)] ${
                isConclusionLocked
                  ? "border-[#b8aa94] bg-[#eee5d6]/88"
                  : "border-[#d8cbb3] bg-[#fffaf0]/86"
              }`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-[0.06em] text-[#332c24]">
                  5. 本案的結論是什麼？
                </h2>
                {isConclusionLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#a99373] bg-[#4a382b] px-3 py-1 text-xs font-black tracking-[0.12em] text-[#fffaf0]">
                    <Lock className="h-3.5 w-3.5" />
                    先選定證據才可撰寫
                  </span>
                ) : null}
              </div>

              {isConclusionLocked ? (
                <p className="mb-3 rounded-2xl border border-dashed border-[#b8aa94] bg-[#fffaf0]/72 px-4 py-3 text-sm font-black text-stone-600">
                  目前此區塊已鎖定，請先在第 3 題選取數據並按下「鎖定選取」。
                </p>
              ) : null}

              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                placeholder={
                  isConclusionLocked
                    ? "此區塊尚未開放撰寫"
                    : currentCase.conclusionPrompt
                }
                rows={8}
                disabled={isConclusionLocked}
                className={`w-full rounded-2xl border p-4 text-base font-medium leading-7 outline-none transition ${
                  isConclusionLocked
                    ? "cursor-not-allowed border-dashed border-[#b8aa94] bg-[repeating-linear-gradient(-45deg,rgba(120,113,108,0.10)_0_10px,rgba(255,250,240,0.78)_10px_20px)] text-stone-500 placeholder:text-stone-500"
                    : "border-[#d8cbb3] bg-white/78 text-stone-800 focus:border-[#9b7b55] focus:ring-4 focus:ring-[#d8cbb3]/35"
                }`}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-stone-500">
                <span>結論撰寫須至少 {CONCLUSION_MIN_LENGTH} 字以上</span>
                <span
                  className={
                    isConclusionTooShort && !isConclusionLocked
                      ? "text-amber-700"
                      : "text-stone-500"
                  }
                >
                  {conclusion.trim().length} / {CONCLUSION_MIN_LENGTH + 1}
                </span>
              </div>
            </section>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={
                  isConclusionTooShort || confirmedEvidenceCards.length === 0
                }
                className="rounded-2xl border-2 border-[#2f241b] bg-gradient-to-br from-[#70513b] to-[#3f3023] px-6 py-4 font-black text-[#fffaf0] shadow-[0_8px_0_rgba(47,36,27,0.32),0_14px_28px_rgba(47,36,27,0.20)] hover:from-[#806048] hover:to-[#4a382b] disabled:cursor-not-allowed disabled:border-[#b8aa94] disabled:bg-none disabled:bg-[#d8cbb3] disabled:text-[#7a6754] disabled:opacity-100"
              >
                送出調查書
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const inquiryPageBackgroundColor = activeCategory
    ? categoryListThemeMap[activeCategory].pageBg
    : "rgba(255, 243, 207, 0.92)";

  return (
    <div
      className="relative min-h-[100svh] overflow-x-hidden text-stone-800"
      style={{ backgroundColor: inquiryPageBackgroundColor }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.78),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.18),transparent_30%)]" />
        <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-white/32 blur-[90px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c99a]/24 blur-[110px]" />
      </div>
      {!activeCard ? (
        <>
          <MemoizedBalanceScaleBackground
            developmentScore={developmentScore}
            conservationScore={conservationScore}
          />
        </>
      ) : null}

      {dataListCountdownDeadline !== null || dataListTimerNotice === "done" ? (
        <DataListCountdownTimer
          remainingMs={dataListRemainingMs}
          notice={dataListTimerNotice}
        />
      ) : null}

      {!activeCard ? (
        <>
          <MemoizedCollectedCardsPanel
            cards={cards}
            currentRoundCardIds={currentRoundCardIds}
            onOpenCard={openCollectedPreview}
            hasNewContent={hasNewCollectedContent}
            onOpenPanel={handleOpenCollectedPanel}
          />

          <MemoizedTrophyPanel
            titles={earnedTitles}
            hasNewTitle={hasNewTitleReward}
            onOpenPanel={handleOpenTrophyPanel}
          />
        </>
      ) : null}

      <MemoizedTitleRewardCelebration reward={pendingReward} />

      <MemoizedCollectedCardPreview
        card={previewCard}
        onClose={closeCollectedPreview}
      />

      <AnimatePresence>
        {hasPendingCollectionReflection ? (
          <motion.div
            className="fixed inset-0 z-[92] flex items-center justify-center bg-[#2f2418]/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              className="flex max-h-[calc(100svh-1.5rem)] w-[min(860px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[32px] border border-amber-200 bg-[#fffaf0] shadow-[0_28px_80px_rgba(69,39,16,0.28)]"
              initial={{ y: 28, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-4 overscroll-contain sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-3xl bg-amber-100 p-3 text-amber-700">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black tracking-[0.22em] text-amber-700">
                      蒐集檢查站
                    </p>
                    <h2 className="mt-1 text-xl font-black text-stone-900 sm:text-2xl">
                      你目前蒐集了 {pendingCollectionReflectionCards.length}{" "}
                      張數據卡！
                    </h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-stone-600">
                      辛苦了，先停一下，說明你為什麼蒐集這些卡。完成後，才能繼續調查喔~
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {pendingCollectionReflectionCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-2xl border border-amber-100 bg-white p-1.5 shadow-sm"
                    >
                      <div className="flex h-[clamp(5.5rem,18svh,8rem)] items-center justify-center overflow-hidden rounded-xl bg-[#fffdf8]">
                        {shouldUseWaterLiveSnapshotPreview(card) ? (
                          <WaterLiveSnapshotCardPreview
                            meta={card.snapshotMeta!}
                            className="h-full w-full"
                          />
                        ) : (
                          <img
                            src={card.imageSrc}
                            alt={card.revealedTitle}
                            className="h-full w-full object-contain"
                          />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-2 text-center text-xs font-bold leading-5 text-stone-700">
                        {card.revealedTitle}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl border border-amber-100 bg-white p-3">
                  <label className="text-sm font-black text-stone-800">
                    為什麼你想蒐集這些數據卡？
                  </label>
                  <textarea
                    value={collectionReflectionText}
                    onChange={(event) =>
                      setCollectionReflectionText(event.target.value)
                    }
                    rows={3}
                    placeholder="例如：我想知道這些地區是不是和石虎危機有關，這些卡可以幫我比較道路、土地或石虎出現的線索。"
                    className="mt-2 w-full resize-none rounded-2xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm font-medium leading-5 text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-400 focus:bg-white"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-stone-500">
                    <span>
                      {"蒐集 "}
                      {pendingCollectionReflectionCardIds.length}
                      {" 張數據卡，至少寫 "}
                      {pendingCollectionReflectionMinLength}
                      {" 個字說明理由。"}
                    </span>
                    <span>
                      {collectionReflectionTextLength} /{" "}
                      {pendingCollectionReflectionMinLength}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end bg-[#fffaf0] px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
                <Button
                  type="button"
                  onClick={submitCollectionReflection}
                  disabled={
                    collectionReflectionTextLength <
                    pendingCollectionReflectionMinLength
                  }
                  className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-white shadow-[0_12px_28px_rgba(245,158,11,0.28)] hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-500 sm:w-auto"
                >
                  寫好了，繼續調查
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showFinishConfirm ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2418]/42 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 18, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 10, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] p-6 shadow-[0_24px_70px_rgba(45,41,34,0.18)]"
            >
              <h2 className="font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
                確定本次案件都調查完了嗎？
              </h2>

              <p className="mt-3 text-sm font-medium leading-7 text-stone-600">
                確認結束後會進入案件結論畫面，為你的調查做最終的整理
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowFinishConfirm(false)}
                  className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
                >
                  繼續追查
                </Button>

                <Button
                  type="button"
                  onClick={async () => {
                    setShowFinishConfirm(false);
                    await persistCurrentInvestigation();
                    goInquiryStage("summary");
                  }}
                  className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
                >
                  確認結束
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <motion.div
        className={`relative z-10 mx-auto w-full max-w-7xl overflow-x-hidden px-6 pb-12 pt-10 ${
          activeCard ? "pointer-events-none" : ""
        } ${!activeCategory ? "flex min-h-[100svh] flex-col justify-center" : ""}`}
      >
        <div>
          <MemoizedCategoryTabs
            activeCategory={activeCategory}
            onChange={handleChangeCategory}
            unlockedCountByCategory={unlockedCountByCategory}
            totalCountByCategory={totalCountByCategory}
            totalUnlockedCount={totalUnlockedCount}
            totalCardCount={totalCardCount}
            currentInquiryTitle={currentCase.title}
            onRequestFinish={handleRequestFinishInquiry}
          />
        </div>

        {activeCategory === "water" ? <div className="mb-6" /> : null}

        {activeCategory ? (
          <div className="w-full">
            {activeCategory === "water" ? (
              <InteractiveDataSnapshotPanel
                key={activeCategory}
                activeCategory={activeCategory}
                token={token}
                onCreateSnapshotCard={handleCreateSnapshotCard}
              />
            ) : null}

            {CATEGORY_KEYS.map((category) =>
              mountedCategories.has(category) ? (
                <GameCardGrid
                  key={category}
                  categoryCards={categoryCardsByCategory[category]}
                  activeId={activeId}
                  activeCategoryMeta={categoryMetaMap[category]}
                  onOpenCard={openCard}
                  justUnlockedId={justUnlockedId}
                  flashingSnapshotCardId={flashingSnapshotCardId}
                  categoryFlipKey={categoryFlipKey}
                  isActive={activeCategory === category}
                />
              ) : null,
            )}
          </div>
        ) : null}
      </motion.div>

      <AnimatePresence
        onExitComplete={() => {
          setIsModalReady(false);
          applyPendingCardUpdate();
        }}
      >
        {activeCard ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#2f2418]/42 p-3 sm:p-4"
            onClick={closeCard}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-[min(94vw,1180px)] transform-gpu will-change-transform"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {isModalReady ? (
                <div className="max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-[26px] border border-white/70 bg-[#f8fafc]/96 p-3 shadow-[0_24px_76px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:rounded-[30px] md:max-h-[calc(100svh-2rem)]">
                  <div className="mb-2.5 flex items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:px-5">
                    <div>
                      <p className="text-xs font-black tracking-[0.18em] text-slate-400">
                        DATA CARD
                      </p>
                      <h1 className="mt-1 text-lg font-black tracking-[0.04em] text-slate-900 sm:text-xl">
                        數據卡預覽與蒐集
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={closeCard}
                      disabled={isUnlocking}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-black shadow-sm transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                      style={{ color: "#000000" }}
                      aria-label="關閉數據卡"
                    >
                      <X
                        className="h-5 w-5"
                        color="#000000"
                        strokeWidth={2.4}
                      />
                    </button>
                  </div>

                  <div className="uiux-card-modal-grid min-[700px]:items-stretch">
                    <section className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_16px_46px_rgba(15,23,42,0.1)]">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                        <div>
                          <p className="text-xs font-black tracking-[0.16em] text-slate-400">
                            預覽數據卡
                          </p>
                          <p className="mt-1 text-base font-black leading-snug text-slate-800 sm:text-lg">
                            {activeCard.unlocked
                              ? activeCard.revealedTitle
                              : activeCard.title}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                            writtenCardStateMap[activeCard.category].badge
                          }`}
                        >
                          {categoryMetaMap[activeCard.category].label}
                        </span>
                      </div>

                      <div className="relative flex h-[clamp(260px,50svh,520px)] w-full items-center justify-center overflow-hidden rounded-[22px] border border-[#e2d4bd] bg-[linear-gradient(135deg,#fffdf8_0%,#fffaf0_54%,#fff4df_100%)] shadow-inner md:h-[clamp(340px,58svh,560px)]">
                        <div className="flex h-full w-full min-w-0 items-center justify-center overflow-auto p-3 sm:p-4">
                          {shouldUseWaterLiveSnapshotPreview(activeCard) ? (
                            activeCard.imageSrc ? (
                              <img
                                src={activeCard.imageSrc}
                                alt={activeCard.title}
                                loading="eager"
                                decoding="async"
                                className="block h-auto max-h-full w-auto max-w-full object-contain transform-gpu will-change-transform"
                              />
                            ) : (
                              <div className="h-full w-full overflow-auto rounded-2xl bg-[#fffdf8] p-2">
                                <WaterLiveSnapshotView
                                  meta={activeCard.snapshotMeta!}
                                />
                              </div>
                            )
                          ) : (
                            <img
                              src={activeCard.imageSrc}
                              alt={activeCard.title}
                              loading="eager"
                              decoding="async"
                              className="block h-auto max-h-full w-auto max-w-full object-contain transform-gpu will-change-transform"
                            />
                          )}
                        </div>

                        <AnimatePresence>
                          {showFallingLock && !showUnlockBurst ? (
                            <motion.div
                              className="absolute left-1/2 top-[3%] z-20 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border border-sky-200 bg-sky-50 shadow-[0_10px_26px_rgba(56,189,248,0.24)]"
                              initial={{
                                y: 0,
                                scale: 1,
                                rotate: -8,
                                opacity: 1,
                              }}
                              animate={{
                                y: 205,
                                scale: 1.25,
                                rotate: 0,
                                opacity: 1,
                              }}
                              exit={{ opacity: 0, scale: 1.45 }}
                              transition={{
                                duration: 0.32,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                            >
                              <Lock
                                className={`h-12 w-12 ${writtenCardStateMap[activeCard.category].iconText}`}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>

                        <AnimatePresence>
                          {showUnlockBurst ? (
                            <motion.div
                              className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                              initial={{ opacity: 0, scale: 0.75 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.25 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                              <motion.div
                                className={`flex h-28 w-28 items-center justify-center rounded-full border shadow-[0_0_48px_rgba(56,189,248,0.55)] ${writtenCardStateMap[activeCard.category].iconBg}`}
                                animate={{
                                  scale: [1, 1.18, 1],
                                  rotate: [0, -8, 8, 0],
                                }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              >
                                <Unlock
                                  className={`h-14 w-14 ${writtenCardStateMap[activeCard.category].iconText}`}
                                />
                              </motion.div>

                              <motion.div
                                className="absolute h-40 w-40 rounded-full border-4 border-sky-200/70"
                                initial={{ scale: 0.5, opacity: 0.9 }}
                                animate={{ scale: 1.45, opacity: 0 }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              />

                              <motion.div
                                className="absolute h-56 w-56 rounded-full bg-sky-200/20 blur-2xl"
                                initial={{ scale: 0.4, opacity: 0.8 }}
                                animate={{ scale: 1.4, opacity: 0 }}
                                transition={{ duration: 0.65, ease: "easeOut" }}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </section>

                    <Card className="min-w-0 border-slate-200 bg-white text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,0.11)]">
                      <CardContent className="flex h-full flex-col p-4 lg:p-5">
                        <div className="mb-3">
                          <p className="text-xs font-black tracking-[0.16em] text-slate-400">
                            DATA COLLECTION
                          </p>
                          <h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">
                            要收藏這張數據卡嗎？
                          </h2>
                          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                            請先預覽這張數據卡，先把覺得有用的蒐集起來
                          </p>
                        </div>

                        <form
                          onSubmit={handleSubmit}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-full flex-col space-y-3"
                        >
                          <div className="grid gap-2 2xl:grid-cols-[minmax(135px,0.4fr)_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <label className="text-sm font-black tracking-[0.08em] text-slate-700">
                                小卡分類
                              </label>
                              <div
                                className={`flex min-h-[46px] items-center rounded-2xl border px-3 py-2 text-sm font-black ${
                                  writtenCardStateMap[activeCard.category].badge
                                }`}
                              >
                                <span
                                  className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${writtenCardStateMap[activeCard.category].iconBg}`}
                                >
                                  <span
                                    className={
                                      writtenCardStateMap[activeCard.category]
                                        .iconText
                                    }
                                  >
                                    {categoryMetaMap[activeCard.category].icon}
                                  </span>
                                </span>
                                {categoryMetaMap[activeCard.category].label}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-black tracking-[0.08em] text-slate-700">
                                小卡名字
                              </label>
                              <div className="flex min-h-[46px] items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black leading-relaxed text-slate-800">
                                {activeCard.unlocked
                                  ? activeCard.revealedTitle
                                  : activeCard.title}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-sky-100 bg-sky-50/70 px-4 py-4 text-sm font-medium leading-6 text-slate-700">
                            {activeCard.unlocked ? (
                              currentRoundCardIds.includes(activeCard.id) ? (
                                <>
                                  這張卡已經放進本次收藏。等你累積到{" "}
                                  {COLLECTION_REFLECTION_BATCH_SIZE}
                                  張，系統會請你整理一次蒐集理由。
                                </>
                              ) : (
                                <>
                                  這張卡以前已經解鎖過。這一輪如果還想使用它，請按「再次解鎖」放進本次收藏。
                                </>
                              )
                            ) : (
                              <>
                                判斷數據卡對你的調查是否有幫助，"有"就直接收藏起來，"沒有"就去蒐集其他有用的數據卡吧~
                              </>
                            )}
                          </div>

                          {hasPendingCollectionReflection ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                              你已經蒐集滿 {COLLECTION_REFLECTION_BATCH_SIZE}
                              張卡，請先完成「蒐集檢查站」，再繼續解鎖其他數據卡。
                            </div>
                          ) : null}

                          <div className="mt-auto flex flex-col justify-end gap-2 pt-2 sm:flex-row sm:gap-3">
                            <Button
                              type="submit"
                              onClick={(e) => e.stopPropagation()}
                              disabled={
                                isUnlocking ||
                                hasPendingCollectionReflection ||
                                (activeCard.unlocked &&
                                  currentRoundCardIds.includes(activeCard.id))
                              }
                              className="rounded-2xl border border-amber-300 bg-amber-100 px-5 py-4 font-black text-amber-900 shadow-[0_10px_24px_rgba(217,119,6,0.12)] hover:bg-amber-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              {activeCard.unlocked
                                ? currentRoundCardIds.includes(activeCard.id)
                                  ? "已成為本次線索"
                                  : "再次蒐集"
                                : "蒐集這張數據卡"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex h-[min(520px,58svh)] min-h-[320px] items-center justify-center rounded-[24px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.14)] sm:rounded-[32px]">
                  <div className="text-sm font-medium text-slate-500">
                    小卡準備中...
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
