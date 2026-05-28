/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙開啟後的面板 UI。主元件保留狀態與流程，這裡只處理畫面呈現。
 * 維護重點：不要在此新增 API 或資料庫流程；新的行為邏輯應留在 AiInquiryAssistant。
 */

import type { ComponentProps, Ref } from "react";
import { Bot, Loader2, RotateCcw, Send } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AiHelperCoinPrompt } from "./AiHelperCoinPrompt";
import { AiHelperNeedOptionPanel } from "./AiHelperNeedOptionPanel";
import type { AiMessage, AiNeedCategory, AiNeedType } from "./aiHelperTypes";
import { MAX_CHECKS_PER_HELP, MAX_TURNS_PER_HELP } from "./aiHelperConfig";
import { getNeedTitle, isCheckNeed } from "./aiHelperUtils";

type NeedOptionGroups = ComponentProps<typeof AiHelperNeedOptionPanel>["groupedNeedOptions"];

type AiHelperOpenPanelProps = {
  isOpen: boolean;
  shouldShowCoinPrompt: boolean;
  coins: number;
  statusMessage: string;
  isCoinDropping: boolean;
  onCoinPromptCancel: () => void;
  onUnlock: () => void | Promise<void>;
  selectedNeed: AiNeedType | null;
  goodbye: boolean;
  groupedNeedOptions: NeedOptionGroups;
  helpCredits: number;
  blockedNeed: AiNeedType | null;
  onChooseNeed: (needType: AiNeedType) => void;
  onRenewFromMenu: () => void | Promise<void>;
  isRenewing: boolean;
  onCloseGoodbyeAndReturnToCoinPrompt: () => void;
  selectedNeedCategory: AiNeedCategory;
  checksInCurrentHelp: number;
  turnsInCurrentHelp: number;
  isFinalReadOnlyHelp: boolean;
  onChangeWithRemainingCredit: () => void;
  onMarkHelpEnded: () => void;
  listRef: Ref<HTMLDivElement>;
  messages: AiMessage[];
  isLoading: boolean;
  helpEnded: boolean;
  noCoinAfterSecondHelp: boolean;
  showRenewChoice: boolean;
  onContinueRenewedAi: () => void;
  onChangeRenewedAi: () => void;
  onContinueWithRemainingCredit: () => void;
  onRenewAiHelper: () => void | Promise<void>;
  pendingRenewAction: "renew" | null;
  isCheckingCoinBalance: boolean;
  onFinishHelping: () => void;
  gapScope: "round" | "overall" | null;
  onResetGapScope: () => void;
  onChooseGapScope: (scope: "round" | "overall") => void;
  onRunCheckAdvice: (needType?: AiNeedType) => void | Promise<void>;
  onRunReasonOpeningAdvice: () => void | Promise<void>;
  input: string;
  onInputChange: (nextInput: string) => void;
  canChat: boolean;
  onSendMessage: () => void | Promise<void>;
};

export function AiHelperOpenPanel({
  isOpen,
  shouldShowCoinPrompt,
  coins,
  statusMessage,
  isCoinDropping,
  onCoinPromptCancel,
  onUnlock,
  selectedNeed,
  goodbye,
  groupedNeedOptions,
  helpCredits,
  blockedNeed,
  onChooseNeed,
  onRenewFromMenu,
  isRenewing,
  onCloseGoodbyeAndReturnToCoinPrompt,
  selectedNeedCategory,
  checksInCurrentHelp,
  turnsInCurrentHelp,
  isFinalReadOnlyHelp,
  onChangeWithRemainingCredit,
  onMarkHelpEnded,
  listRef,
  messages,
  isLoading,
  helpEnded,
  noCoinAfterSecondHelp,
  showRenewChoice,
  onContinueRenewedAi,
  onChangeRenewedAi,
  onContinueWithRemainingCredit,
  onRenewAiHelper,
  pendingRenewAction,
  isCheckingCoinBalance,
  onFinishHelping,
  gapScope,
  onResetGapScope,
  onChooseGapScope,
  onRunCheckAdvice,
  onRunReasonOpeningAdvice,
  input,
  onInputChange,
  canChat,
  onSendMessage,
}: AiHelperOpenPanelProps) {
  return (
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
              onCancel={onCoinPromptCancel}
              onUnlock={onUnlock}
            />
          ) : selectedNeed === null && !goodbye ? (
            <AiHelperNeedOptionPanel
              groupedNeedOptions={groupedNeedOptions}
              helpCredits={helpCredits}
              coins={coins}
              statusMessage={statusMessage}
              blockedNeed={blockedNeed}
              onChooseNeed={onChooseNeed}
              onRenew={onRenewFromMenu}
              isRenewing={isRenewing}
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
                  onClick={onCloseGoodbyeAndReturnToCoinPrompt}
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
                    if (helpCredits > 0) {
                      onChangeWithRemainingCredit();
                    } else {
                      onMarkHelpEnded();
                    }
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
                            onClick={onContinueRenewedAi}
                            className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white"
                          >
                            繼續這個 AI
                          </button>
                          <button
                            type="button"
                            onClick={onChangeRenewedAi}
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
                            onClick={onContinueWithRemainingCredit}
                            className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white"
                          >
                            繼續這個幫助
                          </button>
                          <button
                            type="button"
                            onClick={onChangeWithRemainingCredit}
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
                            onClick={onRenewAiHelper}
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
                            onClick={onFinishHelping}
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
                          onClick={() => onChooseGapScope("round")}
                          disabled={isLoading || helpEnded}
                          className="rounded-full bg-[#6f4d25] px-4 py-2 text-xs font-black text-white disabled:opacity-45"
                        >
                          本次探究缺口
                        </button>
                        <button
                          type="button"
                          onClick={() => onChooseGapScope("overall")}
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
                            onResetGapScope();
                            return;
                          }
                          void onRunCheckAdvice(selectedNeed || "clarity");
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
                      onClick={onRunReasonOpeningAdvice}
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
                      onChange={(event) => onInputChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void onSendMessage();
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
                      onClick={onSendMessage}
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
  );
}
