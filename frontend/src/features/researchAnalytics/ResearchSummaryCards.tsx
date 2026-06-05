import { BarChart3, Bot, ClipboardList, Database, Map, Trophy, Users } from 'lucide-react';
import type { ResearchAnalyticsPayload, StudentMetric } from './types';

const cards = [
  ['totalStudents', '學生數', Users],
  ['totalInquiryRecords', '探究書', ClipboardList],
  ['totalUnlockedCards', '解鎖卡紀錄', Database],
  ['totalEvidenceCards', '證據卡紀錄', BarChart3],
  ['totalAiRecords', 'AI 使用紀錄', Bot],
  ['totalMapChoices', '地圖選擇', Map],
  ['totalRewards', '稱號紀錄', Trophy],
] as const;

function buildFilteredOverview(rows: StudentMetric[]) {
  return {
    totalStudents: rows.length,
    totalInquiryRecords: rows.reduce((sum, row) => sum + Number(row.inquiryCount || 0), 0),
    totalUnlockedCards: rows.reduce((sum, row) => sum + Number(row.unlockedCardCount || 0), 0),
    totalEvidenceCards: rows.reduce((sum, row) => sum + Number(row.evidenceCardCount || 0), 0),
    totalAiRecords: rows.reduce((sum, row) => sum + Number(row.aiUseCount || 0), 0),
    totalMapChoices: rows.reduce((sum, row) => sum + Number(row.mapChoiceCount || 0), 0),
    totalRewards: rows.reduce((sum, row) => sum + Number(row.rewardCount || 0), 0),
  };
}

export default function ResearchSummaryCards({ payload, metrics }: { payload: ResearchAnalyticsPayload; metrics?: StudentMetric[] }) {
  const overview = metrics ? buildFilteredOverview(metrics) : payload.overview;
  return (
    <section className="research-grid research-grid--summary">
      {cards.map(([key, label, Icon]) => (
        <article className="research-card research-card--metric" key={key}>
          <div className="research-icon"><Icon size={20} /></div>
          <div>
            <div className="research-card__label">{metrics ? `篩選後${label}` : label}</div>
            <div className="research-card__value">{Number(overview?.[key] || 0).toLocaleString()}</div>
          </div>
        </article>
      ))}
    </section>
  );
}
