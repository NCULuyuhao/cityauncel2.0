/**
 * CityAuncel maintainability notes
 * 檔案用途：數據清單倒數 hook，集中處理啟動、暫停、恢復與 localStorage 保存。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { useEffect, useRef, useState } from "react";
import {
  DATA_LIST_COUNTDOWN_MS,
  DATA_LIST_ONE_MINUTE_MS,
  DATA_LIST_THREE_MINUTE_MS,
  type DataListTimerNotice,
} from "./dataListCountdownConfig";

type ActivityLogPayload = {
  eventType: string;
  eventLabel?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

type RestoredDataListCountdown = {
  deadline: number | null;
  remainingMs: number;
};

type UseDataListCountdownOptions = {
  isActive: boolean;
  currentInquiryOrder: number;
  restoredCountdown: RestoredDataListCountdown;
  onCountdownEnd: () => void;
  onActivityLog?: (payload: ActivityLogPayload) => void;
};

// 倒數不是單純 setInterval：離開資料清單後要保存暫停時間，回來時接續學生上次剩餘秒數。
export function useDataListCountdown({
  isActive,
  currentInquiryOrder,
  restoredCountdown,
  onCountdownEnd,
  onActivityLog,
}: UseDataListCountdownOptions) {
  const [deadline, setDeadline] = useState<number | null>(restoredCountdown.deadline);
  const [remainingMs, setRemainingMs] = useState(restoredCountdown.remainingMs);
  const [notice, setNotice] = useState<DataListTimerNotice>(null);
  const warnedRef = useRef({ three: false, one: false, done: false });
  const onCountdownEndRef = useRef(onCountdownEnd);
  const onActivityLogRef = useRef(onActivityLog);

  useEffect(() => {
    onCountdownEndRef.current = onCountdownEnd;
  }, [onCountdownEnd]);

  useEffect(() => {
    onActivityLogRef.current = onActivityLog;
  }, [onActivityLog]);

  useEffect(() => {
    if (!isActive) {
      const timer = window.setTimeout(() => {
        setDeadline(null);
        setRemainingMs(DATA_LIST_COUNTDOWN_MS);
        setNotice(null);
        warnedRef.current = { three: false, one: false, done: false };
      }, 0);

      return () => window.clearTimeout(timer);
    }

    const nextDeadline = restoredCountdown.deadline ?? Date.now() + DATA_LIST_COUNTDOWN_MS;
    const timer = window.setTimeout(() => {
      setDeadline(nextDeadline);
      setRemainingMs(
        restoredCountdown.deadline !== null
          ? restoredCountdown.remainingMs
          : DATA_LIST_COUNTDOWN_MS,
      );
      setNotice(null);
      warnedRef.current = { three: false, one: false, done: false };
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentInquiryOrder, isActive, restoredCountdown.deadline, restoredCountdown.remainingMs]);

  useEffect(() => {
    if (!isActive || deadline === null) return;

    const tick = () => {
      const nextRemainingMs = Math.max(0, deadline - Date.now());
      setRemainingMs(nextRemainingMs);

      if (
        nextRemainingMs <= DATA_LIST_THREE_MINUTE_MS &&
        nextRemainingMs > DATA_LIST_ONE_MINUTE_MS &&
        !warnedRef.current.three
      ) {
        warnedRef.current.three = true;
        setNotice("three");
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_warning",
          eventLabel: "數據清單倒數剩餘三分鐘",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { remainingMinutes: 3, inquiryOrder: currentInquiryOrder },
        });
      }

      if (
        nextRemainingMs <= DATA_LIST_ONE_MINUTE_MS &&
        nextRemainingMs > 0 &&
        !warnedRef.current.one
      ) {
        warnedRef.current.one = true;
        setNotice("one");
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_warning",
          eventLabel: "數據清單倒數剩餘一分鐘",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { remainingMinutes: 1, inquiryOrder: currentInquiryOrder },
        });
      }

      if (nextRemainingMs <= 0 && !warnedRef.current.done) {
        warnedRef.current.done = true;
        setNotice("done");
        setDeadline(null);
        onActivityLogRef.current?.({
          eventType: "data_list_countdown_end",
          eventLabel: "數據清單倒數結束並進入蒐集檢查",
          targetType: "timer",
          targetId: "data-list-countdown",
          metadata: { inquiryOrder: currentInquiryOrder },
        });
        onCountdownEndRef.current();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, [currentInquiryOrder, deadline, isActive]);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, notice === "done" ? 3000 : 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return {
    dataListCountdownDeadline: deadline,
    dataListRemainingMs: remainingMs,
    dataListTimerNotice: notice,
  };
}
