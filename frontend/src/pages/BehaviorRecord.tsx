/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 BehaviorRecord，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTeacherLearningDashboard } from "../api/teacherDashboardApi";

type TabId = "overview" | "students" | "inquiries" | "classStats" | "cards" | "groups" | "methods";
type Option = { id: string | number; label: string; [key: string]: unknown };

type ClassMetricRow = {
  id: string;
  category: string;
  label: string;
  unit: string;
  valueType: "number" | "percent" | string;
  description: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
};

type StudentMetricRow = {
  userId: number;
  username: string;
  groupId: string;
  groupName: string;
  isGroupLeader: boolean;
  inquiryCount: number;
  completedInquiryCount: number;
  draftInquiryCount: number;
  completionRate: number;
  totalUsedCardsInInquiries: number;
  totalUnlockedCardsInInquiries: number;
  totalEvidenceCardsInInquiries: number;
  avgCardsPerInquiry: number;
  avgUnlockedCardsPerInquiry: number;
  avgEvidenceCardsPerInquiry: number;
  evidenceConversionRate: number;
  uniqueUnlockedCardCount: number;
  uniqueInquiryCardCount: number;
  uniqueEvidenceCardCount: number;
  uniqueEvidenceConversionRate: number;
  categoryDiversity: number;
  evidenceCategoryDiversity: number;
  maxCardsInSingleInquiry: number;
  minCardsInSingleInquiry: number;
  maxEvidenceCardsInSingleInquiry: number;
  minEvidenceCardsInSingleInquiry: number;
  orientationAnswerCount: number;
  collectionNoteCount: number;
  avgCollectionNoteLength: number;
  conclusionTextTotal: number;
  avgConclusionLength: number;
  mapDistrictCount: number;
  mapChoiceCount: number;
  mapActionCount: number;
  mapChangeCount: number;
  voteRankCount: number;
  hasCompletedVote: boolean;
  aiUnlockCount: number;
  aiRecordCount: number;
  aiRequestCount: number;
  aiCheckCount: number;
  aiReferencedCardCount: number;
  cardPackLockCount: number;
  cardPackSelectedCardCount: number;
  avgCardPackReasonLength: number;
  overallEventCount: number;
  activeDays: number;
  firstAt?: string | null;
  lastAt?: string | null;
};

type InquiryMetricRow = {
  inquiryRecordId: number;
  recordOrder: number;
  userId: number;
  username: string;
  groupId: string;
  groupName: string;
  status: "completed" | "draft" | string;
  statusLabel: string;
  usedCardCount: number;
  unlockedCardCount: number;
  evidenceCardCount: number;
  evidenceConversionRate: number;
  usedCategoryCount: number;
  evidenceCategoryCount: number;
  collectionNoteCount: number;
  collectionNoteCardCount: number;
  noteCoverageRate: number;
  noteTextLength: number;
  avgNoteLength: number;
  orientationAnswerCount: number;
  orientationTextLength: number;
  conclusionTextLength: number;
  durationMinutes: number;
  cardIds: string[];
  evidenceCardIds: string[];
  categoryLabels: string[];
  evidenceCategoryLabels: string[];
  startedAt?: string | null;
  endedAt?: string | null;
};

type GroupMetricRow = {
  groupId: string;
  groupName: string;
  studentCount: number;
  inquiryCount: number;
  completedInquiryCount: number;
  avgInquiryPerStudent: number;
  avgCompletedInquiryPerStudent: number;
  avgCardsPerInquiry: number;
  avgEvidenceCardsPerInquiry: number;
  evidenceConversionRate: number;
  mapActionCount: number;
  mapChangeCount: number;
  aiRecordCount: number;
  cardPackLockCount: number;
  cardPackSelectedCardCount: number;
  avgCardPackReasonLength: number;
};

type CategoryMetricRow = {
  category: string;
  categoryLabel: string;
  usedInInquiryCount: number;
  evidenceCount: number;
  evidenceConversionRate: number;
  globalUnlockCount: number;
  noteReferenceCount: number;
  cardPackSelectedCount: number;
  aiReferencedCount: number;
  uniqueStudentsUsed: number;
  uniqueStudentsEvidence: number;
};

type CardMetricRow = {
  cardId: string;
  title: string;
  category?: string | null;
  categoryLabel?: string | null;
  openCount: number;
  unlockCount: number;
  evidenceCount: number;
  noteReferenceCount: number;
  decisionSelectedCount: number;
  aiReferencedCount: number;
  uniqueUnlockStudents: number;
  uniqueEvidenceStudents: number;
};

type MetricDefinition = { id: string; category: string; label: string; unit: string; description: string };
type AnalysisView = {
  id: string;
  title: string;
  purpose: string;
  rows: string;
  mainMetrics: string[];
  usefulFilters: string[];
  visualizations: string[];
};

type MetricDashboard = {
  classMetrics: Record<string, number | string>;
  classMetricRows: ClassMetricRow[];
  studentMetricRows: StudentMetricRow[];
  inquiryMetricRows: InquiryMetricRow[];
  groupMetricRows: GroupMetricRow[];
  categoryMetricRows: CategoryMetricRow[];
  metricDefinitions: MetricDefinition[];
  analysisViews: AnalysisView[];
};

