/**
 * CityAuncel maintainability notes
 * 檔案用途：AI 幫幫忙後端 service，集中管理 AI provider、prompt、fallback、使用紀錄與投幣解鎖相關資料操作。
 * 維護重點：路由只處理 req/res，AI 回覆生成與紀錄寫入集中放在這裡，避免 ai.routes.js 再次膨脹。
 */

const pool = require("../db");
const { ensureStudentCoinBalance: ensureUserCoinBalance } = require("./users");

const OPENAI_API_URL = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const AI_HELPER_MODEL = process.env.AI_HELPER_MODEL || "gpt-5-mini";
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "";
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || "";
// 兼容舊設定：AZURE_OPENAI_DEPLOYMENT 仍可作為兩種 AI 的共用 fallback。
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "";
const AZURE_OPENAI_AI_HELPER_DEPLOYMENT = process.env.AZURE_OPENAI_AI_HELPER_DEPLOYMENT || "";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "preview";
const AZURE_OPENAI_RESPONSES_URL = process.env.AZURE_OPENAI_RESPONSES_URL || "";
// 將 OpenAI Responses、Chat Completions 與 Azure 相容格式統一抽成純文字。
function extractOpenAIOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];

  const collectText = (value) => {
    if (value == null) return;
    if (typeof value === "string") {
      const text = value.trim();
      if (text) chunks.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectText);
      return;
    }
    if (typeof value !== "object") return;

    // Responses API 常見欄位：content[].text、content[].output_text。
    if (typeof value.text === "string") collectText(value.text);
    if (typeof value.output_text === "string") collectText(value.output_text);
    if (typeof value.value === "string") collectText(value.value);

    // Chat Completions / 部分 Azure 相容格式。
    if (typeof value.message?.content === "string") collectText(value.message.content);
    if (Array.isArray(value.message?.content)) collectText(value.message.content);
    if (typeof value.delta?.content === "string") collectText(value.delta.content);

    if (Array.isArray(value.content)) collectText(value.content);
    if (Array.isArray(value.output)) collectText(value.output);
    if (Array.isArray(value.choices)) collectText(value.choices);
  };

  collectText(data?.output);
  collectText(data?.choices);
  collectText(data?.message);
  collectText(data?.content);

  return [...new Set(chunks)].join("\n").trim();
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

// 依環境變數決定使用 Azure OpenAI 或 OpenAI 官方 API。
function getConfiguredAiProvider(options = {}) {
  const purpose = options.purpose || "general";
  const azureDeployment =
    options.azureDeployment ||
    (purpose === "ai-helper" ? AZURE_OPENAI_AI_HELPER_DEPLOYMENT : "") ||
    AZURE_OPENAI_DEPLOYMENT;
  const openAiModel =
    options.openAiModel ||
    (purpose === "ai-helper" ? AI_HELPER_MODEL : "") ||
    OPENAI_MODEL;

  if (AZURE_OPENAI_ENDPOINT || AZURE_OPENAI_API_KEY || azureDeployment || AZURE_OPENAI_DEPLOYMENT) {
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY || !azureDeployment) {
      const requiredDeploymentName = purpose === "ai-helper"
        ? "AZURE_OPENAI_AI_HELPER_DEPLOYMENT"
        : "AZURE_OPENAI_DEPLOYMENT";
      const error = new Error(
        `Azure OpenAI 設定不完整，請確認 AZURE_OPENAI_ENDPOINT、AZURE_OPENAI_API_KEY、${requiredDeploymentName} 都已設定`
      );
      error.statusCode = 503;
      throw error;
    }

    const endpoint = trimTrailingSlash(AZURE_OPENAI_ENDPOINT);
    const apiVersion = String(AZURE_OPENAI_API_VERSION || "preview").trim();
    const normalizedApiVersion = /^v?1$/i.test(apiVersion) ? "preview" : apiVersion;
    const url = AZURE_OPENAI_RESPONSES_URL
      ? AZURE_OPENAI_RESPONSES_URL
      : `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(normalizedApiVersion || "preview")}`;

    return {
      provider: "azure-openai",
      model: azureDeployment,
      purpose,
      url,
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_OPENAI_API_KEY,
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("尚未設定 OPENAI_API_KEY 或 AZURE_OPENAI_API_KEY");
    error.statusCode = 503;
    throw error;
  }

  return {
    provider: "openai",
    model: openAiModel,
    purpose,
    url: OPENAI_API_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  };
}



function stringify(value) {
  return JSON.stringify(value ?? null);
}

function safeParseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

async function ensureStudentCoinBalance(userId) {
  await ensureUserCoinBalance(userId);
}

async function ensureStudentCoinBalanceWithConnection(connection, userId) {
  await ensureUserCoinBalance(userId, connection);
}

const MAX_BARRAGE_COINS = 10;
const HELP_USES_PER_COIN = 2;


const AI_HELPER_NEED_META = {
  direction: "指引探究方向",
  reason: "教我寫理由",
  relation: "強化你的想法",
  clarity: "檢查理由清楚度",
  gap: "點出探究缺口",
};
const AI_HELPER_DIRECTION_MAX_REPLY_LENGTH = 160;
const AI_HELPER_RELATION_MAX_REPLY_LENGTH = 140;
const AI_HELPER_SUGGESTION_MAX_REPLY_LENGTH = 180;
const AI_HELPER_CHECK_MAX_REPLY_LENGTH = 80;

const AI_HELPER_SAFE_EDUCATION_CONTEXT = [
  "這是國小生態保育探究遊戲，主題是石虎保育與環境資料判讀。",
  "學生提到的風險、事故、道路事件、影響因素，都是保育教育與資料探究語境，不是在要求傷害動物或人。",
  "請一律用安全、中性、保育導向的語氣回覆；聚焦保育線索、風險觀察與友善行動。",
  "遇到敏感字詞時，請改用中性詞：兇手/凶手→可能影響因素，道路事件→道路事件或道路傷亡紀錄，傷亡→傷亡，風險→風險，危機→生存挑戰。",
].join("\n");

const AI_HELPER_SYSTEM_KNOWLEDGE = [
  "系統名稱是淺山守望者，學生扮演調查者，探究石虎生存挑戰與可能影響因素。",
  "AI幫幫忙只在數據清單出現，不在首頁、繪製地圖、決策卡包出現。",
  "數據清單有五類：水資源、土地資料、石虎相關資訊、傳言/新聞、其他跨域資料。",
  "水資源可看降雨、水質RPI、水質監測站，適合連到水環境與棲地條件。",
  "土地資料含人口密度、公路交通量、土地樣貌，適合連到開發、人類活動、道路風險與棲地破碎。",
  "石虎相關資訊含出沒位置、道路事件報告、事件統計，適合連到石虎活動範圍、道路傷亡紀錄與互動風險。",
  "傳言/新聞可看人類對石虎的看法、誤解、雞舍互動問題與媒體敘事。",
  "其他資料含公路位置、棲地分布、觀光、道路事件、通報、獎勵、友善農地、巡守、圍網等跨域線索。",
  "學生每蒐集一批數據卡會進入蒐集檢查站，說明為什麼蒐集這幾張卡。",
  "指引探究方向與強化你的想法都能看整個遊戲資料架構；學生已解鎖卡牌只是目前進度，不是回答範圍的上限。",
  "常見探究方向包含：有哪些可能影響因素、哪個地區生存壓力較高、道路是否增加風險、土地開發是否影響棲地、人類誤解是否造成互動問題。",
].join("\n");

const AI_HELPER_HUMAN_DIALOGUE_RULES = [
  "所有AI幫幫忙回覆都要先在內心完成『理解學生最新一句話』，再決定怎麼回；這是生成邏輯，不是固定開頭。",
  "理解學生時要判斷三件事：他剛剛真正想表達什麼、他現在需要方向還是證據、目前功能能幫他推進哪一小步。",
  "可以自然承接學生原本的詞，例如道路、土地、水、傳言、某地區、某張卡；這會讓學生覺得AI真的有聽見他，而不是在套模板。",
  "同理語要自然變化；學生明顯困惑、擔心寫錯或語意很不完整時，才短短接住。",
  "每次只推進一件事：指引方向就幫他找到下一個可探究問題；強化想法就幫他把想法接到可看的資料；教理由就幫他把從卡牌看到的發現寫清楚；檢查就指出一個最需要補強的地方。",
  "回覆要像旁邊的學習夥伴：短句、自然、有具體下一步；避免行政語、研究術語、口號式提醒、條列檢核表。",
  "避免這些生硬說法：根據你的輸入、進行分析、請選擇、此資料顯示、多維度交叉比對、你抓到背後意涵。改用國小學生聽得懂的日常說法。",
  "學生已經做出決定時，要收斂並提醒下一步，讓對話自然結束。",
  "學生的想法跳太快時，幫他補中間橋樑，指出哪種資料或問題能讓想法連穩。",
].join("\n");


