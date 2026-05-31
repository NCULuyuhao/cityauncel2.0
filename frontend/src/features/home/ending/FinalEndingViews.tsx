/**
 * CityAuncel maintainability notes
 * 檔案用途：結局與鎖屏畫面元件，負責全班流程完成後的學生端顯示。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { motion } from "framer-motion";

type FinalEndingCard = {
  cardId: string;
  title: string;
};

type FinalEndingGroup = {
  groupId: string;
  groupName: string;
  cards?: FinalEndingCard[];
};

type FinalEndingOutcome = {
  id: string;
  title: string;
  subtitle: string;
};

export type FinalEndingSettlement = {
  outcome?: FinalEndingOutcome;
  groups?: FinalEndingGroup[];
};

function getEndingStyle(outcomeId?: string) {
  if (outcomeId === "sustainable") {
    return {
      bg: "from-emerald-100 via-lime-50 to-sky-100",
      ring: "border-emerald-300/70 shadow-[0_0_80px_rgba(16,185,129,0.28)]",
      badge: "bg-emerald-700 text-white",
      icon: "🌿",
      accent: "text-emerald-800",
      story:
        "幾年後，苗栗淺山的景象悄悄改變了。河水重新變得清澈，田野間出現更多昆蟲與動物。有人開始在夜晚拍到石虎的身影，牠們不再頻繁出現在危險的道路上。農業、觀光與綠能發展逐漸找到新的平衡方式，居民的生活也穩定下來。這片土地，開始出現人與自然共存的可能。",
      questions: ["哪一個決策最關鍵？", "如果少了哪一個行動，結果會改變嗎？"],
    };
  }

  if (outcomeId === "partial") {
    return {
      bg: "from-amber-100 via-orange-50 to-stone-100",
      ring: "border-amber-300/70 shadow-[0_0_80px_rgba(245,158,11,0.26)]",
      badge: "bg-amber-700 text-white",
      icon: "⚖️",
      accent: "text-amber-800",
      story:
        "苗栗淺山的改變並不一致。有些地區環境逐漸改善，但另一些地方仍持續惡化。偶爾還是能看到石虎出沒，但路殺事件與受傷案例仍時有發生。部分產業發展成功，但也帶來新的壓力與衝突。這片土地，正處在選擇的十字路口。",
      questions: [
        "哪些行動帶來正面和負面影響？",
        "如果再多一回合，你們會改變什麼？",
      ],
    };
  }

  return {
    bg: "from-rose-100 via-stone-100 to-slate-200",
    ring: "border-rose-300/70 shadow-[0_0_80px_rgba(244,63,94,0.22)]",
    badge: "bg-rose-800 text-white",
    icon: "🔥",
    accent: "text-rose-800",
    story:
      "苗栗淺山的環境逐漸失去平衡。河水變得混濁，生態系開始崩解。石虎的死亡事件持續增加，牠們被迫進入人類活動區域，卻面臨更多危險。路殺、污染、衝突不斷發生，人與環境之間的矛盾越來越明顯。這片土地，正在付出代價。",
    questions: ["哪一個決策其實可以改變結局？", "如果重來一次，你們會怎麼做？"],
  };
}

export function FinalEndingCountdownOverlay({ seconds }: { seconds: number }) {
  const safeSeconds = Math.max(seconds, 0);

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center overflow-hidden bg-[#101820] p-5 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(253,224,71,0.28),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(52,211,153,0.24),transparent_28%),linear-gradient(135deg,#101820_0%,#173326_48%,#3b2f18_100%)]" />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-white/10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-[42px] border-[6px] border-[#facc15] bg-[#fff7dc] px-6 py-10 text-[#1f2933] shadow-[0_34px_120px_rgba(0,0,0,0.72)] sm:px-12 sm:py-14"
      >
        <div className="absolute inset-x-0 top-0 h-4 bg-[#facc15]" />

        <p className="inline-flex rounded-full bg-[#1f2933] px-5 py-2 text-sm font-black tracking-[0.28em] text-[#fff7dc] shadow-lg sm:text-base">
          FINAL SETTLEMENT
        </p>

        <h2 className="mt-6 text-4xl font-black leading-tight tracking-[0.06em] text-[#111827] drop-shadow-sm sm:text-6xl">
          即將進入遊戲結局
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-lg font-black leading-8 text-[#374151] sm:text-2xl">
          全班決策已完成結算，請準備查看苗栗淺山的最後回聲。
        </p>

        <motion.div
          key={safeSeconds}
          initial={{ scale: 0.72, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 210, damping: 14 }}
          className="mx-auto mt-9 flex h-40 w-40 items-center justify-center rounded-full border-[8px] border-[#111827] bg-[#facc15] text-8xl font-black text-[#111827] shadow-[0_18px_50px_rgba(17,24,39,0.35)] sm:h-52 sm:w-52 sm:text-9xl"
        >
          {safeSeconds}
        </motion.div>

        <div className="mx-auto mt-8 h-5 max-w-md overflow-hidden rounded-full border-2 border-[#111827] bg-white shadow-inner">
          <motion.div
            key={`bar-${safeSeconds}`}
            initial={{ width: `${safeSeconds * 20}%` }}
            animate={{ width: `${Math.max(safeSeconds - 1, 0) * 20}%` }}
            transition={{ duration: 1, ease: "linear" }}
            className="h-full rounded-full bg-[#16a34a]"
          />
        </div>
      </motion.div>
    </div>
  );
}

export function FinalEndingPage({
  settlement,
  isTeacher,
  onBackHome,
}: {
  settlement: FinalEndingSettlement;
  isTeacher: boolean;
  onBackHome: () => void;
}) {
  const outcome = settlement.outcome || {
    id: "partial",
    title: "部分共榮",
    subtitle: "全班決策進入反思階段",
  };
  const style = getEndingStyle(outcome.id);
  const groups = Array.isArray(settlement.groups) ? settlement.groups : [];

  return (
    <div
      className={`relative min-h-[100svh] overflow-hidden bg-gradient-to-br ${style.bg} px-4 py-6 text-stone-900 sm:px-8`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.72),transparent_30%),linear-gradient(135deg,rgba(68,64,60,0.08)_0_1px,transparent_1px_34px)]" />
        <div className="absolute -left-20 top-28 h-80 w-80 rounded-full bg-white/45 blur-[90px]" />
        <div className="absolute bottom-[-80px] right-[-40px] h-96 w-96 rounded-full bg-white/40 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] max-w-7xl flex-col justify-center gap-6">
        <motion.section
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className={`overflow-hidden rounded-[36px] border bg-white/78 p-5 backdrop-blur-xl sm:p-8 ${style.ring}`}
        >
          <div className="grid gap-8 min-[700px]:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] min-[700px]:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-black tracking-[0.22em] text-stone-600 shadow-sm">
                <span>生態回聲：最後的選擇</span>
              </div>
              <motion.div
                initial={{ rotate: -8, scale: 0.88, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.15,
                  type: "spring",
                  stiffness: 180,
                  damping: 13,
                }}
                className="mb-5 text-7xl sm:text-8xl"
              >
                {style.icon}
              </motion.div>
              <p
                className={`text-sm font-black tracking-[0.28em] ${style.accent}`}
              >
                FINAL OUTCOME
              </p>
              <h1 className="mt-3 font-serif text-5xl font-black tracking-[0.08em] text-stone-900 sm:text-7xl lg:text-8xl">
                {outcome.title}
              </h1>
              <p className="mt-4 max-w-2xl text-xl font-black leading-9 text-stone-700 sm:text-2xl">
                {outcome.subtitle}
              </p>
              <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-stone-700 sm:text-lg">
                {style.story}
              </p>
              <div className="mt-7 rounded-3xl border border-white/70 bg-white/62 p-5 shadow-inner">
                <p className="text-sm font-black tracking-[0.22em] text-stone-500">
                  反思引導
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {style.questions.map((question) => (
                    <div
                      key={question}
                      className="rounded-2xl border border-stone-200 bg-white/72 p-4 text-sm font-black leading-7 text-stone-700 shadow-sm"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/75 bg-white/66 p-5 shadow-[0_22px_60px_rgba(68,64,60,0.14)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[0.24em] text-stone-500">
                    GROUP DECISIONS
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-stone-900">
                    各組最終決策卡
                  </h2>
                </div>
                <span
                  className={`rounded-full px-4 py-2 text-xs font-black tracking-[0.18em] ${style.badge}`}
                >
                  已公布
                </span>
              </div>

              <div className="mt-5 max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <div
                      key={group.groupId}
                      className="rounded-3xl border border-stone-200 bg-white/78 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-black text-stone-800">
                          {group.groupName}
                        </h3>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-black text-stone-600">
                          {group.cards?.length || 0} 張
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {(group.cards || []).map((card, cardIndex) => (
                          <div
                            key={card.cardId}
                            className="rounded-2xl border border-stone-200 bg-white/86 px-4 py-3 text-sm font-black leading-6 text-stone-700 shadow-sm"
                          >
                            <span className="mr-2 text-stone-400">
                              {cardIndex + 1}.
                            </span>
                            {card.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-stone-200 bg-white/78 p-5 text-sm font-bold text-stone-600">
                    目前沒有可顯示的小組決策資料。
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.35 }}
          className="mx-auto max-w-3xl rounded-[28px] border border-white/70 bg-white/62 px-6 py-5 text-center text-lg font-black leading-9 text-stone-700 shadow-sm backdrop-blur"
        >
          「這個生態的結果，已經寫下。
          <br />
          但你的選擇，還可以改變下一次的故事。」
        </motion.div>

        {isTeacher ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onBackHome}
              className="rounded-2xl border border-stone-300 bg-white/80 px-5 py-3 text-sm font-black text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              回教師首頁
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StudentScreenLockOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/92 p-6 text-center text-white backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[34px] border border-white/70 bg-white/92 px-6 py-10 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:px-10 sm:py-14">
        <p className="text-sm font-black tracking-[0.32em] text-slate-950">
          SCREEN LOCKED
        </p>
        <h2 className="mt-5 text-4xl font-black leading-tight tracking-[0.08em] text-slate-950 sm:text-6xl">
          畫面已鎖定
        </h2>
        <p className="mt-6 text-2xl font-black leading-relaxed tracking-[0.08em] text-slate-950 sm:text-4xl">
          請抬頭看向教師
        </p>
      </div>
    </div>
  );
}
