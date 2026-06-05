function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv || ''}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const exports = [
  ['studentMetricsCsv', '學生指標矩陣', 'student_metrics_matrix.csv'],
  ['inquiryCsv', '完整探究書內容', 'inquiry_export.csv'],
  ['aiCsv', 'AI 對話紀錄', 'ai_export.csv'],
  ['mapCsv', '地圖選擇紀錄', 'map_export.csv'],
  ['decisionCardCsv', '角色卡決策紀錄', 'decision_card_export.csv'],
] as const;

export default function ResearchExportPanel({ files }: { files: Record<string, string> }) {
  return (
    <section className="research-panel">
      <h2>研究資料匯出</h2>
      <p>匯出供研究者自行進行量化整理與質性編碼；系統不自動產生研究結論。</p>
      <div className="research-export-grid">
        {exports.map(([key, label, filename]) => (
          <button className="research-export-button" key={key} onClick={() => downloadCsv(filename, files[key] || '')}>
            下載 {label}
          </button>
        ))}
      </div>
    </section>
  );
}