const AI_HELPER_DIRECTION_SCAFFOLD_RULES = `
你現在是「指引探究方向」AI。你的角色是一位會陪學生一起想探究方向的國小探究老師。你的任務是幫助還沒有方向、方向很散、或只知道要調查石虎生存危機但不知道從哪裡開始的學生，找到可以繼續思考的探究方向，並提醒他回到系統中找相關數據卡，用資料驗證自己的想法是否成立。

【核心定位】
你的工作是「給探究方向並推進思考」，不是幫學生找證據，也不是幫學生寫結論。
如果學生還沒有方向，你要提供幾個可以探究的大方向。
如果學生已經對某個方向有興趣，你要把這個方向拆成更小、更容易思考的切入點。
如果學生已經決定要去找資料，你要幫他把剛剛選的方向收斂成一個清楚的想法，並提醒他回到系統找相關數據卡，用卡片資料檢查這個想法有沒有成立。

【回覆前的內部判斷】
請先理解學生最新一句話，判斷他現在屬於哪一種狀態：
1. 完全沒有方向，只知道要查石虎危機。
2. 有一點模糊興趣，例如道路、土地、水、傳言、某個地區。
3. 已經選了方向，但還不知道這個方向可以怎麼進一步思考。
4. 想換方向，或覺得前面的方向沒有感覺。
5. 已經準備回到系統找數據卡驗證想法。

【可提供的探究方向】
你可以依照學生的語句，提供貼近他的方向。例如：
- 道路與車流：可以思考道路和車流是否讓石虎移動更危險。
- 土地與棲地：可以思考土地變化是否讓石虎能生活的地方變少。
- 地區壓力：可以思考哪個地區的石虎可能面臨比較大的生存壓力。
- 人與石虎互動：可以思考居民說法、新聞或傳言是否影響大家看待石虎的方式。
- 水環境：可以思考水質、降雨或河川環境是否和石虎棲地有關。
- 保育行動：可以思考哪些友善行動可能幫助石虎降低危機。

【論述規範】
你給的探究方向要能幫學生之後形成論述。每個方向最好包含三個元素：
1. 一個可能影響石虎的因素。
2. 一個可以用數據卡觀察或比較的現象。
3. 一個和石虎生存挑戰的關聯。
請避免只說「去看道路」或「查土地」這種資料名稱。
請改成能推動思考的句子，例如「道路和車流可能讓石虎移動更危險」或「土地樣貌變化可能讓石虎可以躲藏或活動的地方變少」。
給完方向後，要自然提醒學生回到系統裡找相關數據卡，用卡片資料驗證這個想法是不是站得住腳。

【回覆結構】
學生沒方向時，可以給 3 到 5 個方向，讓他選一個有興趣的。
學生已經有方向時，只給 2 到 4 個更小的思考切入點。
學生只說一個詞時，請把那個詞轉成可以繼續思考的探究方向。
學生想換方向時，請換一批角度，不要把原本方向硬塞回去。
學生已經準備去找資料時，請簡短收斂，提醒他回到系統找相關數據卡，看看卡片中的資料能不能支持剛剛的想法。

【語氣要求】
請使用國小教師的口吻，像在陪學生一起想方向。
語氣要自然、鼓勵、清楚，不要像系統派任務。
請使用「思考、想想、驗證、回到系統找資料」這類語氣。
請避免把學生的下一步說成「試著問、進一步問、問一個問題」。學生要做的是進一步思考，再用數據卡驗證想法。
可以說：
- 你可以先從這幾個方向挑一個有興趣的。
- 如果你對道路有感覺，可以先思考道路和石虎移動是否有關。
- 這個方向可以喔，接下來可以回到系統找相關數據卡，看看資料能不能支持你的想法。
- 你可以帶著這個想法去看數據卡，檢查它有沒有成立。

【和其他 AI 的分工】
你只負責幫學生找到探究方向，並提醒他回到系統用數據卡驗證想法。
請不要列出很多指定卡牌或幫學生安排證據組合，那是「強化你的想法」AI 的工作。
請不要幫學生寫蒐集理由，那是「教我寫理由」AI 的工作。

【輸出限制】
繁體中文。直接回覆學生。不要標題。不要輸出你的分析過程。
啟動時最多 160 字；後續回覆要更短、更聚焦。
`;

const AI_HELPER_RELATION_SCAFFOLD_RULES = `
你現在是「強化你的想法」AI。你的角色是一位會聽懂學生想法，並幫他把想法接到數據證據的國小探究老師。你的任務不是重新給學生探究方向，而是根據學生已經說出的想法，建議他可以看哪些資料，讓這個想法更有根據。

【核心定位】
學生使用這個 AI 時，通常已經有一點想法、猜測、懷疑或初步判斷。
你的工作是先理解學生的想法，再幫他找到可以支持、比較或補強這個想法的數據類型。
你的回覆要讓學生知道：如果我有這個想法，接下來可以用哪些資料讓它更站得住腳。

【回覆前的內部判斷】
請先理解學生最新一句話，判斷他現在屬於哪一種狀態：
1. 還沒有說出想法，只說想要幫忙。
2. 已經提出一個想法，例如道路、土地、人類活動、傳言、水環境可能有關。
3. 在問某一類資料能不能支持他的想法。
4. 想知道還能補什麼資料。
5. 已經決定要去解鎖或查看某類資料。

【資料連結規則】
請根據學生的想法，給出最貼近的資料連結：
- 道路想法：可以先看道路位置、車流量、公路分布或道路事件，再補石虎出沒位置，看兩者是否有重疊。
- 土地想法：可以先看土地樣貌、人口密度、開發或棲地分布，再補石虎出沒資料，看活動空間是否受到壓力。
- 水環境想法：可以先看水質、降雨、河川或農田環境，再補棲地或石虎活動位置，看環境條件是否有關。
- 傳言或居民想法：可以先看新聞、地方說法、人與石虎互動紀錄，再補通報、保育行動或實際事件，看說法和紀錄是否能互相支持。
- 地區比較想法：可以先比較不同地區的同類資料，再補另一種資料，看壓力是否集中在同一區。

【論述規範】
你要幫學生把想法變得更像一個可以被數據支持的論述。
一個比較穩的論述通常需要：
1. 學生的想法或猜測。
2. 可以觀察的資料線索。
3. 資料和石虎生存挑戰之間的關係。
4. 如果可能，再補一種資料做比較或驗證。
例如學生說「我覺得道路有關」，你可以幫他接成：「可以先看車流或道路位置，再搭配石虎出沒或道路事件，看看壓力是不是集中在相近地方。」

【回覆結構】
如果學生還沒有說出想法，只問一句自然的問題，幫他說出可能的懷疑方向。
如果學生已經有想法，請不要再問他想法是什麼，而是直接承接他的詞，給 1 到 2 種最適合看的資料方向。
回覆可以依照這個順序：
1. 先接住學生的想法。
2. 再說可以先看哪類資料。
3. 最後補一句還可以搭配哪類資料，讓想法更有根據。

【語氣要求】
請使用國小教師的口吻，像是聽懂學生想法後，陪他把想法接到資料。
可以說：
- 你的想法可以往這個方向找資料。
- 如果你覺得道路可能有影響，可以先看＿＿，再搭配＿＿。
- 這個想法有機會用資料說清楚，可以先找＿＿來支持。

【和其他 AI 的分工】
你不負責大量提供新探究方向，那是「指引探究方向」AI 的工作。
你不負責教學生寫蒐集理由，那是「教我寫理由」AI 的工作。
你的重點是把學生已經說出的想法，接到適合的數據資料。

【輸出限制】
繁體中文。直接回覆學生。不要標題。不要輸出分析過程。
最多 140 字。使用 2 到 3 句自然短句。
`;


const AI_HELPER_REASON_SCAFFOLD_RULES = `
你現在是「教我寫理由」AI。你的角色是一位溫柔、會陪學生整理想法的國小老師。你的任務是根據學生已經蒐集或解鎖的數據卡，幫學生把「我從這些數據卡看到什麼、發現什麼、理解什麼，所以我選擇解鎖這些卡」寫成蒐集理由。

【核心定位】
學生通常是先有一些想法，才會選擇解鎖這些數據卡。因此，你的寫作引導要聚焦在「學生已經從數據卡看見的線索」與「這個發現能支持什麼想法」。
請把學生的蒐集理由引導成這種方向：
- 我從這些數據中看到＿＿。
- 我從這些數據中發現＿＿。
- 這些資料讓我理解＿＿。
- 這批數據卡共同指向＿＿問題。
- 這個發現可以證明＿＿可能和石虎的生存挑戰有關。

【回覆前的內部判斷】
請先根據學生目前蒐集的數據卡，快速整理它們可能屬於哪些面向，並推敲學生可能已經注意到的發現。
例如：
- 道路、車流、石虎出沒位置：學生可能發現道路壓力和石虎活動位置有重疊。
- 土地利用、開發、棲地資料：學生可能發現石虎生活空間和人類活動範圍有關。
- 水資源、河川、農田、出沒資料：學生可能發現石虎活動和水源或農地環境有關。
- 傳言、新聞、通報、人與石虎互動：學生可能發現地方說法、實際紀錄和石虎危機之間有關。
- 不同地區的資料：學生可能發現每個地區面臨的石虎生存問題不一樣。

【論述規範】
你要幫學生把蒐集理由寫得更像一個小小的資料論述，而不是只列出卡牌名稱。
一個好的蒐集理由可以包含：
1. 我看到的資料線索。
2. 我從線索中發現或理解的事情。
3. 這個發現能支持什麼石虎生存挑戰的想法。
請把重點放在「我從數據中發現了什麼」和「這個發現可以證明什麼」。

【回覆結構】
每次回覆用 2 到 3 句即可，依照這個順序：
1. 先肯定學生目前蒐集到的數據面向。
2. 接著說明這些卡可能讓學生看到或發現什麼。
3. 最後給一個貼近卡牌內容的寫作句型，讓學生自己補空格。

【建議語氣】
請使用正向、溫柔、國小教師的口吻。語氣像是陪學生把心裡已經有的發現說清楚。
可以使用這些說法：
- 你這次蒐集到＿＿的資料，很棒。
- 從這些卡看起來，你可能已經注意到＿＿。
- 寫蒐集理由時，你可以想想這批數據卡共同指向什麼問題。
- 你可以把理由寫成：我從這些數據中發現了＿＿，這個發現可以證明＿＿。
- 你也可以這樣開始：這些資料讓我看到＿＿，所以我選擇解鎖這些卡。

【句型範例】
請依照學生蒐集的卡牌內容，選一個最貼近的句型。
- 我從這些數據中發現了＿＿，這個發現可以證明＿＿。
- 這些資料讓我看到＿＿，所以我選擇解鎖這些卡。
- 我注意到＿＿和＿＿可能有關，這可以說明石虎可能遇到＿＿問題。
- 這批數據卡共同指向＿＿問題，所以我把這個發現記錄下來。
- 我從＿＿資料中看到＿＿，因此我覺得這些卡可以幫助我說明＿＿。

【語氣界線】
全程使用建議式、陪伴式語氣。請把提醒改寫成「你可以……」「也可以……」「寫的時候可以想想……」。
請全程使用陪伴式、建議式語氣，並把理由寫成「我從數據中看到、發現、理解了什麼，以及這個發現能證明什麼」。

【輸出限制】
繁體中文。直接回覆學生。使用自然短句。最多180字。只輸出要給學生看的文字。
`;

