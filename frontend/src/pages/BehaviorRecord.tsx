/**
 * 教師端｜事後研究分析工具
 *
 * 這個頁面只整理學生遊戲歷程、描述性統計與研究匯出，不做即時監控、評分或學習成效推論。
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { getTeacherResearchAnalytics } from '../api/teacherDashboardApi';
import ClassAnalyticsPanel from '../features/researchAnalytics/ClassAnalyticsPanel';
import GenderGroupAnalysisPanel from '../features/researchAnalytics/GenderGroupAnalysisPanel';
import ResearchExportPanel from '../features/researchAnalytics/ResearchExportPanel';
import ResearchSummaryCards from '../features/researchAnalytics/ResearchSummaryCards';
import StudentDifferenceTable from '../features/researchAnalytics/StudentDifferenceTable';
import StudentRecordViewer from '../features/researchAnalytics/StudentRecordViewer';
import type { ResearchAnalyticsPayload, ResearchFilterState } from '../features/researchAnalytics/types';

type BehaviorRecordProps = { onBack?: () => void; token?: string | null };
type TabId = 'class' | 'students' | 'records' | 'genderGroup' | 'export';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'class', label: '全班統計' },
  { id: 'students', label: '學生差異' },
  { id: 'records', label: '原始紀錄' },
  { id: 'genderGroup', label: '性別 / 組別' },
  { id: 'export', label: '研究匯出' },
];

function applyFilters<T extends { gender?: string | null; groupId?: string; userId?: number }>(rows: T[], filters: ResearchFilterState) {
  return rows.filter((row) => {
    if (filters.gender !== 'all' && row.gender !== filters.gender) return false;
    if (filters.groupId !== 'all' && row.groupId !== filters.groupId) return false;
    if (filters.studentId !== 'all' && Number(row.userId) !== Number(filters.studentId)) return false;
    return true;
  });
}

function researchStyles() {
  return `
.research-page{min-height:100vh;padding:28px;background:linear-gradient(135deg,#eef7ff,#fff8ee);color:#263342;font-family:'jf-openhuninn','Noto Sans TC',system-ui,sans-serif}.research-header{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;margin-bottom:18px}.research-header h1{margin:0;font-size:clamp(28px,4vw,42px)}.research-header p{margin:8px 0 0;color:#516273;max-width:980px;line-height:1.7}.research-back,.research-refresh,.research-export-button{border:0;border-radius:999px;padding:11px 16px;background:#263342;color:#fff;cursor:pointer;display:inline-flex;gap:8px;align-items:center;box-shadow:0 8px 20px rgba(38,51,66,.16)}.research-refresh{background:#3578a8}.research-principle{background:#fff;border:1px solid rgba(55,96,130,.16);border-radius:24px;padding:18px 22px;margin:16px 0;box-shadow:0 10px 28px rgba(31,72,100,.08)}.research-principle b{color:#1e638f}.research-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:rgba(255,255,255,.72);border:1px solid rgba(55,96,130,.14);border-radius:22px;padding:14px;margin:16px 0}.research-toolbar label{display:flex;align-items:center;gap:8px;font-weight:700;color:#385066}.research-toolbar select,.research-toolbar input{border:1px solid rgba(55,96,130,.25);border-radius:14px;padding:10px 12px;background:#fff;min-width:150px}.research-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.research-tabs button{border:1px solid rgba(55,96,130,.18);background:#fff;border-radius:999px;padding:10px 16px;cursor:pointer}.research-tabs button.active{background:#263342;color:#fff}.research-grid{display:grid;gap:14px}.research-grid--summary{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:18px 0}.research-card,.research-panel{background:#fff;border:1px solid rgba(55,96,130,.14);border-radius:24px;box-shadow:0 12px 32px rgba(31,72,100,.08)}.research-card--metric{padding:16px;display:flex;gap:12px;align-items:center}.research-icon{width:42px;height:42px;border-radius:16px;background:#eef7ff;color:#2f78a9;display:grid;place-items:center}.research-card__label{font-size:13px;color:#657588}.research-card__value{font-size:26px;font-weight:900;color:#263342}.research-stack{display:grid;gap:16px}.research-panel{padding:20px;overflow:hidden}.research-panel h2{margin:0 0 8px;font-size:24px}.research-panel h3{margin:4px 0 10px}.research-panel p{color:#617083;line-height:1.7}.research-kpi-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}.research-kpi-row span{background:#f4f8fb;border-radius:16px;padding:10px 12px}.research-kpi-row--compact span{font-size:14px}.research-two-col{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.research-table-wrap{overflow:auto}.research-table{width:100%;border-collapse:separate;border-spacing:0 8px}.research-table th{text-align:left;font-size:13px;color:#617083;padding:8px 10px;white-space:nowrap}.research-table td{background:#f7fafc;padding:10px;border-top:1px solid rgba(55,96,130,.08);border-bottom:1px solid rgba(55,96,130,.08);vertical-align:top}.research-table td:first-child{border-radius:14px 0 0 14px;border-left:1px solid rgba(55,96,130,.08);font-weight:700}.research-table td:last-child{border-radius:0 14px 14px 0;border-right:1px solid rgba(55,96,130,.08)}.research-table--wide{min-width:980px}.research-record-list{display:grid;gap:12px}.research-record-card{border:1px solid rgba(55,96,130,.16);border-radius:18px;padding:14px;background:#fbfdff}.research-record-card summary{cursor:pointer}.research-record-section{margin-top:14px}.research-subcard{border-left:4px solid #74a9d8;background:#fff;border-radius:16px;padding:14px;margin:10px 0}.research-subcard h4{margin:0 0 8px}.research-muted{color:#8996a5}.research-export-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px}.research-export-button{justify-content:center;background:#2d6f47}.research-loading,.research-error{padding:48px;text-align:center}.research-error{color:#a33535}.research-search{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:0 10px;border:1px solid rgba(55,96,130,.25)}.research-search input{border:0;outline:0;min-width:220px}.research-meta{font-size:13px;color:#617083;margin-top:8px}@media(max-width:720px){.research-page{padding:16px}.research-header{display:block}.research-back{margin-bottom:12px}.research-toolbar label{width:100%;justify-content:space-between}.research-toolbar select{min-width:50%}}
  `;
}

export default function BehaviorRecord({ onBack, token }: BehaviorRecordProps) {
  const [payload, setPayload] = useState<ResearchAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('class');
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<ResearchFilterState>({ gender: 'all', groupId: 'all', studentId: 'all' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeacherResearchAnalytics<ResearchAnalyticsPayload>(token || undefined);
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取資料失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token]);

  const filteredStudents = useMemo(() => {
    const rows = applyFilters(payload?.studentMetrics || [], filters);
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.username} ${row.groupName} ${row.genderLabel}`.toLowerCase().includes(q));
  }, [payload, filters, keyword]);

  const filteredRawRecords = useMemo(() => {
    const rows = payload?.rawStudentRecords || [];
    return rows.filter((record) => filteredStudents.some((student) => student.userId === record.profile.userId));
  }, [payload, filteredStudents]);

  return (
    <div className="research-page">
      <style>{researchStyles()}</style>
      <header className="research-header">
        <div>
          {onBack ? <button className="research-back" onClick={onBack}><ArrowLeft size={18} />返回首頁</button> : null}
          <h1>教師端｜事後研究分析工具</h1>
          <p>整理學生在遊戲中的完整歷程資料，支援全班、性別、組別與個別學生的描述性分析，並提供研究匯出。</p>
        </div>
        <button className="research-refresh" onClick={load}><RefreshCw size={18} />重新整理</button>
      </header>

      {loading ? <div className="research-loading">正在讀取研究分析資料...</div> : null}
      {error ? <div className="research-error">{error}</div> : null}
      {!loading && payload ? (
        <>
          <section className="research-principle"><b>{payload.philosophy.purpose}</b>：{payload.philosophy.note}<div className="research-meta">資料產生時間：{payload.generatedAt}</div></section>
          <ResearchSummaryCards payload={payload} />

          <section className="research-toolbar" aria-label="研究分析篩選器">
            <label>性別<select value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}>{payload.filters.genders.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
            <label>組別<select value={filters.groupId} onChange={(e) => setFilters((f) => ({ ...f, groupId: e.target.value }))}>{payload.filters.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
            <label>學生<select value={filters.studentId} onChange={(e) => setFilters((f) => ({ ...f, studentId: e.target.value }))}><option value="all">全部學生</option>{payload.filters.students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <div className="research-search"><Search size={16} /><input value={keyword} placeholder="搜尋學生或組別" onChange={(e) => setKeyword(e.target.value)} /></div>
          </section>

          <nav className="research-tabs">{tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>

          {activeTab === 'class' ? <ClassAnalyticsPanel payload={payload} /> : null}
          {activeTab === 'students' ? <StudentDifferenceTable rows={filteredStudents} /> : null}
          {activeTab === 'records' ? <StudentRecordViewer records={filteredRawRecords} /> : null}
          {activeTab === 'genderGroup' ? <GenderGroupAnalysisPanel genderRows={payload.genderAnalysis} groupRows={payload.groupAnalysis} /> : null}
          {activeTab === 'export' ? <ResearchExportPanel files={payload.exports} /> : null}
        </>
      ) : null}
    </div>
  );
}
