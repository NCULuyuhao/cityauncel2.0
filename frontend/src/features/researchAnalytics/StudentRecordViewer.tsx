import type { RawStudentRecord } from './types';

export default function StudentRecordViewer({ records }: { records: RawStudentRecord[] }) {
  return (
    <section className="research-panel">
      <h2>學生原始歷程紀錄</h2>
      <p>保留探究書、資料卡、AI、稱號、地圖決策等原始內容，供研究者後續質性編碼。</p>
      <div className="research-record-list">
        {records.map((record) => (
          <details key={record.profile.userId} className="research-record-card">
            <summary><b>{record.profile.username}</b>｜{record.profile.genderLabel}｜{record.profile.groupName}{record.profile.isGroupLeader ? '｜組長' : ''}</summary>
            <div className="research-record-section">
              <h3>探究書紀錄</h3>
              {record.inquiries.length === 0 ? <p className="research-muted">尚無探究書紀錄</p> : record.inquiries.map((inq) => (
                <article className="research-subcard" key={inq.inquiryRecordId}>
                  <h4>{inq.recordLabel}</h4>
                  <p><b>探究目的/前導回應：</b>{inq.purpose || '—'}</p>
                  <p><b>使用資料卡：</b>{inq.usedCards?.map((card: any) => card.title || card.cardId).join('、') || '—'}</p>
                  <p><b>證據資料：</b>{inq.evidenceCards?.map((card: any) => card.title || card.cardId).join('、') || '—'}</p>
                  <p><b>筆記內容：</b>{inq.notes?.map((note: any) => note.noteText).join(' / ') || '—'}</p>
                  <p><b>結論內容：</b>{inq.conclusionText || '—'}</p>
                  <p><b>完成時間：</b>{inq.completedAt || '—'}</p>
                </article>
              ))}
            </div>
            <div className="research-record-section research-two-col">
              <div><h3>資料卡紀錄</h3><ul>{record.dataCards.map((card) => <li key={`${card.cardId}-${card.unlockedAt}`}>{card.title || card.cardId}｜{card.categoryLabel}｜{card.usedAsEvidence ? '作為證據' : card.usedInInquiry ? '用於探究書' : '已解鎖'}</li>)}</ul></div>
              <div><h3>AI 紀錄</h3><ul>{record.aiRecords.map((ai) => <li key={ai.id}>{ai.createdAt}｜{ai.helpCategory || ai.needType || ai.actionType}｜{ai.requestText || '—'}</li>)}</ul></div>
            </div>
            <div className="research-record-section research-two-col">
              <div><h3>稱號紀錄</h3><ul>{record.rewards.map((reward) => <li key={`${reward.rewardKey}-${reward.earnedAt}`}>{reward.rewardKey}｜{reward.earnedAt}</li>)}</ul></div>
              <div><h3>地圖決策</h3><ul>{record.mapChoices.map((choice) => <li key={`${choice.scope}-${choice.districtName}-${choice.updatedAt}`}>{choice.scope}｜{choice.districtName}｜{choice.choice}</li>)}</ul></div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