type DashboardPayload = {
  overview?: {
    totalStudents: number;
    totalEvents: number;
    dataSourceCount: number;
  };
  cards?: CardMetricRow[];
  filterDimensions?: {
    groups?: Option[];
    students?: Option[];
  };
  metrics: MetricDashboard;
};

type BehaviorRecordProps = { onBack?: () => void; token?: string | null };

type FiltersState = {
  groupId: string;
  studentId: string;
  metricCategory: string;
  inquiryStatus: string;
  search: string;
};

type TabItem = { id: TabId; label: string; description: string; icon: LucideIcon };

type SummaryStats = {
  studentCount: number;
  inquiryCount: number;
  completedInquiryCount: number;
  completionRate: number;
  avgInquiryPerStudent: number;
  avgCompletedInquiryPerStudent: number;
  avgCardsPerInquiry: number;
  avgUnlockedCardsPerInquiry: number;
  avgEvidenceCardsPerInquiry: number;
  evidenceConversionRate: number;
  avgStudentEvidenceConversionRate: number;
  maxCardsPerInquiry: number;
  minCardsPerInquiry: number;
  maxEvidenceConversionRate: number;
  minEvidenceConversionRate: number;
  avgMapDistrictsPerStudent: number;
  avgAiRecordsPerStudent: number;
};

const TABS: TabItem[] = [
  { id: "overview", label: "核心指標", description: "平均、最大、最小、比例", icon: BarChart3 },
  { id: "students", label: "學生摘要", description: "一位學生一列", icon: Users },
  { id: "inquiries", label: "調查書明細", description: "一份調查書一列", icon: FileText },
  { id: "classStats", label: "全班統計", description: "描述統計指標表", icon: FileSpreadsheet },
  { id: "cards", label: "資料卡轉換", description: "用卡、證據、理由、卡包", icon: Layers3 },
  { id: "groups", label: "小組比較", description: "小組層級指標", icon: Boxes },
  { id: "methods", label: "指標規劃", description: "量化、質性、視覺化", icon: ClipboardList },
];

const INITIAL_FILTERS: FiltersState = {
  groupId: "all",
  studentId: "all",
  metricCategory: "all",
  inquiryStatus: "all",
  search: "",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function number(value: number | string | null | undefined, digits = 0) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "0";
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? 0 : 0 }).format(numericValue);
}

