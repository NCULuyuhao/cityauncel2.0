import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getAiHelperStatus,
  recordAiHelperEvent,
  sendAiChat,
  unlockAiHelperPack,
} from "@/api/aiHelperApi";
import { readAiHelperUsage, saveAiHelperUsage } from "@/storage/aiHelperStorage";
import { AiHelperCoinPrompt } from "./AiHelperCoinPrompt";
import { AiHelperNeedOptionPanel } from "./AiHelperNeedOptionPanel";
import { AiHelperToggleButton } from "./AiHelperToggleButton";

import type {
  AiContextPayload,
  AiInquiryAssistantProps,
  AiMessage,
  AiNeedType,
  AiAskPayload,
} from "./aiHelperTypes";
import {
  HELP_USES_PER_COIN,
  MAX_CHECKS_PER_HELP,
  MAX_TURNS_PER_HELP,
  NEED_OPTIONS,
  PAGE_LABELS,
  getDirectionOpeningLine,
  getOpeningLine,
} from "./aiHelperConfig";
import {
  clampShortReply,
  createMessageId,
  finalizeReplyForDisplay,
  getNeedCategory,
  getNeedTitle,
  getReplyLimit,
  isCheckNeed,
  parseStoredUsage,
  readFocusedInputContext,
} from "./aiHelperUtils";

