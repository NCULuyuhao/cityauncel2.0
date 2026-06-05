import type { StudentMetric } from './types';

export default function StudentDifferenceTable({ rows }: { rows: StudentMetric[] }) {
  return (
    <section className="research-panel">
      <h2>學生差異矩陣</h2>
      <p>每位學生一列，支援用欄位觀察差異；數值皆為描述性計數。</p>
      <div className="research-table-wrap">
        <table className="research-table research-table--wide">
          <thead><tr><th>學生</th><th>性別</th><th>組別</th><th>探究書數</th><th>解鎖卡數</th><th>證據卡數</th><th>筆記數</th><th>AI 次數</th><th>稱號數</th><th>地圖選擇</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.userId}><td>{row.username}{row.isGroupLeader ? '（組長）' : ''}</td><td>{row.genderLabel}</td><td>{row.groupName}</td><td>{row.inquiryCount}</td><td>{row.unlockedCardCount}</td><td>{row.evidenceCardCount}</td><td>{row.noteCount}</td><td>{row.aiUseCount}</td><td>{row.rewardCount}</td><td>{row.mapChoiceCount}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