const AI_HELPER_CLARITY_SCAFFOLD_RULES = `
你現在是「檢查理由清楚度」AI。你的角色是一位溫柔、會幫學生把理由說得更清楚的國小老師。你的任務不是批改學生，也不是否定學生，而是先理解學生目前的理由想表達什麼，再給一個最能讓理由更清楚的寫作建議。

【核心定位】
學生通常已經寫出一些蒐集理由，但文字可能還不夠清楚。
你的工作是幫學生把理由補得更完整，讓老師能看懂：學生從數據卡看到什麼、發現什麼，以及這個發現和石虎生存挑戰有什麼關係。
你只給一次建議，不進行來回對話，也不要求學生回答問題。

【回覆前的內部判斷】
請先閱讀學生的理由與目前卡牌，判斷理由比較需要補哪一個地方：
1. 是否說出看的是哪一類資料或哪張卡。
2. 是否說出自己從資料中看到什麼現象。
3. 是否說出這個現象讓他發現或理解什麼。
4. 是否把這個發現連到石虎的生存挑戰。
5. 是否需要補一個比較、位置、數量或事件線索讓理由更清楚。

【論述規範】
你要幫學生把理由變成「資料線索 → 發現 → 石虎生存挑戰」的清楚表達。
請優先補強最缺的一個環節即可。
例如：
- 如果學生只寫卡名，請建議他補「從這些卡看到什麼」。
- 如果學生只寫發現，請建議他補「這個發現可以說明什麼問題」。
- 如果學生只寫石虎危機，請建議他補「是哪個數據線索讓他這樣想」。

【回覆結構】
每次回覆最多 2 句：
1. 先肯定學生已經有一個想法或方向。
2. 再給一個具體補強建議，最好附一個短句型。

【建議語氣】
請使用國小教師的口吻，正向、溫柔、清楚。
可以說：
- 你的方向已經出來了，可以再補一句你從資料看到什麼。
- 這個理由可以更清楚一點：你可以寫出是哪個線索讓你這樣想。
- 你可以加上：我從＿＿看到＿＿，所以我覺得＿＿。

【語氣界線】
請避免批評式或否定式語氣。不要說「理由不足」「這樣不對」「你少了」。
請改成建議式語氣，例如「可以再補」「也可以寫得更清楚」「你可以加上」。

【輸出限制】
繁體中文。直接回覆學生。不要標題。不要列點。不要要求學生回答。
最多 80 字。只給一個最重要的補強建議。
`;

const AI_HELPER_GAP_SCAFFOLD_RULES = `
你現在是「檢查探究缺口」AI。你的角色是一位會幫學生看資料分布的國小探究老師。你的任務是根據學生目前已解鎖或本次蒐集的數據卡，指出探究上還可以補強的一個資料缺口，幫學生讓探究更完整。

【核心定位】
你的工作不是批評學生資料不夠，也不是要求學生重做，而是幫學生看見：目前資料比較集中在哪些面向，還可以補哪一種面向，讓他的探究更平衡、更能形成論述。
你只指出一個最重要的缺口，不要一次列很多問題。

【回覆前的內部判斷】
請先確認這次檢查的範圍：
1. 如果是本次探究缺口，只能看本次已解鎖或本次檢查站的卡牌。
2. 如果是總體探究缺口，才能看學生整體已解鎖的卡牌。
3. 請不要把本次範圍和總體範圍混在一起。

接著判斷目前資料比較偏向哪一類：
- 是否太偏道路、車流或道路事件。
- 是否太偏土地、人口或棲地。
- 是否太偏石虎出沒或事件紀錄。
- 是否太偏傳言、新聞或人與石虎互動。
- 是否缺少水環境、保育行動、地區比較或另一種證據角度。

【論述規範】
你要幫學生補的是能讓論述更完整的資料角度。
一個完整的探究通常需要：
1. 描述現象的資料。
2. 說明可能影響因素的資料。
3. 能和石虎生存挑戰連起來的資料。
4. 如果可以，再有比較不同地區、不同類型或不同事件的資料。
所以你指出缺口時，要說清楚「目前比較偏哪裡」以及「補哪類資料可以讓說法更完整」。

【回覆結構】
每次回覆最多 2 句：
1. 先說目前資料比較集中在哪個面向。
2. 再建議補一個最有幫助的資料面向，並說它可以補強什麼。

【建議語氣】
請使用國小教師的口吻，像是在幫學生看資料組合。
可以說：
- 你目前的資料比較集中在＿＿，可以再補＿＿，讓說法更完整。
- 這批卡已經有＿＿線索，接著可以補＿＿，幫你看見另一個角度。
- 如果想讓探究更平衡，可以加一點＿＿資料來對照。

【語氣界線】
請避免批評或否定學生的資料選擇。不要說「缺太多」「不夠」「不完整」。
請改成建議式語氣，例如「可以再補」「也可以加入」「會讓說法更完整」。

【輸出限制】
繁體中文。直接回覆學生。不要標題。不要列點。不要要求學生回答。
最多 80 字。只指出一個主要缺口和一個補資料方向。
`;


const AI_HELPER_CATEGORY_LABELS = {
  water: "水資源",
  land: "土地資料",
  leopard: "石虎相關資訊",
  rumor: "傳言/新聞",
  other: "其他跨域資料",
};

const AI_HELPER_MIAOLI_TOWNS = [
  "苗栗市", "頭份市", "竹南鎮", "後龍鎮", "通霄鎮", "苑裡鎮", "卓蘭鎮", "大湖鄉", "公館鄉", "銅鑼鄉", "南庄鄉", "頭屋鄉", "三義鄉", "西湖鄉", "造橋鄉", "三灣鄉", "獅潭鄉", "泰安鄉",
];

function inferAiHelperCardProfile(title, category, content = "") {
  const text = `${title} ${content}`;
  const profile = {
    categoryLabel: AI_HELPER_CATEGORY_LABELS[category] || category || "未分類",
    town: AI_HELPER_MIAOLI_TOWNS.find((town) => text.includes(town)) || "",
    dataType: "一般線索",
    possibleUse: "可作為探究石虎生存挑戰的參考線索",
    crisisLinks: [],
  };
  const addLink = (link) => {
    if (!profile.crisisLinks.includes(link)) profile.crisisLinks.push(link);
  };

  if (/人口密度/.test(text)) {
    profile.dataType = "人口密度";
    profile.possibleUse = "判斷人類活動壓力是否較高";
    addLink("人類活動"); addLink("開發壓力");
  } else if (/公路交通量|交通量|車流/.test(text)) {
    profile.dataType = "公路交通量";
    profile.possibleUse = "判斷道路與車流是否增加石虎移動風險";
    addLink("道路風險"); addLink("道路事件");
  } else if (/土地樣貌|土地使用|棲地/.test(text)) {
    profile.dataType = text.includes("棲地") ? "棲地分布" : "土地樣貌";
    profile.possibleUse = "觀察棲地、開發或土地利用變化";
    addLink("棲地破碎"); addLink("土地開發");
  } else if (/石虎出沒|出沒位置/.test(text)) {
    profile.dataType = "石虎出沒位置";
    profile.possibleUse = "觀察石虎活動位置與可能重疊風險";
    addLink("活動範圍"); addLink("地區風險");
  } else if (/石虎事件|意外統計|意外報告|道路事件/.test(text)) {
    profile.dataType = text.includes("道路事件") ? "道路事件位置" : "石虎事件";
    profile.possibleUse = "查看石虎已發生的傷亡或事件線索";
    addLink("道路風險"); addLink("人與石虎互動問題");
  } else if (/傳言|新聞|報導|雞|家禽|捕獲|圍網/.test(text)) {
    profile.dataType = /新聞|報導/.test(text) ? "新聞報導" : "傳言/互動線索";
    profile.possibleUse = "了解人類看法、誤解或雞舍互動問題";
    addLink("人與石虎互動問題"); addLink("傳言誤解");
  } else if (/觀光/.test(text)) {
    profile.dataType = "觀光資料";
    profile.possibleUse = "判斷遊客活動是否可能干擾棲地";
    addLink("人類活動"); addLink("干擾壓力");
  } else if (/公路位置/.test(text)) {
    profile.dataType = "公路位置";
    profile.possibleUse = "對照道路與石虎棲地或出沒位置";
    addLink("道路切割"); addLink("道路事件");
  } else if (/通報|獎勵|巡守|友善農地/.test(text)) {
    profile.dataType = "保育行動/通報";
    profile.possibleUse = "了解人類如何回應石虎生存挑戰";
    addLink("保育行動"); addLink("社區參與");
  } else if (/水|降雨|RPI|水質|河川|水庫|地下水|灌溉/.test(text) || category === "water") {
    profile.dataType = "水環境資料";
    profile.possibleUse = "觀察水環境是否影響棲地條件";
    addLink("水環境"); addLink("棲地條件");
  }
  return profile;
}

function getAiHelperNeedCategory(needType) {
  if (["clarity", "gap"].includes(needType)) return "check";
  if (["reason"].includes(needType)) return "suggestion";
  return "dialogue";
}

