type InquiryIntroStageRecordItem = {
  type: "mainChoice" | "question" | "answer" | "selectedOptions" | "textInput";
  content: string | string[];
};

type InquiryIntroStageRecord = {
  records: InquiryIntroStageRecordItem[];
};

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

export function getIntroStageDisplay(
  introStage?: InquiryIntroStageRecord | null,
) {
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