export default function AiInquiryAssistant({
  token,
  currentPage,
  currentPageLabel,
  roundKey,
  context,
}: AiInquiryAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [coins, setCoins] = useState(0);
  const [showCoinPrompt, setShowCoinPrompt] = useState(false);
  const [isCoinDropping, setIsCoinDropping] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<AiNeedType | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [blockedNeed, setBlockedNeed] = useState<AiNeedType | null>(null);
  const [gapScope, setGapScope] = useState<"round" | "overall" | null>(null);
  const [runtimeContext, setRuntimeContext] = useState<AiContextPayload>({});
  const [helpCredits, setHelpCredits] = useState(0);
  const [turnsInCurrentHelp, setTurnsInCurrentHelp] = useState(0);
  const [checksInCurrentHelp, setChecksInCurrentHelp] = useState(0);
  const [helpEnded, setHelpEnded] = useState(false);
  const [goodbye, setGoodbye] = useState(false);
  const [pendingRenewAction, setPendingRenewAction] = useState<
    "renew" | null
  >(null);
  const [showRenewChoice, setShowRenewChoice] = useState(false);
  const [isCheckingCoinBalance, setIsCheckingCoinBalance] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const currentHelpSessionIdRef = useRef(createMessageId());
  const startHelpRef = useRef<(needType: AiNeedType, preserveHistory?: boolean) => void>(() => undefined);
  const sendMessageRef = useRef<(
    forcedText?: string,
    forcedNeed?: AiNeedType,
    overrideContext?: AiContextPayload,
  ) => Promise<void>>(async () => undefined);

  const pageLabel = useMemo(
    () => currentPageLabel || PAGE_LABELS[currentPage] || currentPage,
    [currentPage, currentPageLabel],
  );
  const safeRoundKey = roundKey || `${currentPage}-round-1`;
  const shouldRender = Boolean(token) && currentPage === "cards";
  const storageKey = useMemo(
    () => `cityauncel_ai_helper_usage_${currentPage}_${safeRoundKey}`,
    [currentPage, safeRoundKey],
  );
  const selectedNeedCategory = getNeedCategory(selectedNeed);
  const hasReadableHelpHistory = selectedNeed !== null || messages.length > 0 || goodbye;
  const isFinalReadOnlyHelp =
    hasReadableHelpHistory && helpEnded && helpCredits <= 0 && coins < 1;
  const shouldShowCoinPrompt =
    !isFinalReadOnlyHelp &&
    (showCoinPrompt || (!isUnlocked && helpCredits <= 0 && !hasReadableHelpHistory));
  const canChat =
    isUnlocked &&
    selectedNeed !== null &&
    selectedNeedCategory === "dialogue" &&
    !helpEnded &&
    !goodbye &&
    !isFinalReadOnlyHelp;

  const refreshAiHelperStatus = useCallback(async () => {
    if (!shouldRender || !token) return null;
    try {
      const data = await getAiHelperStatus(token, currentPage, safeRoundKey);
      const nextCoins = Number(data.coins) || 0;
      setIsUnlocked(Boolean(data.unlocked));
      setCoins(nextCoins);
      return { unlocked: Boolean(data.unlocked), coins: nextCoins };
    } catch {
      setStatusMessage("AI 狀態讀取失敗");
      return null;
    }
  }, [currentPage, safeRoundKey, shouldRender, token]);

  async function hasCoinBeforeRenew() {
    setIsCheckingCoinBalance(true);
    const latest = await refreshAiHelperStatus();
    setIsCheckingCoinBalance(false);
    if (!latest || latest.coins < 1) {
      setCoins(0);
      setStatusMessage("您已經沒有 coin 了");
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (!shouldRender) return;
    const stored = readAiHelperUsage<AiNeedType>(storageKey, parseStoredUsage);
    if (!stored) return;
    const timer = window.setTimeout(() => {
      setHelpCredits(stored.helpCredits);
      setTurnsInCurrentHelp(stored.turnsInCurrentHelp);
      setChecksInCurrentHelp(stored.checksInCurrentHelp);
      setSelectedNeed(stored.selectedNeed);
      setHelpEnded(stored.helpEnded);
      setGoodbye(stored.goodbye);
      setGapScope(stored.gapScope || null);
      setMessages(stored.messages || []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [shouldRender, storageKey]);

  useEffect(() => {
    if (!shouldRender) return;
    saveAiHelperUsage<AiNeedType>(storageKey, {
      helpCredits,
      turnsInCurrentHelp,
      checksInCurrentHelp,
      selectedNeed,
      helpEnded,
      goodbye,
      gapScope,
      messages: messages.slice(-40),
    });
  }, [
    shouldRender,
    storageKey,
    helpCredits,
    turnsInCurrentHelp,
    checksInCurrentHelp,
    selectedNeed,
    helpEnded,
    goodbye,
    gapScope,
    messages,
  ]);

  useEffect(() => {
    if (!shouldRender || !token) return;
    const refreshStatus = (event?: Event) => {
      const nextCoins = Number(
        (event as CustomEvent<{ coins?: number }> | undefined)?.detail?.coins,
      );
      if (Number.isFinite(nextCoins)) {
        setCoins(Math.max(0, nextCoins));
        return;
      }
      if (!document.hidden) void refreshAiHelperStatus();
    };
    const initialStatusTimer = window.setTimeout(() => {
      void refreshAiHelperStatus();
    }, 0);
    window.addEventListener("cityauncel:coin-updated", refreshStatus);
    window.addEventListener("focus", refreshStatus);
    return () => {
      window.clearTimeout(initialStatusTimer);
      window.removeEventListener("cityauncel:coin-updated", refreshStatus);
      window.removeEventListener("focus", refreshStatus);
    };
  }, [refreshAiHelperStatus, shouldRender, token]);

  useEffect(() => {
    if (!shouldRender || !token || !helpEnded || helpCredits > 0) return;
    const timer = window.setTimeout(() => {
      void refreshAiHelperStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [helpCredits, helpEnded, refreshAiHelperStatus, shouldRender, token]);

  useEffect(() => {
    window.setTimeout(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  }, [messages.length, isLoading, helpEnded]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleCardUnlocked = (event: Event) => {
      if (!(selectedNeed === "direction" || selectedNeed === "relation") || helpEnded || goodbye) return;
      const activeDialogueNeed = selectedNeed === "relation" ? "relation" : "direction";
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      setRuntimeContext((prev) => ({
        ...prev,
        lastUnlockedCard: detail,
        lastUnlockedCardAt: new Date().toISOString(),
      }));
      setHelpEnded(true);
      setMessages((prev) => {
        const last = prev.at(-1);
        if (last?.source === "system" && last.text.includes("已解鎖數據卡")) return prev;
        const endingText = activeDialogueNeed === "relation"
          ? "我偵測到你已解鎖數據卡，代表你已經開始用資料驗證想法了。這次強化想法先到這裡，接著可以回到資料裡找證據。"
          : "我偵測到你已解鎖數據卡，代表你已經回到系統用資料驗證想法了。這次指引先到這裡，接著可以看看資料是否支持剛剛的方向。";
        return [
          ...prev,
          {
            id: createMessageId(),
            role: "ai",
            text: endingText,
            needType: activeDialogueNeed,
            source: "system",
          },
        ];
      });
    };
    window.addEventListener(
      "cityauncel:ai-helper-card-unlocked",
      handleCardUnlocked as EventListener,
    );
    return () => {
      window.removeEventListener(
        "cityauncel:ai-helper-card-unlocked",
        handleCardUnlocked as EventListener,
      );
    };
  }, [shouldRender, selectedNeed, helpEnded, goodbye]);

  useEffect(() => {
    const handleContext = (event: Event) => {
      const detail = (event as CustomEvent<AiContextPayload>).detail || {};
      setRuntimeContext((prev) => ({ ...prev, ...detail }));
    };
    const handleAsk = (event: Event) => {
      const detail = (event as CustomEvent<AiAskPayload>).detail || {};
      if (detail.open !== false) setIsOpen(true);
      if (detail.context)
        setRuntimeContext((prev) => ({ ...prev, ...detail.context }));
      if (detail.needType && isUnlocked && helpCredits > 0)
        startHelpRef.current(detail.needType);
      if (detail.message && (detail.needType || selectedNeed)) {
        window.setTimeout(
          () =>
            void sendMessageRef.current(
              detail.message,
              detail.needType || selectedNeed || "direction",
              detail.context,
            ),
          0,
        );
      }
    };
    window.addEventListener(
      "cityauncel:ai-context",
      handleContext as EventListener,
    );
    window.addEventListener("cityauncel:ai-ask", handleAsk as EventListener);
    window.cityauncelAiAssistant = {
      ask: (payload) => {
        if (payload.open !== false) setIsOpen(true);
        if (payload.context)
          setRuntimeContext((prev) => ({ ...prev, ...payload.context }));
        if (payload.needType && isUnlocked && helpCredits > 0)
          startHelpRef.current(payload.needType);
        if (payload.message && (payload.needType || selectedNeed)) {
          void sendMessageRef.current(
            payload.message,
            payload.needType || selectedNeed || "direction",
            payload.context,
          );
        }
      },
      setContext: (nextContext) =>
        setRuntimeContext((prev) => ({ ...prev, ...nextContext })),
    };
    return () => {
      window.removeEventListener(
        "cityauncel:ai-context",
        handleContext as EventListener,
      );
      window.removeEventListener(
        "cityauncel:ai-ask",
        handleAsk as EventListener,
      );
      if (window.cityauncelAiAssistant?.ask)
        delete window.cityauncelAiAssistant;
    };
  }, [selectedNeed, isUnlocked, helpCredits]);

  useLayoutEffect(() => {
    startHelpRef.current = startHelp;
    sendMessageRef.current = sendMessage;
  });

  function buildContext(overrideContext?: AiContextPayload): AiContextPayload {
    return {
      pageKey: currentPage,
      pageLabel,
      roundKey: safeRoundKey,
      helpTurnsUsed: turnsInCurrentHelp,
      helpTurnLimit: MAX_TURNS_PER_HELP,
      helpChecksUsed: checksInCurrentHelp,
      helpCheckLimit: MAX_CHECKS_PER_HELP,
      helpCategory: selectedNeedCategory,
      gapScope: gapScope || undefined,
      ...(context || {}),
      ...runtimeContext,
      ...readFocusedInputContext(),
      ...(overrideContext || {}),
    };
  }

  async function logAiHelperEvent({
    actionType,
    needType = selectedNeed,
    requestText,
    responseText,
    responseSource,
    overrideContext,
  }: {
    actionType: string;
    needType?: AiNeedType | null;
    requestText?: string;
    responseText?: string;
    responseSource?: string;
    overrideContext?: AiContextPayload;
  }) {
    if (!token) return;
    try {
      const contextForLog = buildContext(overrideContext);
      await recordAiHelperEvent(token, {
        scope: currentPage,
        roundKey: safeRoundKey,
        sessionId: currentHelpSessionIdRef.current,
        needType,
        helpCategory: getNeedCategory(needType),
        actionType,
        requestText,
        responseText,
        responseSource,
        gapScope: contextForLog.gapScope,
        helpCredits,
        turnsInHelp: turnsInCurrentHelp,
        checksInHelp: checksInCurrentHelp,
        context: contextForLog,
      });
    } catch {
      // AI 使用紀錄失敗不影響學生操作。
    }
  }

  async function chargeAiHelperPack(forceCharge = false) {
    if (!token || isCoinDropping) return false;
    setStatusMessage("");
    setIsCoinDropping(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      const data = await unlockAiHelperPack(token, {
        scope: currentPage,
        roundKey: safeRoundKey,
        sessionId: currentHelpSessionIdRef.current,
        forceCharge,
      });
      setCoins(Number(data.coins) || 0);
      setIsUnlocked(true);
      setShowCoinPrompt(false);
      setGoodbye(false);
      setHelpEnded(false);
      setTurnsInCurrentHelp(0);
      setChecksInCurrentHelp(0);
      setGapScope(null);
      setHelpCredits(HELP_USES_PER_COIN);
      window.dispatchEvent(
        new CustomEvent("cityauncel:coin-updated", {
          detail: { coins: Number(data.coins) || 0 },
        }),
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "投幣失敗";
      setStatusMessage(message);
      return false;
    } finally {
      setIsCoinDropping(false);
    }
  }

  async function unlockAiHelper() {
    const paid = await chargeAiHelperPack(isUnlocked || helpCredits <= 0);
    if (!paid) return;
    setMessages([
      { id: "welcome", role: "ai", text: "已投幣，獲得 2 張 AI 幫助券。選擇功能時才會扣券，收起或打開不會扣。" },
    ]);
    setSelectedNeed(null);
  }

  async function renewAiHelperPackFromMenu() {
    setPendingRenewAction("renew");
    const canRenew = await hasCoinBeforeRenew();
    if (!canRenew) {
      setPendingRenewAction(null);
      return;
    }
    const paid = await chargeAiHelperPack(true);
    setPendingRenewAction(null);
    if (!paid) return;
    setMessages([
      { id: createMessageId(), role: "ai", text: "續費完成，又獲得 2 張 AI 幫助券。請選擇你現在最需要的幫助。", source: "system" },
    ]);
    setSelectedNeed(null);
  }

  function handleToggleClick() {
    setStatusMessage("");
    setIsOpen((prev) => {
      const nextOpen = !prev;
      if (!nextOpen) return nextOpen;

      const shouldResumeCurrentState =
        hasReadableHelpHistory || helpCredits > 0 || helpEnded || goodbye;
      const needsCoin = !isUnlocked && !shouldResumeCurrentState;
      setShowCoinPrompt(needsCoin);
      return nextOpen;
    });
  }

  async function runDirectionOpeningAdvice(
    baseMessages: AiMessage[] = [],
    overrideContext?: AiContextPayload,
    allowDuringStart = false,
  ) {
    if (!token || isLoading || !isUnlocked || (helpEnded && !allowDuringStart) || goodbye) return;
    const openingRequest =
      "我剛選擇指引探究方向。請自然給我3到5個可以探究的大方向，每個方向都要像學生聽得懂的思考切入點，不要只是資料名稱相加；提醒我選到方向後回到系統找相關數據卡，驗證自己的想法有沒有成立；不要使用固定模板句，最多160字。";
    setStatusMessage("");
    setIsLoading(true);
    try {
      const historyForAi = baseMessages.length > 0
        ? baseMessages
        : messages.filter((message) => message.role === "student" || message.role === "ai").slice(-8);
      const contextForAi = {
        ...buildContext(overrideContext),
        helpCategory: "dialogue",
        replyLimit: getReplyLimit("direction"),
        directionOpening: true,
        aiHelperHistory: [
          ...historyForAi.map((message) => ({
            role: message.role,
            text: message.text,
            needType: message.needType || "direction",
          })),
          { role: "student", text: openingRequest, needType: "direction" },
        ],
      };
      const data = await sendAiChat(token, {
          message: openingRequest,
          needType: "direction",
          context: contextForAi,
          scope: currentPage,
          roundKey: safeRoundKey,
          sessionId: currentHelpSessionIdRef.current,
          helpCredits,
          turnsInHelp: turnsInCurrentHelp,
          checksInHelp: checksInCurrentHelp,
      });
      const isFallbackReply = Boolean(
        data.isFallback || data.source === "fallback",
      );
      if (isFallbackReply)
        setStatusMessage("目前顯示的是離線提示，不是 AI 即時回覆。");
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: clampShortReply(
            String(data.reply || getDirectionOpeningLine()),
            getReplyLimit("direction"),
          ),
          needType: "direction",
          source: isFallbackReply ? "fallback" : "ai",
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 暫時無法回覆";
      setStatusMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: "可以先從幾個大方向想：哪個地區同時有石虎活動和人類壓力？道路是否切開移動路徑？土地利用是否讓棲地變少？地方傳言和真實紀錄是否一致？選好方向後，回到系統找相關數據卡驗證想法。",
          needType: "direction",
          source: "system",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function runReasonOpeningAdvice(
    baseMessages: AiMessage[] = [],
    overrideContext?: AiContextPayload,
    allowDuringStart = false,
  ) {
    if (!token || isLoading || !isUnlocked || (helpEnded && !allowDuringStart) || goodbye) return;
    const reasonRequest =
      "我剛選擇教我寫理由。請只針對蒐集檢查站目前顯示的數據卡回覆，像一位溫柔的國小教師，先看學生蒐集到哪些面向的資料卡，並用一句話肯定他的蒐集方向。接著請根據這些卡，推敲學生可能已經從數據中看到、發現、獲得或理解了什麼，再教學生把這個發現寫成蒐集理由。寫作方向是：我從這些數據中發現了＿＿，這個發現可以證明＿＿。也可以提醒學生：寫蒐集理由時，你可以想想這批數據卡共同指向什麼問題。請維持正向、鼓勵、建議式語氣，最多180字。";
    setStatusMessage("");
    setIsLoading(true);
    try {
      const historyForAi = baseMessages.length > 0
        ? baseMessages
        : messages.filter((message) => message.role === "student" || message.role === "ai").slice(-8);
      const contextForAi = {
        ...buildContext(overrideContext),
        helpCategory: "suggestion",
        replyLimit: getReplyLimit("reason"),
        reasonOpening: true,
        aiHelperHistory: [
          ...historyForAi.map((message) => ({
            role: message.role,
            text: message.text,
            needType: message.needType || "reason",
          })),
          { role: "student", text: reasonRequest, needType: "reason" },
        ],
      };
      const data = await sendAiChat(token, {
          message: reasonRequest,
          needType: "reason",
          context: contextForAi,
          scope: currentPage,
          roundKey: safeRoundKey,
          sessionId: currentHelpSessionIdRef.current,
          helpCredits,
          turnsInHelp: turnsInCurrentHelp,
          checksInHelp: checksInCurrentHelp,
      });
      const isFallbackReply = Boolean(
        data.isFallback || data.source === "fallback",
      );
      if (isFallbackReply)
        setStatusMessage("目前顯示的是離線提示，不是 AI 即時回覆。");
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: finalizeReplyForDisplay(
            String(data.reply || "你已經開始整理解鎖理由了，很棒。寫蒐集理由時，可以想想這批數據卡共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。"),
            "reason",
          ),
          needType: "reason",
          source: isFallbackReply ? "fallback" : "ai",
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 暫時無法回覆";
      setStatusMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: "你已經開始整理解鎖理由了，很棒。寫蒐集理由時，可以想想這批數據卡共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。",
          needType: "reason",
          source: "system",
        },
      ]);
    } finally {
      setIsLoading(false);
      setChecksInCurrentHelp((prev) => {
        const next = prev + 1;
        if (next >= MAX_CHECKS_PER_HELP) {
          window.setTimeout(endCurrentHelp, 80);
          return MAX_CHECKS_PER_HELP;
        }
        return next;
      });
    }
  }

  function startHelp(needType: AiNeedType, preserveHistory = false) {
    if (helpCredits <= 0) {
      setHelpEnded(true);
      return;
    }
    if (!preserveHistory) currentHelpSessionIdRef.current = createMessageId();
    const checkMode = isCheckNeed(needType);
    const studentStartMessage: AiMessage = {
      id: createMessageId(),
      role: "student",
      text: getNeedTitle(needType),
      needType,
    };
    const openingMessages: AiMessage[] =
      needType === "direction" || needType === "reason" || (checkMode && needType !== "gap")
        ? [studentStartMessage]
        : [
            studentStartMessage,
            {
              id: createMessageId(),
              role: "ai",
              text: getOpeningLine(needType),
              needType,
              source: "system",
            },
          ];
    setSelectedNeed(needType);
    setGoodbye(false);
    setHelpEnded(false);
    setShowRenewChoice(false);
    setTurnsInCurrentHelp(0);
    setChecksInCurrentHelp(0);
    setGapScope(null);
    setHelpCredits((prev) => Math.max(0, prev - 1));
    setMessages((prev) => (preserveHistory ? [...prev, ...openingMessages] : openingMessages));
    void logAiHelperEvent({
      actionType: preserveHistory ? "continue_help" : "start_help",
      needType,
      requestText: getNeedTitle(needType),
      overrideContext: { helpCategory: getNeedCategory(needType) },
    });
    if (needType === "direction") {
      window.setTimeout(
        () => void runDirectionOpeningAdvice(openingMessages, undefined, true),
        120,
      );
    }
    if (needType === "reason") {
      window.setTimeout(
        () => void runReasonOpeningAdvice(openingMessages, undefined, true),
        120,
      );
    }
    if (checkMode && needType !== "gap") {
      window.setTimeout(
        () => void runCheckAdvice(needType, undefined, true),
        120,
      );
    }
  }

  function showBlockedNeed(needType: AiNeedType, message: string) {
    setBlockedNeed(needType);
    setStatusMessage(message);
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        role: "ai",
        text: message,
        needType,
        source: "system",
      },
    ]);
    window.setTimeout(() => setBlockedNeed(null), 620);
  }

  function chooseNeed(needType: AiNeedType) {
    if (helpCredits <= 0) {
      setStatusMessage("AI 幫助券已用完，請續費後再選擇新的幫助。");
      return;
    }

    const isCheckpoint = Boolean(
      runtimeContext.isCollectionCheckpointOpen ||
      runtimeContext.activeContextScope === "checkpoint",
    );
    const checkpointCards = Array.isArray(runtimeContext.activeContextCards)
      ? runtimeContext.activeContextCards
      : [];
    const hasCheckpointCards = checkpointCards.length > 0;

    if (needType === "reason") {
      if (!isCheckpoint || !hasCheckpointCards) {
        showBlockedNeed(needType, "該功能請於線索蒐集站的時候才可以使用。");
        return;
      }
    }

    if (needType === "clarity") {
      const reasonText = String(
        runtimeContext.collectionReflectionText ||
          runtimeContext.focusText ||
          "",
      ).trim();
      const minLength = Math.max(
        1,
        Number(runtimeContext.collectionReflectionMinLength) || 1,
      );
      if (!isCheckpoint) {
        showBlockedNeed(needType, "該功能請於線索蒐集站的時候才可以使用。");
        return;
      }
      if (!reasonText || reasonText.length < minLength) {
        showBlockedNeed(needType, "請先把理由寫到符合規範，再讓 AI 檢查。");
        return;
      }
    }
    startHelp(needType);
  }

  function endCurrentHelp() {
    setHelpEnded((alreadyEnded) => {
      if (alreadyEnded) return true;
      void logAiHelperEvent({
        actionType: "end_help",
        requestText: "該次幫助已結束。",
        responseSource: "system",
      });
      setMessages((prev) => {
        const lastMessage = prev.at(-1);
        if (lastMessage?.role === "ai" && lastMessage.text === "該次幫助已結束。") {
          return prev;
        }
        return [
          ...prev,
          { id: createMessageId(), role: "ai", text: "該次幫助已結束。", source: "system" },
        ];
      });
      return true;
    });
  }

  async function renewAiHelper() {
    if (!selectedNeed) return;
    setPendingRenewAction("renew");
    const canRenew = await hasCoinBeforeRenew();
    if (!canRenew) {
      setPendingRenewAction(null);
      return;
    }
    const paid = await chargeAiHelperPack(true);
    setPendingRenewAction(null);
    if (!paid) return;
    setHelpEnded(true);
    setShowRenewChoice(true);
  }

  function continueRenewedAi() {
    if (!selectedNeed) return;
    setShowRenewChoice(false);
    setHelpEnded(false);
    setGoodbye(false);
    setTurnsInCurrentHelp(0);
    setChecksInCurrentHelp(0);
    setGapScope(null);
    setHelpCredits((prev) => Math.max(0, prev - 1));
  }

  function changeRenewedAi() {
    setShowRenewChoice(false);
    setSelectedNeed(null);
    setHelpEnded(false);
    setTurnsInCurrentHelp(0);
    setChecksInCurrentHelp(0);
    setGapScope(null);
    setMessages([
      { id: createMessageId(), role: "ai", text: "請重新選擇你需要的幫助。", source: "system" },
    ]);
  }

  function continueWithRemainingCredit() {
    if (!selectedNeed) return;
    startHelp(selectedNeed, true);
  }

  function changeWithRemainingCredit() {
    setShowRenewChoice(false);
    setSelectedNeed(null);
    setHelpEnded(false);
    setTurnsInCurrentHelp(0);
    setChecksInCurrentHelp(0);
    setGapScope(null);
    setMessages([
      { id: createMessageId(), role: "ai", text: "請重新選擇你需要的幫助。", source: "system" },
    ]);
  }

  function finishHelping() {
    void logAiHelperEvent({
      actionType: "finish_helping",
      requestText: "謝謝使用，歡迎再次光臨。",
      responseSource: "system",
    });
    setGoodbye(true);
    setHelpEnded(false);
    setShowRenewChoice(false);
    setSelectedNeed(null);
    setGapScope(null);
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "ai", text: "謝謝使用，歡迎再次光臨。" },
    ]);
  }

  function closeGoodbyeAndReturnToCoinPrompt() {
    setGoodbye(false);
    setHelpEnded(false);
    setShowRenewChoice(false);
    setSelectedNeed(null);
    setGapScope(null);
    setMessages([]);
    setStatusMessage("");
    setShowCoinPrompt(true);
    setIsOpen(true);
  }

  function getAiContextCardArray(value: unknown): NonNullable<AiContextPayload["activeContextCards"]> {
    return Array.isArray(value)
      ? (value as NonNullable<AiContextPayload["activeContextCards"]>)
      : [];
  }

  function normalizeGapScope(value: unknown): "round" | "overall" | null {
    return value === "overall" || value === "round" ? value : null;
  }

  function buildGapScopeContext(scope: "round" | "overall"): AiContextPayload {
    const sourceContext = { ...(context || {}), ...runtimeContext };
    const roundUnlockedCards = getAiContextCardArray(sourceContext.unlockedCards);
    const allUnlockedCards = getAiContextCardArray(sourceContext.allUnlockedCards);
    const activeCards = getAiContextCardArray(sourceContext.activeContextCards);
    const cards = scope === "overall"
      ? allUnlockedCards.length > 0
        ? allUnlockedCards
        : roundUnlockedCards.length > 0
          ? roundUnlockedCards
          : activeCards
      : roundUnlockedCards.length > 0
        ? roundUnlockedCards
        : activeCards;

    return {
      unlockedCards: roundUnlockedCards,
      allUnlockedCards: allUnlockedCards.length > 0 ? allUnlockedCards : cards,
      activeContextScope: "unlocked",
      activeContextLabel: scope === "overall" ? "玩家全部已解鎖過的數據卡" : "本次探究已解鎖的數據卡",
      activeContextCards: cards,
      gapScope: scope,
      gapScopeLabel: scope === "overall" ? "總體探究缺口" : "本次探究缺口",
      gapScopeCardCount: cards.length,
      unlockedCardCount: roundUnlockedCards.length,
      allUnlockedCardCount: scope === "overall" ? cards.length : allUnlockedCards.length,
    };
  }

  function chooseGapScope(scope: "round" | "overall") {
    const scopeContext = buildGapScopeContext(scope);
    setGapScope(scope);
    void logAiHelperEvent({
      actionType: "choose_gap_scope",
      needType: "gap",
      requestText: scope === "overall" ? "檢查總體探究缺口" : "檢查本次探究缺口",
      overrideContext: scopeContext,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        role: "student",
        text: scope === "overall" ? "檢查總體探究缺口" : "檢查本次探究缺口",
        needType: "gap",
      },
    ]);
    window.setTimeout(() => {
      void runCheckAdvice("gap", scopeContext, true);
    }, 100);
  }

  async function runCheckAdvice(
    needType = selectedNeed || "clarity",
    overrideContext?: AiContextPayload,
    allowDuringStart = false,
  ) {
    if (
      !token ||
      isLoading ||
      !isUnlocked ||
      (helpEnded && !allowDuringStart) ||
      goodbye ||
      !isCheckNeed(needType)
    )
      return;
    setStatusMessage("");
    setIsLoading(true);
    try {
      const effectiveGapScope =
        needType === "gap"
          ? normalizeGapScope(overrideContext?.gapScope) || gapScope || "round"
          : null;
      const effectiveContext =
        needType === "gap" && effectiveGapScope
          ? { ...buildGapScopeContext(effectiveGapScope), ...(overrideContext || {}) }
          : overrideContext;
      const checkMessage =
        needType === "clarity"
          ? "請檢查我的理由清不清楚"
          : effectiveGapScope === "overall"
            ? "請檢查我的總體探究缺口，範圍是我在整個系統中所有已解鎖的數據卡"
            : "請檢查我的本次探究缺口，範圍是本次探究已解鎖的數據卡";
      const historyForAi = messages
        .filter(
          (message) => message.role === "student" || message.role === "ai",
        )
        .slice(-8)
        .map((message) => ({
          role: message.role,
          text: message.text,
          needType: message.needType || selectedNeed || needType,
        }));
      const contextForAi = {
        ...buildContext(effectiveContext),
        helpCategory: "check",
        replyLimit: getReplyLimit(needType),
        aiHelperHistory: [
          ...historyForAi,
          { role: "student", text: checkMessage, needType },
        ],
      };
      const data = await sendAiChat(token, {
          message: checkMessage,
          needType,
          context: contextForAi,
          scope: currentPage,
          roundKey: safeRoundKey,
          sessionId: currentHelpSessionIdRef.current,
          helpCredits,
          turnsInHelp: turnsInCurrentHelp,
          checksInHelp: checksInCurrentHelp,
      });
      const isFallbackReply = Boolean(
        data.isFallback || data.source === "fallback",
      );
      if (isFallbackReply)
        setStatusMessage("目前顯示的是離線提示，不是 AI 即時回覆。");
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: clampShortReply(
            String(data.reply || "我先給你一個小提醒，可以再看資料角度。"),
            getReplyLimit(needType),
          ),
          needType,
          source: isFallbackReply ? "fallback" : "ai",
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI 暫時無法檢查";
      setStatusMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: "我先提醒你，可以再看卡牌和理由有沒有接上。",
          needType,
          source: "system",
        },
      ]);
    } finally {
      setIsLoading(false);
      setChecksInCurrentHelp((prev) => {
        const next = prev + 1;
        if (next >= MAX_CHECKS_PER_HELP) {
          window.setTimeout(endCurrentHelp, 80);
          return MAX_CHECKS_PER_HELP;
        }
        return next;
      });
    }
  }

  async function sendMessage(
    nextText?: string,
    needType = selectedNeed || "direction",
    overrideContext?: AiContextPayload,
  ) {
    if (
      !token ||
      isLoading ||
      !isUnlocked ||
      helpEnded ||
      goodbye ||
      isCheckNeed(needType)
    )
      return;
    const text = String(nextText ?? input).trim();
    if (!text) return;
    setInput("");
    setStatusMessage("");
    const historyForAi = messages
      .filter((message) => message.role === "student" || message.role === "ai")
      .slice(-10)
      .map((message) => ({
        role: message.role,
        text: message.text,
        needType: message.needType || selectedNeed || needType,
      }));
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "student", text, needType },
    ]);
    setIsLoading(true);
    try {
      const contextForAi = {
        ...buildContext(overrideContext),
        aiHelperHistory: [...historyForAi, { role: "student", text, needType }],
        helpCategory: getNeedCategory(needType),
        replyLimit: getReplyLimit(needType),
      };
      const data = await sendAiChat(token, {
          message: text,
          needType,
          context: contextForAi,
          scope: currentPage,
          roundKey: safeRoundKey,
          sessionId: currentHelpSessionIdRef.current,
          helpCredits,
          turnsInHelp: turnsInCurrentHelp,
          checksInHelp: checksInCurrentHelp,
      });
      const isFallbackReply = Boolean(
        data.isFallback || data.source === "fallback",
      );
      if (isFallbackReply)
        setStatusMessage("目前顯示的是離線提示，不是 AI 即時回覆。");
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: clampShortReply(
            String(data.reply || "你可以先說說，哪張卡讓你最在意。"),
            getReplyLimit(needType),
          ),
          needType,
          source: isFallbackReply ? "fallback" : "ai",
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI 暫時無法回覆";
      setStatusMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "ai",
          text: needType === "reason" ? "寫蒐集理由時，可以想想這批數據卡共同指向什麼問題，再寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。" : "先依你剛說的目的，挑一類最能看出現象的資料，再補一類能連回石虎生存挑戰的資料，這樣想法會比較有支撐。",
          needType,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTurnsInCurrentHelp((prev) => {
        const next = prev + 1;
        if (next >= MAX_TURNS_PER_HELP) {
          window.setTimeout(endCurrentHelp, 80);
          return MAX_TURNS_PER_HELP;
        }
        return next;
      });
    }
  }

  if (!shouldRender) return null;

  const groupedNeedOptions = [
    { label: "對話型(最多對話五輪)", options: NEED_OPTIONS.filter((option) => option.category === "dialogue") },
    { label: "建議型(最多教兩次)", options: NEED_OPTIONS.filter((option) => option.category === "suggestion") },
    { label: "檢查型(最多檢查兩次)", options: NEED_OPTIONS.filter((option) => option.category === "check") },
  ];
  const noCoinAfterSecondHelp = helpEnded && helpCredits <= 0 && coins < 1;

  return (
    <div className="fixed bottom-5 left-5 z-[10045] font-sans">
      <AnimatePresence>
        {isOpen ? (
          <motion.section
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="mb-3 flex h-[min(700px,calc(100vh-88px))] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[30px] border-2 border-[#d5b36f] bg-[#fff8e8]/96 text-[#3d3124] shadow-[0_28px_90px_rgba(55,39,18,0.32)] backdrop-blur"
          >
            <header className="relative overflow-hidden border-b border-[#ead6aa] bg-gradient-to-br from-[#fff0ba] via-[#ffe5a3] to-[#f4c96d] px-4 py-3">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/30" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <motion.div
                    animate={{ y: [0, -3, 0], rotate: [0, -4, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#6f4d25] bg-[#6f4d25] text-white shadow-[0_7px_0_rgba(84,55,23,0.22)]"
                  >
                    <Bot size={25} />
                  </motion.div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black tracking-[0.12em] text-[#3d2b19]">
                      AI 幫幫忙
                    </h2>
                  </div>
                </div>
              </div>
            </header>

            {shouldShowCoinPrompt ? (
              <AiHelperCoinPrompt
                coins={coins}
                statusMessage={statusMessage}
                isCoinDropping={isCoinDropping}
                onCancel={() => {
                  setShowCoinPrompt(false);
                  setIsOpen(false);
                }}
                onUnlock={unlockAiHelper}
              />
            ) : selectedNeed === null && !goodbye ? (
              <AiHelperNeedOptionPanel
                groupedNeedOptions={groupedNeedOptions}
                helpCredits={helpCredits}
                coins={coins}
                statusMessage={statusMessage}
                blockedNeed={blockedNeed}
                onChooseNeed={chooseNeed}
                onRenew={renewAiHelperPackFromMenu}
                isRenewing={pendingRenewAction === "renew" || isCoinDropping || isCheckingCoinBalance}
              />
            ) : goodbye ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div className="rounded-[28px] border border-[#ead6aa] bg-white/82 p-6 shadow-[0_18px_48px_rgba(72,48,18,0.12)]">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fff0ba] text-[#5a3b1c]">
                    <Bot size={30} />
                  </div>
                  <h3 className="text-xl font-black text-[#3d2b19]">
                    謝謝使用
                  </h3>
                  <p className="mt-2 text-sm font-bold text-[#7a6754]">
                    歡迎再次光臨。
                  </p>
                  <button
                    type="button"
                    onClick={closeGoodbyeAndReturnToCoinPrompt}
                    className="mt-5 rounded-full bg-[#6f4d25] px-5 py-2 text-sm font-black text-white"
                  >
                    關閉
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-[#ead6aa] bg-[#fff4d8] px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#6b4a23]">
                      {getNeedTitle(selectedNeed)}｜
                      {isCheckNeed(selectedNeed)
                        ? `${checksInCurrentHelp}/${MAX_CHECKS_PER_HELP} 次檢查`
                        : selectedNeedCategory === "suggestion"
                          ? `${checksInCurrentHelp}/${MAX_CHECKS_PER_HELP} 次建議`
                          : `${turnsInCurrentHelp}/${MAX_TURNS_PER_HELP} 輪`}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-black text-[#9a6a24]">
                      別只顧著聊天，記得去蒐集證據。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isFinalReadOnlyHelp) return;
                      helpCredits > 0
                        ? changeWithRemainingCredit()
                        : setHelpEnded(true);
                    }}
                    disabled={isFinalReadOnlyHelp}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d7bb82] bg-white px-3 py-1 text-[11px] font-black text-[#6b4a23] transition hover:bg-[#fff9ed] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw size={13} /> {isFinalReadOnlyHelp ? "已用完，僅能閱覽" : "重新選擇我的需求"}
                  </button>
                </div>
                <div
                  ref={listRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                  {messages.map((message) => {
                    const isStudent = message.role === "student";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isStudent ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm font-black leading-6 shadow-sm ${isStudent ? "bg-[#6f4d25] text-white" : "border border-[#ead8b4] bg-white/92 text-[#4d4031]"}`}
                        >
                          {!isStudent ? (
                            <p
                              className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-[0.12em] ${message.source === "fallback" ? "bg-[#fee2e2] text-[#9f1239]" : "bg-[#fff0ba] text-[#7a5b2f]"}`}
                            >
                              <Bot size={12} />{" "}
                              {message.source === "fallback"
                                ? "離線提示"
                                : "AI 回覆"}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  {isLoading ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-[#ead8b4] bg-white/92 px-4 py-3 text-sm font-black text-[#7a5b2f]">
                        <Loader2 className="animate-spin" size={16} />{" "}
                        思考中...
                      </div>
                    </div>
                  ) : null}
                  {helpEnded ? (
                    <div className="rounded-[24px] border border-[#e5c37d] bg-[#fff8e8] p-4 text-center shadow-sm">
                      {noCoinAfterSecondHelp ? (
                        <>
                          <p className="text-sm font-black text-[#3d2b19]">
                            謝謝使用，請下次再光臨。
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#7a6754]">
                            沒錢了，去賺錢~
                          </p>
                        </>
                      ) : showRenewChoice ? (
                        <>
                          <p className="text-sm font-black text-[#3d2b19]">
                            續費成功
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#7a6754]">
                            繼續這個 AI 會保留目前對話；更換 AI 會回到清單重新開始。
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              onClick={continueRenewedAi}
                              className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white"
                            >
                              繼續這個 AI
                            </button>
                            <button
                              type="button"
                              onClick={changeRenewedAi}
                              className="rounded-full border border-[#d7bb82] bg-white px-4 py-2 text-xs font-black text-[#6b4a23]"
                            >
                              更換 AI
                            </button>
                          </div>
                        </>
                      ) : helpCredits > 0 ? (
                        <>
                          <p className="text-sm font-black text-[#3d2b19]">
                            {isCheckNeed(selectedNeed)
                              ? "這次檢查已用完"
                              : selectedNeedCategory === "suggestion"
                                ? "這次建議已用完"
                                : "這次幫助已用完"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#7a6754]">
                            還剩 {helpCredits} 次幫助，可以繼續或更換。
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              onClick={continueWithRemainingCredit}
                              className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white"
                            >
                              繼續這個幫助
                            </button>
                            <button
                              type="button"
                              onClick={changeWithRemainingCredit}
                              className="rounded-full border border-[#d7bb82] bg-white px-4 py-2 text-xs font-black text-[#6b4a23]"
                            >
                              更換其他幫助
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-black text-[#3d2b19]">
                            第二次幫助也用完了
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#7a6754]">
                            要再投 1 coin，或先靠自己試試看？
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              onClick={renewAiHelper}
                              disabled={
                                isCoinDropping ||
                                isCheckingCoinBalance ||
                                coins < 1
                              }
                              className="rounded-full bg-[#8a642e] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                              {pendingRenewAction === "renew"
                                ? "檢查中"
                                : "續費"}
                            </button>
                            <button
                              type="button"
                              onClick={finishHelping}
                              disabled={isCoinDropping}
                              className="rounded-full border border-[#d7bb82] bg-white px-4 py-2 text-xs font-black text-[#6b4a23]"
                            >
                              我不需要幫助了
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-[#ead6aa] bg-[#fff4d8] p-3">
                  {statusMessage ? (
                    <p className="mb-2 text-xs font-black text-red-700">
                      {statusMessage}
                    </p>
                  ) : null}
                  {isCheckNeed(selectedNeed) ? (
                    <div className="rounded-2xl border border-[#d8c39a] bg-white px-3 py-3 text-center shadow-inner">
                      <p className="text-xs font-black text-[#6b4a23]">
                        檢查型只提供建議，不開放對話。
                      </p>
                      {selectedNeed === "gap" && !gapScope && checksInCurrentHelp < MAX_CHECKS_PER_HELP ? (
                        <div className="mt-2 flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => chooseGapScope("round")}
                            disabled={isLoading || helpEnded}
                            className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white disabled:opacity-45"
                          >
                            本次探究缺口
                          </button>
                          <button
                            type="button"
                            onClick={() => chooseGapScope("overall")}
                            disabled={isLoading || helpEnded}
                            className="rounded-full bg-[#8a642e] px-4 py-2 text-xs font-black text-white disabled:opacity-45"
                          >
                            總體探究缺口
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedNeed === "gap") {
                              setGapScope(null);
                              return;
                            }
                            void runCheckAdvice(selectedNeed || "clarity");
                          }}
                          disabled={
                            isLoading ||
                            helpEnded ||
                            checksInCurrentHelp >= MAX_CHECKS_PER_HELP
                          }
                          className="mt-2 rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {isLoading
                            ? "檢查中"
                            : checksInCurrentHelp <= 0
                              ? "開始檢查"
                              : "再檢查一次"}
                        </button>
                      )}
                    </div>
                  ) : selectedNeedCategory === "suggestion" ? (
                    <div className="rounded-2xl border border-[#d8c39a] bg-white px-3 py-3 text-center shadow-inner">
                      <p className="text-xs font-black text-[#6b4a23]">
                        建議型不開放對話，可請 AI 換一種寫作技巧。
                      </p>
                      <button
                        type="button"
                        onClick={() => void runReasonOpeningAdvice([], undefined, true)}
                        disabled={isLoading || helpEnded || checksInCurrentHelp >= MAX_CHECKS_PER_HELP}
                        className="mt-2 rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isLoading
                          ? "產生中"
                          : checksInCurrentHelp <= 0
                            ? "開始建議"
                            : "再教一次"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 rounded-2xl border border-[#d8c39a] bg-white px-3 py-2 shadow-inner">
                      <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        maxLength={160}
                        rows={2}
                        data-ai-helper-input="true"
                        placeholder={
                          canChat
                            ? "輸入你卡住的地方，AI會接著你的想法回"
                            : "這次幫助已結束"
                        }
                        disabled={!canChat || isLoading}
                        className="min-h-[42px] flex-1 resize-none bg-transparent text-sm font-bold leading-6 text-[#3f3427] outline-none placeholder:text-[#9c8c72] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={isLoading || !input.trim() || !canChat}
                        className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6f4d25] text-white shadow transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="送出 AI 訊息"
                      >
                        {isLoading ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Send size={18} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AiHelperToggleButton
        isOpen={isOpen}
        isUnlocked={isUnlocked}
        helpCredits={helpCredits}
        onClick={handleToggleClick}
      />
    </div>
  );
}
