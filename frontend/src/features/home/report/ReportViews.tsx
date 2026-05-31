/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁調查書報告顯示元件，負責摘要卡、預覽彈窗與統計區塊。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { motion } from "framer-motion";
import { resolveEvidenceCardSummary } from "@/features/home/evidenceCardSummary";
import {
  getInvestigationCaseBySummary,
  type InvestigationCase,
} from "@/features/home/investigationCases";
import type { FinalSummary } from "@/features/home/finalSummaryModel";

export function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "blue" | "emerald" | "amber";
}) {
  const styles = {
    blue: "border-blue-100 bg-blue-50 text-stone-600",
    emerald: "border-[#cfd7c6] bg-[#f4f7ef]/85 text-stone-700",
    amber: "border-amber-100 bg-amber-50 text-stone-600",
  };

  return (
    <div
      className={`flex aspect-square w-[clamp(4.45rem,7.2vw,5.75rem)] shrink-0 flex-col items-center justify-center rounded-3xl border p-1.5 text-center ${styles[color]}`}
    >
      <p className="text-xl font-semibold leading-none sm:text-2xl">{value}</p>
      <p className="mt-1.5 whitespace-nowrap text-[10px] font-bold leading-none sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

export function ReportPage({
  summary,
  caseMeta,
  onOpen,
}: {
  summary: FinalSummary;
  caseMeta: InvestigationCase;
  onOpen: () => void;
}) {
  const evidenceCards = summary.evidenceCards.map(resolveEvidenceCardSummary);

  return (
    <div className="min-w-full shrink-0 px-1">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className="group relative min-h-[320px] cursor-pointer overflow-hidden rounded-[22px] bg-[#fffaf0] p-4 sm:min-h-[450px] sm:rounded-[26px] sm:p-6 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(72,56,34,0.18)] focus-visible:ring-4 focus-visible:ring-[#9b2f2f]/25"
        aria-label={`開啟${caseMeta.title}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(92,67,41,0.06)_1px,transparent_1px)] bg-[size:100%_30px]" />
        <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[#e5d3b2] to-transparent" />

        <div className="absolute top-3 right-3 flex items-center justify-center">
          <div className="absolute top-3 right-3 flex items-center justify-center">
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-red-800
          text-red-800 text-[11px] font-black tracking-[0.15em]
          opacity-80
          before:absolute before:inset-0 before:rounded-full before:border before:border-red-900 before:opacity-40
          after:absolute after:inset-[6px] after:rounded-full after:border after:border-red-700 after:opacity-30
          shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
              /* ✅ 就加在這裡 */
              style={{
                WebkitMaskImage:
                  "radial-gradient(circle, black 40%, transparent 100%)",
                maskImage:
                  "radial-gradient(circle, black 70%, transparent 100%)",
              }}
            >
              <span className="rotate-[-8deg]">SLOVED</span>
            </div>
          </div>
        </div>

        <div className="relative mb-5 flex items-start justify-between gap-3 border-b border-dashed border-[#c8b48f] pb-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.28em] text-[#7a6a52]">
              CASE REPORT
            </p>
            <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
              {caseMeta.title}
            </h3>
          </div>
        </div>

        <div className="relative mb-4 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <DetectiveEvidenceBox
            badge="QUESTIONING"
            title="這次案件的調查任務"
            content={summary.orientationMainChoice}
          />
          <DetectiveEvidenceBox
            badge="HYPOTHESIS"
            title="我的懷疑或推論"
            content={summary.orientationTextInput}
          />
        </div>

        <div className="relative mb-4 rounded-2xl border border-[#d2bf99] bg-[#f7ecd5] p-4 shadow-sm">
          <div className="absolute -top-3 left-5 rotate-[-3deg] rounded-md bg-[#d8c29a] px-3 py-1 text-[10px] font-black tracking-[0.22em] text-[#5c503e] shadow-sm">
            EVIDENCE
          </div>
          <div className="mb-3 flex items-center justify-between pt-2">
            <p className="text-xs font-bold tracking-[0.18em] text-[#6d5e49]">
              證據
            </p>
            <p className="text-xs font-bold text-[#6d5e49]">
              {evidenceCards.length} 張
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {evidenceCards.slice(0, 6).map((card) => (
              <div
                key={card.id}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                className="relative h-16 w-16 rotate-[-2deg] select-none rounded-xl border border-[#c8b48f] bg-[#fffaf0] p-1.5 shadow-sm odd:rotate-[2deg]"
              >
                <img
                  src={card.imageSrc}
                  alt={card.title}
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                  className="pointer-events-none h-full w-full select-none object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        <DetectiveEvidenceBox
          badge="CONCLUSION"
          title="案件結論"
          content={summary.conclusion}
          variant="green"
        />
      </div>
    </div>
  );
}

export function ReportPreviewModal({
  summary,
  index,
  onClose,
}: {
  summary: FinalSummary;
  index: number;
  onClose: () => void;
}) {
  const evidenceCards = summary.evidenceCards.map(resolveEvidenceCardSummary);
  const caseMeta = getInvestigationCaseBySummary(summary, index);

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={caseMeta.title}
        className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[34px] border border-[#c8b48f] bg-[#efe5d1] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(120,92,58,0.08)_1px,transparent_1px),linear-gradient(rgba(120,92,58,0.06)_1px,transparent_1px)] bg-[size:26px_26px]" />
          <div className="absolute right-8 top-8 rotate-[-12deg] rounded-md border-2 border-[#9b2f2f]/30 px-5 py-2 text-sm font-black tracking-[0.28em] text-[#9b2f2f]/30">
            CASE FILE
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#b8a37d] bg-[#fffaf0] text-xl font-black text-black shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          aria-label="關閉探究調查書"
        >
          ×
        </button>

        <div className="relative max-h-[calc(92vh-1rem)] overflow-y-auto rounded-[20px] sm:max-h-[calc(88vh-2rem)] sm:rounded-[26px] border border-[#bba985] bg-[#fbf5e8] p-5 pr-4 shadow-inner">
          <div className="relative mb-5 border-b border-dashed border-[#c8b48f] pb-4 pr-14">
            <p className="text-[11px] font-black tracking-[0.28em] text-[#7a6a52]">
              CASE REPORT
            </p>
            <h3 className="mt-2 font-serif text-3xl font-semibold tracking-[0.08em] text-[#332c24]">
              {caseMeta.title}
            </h3>
            <p className="mt-2 text-sm font-bold tracking-[0.12em] text-[#7a6a52]">
              {caseMeta.task}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetectiveEvidenceBox
              badge="QUESTIONING"
              title="這一案的調查任務"
              content={summary.orientationMainChoice}
            />
            <DetectiveEvidenceBox
              badge="EXPLORATION"
              title="我的懷疑或推論"
              content={summary.orientationTextInput}
            />
          </div>

          <div className="relative my-5 rounded-2xl border border-[#d2bf99] bg-[#f7ecd5] p-4 shadow-sm">
            <div className="absolute -top-3 left-5 rotate-[-3deg] rounded-md bg-[#d8c29a] px-3 py-1 text-[10px] font-black tracking-[0.22em] text-[#5c503e] shadow-sm">
              EVIDENCE
            </div>
            <div className="mb-3 flex items-center justify-between pt-2">
              <p className="text-xs font-bold tracking-[0.18em] text-[#6d5e49]">
                證據
              </p>
              <p className="text-xs font-bold text-[#6d5e49]">
                {evidenceCards.length} 張
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {evidenceCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-2xl border border-[#c8b48f] bg-[#fffaf0] p-3 shadow-sm"
                >
                  <img
                    src={card.imageSrc}
                    alt={card.title}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="mx-auto mb-3 h-28 w-full max-w-full select-none object-contain sm:h-32 md:h-36"
                  />
                  <p className="text-center text-xs font-black leading-5 text-[#4d4438]">
                    {card.title}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <DetectiveEvidenceBox
            badge="Conclusion"
            title="案件結論"
            content={summary.conclusion}
            variant="green"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetectiveEvidenceBox({
  badge,
  title,
  content,
  variant = "paper",
}: {
  badge: string;
  title: string;
  content: string;
  variant?: "paper" | "green";
}) {
  const isGreen = variant === "green";

  return (
    <div
      className={`relative rounded-2xl border p-4 shadow-sm ${
        isGreen
          ? "border-[#c5cfba] bg-[#f2f5ec]"
          : "border-[#d2bf99] bg-[#f7ecd5]"
      }`}
    >
      <div
        className={`absolute -top-3 left-5 rotate-[-3deg] rounded-md px-3 py-1 text-[10px] font-black tracking-[0.22em] shadow-sm ${
          isGreen
            ? "bg-[#c9d6bd] text-[#54614c]"
            : "bg-[#d8c29a] text-[#5c503e]"
        }`}
      >
        {badge}
      </div>

      <div className="pt-2">
        <p
          className={`mb-2 text-xs font-bold tracking-[0.18em] ${isGreen ? "text-[#65715d]" : "text-[#6d5e49]"}`}
        >
          {title}
        </p>
        <div
          className={`rounded-xl border p-3 ${
            isGreen
              ? "border-[#d3ddc9] bg-[#fbfcf7]/80"
              : "border-[#e1d0ad] bg-[#fffaf0]/80"
          }`}
        >
          <p
            className={`line-clamp-5 text-xs leading-6 ${isGreen ? "text-[#3f4639]" : "text-[#4d4438]"}`}
          >
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
