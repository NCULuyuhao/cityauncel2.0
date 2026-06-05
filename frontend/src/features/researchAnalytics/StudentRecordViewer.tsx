import { Bot, ClipboardList, Database, Layers, Map, Route, Users } from 'lucide-react';
import type { DecisionCardRecord, DecisionLogRecord, MapChoiceRecord, RawStudentRecord } from './types';

type PersonalStage = 'inquiry' | 'map' | 'decision';

type StageRecords = {
  mapChoices: MapChoiceRecord[];
  decisionCards: DecisionCardRecord[];
  decisionLogs: DecisionLogRecord[];
};

type StudentRecordViewerProps = {
  stage: PersonalStage;
  record: RawStudentRecord | null;
  stageRecords: StageRecords;
  groups: Array<{ id: string; label: string }>;
  students: Array<{ id: number; label: string }>;
  selectedMapGroupId: string;
  selectedMapStudentId: string;
  selectedDecisionGroupId: string;
  onMapGroupChange: (groupId: string) => void;
  onMapStudentChange: (studentId: string) => void;
  onDecisionGroupChange: (groupId: string) => void;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function aiTypeLabel(ai: any) {
  return ai.aiTypeLabel || ai.helpCategory || ai.needType || ai.actionType || 'AI 紀錄';
}

function aiActionLabel(ai: any) {
  return ai.actionLabel || ai.actionType || 'AI 使用';
}

function evidenceCount(record: RawStudentRecord | null) {
  return record?.dataCards.filter((card: any) => card.usedAsEvidence).length || 0;
}

function countChoices(rows: MapChoiceRecord[]) {
  return rows.reduce((acc, row) => {
    if (row.choice === '保育') acc.conservation += 1;
    else if (row.choice === '開發') acc.development += 1;
    else acc.unknown += 1;
    acc.total += 1;
    return acc;
  }, { total: 0, conservation: 0, development: 0, unknown: 0 });
}

function scopeLabel(scope: string) {
  const value = String(scope || '').toLowerCase();
  if (value === 'class' || value === 'global') return '全班';
  if (value === 'group') return '小組';
  if (value === 'personal' || value === 'student') return '個人';
  return scope || '未標示';
}

function resultLabel(result?: string) {
  if (result === 'accepted') return '通過';
  if (result === 'rejected') return '未通過';
  if (result === 'keep' || result === 'pending') return '保留';
  return result || '—';
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return <span><b>{Number.isFinite(Number(value)) ? Number(value).toLocaleString() : value}</b>{label}</span>;
}

function InquiryRecordStage({ record }: { record: RawStudentRecord }) {
  return (
    <>
      <div className="research-profile-card">
        <div>
          <p className="research-eyebrow">探究書任務｜單一玩家總覽</p>
          <h2>{record.profile.username}</h2>
          <p>{record.profile.genderLabel}｜{record.profile.groupName}{record.profile.isGroupLeader ? '｜組長' : ''}</p>
        </div>
        <div className="research-profile-stats">
          <MetricCard value={record.inquiries.length} label="探究書" />
          <MetricCard value={record.dataCards.length} label="解鎖資料卡" />
          <MetricCard value={evidenceCount(record)} label="證據卡" />
          <MetricCard value={record.aiRecords.length} label="AI 使用" />
        </div>
      </div>

      <div className="research-record-grid">
        <section className="research-panel research-record-main">
          <h2><ClipboardList size={20} />探究書詳細內容</h2>
          <p>上方是該玩家在探究書任務中的總體紀錄，下方保留每份探究書的文字與資料卡使用脈絡。</p>
          {record.inquiries.length === 0 ? <p className="research-muted">尚無探究書紀錄</p> : record.inquiries.map((inq) => (
            <article className="research-subcard" key={inq.inquiryRecordId}>
              <h3>{inq.recordLabel}</h3>
              <dl className="research-dl">
                <dt>探究目的 / 前導回應</dt><dd>{formatValue(inq.purpose)}</dd>
                <dt>使用資料卡</dt><dd>{inq.usedCards?.map((card: any) => card.title || card.cardId).join('、') || '—'}</dd>
                <dt>證據資料</dt><dd>{inq.evidenceCards?.map((card: any) => card.title || card.cardId).join('、') || '—'}</dd>
                <dt>筆記內容</dt><dd>{inq.notes?.map((note: any) => note.noteText).filter(Boolean).join(' / ') || '—'}</dd>
                <dt>結論內容</dt><dd>{formatValue(inq.conclusionText)}</dd>
                <dt>完成時間</dt><dd>{formatValue(inq.completedAt)}</dd>
              </dl>
            </article>
          ))}
        </section>

        <aside className="research-record-side">
          <section className="research-panel">
            <h2><Bot size={20} />AI 使用順序</h2>
            <p>只顯示學生看得到的選擇、輸入與 AI 回覆；不顯示系統提示詞。</p>
            <ol className="research-timeline">
              {record.aiRecords.length === 0 ? <li className="research-muted">尚無 AI 使用紀錄</li> : record.aiRecords.map((ai: any, index) => (
                <li key={ai.id || `${ai.createdAt}-${index}`}>
                  <div className="research-timeline__time">{formatValue(ai.createdAt)}</div>
                  <div className="research-timeline__title">{index + 1}. {aiActionLabel(ai)}｜{aiTypeLabel(ai)}</div>
                  {ai.studentVisibleText ? <p><b>學生可見選擇/輸入：</b>{ai.studentVisibleText}</p> : null}
                  {ai.aiReplyText ? <p><b>AI 回覆：</b>{ai.aiReplyText}</p> : null}
                  {ai.pageLabel || ai.contextLabel ? <p className="research-muted">位置：{ai.pageLabel || '—'}｜情境：{ai.contextLabel || '—'}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="research-panel">
            <h2><Database size={20} />資料卡明細</h2>
            <ul className="research-simple-list">
              {record.dataCards.length === 0 ? <li className="research-muted">尚無資料卡紀錄</li> : record.dataCards.map((card: any, index) => (
                <li key={`${card.cardId}-${card.unlockedAt}-${index}`}>{card.title || card.cardId}｜{card.categoryLabel}｜{card.usedAsEvidence ? '作為證據' : card.usedInInquiry ? '用於探究書' : '已解鎖'}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function MapRecordStage({ stageRecords, groups, students, selectedMapGroupId, selectedMapStudentId, onMapGroupChange, onMapStudentChange }: StudentRecordViewerProps) {
  const rows = stageRecords.mapChoices || [];
  const groupRows = selectedMapGroupId === 'all' ? rows : rows.filter((row) => row.groupId === selectedMapGroupId);
  const studentRows = selectedMapStudentId === 'all' ? groupRows : groupRows.filter((row) => String(row.userId || '') === selectedMapStudentId);
  const classCounts = countChoices(rows);
  const groupCounts = countChoices(groupRows);
  const studentCounts = countChoices(studentRows);
  const groupStudents = students.filter((student) => {
    if (selectedMapGroupId === 'all') return true;
    const targetRecord = rows.find((row) => String(row.userId || '') === String(student.id));
    return targetRecord?.groupId === selectedMapGroupId || student.label.includes(groups.find((g) => g.id === selectedMapGroupId)?.label || '');
  });

  return (
    <div className="research-stage-block">
      <div className="research-profile-card">
        <div>
          <p className="research-eyebrow">繪製地圖任務｜全班 → 小組 → 個人</p>
          <h2>全班地圖紀錄總覽</h2>
          <p>先看全班所有地區選擇，再依小組與個人往下篩選。</p>
        </div>
        <div className="research-profile-stats">
          <MetricCard value={classCounts.total} label="全班地圖紀錄" />
          <MetricCard value={classCounts.conservation} label="保育" />
          <MetricCard value={classCounts.development} label="開發" />
          <MetricCard value={classCounts.unknown} label="不知道" />
        </div>
      </div>

      <section className="research-toolbar" aria-label="地圖紀錄篩選器">
        <label>小組
          <select value={selectedMapGroupId} onChange={(e) => { onMapGroupChange(e.target.value); onMapStudentChange('all'); }}>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <label>個人
          <select value={selectedMapStudentId} onChange={(e) => onMapStudentChange(e.target.value)}>
            <option value="all">全部個人</option>
            {groupStudents.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}
          </select>
        </label>
      </section>

      <section className="research-panel">
        <h2><Map size={20} />篩選後地圖紀錄摘要</h2>
        <div className="research-kpi-row">
          <span>目前篩選紀錄：<b>{studentCounts.total}</b></span>
          <span>保育：<b>{studentCounts.conservation}</b></span>
          <span>開發：<b>{studentCounts.development}</b></span>
          <span>不知道：<b>{studentCounts.unknown}</b></span>
          <span>小組層級紀錄：<b>{groupCounts.total}</b></span>
        </div>
      </section>

      <section className="research-panel">
        <h2><Route size={20} />地圖選擇明細</h2>
        <div className="research-table-wrap">
          <table className="research-table research-table--wide"><thead><tr><th>層級</th><th>組別</th><th>學生</th><th>地區</th><th>選擇</th><th>更新時間</th></tr></thead><tbody>
            {studentRows.length === 0 ? <tr><td colSpan={6}>尚無符合條件的地圖紀錄</td></tr> : studentRows.map((row, index) => (
              <tr key={`${row.scope}-${row.groupId}-${row.userId}-${row.districtName}-${index}`}><td>{scopeLabel(row.scope)}</td><td>{row.groupName || row.groupId || '—'}</td><td>{row.username || '—'}</td><td>{row.districtName}</td><td>{row.choice}</td><td>{formatValue(row.updatedAt || row.createdAt)}</td></tr>
            ))}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

function DecisionRecordStage({ stageRecords, groups, selectedDecisionGroupId, onDecisionGroupChange }: StudentRecordViewerProps) {
  const rows = stageRecords.decisionCards || [];
  const logs = stageRecords.decisionLogs || [];
  const filteredRows = selectedDecisionGroupId === 'all' ? rows : rows.filter((row) => row.groupId === selectedDecisionGroupId);
  const filteredLogs = selectedDecisionGroupId === 'all' ? logs : logs.filter((row) => row.groupId === selectedDecisionGroupId);
  const accepted = rows.filter((row) => row.result === 'accepted').length;
  const groupAccepted = filteredRows.filter((row) => row.result === 'accepted').length;

  return (
    <div className="research-stage-block">
      <div className="research-profile-card">
        <div>
          <p className="research-eyebrow">角色卡包／決策卡｜全班 → 小組</p>
          <h2>全班決策紀錄總覽</h2>
          <p>角色卡包不是個人任務，因此只呈現全班紀錄與小組篩選。</p>
        </div>
        <div className="research-profile-stats">
          <MetricCard value={rows.length} label="全班提案" />
          <MetricCard value={accepted} label="通過" />
          <MetricCard value={logs.length} label="小組操作紀錄" />
        </div>
      </div>

      <section className="research-toolbar" aria-label="決策卡紀錄篩選器">
        <label>小組
          <select value={selectedDecisionGroupId} onChange={(e) => onDecisionGroupChange(e.target.value)}>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
      </section>

      <section className="research-panel">
        <h2><Layers size={20} />篩選後決策摘要</h2>
        <div className="research-kpi-row">
          <span>提案數：<b>{filteredRows.length}</b></span>
          <span>通過數：<b>{groupAccepted}</b></span>
          <span>操作紀錄：<b>{filteredLogs.length}</b></span>
        </div>
      </section>

      <section className="research-panel">
        <h2><Users size={20} />決策卡結果明細</h2>
        <div className="research-table-wrap">
          <table className="research-table research-table--wide"><thead><tr><th>輪次</th><th>組別</th><th>提案</th><th>核心牌</th><th>理由</th><th>同意</th><th>反對</th><th>保留</th><th>結果</th><th>結算時間</th></tr></thead><tbody>
            {filteredRows.length === 0 ? <tr><td colSpan={10}>尚無符合條件的決策卡紀錄</td></tr> : filteredRows.map((row, index) => (
              <tr key={`${row.roundNo}-${row.groupId}-${row.cardId}-${index}`}><td>{row.roundNo}</td><td>{row.groupName || row.groupId}</td><td>{row.cardId}</td><td>{row.coreCard ? '是' : '否'}</td><td>{formatValue(row.reason)}</td><td>{row.agreeCount || 0}</td><td>{row.rejectCount || 0}</td><td>{row.keepCount || 0}</td><td>{resultLabel(row.result)}</td><td>{formatValue(row.settledAt)}</td></tr>
            ))}
          </tbody></table>
        </div>
      </section>

      <section className="research-panel">
        <h2><ClipboardList size={20} />小組選牌／鎖定操作紀錄</h2>
        <div className="research-table-wrap">
          <table className="research-table research-table--wide"><thead><tr><th>輪次</th><th>組別</th><th>操作</th><th>選牌1</th><th>選牌2</th><th>選牌3</th><th>核心牌</th><th>理由</th><th>時間</th></tr></thead><tbody>
            {filteredLogs.length === 0 ? <tr><td colSpan={9}>尚無符合條件的小組操作紀錄</td></tr> : filteredLogs.map((row, index) => (
              <tr key={`${row.id}-${index}`}><td>{row.roundNo || '—'}</td><td>{row.groupName || row.groupId}</td><td>{row.actionType || '—'}</td><td>{row.selectedCardId1 || '—'}</td><td>{row.selectedCardId2 || '—'}</td><td>{row.selectedCardId3 || '—'}</td><td>{row.coreCardId || '—'}</td><td>{row.lockReason || '—'}</td><td>{formatValue(row.lockedAt || row.createdAt)}</td></tr>
            ))}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

export default function StudentRecordViewer(props: StudentRecordViewerProps) {
  const { stage, record } = props;
  if (stage === 'inquiry') {
    if (!record) return <section className="research-panel"><h2>探究書紀錄</h2><p className="research-muted">請先選擇一位學生。</p></section>;
    return <InquiryRecordStage record={record} />;
  }
  if (stage === 'map') return <MapRecordStage {...props} />;
  return <DecisionRecordStage {...props} />;
}
