/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一前導問題頁面元件，負責目的、追問與轉場畫面。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IntroCountdownButton } from "@/features/inquiry/intro/IntroCountdownButton";
import { getInvestigationCaseByOrder } from "@/features/inquiry/intro/inquiryIntroCases";
import {
  INQUIRY_SUSPECT_GROUPS,
  INTRO_TEXT_MIN_LENGTH,
  SUSPECT_REASON_INTUITION_TEXT,
  SUSPECT_REASON_PROMPT_PREFIX,
} from "@/features/inquiry/intro/inquiryIntroConstants";

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

export function InquiryPurposePage({
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
    if (currentCase.id === "lock_suspect") {
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

export function InquiryIntroExpandablePanel({
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

export function InquiryFollowUpPage({
  purpose,
  currentInquiryOrder,
  selectedSuspects,
  task3Targets,
  suspectReason,
  suspectOtherDraft,
  suspectOtherText,
  task3OtherDraft,
  task3OtherText,
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
  task3OtherText: string;
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
  const isTask2 = currentCase.id === "lock_suspect";
  const isTask3 = currentCase.id === "trace_evidence";
  const isTask3Other = isTask3 && task3Targets.includes("comment");
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
    (isTask3 &&
      (task3Targets.length === 0 ||
        (task3Targets.includes("comment") && !task3OtherText.trim()))) ||
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
              任務即將開始，你有想要先說的想法嗎？
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onToggleTask3Target("comment")}
                className={choiceButtonClass(task3Targets.includes("comment"))}
              >
                我有話要說
              </button>
              <button
                type="button"
                onClick={() => onToggleTask3Target("no_idea")}
                className={choiceButtonClass(task3Targets.includes("no_idea"))}
              >
                我沒有想法
              </button>
            </div>

            <InquiryIntroExpandablePanel
              show={isTask3Other}
              panelKey="task3-other-panel"
              className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
            >
              <h3 className="mb-3 text-lg font-semibold text-emerald-950">
                請寫下你想說的話
              </h3>
              <div className="flex flex-col gap-3">
                <textarea
                  value={task3OtherDraft}
                  onChange={(event) => {
                    onTask3OtherDraftChange(event.target.value);
                    onTask3OtherTextChange(event.target.value.trim());
                  }}
                  placeholder="例如：我想補充目前的想法、懷疑、想追查的方向..."
                  className="min-h-32 w-full rounded-2xl border border-emerald-200 bg-white p-4 text-base outline-none focus:border-emerald-500"
                />
                <p className="text-right text-xs font-black text-emerald-700">
                  {task3OtherText.trim().length} 字
                </p>
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

export function InquiryStageTransitionFrame({
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
