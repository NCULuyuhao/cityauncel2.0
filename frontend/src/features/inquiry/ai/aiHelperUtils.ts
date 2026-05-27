/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙模組 aiHelperUtils，處理學生支援需求、對話狀態或 AI 顯示規則。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import {
  HELP_USES_PER_COIN,
  MAX_CHECKS_PER_HELP,
  MAX_TURNS_PER_HELP,
  NEED_OPTIONS,
} from "./aiHelperConfig";
import type {
  AiContextPayload,
  AiMessage,
  AiNeedCategory,
  AiNeedType,
  StoredUsageState,
} from "./aiHelperTypes";

export function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clampShortReply(text: string, maxLength = 30) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[「」]/g, "")
    .trim();
  if (!clean) return "你可以先說說，哪張卡讓你最在意。";
  return clean.length > maxLength
    ? `${clean.slice(0, Math.max(1, maxLength - 1))}…`
    : clean;
}

export function finalizeReplyForDisplay(text: string, type?: AiNeedType | null) {
  const limit = getReplyLimit(type);
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[「」]/g, "")
    .trim();
  if (clean.length > limit) {
    if (type === "reason") return "你蒐集到的卡牌面向很棒。寫蒐集理由時，可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。";
    if (type === "clarity") return "你的理由已有想法，可再補哪張卡最能支持它，並說明它和石虎生存挑戰的關係。";
    if (type === "gap") return "目前資料可能偏向同一類線索，也可補另一種資料角度，讓探究更平衡。";
  }
  return clampShortReply(clean, limit);
}

export function getNeedTitle(type?: AiNeedType | null) {
  return (
    NEED_OPTIONS.find((option) => option.type === type)?.title || "AI 幫幫忙"
  );
}

export function getNeedCategory(type?: AiNeedType | null): AiNeedCategory {
  return (
    NEED_OPTIONS.find((option) => option.type === type)?.category || "dialogue"
  );
}

export function isCheckNeed(type?: AiNeedType | null) {
  return getNeedCategory(type) === "check";
}

export function getReplyLimit(type?: AiNeedType | null) {
  if (isCheckNeed(type)) return 80;
  if (type === "reason") return 180;
  if (type === "direction") return 160;
  if (type === "relation") return 140;
  return 80;
}

export function readFocusedInputContext(): AiContextPayload {
  const active = document.activeElement as
    | HTMLTextAreaElement
    | HTMLInputElement
    | null;
  if (!active || !("value" in active)) return {};
  const tagName = active.tagName.toLowerCase();
  if (tagName !== "textarea" && tagName !== "input") return {};
  if (active.getAttribute("data-ai-helper-input") === "true") return {};
  const value = String(active.value || "").trim();
  if (!value) return {};
  const label =
    active.getAttribute("aria-label") ||
    active.getAttribute("placeholder") ||
    "目前正在撰寫的文字";
  return { focusLabel: label, focusText: value.slice(0, 800) };
}

function normalizeStoredMessages(messages: unknown): AiMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-40).reduce<AiMessage[]>((items, message) => {
    if (!message || typeof message !== "object") return items;
    const raw = message as Partial<AiMessage>;
    const role = raw.role === "student" || raw.role === "ai" ? raw.role : null;
    const text = String(raw.text || "").trim().slice(0, 1200);
    if (!role || !text) return items;
    const nextMessage: AiMessage = {
      id: raw.id || createMessageId(),
      role,
      text,
    };
    if (raw.needType) nextMessage.needType = raw.needType;
    if (raw.source === "fallback" || raw.source === "system" || raw.source === "ai") {
      nextMessage.source = raw.source;
    }
    items.push(nextMessage);
    return items;
  }, []);
}

export function parseStoredUsage(raw: string | null): StoredUsageState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUsageState>;
    return {
      helpCredits: Math.max(
        0,
        Math.min(HELP_USES_PER_COIN, Number(parsed.helpCredits) || 0),
      ),
      turnsInCurrentHelp: Math.max(
        0,
        Math.min(MAX_TURNS_PER_HELP, Number(parsed.turnsInCurrentHelp) || 0),
      ),
      checksInCurrentHelp: Math.max(
        0,
        Math.min(MAX_CHECKS_PER_HELP, Number(parsed.checksInCurrentHelp) || 0),
      ),
      selectedNeed: parsed.selectedNeed || null,
      helpEnded: Boolean(parsed.helpEnded),
      goodbye: Boolean(parsed.goodbye),
      gapScope: parsed.gapScope === "round" || parsed.gapScope === "overall" ? parsed.gapScope : null,
      messages: normalizeStoredMessages(parsed.messages),
    };
  } catch {
    return null;
  }
}
