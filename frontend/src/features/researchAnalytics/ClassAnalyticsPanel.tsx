import type { ResearchAnalyticsPayload } from './types';

function pct(value: number) { return `${Number(value || 0).toFixed(1)}%`; }

export default function ClassAnalyticsPanel({ payload }: { payload: ResearchAnalyticsPayload }) {
  const classAnalytics = payload.classAnalytics;
  return (
    <div className="research-stack">
      <section className="research-panel">
        <h2>全班描述性統計</h2>
        <p>只呈現平均值、次數、比例與分布，不做探究品質評分。</p>
        <div className="research-kpi-row">
          <span>平均探究書數：<b>{classAnalytics.inquiryStatistics.averageInquiryCount}</b></span>
          <span>平均解鎖卡數：<b>{classAnalytics.inquiryStatistics.averageUnlockedCardCount}</b></span>
          <span>平均證據卡數：<b>{classAnalytics.inquiryStatistics.averageEvidenceCardCount}</b></span>
          <span>平均筆記數：<b>{classAnalytics.inquiryStatistics.averageNoteCount}</b></span>
        </div>
      </section>

      <section className="research-panel research-two-col">
        <div>
          <h3>資料卡類型分布</h3>
          <table className="research-table"><thead><tr><th>類型</th><th>次數</th><th>比例</th></tr></thead><tbody>
            {classAnalytics.dataCardStatistics.byCategory.map((row) => <tr key={row.category}><td>{row.label}</td><td>{row.count}</td><td>{pct(row.ratio)}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <h3>AI 使用統計</h3>
          <div className="research-kpi-row research-kpi-row--compact">
            <span>使用人數：<b>{classAnalytics.aiStatistics.userCount}</b></span>
            <span>使用次數：<b>{classAnalytics.aiStatistics.totalCount}</b></span>
            <span>平均使用：<b>{classAnalytics.aiStatistics.averageUseCount}</b></span>
          </div>
          <table className="research-table"><thead><tr><th>AI 類型</th><th>次數</th><th>比例</th></tr></thead><tbody>
            {classAnalytics.aiStatistics.typeRatio.map((row) => <tr key={row.type}><td>{row.type}</td><td>{row.count}</td><td>{pct(row.ratio)}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="research-panel research-two-col">
        <div>
          <h3>地圖決策比例</h3>
          <table className="research-table"><thead><tr><th>範圍</th><th>保育</th><th>開發</th><th>不知道</th></tr></thead><tbody>
            {classAnalytics.mapStatistics.map((row) => <tr key={row.scope}><td>{row.scope}</td><td>{pct(row.conservationRatio)}</td><td>{pct(row.developmentRatio)}</td><td>{pct(row.unknownRatio)}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <h3>角色卡決策統計</h3>
          <div className="research-kpi-row research-kpi-row--compact">
            <span>提案數：<b>{classAnalytics.decisionCardStatistics.proposalCount}</b></span>
            <span>通過數：<b>{classAnalytics.decisionCardStatistics.acceptedCount}</b></span>
            <span>通過率：<b>{pct(classAnalytics.decisionCardStatistics.acceptanceRate)}</b></span>
          </div>
        </div>
      </section>
    </div>
  );
}
