/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 HomePage，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HomeHeader } from "@/features/home/HomeHeader";
import { TaskOneCard } from "@/features/home/TaskOneCard";
import { TaskTwoMapPreview } from "@/features/home/TaskTwoMapPreview";
import { TitleCollection } from "@/features/home/TitleCollection";
import { useHomeRealtime } from "@/features/home/hooks/useHomeRealtime";
import { useHomeTeacherControlState } from "@/features/home/hooks/useHomeTeacherControlState";
import MiaoliMap, { type MapUnlockedCardData } from "./MiaoliMap";
import { MIAOLI_MAP_VIEW_BOX, labelPositions, regions } from "../data/miaoliMapView";
import AuthPage from "./AuthPage";
import ControlPage, { TeacherManagementCenter } from "./ControlPage";
import BarrageLayer from "../components/BarrageLayer";
import AiInquiryAssistant from "@/features/inquiry/ai";
import { createInquiryRecord, loadInquiryData } from "../api/inquiryApi";
import { mediaUrl } from "../api/apiClient";
import {
  getClassFinalDecisions,
  getClassGroupDecisions,
  getGroupPersonalMaps,
  getMapTaskStatus,
  getMe,
  getSuspectVotingStatus,
  getUserMap,
  saveFinalMapDecision,
  saveUserMapState,
  submitSuspectVotes,
  writeActivityLog,
} from "../api/homeApi";
import type { ClassGroupDecisionItemApi, VotingStatusApi } from "../api/homeApi";
import {
  clearAuthSession,
  readStoredToken,
  readStoredUser,
  saveAuthSession,
  saveStoredUser,
} from "../storage/authStorage";
import {
  clearHomeProgressCache,
  readHomePageDraft,
  saveHomePageDraft,
} from "../storage/homeDraftStorage";
import { clearApiCacheForCurrentUser } from "../api/apiResponseCache";
import { flushPendingWrites } from "../api/pendingWriteQueue";

import { normalizeActivityLogPayload } from "@/utils/payloadNormalization";
import { canUseBrowserFullscreen, shouldUseCssImmersiveMode } from "@/utils/displayMode";
const InquiryData = lazy(() => import("./InquiryData"));
const CardPackPage = lazy(() => import("./CardPackPage"));
const BehaviorRecord = lazy(() => import("./BehaviorRecord"));

function PageLoadingFallback() {
  return (
    <div className="game-adventure-page flex min-h-[100svh] items-center justify-center p-6 text-center">
      <div className="rounded-[28px] border border-[#e7d8bd] bg-white/80 px-8 py-6 text-sm font-black text-[#6b5b46] shadow-[0_18px_45px_rgba(102,75,42,0.12)]">
        頁面載入中...
      </div>
    </div>
  );
}

function PageTransitionFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="page-transition-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

type Page =
  | "home"
  | "cards"
  | "cardPack"
  | "map"
  | "ending"
  | "teacherGroups"
  | "teacherStudentData";
type MapChoice = "保育" | "開發" | "我不知道";
type MapState = Record<string, MapChoice>;

const RESTORABLE_PAGES = new Set<Page>([
  "home",
  "cards",
  "cardPack",
  "map",
  "ending",
  "teacherGroups",
  "teacherStudentData",
]);

function pageStorageKey(userId?: string | number | null) {
  return `cityauncel_current_page_${userId || "guest"}`;
}

function isRestorablePage(value: unknown): value is Page {
  return typeof value === "string" && RESTORABLE_PAGES.has(value as Page);
}

function readStoredPage(userId?: string | number | null): Page {
  if (typeof window === "undefined") return "home";
  try {
    const value = window.localStorage.getItem(pageStorageKey(userId));
    return isRestorablePage(value) ? value : "home";
  } catch {
    return "home";
  }
}

function saveStoredPage(userId: string | number | null | undefined, page: Page) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pageStorageKey(userId), page);
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

