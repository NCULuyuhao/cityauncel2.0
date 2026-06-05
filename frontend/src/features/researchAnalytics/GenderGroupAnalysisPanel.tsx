import type { SummaryRow } from './types';

function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return (
    <section className="research-panel">
      <h2>{title}</h2>
      <table className="research-table">
        <thead><tr><th>分類</th><th>人數</th><th>平均探究書</th><th>平均解鎖卡</th><th>平均證據卡</th><th>平均 AI</th><th>平均稱號</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.groupId || row.gender || row.label}><td>{row.groupName || row.label}</td><td>{row.studentCount}</td><td>{row.averageInquiryCount}</td><td>{row.averageUnlockedCardCount}</td><td>{row.averageEvidenceCardCount}</td><td>{row.averageAiUseCount}</td><td>{row.averageRewardCount}</td></tr>
        ))}</tbody>
      </table>
    </section>
  );
}

export default function GenderGroupAnalysisPanel({ genderRows, groupRows }: { genderRows: SummaryRow[]; groupRows: SummaryRow[] }) {
  return <div className="research-stack"><SummaryTable title="性別描述性比較" rows={genderRows} /><SummaryTable title="組別平均值比較" rows={groupRows} /></div>;
}