function percent(value: number | string | null | undefined, digits = 1) {
  return `${number(value, digits)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "尚無紀錄";
  try {
    return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function safeDivide(numerator: number, denominator: number, digits = 2) {
  if (!denominator) return 0;
  const base = 10 ** digits;
  return Math.round((numerator / denominator) * base) / base;
}

function safePercent(numerator: number, denominator: number, digits = 1) {
  if (!denominator) return 0;
  const base = 10 ** digits;
  return Math.round((numerator / denominator) * 100 * base) / base;
}

function stats(values: number[]) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (cleanValues.length === 0) return { avg: 0, min: 0, max: 0 };
  return {
    avg: safeDivide(cleanValues.reduce((sum, value) => sum + value, 0), cleanValues.length),
    min: Math.min(...cleanValues),
    max: Math.max(...cleanValues),
  };
}

function includesQuery(values: Array<unknown>, query: string) {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const escape = (value: string | number | boolean | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildSummaryStats(students: StudentMetricRow[], inquiries: InquiryMetricRow[]): SummaryStats {
  const usedCards = inquiries.reduce((sum, inquiry) => sum + inquiry.usedCardCount, 0);
  const unlockedCards = inquiries.reduce((sum, inquiry) => sum + inquiry.unlockedCardCount, 0);
  const evidenceCards = inquiries.reduce((sum, inquiry) => sum + inquiry.evidenceCardCount, 0);
  const completedInquiryCount = inquiries.filter((inquiry) => inquiry.status === "completed").length;
  const cardStats = stats(inquiries.map((inquiry) => inquiry.usedCardCount));
  const evidenceConversionStats = stats(students.map((student) => student.evidenceConversionRate));
  return {
    studentCount: students.length,
    inquiryCount: inquiries.length,
    completedInquiryCount,
    completionRate: safePercent(completedInquiryCount, inquiries.length),
    avgInquiryPerStudent: safeDivide(inquiries.length, students.length),
    avgCompletedInquiryPerStudent: safeDivide(completedInquiryCount, students.length),
    avgCardsPerInquiry: safeDivide(usedCards, inquiries.length),
    avgUnlockedCardsPerInquiry: safeDivide(unlockedCards, inquiries.length),
    avgEvidenceCardsPerInquiry: safeDivide(evidenceCards, inquiries.length),
    evidenceConversionRate: safePercent(evidenceCards, usedCards),
    avgStudentEvidenceConversionRate: evidenceConversionStats.avg,
    maxCardsPerInquiry: cardStats.max,
    minCardsPerInquiry: cardStats.min,
    maxEvidenceConversionRate: evidenceConversionStats.max,
    minEvidenceConversionRate: evidenceConversionStats.min,
    avgMapDistrictsPerStudent: stats(students.map((student) => student.mapDistrictCount)).avg,
    avgAiRecordsPerStudent: stats(students.map((student) => student.aiRecordCount)).avg,
  };
}

function ShellCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.06),transparent_28%)]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.26em] text-sky-700">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {description ? <p className="mt-2 max-w-5xl text-sm font-medium leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">{text}</div>;
}

function KpiCard({ label, value, hint, icon: Icon, accent = "sky" }: { label: string; value: string | number; hint: string; icon: LucideIcon; accent?: "sky" | "violet" | "emerald" | "amber" }) {
  const tone = {
    sky: "border-sky-100 bg-sky-50 text-sky-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }[accent];
  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={cx("rounded-2xl border p-3", tone)}><Icon size={22} /></div>
      </div>
      <p className="mt-4 text-sm font-medium leading-6 text-slate-600">{hint}</p>
    </ShellCard>
  );
}

function MiniMetric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SelectBox({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
      >
        {options.map((option) => <option key={String(option.id)} value={String(option.id)}>{option.label}</option>)}
      </select>
    </label>
  );
}

function FilterPanel({ data, filters, setFilters, visibleStats }: { data: MetricDashboard; filters: FiltersState; setFilters: (filters: FiltersState) => void; visibleStats: SummaryStats }) {
  const groups = data.groupMetricRows.map((group) => ({ id: group.groupId, label: group.groupName }));
  const students = data.studentMetricRows.map((student) => ({ id: student.userId, label: `${student.username}｜${student.groupName}` }));
  const categories = Array.from(new Set(data.classMetricRows.map((metric) => metric.category))).map((category) => ({ id: category, label: category }));
  const set = (key: keyof FiltersState, value: string) => setFilters({ ...filters, [key]: value });
  return (
    <ShellCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle eyebrow="Filters" title="指標篩選器" description="篩選後會重新呈現學生、單份調查書、小組與指標表。這裡只整理數據，不替結果下結論。" />
        <div className="grid grid-cols-2 gap-3 text-right">
          <MiniMetric label="目前學生" value={`${number(visibleStats.studentCount)} 人`} />
          <MiniMetric label="目前調查書" value={`${number(visibleStats.inquiryCount)} 份`} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SelectBox label="小組" value={filters.groupId} options={[{ id: "all", label: "全部小組" }, ...groups]} onChange={(value) => set("groupId", value)} />
        <SelectBox label="學生" value={filters.studentId} options={[{ id: "all", label: "全部學生" }, ...students]} onChange={(value) => set("studentId", value)} />
        <SelectBox label="指標類別" value={filters.metricCategory} options={[{ id: "all", label: "全部指標" }, ...categories]} onChange={(value) => set("metricCategory", value)} />
        <SelectBox label="調查書狀態" value={filters.inquiryStatus} options={[{ id: "all", label: "全部" }, { id: "completed", label: "已完成" }, { id: "draft", label: "草稿／未送出" }]} onChange={(value) => set("inquiryStatus", value)} />
        <label className="block">
          <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">關鍵字</span>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={filters.search}
              onChange={(event) => set("search", event.target.value)}
              placeholder="學生、小組、指標、卡片、類型"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
            />
          </div>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilters(INITIAL_FILTERS)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50">清除篩選</button>
        <span className="rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-black text-violet-700">主表單位：學生、單份調查書、全班描述統計、卡片類型、小組</span>
      </div>
    </ShellCard>
  );
}

function CoreIndicatorPanel({ stats: visibleStats, classStats }: { stats: SummaryStats; classStats: Record<string, number | string> }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="平均完成調查書" value={`${number(visibleStats.avgCompletedInquiryPerStudent, 2)} 份/人`} hint={`目前完成 ${number(visibleStats.completedInquiryCount)} 份；完成率 ${percent(visibleStats.completionRate)}`} icon={FileText} accent="sky" />
        <KpiCard label="平均每份用卡" value={`${number(visibleStats.avgCardsPerInquiry, 2)} 張`} hint={`最大 ${number(visibleStats.maxCardsPerInquiry)} 張；最小 ${number(visibleStats.minCardsPerInquiry)} 張`} icon={Layers3} accent="violet" />
        <KpiCard label="平均每份解鎖卡" value={`${number(visibleStats.avgUnlockedCardsPerInquiry, 2)} 張`} hint="以每份調查書實際帶入／引用的卡片數計算" icon={Database} accent="emerald" />
        <KpiCard label="用卡轉證據比例" value={percent(visibleStats.evidenceConversionRate)} hint={`學生平均 ${percent(visibleStats.avgStudentEvidenceConversionRate)}；最大 ${percent(visibleStats.maxEvidenceConversionRate)}；最小 ${percent(visibleStats.minEvidenceConversionRate)}`} icon={Sparkles} accent="amber" />
      </div>

      <ShellCard className="p-6">
        <SectionTitle eyebrow="Class benchmark" title="全班核心平均／最大／最小" description="這裡是你舉例的那種資料：完成幾份、每份用幾張卡、平均解鎖幾張、轉成證據比例多少，以及最大最小值。篩選後的結果顯示在上方，全班基準顯示在下方。" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniMetric label="全班學生數" value={`${number(classStats.totalStudents as number)} 人`} hint={`有調查書 ${number(classStats.studentsWithInquiryCount as number)} 人`} />
          <MiniMetric label="全班平均調查書" value={`${number(classStats.avgInquiryPerStudent as number, 2)} 份/人`} hint={`完成平均 ${number(classStats.avgCompletedInquiryPerStudent as number, 2)} 份/人`} />
          <MiniMetric label="全班平均用卡" value={`${number(classStats.avgCardsPerInquiry as number, 2)} 張/份`} hint={`最大 ${number(classStats.maxCardsPerInquiry as number)}｜最小 ${number(classStats.minCardsPerInquiry as number)}`} />
          <MiniMetric label="全班轉證據比例" value={percent(classStats.evidenceConversionRate as number)} hint={`學生最大 ${percent(classStats.maxEvidenceConversionRate as number)}｜最小 ${percent(classStats.minEvidenceConversionRate as number)}`} />
          <MiniMetric label="全班解鎖卡總量" value={`${number(classStats.totalGlobalUnlockedCards as number)} 張次`} hint={`平均 ${number(classStats.avgGlobalUnlockedCardsPerStudent as number, 2)} 張/人`} />
          <MiniMetric label="理由資料" value={`${number(classStats.totalCollectionNotes as number)} 筆`} hint={`平均 ${number(classStats.avgCollectionNotesPerInquiry as number, 2)} 筆/調查書`} />
          <MiniMetric label="任務二地圖" value={`${number(classStats.totalMapChoices as number)} 個人選擇`} hint={`平均 ${number(classStats.avgMapDistrictsPerStudent as number, 2)} 區/人`} />
          <MiniMetric label="AI 使用" value={`${number(classStats.aiUserCount as number)} 人`} hint={`平均 ${number(classStats.avgAiRecordsPerStudent as number, 2)} 筆/人`} />
        </div>
      </ShellCard>
    </div>
  );
}

function StudentsPanel({ students }: { students: StudentMetricRow[] }) {
  return (
    <div className="space-y-6">
      <ShellCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Student table" title="學生摘要指標表" description="一位學生一列。可以看單一學生總共完成幾份調查書、平均每份用幾張卡、解鎖卡轉證據比例、任務二、卡包與 AI 使用資料。" />
          <button
            type="button"
            onClick={() => downloadCsv(
              "student-metric-summary.csv",
              ["學生", "小組", "調查書份數", "完成份數", "完成率", "平均用卡", "平均解鎖卡", "平均證據卡", "用卡轉證據%", "不重複解鎖卡", "不重複證據卡", "不重複轉證據%", "最大單份用卡", "最小單份用卡", "資料類型數", "理由筆數", "平均理由字數", "地圖地區數", "地圖改變", "AI筆數", "卡包送出"],
              students.map((s) => [s.username, s.groupName, s.inquiryCount, s.completedInquiryCount, s.completionRate, s.avgCardsPerInquiry, s.avgUnlockedCardsPerInquiry, s.avgEvidenceCardsPerInquiry, s.evidenceConversionRate, s.uniqueUnlockedCardCount, s.uniqueEvidenceCardCount, s.uniqueEvidenceConversionRate, s.maxCardsInSingleInquiry, s.minCardsInSingleInquiry, s.categoryDiversity, s.collectionNoteCount, s.avgCollectionNoteLength, s.mapDistrictCount, s.mapChangeCount, s.aiRecordCount, s.cardPackLockCount]),
            )}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-100"
          >
            <Download size={18} /> 匯出學生指標
          </button>
        </div>
      </ShellCard>
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1680px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4">學生</th>
                <th className="px-4 py-4">小組</th>
                <th className="px-4 py-4">調查書</th>
                <th className="px-4 py-4">完成</th>
                <th className="px-4 py-4">完成率</th>
                <th className="px-4 py-4">平均用卡</th>
                <th className="px-4 py-4">平均解鎖</th>
                <th className="px-4 py-4">平均證據</th>
                <th className="px-4 py-4">轉證據</th>
                <th className="px-4 py-4">不重複解鎖/證據</th>
                <th className="px-4 py-4">單份用卡 Max/Min</th>
                <th className="px-4 py-4">類型數</th>
                <th className="px-4 py-4">理由</th>
                <th className="px-4 py-4">地圖</th>
                <th className="px-4 py-4">AI</th>
                <th className="px-4 py-4">卡包</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {students.length === 0 ? (
                <tr><td colSpan={16} className="px-6 py-10 text-center font-bold text-slate-500">目前篩選條件下沒有學生。</td></tr>
              ) : students.map((student) => (
                <tr key={student.userId} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-black text-slate-900">{student.username}</td>
                  <td className="px-4 py-4 font-medium text-slate-600">{student.groupName}{student.isGroupLeader ? "｜組長" : ""}</td>
                  <td className="px-4 py-4 font-bold">{number(student.inquiryCount)} 份</td>
                  <td className="px-4 py-4 font-bold">{number(student.completedInquiryCount)} 份</td>
                  <td className="px-4 py-4 font-bold">{percent(student.completionRate)}</td>
                  <td className="px-4 py-4 font-bold">{number(student.avgCardsPerInquiry, 2)}</td>
                  <td className="px-4 py-4 font-bold">{number(student.avgUnlockedCardsPerInquiry, 2)}</td>
                  <td className="px-4 py-4 font-bold">{number(student.avgEvidenceCardsPerInquiry, 2)}</td>
                  <td className="px-4 py-4 font-bold text-sky-700">{percent(student.evidenceConversionRate)}</td>
                  <td className="px-4 py-4 font-bold">{student.uniqueUnlockedCardCount}/{student.uniqueEvidenceCardCount}｜{percent(student.uniqueEvidenceConversionRate)}</td>
                  <td className="px-4 py-4 font-bold">{number(student.maxCardsInSingleInquiry)}/{number(student.minCardsInSingleInquiry)}</td>
                  <td className="px-4 py-4 font-bold">用卡 {student.categoryDiversity}｜證據 {student.evidenceCategoryDiversity}</td>
                  <td className="px-4 py-4 font-bold">{student.collectionNoteCount} 筆｜{number(student.avgCollectionNoteLength, 1)} 字</td>
                  <td className="px-4 py-4 font-bold">{student.mapDistrictCount} 區｜改 {student.mapChangeCount}</td>
                  <td className="px-4 py-4 font-bold">{student.aiRecordCount} 筆｜查 {student.aiCheckCount}</td>
                  <td className="px-4 py-4 font-bold">送出 {student.cardPackLockCount}｜選卡 {student.cardPackSelectedCardCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

function InquiryPanel({ inquiries }: { inquiries: InquiryMetricRow[] }) {
  return (
    <div className="space-y-6">
      <ShellCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Inquiry detail" title="單份調查書明細表" description="一份調查書一列。這張表直接回答：某位學生某一份調查書用了幾張卡、幾張轉成證據、比例多少、理由與結論留下多少文字。" />
          <button
            type="button"
            onClick={() => downloadCsv(
              "inquiry-detail-metrics.csv",
              ["學生", "小組", "調查書序號", "狀態", "用卡數", "解鎖卡數", "證據卡數", "轉證據%", "用卡類型數", "證據類型數", "理由筆數", "理由關聯卡數", "理由覆蓋%", "理由字數", "前導回答", "結論字數", "開始", "結束"],
              inquiries.map((i) => [i.username, i.groupName, i.recordOrder, i.statusLabel, i.usedCardCount, i.unlockedCardCount, i.evidenceCardCount, i.evidenceConversionRate, i.usedCategoryCount, i.evidenceCategoryCount, i.collectionNoteCount, i.collectionNoteCardCount, i.noteCoverageRate, i.noteTextLength, i.orientationAnswerCount, i.conclusionTextLength, formatDateTime(i.startedAt), formatDateTime(i.endedAt)]),
            )}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-100"
          >
            <Download size={18} /> 匯出調查書明細
          </button>
        </div>
      </ShellCard>
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1560px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-4">學生</th>
                <th className="px-4 py-4">小組</th>
                <th className="px-4 py-4">第幾份</th>
                <th className="px-4 py-4">狀態</th>
                <th className="px-4 py-4">用卡</th>
                <th className="px-4 py-4">證據</th>
                <th className="px-4 py-4">轉證據</th>
                <th className="px-4 py-4">資料類型</th>
                <th className="px-4 py-4">理由</th>
                <th className="px-4 py-4">理由覆蓋</th>
                <th className="px-4 py-4">前導回答</th>
                <th className="px-4 py-4">結論字數</th>
                <th className="px-4 py-4">卡片</th>
                <th className="px-4 py-4">證據卡</th>
                <th className="px-4 py-4">時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {inquiries.length === 0 ? (
                <tr><td colSpan={15} className="px-6 py-10 text-center font-bold text-slate-500">目前篩選條件下沒有調查書。</td></tr>
              ) : inquiries.map((inquiry) => (
                <tr key={inquiry.inquiryRecordId} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-black text-slate-900">{inquiry.username}</td>
                  <td className="px-4 py-4 font-medium text-slate-600">{inquiry.groupName}</td>
                  <td className="px-4 py-4 font-bold">第 {number(inquiry.recordOrder)} 份</td>
                  <td className="px-4 py-4"><span className={cx("rounded-full px-3 py-1 text-xs font-black", inquiry.status === "completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200")}>{inquiry.statusLabel}</span></td>
                  <td className="px-4 py-4 font-bold">{number(inquiry.usedCardCount)} 張</td>
                  <td className="px-4 py-4 font-bold">{number(inquiry.evidenceCardCount)} 張</td>
                  <td className="px-4 py-4 font-bold text-sky-700">{percent(inquiry.evidenceConversionRate)}</td>
                  <td className="px-4 py-4 font-bold">用卡 {inquiry.usedCategoryCount}｜證據 {inquiry.evidenceCategoryCount}</td>
                  <td className="px-4 py-4 font-bold">{inquiry.collectionNoteCount} 筆｜{number(inquiry.noteTextLength)} 字</td>
                  <td className="px-4 py-4 font-bold">{percent(inquiry.noteCoverageRate)}</td>
                  <td className="px-4 py-4 font-bold">{inquiry.orientationAnswerCount}</td>
                  <td className="px-4 py-4 font-bold">{number(inquiry.conclusionTextLength)}</td>
                  <td className="max-w-[260px] px-4 py-4 text-xs font-medium leading-5 text-slate-500">{inquiry.cardIds.join("、") || "-"}</td>
                  <td className="max-w-[220px] px-4 py-4 text-xs font-medium leading-5 text-slate-500">{inquiry.evidenceCardIds.join("、") || "-"}</td>
                  <td className="px-4 py-4 text-xs font-medium leading-5 text-slate-500">{formatDateTime(inquiry.startedAt)} → {formatDateTime(inquiry.endedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

function ClassStatsPanel({ metrics }: { metrics: ClassMetricRow[] }) {
  return (
    <div className="space-y-6">
      <ShellCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Descriptive statistics" title="全班描述統計表" description="每一列是一個可分析指標，包含樣本數、總量、平均、最小、最大與中位數。你可以依指標類別篩選後匯出。" />
          <button
            type="button"
            onClick={() => downloadCsv("class-descriptive-statistics.csv", ["類別", "指標", "樣本數", "總量", "平均", "最小", "最大", "中位數", "單位", "說明"], metrics.map((m) => [m.category, m.label, m.count, m.sum, m.avg, m.min, m.max, m.median, m.unit, m.description]))}
            className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-100"
          >
            <Download size={18} /> 匯出描述統計
          </button>
        </div>
      </ShellCard>
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              <tr><th className="px-5 py-4">類別</th><th className="px-4 py-4">指標</th><th className="px-4 py-4">平均</th><th className="px-4 py-4">最大</th><th className="px-4 py-4">最小</th><th className="px-4 py-4">中位數</th><th className="px-4 py-4">總量</th><th className="px-4 py-4">樣本</th><th className="px-4 py-4">說明</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {metrics.map((metric) => (
                <tr key={metric.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4"><span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">{metric.category}</span></td>
                  <td className="px-4 py-4 font-black text-slate-900">{metric.label}</td>
                  <td className="px-4 py-4 font-bold">{metric.valueType === "percent" ? percent(metric.avg) : `${number(metric.avg, 2)} ${metric.unit}`}</td>
                  <td className="px-4 py-4 font-bold">{metric.valueType === "percent" ? percent(metric.max) : `${number(metric.max, 2)} ${metric.unit}`}</td>
                  <td className="px-4 py-4 font-bold">{metric.valueType === "percent" ? percent(metric.min) : `${number(metric.min, 2)} ${metric.unit}`}</td>
                  <td className="px-4 py-4 font-bold">{metric.valueType === "percent" ? percent(metric.median) : `${number(metric.median, 2)} ${metric.unit}`}</td>
                  <td className="px-4 py-4 font-bold">{number(metric.sum, 2)}</td>
                  <td className="px-4 py-4 font-bold">{number(metric.count)}</td>
                  <td className="max-w-[360px] px-4 py-4 text-sm font-medium leading-6 text-slate-600">{metric.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

function CardsPanel({ categories, cards }: { categories: CategoryMetricRow[]; cards: CardMetricRow[] }) {
  const sortedCards = [...cards].sort((a, b) => (b.evidenceCount + b.noteReferenceCount + b.decisionSelectedCount) - (a.evidenceCount + a.noteReferenceCount + a.decisionSelectedCount)).slice(0, 80);
  return (
    <div className="space-y-6">
      <ShellCard className="p-6">
        <SectionTitle eyebrow="Card conversion" title="資料卡與資料類型轉換表" description="這裡不是判斷哪張卡有效，而是把『使用、轉證據、寫理由、被卡包選入、被 AI 引用』這些可追溯數據拆出來。" />
      </ShellCard>
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ShellCard className="p-6">
          <SectionTitle eyebrow="Category" title="資料類型統計" />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-4 py-3">類型</th><th className="px-4 py-3">用卡</th><th className="px-4 py-3">證據</th><th className="px-4 py-3">轉證據</th><th className="px-4 py-3">理由</th><th className="px-4 py-3">卡包</th><th className="px-4 py-3">AI</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {categories.map((category) => <tr key={category.category} className="hover:bg-slate-50"><td className="px-4 py-3 font-black text-slate-900">{category.categoryLabel}</td><td className="px-4 py-3 font-bold">{category.usedInInquiryCount}</td><td className="px-4 py-3 font-bold">{category.evidenceCount}</td><td className="px-4 py-3 font-bold text-sky-700">{percent(category.evidenceConversionRate)}</td><td className="px-4 py-3 font-bold">{category.noteReferenceCount}</td><td className="px-4 py-3 font-bold">{category.cardPackSelectedCount}</td><td className="px-4 py-3 font-bold">{category.aiReferencedCount}</td></tr>)}
              </tbody>
            </table>
          </div>
        </ShellCard>
        <ShellCard className="p-6">
          <SectionTitle eyebrow="Card ranking" title="單張資料卡統計" description="列出前 80 張較常出現在證據、理由或卡包的卡片。" />
          <div className="mt-5 max-h-[620px] overflow-y-auto pr-2">
            {sortedCards.length === 0 ? <EmptyState text="目前沒有資料卡統計。" /> : <div className="space-y-3">{sortedCards.map((card) => <div key={card.cardId} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-900">{card.title || card.cardId}</p><p className="mt-1 text-xs font-medium text-slate-500">{card.categoryLabel || "未分類"}｜{card.cardId}</p></div><span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">證據 {card.evidenceCount}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600"><span>解鎖 {card.unlockCount}</span><span>理由 {card.noteReferenceCount}</span><span>卡包 {card.decisionSelectedCount}</span><span>AI {card.aiReferencedCount}</span><span>證據學生 {card.uniqueEvidenceStudents}</span><span>解鎖學生 {card.uniqueUnlockStudents}</span></div></div>)}</div>}
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

function GroupsPanel({ groups }: { groups: GroupMetricRow[] }) {
  return (
    <div className="space-y-6">
      <ShellCard className="p-6"><SectionTitle eyebrow="Group table" title="小組比較指標表" description="一個小組一列。用來比較小組在調查書、用卡、證據、地圖、卡包與 AI 的資料量。" /></ShellCard>
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-5 py-4">小組</th><th className="px-4 py-4">人數</th><th className="px-4 py-4">調查書</th><th className="px-4 py-4">完成</th><th className="px-4 py-4">平均份數/人</th><th className="px-4 py-4">平均用卡/份</th><th className="px-4 py-4">平均證據/份</th><th className="px-4 py-4">轉證據</th><th className="px-4 py-4">地圖操作</th><th className="px-4 py-4">AI</th><th className="px-4 py-4">卡包</th></tr></thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {groups.map((group) => <tr key={group.groupId} className="hover:bg-slate-50"><td className="px-5 py-4 font-black text-slate-900">{group.groupName}</td><td className="px-4 py-4 font-bold">{group.studentCount}</td><td className="px-4 py-4 font-bold">{group.inquiryCount}</td><td className="px-4 py-4 font-bold">{group.completedInquiryCount}</td><td className="px-4 py-4 font-bold">{number(group.avgInquiryPerStudent, 2)}</td><td className="px-4 py-4 font-bold">{number(group.avgCardsPerInquiry, 2)}</td><td className="px-4 py-4 font-bold">{number(group.avgEvidenceCardsPerInquiry, 2)}</td><td className="px-4 py-4 font-bold text-sky-700">{percent(group.evidenceConversionRate)}</td><td className="px-4 py-4 font-bold">{group.mapActionCount}｜改 {group.mapChangeCount}</td><td className="px-4 py-4 font-bold">{group.aiRecordCount}</td><td className="px-4 py-4 font-bold">鎖 {group.cardPackLockCount}｜選 {group.cardPackSelectedCardCount}</td></tr>)}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

function MethodsPanel({ definitions, views }: { definitions: MetricDefinition[]; views: AnalysisView[] }) {
  return (
    <div className="space-y-6">
      <ShellCard className="p-6"><SectionTitle eyebrow="Metric plan" title="本次資料分析系統規劃" description="這裡列出系統會幫你整理出的分析表、指標定義、適合的篩選條件與視覺化方式。重點是提供可解釋的資料切面，不自動替你下成效結論。" /></ShellCard>
      <div className="grid gap-5 xl:grid-cols-2">
        {views.map((view) => <ShellCard key={view.id} className="p-6"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">{view.id}</p><h3 className="mt-2 text-xl font-black text-slate-900">{view.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{view.purpose}</p><p className="mt-3 text-sm font-black text-slate-900">資料列單位：{view.rows}</p><div className="mt-5 grid gap-4 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="text-sm font-black text-slate-900">主要指標</p><div className="mt-3 flex flex-wrap gap-2">{view.mainMetrics.map((item) => <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{item}</span>)}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="text-sm font-black text-slate-900">篩選條件</p><div className="mt-3 flex flex-wrap gap-2">{view.usefulFilters.map((item) => <span key={item} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{item}</span>)}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="text-sm font-black text-slate-900">視覺化</p><div className="mt-3 flex flex-wrap gap-2">{view.visualizations.map((item) => <span key={item} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{item}</span>)}</div></div></div></ShellCard>)}
      </div>
      <ShellCard className="p-6"><SectionTitle eyebrow="Definitions" title="指標定義" /><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{definitions.map((definition) => <div key={definition.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{definition.label}</p><span className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-bold text-sky-700">{definition.category}</span></div><p className="mt-2 text-xs font-bold text-slate-500">單位：{definition.unit || "無"}</p><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{definition.description}</p></div>)}</div></ShellCard>
    </div>
  );
}

export default function BehaviorRecord({ onBack, token }: BehaviorRecordProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const payload = await getTeacherLearningDashboard<DashboardPayload>(token ?? undefined);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取學習分析指標失敗");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const metricData = data?.metrics;

  const filteredStudents = useMemo(() => {
    if (!metricData) return [];
    return metricData.studentMetricRows.filter((student) => {
      if (filters.groupId !== "all" && student.groupId !== filters.groupId) return false;
      if (filters.studentId !== "all" && String(student.userId) !== filters.studentId) return false;
      return includesQuery([student.username, student.groupName], filters.search);
    });
  }, [metricData, filters]);

  const filteredStudentIds = useMemo(() => new Set(filteredStudents.map((student) => student.userId)), [filteredStudents]);

  const filteredInquiries = useMemo(() => {
    if (!metricData) return [];
    return metricData.inquiryMetricRows.filter((inquiry) => {
      if (!filteredStudentIds.has(inquiry.userId)) return false;
      if (filters.inquiryStatus !== "all" && inquiry.status !== filters.inquiryStatus) return false;
      return includesQuery([inquiry.username, inquiry.groupName, inquiry.statusLabel, inquiry.cardIds.join(" "), inquiry.evidenceCardIds.join(" "), inquiry.categoryLabels.join(" ")], filters.search);
    });
  }, [metricData, filteredStudentIds, filters]);

  const filteredGroups = useMemo(() => {
    if (!metricData) return [];
    return metricData.groupMetricRows.filter((group) => {
      if (filters.groupId !== "all" && group.groupId !== filters.groupId) return false;
      return includesQuery([group.groupName], filters.search);
    });
  }, [metricData, filters.groupId, filters.search]);

  const filteredClassMetrics = useMemo(() => {
    if (!metricData) return [];
    return metricData.classMetricRows.filter((metric) => {
      if (filters.metricCategory !== "all" && metric.category !== filters.metricCategory) return false;
      return includesQuery([metric.category, metric.label, metric.description], filters.search);
    });
  }, [metricData, filters.metricCategory, filters.search]);

  const filteredCategories = useMemo(() => {
    if (!metricData) return [];
    return metricData.categoryMetricRows.filter((category) => includesQuery([category.categoryLabel, category.category], filters.search));
  }, [metricData, filters.search]);

  const visibleStats = useMemo(() => buildSummaryStats(filteredStudents, filteredInquiries), [filteredStudents, filteredInquiries]);
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  return (
    <div className="uiux-page-shell relative min-h-screen overflow-x-hidden bg-[#f6f8fc] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.06),transparent_22%)]" />
      <div className="relative mx-auto max-w-[1720px] space-y-6">
        <ShellCard className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {onBack ? <button type="button" onClick={onBack} className="mt-1 rounded-2xl border border-slate-200 bg-white p-3 text-slate-700 transition hover:bg-slate-50" aria-label="返回"><ArrowLeft size={22} /></button> : null}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700"><BarChart3 size={14} /> Quantitative Learning Analytics</div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl xl:text-5xl">教師端｜指標型學生資料分析系統</h1>
                <p className="mt-4 max-w-5xl text-sm font-medium leading-7 text-slate-600 sm:text-base">這版改成以「可量化指標」為核心：單一學生、單份調查書、小組、全班、資料卡類型都能看到總量、平均、最大、最小與比例。系統只幫你把資料篩出來，現象解釋保留給你判讀。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-right"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Current View</p><p className="mt-1 text-lg font-black text-slate-900">{activeTabMeta.label}</p></div>
              <button type="button" onClick={() => void loadDashboard()} className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition hover:bg-sky-100"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /> 重新整理</button>
            </div>
          </div>
        </ShellCard>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cx("group rounded-[24px] border p-4 text-left transition", active ? "border-sky-300 bg-sky-50 shadow-sm" : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white")}><div className="flex items-center justify-between gap-3"><div className={cx("rounded-2xl p-3", active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600")}><Icon size={20} /></div><ChevronRight className={cx("transition", active ? "text-sky-700" : "text-slate-400 group-hover:text-slate-600")} size={18} /></div><p className="mt-4 font-black text-slate-900">{tab.label}</p><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{tab.description}</p></button>;
          })}
        </div>

        {loading ? (
          <ShellCard className="p-10 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700"><RefreshCw size={28} className="animate-spin" /></div><p className="mt-5 text-lg font-black text-slate-900">正在計算學生量化指標...</p><p className="mt-2 text-sm font-medium text-slate-500">系統正在彙整調查書、資料卡、證據卡、地圖、卡包與 AI 紀錄。</p></ShellCard>
        ) : error ? (
          <ShellCard className="border-red-200 bg-red-50 p-8 text-center"><p className="text-lg font-black text-red-700">{error}</p><p className="mt-2 text-sm font-medium text-red-600">請確認後端分析 API 與資料庫資料表是否正常。</p></ShellCard>
        ) : metricData ? (
          <>
            <FilterPanel data={metricData} filters={filters} setFilters={setFilters} visibleStats={visibleStats} />
            <ShellCard className="px-5 py-4"><div className="flex flex-wrap items-center gap-3"><div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700"><Filter size={14} /> Active Metric View</div><p className="text-sm font-medium text-slate-600"><span className="font-black text-slate-900">{activeTabMeta.label}</span>｜目前篩選學生 {number(filteredStudents.length)} 位、調查書 {number(filteredInquiries.length)} 份、小組 {number(filteredGroups.length)} 組</p></div></ShellCard>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: "easeOut" }}>
                {activeTab === "overview" ? <CoreIndicatorPanel stats={visibleStats} classStats={metricData.classMetrics} /> : null}
                {activeTab === "students" ? <StudentsPanel students={filteredStudents} /> : null}
                {activeTab === "inquiries" ? <InquiryPanel inquiries={filteredInquiries} /> : null}
                {activeTab === "classStats" ? <ClassStatsPanel metrics={filteredClassMetrics} /> : null}
                {activeTab === "cards" ? <CardsPanel categories={filteredCategories} cards={data?.cards || []} /> : null}
                {activeTab === "groups" ? <GroupsPanel groups={filteredGroups} /> : null}
                {activeTab === "methods" ? <MethodsPanel definitions={metricData.metricDefinitions} views={metricData.analysisViews} /> : null}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <ShellCard className="p-8"><EmptyState text="目前後端尚未回傳 metrics 指標資料，請重新啟動後端或確認 teacher.routes.js 已更新。" /></ShellCard>
        )}
      </div>
    </div>
  );
}