function clearStoredPage(userId?: string | number | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(pageStorageKey(userId));
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

type HomeUiState = {
  activeInquiryRecordOrder?: number | null;
  reportPageIndex?: number;
  mapPreviewPageIndex?: number;
  openedReportIndex?: number | null;
};

function homeUiStorageKey(userId?: string | number | null) {
  return `cityauncel_home_ui_${userId || "guest"}`;
}

function readHomeUiState(userId?: string | number | null): HomeUiState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(homeUiStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HomeUiState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveHomeUiState(
  userId: string | number | null | undefined,
  state: HomeUiState,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(homeUiStorageKey(userId), JSON.stringify(state));
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

function clearHomeUiState(userId?: string | number | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(homeUiStorageKey(userId));
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

function stableMapText(map: MapState) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}

type EvidenceSnapshotMeta = {
  category?: string;
  type?: string;
  subcategory?: string;
  filterLabel?: string;
  townName?: string;
  metric?: string;
  unit?: string;
  sourceName?: string;
  interpretationText?: string;
  chartData?: { label: string; value: number }[];
  photoSnapshotDataUrl?: string;
  photoSnapshotImageUrl?: string;
  photoSnapshotRelativeUrl?: string;
  photoSnapshotFilename?: string;
};

type EvidenceCardSummary =
  | string
  | {
      id: string;
      title?: string;
      imageSrc?: string;
      image?: string;
      content?: string;
      note?: string;
      category?: string;
      type?: string;
      sourceType?: string;
      source?: string;
      snapshotMeta?: EvidenceSnapshotMeta | null;
      snapshot?: EvidenceSnapshotMeta | null;
    };

type DisplayEvidenceCardSummary = {
  id: string;
  title: string;
  imageSrc: string;
  content: string;
};

const CARD_IMAGE_FILES_BY_CATEGORY: Record<string, string[]> = {
  water: [],
  land: [
    "dahu_development_population_density.webp",
    "dahu_development_traffic_volume.webp",
    "dahu_land_01.webp",
    "gongguan_development_population_density.webp",
    "gongguan_development_traffic_volume.webp",
    "gongguan_land_01.webp",
    "houlong_development_population_density.webp",
    "houlong_development_traffic_volume.webp",
    "houlong_land_01.webp",
    "miaoli_development_population_density.webp",
    "miaoli_development_traffic_volume.webp",
    "miaoli_land_01.webp",
    "nanzhuang_development_population_density.webp",
    "nanzhuang_land_01.webp",
    "sanwan_development_population_density.webp",
    "sanwan_development_traffic_volume.webp",
    "sanwan_land_01.webp",
    "sanyi_development_population_density.webp",
    "sanyi_development_traffic_volume.webp",
    "sanyi_land_01.webp",
    "shitan_development_population_density.webp",
    "shitan_development_traffic_volume.webp",
    "shitan_land_01.webp",
    "taian_development_population_density.webp",
    "taian_land_01.webp",
    "toufen_development_population_density.webp",
    "toufen_development_traffic_volume.webp",
    "tongluo_development_population_density.webp",
    "tongluo_development_traffic_volume.webp",
    "tongluo_land_01.webp",
    "tongxiao_development_population_density.webp",
    "tongxiao_development_traffic_volume.webp",
    "tongxiao_land_01.webp",
    "toufen_land_01.webp",
    "touwu_development_population_density.webp",
    "touwu_land_01.webp",
    "xihu_development_population_density.webp",
    "xihu_development_traffic_volume.webp",
    "xihu_land_01.webp",
    "yuanli_development_population_density.webp",
    "yuanli_development_traffic_volume.webp",
    "yuanli_land_01.webp",
    "zaoqiao_development_population_density.webp",
    "zaoqiao_development_traffic_volume.webp",
    "zaoqiao_land_01.webp",
    "zhunan_development_population_density.webp",
    "zhunan_development_traffic_volume.webp",
    "zhunan_land_01.webp",
    "zhuolan_development_population_density.webp",
    "zhuolan_development_traffic_volume.webp",
    "zhuolan_land_01.webp",
  ],
  leopard: [
    "dahu_leopard_01.webp",
    "dahu_leopard_03.webp",
    "gongguan_leopard_01.webp",
    "gongguan_leopard_03.webp",
    "houlong_leopard_01.webp",
    "houlong_leopard_02_1.webp",
    "houlong_leopard_02_2.webp",
    "houlong_leopard_02_3.webp",
    "houlong_leopard_03.webp",
    "miaoli_leopard_01.webp",
    "miaoli_leopard_03.webp",
    "nanzhuang_leopard_01.webp",
    "nanzhuang_leopard_03.webp",
    "sanwan_leopard_01.webp",
    "sanwan_leopard_03.webp",
    "sanyi_leopard_01.webp",
    "sanyi_leopard_02_1.webp",
    "sanyi_leopard_03.webp",
    "shitan_leopard_01.webp",
    "shitan_leopard_02_1.webp",
    "shitan_leopard_03.webp",
    "taian_leopard_03.webp",
    "tongluo_leopard_01.webp",
    "tongluo_leopard_03.webp",
    "tongxiao_leopard_01.webp",
    "tongxiao_leopard_02_1.webp",
    "tongxiao_leopard_02_2.webp",
    "tongxiao_leopard_02_3.webp",
    "tongxiao_leopard_03.webp",
    "toufen_leopard_01.webp",
    "toufen_leopard_03.webp",
    "touwu_leopard_01.webp",
    "touwu_leopard_03.webp",
    "xihu_leopard_01.webp",
    "xihu_leopard_03.webp",
    "yuanli_leopard_01.webp",
    "yuanli_leopard_02_1.webp",
    "yuanli_leopard_03.webp",
    "zaoqiao_leopard_01.webp",
    "zaoqiao_leopard_03.webp",
    "zhunan_leopard_03.webp",
    "zhuolan_leopard_01.webp",
    "zhuolan_leopard_02_1.webp",
    "zhuolan_leopard_03.webp",
  ],
  rumor: [
    "rumor_01.webp",
    "rumor_02.webp",
    "rumor_03.webp",
    "rumor_04.webp",
    "rumor_05.webp",
    "rumor_06.webp",
    "rumor_07.webp",
    "rumor_08.webp",
    "rumor_09.webp",
    "rumor_10.webp",
    "rumor_11.webp",
    "rumor_12.webp",
    "rumor_13.webp",
    "rumor_14.webp",
    "rumor_15.webp",
    "rumor_16.webp",
    "rumor_17.webp",
    "rumor_18.webp",
    "news_01.webp",
    "news_02.webp",
    "news_03.webp",
    "news_04.webp",
    "news_05.webp",
    "news_06.webp",
    "news_07.webp",
    "news_08.webp",
    "news_09.webp",
    "news_10.webp",
    "news_11.webp",
    "news_12.webp",
    "news_13.webp",
    "news_14.webp",
    "news_15.webp",
  ],
  other: [
    "Global_Card_01.webp",
    "Global_Card_02.webp",
    "Global_Card_03.webp",
    "Global_Card_04.webp",
    "Global_Card_05.webp",
    "Global_Card_06.webp",
    "Global_Card_07.webp",
    "Global_Card_08.webp",
    "Global_Card_09.webp",
    "Global_Card_10.webp",
    "Global_Card_11.webp",
    "Global_Card_12.webp",
    "Global_Card_13.webp",
  ],
};

const CARD_CATEGORY_LABEL: Record<string, string> = {
  water: "水資源",
  land: "土地資料",
  leopard: "石虎相關資訊",
  rumor: "傳言",
  other: "其他",
};

function getFallbackCardImageSrc(category: string, localNumber: number) {
  const cardImageFiles = CARD_IMAGE_FILES_BY_CATEGORY[category] ?? [];
  const index =
    Number.isFinite(localNumber) && localNumber > 0 ? localNumber - 1 : 0;
  const fileName = cardImageFiles[index] ?? cardImageFiles[0];
  return fileName ? `/card/${fileName}` : "/card/card-back-leopard-cat.webp";
}

function escapeEvidenceSvgText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getEvidenceSnapshotThumbnailDataUrl(
  meta?: EvidenceSnapshotMeta | null,
) {
  if (!meta || typeof meta !== "object") return "";

  const chartData = Array.isArray(meta.chartData)
    ? meta.chartData
        .map((point) => ({
          label: String(point?.label ?? ""),
          value: Number(point?.value ?? 0),
        }))
        .filter((point) => point.label || Number.isFinite(point.value))
    : [];

  const width = 1200;
  const height = 780;
  const title = meta.filterLabel || meta.townName || "快照證據卡";
  const metaCategory = meta.category || meta.type || "";
  const subcategory =
    meta.subcategory || CARD_CATEGORY_LABEL[metaCategory] || "數據快照";
  const unit = meta.unit || "";
  const maxValue = Math.max(...chartData.map((point) => point.value), 1);
  const visiblePoints = chartData.slice(0, 12);
  const barWidth =
    visiblePoints.length > 0
      ? Math.max(28, 560 / visiblePoints.length - 10)
      : 36;
  const barSvg = visiblePoints
    .map((point, index) => {
      const barHeight = Math.max(
        14,
        Math.min(250, (point.value / maxValue) * 250),
      );
      const x = 590 + index * (barWidth + 10);
      const y = 560 - barHeight;
      return `<g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="12" fill="#9fc5d6" stroke="#6c9caf" stroke-width="2" />
        <text x="${x + barWidth / 2}" y="${y - 10}" text-anchor="middle" font-size="18" font-weight="900" fill="#4f4032">${escapeEvidenceSvgText(unit === "RPI" ? point.value.toFixed(1) : Math.round(point.value))}</text>
        <text x="${x + barWidth / 2}" y="600" text-anchor="middle" font-size="15" font-weight="800" fill="#6b6258">${escapeEvidenceSvgText(point.label)}</text>
      </g>`;
    })
    .join("");

  const source = meta.sourceName
    ? `資料來源：${meta.sourceName}`
    : "學生建立的快照線索";
  const interpretation =
    meta.interpretationText ||
    "這張證據卡來自學生在水資源互動資料中建立的線索快照。";
  const interpretationLines = String(interpretation)
    .replace(/\s+/g, " ")
    .slice(0, 72)
    .match(/.{1,24}/g) || [""];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" rx="36" fill="#fff7df" />
    <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="32" fill="#fffaf0" stroke="#e0cfaa" stroke-width="4" />
    <text x="64" y="88" font-size="34" font-weight="900" fill="#332c24">${escapeEvidenceSvgText(title)}</text>
    <rect x="64" y="120" width="430" height="480" rx="26" fill="#ffffff" stroke="#d8c7a4" stroke-width="3" />
    <text x="92" y="168" font-size="25" font-weight="900" fill="#4f4032">${escapeEvidenceSvgText(subcategory)}位置圖</text>
    <rect x="112" y="210" width="332" height="290" rx="30" fill="#f4fbff" stroke="#c9dce8" stroke-width="3" />
    <path d="M197 270 C250 220 341 235 375 310 C415 398 348 458 267 448 C190 439 151 346 197 270 Z" fill="#ffffff" stroke="#b9d2de" stroke-width="7" />
    <circle cx="306" cy="344" r="30" fill="#9fc5d6" stroke="#4f8aa3" stroke-width="7" />
    <text x="278" y="548" font-size="24" font-weight="900" text-anchor="middle" fill="#4f4032">${escapeEvidenceSvgText(meta.townName || "水資源")}</text>
    <rect x="548" y="120" width="588" height="480" rx="26" fill="#ffffff" stroke="#d8c7a4" stroke-width="3" />
    <text x="584" y="168" font-size="25" font-weight="900" fill="#4f4032">數據分析圖</text>
    <line x1="584" y1="560" x2="1110" y2="560" stroke="#c9dce8" stroke-width="4" />
    ${barSvg}
    <rect x="64" y="630" width="1072" height="76" rx="22" fill="#f7ecd5" stroke="#d8c7a4" stroke-width="2" />
    <text x="92" y="660" font-size="20" font-weight="900" fill="#5c503e">資料解讀</text>
    <text x="92" y="688" font-size="19" font-weight="800" fill="#5c503e">${interpretationLines.map((line, index) => `<tspan x="92" dy="${index === 0 ? 0 : 23}">${escapeEvidenceSvgText(line)}</tspan>`).join("")}</text>
    <text x="1108" y="730" text-anchor="end" font-size="16" font-weight="800" fill="#8a7a62">${escapeEvidenceSvgText(source)}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveEvidenceCardSummary(
  card: EvidenceCardSummary,
): DisplayEvidenceCardSummary {
  const id = typeof card === "string" ? card : card.id;
  const [category, rawNumber] = id.split("-");
  const localNumber = Number(rawNumber);
  const fallbackImageSrc = getFallbackCardImageSrc(category, localNumber);
  const fallbackTitle = `${CARD_CATEGORY_LABEL[category] || "證據"}資料卡${Number.isFinite(localNumber) && localNumber > 0 ? ` ${localNumber}` : ""}`;

  if (typeof card === "string") {
    return {
      id,
      title: fallbackTitle,
      imageSrc: fallbackImageSrc,
      content: "",
    };
  }

  const snapshotMeta = card.snapshotMeta || card.snapshot || null;
  const snapshotPhotoImageSrc =
    snapshotMeta && typeof snapshotMeta.photoSnapshotImageUrl === "string"
      ? mediaUrl(snapshotMeta.photoSnapshotImageUrl)
      : snapshotMeta && typeof snapshotMeta.photoSnapshotDataUrl === "string"
        ? snapshotMeta.photoSnapshotDataUrl
        : "";
  const snapshotImageSrc = getEvidenceSnapshotThumbnailDataUrl(snapshotMeta);

  return {
    id,
    title: card.title || fallbackTitle,
    imageSrc:
      mediaUrl(card.imageSrc) ||
      mediaUrl(card.image) ||
      snapshotPhotoImageSrc ||
      snapshotImageSrc ||
      fallbackImageSrc,
    content: card.content || card.note || "",
  };
}

type InquiryIntroStageRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

type InquiryIntroStageRecord = {
  records: InquiryIntroStageRecordItem[];
};

type FinalSummary = {
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

function isCompletedFinalSummary(summary: FinalSummary) {
  return Boolean(
    String(summary.conclusion || "").trim() ||
    (Array.isArray(summary.evidenceCards) && summary.evidenceCards.length > 0),
  );
}

function getFinalSummaryKey(summary: FinalSummary) {
  if (summary.orientationCreatedAt)
    return `created:${summary.orientationCreatedAt}`;
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

function upsertFinalSummary(
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

const INVESTIGATION_CASE_FLOW = [
  {
    id: "discover_crisis",
    title: "調查一：發現危機",
    shortTitle: "發現危機",
    task: "先找出石虎可能遇到的危機，不急著下定論",
    reportBadge: "TASK 1",
  },
  {
    id: "lock_suspect",
    title: "調查二：鎖定嫌疑犯",
    shortTitle: "鎖定嫌疑犯",
    task: "根據初步線索，調查並找出造成石虎危機的兇手",
    reportBadge: "TASK 2",
  },
  {
    id: "trace_evidence",
    title: "調查三：追查證據",
    shortTitle: "追查證據",
    task: "替你的懷疑補上更多證據吧~",
    reportBadge: "TASK 3",
  },
  {
    id: "revise_inference",
    title: "調查四：修正推論",
    shortTitle: "修正推論",
    task: "檢查是否還有其他因素，將你的調查塑造成更合理的成果",
    reportBadge: "TASK 4",
  },
];

function getInvestigationCaseByOrder(order?: number | null) {
  const safeOrder = Math.max(1, Number(order || 1));
  if (safeOrder > INVESTIGATION_CASE_FLOW.length) {
    return {
      id: "free_inquiry",
      title: `延伸探究 ${safeOrder}`,
      shortTitle: "延伸探究",
      task: "主要調查已完成，後續可以自由的去探究，延伸調查的目的",
      reportBadge: `EXTRA ${safeOrder}`,
    };
  }
  return INVESTIGATION_CASE_FLOW[safeOrder - 1] || INVESTIGATION_CASE_FLOW[0];
}

function getInvestigationCaseBySummary(
  summary: FinalSummary,
  fallbackIndex: number,
) {
  return getInvestigationCaseByOrder(summary.recordOrder || fallbackIndex + 1);
}

function getNextInvestigationCase(completedCount: number) {
  // 首頁新增調查書卡片要顯示「下一份」探究書的任務。
  // 完成任務四後仍可繼續建立第 5 份延伸探究，所以不能把順序 clamp 在任務四。
  return getInvestigationCaseByOrder(completedCount + 1);
}

type TitleReward = {
  id: string;
  name: string;
  description: string;
};

type PendingReportReveal = {
  startIndex: number;
  targetIndex: number;
  waitForTitleReward: boolean;
};

type GroupMember = {
  id: number | string;
  username?: string;
  name?: string;
  email?: string;
  isGroupLeader?: boolean;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role?: "teacher" | "student";
  groupId?: string | null;
  groupName?: string | null;
  groupIcon?: string | null;
  isGroupLeader?: boolean;
  groupMembers?: GroupMember[];
};

type GroupPersonalMap = Record<string, MapChoice>;

type RealtimeCardPackLockSignal = {
  nonce: number;
  groupId: string | null;
  selectedCardIds: string[];
  lockedAt: string;
} | null;

type RegionDecision = {
  result: MapChoice | "";
  locked: boolean;
  isTie: boolean;
  conserveCount: number;
  developCount: number;
  finalChoice?: MapChoice;
};

type RegionDecisionValue = RegionDecision | MapChoice | "";
type RegionDecisionMap = Record<string, RegionDecisionValue>;

type FinalDecisionCard = {
  cardId: string;
  title: string;
  stance: "利己" | "利他" | "中立";
  score: number;
};

type FinalDecisionGroup = {
  groupId: string;
  groupName: string;
  selectedCardIds: string[];
  cards: FinalDecisionCard[];
  score: number;
  lockedAt?: string | null;
  reason?: string;
};

type FinalDecisionOutcome = {
  id: "sustainable" | "partial" | "crisis" | string;
  title: string;
  subtitle: string;
  scoreRange?: string;
};

type FinalDecisionSettlement = {
  isFinalized: boolean;
  finalizedAt?: string | null;
  totalScore?: number;
  outcome?: FinalDecisionOutcome;
  groups?: FinalDecisionGroup[];
};

function getFinalSettlementSignature(
  settlement: FinalDecisionSettlement | null | undefined,
) {
  if (!settlement?.isFinalized) return "";
  if (settlement.finalizedAt) return settlement.finalizedAt;

  const groupSignature = (settlement.groups || [])
    .map(
      (group) => `${group.groupId}:${(group.selectedCardIds || []).join(",")}`,
    )
    .join("|");
  return `${settlement.outcome?.id || "unknown"}:${groupSignature}`;
}

function getFinalSettlementHandledStorageKey(userId?: number | string | null) {
  return userId ? `cityauncel_final_settlement_handled_${userId}` : "";
}

function readHandledFinalSettlementKey(userId?: number | string | null) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return "";

  try {
    return window.sessionStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function writeHandledFinalSettlementKey(
  userId: number | string | null | undefined,
  settlementKey: string,
) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(storageKey, settlementKey);
  } catch {
    // sessionStorage 失敗不影響主要流程。
  }
}

function clearHandledFinalSettlementKey(userId?: number | string | null) {
  const storageKey = getFinalSettlementHandledStorageKey(userId);
  if (!storageKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // sessionStorage 失敗不影響主要流程。
  }
}

type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

type SuspectVotingStatus = {
  isOpen: boolean;
  isFinalized: boolean;
  finalizedSuspects?: Array<{
    roleId?: string;
    roleName?: string;
    groupId: string;
    groupName: string;
    count: number;
  }>;
  finalizedAt?: string | null;
  totals: Record<string, number>;
  totalVoters: number;
  totalEligibleVoters: number;
  myVotes: string[];
};

function getMapDecisionChoice(decision?: RegionDecisionValue): MapChoice | "" {
  if (
    decision === "保育" ||
    decision === "開發" ||
    decision === "我不知道" ||
    decision === ""
  ) {
    return decision;
  }

  return decision?.finalChoice || decision?.result || "";
}

const GAME_BTN =
  "relative overflow-hidden rounded-xl border px-5 py-3 text-sm font-semibold tracking-[0.12em] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]";
const GAME_BTN_BLUE =
  "border-stone-300 bg-white/85 text-stone-700 hover:border-stone-500 hover:bg-stone-50";
const GAME_BTN_DISABLED =
  "cursor-not-allowed border-stone-200 bg-stone-100/80 text-stone-400 shadow-none hover:translate-y-0 hover:shadow-none active:scale-100";

const SUSPECT_GROUPS = [
  {
    id: "public",
    name: "一般民眾",
    shortName: "一般民眾",
    description:
      "為了生活、通勤、旅遊或送貨而使用道路的人，可能讓石虎移動時遇到更多危險。",
  },
  {
    id: "developer",
    name: "建商/企業",
    shortName: "建商/企業",
    description:
      "推動土地開發、建設或產業使用的角色，可能改變石虎原本的生活空間。",
  },
  {
    id: "resident",
    name: "當地居民",
    shortName: "當地居民",
    description:
      "和石虎住在同一片淺山的人，可能因家禽損失或生活不安與石虎產生衝突。",
  },
  {
    id: "farmer",
    name: "農民",
    shortName: "農民",
    description:
      "管理農地與作物的人，藥劑、毒鼠藥或陷阱可能造成看不見的環境傷害。",
  },
  {
    id: "authority",
    name: "地方主管機關",
    shortName: "地方主管機關",
    description:
      "負責道路、土地規劃、保育政策與管理的單位，規劃若忽略石虎需求，危機可能持續累積。",
  },
  {
    id: "media",
    name: "媒體",
    shortName: "媒體",
    description:
      "傳播消息並影響大眾看法的角色，未查證或放大衝突的報導可能讓石虎被誤解。",
  },
];

const DEFAULT_SUSPECT_ROLE_RANKING = SUSPECT_GROUPS.map((group) => group.id);

const HOME_TITLE_REWARDS: TitleReward[] = [
  {
    id: "water_novice",
    name: "略懂水性",
    description: "蒐集 3 張水資源卡牌",
  },
  {
    id: "water_advanced",
    name: "有點水準",
    description: "蒐集 7 張水資源卡牌",
  },
  {
    id: "water_master",
    name: "水很深",
    description: "蒐集 10 張水資源卡牌",
  },
  {
    id: "land_novice",
    name: "腳踏實地",
    description: "蒐集 3 張土地資料卡牌",
  },
  {
    id: "land_advanced",
    name: "有土有真相",
    description: "蒐集 7 張土地資料卡牌",
  },
  {
    id: "land_master",
    name: "地頭蛇",
    description: "蒐集 10 張土地資料卡牌",
  },
  {
    id: "leopard_novice",
    name: "初生之虎",
    description: "蒐集 3 張石虎相關資料卡牌",
  },
  {
    id: "leopard_advanced",
    name: "虎視眈眈",
    description: "蒐集 7 張石虎相關資料卡牌",
  },
  {
    id: "leopard_master",
    name: "如虎添翼",
    description: "蒐集 10 張石虎相關資料卡牌",
  },
  {
    id: "rumor_novice",
    name: "小耳朵",
    description: "蒐集 3 張 NPC 傳言卡牌",
  },
  {
    id: "rumor_advanced",
    name: "三姑六婆",
    description: "蒐集 7 張 NPC 傳言卡牌",
  },
  {
    id: "rumor_master",
    name: "八卦王",
    description: "蒐集 10 張 NPC 傳言卡牌",
  },
  {
    id: "cross_novice",
    name: "東張西望",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 2 張卡牌",
  },
  {
    id: "cross_advanced",
    name: "略懂略懂",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 4 張卡牌",
  },
  {
    id: "cross_master",
    name: "四界都有你",
    description: "水資源、土地資料、石虎相關資料、傳言都至少蒐集 6 張卡牌",
  },
  {
    id: "investigation_novice",
    name: "見習調查員",
    description: "完成 1 份探究調查書",
  },
  {
    id: "investigation_advanced",
    name: "資深調查員",
    description: "完成 4 份探究調查書",
  },
  {
    id: "investigation_master",
    name: "首席調查官",
    description: "完成 5 份探究調查書",
  },
];

function isSupportedHomeTitleReward(title: TitleReward | null | undefined) {
  return Boolean(title?.id) && !String(title?.id).startsWith("other_");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMedalStyle(title: TitleReward) {
  const isMaster = title.id.includes("master") || title.name.includes("大師");
  const isAdvanced =
    title.id.includes("advanced") || title.name.includes("老手");

  if (isMaster) {
    return {
      rank: "MASTER",
      label: "大師級勳章",
      shine: "from-[#fff4c0] via-[#d8a93b] to-[#8b6320]",
      metal: "from-[#fff7cf] via-[#d8aa3d] to-[#8b6422]",
      border: "border-[#b7892e]",
      ribbon: "from-[#7b2f2f] via-[#9f4a3f] to-[#5d2323]",
      text: "text-[#5f4217]",
      glow: "shadow-[0_14px_28px_rgba(139,100,34,0.24)]",
      star: "★ ★ ★",
      starText:
        "text-[#fff2a8] [text-shadow:0_1px_0_rgba(95,66,23,0.55),0_0_6px_rgba(255,244,192,0.85)]",
    };
  }

  if (isAdvanced) {
    return {
      rank: "VETERAN",
      label: "老手級勳章",
      shine: "from-[#ffffff] via-[#c9c9c4] to-[#8c8d88]",
      metal: "from-[#ffffff] via-[#c9c9c4] to-[#7f817c]",
      border: "border-[#9a9c96]",
      ribbon: "from-[#3f4f5e] via-[#607082] to-[#2f3b48]",
      text: "text-[#4f514c]",
      glow: "shadow-[0_14px_28px_rgba(75,85,99,0.18)]",
      star: "★ ★",
      starText:
        "text-[#f7f7ef] [text-shadow:0_1px_0_rgba(79,81,76,0.55),0_0_6px_rgba(255,255,255,0.85)]",
    };
  }

  return {
    rank: "ROOKIE",
    label: "新手級勳章",
    shine: "from-[#ffe4c4] via-[#b9784b] to-[#7a442b]",
    metal: "from-[#ffe2bf] via-[#b9784b] to-[#764126]",
    border: "border-[#9a5f3d]",
    ribbon: "from-[#5d4a3f] via-[#8a6b58] to-[#49382f]",
    text: "text-[#70452c]",
    glow: "shadow-[0_14px_28px_rgba(120,65,38,0.18)]",
    star: "★",
    starText:
      "text-[#ffd7a3] [text-shadow:0_1px_0_rgba(112,69,44,0.6),0_0_5px_rgba(255,226,191,0.75)]",
  };
}

function MedalStars({
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

// 首頁負責讀取登入者狀態、任務進度與教師端控制後的入口顯示。
export default function HomePage() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => readStoredUser());
  type UnlockedCardData =
    | string
    | {
        id: string;
        content?: string;
        note?: string;
        studentNote?: string;
        reflectionNote?: string;
        unlockedAt?: string | number | null;
      };

  const initialHomeDraft = readHomePageDraft(currentUser?.id);
  const initialHomeUiState = readHomeUiState(currentUser?.id);
  const [unlockedCards, setUnlockedCards] = useState<UnlockedCardData[]>([]);
  const [page, setPage] = useState<Page>(() => {
    const storedPage = readStoredPage(currentUser?.id);
    if (
      currentUser?.role !== "teacher" &&
      (storedPage === "teacherGroups" || storedPage === "teacherStudentData")
    ) {
      return "home";
    }
    return storedPage;
  });
  const [orientationMainChoice, setOrientationMainChoice] = useState(
    initialHomeDraft?.orientationMainChoice ?? "",
  );
  const [orientationTextInput, setOrientationTextInput] = useState(
    initialHomeDraft?.orientationTextInput ?? "",
  );
  const [finalSummaries, setFinalSummaries] = useState<FinalSummary[]>([]);
  const [activeInquiryRecordOrder, setActiveInquiryRecordOrder] = useState<
    number | null
  >(
    initialHomeUiState.activeInquiryRecordOrder != null &&
      Number.isFinite(Number(initialHomeUiState.activeInquiryRecordOrder))
      ? Number(initialHomeUiState.activeInquiryRecordOrder)
      : null,
  );
  const [isInquiryTaskOpen, setIsInquiryTaskOpen] = useState(true);
  const [inquiryLockHint, setInquiryLockHint] = useState(false);
  const [isMapTaskOpen, setIsMapTaskOpen] = useState(false);
  const [isCardPackOpen, setIsCardPackOpen] = useState(false);
  const [isStudentScreenLocked, setIsStudentScreenLocked] = useState(false);
  const [isAiHelperAvailable, setIsAiHelperAvailable] = useState(false);
  const [votingStatus, setVotingStatus] = useState<SuspectVotingStatus>({
    isOpen: false,
    isFinalized: false,
    finalizedSuspects: [],
    finalizedAt: null,
    totals: {},
    totalVoters: 0,
    totalEligibleVoters: 0,
    myVotes: [],
  });
  const [finalDecisionSettlement, setFinalDecisionSettlement] =
    useState<FinalDecisionSettlement>({ isFinalized: false });
  const [finalEndingCountdown, setFinalEndingCountdown] = useState<
    number | null
  >(null);
  const [draftSuspectVotes, setDraftSuspectVotes] = useState<string[]>([]);
  const [suspectVoteMessage, setSuspectVoteMessage] = useState("");
  const [isSubmittingSuspectVote, setIsSubmittingSuspectVote] = useState(false);
  const [reportPageIndex, setReportPageIndex] = useState(
    Number.isFinite(Number(initialHomeUiState.reportPageIndex))
      ? Math.max(0, Number(initialHomeUiState.reportPageIndex))
      : 0,
  );
  const [mapPreviewPageIndex, setMapPreviewPageIndex] = useState(
    Number.isFinite(Number(initialHomeUiState.mapPreviewPageIndex))
      ? Math.max(0, Number(initialHomeUiState.mapPreviewPageIndex))
      : 0,
  );
  const [reportDragOffset, setReportDragOffset] = useState(0);
  const [mapDragOffset, setMapDragOffset] = useState(0);
  const reportDragStartXRef = useRef<number | null>(null);
  const reportPressReportIndexRef = useRef<number | null>(null);
  const mapDragStartXRef = useRef<number | null>(null);
  const reportDidDragRef = useRef(false);
  const mapDidDragRef = useRef(false);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const titleCollectionSectionRef = useRef<HTMLElement | null>(null);
  const reportRevealTimerRef = useRef<number | null>(null);
  const [pendingReportReveal, setPendingReportReveal] =
    useState<PendingReportReveal | null>(null);
  const [openedReportIndex, setOpenedReportIndex] = useState<number | null>(
    initialHomeUiState.openedReportIndex != null &&
      Number.isFinite(Number(initialHomeUiState.openedReportIndex))
      ? Math.max(0, Number(initialHomeUiState.openedReportIndex))
      : null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [earnedHomeTitles, setEarnedHomeTitles] = useState<TitleReward[]>([]);
  const [titleRewardToast, setTitleRewardToast] = useState<TitleReward | null>(
    null,
  );
  const [isTitleRewardSequenceActive, setIsTitleRewardSequenceActive] =
    useState(false);
  const titleRewardDismissTimerRef = useRef<number | null>(null);
  const isLoadingUserDataRef = useRef(false);
  const hasLoadedUserDataRef = useRef(false);
  const lastSavedMapTextRef = useRef("");
  const [isDraftPersistenceReady, setIsDraftPersistenceReady] = useState(false);

  const shouldUseCssImmersive = shouldUseCssImmersiveMode();
  const canUseFullscreen = shouldUseCssImmersive || canUseBrowserFullscreen();

  const [mapState, setMapState] = useState<MapState>({});
  const [groupPersonalData, setGroupPersonalData] = useState<
    GroupPersonalMap[]
  >([]);
  const [classGroupData, setClassGroupData] = useState<RegionDecisionMap[]>([]);
  const [groupFinalChoices, setGroupFinalChoices] = useState<GroupPersonalMap>(
    {},
  );
  const [classFinalChoices, setClassFinalChoices] = useState<GroupPersonalMap>(
    {},
  );
  const [realtimeCardPackLockSignal, setRealtimeCardPackLockSignal] =
    useState<RealtimeCardPackLockSignal>(null);
  const groupMapRefreshTimerRef = useRef<number | null>(null);
  const latestGroupMapRequestIdRef = useRef(0);
  const activeFinalSettlementKeyRef = useRef<string | null>(null);
  const isTeacher = currentUser?.role === "teacher";

  useEffect(() => {
    if (!currentUser?.id) return;
    if (
      !isTeacher &&
      (page === "teacherGroups" || page === "teacherStudentData")
    ) {
      setPage("home");
      saveStoredPage(currentUser.id, "home");
      return;
    }
    saveStoredPage(currentUser.id, page);
  }, [currentUser?.id, isTeacher, page]);

  useEffect(() => {
    if (!currentUser?.id) return;
    saveHomeUiState(currentUser.id, {
      activeInquiryRecordOrder,
      reportPageIndex,
      mapPreviewPageIndex,
      openedReportIndex,
    });
  }, [
    activeInquiryRecordOrder,
    currentUser?.id,
    mapPreviewPageIndex,
    openedReportIndex,
    reportPageIndex,
  ]);

  const forceFinalEndingPage = useCallback(() => {
    window.history.replaceState({ page: "ending" }, "", window.location.href);
    window.history.pushState({ page: "ending" }, "", window.location.href);
    setPage("ending");
  }, []);

  const handleFinalSettlementForStudent = useCallback(
    (settlement: FinalDecisionSettlement) => {
      if (isTeacher || !settlement.isFinalized) return;

      const settlementKey = getFinalSettlementSignature(settlement);
      if (!settlementKey) return;

      const handledKey = readHandledFinalSettlementKey(currentUser?.id);
      if (handledKey === settlementKey) {
        activeFinalSettlementKeyRef.current = settlementKey;
        setFinalEndingCountdown(null);
        forceFinalEndingPage();
        return;
      }

      if (
        activeFinalSettlementKeyRef.current === settlementKey &&
        finalEndingCountdown !== null
      ) {
        return;
      }

      activeFinalSettlementKeyRef.current = settlementKey;
      window.history.replaceState(
        { page: "endingCountdown" },
        "",
        window.location.href,
      );
      window.history.pushState(
        { page: "endingCountdown" },
        "",
        window.location.href,
      );
      setFinalEndingCountdown(5);
    },
    [currentUser?.id, finalEndingCountdown, forceFinalEndingPage, isTeacher],
  );

  useEffect(() => {
    if (isTeacher || finalEndingCountdown === null) return;

    if (finalEndingCountdown <= 0) {
      const settlementKey =
        activeFinalSettlementKeyRef.current ||
        getFinalSettlementSignature(finalDecisionSettlement);
      if (settlementKey)
        writeHandledFinalSettlementKey(currentUser?.id, settlementKey);
      const finishTimer = window.setTimeout(() => {
        forceFinalEndingPage();
        setFinalEndingCountdown(null);
      }, 0);
      return () => window.clearTimeout(finishTimer);
    }

    const timer = window.setTimeout(() => {
      setFinalEndingCountdown((current) =>
        current === null ? null : Math.max(current - 1, 0),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    currentUser?.id,
    finalDecisionSettlement,
    finalEndingCountdown,
    forceFinalEndingPage,
    isTeacher,
  ]);
  const shouldShowSuspectVoteModal =
    Boolean(token) &&
    currentUser?.role === "student" &&
    votingStatus.isOpen &&
    !votingStatus.isFinalized &&
    votingStatus.myVotes.length === 0;
  const markedMapCount = Object.values(mapState).filter(
    (value) => value === "保育" || value === "開發" || value === "我不知道",
  ).length;
  const reportPageCount = finalSummaries.length + 1;
  const safeReportPageIndex = clamp(reportPageIndex, 0, reportPageCount - 1);
  const openedReport =
    openedReportIndex === null
      ? null
      : (finalSummaries[openedReportIndex] ?? null);

  function resolveMapVotes(votes: (MapChoice | "")[]): MapChoice | "" {
    const conserveCount = votes.filter((choice) => choice === "保育").length;
    const developCount = votes.filter((choice) => choice === "開發").length;
    const unknownCount = votes.filter((choice) => choice === "我不知道").length;
    const knownVotes = conserveCount + developCount;

    if (conserveCount > developCount) return "保育";
    if (developCount > conserveCount) return "開發";
    if (knownVotes === 0 && unknownCount === votes.length && votes.length > 0) {
      return "我不知道";
    }
    return "";
  }

  const buildGroupPreviewMap = useCallback((): MapState => {
    const next: MapState = {};

    regions.forEach((region) => {
      const votes = groupPersonalData.map(
        (student) => student[region.name] || "",
      );
      const autoChoice = resolveMapVotes(votes);
      const knownVotes = votes.filter(
        (choice) => choice === "保育" || choice === "開發",
      );
      const isActiveTie =
        knownVotes.length > 0 &&
        knownVotes.filter((choice) => choice === "保育").length ===
          knownVotes.filter((choice) => choice === "開發").length;
      const displayChoice =
        isActiveTie && groupFinalChoices[region.name]
          ? groupFinalChoices[region.name]
          : autoChoice;

      if (
        displayChoice === "保育" ||
        displayChoice === "開發" ||
        displayChoice === "我不知道"
      ) {
        next[region.name] = displayChoice;
      }
    });

    return next;
  }, [groupFinalChoices, groupPersonalData]);

  const buildClassPreviewMap = useCallback((): MapState => {
    const next: MapState = {};

    regions.forEach((region) => {
      const votes = classGroupData.map((group) =>
        getMapDecisionChoice(group[region.name]),
      );
      const autoChoice = resolveMapVotes(votes);
      const knownVotes = votes.filter(
        (choice) => choice === "保育" || choice === "開發",
      );
      const isActiveTie =
        knownVotes.length > 0 &&
        knownVotes.filter((choice) => choice === "保育").length ===
          knownVotes.filter((choice) => choice === "開發").length;
      const displayChoice =
        isActiveTie && classFinalChoices[region.name]
          ? classFinalChoices[region.name]
          : autoChoice;

      if (
        displayChoice === "保育" ||
        displayChoice === "開發" ||
        displayChoice === "我不知道"
      ) {
        next[region.name] = displayChoice;
      }
    });

    return next;
  }, [classFinalChoices, classGroupData]);

  const mapPreviewPages = useMemo(
    () => [
      { title: "我的石虎地圖", map: mapState },
      {
        title: "小組地圖",
        subtitle: currentUser?.groupName || "小組共識地圖",
        map: buildGroupPreviewMap(),
      },
      { title: "全班共識彙整結果", map: buildClassPreviewMap() },
    ],
    [
      mapState,
      buildClassPreviewMap,
      buildGroupPreviewMap,
      currentUser?.groupName,
    ],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReportPageIndex((prev) => clamp(prev, 0, reportPageCount - 1));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reportPageCount]);

  useEffect(() => {
    if (!page || page === "home") return;

    // 離開首頁時若探究調查書拖曳被中斷，重設拖曳狀態，避免重新登入後卡在不可互動的空白位移。
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    const timer = window.setTimeout(() => setReportDragOffset(0), 0);
    return () => window.clearTimeout(timer);
  }, [page]);

  useEffect(() => {
    if (!titleRewardToast) return;

    const activateTimer = window.setTimeout(() => {
      setIsTitleRewardSequenceActive(true);
    }, 0);

    if (titleRewardDismissTimerRef.current !== null) {
      window.clearTimeout(titleRewardDismissTimerRef.current);
    }

    titleRewardDismissTimerRef.current = window.setTimeout(() => {
      setTitleRewardToast(null);
      titleRewardDismissTimerRef.current = null;
    }, 3300);

    return () => {
      window.clearTimeout(activateTimer);
      if (titleRewardDismissTimerRef.current !== null) {
        window.clearTimeout(titleRewardDismissTimerRef.current);
        titleRewardDismissTimerRef.current = null;
      }
    };
  }, [titleRewardToast]);

  useEffect(() => {
    if (!pendingReportReveal || page !== "home") return;

    const shouldWaitForTitlePopup =
      pendingReportReveal.waitForTitleReward &&
      (isTitleRewardSequenceActive || Boolean(titleRewardToast));

    // 有獲得「見習調查員／資深調查員／首席調查官」時，
    // 只等待稱號彈窗完整退場，不再把畫面移到稱號收藏。
    if (shouldWaitForTitlePopup) {
      return;
    }

    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }

    const initialRevealTimer = window.setTimeout(() => {
      setReportPageIndex(pendingReportReveal.startIndex);
    }, 0);

    reportRevealTimerRef.current = window.setTimeout(
      () => {
        // 稱號彈窗結束後，才移動到 INQUIRYBOOK / 探究調查書的位置。
        reportSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        reportRevealTimerRef.current = window.setTimeout(() => {
          // 畫面定位完成後，先讓學生看見剛完成的成果約 0.5 秒，
          // 再執行任務 X → 任務 X+1 的換頁效果。
          setReportPageIndex(pendingReportReveal.targetIndex);

          reportRevealTimerRef.current = window.setTimeout(() => {
            setPendingReportReveal(null);
            reportRevealTimerRef.current = null;
          }, 520);
        }, 1300);
      },
      pendingReportReveal.waitForTitleReward ? 260 : 220,
    );

    return () => {
      window.clearTimeout(initialRevealTimer);
      if (reportRevealTimerRef.current !== null) {
        window.clearTimeout(reportRevealTimerRef.current);
        reportRevealTimerRef.current = null;
      }
    };
  }, [
    isTitleRewardSequenceActive,
    page,
    pendingReportReveal,
    titleRewardToast,
  ]);

  useEffect(() => {
    if (openedReportIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedReportIndex(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openedReportIndex]);

  useEffect(() => {
    let restoreHomeTimer: number | null = null;
    if (!finalDecisionSettlement.isFinalized) {
      window.history.replaceState(
        { page: page === "ending" ? "home" : page },
        "",
        window.location.href,
      );
      if (page === "ending") {
        restoreHomeTimer = window.setTimeout(() => setPage("home"), 0);
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const nextPage =
        (event.state?.page as Page | "endingCountdown" | undefined) || "home";

      if (
        currentUser?.role !== "teacher" &&
        finalDecisionSettlement.isFinalized
      ) {
        if (finalEndingCountdown !== null) {
          window.history.pushState(
            { page: "endingCountdown" },
            "",
            window.location.href,
          );
          return;
        }

        forceFinalEndingPage();
        return;
      }

      if (
        (nextPage === "teacherGroups" || nextPage === "teacherStudentData") &&
        currentUser?.role !== "teacher"
      ) {
        setPage("home");
        return;
      }
      if (nextPage !== "endingCountdown") setPage(nextPage);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      if (restoreHomeTimer !== null) window.clearTimeout(restoreHomeTimer);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [
    currentUser?.role,
    finalDecisionSettlement.isFinalized,
    finalEndingCountdown,
    forceFinalEndingPage,
    page,
  ]);

  useEffect(() => {
    if (shouldUseCssImmersive) return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [shouldUseCssImmersive]);

  const syncCurrentUser = useCallback(async () => {
    if (!token) return;

    try {
      const data = await getMe(token);
      if (!data.user) return;

      setCurrentUser((prev) => {
        const nextUser = data.user as AuthUser;
        const prevText = JSON.stringify(prev);
        const nextText = JSON.stringify(nextUser);
        if (prevText === nextText) return prev;
        saveStoredUser(nextUser);
        return nextUser;
      });
    } catch (error) {
      console.error("同步使用者資料發生錯誤：", error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const initialSyncTimer = window.setTimeout(() => {
      void syncCurrentUser();
    }, 0);

    // 即時同步已交給 SSE；這裡只保留低頻備援，避免背景輪詢卡住按鈕互動。
    const timer = window.setInterval(() => {
      syncCurrentUser();
    }, 15000);

    return () => {
      window.clearTimeout(initialSyncTimer);
      window.clearInterval(timer);
    };
  }, [syncCurrentUser, token]);

  useEffect(() => {
    if (!token) return;

    const flush = () => {
      void flushPendingWrites(token);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") flush();
    };

    flush();
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  const loadGroupAndClassMapData = useCallback(async () => {
    if (!token) return;

    const requestId = latestGroupMapRequestIdRef.current + 1;
    latestGroupMapRequestIdRef.current = requestId;

    try {
      const data = await getGroupPersonalMaps(token);
      if (requestId !== latestGroupMapRequestIdRef.current) return;

      setGroupPersonalData(
        Array.isArray(data.personalData) ? data.personalData : [],
      );
      setGroupFinalChoices(data.groupFinalDecisions || data.finalChoices || {});

      if (Array.isArray(data.members)) {
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const nextUser = {
            ...prev,
            groupId: data.groupId ?? prev.groupId ?? null,
            groupName: data.groupName ?? prev.groupName ?? null,
            groupMembers: data.members,
          };
          if (JSON.stringify(prev) === JSON.stringify(nextUser)) return prev;
          saveStoredUser(nextUser);
          return nextUser;
        });
      }

      const classData = await getClassGroupDecisions(token);
      if (requestId !== latestGroupMapRequestIdRef.current) return;

      const rawGroupData = Array.isArray(classData.groupData)
        ? classData.groupData
        : Array.isArray(classData.groupResults)
          ? classData.groupResults
          : [];

      setClassGroupData(
        rawGroupData.map((item: ClassGroupDecisionItemApi) => item?.decisions ?? item),
      );

      if (classData.classFinalChoices) {
        setClassFinalChoices(classData.classFinalChoices);
      } else {
        const finalData = await getClassFinalDecisions(token);
        if (requestId !== latestGroupMapRequestIdRef.current) return;
        setClassFinalChoices(finalData || {});
      }
    } catch (error) {
      console.error("讀取小組/全班地圖資料發生錯誤：", error);
    }
  }, [token]);

  const scheduleGroupAndClassMapRefresh = useCallback(() => {
    if (!token) return;

    if (groupMapRefreshTimerRef.current !== null) {
      window.clearTimeout(groupMapRefreshTimerRef.current);
    }

    groupMapRefreshTimerRef.current = window.setTimeout(() => {
      groupMapRefreshTimerRef.current = null;
      loadGroupAndClassMapData();
    }, 250);
  }, [loadGroupAndClassMapData, token]);

  const applyMyMapToGroupPersonalData = useCallback(
    (nextMapState: MapState) => {
      const myId = currentUser?.id;
      const members = currentUser?.groupMembers || [];
      if (!myId || members.length === 0) return;

      const myIndex = members.findIndex(
        (member) => String(member.id) === String(myId),
      );
      if (myIndex < 0) return;

      setGroupPersonalData((prev) => {
        const next = [...prev];
        while (next.length < members.length) next.push({});

        const previousMap = next[myIndex] || {};
        if (stableMapText(previousMap) === stableMapText(nextMapState)) {
          return prev;
        }

        next[myIndex] = nextMapState;
        return next;
      });
    },
    [currentUser?.groupMembers, currentUser?.id],
  );

  useEffect(() => {
    if (!token) {
      const resetTimer = window.setTimeout(() => {
        setGroupPersonalData([]);
        setClassGroupData([]);
        setGroupFinalChoices({});
        setClassFinalChoices({});
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const initialLoadTimer = window.setTimeout(() => {
      void loadGroupAndClassMapData();
    }, 0);

    // 主要靠 SSE 即時推送；輪詢只當斷線備援。
    const timer = window.setInterval(() => {
      loadGroupAndClassMapData();
    }, 15000);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(timer);
      if (groupMapRefreshTimerRef.current !== null) {
        window.clearTimeout(groupMapRefreshTimerRef.current);
        groupMapRefreshTimerRef.current = null;
      }
    };
  }, [loadGroupAndClassMapData, token]);

  useEffect(() => {
    if (!token || !currentUser?.id) return;

    const authToken = token;
    const userId = currentUser.id;
    hasLoadedUserDataRef.current = false;
    const draftReadyResetTimer = window.setTimeout(() => {
      setIsDraftPersistenceReady(false);
    }, 0);

    async function loadUserData() {
      isLoadingUserDataRef.current = true;

      try {
        const data = await loadInquiryData(authToken);

        // localStorage 只保留尚未送出的文字草稿；稱號、卡牌、探究書、地圖都以資料庫為唯一來源。
        const localDraft = readHomePageDraft(userId);
        const serverFinalSummaries = Array.isArray(data.finalSummaries)
          ? (data.finalSummaries as FinalSummary[])
          : [];
        const serverEarnedTitles = Array.isArray(data.earnedTitles)
          ? (data.earnedTitles as TitleReward[])
          : [];
        const serverUnlockedCards = Array.isArray(data.unlockedCards)
          ? (data.unlockedCards as UnlockedCardData[])
          : [];

        setOrientationMainChoice(
          data.orientationMainChoice || localDraft?.orientationMainChoice || "",
        );
        setOrientationTextInput(
          data.orientationTextInput || localDraft?.orientationTextInput || "",
        );
        // 後端資料庫是探究調查書的唯一資料來源；避免 localStorage 舊草稿覆蓋正確資料。
        setFinalSummaries(serverFinalSummaries);
        // 登入後預設顯示最新一份探究調查書；沒有報告時維持在「建立新的探究探究調查書」。
        const restoredReportPageIndex = Number(
          readHomeUiState(userId).reportPageIndex,
        );
        setReportPageIndex(
          Number.isFinite(restoredReportPageIndex)
            ? clamp(
                restoredReportPageIndex,
                0,
                Math.max(0, serverFinalSummaries.length),
              )
            : serverFinalSummaries.length > 0
              ? serverFinalSummaries.length - 1
              : 0,
        );
        setEarnedHomeTitles(serverEarnedTitles);
        setUnlockedCards(serverUnlockedCards);

        const mapData = await getUserMap(authToken);
        const loadedMap = mapData.mapState || {};
        setMapState(loadedMap);
        lastSavedMapTextRef.current = stableMapText(loadedMap);

        const taskData = await getMapTaskStatus(authToken);
        setIsMapTaskOpen(Boolean(taskData.isOpen));
      } catch (err) {
        console.error(err);
      } finally {
        window.setTimeout(() => {
          isLoadingUserDataRef.current = false;
          hasLoadedUserDataRef.current = true;
          setIsDraftPersistenceReady(true);
        }, 0);
      }
    }

    void loadUserData();

    return () => {
      window.clearTimeout(draftReadyResetTimer);
    };
  }, [token, currentUser?.id]);

  const loadVotingStatus = useCallback(async () => {
    if (!token || !currentUser?.id) return;

    try {
      const data = await getSuspectVotingStatus(token);
      applyVotingStatus(data);
    } catch (error) {
      console.error("讀取投票狀態失敗", error);
    }
  }, [currentUser?.id, token]);

  useHomeTeacherControlState({
    token,
    currentUserId: currentUser?.id,
    isTeacher,
    applyVotingStatus,
    handleFinalSettlementForStudent,
    clearHandledFinalSettlementKey,
    activeFinalSettlementKeyRef,
    setFinalEndingCountdown,
    setFinalDecisionSettlement,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  });

  const resetHomeStateAfterDatabaseCleared = useCallback(() => {
    setUnlockedCards([]);
    setFinalSummaries([]);
    setReportPageIndex(0);
    setEarnedHomeTitles([]);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    setMapState({});
    setFinalDecisionSettlement({ isFinalized: false });
    setFinalEndingCountdown(null);
    activeFinalSettlementKeyRef.current = null;
    clearHandledFinalSettlementKey(currentUser?.id);
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setDraftSuspectVotes([]);
    setSuspectVoteMessage("");
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      finalizedSuspects: [],
      finalizedAt: null,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
  }, [currentUser?.id]);

  const applyRealtimeFinalMapDecision = useCallback(
    ({
      mode,
      districtName,
      choice,
    }: {
      mode: "group" | "class";
      groupId?: string | null;
      districtName: string;
      choice: MapChoice | "";
    }) => {
      if (!districtName) return;

      const applyChoice = (prev: GroupPersonalMap) => {
        const next = { ...prev };
        if (choice) next[districtName] = choice;
        else delete next[districtName];
        return next;
      };

      if (mode === "group") {
        setGroupFinalChoices(applyChoice);
        setClassFinalChoices((prev) => {
          if (!prev[districtName]) return prev;
          const next = { ...prev };
          delete next[districtName];
          return next;
        });
        return;
      }

      setClassFinalChoices(applyChoice);
    },
    [],
  );

  const handleRealtimeGroupCardPackLock = useCallback(
    ({
      groupId,
      lock,
    }: {
      groupId?: string | null;
      lock?: { selectedCardIds?: string[]; lockedAt?: string | null } | null;
    }) => {
      const eventGroupId = groupId ? String(groupId) : null;
      const myGroupId = currentUser?.groupId ? String(currentUser.groupId) : null;
      if (eventGroupId && myGroupId && eventGroupId !== myGroupId) return;
      if (!lock) return;

      const selectedCardIds = Array.isArray(lock.selectedCardIds)
        ? lock.selectedCardIds.map(String)
        : [];
      const lockedAt = lock.lockedAt ? String(lock.lockedAt) : "";
      if (selectedCardIds.length !== 3 || !lockedAt) return;

      setRealtimeCardPackLockSignal({
        nonce: Date.now(),
        groupId: eventGroupId,
        selectedCardIds,
        lockedAt,
      });
    },
    [currentUser?.groupId],
  );

  useHomeRealtime({
    token,
    currentUser,
    isTeacher,
    loadVotingStatus,
    applyVotingStatus,
    handleFinalSettlementForStudent,
    applyRealtimeFinalMapDecision,
    handleRealtimeGroupCardPackLock,
    scheduleGroupAndClassMapRefresh,
    clearHandledFinalSettlementKey,
    clearHomeProgressCache,
    stableMapText,
    activeFinalSettlementKeyRef,
    lastSavedMapTextRef,
    resetAfterDatabaseCleared: resetHomeStateAfterDatabaseCleared,
    setFinalDecisionSettlement,
    setFinalEndingCountdown,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!votingStatus.isOpen || votingStatus.isFinalized) {
        setDraftSuspectVotes([]);
        setSuspectVoteMessage("");
        return;
      }

      if (votingStatus.myVotes.length === 0) {
        setDraftSuspectVotes((prev) =>
          prev.length === SUSPECT_GROUPS.length
            ? prev
            : DEFAULT_SUSPECT_ROLE_RANKING,
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    votingStatus.isFinalized,
    votingStatus.isOpen,
    votingStatus.myVotes.length,
  ]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (!isDraftPersistenceReady) return;

    saveHomePageDraft(currentUser.id, {
      orientationMainChoice,
      orientationTextInput,
    });
  }, [
    currentUser?.id,
    isDraftPersistenceReady,
    orientationTextInput,
    orientationMainChoice,
  ]);

  function handleLoginSuccess(nextToken: string, user: AuthUser) {
    isLoadingUserDataRef.current = false;
    hasLoadedUserDataRef.current = false;
    setIsDraftPersistenceReady(false);
    setMapState({});
    lastSavedMapTextRef.current = stableMapText({});
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setIsInquiryTaskOpen(true);
    setIsMapTaskOpen(false);
    setIsCardPackOpen(false);
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
    setMapPreviewPageIndex(0);
    setReportPageIndex(0);
    setReportDragOffset(0);
    setPendingReportReveal(null);
    setOpenedReportIndex(null);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    const restoredPage = readStoredPage(user.id);
    const restoredHomeUiState = readHomeUiState(user.id);
    setActiveInquiryRecordOrder(
      restoredHomeUiState.activeInquiryRecordOrder != null &&
        Number.isFinite(Number(restoredHomeUiState.activeInquiryRecordOrder))
        ? Number(restoredHomeUiState.activeInquiryRecordOrder)
        : null,
    );
    setReportPageIndex(
      Number.isFinite(Number(restoredHomeUiState.reportPageIndex))
        ? Math.max(0, Number(restoredHomeUiState.reportPageIndex))
        : 0,
    );
    setMapPreviewPageIndex(
      Number.isFinite(Number(restoredHomeUiState.mapPreviewPageIndex))
        ? Math.max(0, Number(restoredHomeUiState.mapPreviewPageIndex))
        : 0,
    );
    setOpenedReportIndex(
      restoredHomeUiState.openedReportIndex != null &&
        Number.isFinite(Number(restoredHomeUiState.openedReportIndex))
        ? Math.max(0, Number(restoredHomeUiState.openedReportIndex))
        : null,
    );
    setPage(
      user.role !== "teacher" &&
        (restoredPage === "teacherGroups" ||
          restoredPage === "teacherStudentData")
        ? "home"
        : restoredPage,
    );
    setToken(nextToken);
    setCurrentUser(user);
    saveAuthSession(nextToken, user);
  }

  function handleLogout() {
    clearStoredPage(currentUser?.id);
    clearHomeUiState(currentUser?.id);
    clearApiCacheForCurrentUser();
    clearAuthSession();
    isLoadingUserDataRef.current = false;
    hasLoadedUserDataRef.current = false;
    setIsDraftPersistenceReady(false);
    setToken(null);
    setCurrentUser(null);
    setMapState({});
    lastSavedMapTextRef.current = stableMapText({});
    setGroupPersonalData([]);
    setClassGroupData([]);
    setGroupFinalChoices({});
    setClassFinalChoices({});
    setIsInquiryTaskOpen(true);
    setIsMapTaskOpen(false);
    setIsCardPackOpen(false);
    setVotingStatus({
      isOpen: false,
      isFinalized: false,
      totals: {},
      totalVoters: 0,
      totalEligibleVoters: 0,
      myVotes: [],
    });
    setMapPreviewPageIndex(0);
    setReportPageIndex(0);
    setReportDragOffset(0);
    setPendingReportReveal(null);
    setOpenedReportIndex(null);
    setTitleRewardToast(null);
    setIsTitleRewardSequenceActive(false);
    if (reportRevealTimerRef.current !== null) {
      window.clearTimeout(reportRevealTimerRef.current);
      reportRevealTimerRef.current = null;
    }
    reportDragStartXRef.current = null;
    reportPressReportIndexRef.current = null;
    reportDidDragRef.current = false;
    setPage("home");
  }

  const logActivity = useCallback(
    async (payload: ActivityLogPayload) => {
      if (!token) return;

      try {
        await writeActivityLog(token, normalizeActivityLogPayload(payload));
      } catch (error) {
        console.error("活動紀錄寫入失敗：", error);
      }
    },
    [token],
  );

  const saveUserMap = useCallback(
    async (nextMapState: MapState) => {
      if (!token) return;

      const nextText = stableMapText(nextMapState);
      if (lastSavedMapTextRef.current === nextText) return;

      // 先記錄，避免 React StrictMode 或重複事件在資料庫寫入前連續送出兩次。
      lastSavedMapTextRef.current = nextText;

      try {
        await saveUserMapState(token, nextMapState);

        // 儲存成功後先把自己的地圖直接覆蓋進目前小組資料，
        // 讓使用者切到「小組地圖」時不用等下一輪輪詢。
        // 再用短延遲重抓一次後端資料，確認送出其他成員與全班結果也同步。
        applyMyMapToGroupPersonalData(nextMapState);
        scheduleGroupAndClassMapRefresh();
      } catch (error) {
        console.error("儲存個人地圖發生錯誤：", error);
      }
    },
    [applyMyMapToGroupPersonalData, scheduleGroupAndClassMapRefresh, token],
  );

  const handleMapDecisionsChange = useCallback(
    ({
      mode,
      personalState,
    }: {
      mode: "personal" | "group" | "class";
      personalState: Record<string, "保育" | "開發" | "我不知道" | "">;
    }) => {
      if (mode !== "personal") return;

      const cleaned = Object.fromEntries(
        Object.entries(personalState).filter(
          ([, value]) =>
            value === "保育" || value === "開發" || value === "我不知道",
        ),
      ) as MapState;

      const nextText = stableMapText(cleaned);
      const changedDistrictNames = regions
        .map((region) => region.name)
        .filter((name) => (mapState[name] || "") !== (cleaned[name] || ""));

      // 個人地圖是小組/全班結果的最新來源；只要個人選擇改變，
      // 該地區先前的組長/教師覆蓋都要在前端立即視為過期，後端也會同步清除。
      if (changedDistrictNames.length > 0) {
        setGroupFinalChoices((prev) => {
          const next = { ...prev };
          changedDistrictNames.forEach((name) => delete next[name]);
          return next;
        });
        setClassFinalChoices((prev) => {
          const next = { ...prev };
          changedDistrictNames.forEach((name) => delete next[name]);
          return next;
        });
      }

      setMapState((prev) => {
        const prevText = stableMapText(prev);
        return prevText === nextText ? prev : cleaned;
      });

      saveUserMap(cleaned);
    },
    [mapState, saveUserMap],
  );

  const handleManualDecisionChange = useCallback(
    async ({
      mode,
      districtName,
      choice,
    }: {
      mode: "group" | "class";
      districtName: string;
      choice: MapChoice | "";
    }) => {
      if (!token || !districtName) return;

      // 小組/全班最終決策只允許「保育」「開發」或清空
      // 不允許「我不知道」送進最終決策 API
      if (choice === "我不知道") return;

      if (mode === "group") {
        setGroupFinalChoices((prev) => {
          const next = { ...prev };
          if (choice) next[districtName] = choice;
          else delete next[districtName];
          return next;
        });
        // 小組決策是全班地圖的輸入；小組決策一變，該地區舊的教師全班覆蓋先失效。
        setClassFinalChoices((prev) => {
          if (!prev[districtName]) return prev;
          const next = { ...prev };
          delete next[districtName];
          return next;
        });
      }

      if (mode === "class") {
        setClassFinalChoices((prev) => {
          const next = { ...prev };
          if (choice) next[districtName] = choice;
          else delete next[districtName];
          return next;
        });
      }

      try {
        await saveFinalMapDecision(token, mode, districtName, choice || null);
        loadGroupAndClassMapData();
      } catch (error) {
        console.error("儲存最終決策發生錯誤：", error);
      }
    },
    [loadGroupAndClassMapData, token],
  );

  function applyVotingStatus(data: VotingStatusApi) {
    setVotingStatus({
      isOpen: Boolean(data.isOpen),
      isFinalized: Boolean(data.isFinalized),
      finalizedSuspects: Array.isArray(data.finalizedSuspects)
        ? data.finalizedSuspects
        : [],
      finalizedAt: data.finalizedAt || null,
      totals: data.totals || {},
      totalVoters: Number(data.totalVoters) || 0,
      totalEligibleVoters: Number(data.totalEligibleVoters) || 0,
      myVotes: Array.isArray(data.myVotes) ? data.myVotes : [],
    });
  }

  function moveDraftSuspectRole(roleId: string, direction: -1 | 1) {
    setDraftSuspectVotes((prev) => {
      const ranking =
        prev.length === SUSPECT_GROUPS.length
          ? [...prev]
          : [...DEFAULT_SUSPECT_ROLE_RANKING];
      const currentIndex = ranking.indexOf(roleId);
      if (currentIndex < 0) return ranking;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= ranking.length) return ranking;
      const [item] = ranking.splice(currentIndex, 1);
      ranking.splice(nextIndex, 0, item);
      return ranking;
    });
    setSuspectVoteMessage("");
  }

  async function submitSuspectVote() {
    const ranking =
      draftSuspectVotes.length === SUSPECT_GROUPS.length
        ? draftSuspectVotes
        : DEFAULT_SUSPECT_ROLE_RANKING;
    if (
      !token ||
      ranking.length !== SUSPECT_GROUPS.length ||
      isSubmittingSuspectVote
    ) {
      setSuspectVoteMessage("請將六個角色由最相關排到最不相關後再送出");
      return;
    }

    setIsSubmittingSuspectVote(true);
    setSuspectVoteMessage("正在送出我的判斷...");

    try {
      const data = await submitSuspectVotes(token, ranking);
      applyVotingStatus(data);
      setDraftSuspectVotes([]);
      setSuspectVoteMessage("排序已送出");
      logActivity({
        eventType: "suspect_vote_submit_click",
        eventLabel: "學生送出嫌犯排序投票",
        targetType: "suspectVoting",
        newValue: { ranking, topRoleId: ranking[0] },
      });
    } catch (error) {
      console.error(error);
      setSuspectVoteMessage(
        error instanceof Error ? error.message : "送出我的判斷失敗",
      );
    } finally {
      setIsSubmittingSuspectVote(false);
    }
  }

  function goPage(nextPage: Page) {
    if (
      !isTeacher &&
      finalDecisionSettlement.isFinalized &&
      nextPage !== "ending"
    ) {
      forceFinalEndingPage();
      return;
    }

    if (
      (nextPage === "teacherGroups" || nextPage === "teacherStudentData") &&
      !isTeacher
    ) {
      window.history.pushState({ page: "home" }, "", window.location.href);
      setPage("home");
      return;
    }

    window.history.pushState({ page: nextPage }, "", window.location.href);
    setPage(nextPage);

    logActivity({
      eventType: "page_visit",
      eventLabel: "切換頁面",
      targetType: "page",
      targetId: nextPage,
      metadata: { from: page, to: nextPage },
    });
  }

  function goToReportPage(nextIndex: number) {
    setReportPageIndex(clamp(nextIndex, 0, reportPageCount - 1));
  }

  function getSuspectGroupLabel(groupId: string) {
    return (
      SUSPECT_GROUPS.find((group) => group.id === groupId)?.shortName ||
      SUSPECT_GROUPS.find((group) => group.id === groupId)?.name ||
      groupId
    );
  }

  function renderMySuspectVoteCard() {
    if (votingStatus.myVotes.length === 0) return null;

    return (
      <div className="relative w-full min-w-0 max-w-[9.5rem] overflow-hidden rounded-[18px] border-2 border-[#cbb894] bg-[#fffaf0]/92 px-3 py-2 text-left shadow-[0_10px_24px_rgba(45,41,34,0.10)]">
        <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-[#9b2f2f]/10 blur-2xl" />
        <p className="relative truncate text-[9px] font-black tracking-[0.14em] text-[#8b5e34]">
          TOP SUSPECT
        </p>
        <p className="relative mt-1 break-words text-sm font-black leading-snug text-[#3b2f22]">
          {getSuspectGroupLabel(votingStatus.myVotes[0])}
        </p>
      </div>
    );
  }

  function renderClassSuspectVerdictCard() {
    if (!votingStatus.isFinalized) return null;
    const suspects = Array.isArray(votingStatus.finalizedSuspects)
      ? votingStatus.finalizedSuspects
      : [];
    if (suspects.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[26px] border-2 border-[#8b2f2f]/70 bg-[#fff7e6]/95 p-4 text-center shadow-[0_18px_42px_rgba(45,41,34,0.18)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(155,47,47,0.08)_0_1px,transparent_1px_18px)]" />
        <p className="relative text-[10px] font-black tracking-[0.28em] text-[#8b5e34]">
          CLASS VERDICT
        </p>
        <p className="relative mt-2 text-xs font-black text-stone-500">
          全班投票結果
        </p>
        <p className="relative mt-1 text-lg font-black leading-snug text-[#33251d]">
          {suspects
            .map(
              (suspect) =>
                suspect.roleName ||
                suspect.groupName ||
                getSuspectGroupLabel(suspect.roleId || suspect.groupId),
            )
            .join("、")}
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 1.8, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: -12 }}
          transition={{
            delay: 0.18,
            type: "spring",
            stiffness: 260,
            damping: 12,
          }}
          className="pointer-events-none absolute inset-2 flex items-center justify-center"
        >
          <div className="rotate-[-10deg] rounded-xl border-[6px] border-[#b42323]/85 px-7 py-4 text-5xl font-black tracking-[0.16em] text-[#b42323]/85 mix-blend-multiply shadow-[0_0_0_2px_rgba(180,35,35,0.12)] [text-shadow:0_2px_0_rgba(255,255,255,0.35)]">
            兇手
          </div>
        </motion.div>
      </motion.div>
    );
  }

  async function startNewExploration() {
    if (!isInquiryTaskOpen && !isTeacher) return;

    const nextInquiryOrder = finalSummaries.length + 1;
    setOrientationMainChoice("");
    setOrientationTextInput("");

    try {
      if (token) {
        await createInquiryRecord(token, nextInquiryOrder);
      }
      setActiveInquiryRecordOrder(nextInquiryOrder);
    } catch (error) {
      console.error("建立新的案件調查紀錄失敗：", error);
      return;
    }

    logActivity({
      eventType: "exploration_start",
      eventLabel: `開始${getInvestigationCaseByOrder(nextInquiryOrder).title}`,
      targetType: "exploration",
    });
    goPage("cards");
  }

  async function toggleFullscreen() {
    if (!canUseFullscreen) return;

    if (shouldUseCssImmersive) {
      setIsFullscreen((current) => !current);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.error("無法切換全螢幕模式：", error);
    }
  }

  const updateHomeTitles = useCallback((titles: TitleReward[]) => {
    setEarnedHomeTitles((prev) => {
      const rewardMap = new Map(
        prev
          .filter(isSupportedHomeTitleReward)
          .map((title) => [title.id, title]),
      );

      titles
        .filter(isSupportedHomeTitleReward)
        .forEach((title) => rewardMap.set(title.id, title));

      const nextTitles = Array.from(rewardMap.values());

      const isSame =
        nextTitles.length === prev.length &&
        nextTitles.every((title, index) => title.id === prev[index]?.id);

      if (isSame) return prev;

      return nextTitles;
    });
  }, []);

  // InquiryData owns inquiry database writes through /api/inquiries/* .
  // HomePage keeps local UI state only and does not run the legacy /api/user-data sync.

  function handleSubmitSummary(summary: FinalSummary) {
    setFinalSummaries((prev) => {
      const next = upsertFinalSummary(prev, summary);
      const completedCount = next.filter(isCompletedFinalSummary).length;
      const newReportIndex = Math.max(0, next.length - 1);
      // 回首頁時必須先停在「剛完成的那份調查成果」，讓學生看見自己寫完的成果，
      // 之後才自動翻到下一份任務。原本第一次完成時會直接落在 next.length，
      // 導致畫面捲到 INQUIRYBOOK 時已經是任務二，看不到任務一 → 任務二的翻頁。
      const revealStartIndex = clamp(newReportIndex, 0, next.length);
      let reward: TitleReward | null = null;

      if (completedCount >= 5) {
        reward = {
          id: "investigation_master",
          name: "首席調查官",
          description: "完成 5 份探究調查成果",
        };
      } else if (completedCount >= 4) {
        reward = {
          id: "investigation_advanced",
          name: "資深調查員",
          description: "完成 4 份探究調查成果",
        };
      } else if (completedCount >= 1) {
        reward = {
          id: "investigation_novice",
          name: "見習調查員",
          description: "完成 1 份探究調查成果",
        };
      }

      const didEarnNewInvestigationTitle = Boolean(
        reward && !earnedHomeTitles.some((title) => title.id === reward?.id),
      );

      if (reward) {
        setEarnedHomeTitles((titlePrev) => {
          const alreadyHasReward = titlePrev.some(
            (title) => title.id === reward?.id,
          );

          if (alreadyHasReward) return titlePrev;
          setTitleRewardToast(reward);
          return [...titlePrev, reward];
        });
      }

      // 送出調查結論後，回首頁先定位到調查書區塊，
      // 再自動翻到下一份任務的建立頁。
      const nextTaskPageIndex = newReportIndex + 1;
      setReportPageIndex(revealStartIndex);
      setPendingReportReveal({
        startIndex: revealStartIndex,
        targetIndex: nextTaskPageIndex,
        waitForTitleReward: didEarnNewInvestigationTitle,
      });

      return next;
    });

    // final_summary_submit is written once by the backend after /api/inquiries/final-summaries succeeds.

    setActiveInquiryRecordOrder(null);
    goPage("home");
  }

  function renderHomePage() {
    return (
      <div className={`${shouldUseCssImmersive && isFullscreen ? "app-css-immersive-mode " : ""}game-adventure-page uiux-page-shell relative min-h-[100svh] overflow-x-hidden p-3 text-stone-800 sm:p-6`}>
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(173,163,138,0.22),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.06)_0_1px,transparent_1px_32px)]" />
          <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-stone-300/20 blur-[90px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#b6c1ad]/25 blur-[110px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <HomeHeader
            classSuspectVerdictCard={renderClassSuspectVerdictCard()}
            isCardPackOpen={isCardPackOpen}
            onOpenCardPack={() => goPage("cardPack")}
            stats={
              <div className="uiux-stats-grid">
                <StatCard value={finalSummaries.length} label="探究調查書" color="blue" />
                <StatCard value={markedMapCount} label="石虎地圖" color="emerald" />
                <StatCard value={earnedHomeTitles.length} label="稱號" color="amber" />
              </div>
            }
            userControls={
              <div className="uiux-stats-grid">
                <div className="flex h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] min-w-0 items-center justify-center rounded-xl border border-stone-200 bg-white/70 px-2 text-center text-[11px] font-bold leading-tight text-stone-600 shadow-sm">
                  <span className="block truncate">
                    {currentUser?.username} 已登入
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${GAME_BTN} ${GAME_BTN_BLUE} flex h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] items-center justify-center px-2 py-0 text-[11px]`}
                >
                  登出
                </button>

                <div className="hidden h-[42px] w-[clamp(4.45rem,7.2vw,5.75rem)] sm:block" />
              </div>
            }
          />

          <div className="mb-4 min-[700px]:hidden">
            {renderClassSuspectVerdictCard()}
          </div>

          <main className="grid gap-6">
            <div className="uiux-dashboard-grid">
              {renderReportSection()}
              {renderMapSection()}
            </div>
            {renderTitleCollectionSection()}
          </main>
        </div>

        <AnimatePresence>
          {openedReport ? (
            <ReportPreviewModal
              summary={openedReport}
              index={openedReportIndex ?? 0}
              onClose={() => setOpenedReportIndex(null)}
            />
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  function renderReportSection() {
    return (
      <TaskOneCard ref={reportSectionRef}>
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.08)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.06)_1px,transparent_1px)] bg-[size:26px_26px]" />
          <div className="absolute -left-20 top-12 h-52 w-52 rounded-full bg-[#8b6f47]/10 blur-[70px]" />
          <div className="absolute right-8 top-8 rotate-[-12deg] rounded-md border-2 border-[#9b2f2f]/35 px-5 py-2 text-sm font-black tracking-[0.28em] text-[#9b2f2f]/35">
            CASE FILE
          </div>
        </div>

        <div className="relative mb-5 flex flex-col items-stretch justify-between gap-4 border-b border-[#cdbb9c] pb-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#c9b38e] bg-[#f8f1df] text-3xl shadow-sm">
              🔍
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#cbb894] bg-[#f8f1df]/80 px-3 py-1 text-[11px] font-black tracking-[0.28em] text-[#7a6a52]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7d8b6f]" />
                DETECTIVE DOSSIER
              </div>
              <h2 className="home-task-title text-3xl font-black tracking-[0.08em] text-[#2f2a24]">
                任務一：調查
              </h2>
            </div>
          </div>
          {votingStatus.myVotes.length > 0 ? (
            <div className="relative z-20 flex w-full min-w-0 justify-start min-[700px]:w-auto min-[700px]:max-w-[9.5rem] min-[700px]:shrink-0 min-[700px]:justify-end">
              {renderMySuspectVoteCard()}
            </div>
          ) : null}
        </div>

        <div className="relative rounded-[30px] border border-[#c7b594] bg-[#d9c9a8] p-3 shadow-inner">
          <div className="absolute -top-3 left-10 z-10 rounded-t-2xl border-x border-t border-[#c7b594] bg-[#d9c9a8] px-8 py-2 text-xs font-black tracking-[0.22em] text-[#6d5e49] shadow-sm">
            INQUIRY BOOK
          </div>
          <div className="absolute left-4 top-16 z-10 h-20 w-3 rounded-full bg-[#9b2f2f]/65 shadow-sm" />
          <div className="absolute bottom-10 left-4 z-10 h-20 w-3 rounded-full bg-[#9b2f2f]/65 shadow-sm" />

          <div className="overflow-hidden rounded-[24px] border border-[#bba985] bg-[#fbf5e8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]">
            <div
              className="flex items-stretch cursor-grab touch-pan-y select-none active:cursor-grabbing"
              style={{
                width: `${reportPageCount * 100}%`,
                transform: `translateX(calc(-${safeReportPageIndex * (100 / reportPageCount)}% + ${reportDragOffset}px))`,
                transition:
                  reportDragStartXRef.current === null
                    ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "none",
              }}
              onPointerDown={(event) => {
                const reportCard = (event.target as HTMLElement).closest(
                  "[data-report-page-index]",
                );
                const reportIndex = reportCard?.getAttribute(
                  "data-report-page-index",
                );

                reportPressReportIndexRef.current =
                  reportIndex === undefined || reportIndex === null
                    ? null
                    : Number(reportIndex);
                reportDragStartXRef.current = event.clientX;
                reportDidDragRef.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (reportDragStartXRef.current === null) return;
                const offset = event.clientX - reportDragStartXRef.current;
                reportDidDragRef.current = Math.abs(offset) > 12;
                setReportDragOffset(offset);
              }}
              onPointerUp={(event) => {
                if (reportDragStartXRef.current === null) return;
                const offset = event.clientX - reportDragStartXRef.current;
                const wasDragging = Math.abs(offset) > 12;
                reportDragStartXRef.current = null;
                reportDidDragRef.current = wasDragging;
                setReportDragOffset(0);

                if (offset < -80) {
                  setReportPageIndex((prev) =>
                    clamp(prev + 1, 0, reportPageCount - 1),
                  );
                } else if (offset > 80) {
                  setReportPageIndex((prev) =>
                    clamp(prev - 1, 0, reportPageCount - 1),
                  );
                } else if (!wasDragging) {
                  const reportIndex = reportPressReportIndexRef.current;
                  if (
                    reportIndex !== null &&
                    Number.isFinite(reportIndex) &&
                    reportIndex >= 0 &&
                    reportIndex < finalSummaries.length
                  ) {
                    setOpenedReportIndex(reportIndex);
                  }
                }

                reportPressReportIndexRef.current = null;

                window.setTimeout(
                  () => {
                    reportDidDragRef.current = false;
                  },
                  wasDragging ? 160 : 0,
                );
              }}
              onPointerCancel={() => {
                reportDragStartXRef.current = null;
                reportPressReportIndexRef.current = null;
                setReportDragOffset(0);
                window.setTimeout(() => {
                  reportDidDragRef.current = false;
                }, 0);
              }}
              onClickCapture={(event) => {
                if (!reportDidDragRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {finalSummaries.map((summary, index) => (
                <div
                  key={`report-${index}`}
                  data-report-page-index={index}
                  className="shrink-0"
                  style={{ width: `${100 / reportPageCount}%` }}
                >
                  <ReportPage
                    summary={summary}
                    caseMeta={getInvestigationCaseBySummary(summary, index)}
                    onOpen={() => {
                      if (!reportDidDragRef.current)
                        setOpenedReportIndex(index);
                    }}
                  />
                </div>
              ))}

              <div
                className="shrink-0 self-stretch px-1"
                style={{ width: `${100 / reportPageCount}%` }}
              >
                <div className="group relative flex h-full min-h-[450px] w-full flex-col items-center justify-center overflow-hidden rounded-[26px] bg-[#fffaf0] p-6">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_30px]" />
                  <div className="pointer-events-none absolute right-8 top-8 rotate-[-10deg] rounded-md border-2 border-[#9b2f2f]/25 px-4 py-2 text-xs font-black tracking-[0.26em] text-[#9b2f2f]/25">
                    NEW CASE
                  </div>
                  <button
                    type="button"
                    aria-disabled={!isInquiryTaskOpen && !isTeacher}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();

                      if (!isInquiryTaskOpen && !isTeacher) {
                        setInquiryLockHint(true);
                        return;
                      }

                      setInquiryLockHint(false);
                      void startNewExploration();
                    }}
                    className={`relative mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#b8a37d] bg-gradient-to-br from-[#fff8e8] to-[#e9dcc1] text-6xl font-semibold leading-none text-[#4f4333] shadow-[0_14px_30px_rgba(72,56,34,0.18)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(72,56,34,0.22)] active:translate-y-0 ${!isInquiryTaskOpen && !isTeacher ? "cursor-not-allowed grayscale opacity-45 hover:translate-y-0" : ""}`}
                  >
                    +
                  </button>
                  {inquiryLockHint && !isInquiryTaskOpen && !isTeacher ? (
                    <p className="relative -mt-2 mb-4 rounded-full border border-amber-200 bg-amber-50/90 px-4 py-2 text-center text-xs font-black tracking-[0.08em] text-amber-700 shadow-sm">
                      老師開啟任務後就可以開始調查
                    </p>
                  ) : null}
                  <p className="relative font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
                    {getNextInvestigationCase(finalSummaries.length).title}
                  </p>
                  <p className="relative mt-2 text-sm text-[#756957]">
                    {getNextInvestigationCase(finalSummaries.length).task}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center overflow-hidden px-2">
            <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-full border border-[#b79f7a]/55 bg-[#fffaf0]/58 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(72,52,36,0.14)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {Array.from({ length: reportPageCount }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToReportPage(index)}
                  aria-label={`前往第 ${index + 1} 頁`}
                  className={`shrink-0 rounded-full p-0 transition ${
                    safeReportPageIndex === index
                      ? "bg-[#6f5b42] shadow-[0_0_0_3px_rgba(255,250,240,0.92),0_4px_12px_rgba(72,52,36,0.22)]"
                      : "border border-[#8f7a5d]/40 bg-white/58 hover:bg-[#fffaf0]/82"
                  }`}
                  style={{
                    width: safeReportPageIndex === index ? 32 : 10,
                    minWidth: safeReportPageIndex === index ? 32 : 10,
                    height: 10,
                    minHeight: 10,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </TaskOneCard>
    );
  }

  function renderMapSection() {
    const safeMapPreviewPageIndex = clamp(
      mapPreviewPageIndex,
      0,
      Math.max(mapPreviewPages.length - 1, 0),
    );
    const currentMapPreviewPage =
      mapPreviewPages[safeMapPreviewPageIndex] ?? mapPreviewPages[0];

    return (
      <TaskTwoMapPreview>
        <div className="pointer-events-none absolute inset-0 opacity-75">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(99,91,71,0.07)_1px,transparent_1px),linear-gradient(rgba(99,91,71,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(255,255,255,0.52),transparent_32%),radial-gradient(circle_at_82%_78%,rgba(111,123,98,0.18),transparent_34%)]" />
        </div>

        <div className="relative mb-5 flex shrink-0 flex-col items-stretch justify-between gap-4 border-b border-[#c5bba3] pb-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#bdb294] bg-[#f7f1e3] text-2xl shadow-sm sm:h-14 sm:w-14 sm:text-3xl">
              🗺️
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full border border-[#bbb296] bg-[#f7f1e3]/85 px-3 py-1 text-[10px] font-black tracking-[0.2em] text-[#68614f] sm:text-[11px] sm:tracking-[0.26em]">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isMapTaskOpen ? "bg-[#77866b]" : "bg-stone-400"
                  }`}
                />
                <span className="whitespace-nowrap">MYSTERY MAP</span>
              </div>

              <h2 className="home-task-title whitespace-nowrap text-[clamp(1.35rem,4.8vw,1.875rem)] font-black leading-tight tracking-[0.04em] text-[#2f2a24] sm:tracking-[0.08em]">
                任務二：繪製地圖
              </h2>
            </div>
          </div>

          <div className="relative z-20 flex w-full min-w-0 justify-start lg:w-auto lg:max-w-[9.5rem] lg:shrink-0 lg:justify-end">
            <button
              type="button"
              disabled={!isMapTaskOpen}
              onClick={() => goPage("map")}
              className={`${GAME_BTN} flex h-[42px] w-full max-w-[9.5rem] min-w-0 items-center justify-center rounded-xl px-2 py-0 text-center text-[11px] font-black leading-tight tracking-[0.08em] sm:text-xs ${
                isMapTaskOpen
                  ? "border-[#a9b39a] bg-[#f4f7ef] text-[#46513e] hover:border-[#7d8b6f] hover:bg-[#edf3e6]"
                  : GAME_BTN_DISABLED
              }`}
            >
              <span className="block min-w-0 break-words">
                {isMapTaskOpen ? "出發畫地圖" : "地圖任務準備中"}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`uiux-home-map-stage relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden rounded-[24px] border transition sm:min-h-[514px] sm:rounded-[30px] ${
            isMapTaskOpen
              ? "border-[#c8cbb5] bg-[#edf1df] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.62)]"
              : "border-stone-200 bg-stone-100"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
            <div className="absolute inset-0 bg-[#edf1df]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(247,241,227,0.85),transparent_28%),radial-gradient(circle_at_72%_68%,rgba(122,137,103,0.14),transparent_35%),radial-gradient(circle_at_44%_82%,rgba(181,154,111,0.16),transparent_30%)]" />
            <div className="absolute inset-0 opacity-35 bg-[repeating-linear-gradient(25deg,transparent_0_11px,rgba(78,89,65,0.16)_12px,transparent_13px),repeating-linear-gradient(-18deg,transparent_0_18px,rgba(255,255,255,0.18)_19px,transparent_20px)]" />
            <div className="absolute inset-x-8 top-8 h-px bg-[#7f806b]/25" />
            <div className="absolute inset-x-8 bottom-12 h-px bg-[#7f806b]/25" />
          </div>

          {!isMapTaskOpen ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-900/20 backdrop-blur-sm">
              <div className="rounded-3xl border border-white/70 bg-[#fffaf0]/92 px-6 py-5 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#c8b48f] bg-[#efe5d1] text-3xl">
                  🔒
                </div>
                <p className="text-lg font-semibold text-stone-700">
                  地圖小任務還沒開門喔
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  等待任務開啟就可以出發囉
                </p>
              </div>
            </div>
          ) : null}

          {currentMapPreviewPage ? (
            <div
              className={`relative z-10 flex h-full min-h-[420px] w-full cursor-grab touch-pan-y select-none items-center justify-center overflow-hidden active:cursor-grabbing sm:min-h-[514px] ${
                isMapTaskOpen ? "" : "pointer-events-none grayscale"
              }`}
              style={{ opacity: isMapTaskOpen ? 1 : 0.35 }}
              onPointerDown={(event) => {
                if (!isMapTaskOpen) return;
                mapDragStartXRef.current = event.clientX;
                mapDidDragRef.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!isMapTaskOpen || mapDragStartXRef.current === null) return;
                const offset = event.clientX - mapDragStartXRef.current;
                if (Math.abs(offset) > 4) mapDidDragRef.current = true;
                setMapDragOffset(offset);
              }}
              onPointerUp={(event) => {
                if (!isMapTaskOpen || mapDragStartXRef.current === null) return;
                const offset = event.clientX - mapDragStartXRef.current;
                mapDragStartXRef.current = null;
                setMapDragOffset(0);

                if (offset < -80) {
                  setMapPreviewPageIndex((prev) =>
                    Math.min(prev + 1, mapPreviewPages.length - 1),
                  );
                } else if (offset > 80) {
                  setMapPreviewPageIndex((prev) => Math.max(prev - 1, 0));
                }

                window.setTimeout(() => {
                  mapDidDragRef.current = false;
                }, 0);
              }}
              onPointerCancel={() => {
                mapDragStartXRef.current = null;
                setMapDragOffset(0);
                window.setTimeout(() => {
                  mapDidDragRef.current = false;
                }, 0);
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentMapPreviewPage.title}
                  className="uiux-home-map-slide relative flex h-full min-h-[420px] w-full flex-col items-center justify-center overflow-hidden sm:min-h-[514px]"
                  initial={{ opacity: 0, x: mapDragOffset < 0 ? 36 : -36 }}
                  animate={{ opacity: 1, x: mapDragOffset }}
                  exit={{ opacity: 0, x: mapDragOffset < 0 ? -36 : 36 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="absolute left-5 top-16 z-20 rounded-2xl border border-[#8f876f]/35 bg-[#f7f1e3]/80 px-3 py-2 text-center shadow-sm backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.2em] text-[#68614f]">
                      {currentMapPreviewPage.title}
                    </p>

                    {safeMapPreviewPageIndex === 1 &&
                    currentMapPreviewPage.subtitle ? (
                      <p className="mt-[2px] text-[9px] font-semibold text-[#5f5a4a]">
                        {currentMapPreviewPage.subtitle}
                      </p>
                    ) : null}
                  </div>

                  <svg
                    viewBox={MIAOLI_MAP_VIEW_BOX}
                    className="uiux-home-map-svg h-full w-full transform-gpu"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <pattern
                        id={`map-paper-grid-${safeMapPreviewPageIndex}`}
                        width="16"
                        height="16"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 16 0 L 0 0 0 16"
                          fill="none"
                          stroke="#8b8a73"
                          strokeWidth="0.35"
                          opacity="0.22"
                        />
                      </pattern>
                    </defs>

                    <rect
                      x="12"
                      y="74"
                      width="352"
                      height="272"
                      fill={`url(#map-paper-grid-${safeMapPreviewPageIndex})`}
                      opacity="0.45"
                    />

                    <g>
                      {regions.map((region: (typeof regions)[number]) => {
                        const state = currentMapPreviewPage.map[region.name];

                        return (
                          <g key={`shape-${region.name}`}>
                            <path
                              d={region.d}
                              fill={
                                state === "保育"
                                  ? "#aebc9c"
                                  : state === "開發"
                                    ? "#c58f82"
                                    : state === "我不知道"
                                      ? "#b8b8b8"
                                      : "#f6f0df"
                              }
                              stroke="#8f876f"
                              strokeWidth="0.85"
                              vectorEffect="non-scaling-stroke"
                            />
                            <path
                              d={region.d}
                              fill={`url(#map-paper-grid-${safeMapPreviewPageIndex})`}
                              opacity="0.28"
                              stroke="#fff8e8"
                              strokeWidth="0.35"
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        );
                      })}
                    </g>

                    <g className="pointer-events-none">
                      {regions.map((region: (typeof regions)[number]) => {
                        const pos = labelPositions[region.name];

                        return (
                          <text
                            key={`label-${region.name}`}
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={pos.size}
                            fontWeight="900"
                            fill="#3f3a34"
                            stroke="#f8f1e3"
                            strokeWidth="2.4"
                            paintOrder="stroke"
                          >
                            {region.name}
                          </text>
                        );
                      })}
                    </g>
                  </svg>
                </motion.div>
              </AnimatePresence>
            </div>
          ) : null}

          {isMapTaskOpen ? (
            <div className="uiux-home-map-pager absolute bottom-16 left-1/2 z-20 w-[min(92%,520px)] -translate-x-1/2 rounded-[22px] border border-[#8f876f]/45 bg-[#fffaf0]/72 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_10px_24px_rgba(72,52,36,0.16)] backdrop-blur-md">
              <div className="grid grid-cols-3 gap-2">
                {mapPreviewPages.map((pageInfo, index) => {
                  const active = safeMapPreviewPageIndex === index;

                  return (
                    <button
                      key={pageInfo.title}
                      type="button"
                      onClick={() => setMapPreviewPageIndex(index)}
                      className={`group min-w-0 rounded-[16px] border px-2 py-2 text-center transition-all duration-300 ${
                        active
                          ? "border-[#5f6f51] bg-[#eef3e7] text-[#43503a] shadow-[0_5px_14px_rgba(72,52,36,0.16)]"
                          : "border-[#9a9078]/30 bg-white/45 text-[#746b59] hover:bg-[#fffaf0]/82"
                      }`}
                      aria-label={`切換到${pageInfo.title}`}
                    >
                      <span
                        className={`mx-auto mb-1 block h-1.5 rounded-full transition-all duration-300 ${
                          active ? "w-full bg-[#5f6f51]" : "w-8 bg-[#bcb39b]"
                        }`}
                      />
                      <span className="block truncate text-[10px] font-black leading-tight tracking-[0.08em] sm:text-[11px]">
                        {index + 1}. {pageInfo.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="absolute left-5 top-5 z-10 rounded-2xl border border-[#8f876f]/35 bg-[#f7f1e3]/80 px-3 py-2 text-[10px] font-black tracking-[0.2em] text-[#68614f] shadow-sm backdrop-blur-sm">
            MIAOLI COUNTY
          </div>

          <div className="uiux-home-map-legend absolute bottom-3 left-1/2 z-10 flex w-[94%] max-w-[520px] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl sm:gap-5 sm:rounded-full border border-[#8f876f]/30 bg-[#f7f1e3]/82 px-6 py-2 text-xs font-semibold text-[#5f5a4a] shadow-sm backdrop-blur-sm">
            <Legend
              color="bg-[#f6f0df] border border-[#8f876f]"
              label="未標記"
            />
            <Legend color="bg-[#aebc9c] border border-[#7d8b6f]" label="保育" />
            <Legend color="bg-[#c58f82] border border-[#a66d64]" label="開發" />
            <Legend
              color="bg-[#b8b8b8] border border-[#888]"
              label="我不知道"
            />
          </div>
        </div>
      </TaskTwoMapPreview>
    );
  }

  function renderTitleCollectionSection() {
    const earnedTitleIds = new Set(earnedHomeTitles.map((title) => title.id));

    return (
      <TitleCollection ref={titleCollectionSectionRef}>
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.055)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.045)_1px,transparent_1px)] bg-[size:30px_30px]" />
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[#d7c49a]/25 blur-[90px]" />
          <div className="absolute bottom-[-120px] left-20 h-72 w-72 rounded-full bg-[#8b7a5c]/12 blur-[90px]" />
        </div>

        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[#d6c7aa] pb-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#c9b793] bg-[#fff8e8] text-3xl shadow-sm">
              🎖️
            </div>
            <div>
              <p className="mb-2 text-xs font-black tracking-[0.3em] text-[#84745c]">
                HONOR ARCHIVE
              </p>
              <h2 className="home-reward-title text-3xl font-black tracking-[0.06em] text-[#2f2a24]">
                稱號收藏
              </h2>
            </div>
          </div>

          <span className="rounded-full border border-[#cdbb9c] bg-[#fff8e8]/85 px-4 py-2 text-xs font-black tracking-[0.18em] text-[#6d5e49] shadow-sm">
            {earnedHomeTitles.length} / {HOME_TITLE_REWARDS.length}
          </span>
        </div>

        <div className="relative uiux-stats-grid min-h-[190px] rounded-[30px] border border-[#d7c8ad] bg-[#fbf7ee]/88 p-3 shadow-inner shadow-white/70 min-[901px]:grid-cols-6 min-[601px]:grid-cols-3">
          {HOME_TITLE_REWARDS.map((title) => {
            const earned = earnedTitleIds.has(title.id);
            const style = getMedalStyle(title);

            return (
              <motion.div
                key={title.id}
                data-title-id={title.id}
                initial={false}
                animate={
                  earned
                    ? { opacity: 1, scale: 1, y: 0 }
                    : { opacity: 0.55, scale: 0.96, y: 2 }
                }
                transition={{ duration: 0.32, ease: "easeOut" }}
                className={`group relative overflow-hidden rounded-[22px] border bg-[#fffaf0] px-2.5 py-2 text-left transition duration-200 ${
                  earned
                    ? `${style.border} ${style.glow} hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(45,41,34,0.16)]`
                    : "border-stone-300 bg-stone-100/90 grayscale shadow-[inset_0_0_0_1px_rgba(120,113,108,0.22)]"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.9),transparent_42%)] opacity-70" />

                <div className="relative flex min-h-[104px] items-center gap-2.5">
                  <div className="flex w-[54px] shrink-0 flex-col items-center">
                    <div
                      className={`relative mb-[-6px] h-12 w-12 rounded-full border-[3px] ${
                        earned ? style.border : "border-stone-300"
                      } bg-gradient-to-br ${
                        earned
                          ? style.metal
                          : "from-stone-100 via-stone-200 to-stone-300"
                      } shadow-[inset_0_3px_8px_rgba(255,255,255,0.75),inset_0_-7px_10px_rgba(0,0,0,0.14),0_8px_14px_rgba(45,41,34,0.16)]`}
                    >
                      <div className="absolute inset-1.5 rounded-full border border-white/55 bg-white/10" />
                      <div
                        className={`absolute inset-[10px] rounded-full border ${
                          earned ? "border-white/70" : "border-stone-300"
                        } bg-gradient-to-br ${earned ? style.shine : "from-stone-50 via-stone-200 to-stone-400"}`}
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center px-1 font-black leading-none drop-shadow-sm ${earned ? style.starText : "text-stone-500"}`}
                      >
                        {earned ? (
                          <MedalStars stars={style.star} variant="small" />
                        ) : (
                          "🔒"
                        )}
                      </div>
                    </div>

                    <div className="relative flex w-14 justify-center">
                      <div
                        className={`h-8 w-5 origin-top rotate-[8deg] bg-gradient-to-b ${
                          earned ? style.ribbon : "from-stone-300 to-stone-400"
                        } [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
                      />
                      <div
                        className={`-ml-1.5 h-8 w-5 origin-top rotate-[-8deg] bg-gradient-to-b ${
                          earned ? style.ribbon : "from-stone-300 to-stone-400"
                        } [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] shadow-sm`}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`relative mb-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black tracking-[0.13em] ${
                        earned
                          ? `${style.border} ${style.text} bg-white/55`
                          : "border-stone-400 bg-stone-100 text-stone-600"
                      }`}
                    >
                      {earned ? style.rank : "LOCKED"}
                    </div>

                    {earned ? (
                      <>
                        <p className="relative text-[13px] font-black leading-[1.28] text-[#332c24]">
                          {title.name}
                        </p>
                        <p className="relative mt-0.5 text-[11px] leading-[1.28] text-[#746855]">
                          {title.description}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </TitleCollection>
    );
  }

  function renderActivePage() {
    if (page === "home") {
      return isTeacher ? (
        <TeacherManagementCenter
          token={token!}
          currentUser={currentUser!}
          isFullscreen={isFullscreen}
          canUseFullscreen={canUseFullscreen}
          onLogout={handleLogout}
          onToggleFullscreen={toggleFullscreen}
          onOpenGroups={() => goPage("teacherGroups")}
          onOpenStudentData={() => goPage("teacherStudentData")}
          onOpenMap={() => goPage("map")}
          onActivityLog={logActivity}
        />
      ) : (
        renderHomePage()
      );
    }

    if (page === "cards") {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <InquiryData
            token={token!}
            currentInquiryOrder={
              activeInquiryRecordOrder ?? finalSummaries.length + 1
            }
            orientationMainChoice={orientationMainChoice}
            orientationTextInput={orientationTextInput}
            draftStorageKey={`cityauncel_inquiry_draft_${currentUser!.id}`}
            inquiryRecordOrder={activeInquiryRecordOrder}
            onBackToHome={() => {
              setActiveInquiryRecordOrder(null);
              goPage("home");
            }}
            onTitleRewardsChange={updateHomeTitles}
            onSubmitSummary={handleSubmitSummary}
            unlockedCardIds={unlockedCards}
            setUnlockedCardIds={setUnlockedCards}
            onActivityLog={logActivity}
            onAiHelperAvailabilityChange={setIsAiHelperAvailable}
          />
        </Suspense>
      );
    }

    if (page === "cardPack") {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <CardPackPage
            token={token!}
            currentUser={currentUser!}
            unlockedCards={unlockedCards}
            setUnlockedCards={setUnlockedCards}
            realtimeLockSignal={realtimeCardPackLockSignal}
            onBack={() => goPage("home")}
            onActivityLog={logActivity}
          />
        </Suspense>
      );
    }

    if (page === "ending" && finalDecisionSettlement.isFinalized) {
      return (
        <FinalEndingPage
          settlement={finalDecisionSettlement}
          isTeacher={isTeacher}
          onBackHome={() => goPage("home")}
        />
      );
    }

    if (page === "map") {
      return (
        <MiaoliMap
          uiStorageKey={`cityauncel_map_ui_${currentUser?.id || "guest"}`}
          onBack={() => goPage("home")}
          groupName={currentUser?.groupName ?? null}
          isGroupLeader={Boolean(currentUser?.isGroupLeader)}
          isTeacher={isTeacher}
          groupMembers={currentUser?.groupMembers ?? []}
          initialState={mapState}
          personalData={groupPersonalData}
          groupData={classGroupData}
          groupFinalChoices={groupFinalChoices}
          classFinalChoices={classFinalChoices}
          unlockedCards={unlockedCards as MapUnlockedCardData[]}
          onDecisionsChange={handleMapDecisionsChange}
          onManualDecisionChange={handleManualDecisionChange}
        />
      );
    }

    if (page === "teacherGroups" && isTeacher) {
      return <ControlPage token={token!} onBack={() => goPage("home")} />;
    }

    if (page === "teacherStudentData" && isTeacher) {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <BehaviorRecord token={token!} onBack={() => goPage("home")} />
        </Suspense>
      );
    }

    return renderHomePage();
  }

  if (!token || !currentUser) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      {page !== "teacherStudentData" ? <BarrageLayer token={token} /> : null}
      {!isTeacher && page === "cards" && isAiHelperAvailable ? (
        <AiInquiryAssistant
          token={token}
          currentPage={page}
          currentPageLabel="數據清單"
          roundKey={`round-${activeInquiryRecordOrder ?? finalSummaries.length + 1}-cards`}
        />
      ) : null}

      <AnimatePresence
        onExitComplete={() => {
          setIsTitleRewardSequenceActive(false);
        }}
      >
        {titleRewardToast ? (
          <TitleRewardToast
            key={titleRewardToast.id}
            title={titleRewardToast}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <PageTransitionFrame key={page}>
          {renderActivePage()}
        </PageTransitionFrame>
      </AnimatePresence>

      {!isTeacher && isStudentScreenLocked ? (
        <StudentScreenLockOverlay />
      ) : null}

      {!isTeacher && finalEndingCountdown !== null ? (
        <FinalEndingCountdownOverlay seconds={finalEndingCountdown} />
      ) : null}

      {shouldShowSuspectVoteModal ? (
        <SuspectVotingModal
          ranking={
            draftSuspectVotes.length === SUSPECT_GROUPS.length
              ? draftSuspectVotes
              : DEFAULT_SUSPECT_ROLE_RANKING
          }
          message={suspectVoteMessage}
          isSubmitting={isSubmittingSuspectVote}
          onMoveRole={moveDraftSuspectRole}
          onSubmit={submitSuspectVote}
        />
      ) : null}
    </>
  );
}

function getEndingStyle(outcomeId?: string) {
  if (outcomeId === "sustainable") {
    return {
      bg: "from-emerald-100 via-lime-50 to-sky-100",
      ring: "border-emerald-300/70 shadow-[0_0_80px_rgba(16,185,129,0.28)]",
      badge: "bg-emerald-700 text-white",
      icon: "🌿",
      accent: "text-emerald-800",
      story:
        "幾年後，苗栗淺山的景象悄悄改變了。河水重新變得清澈，田野間出現更多昆蟲與動物。有人開始在夜晚拍到石虎的身影，牠們不再頻繁出現在危險的道路上。農業、觀光與綠能發展逐漸找到新的平衡方式，居民的生活也穩定下來。這片土地，開始出現人與自然共存的可能。",
      questions: ["哪一個決策最關鍵？", "如果少了哪一個行動，結果會改變嗎？"],
    };
  }

  if (outcomeId === "partial") {
    return {
      bg: "from-amber-100 via-orange-50 to-stone-100",
      ring: "border-amber-300/70 shadow-[0_0_80px_rgba(245,158,11,0.26)]",
      badge: "bg-amber-700 text-white",
      icon: "⚖️",
      accent: "text-amber-800",
      story:
        "苗栗淺山的改變並不一致。有些地區環境逐漸改善，但另一些地方仍持續惡化。偶爾還是能看到石虎出沒，但路殺事件與受傷案例仍時有發生。部分產業發展成功，但也帶來新的壓力與衝突。這片土地，正處在選擇的十字路口。",
      questions: [
        "哪些行動帶來正面和負面影響？",
        "如果再多一回合，你們會改變什麼？",
      ],
    };
  }

  return {
    bg: "from-rose-100 via-stone-100 to-slate-200",
    ring: "border-rose-300/70 shadow-[0_0_80px_rgba(244,63,94,0.22)]",
    badge: "bg-rose-800 text-white",
    icon: "🔥",
    accent: "text-rose-800",
    story:
      "苗栗淺山的環境逐漸失去平衡。河水變得混濁，生態系開始崩解。石虎的死亡事件持續增加，牠們被迫進入人類活動區域，卻面臨更多危險。路殺、污染、衝突不斷發生，人與環境之間的矛盾越來越明顯。這片土地，正在付出代價。",
    questions: ["哪一個決策其實可以改變結局？", "如果重來一次，你們會怎麼做？"],
  };
}

function FinalEndingCountdownOverlay({ seconds }: { seconds: number }) {
  const safeSeconds = Math.max(seconds, 0);

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center overflow-hidden bg-[#101820] p-5 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(253,224,71,0.28),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(52,211,153,0.24),transparent_28%),linear-gradient(135deg,#101820_0%,#173326_48%,#3b2f18_100%)]" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-white/10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-[42px] border-[6px] border-[#facc15] bg-[#fff7dc] px-6 py-10 text-[#1f2933] shadow-[0_34px_120px_rgba(0,0,0,0.72)] sm:px-12 sm:py-14"
      >
        <div className="absolute inset-x-0 top-0 h-4 bg-[#facc15]" />

        <p className="inline-flex rounded-full bg-[#1f2933] px-5 py-2 text-sm font-black tracking-[0.28em] text-[#fff7dc] shadow-lg sm:text-base">
          FINAL SETTLEMENT
        </p>

        <h2 className="mt-6 text-4xl font-black leading-tight tracking-[0.06em] text-[#111827] drop-shadow-sm sm:text-6xl">
          即將進入遊戲結局
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-lg font-black leading-8 text-[#374151] sm:text-2xl">
          全班決策已完成結算，請準備查看苗栗淺山的最後回聲。
        </p>

        <motion.div
          key={safeSeconds}
          initial={{ scale: 0.72, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 210, damping: 14 }}
          className="mx-auto mt-9 flex h-40 w-40 items-center justify-center rounded-full border-[8px] border-[#111827] bg-[#facc15] text-8xl font-black text-[#111827] shadow-[0_18px_50px_rgba(17,24,39,0.35)] sm:h-52 sm:w-52 sm:text-9xl"
        >
          {safeSeconds}
        </motion.div>

        <div className="mx-auto mt-8 h-5 max-w-md overflow-hidden rounded-full border-2 border-[#111827] bg-white shadow-inner">
          <motion.div
            key={`bar-${safeSeconds}`}
            initial={{ width: `${safeSeconds * 20}%` }}
            animate={{ width: `${Math.max(safeSeconds - 1, 0) * 20}%` }}
            transition={{ duration: 1, ease: "linear" }}
            className="h-full rounded-full bg-[#16a34a]"
          />
        </div>
      </motion.div>
    </div>
  );
}

function FinalEndingPage({
  settlement,
  isTeacher,
  onBackHome,
}: {
  settlement: FinalDecisionSettlement;
  isTeacher: boolean;
  onBackHome: () => void;
}) {
  const outcome = settlement.outcome || {
    id: "partial",
    title: "部分共榮",
    subtitle: "全班決策進入反思階段",
  };
  const style = getEndingStyle(outcome.id);
  const groups = Array.isArray(settlement.groups) ? settlement.groups : [];

  return (
    <div
      className={`relative min-h-[100svh] overflow-hidden bg-gradient-to-br ${style.bg} px-4 py-6 text-stone-900 sm:px-8`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.72),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.08)_0_1px,transparent_1px_34px)]" />
        <div className="absolute -left-20 top-28 h-80 w-80 rounded-full bg-white/45 blur-[90px]" />
        <div className="absolute bottom-[-80px] right-[-40px] h-96 w-96 rounded-full bg-white/40 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] max-w-7xl flex-col justify-center gap-6">
        <motion.section
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={`overflow-hidden rounded-[36px] border bg-white/78 p-5 backdrop-blur-xl sm:p-8 ${style.ring}`}
        >
          <div className="grid gap-8 min-[700px]:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] min-[700px]:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-black tracking-[0.22em] text-stone-600 shadow-sm">
                <span>生態回聲：最後的選擇</span>
              </div>
              <motion.div
                initial={{ rotate: -8, scale: 0.88, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 180,
                  damping: 13,
                }}
                className="mb-5 text-7xl sm:text-8xl"
              >
                {style.icon}
              </motion.div>
              <p
                className={`text-sm font-black tracking-[0.28em] ${style.accent}`}
              >
                FINAL OUTCOME
              </p>
              <h1 className="mt-3 font-serif text-5xl font-black tracking-[0.08em] text-stone-900 sm:text-7xl lg:text-8xl">
                {outcome.title}
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black leading-9 text-stone-700 sm:text-2xl">
                {outcome.subtitle}
              </p>
              <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-stone-700 sm:text-lg">
                {style.story}
              </p>
              <div className="mt-7 rounded-3xl border border-white/70 bg-white/62 p-5 shadow-inner">
                <p className="text-sm font-black tracking-[0.22em] text-stone-500">
                  反思引導
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {style.questions.map((question) => (
                    <div
                      key={question}
                      className="rounded-2xl border border-stone-200 bg-white/72 p-4 text-sm font-black leading-7 text-stone-700 shadow-sm"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/75 bg-white/66 p-5 shadow-[0_22px_60px_rgba(68,64,60,0.14)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[0.24em] text-stone-500">
                    GROUP DECISIONS
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-stone-900">
                    各組最終決策卡
                  </h2>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-xs font-black tracking-[0.18em] ${style.badge}`}
                >
                  已公布
                </span>
              </div>

              <div className="mt-5 max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <div
                      key={group.groupId}
                      className="rounded-3xl border border-stone-200 bg-white/78 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-black text-stone-800">
                          {group.groupName}
                        </h3>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-black text-stone-600">
                          {group.cards?.length || 0} 張
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(group.cards || []).map((card, cardIndex) => (
                          <div
                            key={card.cardId}
                            className="rounded-2xl border border-stone-200 bg-white/86 px-4 py-3 text-sm font-black leading-6 text-stone-700 shadow-sm"
                          >
                            <span className="mr-2 text-stone-400">
                              {cardIndex + 1}.
                            </span>
                            {card.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-stone-200 bg-white/78 p-5 text-sm font-bold text-stone-600">
                    目前沒有可顯示的小組決策資料。
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35 }}
          className="mx-auto max-w-3xl rounded-[28px] border border-white/70 bg-white/62 px-6 py-5 text-center text-lg font-black leading-9 text-stone-700 shadow-sm backdrop-blur"
        >
          「這個生態的結果，已經寫下。
          <br />
          但你的選擇，還可以改變下一次的故事。」
        </motion.div>

        {isTeacher ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onBackHome}
              className="rounded-2xl border border-stone-300 bg-white/80 px-5 py-3 text-sm font-black text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              回教師首頁
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StudentScreenLockOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/92 p-6 text-center text-white backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[34px] border border-white/20 bg-white/10 px-6 py-10 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:px-10 sm:py-14">
        <p className="text-sm font-black tracking-[0.32em] text-white/65">
          SCREEN LOCKED
        </p>
        <h2 className="mt-5 text-4xl font-black leading-tight tracking-[0.08em] text-white sm:text-6xl">
          畫面已鎖定
        </h2>
        <p className="mt-6 text-2xl font-black leading-relaxed tracking-[0.08em] text-amber-100 sm:text-4xl">
          請抬頭看向教師
        </p>
      </div>
    </div>
  );
}

function SuspectVotingModal({
  ranking,
  message,
  isSubmitting,
  onMoveRole,
  onSubmit,
}: {
  ranking: string[];
  message: string;
  isSubmitting: boolean;
  onMoveRole: (roleId: string, direction: -1 | 1) => void;
  onSubmit: () => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const rankedGroups = ranking
    .map((roleId) => SUSPECT_GROUPS.find((group) => group.id === roleId))
    .filter((group): group is (typeof SUSPECT_GROUPS)[number] =>
      Boolean(group),
    );
  const canSubmit =
    !isSubmitting && rankedGroups.length === SUSPECT_GROUPS.length;

  function handleSubmitClick() {
    if (!canSubmit) return;
    setIsConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    setIsConfirmOpen(false);
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border-4 border-stone-800 bg-[#fffaf0] p-6 text-stone-800 shadow-[0_26px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-black tracking-[0.26em] text-[#8b5e34]">
          URGENT RANKING
        </p>
        <h2 className="mt-2 text-3xl font-black">小偵探排序投票開始</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-stone-600">
          請把你調查後認為「造成石虎生存危機最相關」的角色排在最上面，依序排到最不相關。結算時只會統計每位學生排在第一名的角色。
        </p>

        <div className="mt-5 space-y-3">
          {rankedGroups.map((group, index) => (
            <div
              key={group.id}
              className="grid gap-3 rounded-2xl border-2 border-[#d5c39f] bg-white px-4 py-3 shadow-sm sm:grid-cols-[56px_1fr_88px] sm:items-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#cbb894] bg-[#fff0bd] text-xl font-black text-[#4f3514]">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-[#33251d]">
                  {group.name}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-stone-500">
                  {group.description}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:flex-col">
                <button
                  type="button"
                  onClick={() => onMoveRole(group.id, -1)}
                  disabled={isSubmitting || index === 0}
                  className="flex-1 rounded-xl border border-stone-300 bg-[#f8f1df] px-3 py-2 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:w-full"
                >
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => onMoveRole(group.id, 1)}
                  disabled={isSubmitting || index === rankedGroups.length - 1}
                  className="flex-1 rounded-xl border border-stone-300 bg-[#f8f1df] px-3 py-2 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:w-full"
                >
                  下移
                </button>
              </div>
            </div>
          ))}
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          className="mt-6 w-full rounded-2xl border-2 border-stone-900 bg-stone-800 px-5 py-4 text-lg font-black text-white shadow-[0_8px_0_rgba(28,25,23,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {isSubmitting ? "送出排序中..." : "送出我的排序"}
        </button>
      </div>

      {isConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspect-vote-confirm-title"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[28px] border-4 border-stone-900 bg-[#fffaf0] p-6 text-center text-stone-800 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
            <p className="text-xs font-black tracking-[0.24em] text-[#8b5e34]">
              CONFIRM VOTE
            </p>
            <h3
              id="suspect-vote-confirm-title"
              className="mt-2 text-2xl font-black"
            >
              確認送出這次排序？
            </h3>
            <p className="mt-3 text-sm font-bold leading-7 text-stone-600">
              請再確認排序沒有放錯，送出後就無法更改了喲~
            </p>

            <div className="mt-5 rounded-2xl border border-[#d5c39f] bg-white px-4 py-3 text-left shadow-inner">
              <p className="text-xs font-black tracking-[0.16em] text-stone-500">
                你選擇的頭號嫌疑犯
              </p>
              <p className="mt-1 text-lg font-black text-[#33251d]">
                {rankedGroups[0]?.name || "尚未完成排序"}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-stone-900 bg-stone-800 px-4 py-3 text-sm font-black text-white shadow-[0_6px_0_rgba(28,25,23,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                確認送出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "blue" | "emerald" | "amber";
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-stone-600",
    emerald: "border-[#cfd7c6] bg-[#f4f7ef]/85 text-stone-700",
    amber: "border-amber-100 bg-amber-50 text-stone-600",
  };

  return (
    <div
      className={`flex aspect-square w-[clamp(4.45rem,7.2vw,5.75rem)] shrink-0 flex-col items-center justify-center rounded-3xl border p-1.5 text-center ${styles[color]}`}
    >
      <p className="text-xl font-semibold leading-none sm:text-2xl">{value}</p>
      <p className="mt-1.5 whitespace-nowrap text-[10px] font-bold leading-none sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

function ReportPage({
  summary,
  caseMeta,
  onOpen,
}: {
  summary: FinalSummary;
  caseMeta: (typeof INVESTIGATION_CASE_FLOW)[number];
  onOpen: () => void;
}) {
  const evidenceCards = summary.evidenceCards.map(resolveEvidenceCardSummary);

  return (
    <div className="min-w-full shrink-0 px-1">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className="group relative min-h-[320px] cursor-pointer overflow-hidden rounded-[22px] bg-[#fffaf0] p-4 sm:min-h-[450px] sm:rounded-[26px] sm:p-6 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(72,56,34,0.18)] focus-visible:ring-4 focus-visible:ring-[#9b2f2f]/25"
        aria-label={`開啟${caseMeta.title}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_30px]" />
        <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[#e5d3b2] to-transparent" />

        <div className="absolute top-3 right-3 flex items-center justify-center">
          <div className="absolute top-3 right-3 flex items-center justify-center">
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-red-800
          text-red-800 text-[11px] font-black tracking-[0.15em]
          opacity-80
          before:absolute before:inset-0 before:rounded-full before:border before:border-red-900 before:opacity-40
          after:absolute after:inset-[6px] after:rounded-full after:border after:border-red-700 after:opacity-30
          shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
              /* ✅ 就加在這裡 */
              style={{
                WebkitMaskImage:
                  "radial-gradient(circle, black 40%, transparent 100%)",
                maskImage:
                  "radial-gradient(circle, black 70%, transparent 100%)",
              }}
            >
              <span className="rotate-[-8deg]">SLOVED</span>
            </div>
          </div>
        </div>

        <div className="relative mb-5 flex items-start justify-between gap-3 border-b border-dashed border-[#c8b48f] pb-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.28em] text-[#7a6a52]">
              CASE REPORT
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
              {caseMeta.title}
            </h3>
          </div>
        </div>

        <div className="relative mb-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <DetectiveEvidenceBox
            badge="QUESTIONING"
            title="這次案件的調查任務"
            content={summary.orientationMainChoice}
          />
          <DetectiveEvidenceBox
            badge="HYPOTHESIS"
            title="我的懷疑或推論"
            content={summary.orientationTextInput}
          />
        </div>

        <div className="relative mb-4 rounded-2xl border border-[#d2bf99] bg-[#f7ecd5] p-4 shadow-sm">
          <div className="absolute -top-3 left-5 rotate-[-3deg] rounded-md bg-[#d8c29a] px-3 py-1 text-[10px] font-black tracking-[0.22em] text-[#5c503e] shadow-sm">
            EVIDENCE
          </div>
          <div className="mb-3 flex items-center justify-between pt-2">
            <p className="text-xs font-bold tracking-[0.18em] text-[#6d5e49]">
              證據
            </p>
            <p className="text-xs font-bold text-[#6d5e49]">
              {evidenceCards.length} 張
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {evidenceCards.slice(0, 6).map((card) => (
              <div
                key={card.id}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                className="relative h-16 w-16 rotate-[-2deg] select-none rounded-xl border border-[#c8b48f] bg-[#fffaf0] p-1.5 shadow-sm odd:rotate-[2deg]"
              >
                <img
                  src={card.imageSrc}
                  alt={card.title}
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  className="pointer-events-none h-full w-full select-none object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        <DetectiveEvidenceBox
          badge="CONCLUSION"
          title="案件結論"
          content={summary.conclusion}
          variant="green"
        />
      </div>
    </div>
  );
}

function ReportPreviewModal({
  summary,
  index,
  onClose,
}: {
  summary: FinalSummary;
  index: number;
  onClose: () => void;
}) {
  const evidenceCards = summary.evidenceCards.map(resolveEvidenceCardSummary);
  const caseMeta = getInvestigationCaseBySummary(summary, index);

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={caseMeta.title}
        className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[34px] border border-[#c8b48f] bg-[#efe5d1] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.08)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.06)_1px,transparent_1px)] bg-[size:26px_26px]" />
          <div className="absolute right-8 top-8 rotate-[-12deg] rounded-md border-2 border-[#9b2f2f]/30 px-5 py-2 text-sm font-black tracking-[0.28em] text-[#9b2f2f]/30">
            CASE FILE
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#b8a37d] bg-[#fffaf0] text-xl font-black text-black shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          aria-label="關閉探究調查書"
        >
          ×
        </button>

        <div className="relative max-h-[calc(92vh-1rem)] overflow-y-auto rounded-[20px] sm:max-h-[calc(88vh-2rem)] sm:rounded-[26px] border border-[#bba985] bg-[#fbf5e8] p-5 pr-4 shadow-inner">
          <div className="relative mb-5 border-b border-dashed border-[#c8b48f] pb-4 pr-14">
            <p className="text-[11px] font-black tracking-[0.28em] text-[#7a6a52]">
              CASE REPORT
            </p>
            <h3 className="mt-2 font-serif text-3xl font-semibold tracking-[0.08em] text-[#332c24]">
              {caseMeta.title}
            </h3>
            <p className="mt-2 text-sm font-bold tracking-[0.12em] text-[#7a6a52]">
              {caseMeta.task}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetectiveEvidenceBox
              badge="QUESTIONING"
              title="這一案的調查任務"
              content={summary.orientationMainChoice}
            />
            <DetectiveEvidenceBox
              badge="EXPLORATION"
              title="我的懷疑或推論"
              content={summary.orientationTextInput}
            />
          </div>

          <div className="relative my-5 rounded-2xl border border-[#d2bf99] bg-[#f7ecd5] p-4 shadow-sm">
            <div className="absolute -top-3 left-5 rotate-[-3deg] rounded-md bg-[#d8c29a] px-3 py-1 text-[10px] font-black tracking-[0.22em] text-[#5c503e] shadow-sm">
              EVIDENCE
            </div>
            <div className="mb-3 flex items-center justify-between pt-2">
              <p className="text-xs font-bold tracking-[0.18em] text-[#6d5e49]">
                證據
              </p>
              <p className="text-xs font-bold text-[#6d5e49]">
                {evidenceCards.length} 張
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {evidenceCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl border border-[#c8b48f] bg-[#fffaf0] p-3 shadow-sm"
                >
                  <img
                    src={card.imageSrc}
                    alt={card.title}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="mx-auto mb-3 h-28 w-full max-w-full select-none object-contain sm:h-32 md:h-36"
                  />
                  <p className="text-center text-xs font-black leading-5 text-[#4d4438]">
                    {card.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <DetectiveEvidenceBox
            badge="Conclusion"
            title="案件結論"
            content={summary.conclusion}
            variant="green"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetectiveEvidenceBox({
  badge,
  title,
  content,
  variant = "paper",
}: {
  badge: string;
  title: string;
  content: string;
  variant?: "paper" | "green";
}) {
  const isGreen = variant === "green";

  return (
    <div
      className={`relative rounded-2xl border p-4 shadow-sm ${
        isGreen
          ? "border-[#c5cfba] bg-[#f2f5ec]"
          : "border-[#d2bf99] bg-[#f7ecd5]"
      }`}
    >
      <div
        className={`absolute -top-3 left-5 rotate-[-3deg] rounded-md px-3 py-1 text-[10px] font-black tracking-[0.22em] shadow-sm ${
          isGreen
            ? "bg-[#c9d6bd] text-[#54614c]"
            : "bg-[#d8c29a] text-[#5c503e]"
        }`}
      >
        {badge}
      </div>

      <div className="pt-2">
        <p
          className={`mb-2 text-xs font-bold tracking-[0.18em] ${isGreen ? "text-[#65715d]" : "text-[#6d5e49]"}`}
        >
          {title}
        </p>
        <div
          className={`rounded-xl border p-3 ${
            isGreen
              ? "border-[#d3ddc9] bg-[#fbfcf7]/80"
              : "border-[#e1d0ad] bg-[#fffaf0]/80"
          }`}
        >
          <p
            className={`line-clamp-5 text-xs leading-6 ${isGreen ? "text-[#3f4639]" : "text-[#4d4438]"}`}
          >
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${color}`} />
      {label}
    </div>
  );
}

function TitleRewardToast({ title }: { title: TitleReward }) {
  const style = getMedalStyle(title);
  const [exitTarget, setExitTarget] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const target = document.querySelector(`[data-title-id="${title.id}"]`);
    if (!(target instanceof HTMLElement)) return;

    const rect = target.getBoundingClientRect();
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;

    const timer = window.setTimeout(() => {
      setExitTarget({
        x: targetCenterX - window.innerWidth / 2,
        y: targetCenterY - window.innerHeight / 2,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [title.id]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/35 p-6 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <motion.div
        initial={{ scale: 0.45, y: 42, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, y: 0, x: 0, opacity: 1, rotate: 0 }}
        exit={{
          scale: 0.08,
          x: exitTarget.x,
          y: exitTarget.y,
          opacity: 0,
          rotate: 0,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className={`relative w-full max-w-[340px] overflow-hidden rounded-[34px] border ${style.border} bg-[#fffaf0] p-6 text-center ${style.glow}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.95),transparent_45%)]" />
        <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-white/45 blur-2xl" />
        <div className="absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-amber-200/30 blur-2xl" />

        <motion.div
          className="absolute left-5 top-5 text-2xl"
          initial={{ scale: 0, rotate: -45, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          ✦
        </motion.div>
        <motion.div
          className="absolute right-6 top-8 text-xl"
          initial={{ scale: 0, rotate: 45, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], rotate: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          ✦
        </motion.div>

        <motion.div
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{
            delay: 0.15,
            type: "spring",
            stiffness: 260,
            damping: 14,
          }}
          className={`relative mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full border-[5px] ${style.border} bg-gradient-to-br ${style.metal} text-5xl shadow-[inset_0_5px_12px_rgba(255,255,255,0.75),inset_0_-12px_16px_rgba(0,0,0,0.16),0_18px_30px_rgba(45,41,34,0.22)]`}
        >
          <div className="absolute inset-3 rounded-full border border-white/60" />
          <motion.span
            className={`flex h-full w-full items-center justify-center ${style.starText}`}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <MedalStars stars={style.star} variant="large" />
          </motion.span>
        </motion.div>

        <h3 className="relative font-serif text-3xl font-bold tracking-[0.08em] text-[#332c24]">
          {title.name}
        </h3>

        <p className="relative mt-2 text-sm font-semibold text-[#746855]">
          {title.description}
        </p>

        <p
          className={`relative mt-4 text-xs font-black tracking-[0.22em] ${style.text}`}
        >
          {style.star}
        </p>
      </motion.div>
    </motion.div>
  );
}
