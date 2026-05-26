import { useCallback, type Dispatch, type SetStateAction } from "react";

export type InquiryIntroRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

export type InquiryIntroRecord = {
  records: InquiryIntroRecordItem[];
};

type SuspectGroup = {
  id: string;
  shortName: string;
};

type SetState<T> = Dispatch<SetStateAction<T>>;

type BuildInquiryIntroStageOptions<TPurpose extends string> = {
  purpose: TPurpose;
  currentInquiryOrder: number;
  currentCaseTitle: string;
  suspectGroups: SuspectGroup[];
  selectedSuspects: string[];
  task3Targets: string[];
  suspectReason: string;
  suspectOtherText: string;
  task3OtherText: string;
  possibleCrisis: string;
  otherPurpose: string;
};

export function buildInquiryIntroStage<TPurpose extends string>({
  purpose,
  currentInquiryOrder,
  currentCaseTitle,
  suspectGroups,
  selectedSuspects,
  task3Targets,
  suspectReason,
  suspectOtherText,
  task3OtherText,
  possibleCrisis,
  otherPurpose,
}: BuildInquiryIntroStageOptions<TPurpose>): InquiryIntroRecord {
  const safeOrder = Math.max(1, Number(currentInquiryOrder || 1));
  const selectedSuspectNames = selectedSuspects
    .map((groupId) => {
      if (groupId === "unknown") return "我不確定";
      if (groupId === "other") return suspectOtherText.trim() || "其他";
      return suspectGroups.find((group) => group.id === groupId)?.shortName;
    })
    .filter(Boolean) as string[];

  if (safeOrder === 1) {
    const hasIdea = purpose === "task1_yes";
    return {
      records: [
        { type: "mainChoice", content: "任務一：發現危機" },
        { type: "question", content: "請問你對於危機有想法嗎?" },
        { type: "answer", content: hasIdea ? "有，我有想法" : "沒有" },
        ...(hasIdea && possibleCrisis.trim()
          ? [
              { type: "question" as const, content: "請寫下你的想法" },
              { type: "textInput" as const, content: possibleCrisis.trim() },
            ]
          : []),
      ],
    };
  }

  if (safeOrder === 2) {
    return {
      records: [
        { type: "mainChoice", content: "任務二：鎖定嫌疑犯" },
        {
          type: "question",
          content: "請問你目前的這幾個對象裡面，你有懷疑的對象嗎？",
        },
        { type: "selectedOptions", content: selectedSuspectNames },
        ...(selectedSuspects.length > 0 &&
        !selectedSuspects.every((suspect) => suspect === "unknown") &&
        suspectReason.trim()
          ? [
              { type: "question" as const, content: "為什麼懷疑這些人？" },
              { type: "textInput" as const, content: suspectReason.trim() },
            ]
          : []),
      ],
    };
  }

  if (safeOrder === 3) {
    const labels = task3Targets
      .map((target) => {
        if (target === "crisis") return "危機";
        if (target === "suspect") return "兇手";
        if (target === "other") {
          return task3OtherText.trim()
            ? `其他：${task3OtherText.trim()}`
            : "其他";
        }
        return "";
      })
      .filter(Boolean);

    return {
      records: [
        { type: "mainChoice", content: "任務三：追查證據" },
        {
          type: "question",
          content: "追查證據任務開始，你想追查的證據是關於？",
        },
        { type: "selectedOptions", content: labels },
        ...(task3Targets.includes("other") && task3OtherText.trim()
          ? [
              {
                type: "question" as const,
                content: "請寫下你說的「其他」是什麼",
              },
              {
                type: "textInput" as const,
                content: `其他：${task3OtherText.trim()}`,
              },
            ]
          : []),
      ],
    };
  }

  if (safeOrder === 4) {
    const changed = purpose === "task4_yes";
    return {
      records: [
        { type: "mainChoice", content: "任務四：修正推論" },
        { type: "question", content: "經過這幾次的調查有沒有改變甚麼想法？" },
        { type: "answer", content: changed ? "有" : "沒有" },
        {
          type: "question",
          content: changed ? "你改變了甚麼想法?" : "所以你確定了甚麼事情?",
        },
        ...(otherPurpose.trim()
          ? [{ type: "textInput" as const, content: otherPurpose.trim() }]
          : []),
      ],
    };
  }

  if (safeOrder > 4) {
    return {
      records: [
        { type: "mainChoice", content: currentCaseTitle },
        { type: "question", content: "請問你這次探究的目的是什麼呢？" },
        ...(otherPurpose.trim()
          ? [{ type: "textInput" as const, content: otherPurpose.trim() }]
          : []),
      ],
    };
  }

  return { records: [] };
}

