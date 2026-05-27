/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 aiHelperTypes，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

export type AiNeedType =
  | "direction"
  | "reason"
  | "relation"
  | "clarity"
  | "gap";

export type AiNeedCategory = "dialogue" | "check" | "suggestion";

export type AiCardContext = {
  id?: string;
  title?: string;
  revealedTitle?: string;
  category?: string;
  categoryLabel?: string;
  town?: string;
  dataType?: string;
  possibleUse?: string;
  crisisLinks?: string[];
  content?: string;
  inquiryOrder?: number;
  collectionReason?: string;
};

export type AiContextPayload = Record<string, unknown> & {
  pageKey?: string;
  pageLabel?: string;
  focusText?: string;
  focusLabel?: string;
  selectedCards?: AiCardContext[];
  unlockedCards?: AiCardContext[];
  allUnlockedCards?: AiCardContext[];
  activeContextCards?: AiCardContext[];
  activeContextScope?: "checkpoint" | "unlocked";
  activeContextLabel?: string;
  isCollectionCheckpointOpen?: boolean;
  collectionReflectionText?: string;
  collectionReflectionMinLength?: number;
};

export type AiMessage = {
  id: string;
  role: "student" | "ai";
  text: string;
  needType?: AiNeedType;
  source?: "ai" | "fallback" | "system";
};

export type AiAskPayload = {
  message?: string;
  needType?: AiNeedType;
  context?: AiContextPayload;
  open?: boolean;
};

export type AiInquiryAssistantProps = {
  token: string | null;
  currentPage: string;
  currentPageLabel?: string;
  roundKey?: string;
  context?: AiContextPayload;
};

export type StoredUsageState = {
  helpCredits: number;
  turnsInCurrentHelp: number;
  checksInCurrentHelp: number;
  selectedNeed: AiNeedType | null;
  helpEnded: boolean;
  goodbye: boolean;
  gapScope?: "round" | "overall" | null;
  messages?: AiMessage[];
};

declare global {
  interface Window {
    cityauncelAiAssistant?: {
      ask: (payload: AiAskPayload) => void;
      setContext: (context: AiContextPayload) => void;
    };
  }
}
