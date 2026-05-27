/**
 * CityAuncel maintainability notes
 * 檔案用途：跨頁共用元件 BarrageLayer，提供可重用的視覺或互動區塊。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getBarrageStatus, getBarragesAfter, getLatestBarrageId, sendBarrageMessage } from "../api/barrageApi";

const COIN_REFRESH_MS = 5000;
const BARRAGE_POLL_MS = 2200;
const MAX_TEXT_LENGTH = 20;
const MAX_TRACKS = 3;
const MAX_VISIBLE_BARRAGES = 3;
const MAX_PENDING_BARRAGES = 8;
const SEND_COOLDOWN_MS = 2500;
const COMPOSER_IDLE_FADE_MS = 3500;
const BARRAGE_TEXT_DRAFT_KEY = "cityauncel_barrage_text_draft";

const BARRAGE_ANIMATION_NAME = "barrage-slide-gpu";
const BARRAGE_ANIMATION_STYLE = `
@keyframes ${BARRAGE_ANIMATION_NAME} {
  from {
    transform: translate3d(100vw, 0, 0);
  }

  to {
    transform: translate3d(calc(-100vw - 100%), 0, 0);
  }
}

.barrage-stage {
  --barrage-track-gap: 40px;
}

.barrage-composer {
  bottom: 0.65rem;
  left: 50%;
  width: min(88vw, 500px);
  transform: translateX(-50%);
}

@media (max-height: 520px) {
  .barrage-stage {
    --barrage-track-gap: 34px;
    top: calc(max(3.5rem, env(safe-area-inset-top))) !important;
    height: 128px !important;
  }
}

@media (max-height: 380px) {
  .barrage-stage {
    --barrage-track-gap: 30px;
    height: 104px !important;
  }
}

@media (max-width: 640px) {
  .barrage-composer {
    bottom: max(0.55rem, env(safe-area-inset-bottom));
    left: 50% !important;
    right: auto !important;
    width: min(94vw, 520px);
    transform: translateX(-50%) !important;
  }

  .barrage-composer-form {
    gap: 0.3rem;
    padding: 0.35rem;
    width: 100%;
    box-sizing: border-box;
    min-width: 0;
  }

  .barrage-input {
    min-width: 0;
  }

  .barrage-coin {
    padding-left: 0.45rem;
    padding-right: 0.45rem;
  }

  .barrage-count {
    display: none;
  }

  .barrage-send {
    padding-left: 0.55rem;
    padding-right: 0.55rem;
  }
}
`;

type Barrage = {
  id: number;
  userId: number;
  username?: string | null;
  content: string;
  createdAt?: string;
};

type FlyingBarrage = Barrage & {
  track: number;
  localKey: string;
  duration: number;
};

type BarrageLayerProps = {
  token: string | null;
};

function getBarrageDuration(text: string) {
  // 教學系統使用：比一般直播彈幕慢，讓學生看得清楚。
  // 15 字最長大約 19 秒，短句也至少 12 秒。
  const baseSeconds = 12;
  const extraSecondsPerChar = 0.45;
  return Math.min(baseSeconds + text.length * extraSecondsPerChar, 19);
}

function pickAvailableTrack(trackBusyUntil: number[]) {
  const now = Date.now();
  let bestTrack = 0;
  let earliestAvailableTime = trackBusyUntil[0] || 0;

  for (let track = 0; track < MAX_TRACKS; track += 1) {
    const availableAt = trackBusyUntil[track] || 0;

    if (availableAt <= now) return track;

    if (availableAt < earliestAvailableTime) {
      bestTrack = track;
      earliestAvailableTime = availableAt;
    }
  }

  return earliestAvailableTime <= now ? bestTrack : null;
}

export default function BarrageLayer({ token }: BarrageLayerProps) {
  const [coins, setCoins] = useState(0);
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(BARRAGE_TEXT_DRAFT_KEY) ?? "";
  });
  const [visibleBarrages, setVisibleBarrages] = useState<FlyingBarrage[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isComposerActive, setIsComposerActive] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isBarrageReady, setIsBarrageReady] = useState(false);
  const isComposerHidden = false;

  const lastIdRef = useRef(0);
  const sendCooldownRef = useRef(false);
  const pendingQueueRef = useRef<Barrage[]>([]);
  const visibleIdsRef = useRef<Set<number>>(new Set());
  const trackBusyUntilRef = useRef<number[]>(Array(MAX_TRACKS).fill(0));
  const composerIdleTimerRef = useRef<number | null>(null);

  const clearComposerIdleTimer = useCallback(() => {
    if (composerIdleTimerRef.current === null) return;
    window.clearTimeout(composerIdleTimerRef.current);
    composerIdleTimerRef.current = null;
  }, []);

  const activateComposer = useCallback(() => {
    setIsComposerActive(true);
    clearComposerIdleTimer();
  }, [clearComposerIdleTimer]);

  const scheduleComposerFade = useCallback(() => {
    clearComposerIdleTimer();
    composerIdleTimerRef.current = window.setTimeout(() => {
      setIsComposerActive(false);
      composerIdleTimerRef.current = null;
    }, COMPOSER_IDLE_FADE_MS);
  }, [clearComposerIdleTimer]);

  useEffect(() => {
    return () => clearComposerIdleTimer();
  }, [clearComposerIdleTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (text.trim()) {
      window.sessionStorage.setItem(BARRAGE_TEXT_DRAFT_KEY, text);
    } else {
      window.sessionStorage.removeItem(BARRAGE_TEXT_DRAFT_KEY);
    }
  }, [text]);

  const resetBarrageRefs = useCallback(() => {
    lastIdRef.current = 0;
    pendingQueueRef.current = [];
    visibleIdsRef.current = new Set();
    trackBusyUntilRef.current = Array(MAX_TRACKS).fill(0);
  }, []);


  const removeBarrage = useCallback((localKey: string, id: number) => {
    visibleIdsRef.current.delete(id);
    setVisibleBarrages((prev) =>
      prev.filter((barrage) => barrage.localKey !== localKey),
    );
  }, []);

  const showOneBarrage = useCallback(
    (barrage: Barrage) => {
      if (visibleIdsRef.current.has(barrage.id)) return false;

      const track = pickAvailableTrack(trackBusyUntilRef.current);
      if (track === null) return false;

      const duration = getBarrageDuration(barrage.content);
      const flyingBarrage: FlyingBarrage = {
        ...barrage,
        track,
        duration,
        localKey: `${barrage.id}-${Date.now()}-${Math.random()}`,
      };

      visibleIdsRef.current.add(barrage.id);
      // 同一條軌道要等上一則彈幕完整跑完才可以再放下一則，避免重疊。
      trackBusyUntilRef.current[track] = Date.now() + (duration + 0.35) * 1000;

      setVisibleBarrages((prev) => {
        const next = [...prev, flyingBarrage];
        return next.slice(-MAX_VISIBLE_BARRAGES);
      });

      window.setTimeout(() => {
        removeBarrage(flyingBarrage.localKey, flyingBarrage.id);
      }, (duration + 0.5) * 1000);

      return true;
    },
    [removeBarrage],
  );

  const enqueueBarrages = useCallback((barrages: Barrage[]) => {
    if (barrages.length === 0) return;

    const queuedIds = new Set(pendingQueueRef.current.map((item) => item.id));
    const freshBarrages = barrages.filter(
      (item) => !queuedIds.has(item.id) && !visibleIdsRef.current.has(item.id),
    );

    pendingQueueRef.current = [
      ...pendingQueueRef.current,
      ...freshBarrages,
    ].slice(-MAX_PENDING_BARRAGES);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pendingQueueRef.current.length === 0) return;

      const [next, ...rest] = pendingQueueRef.current;
      const didShow = showOneBarrage(next);

      if (didShow) {
        pendingQueueRef.current = rest;
      }
    }, 420);

    return () => window.clearInterval(timer);
  }, [showOneBarrage]);

  const loadCoins = useCallback(async () => {
    if (!token || document.hidden) return;

    try {
      const data = await getBarrageStatus(token);
      const nextCoins = Math.min(Number(data.coins) || 0, 10);
      setCoins(nextCoins);
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      resetBarrageRefs();
      const resetTimer = window.setTimeout(() => {
        setVisibleBarrages([]);
        setIsBarrageReady(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const initialCoinTimer = window.setTimeout(() => {
      loadCoins();
    }, 0);
    const timer = window.setInterval(loadCoins, COIN_REFRESH_MS);

    const refreshWhenVisible = (event?: Event) => {
      const nextCoins = Number(
        (event as CustomEvent<{ coins?: number }> | undefined)?.detail?.coins,
      );
      if (Number.isFinite(nextCoins)) {
        setCoins(Math.min(Math.max(0, nextCoins), 10));
        return;
      }
      if (!document.hidden) loadCoins();
    };

    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("cityauncel:coin-updated", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialCoinTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("cityauncel:coin-updated", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [token, loadCoins, resetBarrageRefs]);

  useEffect(() => {
    if (!token) return;
    const activeToken = token;

    let ignore = false;
    resetBarrageRefs();
    const resetTimer = window.setTimeout(() => {
      if (!ignore) {
        setVisibleBarrages([]);
        setIsBarrageReady(false);
      }
    }, 0);

    async function initializeBarrageCursor() {
      try {
        const data = await getLatestBarrageId(activeToken);
        if (ignore) return;

        // 重要：登入時只記住目前最新彈幕 ID，不把歷史彈幕丟進畫面。
        lastIdRef.current = Number(data.latestId) || 0;
        setIsBarrageReady(true);
      } catch (error) {
        console.error(error);
        if (!ignore) setIsBarrageReady(true);
      }
    }

    initializeBarrageCursor();

    return () => {
      ignore = true;
      window.clearTimeout(resetTimer);
    };
  }, [token, resetBarrageRefs]);

  useEffect(() => {
    if (!token || !isBarrageReady) return;
    const activeToken = token;

    let ignore = false;

    async function loadBarrages() {
      if (document.hidden) return;

      try {
        const data = await getBarragesAfter(activeToken, lastIdRef.current);
        if (ignore) return;

        const barrages = (data.barrages || []) as Barrage[];
        if (barrages.length === 0) return;

        lastIdRef.current = barrages[barrages.length - 1].id;
        enqueueBarrages(barrages);
      } catch (error) {
        console.error(error);
      }
    }

    loadBarrages();
    const timer = window.setInterval(loadBarrages, BARRAGE_POLL_MS);

    const handleVisible = () => {
      if (!document.hidden) loadBarrages();
    };
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      ignore = true;
      window.clearInterval(timer);
    };
  }, [token, isBarrageReady, enqueueBarrages]);

  async function sendBarrage() { 
    const content = text.trim();

    if (!token || !content || isSending) return;

    if (content.length > MAX_TEXT_LENGTH) {
      setStatusMessage("彈幕最多 20 個字");
      return;
    }

    if (sendCooldownRef.current) {
      setStatusMessage("請稍等一下再發射彈幕");
      return;
    }

    sendCooldownRef.current = true;
    window.setTimeout(() => {
      sendCooldownRef.current = false;
    }, SEND_COOLDOWN_MS);

    setIsSending(true);
    setStatusMessage("");

    try {
      const data = await sendBarrageMessage(token, content);

      setText("");
      window.sessionStorage.removeItem(BARRAGE_TEXT_DRAFT_KEY);
      const nextCoins = Math.min(Number(data.coins) || 0, 10);
      setCoins(nextCoins);
      window.dispatchEvent(
        new CustomEvent("cityauncel:coin-updated", {
          detail: { coins: nextCoins },
        }),
      );

      if (data.barrage) {
        lastIdRef.current = Math.max(lastIdRef.current, data.barrage.id);
        enqueueBarrages([data.barrage]);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("送出彈幕失敗，請稍後再試");
    } finally {
      setIsSending(false);
    }
  }

  if (!token) return null;

      return (
      <>
        {/* ===== 彈幕顯示區 ===== */}
        <style>{BARRAGE_ANIMATION_STYLE}</style>
        <div className="barrage-stage pointer-events-none fixed inset-x-0 top-20 z-20 h-[170px] overflow-hidden opacity-100 contain-paint">
          {visibleBarrages.map((item) => (
            <div
              key={item.localKey}
              className="absolute whitespace-nowrap px-4 py-1 text-base font-extrabold text-black will-change-transform transform-gpu"
              style={{
                top: `calc(${item.track} * var(--barrage-track-gap))`,
                left: 0,
                animation: `${BARRAGE_ANIMATION_NAME} ${item.duration}s linear forwards`,
                backfaceVisibility: "hidden",
                textShadow: `
                  1px 1px 0 #fff,
                  -1px -1px 0 #fff,
                  1px -1px 0 #fff,
                  -1px 1px 0 #fff
                `,
              }}
            >
              {item.content}
            </div>
          ))}
        </div>

        {/* ===== 輸入區（你這段剛剛消失的）===== */}
        <div
          className={`barrage-composer fixed z-[95] ${isComposerHidden ? "hidden" : ""}`}
          onPointerDown={activateComposer}
          onFocus={activateComposer}
          onBlur={scheduleComposerFade}
        >
          {statusMessage && (
            <div className="mb-1.5 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-black text-red-600">
              {statusMessage}
            </div>
          )}

          <div
            className={`barrage-composer-form flex items-center gap-1.5 rounded-lg border border-stone-700 bg-[#fffaf0] p-1.5 shadow transition-opacity duration-300 ${isComposerActive || Boolean(text.trim()) || Boolean(statusMessage) ? "opacity-100" : "opacity-35"}`}
          >
            <span className="barrage-coin rounded bg-amber-100 px-2 py-1 text-[11px] font-black leading-4">
              🪙 {coins}
            </span>

            <input
              value={text}
              maxLength={20}
              onChange={(e) => {
                setText(e.target.value);
                activateComposer();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendBarrage();
              }}
              placeholder={coins > 0 ? "輸入你想說的話（最多20字）" : "完成調查書可獲得 coin，最多只能累積10個coin"}
              className="barrage-input h-8 flex-1 rounded border px-2 py-1 text-xs font-bold outline-none"
            />
            <span className="barrage-count text-[11px] font-bold text-stone-400">
              {text.length}/20
            </span>
            <button
              onClick={sendBarrage}
              disabled={!text.trim() || coins <= 0}
              className="barrage-send h-8 rounded bg-stone-700 px-3 py-1 text-xs font-black text-white disabled:opacity-40"
            >
              發射
            </button>
          </div>
        </div>
      </>
    );
}
