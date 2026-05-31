/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一前導案例資料，定義每一回合對應的探究背景與問題。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

export type InquiryIntroCase = {
  id: string;
  title: string;
  storyTitle: string;
  storyParagraphs: string[];
  prompt: string;
  readyNoticeTitle: string;
  readyNoticeParagraphs: string[];
  conclusionPrompt: string;
};

const INVESTIGATION_CASE_FLOW: InquiryIntroCase[] = [
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
    id: "trace_evidence",
    title: "任務二：追查證據",
    storyTitle: "不能只靠懷疑",
    storyParagraphs: [
      "歷經了第一輪的調查，危機已經慢慢浮現",
      "接下來，如果要讓別人相信你的判斷，你需要找到更多、更清楚的證據",
      "在開始調查前，請先決定：你這次最想追查甚麼？",
    ],
    prompt: "任務即將開始，你有想要先說的想法嗎？",
    readyNoticeTitle: "追查證據前，請記得",
    readyNoticeParagraphs: [
      "每一個資料數據不一定能成為好證據。",
      "好的證據須具備一些論述跟見解，你可以問問自己",
      "這張資料能證明什麼？它跟我的判斷有連起來嗎？",
      "請用清楚的理由，把零散線索變成有說服力的證據。",
    ],
    conclusionPrompt:
      "請說明你追查到哪些證據，這些證據如何支持或挑戰你的想法。",
  },
  {
    id: "lock_suspect",
    title: "任務三：鎖定嫌疑犯",
    storyTitle: "誰讓危機發生？",
    storyParagraphs: [
      "你已經發現一些石虎可能遇到的危機",
      "但接下來要用這些證據找到真正的犯人",
      "請你想想這些危機可能是誰造成的？",
      "道路、開發、人類活動、傳言或其他因素，都有可能成為調查方向",
      "開始調查前，我要問你的是：目前有沒有懷疑的對象？",
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

export function getInvestigationCaseByOrder(
  order?: number | null,
): InquiryIntroCase {
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
