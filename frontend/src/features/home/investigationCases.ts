import type { FinalSummary } from "./finalSummaryModel";

const INVESTIGATION_CASE_FLOW = [
  {
    id: "discover_crisis",
    title: "調查一：發現危機",
    shortTitle: "發現危機",
    task: "先找出石虎可能遇到的危機，不急著下定論",
    reportBadge: "TASK 1",
  },
  {
    id: "lock_suspect",
    title: "調查二：鎖定嫌疑犯",
    shortTitle: "鎖定嫌疑犯",
    task: "根據初步線索，調查並找出造成石虎危機的兇手",
    reportBadge: "TASK 2",
  },
  {
    id: "trace_evidence",
    title: "調查三：追查證據",
    shortTitle: "追查證據",
    task: "替你的懷疑補上更多證據吧~",
    reportBadge: "TASK 3",
  },
  {
    id: "revise_inference",
    title: "調查四：修正推論",
    shortTitle: "修正推論",
    task: "檢查是否還有其他因素，將你的調查塑造成更合理的成果",
    reportBadge: "TASK 4",
  },
];

export function getInvestigationCaseByOrder(order?: number | null) {
  const safeOrder = Math.max(1, Number(order || 1));
  if (safeOrder > INVESTIGATION_CASE_FLOW.length) {
    return {
      id: "free_inquiry",
      title: `延伸探究 ${safeOrder}`,
      shortTitle: "延伸探究",
      task: "主要調查已完成，後續可以自由的去探究，延伸調查的目的",
      reportBadge: `EXTRA ${safeOrder}`,
    };
  }
  return INVESTIGATION_CASE_FLOW[safeOrder - 1] || INVESTIGATION_CASE_FLOW[0];
}

export type InvestigationCase = ReturnType<typeof getInvestigationCaseByOrder>;

export function getInvestigationCaseBySummary(
  summary: FinalSummary,
  fallbackIndex: number,
) {
  return getInvestigationCaseByOrder(summary.recordOrder || fallbackIndex + 1);
}

export function getNextInvestigationCase(completedCount: number) {
  return getInvestigationCaseByOrder(completedCount + 1);
}
