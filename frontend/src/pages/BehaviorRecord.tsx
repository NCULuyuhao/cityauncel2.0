/**
 * 教師端｜事後研究工具
 *
 * 個人歷程檢視與研究數據分析分成兩個入口：
 * 1. 個人歷程檢視：單一玩家的行為與文字原始紀錄。
 * 2. 研究數據分析：全班、性別、組別與匯出等描述性統計。
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, ClipboardList, Layers, Map, RefreshCw, Search, UserRound } from 'lucide-react';
import { getTeacherResearchAnalytics } from '../api/teacherDashboardApi';
import ClassAnalyticsPanel from '../features/researchAnalytics/ClassAnalyticsPanel';
import GenderGroupAnalysisPanel from '../features/researchAnalytics/GenderGroupAnalysisPanel';
import ResearchExportPanel from '../features/researchAnalytics/ResearchExportPanel';
import ResearchSummaryCards from '../features/researchAnalytics/ResearchSummaryCards';
import StudentDifferenceTable from '../features/researchAnalytics/StudentDifferenceTable';
import StudentRecordViewer from '../features/researchAnalytics/StudentRecordViewer';
import type { ResearchAnalyticsPayload, ResearchFilterState } from '../features/researchAnalytics/types';

type BehaviorRecordProps = { onBack?: () => void; token?: string | null };
type WorkMode = 'personal' | 'analytics';
type PersonalStage = 'inquiry' | 'map' | 'decision';
type AnalyticsTabId = 'class' | 'students' | 'genderGroup' | 'export';

const personalStages: Array<{ id: PersonalStage; label: string; description: string; icon: typeof ClipboardList }> = [
  { id: 'inquiry', label: '探究書紀錄', description: '從單一玩家出發，看他的探究書、資料卡、證據卡與 AI 使用順序。', icon: ClipboardList },
  { id: 'map', label: '繪製地圖紀錄', description: '從全班地圖紀錄開始，再篩選到小組與個人。', icon: Map },
  { id: 'decision', label: '角色卡包 / 決策卡', description: '角色卡包以全班與小組為單位，不做個人紀錄。', icon: Layers },
];

const analyticsTabs: Array<{ id: AnalyticsTabId; label: string }> = [
  { id: 'class', label: '全班統計' },
  { id: 'students', label: '學生差異' },
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
.research-page{min-height:100vh;padding:28px;background:linear-gradient(135deg,#eef7ff,#fff8ee);color:#263342;font-family:'jf-openhuninn','Noto Sans TC',system-ui,sans-serif}.research-header{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;margin-bottom:18px}.research-header h1{margin:0;font-size:clamp(28px,4vw,42px)}.research-header p{margin:8px 0 0;color:#516273;max-width:980px;line-height:1.7}.research-back,.research-refresh,.research-export-button{border:0;border-radius:999px;padding:11px 16px;background:#263342;color:#fff;cursor:pointer;display:inline-flex;gap:8px;align-items:center;box-shadow:0 8px 20px rgba(38,51,66,.16)}.research-refresh{background:#3578a8}.research-mode-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0}.research-mode-card{border:1px solid rgba(55,96,130,.18);border-radius:24px;padding:18px;background:#fff;box-shadow:0 10px 28px rgba(31,72,100,.08);text-align:left;cursor:pointer;color:#263342}.research-mode-card.active{outline:3px solid rgba(47,120,169,.22);border-color:#3578a8;background:#f8fcff}.research-mode-card h2{display:flex;gap:8px;align-items:center;margin:0 0 8px}.research-mode-card p{margin:0;color:#617083;line-height:1.6}.research-principle{background:#fff;border:1px solid rgba(55,96,130,.16);border-radius:24px;padding:18px 22px;margin:16px 0;box-shadow:0 10px 28px rgba(31,72,100,.08)}.research-principle b{color:#1e638f}.research-toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:rgba(255,255,255,.72);border:1px solid rgba(55,96,130,.14);border-radius:22px;padding:14px;margin:16px 0}.research-toolbar label{display:flex;align-items:center;gap:8px;font-weight:700;color:#385066}.research-toolbar select,.research-toolbar input{border:1px solid rgba(55,96,130,.25);border-radius:14px;padding:10px 12px;background:#fff;min-width:150px}.research-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}.research-tabs button{border:1px solid rgba(55,96,130,.18);background:#fff;border-radius:999px;padding:10px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}.research-tabs button.active{background:#263342;color:#fff}.research-stage-note{margin-top:0}.research-stage-block{display:grid;gap:16px}.research-grid{display:grid;gap:14px}.research-grid--summary{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin:18px 0}.research-card,.research-panel{background:#fff;border:1px solid rgba(55,96,130,.14);border-radius:24px;box-shadow:0 12px 32px rgba(31,72,100,.08)}.research-card--metric{padding:16px;display:flex;gap:12px;align-items:center}.research-icon{width:42px;height:42px;border-radius:16px;background:#eef7ff;color:#2f78a9;display:grid;place-items:center}.research-card__label{font-size:13px;color:#657588}.research-card__value{font-size:26px;font-weight:900;color:#263342}.research-stack{display:grid;gap:16px}.research-panel{padding:20px;overflow:hidden}.research-panel h2{margin:0 0 8px;font-size:24px;display:flex;gap:8px;align-items:center}.research-panel h3{margin:4px 0 10px}.research-panel p{color:#617083;line-height:1.7}.research-kpi-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}.research-kpi-row span{background:#f4f8fb;border-radius:16px;padding:10px 12px}.research-kpi-row--compact span{font-size:14px}.research-two-col{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.research-table-wrap{overflow:auto}.research-table{width:100%;border-collapse:separate;border-spacing:0 8px}.research-table th{text-align:left;font-size:13px;color:#617083;padding:8px 10px;white-space:nowrap}.research-table td{background:#f7fafc;padding:10px;border-top:1px solid rgba(55,96,130,.08);border-bottom:1px solid rgba(55,96,130,.08);vertical-align:top}.research-table td:first-child{border-radius:14px 0 0 14px;border-left:1px solid rgba(55,96,130,.08);font-weight:700}.research-table td:last-child{border-radius:0 14px 14px 0;border-right:1px solid rgba(55,96,130,.08)}.research-table--wide{min-width:980px}.research-profile-card{display:flex;justify-content:space-between;gap:18px;align-items:center;background:#fff;border:1px solid rgba(55,96,130,.14);border-radius:24px;box-shadow:0 12px 32px rgba(31,72,100,.08);padding:20px;margin:18px 0}.research-profile-card h2{font-size:32px;margin:2px 0}.research-eyebrow{font-size:13px;letter-spacing:.08em;color:#3578a8;font-weight:900;margin:0}.research-profile-stats{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.research-profile-stats span{background:#f4f8fb;border-radius:16px;padding:10px 12px}.research-profile-stats b{display:block;font-size:24px}.research-record-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:16px;align-items:start}.research-record-side{display:grid;gap:16px}.research-record-main{min-width:0}.research-subcard{border-left:4px solid #74a9d8;background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 8px 18px rgba(31,72,100,.06)}.research-subcard h3{margin:0 0 8px}.research-dl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px 12px}.research-dl dt{font-weight:900;color:#41566b}.research-dl dd{margin:0;color:#263342;line-height:1.7;word-break:break-word}.research-timeline{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:12px}.research-timeline li{position:relative;border-left:4px solid #9ec5e6;background:#f7fafc;border-radius:16px;padding:12px 14px}.research-timeline__time{font-size:12px;color:#6c7a89}.research-timeline__title{font-weight:900;margin:3px 0}.research-simple-list{margin:10px 0 0;padding-left:20px;line-height:1.8}.research-muted{color:#8996a5}.research-export-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px}.research-export-button{justify-content:center;background:#2d6f47}.research-loading,.research-error{padding:48px;text-align:center}.research-error{color:#a33535}.research-search{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:0 10px;border:1px solid rgba(55,96,130,.25)}.research-search input{border:0;outline:0;min-width:220px}.research-meta{font-size:13px;color:#617083;margin-top:8px}@media(max-width:920px){.research-record-grid{grid-template-columns:1fr}.research-profile-card{display:block}.research-profile-stats{justify-content:flex-start}.research-dl{grid-template-columns:1fr}}@media(max-width:720px){.research-page{padding:16px}.research-header{display:block}.research-back{margin-bottom:12px}.research-toolbar label{width:100%;justify-content:space-between}.research-toolbar select{min-width:50%}}
  `;
}

export default function BehaviorRecord({ onBack, token }: BehaviorRecordProps) {
  const [payload, setPayload] = useState<ResearchAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkMode>('personal');
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>('class');
  const [personalStage, setPersonalStage] = useState<PersonalStage>('inquiry');
  const [selectedMapGroupId, setSelectedMapGroupId] = useState<string>('all');
  const [selectedMapStudentId, setSelectedMapStudentId] = useState<string>('all');
  const [selectedDecisionGroupId, setSelectedDecisionGroupId] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [analyticsFilters, setAnalyticsFilters] = useState<ResearchFilterState>({ gender: 'all', groupId: 'all', studentId: 'all' });
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeacherResearchAnalytics<ResearchAnalyticsPayload>(token || undefined);
      setPayload(data);
      setSelectedStudentId((current) => current || String(data.filters.students[0]?.id || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取資料失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token]);

  const filteredStudents = useMemo(() => {
    const rows = applyFilters(payload?.studentMetrics || [], analyticsFilters);
    const q = keyword.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.username} ${row.groupName} ${row.genderLabel}`.toLowerCase().includes(q));
  }, [payload, analyticsFilters, keyword]);

  const selectedRecord = useMemo(() => {
    const records = payload?.rawStudentRecords || [];
    return records.find((record) => String(record.profile.userId) === String(selectedStudentId)) || records[0] || null;
  }, [payload, selectedStudentId]);

  const analyticsSummaryRows = useMemo(() => {
    if (!payload) return [];
    return applyFilters(payload.studentMetrics || [], analyticsFilters);
  }, [payload, analyticsFilters]);

  return (
    <div className="research-page">
      <style>{researchStyles()}</style>
      <header className="research-header">
        <div>
          {onBack ? <button className="research-back" onClick={onBack}><ArrowLeft size={18} />返回首頁</button> : null}
          <h1>教師端｜事後研究工具</h1>
          <p>個人歷程檢視與研究數據分析分開呈現：前者查看單一玩家原始紀錄，後者進行全班、性別、組別與匯出整理。</p>
        </div>
        <button className="research-refresh" onClick={load}><RefreshCw size={18} />重新整理</button>
      </header>

      {loading ? <div className="research-loading">正在讀取研究資料...</div> : null}
      {error ? <div className="research-error">{error}</div> : null}

      {!loading && payload ? (
        <>
          <section className="research-principle"><b>{payload.philosophy.purpose}</b>：{payload.philosophy.note}<div className="research-meta">資料產生時間：{payload.generatedAt}</div></section>

          <div className="research-mode-grid" aria-label="教師端研究工具入口">
            <button className={`research-mode-card ${mode === 'personal' ? 'active' : ''}`} onClick={() => setMode('personal')}>
              <h2><UserRound size={22} />個人歷程檢視</h2>
              <p>選擇一位學生，查看他的遊戲行為紀錄、探究書文字、AI 使用順序、資料卡、地圖與稱號。</p>
            </button>
            <button className={`research-mode-card ${mode === 'analytics' ? 'active' : ''}`} onClick={() => setMode('analytics')}>
              <h2><BarChart3 size={22} />研究數據分析</h2>
              <p>整理全班、性別、組別與學生差異的描述性統計，並提供研究資料匯出。</p>
            </button>
          </div>

          {mode === 'personal' ? (
            <>
              <nav className="research-tabs research-stage-tabs" aria-label="個人歷程檢視階段">
                {personalStages.map((stage) => {
                  const Icon = stage.icon;
                  return <button key={stage.id} className={personalStage === stage.id ? 'active' : ''} onClick={() => setPersonalStage(stage.id)}><Icon size={16} />{stage.label}</button>;
                })}
              </nav>
              <section className="research-principle research-stage-note">
                <b>{personalStages.find((stage) => stage.id === personalStage)?.label}</b>：{personalStages.find((stage) => stage.id === personalStage)?.description}
              </section>
              {personalStage === 'inquiry' ? (
                <section className="research-toolbar" aria-label="探究書個人篩選器">
                  <label>選擇學生
                    <select value={selectedStudentId || String(payload.filters.students[0]?.id || '')} onChange={(e) => setSelectedStudentId(e.target.value)}>
                      {payload.filters.students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
                    </select>
                  </label>
                </section>
              ) : null}
              <StudentRecordViewer
                stage={personalStage}
                record={selectedRecord}
                stageRecords={payload.stageRecords}
                groups={payload.filters.groups}
                students={payload.filters.students}
                selectedMapGroupId={selectedMapGroupId}
                selectedMapStudentId={selectedMapStudentId}
                selectedDecisionGroupId={selectedDecisionGroupId}
                onMapGroupChange={setSelectedMapGroupId}
                onMapStudentChange={setSelectedMapStudentId}
                onDecisionGroupChange={setSelectedDecisionGroupId}
              />
            </>
          ) : (
            <>
              <ResearchSummaryCards payload={payload} metrics={analyticsSummaryRows} />
              <section className="research-toolbar" aria-label="研究數據分析篩選器">
                <label>性別<select value={analyticsFilters.gender} onChange={(e) => setAnalyticsFilters((f) => ({ ...f, gender: e.target.value }))}>{payload.filters.genders.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
                <label>組別<select value={analyticsFilters.groupId} onChange={(e) => setAnalyticsFilters((f) => ({ ...f, groupId: e.target.value }))}>{payload.filters.groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
                <div className="research-search"><Search size={16} /><input value={keyword} placeholder="搜尋學生或組別" onChange={(e) => setKeyword(e.target.value)} /></div>
              </section>
              <nav className="research-tabs">{analyticsTabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
              {activeTab === 'class' ? <ClassAnalyticsPanel payload={payload} /> : null}
              {activeTab === 'students' ? <StudentDifferenceTable rows={filteredStudents} /> : null}
              {activeTab === 'genderGroup' ? <GenderGroupAnalysisPanel genderRows={payload.genderAnalysis} groupRows={payload.groupAnalysis} /> : null}
              {activeTab === 'export' ? <ResearchExportPanel files={payload.exports} /> : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
