import { useCallback, useEffect, useRef } from "react";

type HistoryMode = "push" | "replace";

type UseInquiryHistoryNavigationOptions<TFlowStage extends string> = {
  cardsStage: TFlowStage;
  flowStage: TFlowStage;
  isFinished: boolean;
  setFlowStage: (stage: TFlowStage) => void;
  setIsFinished: (isFinished: boolean) => void;
  setShowFinishConfirm: (isOpen: boolean) => void;
  setShowSubmitConfirm: (isOpen: boolean) => void;
};

export function useInquiryHistoryNavigation<TFlowStage extends string>({
  cardsStage,
  flowStage,
  isFinished,
  setFlowStage,
  setIsFinished,
  setShowFinishConfirm,
  setShowSubmitConfirm,
}: UseInquiryHistoryNavigationOptions<TFlowStage>) {
  type InquiryHistoryStage = TFlowStage | "summary";
  const hasInitializedInquiryHistoryRef = useRef(false);

  const applyInquiryStage = useCallback(
    (stage: InquiryHistoryStage) => {
      setShowFinishConfirm(false);
      setShowSubmitConfirm(false);

      if (stage === "summary") {
        setFlowStage(cardsStage);
        setIsFinished(true);
        return;
      }

      setIsFinished(false);
      setFlowStage(stage);
    },
    [
      cardsStage,
      setFlowStage,
      setIsFinished,
      setShowFinishConfirm,
      setShowSubmitConfirm,
    ],
  );

  const writeInquiryHistory = useCallback(
    (stage: InquiryHistoryStage, mode: HistoryMode = "push") => {
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
    (stage: InquiryHistoryStage, mode: HistoryMode = "push") => {
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

  return { goInquiryStage } as const;
}
