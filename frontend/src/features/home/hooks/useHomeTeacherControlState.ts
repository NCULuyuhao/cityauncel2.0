import { useEffect, useRef } from "react";
import {
  getCardPackStatus,
  getFinalDecisionSettlement,
  getInquiryTaskStatus,
  getMapTaskStatus,
  getStudentScreenLock,
  getSuspectVotingStatus,
} from "@/api/homeApi";
import type { FinalDecisionSettlementApi, VotingStatusApi } from "@/api/homeApi";

type MutableRef<T> = { current: T };

type UseHomeTeacherControlStateOptions = {
  token: string | null;
  currentUserId?: number | string | null;
  isTeacher: boolean;
  applyVotingStatus: (status: VotingStatusApi) => void;
  handleFinalSettlementForStudent: (settlement: FinalDecisionSettlementApi) => void;
  clearHandledFinalSettlementKey: (userId?: number | string | null) => void;
  activeFinalSettlementKeyRef: MutableRef<string | null>;
  setFinalEndingCountdown: (value: number | null) => void;
  setFinalDecisionSettlement: (value: FinalDecisionSettlementApi | { isFinalized: false }) => void;
  setIsCardPackOpen: (isOpen: boolean) => void;
  setIsInquiryTaskOpen: (isOpen: boolean) => void;
  setIsMapTaskOpen: (isOpen: boolean) => void;
  setIsStudentScreenLocked: (isLocked: boolean) => void;
};

export function useHomeTeacherControlState({
  token,
  currentUserId,
  isTeacher,
  applyVotingStatus,
  handleFinalSettlementForStudent,
  clearHandledFinalSettlementKey,
  activeFinalSettlementKeyRef,
  setFinalEndingCountdown,
  setFinalDecisionSettlement,
  setIsCardPackOpen,
  setIsInquiryTaskOpen,
  setIsMapTaskOpen,
  setIsStudentScreenLocked,
}: UseHomeTeacherControlStateOptions) {
  const callbacksRef = useRef({
    applyVotingStatus,
    handleFinalSettlementForStudent,
    clearHandledFinalSettlementKey,
    setFinalEndingCountdown,
    setFinalDecisionSettlement,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  });

  useEffect(() => {
    callbacksRef.current = {
      applyVotingStatus,
      handleFinalSettlementForStudent,
      clearHandledFinalSettlementKey,
      setFinalEndingCountdown,
      setFinalDecisionSettlement,
      setIsCardPackOpen,
      setIsInquiryTaskOpen,
      setIsMapTaskOpen,
      setIsStudentScreenLocked,
    };
  }, [
    applyVotingStatus,
    handleFinalSettlementForStudent,
    clearHandledFinalSettlementKey,
    setFinalEndingCountdown,
    setFinalDecisionSettlement,
    setIsCardPackOpen,
    setIsInquiryTaskOpen,
    setIsMapTaskOpen,
    setIsStudentScreenLocked,
  ]);

  useEffect(() => {
    if (!token || !currentUserId) return;

    const authToken = token;
    let ignore = false;

    async function loadTeacherControls() {
      try {
        const [
          inquiryTaskResult,
          mapTaskResult,
          cardPackResult,
          votingResult,
          screenLockResult,
          finalDecisionResult,
        ] = await Promise.allSettled([
          getInquiryTaskStatus(authToken),
          getMapTaskStatus(authToken),
          getCardPackStatus(authToken),
          getSuspectVotingStatus(authToken),
          getStudentScreenLock(authToken),
          getFinalDecisionSettlement(authToken),
        ]);

        if (ignore) return;

        if (inquiryTaskResult.status === "fulfilled") {
          callbacksRef.current.setIsInquiryTaskOpen(inquiryTaskResult.value.isOpen !== false);
        }
        if (mapTaskResult.status === "fulfilled") {
          callbacksRef.current.setIsMapTaskOpen(Boolean(mapTaskResult.value.isOpen));
        }
        if (cardPackResult.status === "fulfilled") {
          callbacksRef.current.setIsCardPackOpen(Boolean(cardPackResult.value.isOpen));
        }
        if (votingResult.status === "fulfilled") {
          callbacksRef.current.applyVotingStatus(votingResult.value);
        }
        if (screenLockResult.status === "fulfilled") {
          callbacksRef.current.setIsStudentScreenLocked(Boolean(screenLockResult.value.isLocked));
        }
        if (finalDecisionResult.status === "fulfilled") {
          const finalDecisionData = finalDecisionResult.value;
          const nextSettlement = finalDecisionData?.isFinalized
            ? finalDecisionData
            : { isFinalized: false };
          callbacksRef.current.setFinalDecisionSettlement(nextSettlement);
          if (!isTeacher && nextSettlement.isFinalized) {
            callbacksRef.current.handleFinalSettlementForStudent(nextSettlement);
          }
          if (!nextSettlement.isFinalized) {
            activeFinalSettlementKeyRef.current = null;
            callbacksRef.current.clearHandledFinalSettlementKey(currentUserId);
            callbacksRef.current.setFinalEndingCountdown(null);
          }
        }
      } catch (error) {
        console.error("讀取教師控制狀態失敗", error);
      }
    }

    loadTeacherControls();
    const timer = window.setInterval(loadTeacherControls, 20000);
    const handleFocus = () => loadTeacherControls();
    window.addEventListener("focus", handleFocus);

    return () => {
      ignore = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeFinalSettlementKeyRef, currentUserId, isTeacher, token]);
}
