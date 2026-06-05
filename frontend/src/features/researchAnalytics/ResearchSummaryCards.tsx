import { BarChart3, Bot, ClipboardList, Database, Map, Trophy, Users } from 'lucide-react';
import type { ResearchAnalyticsPayload } from './types';

const cards = [
  ['totalStudents', '學生數', Users],
  ['totalInquiryRecords', '探究書', ClipboardList],
  ['totalUnlockedCards', '解鎖卡紀錄', Database],
  ['totalEvidenceCards', '證據卡紀錄', BarChart3],
  ['totalAiRecords', 'AI 對話紀錄', Bot],
  ['totalMapChoices', '地圖選擇', Map],
  ['totalRewards', '稱號紀錄', Trophy],
] as const;

export default function ResearchSummaryCards({ payload }: { payload: ResearchAnalyticsPayload }) {
  return (
    <section className="research-grid research-grid--summary">
      {cards.map(([key, label, Icon]) => (
        <article className="research-card research-card--metric" key={key}>
          <div className="research-icon"><Icon size={20} /></div>
          <div>
            <div className="research-card__label">{label}</div>
            <div className="research-card__value">{Number(payload.overview?.[key] || 0).toLocaleString()}</div>
          </div>
        </article>
      ))}
    </section>
  );
}