type UseInquiryIntroFlowOptions<TPurpose extends string, TSuspectAnswer extends string, TIntroStage> = {
  inquiryPurpose: TPurpose;
  currentInquiryOrder: number;
  currentCaseTitle: string;
  suspectGroups: SuspectGroup[];
  selectedSuspects: string[];
  task3Targets: string[];
  suspectReason: string;
  suspectOtherText: string;
  task3OtherText: string;
  possibleCrisis: string;
  otherPurpose: string;
  setSuspectAnswer: SetState<TSuspectAnswer>;
  setSelectedSuspects: SetState<string[]>;
  setTask3Targets: SetState<string[]>;
  setSuspectReason: SetState<string>;
  setSuspectOtherDraft: SetState<string>;
  setSuspectOtherText: SetState<string>;
  setTask3OtherDraft: SetState<string>;
  setTask3OtherText: SetState<string>;
  setPossibleCrisis: SetState<string>;
  setOtherPurpose: SetState<string>;
  setInquiryPurpose: SetState<TPurpose>;
  setIntroStage: SetState<TIntroStage | null>;
  setReadyMessage: SetState<string>;
  goInquiryStage: (stage: "purpose" | "followUp" | "ready" | "cards" | "summary", mode?: "push" | "replace") => void;
};

export function useInquiryIntroFlow<TPurpose extends string, TSuspectAnswer extends string, TIntroStage>({
  inquiryPurpose,
  currentInquiryOrder,
  currentCaseTitle,
  suspectGroups,
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
}: UseInquiryIntroFlowOptions<TPurpose, TSuspectAnswer, TIntroStage>) {
  const resetFollowUpAnswers = useCallback(() => {
    setSuspectAnswer("" as TSuspectAnswer);
    setSelectedSuspects([]);
    setTask3Targets([]);
    setSuspectReason("");
    setSuspectOtherDraft("");
    setSuspectOtherText("");
    setTask3OtherDraft("");
    setTask3OtherText("");
    setPossibleCrisis("");
    setOtherPurpose("");
  }, [
    setOtherPurpose,
    setPossibleCrisis,
    setSelectedSuspects,
    setSuspectAnswer,
    setSuspectOtherDraft,
    setSuspectOtherText,
    setSuspectReason,
    setTask3OtherDraft,
    setTask3OtherText,
    setTask3Targets,
  ]);

  const toggleSelectedSuspect = useCallback(
    (groupId: string) => {
      setSelectedSuspects((prev) => {
        if (groupId === "unknown") {
          if (prev.includes("unknown")) return [];
          setSuspectReason("");
          setSuspectOtherDraft("");
          setSuspectOtherText("");
          return ["unknown"];
        }

        const base = prev.filter((id) => id !== "unknown");
        const next = base.includes(groupId)
          ? base.filter((id) => id !== groupId)
          : [...base, groupId];

        if (!next.includes("other")) {
          setSuspectOtherDraft("");
          setSuspectOtherText("");
        }
        if (next.length === 0) setSuspectReason("");
        return next;
      });
    },
    [
      setSelectedSuspects,
      setSuspectOtherDraft,
      setSuspectOtherText,
      setSuspectReason,
    ],
  );

  const toggleTask3Target = useCallback(
    (targetId: string) => {
      setTask3Targets((prev) => {
        const next = prev.includes(targetId)
          ? prev.filter((id) => id !== targetId)
          : [...prev, targetId];

        if (!next.includes("other")) {
          setOtherPurpose("");
          setTask3OtherDraft("");
          setTask3OtherText("");
        }
        if (next.includes("crisis")) setInquiryPurpose("task3_crisis" as TPurpose);
        else if (next.includes("suspect")) setInquiryPurpose("task3_suspect" as TPurpose);
        else if (next.includes("other")) setInquiryPurpose("task3_other" as TPurpose);
        else setInquiryPurpose("" as TPurpose);
        return next;
      });
    },
    [
      setInquiryPurpose,
      setOtherPurpose,
      setTask3OtherDraft,
      setTask3OtherText,
      setTask3Targets,
    ],
  );

  const finishInquiryIntro = useCallback(
    (message: string, purposeOverride = inquiryPurpose) => {
      const nextIntroStage = buildInquiryIntroStage({
        purpose: purposeOverride,
        currentInquiryOrder,
        currentCaseTitle,
        suspectGroups,
        selectedSuspects,
        task3Targets,
        suspectReason,
        suspectOtherText,
        task3OtherText,
        possibleCrisis,
        otherPurpose,
      }) as TIntroStage;

      setIntroStage(nextIntroStage);
      setReadyMessage(message);
      goInquiryStage("ready");
    },
    [
      currentCaseTitle,
      currentInquiryOrder,
      goInquiryStage,
      inquiryPurpose,
      otherPurpose,
      possibleCrisis,
      selectedSuspects,
      setIntroStage,
      setReadyMessage,
      suspectGroups,
      suspectOtherText,
      suspectReason,
      task3OtherText,
      task3Targets,
    ],
  );

  return {
    finishInquiryIntro,
    resetFollowUpAnswers,
    toggleSelectedSuspect,
    toggleTask3Target,
  };
}