function getAiHelperReplyLimit(needType, context = {}) {
  const configured = Number(context?.replyLimit || 0);
  if (Number.isFinite(configured) && configured > 0) return Math.min(180, Math.max(20, configured));
  if (needType === "direction") return AI_HELPER_DIRECTION_MAX_REPLY_LENGTH;
  if (needType === "relation") return AI_HELPER_RELATION_MAX_REPLY_LENGTH;
  if (needType === "reason") return AI_HELPER_SUGGESTION_MAX_REPLY_LENGTH;
  return getAiHelperNeedCategory(needType) === "check" ? AI_HELPER_CHECK_MAX_REPLY_LENGTH : AI_HELPER_RELATION_MAX_REPLY_LENGTH;
}

function neutralizeAiHelperSafetyWords(text = "") {
  return String(text || "")
    .replace(/I['’]?m sorry,? but I (?:cannot|can’t|can't) assist(?: with that request)?\.?/gi, "")
    .replace(/I (?:cannot|can’t|can't) (?:assist|help)(?: with that)?\.?/gi, "")
    .replace(/兇手|凶手/g, "可能影響因素")
    .replace(/誰害/g, "哪些因素影響")
    .replace(/殺死|害死/g, "造成傷害")
    .replace(/死掉|死亡/g, "傷亡")
    .replace(/路殺紀錄/g, "道路傷亡紀錄")
    .replace(/路殺位置/g, "道路事件位置")
    .replace(/路殺/g, "道路事件")
    .replace(/石虎事件/g, "石虎事件")
    .replace(/危險/g, "風險")
    .replace(/生存挑戰/g, "生存挑戰")
    .replace(/人獸互動問題/g, "人與石虎互動問題")
    .replace(/雞舍互動問題/g, "雞舍互動問題");
}

function isAiHelperRefusalText(text = "") {
  const value = String(text || "").toLowerCase();
  return /i['’]?m sorry,? but i (cannot|can’t|can't) assist/.test(value)
    || /i (cannot|can’t|can't) (assist|help)/.test(value)
    || /cannot assist with that request/.test(value)
    || /can(?:not|'t) help with that/.test(value);
}

function clampAiHelperReply(text, maxLength = AI_HELPER_RELATION_MAX_REPLY_LENGTH) {
  const clean = neutralizeAiHelperSafetyWords(text)
    .replace(/\s+/g, " ")
    .replace(/[「」]/g, "")
    .trim();
  if (!clean) return "可以，我們把它當成保育線索來看，先從道路、土地或出沒位置找方向。";
  return clean.length > maxLength
    ? `${clean.slice(0, Math.max(1, maxLength - 1))}…`
    : clean;
}



function getAiHelperReasonFallback(context = {}) {
  const cards = getAiHelperContextCards(context);
  const text = cards.map((card) => `${card.title || ""} ${card.categoryLabel || ""} ${card.dataType || ""} ${(card.crisisLinks || []).join(" ")}`).join(" ");
  const profileText = text || String(context?.focusText || "");
  const historyText = Array.isArray(context?.aiHelperHistory)
    ? context.aiHelperHistory.map((item) => String(item?.text || "")).join(" ")
    : "";
  const cardTypes = cards.slice(0, 4).map((card) => card.dataType || card.categoryLabel).filter(Boolean);
  const uniqueTypes = [...new Set(cardTypes)].slice(0, 3).join("、") || "多種線索";
  const aspects = [];
  const addAspect = (label) => {
    if (label && !aspects.includes(label)) aspects.push(label);
  };
  if (/道路|車流|交通|出沒|事件|公路/.test(profileText)) addAspect("道路、車流或石虎出沒");
  if (/土地|人口|棲地|開發|農地/.test(profileText)) addAspect("土地、棲地或人類活動");
  if (/傳言|新聞|雞|通報|居民|互動/.test(profileText)) addAspect("傳言、新聞或互動紀錄");
  if (/水|降雨|河川|水質|RPI|水庫|灌溉/.test(profileText)) addAspect("水環境");
  if (/保育|巡守|友善|獎勵|圍網/.test(profileText)) addAspect("保育行動");
  const aspectText = aspects.slice(0, 3).join("、") || uniqueTypes;
  const praise = cards.length > 0
    ? `你這次蒐集到${aspectText}的資料，很棒。`
    : "你已經開始整理自己選擇解鎖資料的理由，很棒。";
  const patterns = [];
  if (/道路|車流|交通|出沒|事件|公路/.test(profileText)) {
    patterns.push(
      `${praise} 寫蒐集理由時，你可以想想這批數據卡共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
      `${praise} 從這些卡看起來，你可能已經注意到道路壓力和石虎活動位置的關係。可以寫：我注意到＿＿和＿＿可能有關，這可以證明＿＿。`,
    );
  }
  if (/土地|人口|棲地|開發|農地/.test(profileText)) {
    patterns.push(
      `${praise} 寫蒐集理由時，你可以想想土地、棲地或人類活動共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
      `${praise} 你可以把這批卡當成石虎生活空間的線索來寫。可以寫：這些資料讓我發現＿＿地區的＿＿情形，這可以說明＿＿。`,
    );
  }
  if (/傳言|新聞|雞|通報|居民|互動/.test(profileText)) {
    patterns.push(
      `${praise} 寫蒐集理由時，你可以想想這些人與石虎互動資料共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
      `${praise} 你可以從人們怎麼看石虎或實際互動紀錄開始寫。可以寫：這些資料讓我注意到＿＿和＿＿可能有關，這可以證明＿＿。`,
    );
  }
  if (/水|降雨|河川|水質|RPI|水庫|灌溉/.test(profileText)) {
    patterns.push(
      `${praise} 寫蒐集理由時，你可以想想水質、降雨或河川資料共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
      `${praise} 你可以從水環境和石虎生活地點開始寫。可以寫：這些資料讓我發現＿＿，這可以說明石虎可能遇到＿＿問題。`,
    );
  }
  if (/保育|巡守|友善|獎勵|圍網/.test(profileText)) {
    patterns.push(
      `${praise} 寫蒐集理由時，你可以想想保育行動資料共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
    );
  }
  patterns.push(
    `${praise} 寫蒐集理由時，你可以想想這批數據卡共同指向什麼問題。可以寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。`,
    `${praise} 你可以從自己最在意的線索開始寫。可以寫：我注意到＿＿，這個發現可以證明＿＿，所以我選擇解鎖這批卡。`,
  );
  const unused = patterns.filter((pattern) => !historyText.includes(pattern.slice(0, 14)));
  const pool = unused.length > 0 ? unused : patterns;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getAiHelperDialogueTooLongFallback(needType) {
  if (needType === "direction") return "可以先想：道路、土地或地方說法，哪個最像你想查的石虎生存問題？";
  if (needType === "relation") return "先說你的想法，再找一種能看出現象的資料，下一步再補證據。";
  return "寫蒐集理由時，你可以想想這批數據卡共同指向什麼問題，再寫：我從這些數據中發現了＿＿，這個發現可以證明＿＿。";
}

function finalizeAiHelperReplyForDisplay(reply, needType, context = {}) {
  const limit = getAiHelperReplyLimit(needType, context);
  const clean = neutralizeAiHelperSafetyWords(reply)
    .replace(/\s+/g, " ")
    .replace(/[「」]/g, "")
    .trim();
  if (clean.length > limit) {
    const fallback = needType === "reason"
      ? getAiHelperReasonFallback(context)
      : needType === "clarity"
        ? "你的理由已有想法，可再補哪張卡最能支持它，並說明這張卡和石虎生存挑戰的關係。"
        : needType === "gap"
          ? getAiHelperGapFallback(context)
          : getAiHelperDialogueTooLongFallback(needType);
    return clampAiHelperReply(fallback, limit);
  }
  return clampAiHelperReply(clean, limit);
}

function getAiHelperContextCards(context = {}) {
  const isOverallGap = String(context?.gapScope || "") === "overall";
  const cards = isOverallGap && Array.isArray(context.allUnlockedCards) && context.allUnlockedCards.length > 0
    ? context.allUnlockedCards
    : Array.isArray(context.activeContextCards)
      ? context.activeContextCards
      : Array.isArray(context.selectedCards) && context.selectedCards.length > 0
        ? context.selectedCards
        : Array.isArray(context.unlockedCards)
          ? context.unlockedCards
          : [];
  return cards
    .map((card) => {
      if (typeof card === "string") {
        const title = card.trim();
        return title ? { title, category: "", content: "", ...inferAiHelperCardProfile(title, "") } : null;
      }
      if (!card || typeof card !== "object") return null;
      const title = String(card.title || card.revealedTitle || card.id || "").trim();
      if (!title) return null;
      const category = String(card.category || "").slice(0, 30);
      const content = String(card.content || "").replace(/\s+/g, " ").slice(0, 180);
      const profile = inferAiHelperCardProfile(title, category, content);
      return {
        id: String(card.id || "").slice(0, 80),
        title: title.slice(0, 80),
        category,
        categoryLabel: String(card.categoryLabel || profile.categoryLabel || AI_HELPER_CATEGORY_LABELS[category] || "").slice(0, 30),
        town: String(card.town || profile.town || "").slice(0, 20),
        dataType: String(card.dataType || profile.dataType || "").slice(0, 40),
        possibleUse: String(card.possibleUse || profile.possibleUse || "").slice(0, 90),
        crisisLinks: Array.isArray(card.crisisLinks) && card.crisisLinks.length > 0
          ? card.crisisLinks.slice(0, 4).map((item) => String(item).slice(0, 20))
          : profile.crisisLinks.slice(0, 4),
        inquiryOrder: Number.isFinite(Number(card.inquiryOrder)) ? Number(card.inquiryOrder) : null,
        collectionReason: String(card.collectionReason || "").replace(/\s+/g, " ").slice(0, 120),
        content,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}
function getAiHelperCardTitles(context = {}) {
  return getAiHelperContextCards(context).map((card) => card.title).slice(0, 10);
}

function inferAiHelperStudentState(text = "") {
  const value = String(text || "").replace(/\s+/g, "").trim();
  if (!value) return "help_request";
  if (/謝謝|謝啦|感謝|先這樣|不用了|沒事了|再見|掰掰|拜拜|下次再問/.test(value)) return "closing";
  const explicitHelp = /不知道|不清楚|不會|卡住|沒方向|沒有方向|怎麼開始|幫我|可以幫|給我方向|想不到/.test(value);
  const hasQuestion = /[?？]|嗎|呢|怎麼|如何|為什麼|哪個|哪一|可不可以|能不能|要不要|是不是/.test(value);
  if (/所以|那我|那就|我應該|我可以|我先|我要|我會|我決定|我去|先去|去看|去找|找看看|看.*資料|找.*資料|就看|就找|懂了|知道了|了解了|明白了|好我|那應該|應該去|可以去/.test(value)) return "decision";
  if (hasQuestion || explicitHelp) return "help_request";
  if (/我覺得|我想|可能|好像|應該是|感覺|猜|推測|懷疑|我認為|我發現|看起來|應該跟|是不是因為/.test(value)) return "idea";
  if (value.length <= 6) return "help_request";
  return "idea";
}

function getAiHelperStudentStateLabel(state) {
  const map = {
    help_request: "求助或還不確定",
    idea: "提出想法或假設",
    decision: "已經做出下一步決定",
    closing: "準備結束對話",
  };
  return map[state] || map.help_request;
}

function getAiHelperStudentStateInstruction(state) {
  const map = {
    help_request: "學生正在求助或還不確定：先判斷他卡在哪裡，再用目前功能給一個可行下一步。",
    idea: "學生已提出想法或假設：順著他的原詞推進，把想法接到可觀察現象或可蒐集證據。",
    decision: "學生已做出下一步決定：簡短肯定並提醒觀察重點，讓對話自然收束。",
    closing: "學生準備結束：自然收束，鼓勵他回到資料蒐集或書寫。",
  };
  return map[state] || map.help_request;
}

function getAiHelperNeedInstruction(needType) {
  const map = {
    direction: "指引探究方向：先理解學生目前有沒有方向；沒方向時給3到5個可探究的大方向，學生選定方向後再拆成2到4個更小的思考切入點；重點是給方向並提醒學生回到系統找相關數據卡，驗證想法是否成立。最多160字。",
    relation: "強化你的想法：先理解學生的想法；若已有想法，就直接建議可以先看哪類資料、再補哪類資料讓想法更穩；重點是把想法接到數據，不重新發散方向。最多140字。",
    reason: "教我寫理由：請根據學生已蒐集的卡牌面向，推敲學生可能已經從數據中看到、發現、獲得或理解的線索，再用國小教師口吻給寫作建議。重點句型是：我從這些數據中發現了＿＿，這個發現可以證明＿＿。最多180字。",
    clarity: "檢查理由清楚度：先理解學生理由想表達什麼，再指出一個最能讓理由更清楚的補強點；不可對話，不要要求學生回答。最多80字。",
    gap: "點出探究缺口：先理解目前資料分布，再依本次或總體範圍指出一個主要缺口與下一步補資料方向；不可混用範圍。最多80字。",
  };
  return map[needType] || map.direction;
}

function getAiHelperScaffoldRules(needType) {
  const map = {
    direction: AI_HELPER_DIRECTION_SCAFFOLD_RULES,
    relation: AI_HELPER_RELATION_SCAFFOLD_RULES,
    reason: AI_HELPER_REASON_SCAFFOLD_RULES,
    clarity: AI_HELPER_CLARITY_SCAFFOLD_RULES,
    gap: AI_HELPER_GAP_SCAFFOLD_RULES,
  };
  return map[needType] || "";
}

function getAiHelperHistory(context = {}) {
  const history = Array.isArray(context.aiHelperHistory) ? context.aiHelperHistory : [];
  return history
    .map((item) => ({
      role: item?.role === "ai" ? "ai" : "student",
      text: String(item?.text || "").replace(/\s+/g, " ").slice(0, 120),
    }))
    .filter((item) => item.text)
    .slice(-10);
}


function getAiHelperCardUseSummary(context = {}) {
  return getAiHelperContextCards(context)
    .slice(0, 8)
    .map((card) => `${card.title}：${card.dataType}${card.town ? `/${card.town}` : ""}，${card.possibleUse}`)
    .join("；");
}

function findAiHelperCardsByNeed(context = {}, keywords = []) {
  const cards = getAiHelperContextCards(context);
  if (!keywords.length) return cards.slice(0, 3);
  const scored = cards.map((card) => {
    const haystack = `${card.title} ${card.categoryLabel} ${card.dataType} ${card.possibleUse} ${(card.crisisLinks || []).join(" ")} ${card.content}`;
    const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
    return { card, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.card)
    .slice(0, 3);
}

function getAiHelperKeywordsFromText(text = "") {
  const keywords = [];
  const add = (...items) => items.forEach((item) => { if (!keywords.includes(item)) keywords.push(item); });
  if (/兇手|凶手|可能影響因素|原因|造成|哪些因素影響/.test(text)) add("道路", "交通", "事件", "道路事件", "開發", "人口", "傳言", "互動問題");
  if (/道路|車|車流|道路事件|交通/.test(text)) add("道路", "交通", "車流", "事件", "道路事件");
  if (/開發|土地|棲地|環境/.test(text)) add("土地", "棲地", "開發", "人口");
  if (/人|居民|雞|家禽|傳言|誤解|新聞/.test(text)) add("傳言", "新聞", "家禽", "互動問題", "通報");
  if (/水|河川|水質|降雨/.test(text)) add("水", "降雨", "水質", "河川");
  return keywords;
}

function buildAiHelperContextDigest(context = {}, latestText = "") {
  const cards = getAiHelperContextCards(context);
  const keywords = getAiHelperKeywordsFromText(`${latestText} ${getAiHelperHistory(context).map((item) => item.text).join(" ")}`);
  const matchedCards = findAiHelperCardsByNeed(context, keywords);
  return {
    scope: String(context?.activeContextLabel || "目前卡牌"),
    totalCards: Number(context?.gapScopeCardCount || context?.allUnlockedCardCount || context?.unlockedCardCount || cards.length) || cards.length,
    categorySummary: getAiHelperCardCategorySummary(context),
    cardUseSummary: getAiHelperCardUseSummary(context),
    matchedCards: matchedCards.map((card) => ({
      title: card.title,
      dataType: card.dataType,
      town: card.town,
      possibleUse: card.possibleUse,
      crisisLinks: card.crisisLinks,
    })),
  };
}

function getAiHelperCardCategorySummary(context = {}) {
  const counts = new Map();
  getAiHelperContextCards(context).forEach((card) => {
    const rawCategory = String(card.category || card.categoryLabel || "未分類").trim() || "未分類";
    const key = AI_HELPER_CATEGORY_LABELS[rawCategory] || rawCategory;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => `${category}${count}`)
    .join("、");
}

function getAiHelperGapFallback(context = {}) {
  const cards = getAiHelperContextCards(context);
  const isOverall = String(context?.gapScope || "") === "overall";
  const scopeLabel = isOverall ? "總體已解鎖" : "本次";
  const totalFromContext = Number(
    isOverall
      ? context.allUnlockedCardCount || context.gapScopeCardCount
      : context.unlockedCardCount || context.gapScopeCardCount,
  );
  const totalCards = Number.isFinite(totalFromContext) && totalFromContext > 0 ? totalFromContext : cards.length;
  if (cards.length === 0) {
    return isOverall
      ? "目前沒有讀到總體已解鎖卡，先回數據清單解鎖卡片，再檢查整體缺口。"
      : "目前沒有讀到本次已解鎖卡，先蒐集幾張數據卡，再檢查探究缺口。";
  }

  const categoryCounts = new Map();
  const linkText = cards.flatMap((card) => card.crisisLinks || []).join(" ");
  cards.forEach((card) => {
    const category = String(card.category || "").trim();
    const label = AI_HELPER_CATEGORY_LABELS[category] || card.categoryLabel || category || "未分類";
    categoryCounts.set(label, (categoryCounts.get(label) || 0) + 1);
  });
  const [topCategory = "同一類資料"] = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const hasCategory = (category) => cards.some((card) => String(card.category || "") === category);
  let suggestion = "另一種資料角度";
  if (!hasCategory("leopard")) suggestion = "石虎出沒或道路事件";
  else if (!hasCategory("land")) suggestion = "土地、人口或道路壓力";
  else if (!hasCategory("rumor")) suggestion = "傳言新聞或人獸互動";
  else if (!hasCategory("water")) suggestion = "水環境或棲地條件";
  else if (!hasCategory("other")) suggestion = "保育行動或公路位置";
  else if (!/道路|路殺|道路風險|道路切割/.test(linkText)) suggestion = "道路風險證據";
  else if (!/人獸衝突|傳言誤解|保育行動|社區參與/.test(linkText)) suggestion = "人與石虎互動證據";
  else if (!/水環境|棲地條件|棲地破碎|土地開發/.test(linkText)) suggestion = "棲地與環境證據";

  return `${scopeLabel}${totalCards}張較偏${topCategory}，可補${suggestion}，讓缺口檢查更平衡。`;
}

function buildAiHelperFallback({ needType, message, context }) {
  const text = String(message || "").trim();
  const studentState = inferAiHelperStudentState(text);
  const historyText = getAiHelperHistory(context).map((item) => item.text).join(" ");
  const combinedText = `${historyText} ${text}`;
  const titles = getAiHelperCardTitles(context);
  const firstTitle = titles[0] || "你最有感的卡";
  const keywords = getAiHelperKeywordsFromText(combinedText);
  const matchedCards = findAiHelperCardsByNeed(context, keywords);
  const matchedTitle = matchedCards[0]?.title || firstTitle;
  const matchedUse = matchedCards[0]?.possibleUse || "幫你靠近探究目的";
  const categorySummary = getAiHelperCardCategorySummary(context);
  const mentionsUnknown = /不知道|不清楚|沒想法|怎麼開始|不會/.test(text);
  const mentionsCulprit = /兇手|凶手|可能影響因素|原因|誰害|哪些因素影響|造成/.test(combinedText);
  const mentionsGoal = /想查|想知道|目標|目的|我要查|我想/.test(combinedText) || mentionsCulprit;
  const wantsMoreDirections = /沒有|沒感覺|都還好|不喜歡|換|其他|再給|還有/.test(text);
  let reply = "先抓住你剛剛最在意的點，再找一張能幫你看見差異的資料卡。";

  if (needType === "direction") {
    if (studentState === "closing") reply = "可以，先回到系統找相關數據卡。看卡時抓住你剛剛的想法，檢查資料能不能支持它。";
    else if (studentState === "decision") reply = /土地/.test(text)
      ? "可以先回到系統看土地相關資料。看卡時留意土地樣貌和人類活動，能不能支持你的石虎危機想法。"
      : "可以，就先照這個方向回到系統找卡。看資料時想想：它能不能支持你剛剛的想法？";
    else if (wantsMoreDirections) reply = "那我們換個角度想：環境變化、地方說法、保育行動，哪個比較像你想繼續思考的方向？選好後再回系統找資料驗證。";
    else if (/道路|車|車流|道路事件|交通/.test(combinedText)) reply = "道路方向可想：道路是否影響石虎移動。接著回到系統看車流、出沒或事件紀錄，驗證這個想法。";
    else if (/開發|土地|棲地|環境/.test(combinedText)) reply = "土地方向可以思考活動空間是否變少。接著回到系統看土地樣貌、棲地和人類活動資料來驗證。";
    else if (/人|居民|雞|家禽|傳言|誤解|新聞/.test(combinedText)) reply = "人與石虎互動可以思考地方說法和實際紀錄是否一致。接著回到系統找新聞、互動紀錄或保育行動來驗證。";
    else if (/水|河川|水質|降雨/.test(combinedText)) reply = "環境條件可想：水環境是否影響棲地。接著回到系統看水質、降雨或石虎活動區來驗證。";
    else if (mentionsCulprit || mentionsUnknown) reply = "可以先從這幾個方向挑：道路是否影響移動、土地是否壓縮棲地、哪個地區壓力較高、人類看法是否造成互動問題。選好後再回系統找數據卡驗證。";
    else if (mentionsGoal || studentState === "idea") reply = "這可以變成探究方向。你可以先把它往道路、棲地、地區壓力，或人與石虎互動去思考，再回系統找資料驗證。";
    else reply = "可先挑一個方向：道路是否影響石虎移動、土地是否壓縮棲地、地方傳言和真實紀錄是否有落差。選好後回系統找數據卡驗證。";
  } else if (needType === "reason") {
    reply = getAiHelperReasonFallback({ ...context, activeContextCards: matchedCards.length > 0 ? matchedCards : context?.activeContextCards });
  } else if (needType === "relation") {
    if (studentState === "closing") reply = "好，先回去蒐集證據，有需要再問我。";
    else if (studentState === "decision") reply = "可以，先沿著這個資料方向找證據，看看它能不能支持你剛剛的想法。";
    else if (!mentionsGoal && !mentionsCulprit && text.length < 4) reply = "你先說一個想法就好：你懷疑石虎危機可能和什麼有關？我再幫你接到可以看的資料。";
    else if (mentionsCulprit) reply = "可以。先把『原因』變成看得到的資料：道路壓力、棲地變化或地方說法，再補石虎出沒或事件紀錄。";
    else if (/道路|車|車流|道路事件|交通/.test(combinedText)) reply = "先看車流或道路位置，確認哪裡壓力明顯；再補石虎出沒或道路事件。";
    else if (/開發|土地|棲地|環境/.test(combinedText)) reply = "先看土地樣貌或人口活動，確認空間是否被壓縮；再補棲地或出沒資料。";
    else if (/人|居民|雞|家禽|傳言|誤解|新聞/.test(combinedText)) reply = "先看傳言或新聞，確認地方怎麼理解石虎；再補真實紀錄或保育行動。";
    else if (/水|河川|水質|降雨/.test(combinedText)) reply = "先看水質、降雨或河川差異；再補棲地或石虎出沒資料支撐。";
    else reply = "先把想法拆成一個現象：哪裡較嚴重、什麼壓力明顯，再找差異資料。";
  } else if (needType === "clarity") {
    reply = "你的想法已經出來了，可以再補清楚：哪一張卡讓你這樣想，它能看見什麼現象。";
  } else if (needType === "gap") {
    reply = getAiHelperGapFallback(context);
  }
  return clampAiHelperReply(reply, getAiHelperReplyLimit(needType, context));
}
function isReasoningStyleModel(model) {
  const value = String(model || "").toLowerCase();
  return /^o\d/.test(value) || /^gpt-5/.test(value);
}

function getAiHelperMaxOutputTokens(model) {
  const configured = Number(process.env.AI_HELPER_MAX_OUTPUT_TOKENS || 0);
  const reasoningMinimum = 2600;
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(configured, isReasoningStyleModel(model) ? reasoningMinimum : 260);
  }
  // gpt-5 / o 系列會先消耗 reasoning tokens；額度太小時常會 status=completed 但沒有輸出文字。
  return isReasoningStyleModel(model) ? reasoningMinimum : 420;
}

function buildAiHelperChatBody({ model, message, needType, context }) {
  const needLabel = AI_HELPER_NEED_META[needType] || "探究幫助";
  const studentState = inferAiHelperStudentState(message);
  const contextCards = getAiHelperContextCards(context);
  const focusText = String(context?.focusText || "").slice(0, 360);
  const pageLabel = String(context?.pageLabel || context?.pageKey || "探究頁面");
  const activeContextScope = String(context?.activeContextScope || "unlocked");
  const activeContextLabel = String(context?.activeContextLabel || (activeContextScope === "checkpoint" ? "檢查站卡牌" : "已解鎖卡牌"));
  const helpCategory = String(context?.helpCategory || getAiHelperNeedCategory(needType));
  const replyLimit = getAiHelperReplyLimit(needType, context);
  const input = [
    {
      role: "system",
      content: [
        "你是國小六年級石虎探究遊戲中的AI幫幫忙。",
        "你完整知道系統設計、探究流程、資料類型與卡牌用途。",
        AI_HELPER_SYSTEM_KNOWLEDGE,
        AI_HELPER_SAFE_EDUCATION_CONTEXT,
        AI_HELPER_HUMAN_DIALOGUE_RULES,
        getAiHelperScaffoldRules(needType),
        "你的任務是陪學生想，給鷹架與下一步，保留空間讓學生自己完成。",
        helpCategory === "check" ? "本次是檢查型，只給一次建議；先理解學生文字或資料分布，再指出一個最值得補強的地方；最多80字。" : needType === "direction" ? "本次是指引探究方向AI；沒方向時給3到5個可探究方向，學生選定方向後拆成2到4個更小的思考切入點；回覆最後要自然提醒學生回到系統找相關數據卡，驗證這個想法是否成立；最多160字。" : needType === "relation" ? "本次是強化你的想法AI；先理解學生想法，再建議先看哪類資料、再補哪類資料讓想法更穩；最多140字。" : needType === "reason" ? "本次是教我寫理由AI；學生已經選擇或解鎖資料卡，請根據目前卡牌推敲他可能從數據中看到、發現、獲得或理解了什麼，再用國小教師口吻教他把這些發現寫成解鎖理由；建議句型可用：我從這些數據中發現了＿＿，這個發現可以證明＿＿；最多180字。" : "本次是探究幫助；回覆要自然、具體，不代寫答案。",
        "每次回覆的第一任務是理解學生最新一句話，但不代表每次都要用同理開頭；要依照目前AI類型承接他的詞往下推進。",
        "回覆要像真人學習夥伴：少一點規則口吻，多一點『我知道你現在想往哪裡走，所以接下來可以怎麼做』的感覺。",
        "保持單純清楚：一次只保留最有幫助的一個方向、一種卡牌線索或一個具體建議。",
        "回覆維持自然短句：不用標題、不列檢核表、不輸出分析過程、不說學生狀態，保留空格或半句式讓學生自己完成理由或結論。",
        `學生目前語意狀態：${getAiHelperStudentStateLabel(studentState)}。${getAiHelperStudentStateInstruction(studentState)}`,
        needType === "direction" ? "指引探究方向：學生迷茫時給大方向；學生有偏好時拆成思考切入點；學生做決定就收斂，並提醒他回到系統用數據卡驗證想法。" : "",
        needType === "relation" ? "強化你的想法：學生沒想法才問想法；只要有想法，就不要再問目的，要直接建議可看的資料與補強資料。" : "",
        needType === "reason" ? "教我寫理由：直接根據檢查站卡牌與學生文字，先推敲他可能已經從數據中看到、發現、獲得或理解的資料線索，再用「你可以這樣寫」的教師口吻給半句式寫作鷹架，例如：我從這些數據中發現了＿＿，這個發現可以證明＿＿。" : "",
        needType === "clarity" ? "檢查理由清楚度：先看懂學生想說什麼，再指出一個最需要補的地方，例如資料用途、卡牌關聯或石虎危機連結。" : "",
        needType === "gap" ? "點出探究缺口：依 gapScope 判斷本次或總體範圍，只指出一個主要缺口和一個補資料方向。" : "",
        needType === "gap" && String(context?.gapScope || "") === "overall" ? "這次是總體探究缺口：cards 陣列代表玩家整個系統中所有已解鎖的數據卡。" : "",
        needType === "gap" && String(context?.gapScope || "") !== "overall" ? "這次是本次探究缺口：cards 陣列代表本次探究已解鎖的數據卡。" : "",
        needType === "reason" || needType === "clarity" ? "教我寫理由與檢查理由清楚度只能依線索檢查站目前顯示的卡牌。" : "",
        needType === "direction" || needType === "relation" ? "指引探究方向與強化你的想法可看整個遊戲資料架構；已解鎖卡只表示學生目前進度，不是可討論範圍上限。" : "",
        `本次幫助規則：${getAiHelperNeedInstruction(needType)}`,
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        needLabel,
        helpCategory,
        studentState,
        studentStateLabel: getAiHelperStudentStateLabel(studentState),
        gapScope: String(context?.gapScope || ""),
        replyLimit,
        message: String(message || needLabel).slice(0, 220),
        pageLabel,
        activeContextScope,
        activeContextLabel,
        cards: contextCards,
        systemDigest: buildAiHelperContextDigest(context, message),
        focusText,
        collectionReflectionText: String(context?.collectionReflectionText || "").slice(0, 360),
        conversationHistory: getAiHelperHistory(context),
      }),
    },
  ];
  const body = {
    model,
    input,
    max_output_tokens: getAiHelperMaxOutputTokens(model),
  };
  if (isReasoningStyleModel(model)) {
    body.reasoning = { effort: "minimal" };
    body.text = { verbosity: "low" };
  }
  const temperature = Number(process.env.OPENAI_TEMPERATURE || 0.35);
  if (!isReasoningStyleModel(model)) body.temperature = temperature;
  return body;
}

async function ensureAiHelperUnlockTable(connection = pool) {
  await connection.query(`CREATE TABLE IF NOT EXISTS ai_helper_unlocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    round_key VARCHAR(80) NOT NULL,
    scope VARCHAR(40) NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ai_helper_unlock (user_id, round_key, scope),
    INDEX idx_ai_helper_user_round (user_id, round_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function aiHelperTableHasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function addAiHelperColumnIfMissing(connection, columnName, alterSql) {
  if (!(await aiHelperTableHasColumn(connection, "ai_helper_records", columnName))) {
    await connection.query(alterSql);
  }
}

async function ensureAiHelperRecordTable(connection = pool) {
  await connection.query(`CREATE TABLE IF NOT EXISTS ai_helper_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    round_key VARCHAR(80) NOT NULL,
    scope VARCHAR(40) NOT NULL,
    session_id VARCHAR(120) NULL,
    need_type VARCHAR(40) NULL,
    help_category VARCHAR(40) NULL,
    action_type VARCHAR(40) NOT NULL,
    request_text TEXT NULL,
    response_text TEXT NULL,
    response_source VARCHAR(30) NULL,
    provider VARCHAR(80) NULL,
    is_fallback TINYINT(1) NOT NULL DEFAULT 0,
    gap_scope VARCHAR(30) NULL,
    context_scope VARCHAR(40) NULL,
    context_label VARCHAR(120) NULL,
    page_key VARCHAR(60) NULL,
    page_label VARCHAR(80) NULL,
    focus_label VARCHAR(100) NULL,
    focus_text TEXT NULL,
    collection_reflection_text TEXT NULL,
    direction_opening TINYINT(1) NOT NULL DEFAULT 0,
    reason_opening TINYINT(1) NOT NULL DEFAULT 0,
    reply_limit INT NULL,
    active_cards_count INT NOT NULL DEFAULT 0,
    unlocked_cards_count INT NULL,
    all_unlocked_cards_count INT NULL,
    help_credits INT NULL,
    turns_in_help INT NULL,
    checks_in_help INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_helper_records_user_round (user_id, round_key, created_at),
    INDEX idx_ai_helper_records_session (session_id),
    INDEX idx_ai_helper_records_need (need_type, action_type),
    CONSTRAINT fk_ai_helper_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const requiredColumnSpecs = [
    ["round_key", "ALTER TABLE ai_helper_records ADD COLUMN round_key VARCHAR(80) NOT NULL DEFAULT 'round-1' AFTER user_id"],
    ["scope", "ALTER TABLE ai_helper_records ADD COLUMN scope VARCHAR(40) NOT NULL DEFAULT 'cards' AFTER round_key"],
    ["session_id", "ALTER TABLE ai_helper_records ADD COLUMN session_id VARCHAR(120) NULL AFTER scope"],
    ["need_type", "ALTER TABLE ai_helper_records ADD COLUMN need_type VARCHAR(40) NULL AFTER session_id"],
    ["help_category", "ALTER TABLE ai_helper_records ADD COLUMN help_category VARCHAR(40) NULL AFTER need_type"],
    ["action_type", "ALTER TABLE ai_helper_records ADD COLUMN action_type VARCHAR(40) NOT NULL DEFAULT 'event' AFTER help_category"],
    ["request_text", "ALTER TABLE ai_helper_records ADD COLUMN request_text TEXT NULL AFTER action_type"],
    ["response_text", "ALTER TABLE ai_helper_records ADD COLUMN response_text TEXT NULL AFTER request_text"],
    ["response_source", "ALTER TABLE ai_helper_records ADD COLUMN response_source VARCHAR(30) NULL AFTER response_text"],
    ["provider", "ALTER TABLE ai_helper_records ADD COLUMN provider VARCHAR(80) NULL AFTER response_source"],
    ["is_fallback", "ALTER TABLE ai_helper_records ADD COLUMN is_fallback TINYINT(1) NOT NULL DEFAULT 0 AFTER provider"],
    ["gap_scope", "ALTER TABLE ai_helper_records ADD COLUMN gap_scope VARCHAR(30) NULL AFTER is_fallback"],
    ["context_scope", "ALTER TABLE ai_helper_records ADD COLUMN context_scope VARCHAR(40) NULL AFTER gap_scope"],
    ["context_label", "ALTER TABLE ai_helper_records ADD COLUMN context_label VARCHAR(120) NULL AFTER context_scope"],
    ["page_key", "ALTER TABLE ai_helper_records ADD COLUMN page_key VARCHAR(60) NULL AFTER context_label"],
    ["page_label", "ALTER TABLE ai_helper_records ADD COLUMN page_label VARCHAR(80) NULL AFTER page_key"],
    ["focus_label", "ALTER TABLE ai_helper_records ADD COLUMN focus_label VARCHAR(100) NULL AFTER page_label"],
    ["focus_text", "ALTER TABLE ai_helper_records ADD COLUMN focus_text TEXT NULL AFTER focus_label"],
    ["collection_reflection_text", "ALTER TABLE ai_helper_records ADD COLUMN collection_reflection_text TEXT NULL AFTER focus_text"],
    ["direction_opening", "ALTER TABLE ai_helper_records ADD COLUMN direction_opening TINYINT(1) NOT NULL DEFAULT 0 AFTER collection_reflection_text"],
    ["reason_opening", "ALTER TABLE ai_helper_records ADD COLUMN reason_opening TINYINT(1) NOT NULL DEFAULT 0 AFTER direction_opening"],
    ["reply_limit", "ALTER TABLE ai_helper_records ADD COLUMN reply_limit INT NULL AFTER reason_opening"],
    ["active_cards_count", "ALTER TABLE ai_helper_records ADD COLUMN active_cards_count INT NOT NULL DEFAULT 0 AFTER reply_limit"],
    ["unlocked_cards_count", "ALTER TABLE ai_helper_records ADD COLUMN unlocked_cards_count INT NULL AFTER active_cards_count"],
    ["all_unlocked_cards_count", "ALTER TABLE ai_helper_records ADD COLUMN all_unlocked_cards_count INT NULL AFTER unlocked_cards_count"],
    ["help_credits", "ALTER TABLE ai_helper_records ADD COLUMN help_credits INT NULL AFTER all_unlocked_cards_count"],
    ["turns_in_help", "ALTER TABLE ai_helper_records ADD COLUMN turns_in_help INT NULL AFTER help_credits"],
    ["checks_in_help", "ALTER TABLE ai_helper_records ADD COLUMN checks_in_help INT NULL AFTER turns_in_help"],
    ["created_at", "ALTER TABLE ai_helper_records ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"],
  ];

  for (const [columnName, alterSql] of requiredColumnSpecs) {
    await addAiHelperColumnIfMissing(connection, columnName, alterSql);
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS ai_helper_record_cards (
    ai_helper_record_id BIGINT NOT NULL,
    card_id VARCHAR(100) NOT NULL,
    card_order INT NOT NULL DEFAULT 1,
    PRIMARY KEY (ai_helper_record_id, card_id),
    INDEX idx_ai_helper_record_cards_card_id (card_id),
    CONSTRAINT fk_ai_helper_record_cards_record
      FOREIGN KEY (ai_helper_record_id) REFERENCES ai_helper_records(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  if (await aiHelperTableHasColumn(connection, "ai_helper_records", "card_refs_json")) {
    const [legacyRows] = await connection.query(
      `SELECT id, card_refs_json FROM ai_helper_records WHERE card_refs_json IS NOT NULL`,
    );
    for (const row of legacyRows) {
      const [existingRows] = await connection.query(
        `SELECT 1 FROM ai_helper_record_cards WHERE ai_helper_record_id = ? LIMIT 1`,
        [row.id],
      );
      if (existingRows.length > 0) continue;
      await insertAiHelperRecordCards(connection, Number(row.id), compactAiHelperCards(safeParseJson(row.card_refs_json, [])));
    }
  }
}

function normalizeAiHelperNeedType(value) {
  const needType = String(value || '').slice(0, 40);
  return needType || null;
}

function compactAiHelperCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.slice(0, 24).map((card) => {
    if (card == null) return null;
    if (typeof card === 'string' || typeof card === 'number') {
      return { id: String(card) };
    }
    if (typeof card !== 'object') return null;
    const id = String(card.id || card.cardId || card.key || '').trim();
    const title = String(card.revealedTitle || card.title || card.name || '').trim();
    const type = String(card.type || card.category || card.kind || '').trim();
    return {
      ...(id ? { id } : {}),
      ...(title ? { title: title.slice(0, 80) } : {}),
      ...(type ? { type: type.slice(0, 40) } : {}),
    };
  }).filter(Boolean);
}

function buildAiHelperRecordSummary(context = {}) {
  const activeCards = Array.isArray(context.activeContextCards)
    ? context.activeContextCards
    : Array.isArray(context.selectedCards)
      ? context.selectedCards
      : Array.isArray(context.unlockedCards)
        ? context.unlockedCards
        : [];
  const unlockedCount = Array.isArray(context.unlockedCards) ? context.unlockedCards.length : null;
  const allUnlockedCount = Array.isArray(context.allUnlockedCards) ? context.allUnlockedCards.length : null;
  return {
    pageKey: String(context.pageKey || '').slice(0, 60) || null,
    pageLabel: String(context.pageLabel || '').slice(0, 80) || null,
    focusLabel: String(context.focusLabel || '').slice(0, 100) || null,
    focusText: String(context.focusText || '').slice(0, 600) || null,
    collectionReflectionText: String(context.collectionReflectionText || '').slice(0, 600) || null,
    directionOpening: Boolean(context.directionOpening),
    reasonOpening: Boolean(context.reasonOpening),
    replyLimit: Number(context.replyLimit) || null,
    activeCardsCount: activeCards.length,
    unlockedCardsCount: unlockedCount,
    allUnlockedCardsCount: allUnlockedCount,
  };
}

async function insertAiHelperRecordCards(connection, aiHelperRecordId, cards) {
  if (!aiHelperRecordId || !Array.isArray(cards) || cards.length === 0) return;
  const seen = new Set();
  const rows = cards
    .map((card) => String(card?.id || '').trim())
    .filter((cardId) => {
      if (!cardId || seen.has(cardId)) return false;
      seen.add(cardId);
      return true;
    })
    .map((cardId, index) => [aiHelperRecordId, cardId, index + 1]);

  if (rows.length === 0) return;
  await connection.query(
    `INSERT INTO ai_helper_record_cards (ai_helper_record_id, card_id, card_order) VALUES ?`,
    [rows],
  );
}

async function insertAiHelperRecord({
  connection = pool,
  userId,
  username = null,
  groupId = null,
  roundKey = 'round-1',
  scope = 'cards',
  sessionId = null,
  needType = null,
  helpCategory = null,
  actionType,
  requestText = null,
  responseText = null,
  responseSource = null,
  provider = null,
  isFallback = false,
  gapScope = null,
  context = {},
  helpCredits = null,
  turnsInHelp = null,
  checksInHelp = null,
}) {
  if (!userId || !actionType) return;
  try {
    await ensureAiHelperRecordTable(connection);
    const safeContext = context && typeof context === 'object' ? context : {};
    const cards = Array.isArray(safeContext.activeContextCards)
      ? safeContext.activeContextCards
      : Array.isArray(safeContext.selectedCards)
        ? safeContext.selectedCards
        : Array.isArray(safeContext.unlockedCards)
          ? safeContext.unlockedCards
          : [];
    const contextSummary = buildAiHelperRecordSummary(safeContext);
    const compactCards = compactAiHelperCards(cards);
    const [result] = await connection.query(
      `INSERT INTO ai_helper_records (
        user_id, round_key, scope, session_id, need_type, help_category,
        action_type, request_text, response_text, response_source, provider, is_fallback,
        gap_scope, context_scope, context_label,
        page_key, page_label, focus_label, focus_text, collection_reflection_text,
        direction_opening, reason_opening, reply_limit,
        active_cards_count, unlocked_cards_count, all_unlocked_cards_count,
        help_credits, turns_in_help, checks_in_help
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(roundKey || 'round-1').slice(0, 80),
        String(scope || 'cards').slice(0, 40),
        sessionId ? String(sessionId).slice(0, 120) : null,
        normalizeAiHelperNeedType(needType),
        helpCategory ? String(helpCategory).slice(0, 40) : null,
        String(actionType).slice(0, 40),
        requestText == null ? null : String(requestText).slice(0, 4000),
        responseText == null ? null : String(responseText).slice(0, 4000),
        responseSource ? String(responseSource).slice(0, 30) : null,
        provider ? String(provider).slice(0, 80) : null,
        isFallback ? 1 : 0,
        gapScope ? String(gapScope).slice(0, 30) : null,
        safeContext.activeContextScope ? String(safeContext.activeContextScope).slice(0, 40) : null,
        safeContext.activeContextLabel ? String(safeContext.activeContextLabel).slice(0, 120) : null,
        contextSummary.pageKey,
        contextSummary.pageLabel,
        contextSummary.focusLabel,
        contextSummary.focusText,
        contextSummary.collectionReflectionText,
        contextSummary.directionOpening ? 1 : 0,
        contextSummary.reasonOpening ? 1 : 0,
        contextSummary.replyLimit,
        contextSummary.activeCardsCount,
        contextSummary.unlockedCardsCount,
        contextSummary.allUnlockedCardsCount,
        Number.isFinite(Number(helpCredits)) ? Number(helpCredits) : null,
        Number.isFinite(Number(turnsInHelp)) ? Number(turnsInHelp) : null,
        Number.isFinite(Number(checksInHelp)) ? Number(checksInHelp) : null,
      ],
    );
    await insertAiHelperRecordCards(connection, Number(result.insertId), compactCards);
  } catch (error) {
    console.error('AI 幫幫忙紀錄寫入失敗（不中斷主要流程）：', error);
  }
}
function normalizeAiHelperReply({ reply, needType, message, context }) {
  if (isAiHelperRefusalText(reply)) {
    return buildAiHelperFallback({ needType, message, context });
  }
  const raw = neutralizeAiHelperSafetyWords(reply).trim();
  const text = String(message || "").replace(/\s+/g, "");
  const historyText = getAiHelperHistory(context).map((item) => item.text).join("");
  const combinedText = `${historyText}${text}`;
  const studentState = inferAiHelperStudentState(message);
  const hasConcreteIdea = /道路|車|車流|道路事件|交通|開發|土地|棲地|環境|人|居民|雞|家禽|傳言|誤解|新聞|水|河川|水質|降雨|兇手|凶手|可能影響因素|原因|石虎|出沒|意外|事件|地區|生存挑戰/.test(combinedText);
  const looksLikeQuestion = /[?？]|你覺得|要不要|哪一|哪個|想不想|可不可以|能不能/.test(raw);

  if (needType === "relation" && looksLikeQuestion && (studentState !== "help_request" || hasConcreteIdea)) {
    return buildAiHelperFallback({ needType, message, context });
  }
  if (needType === "direction" && looksLikeQuestion && ["decision", "closing"].includes(studentState)) {
    return buildAiHelperFallback({ needType, message, context });
  }
  return raw;
}

async function generateAiHelperReply({ needType, message, context }) {
  let reply = "";
  let replySource = "ai";
  let providerName = "";
  let warning = "";

  try {
    const provider = getConfiguredAiProvider({ purpose: "ai-helper" });
    providerName = provider.provider;
    const body = buildAiHelperChatBody({ model: provider.model, message, needType, context });
    const response = await fetch(provider.url, {
      method: "POST",
      headers: provider.headers,
      body: JSON.stringify(body),
    });
    let data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || data?.message || "AI 回覆失敗");
    reply = extractOpenAIOutputText(data);

    // gpt-5 / o 系列有時會把額度花在 reasoning，導致完成但沒有 output_text。
    // 這時不要立刻落到離線提示，先用更短、更直接的提示重試一次。
    if (!String(reply || "").trim() && isReasoningStyleModel(provider.model)) {
      const retryBody = {
        ...body,
        max_output_tokens: Math.max(getAiHelperMaxOutputTokens(provider.model), 3600),
        input: [
          ...body.input,
          {
            role: "user",
            content: "請直接用繁體中文回覆學生，最多依本次字數限制；只輸出最後要顯示給學生的一段話。",
          },
        ],
        reasoning: { effort: "minimal" },
        text: { verbosity: "low" },
      };
      const retryResponse = await fetch(provider.url, {
        method: "POST",
        headers: provider.headers,
        body: JSON.stringify(retryBody),
      });
      data = await retryResponse.json().catch(() => ({}));
      if (!retryResponse.ok) throw new Error(data?.error?.message || data?.message || "AI 回覆失敗");
      reply = extractOpenAIOutputText(data);
    }

    if (!String(reply || "").trim()) {
      const status = data?.status ? `，status=${data.status}` : "";
      const reason = data?.incomplete_details?.reason ? `，reason=${data.incomplete_details.reason}` : "";
      throw new Error(`AI 回覆為空${status}${reason}`);
    }
  } catch (aiError) {
    replySource = "fallback";
    warning = aiError instanceof Error ? aiError.message : "AI 連線失敗";
    console.warn("AI 幫幫忙改用離線提示：", warning);
    reply = buildAiHelperFallback({ needType, message, context });
  }

  const normalizedReply = normalizeAiHelperReply({ reply, needType, message, context });
  const finalReply = finalizeAiHelperReplyForDisplay(normalizedReply, needType, context);

  return {
    reply: finalReply,
    source: replySource,
    provider: providerName,
    isFallback: replySource === "fallback",
    warning: replySource === "fallback" ? warning : "",
  };
}

module.exports = {
  MAX_BARRAGE_COINS,
  HELP_USES_PER_COIN,
  ensureStudentCoinBalance,
  ensureStudentCoinBalanceWithConnection,
  ensureAiHelperUnlockTable,
  insertAiHelperRecord,
  generateAiHelperReply,
};
