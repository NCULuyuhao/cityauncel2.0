/**
 * CityAuncel maintainability notes
 * 檔案用途：水資源快照轉卡的主題設定，確保產生的證據卡視覺一致。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

export const WATER_UNIFIED_CARD = {
  shell:
    "rounded-[24px] border border-[#d7e7f0] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(247,251,255,1)_100%)] shadow-inner",
  panel: "rounded-[18px] border border-[#d6e8f2] bg-[#f4faff]",
  panelSoft: "rounded-[18px] border border-[#d6e8f2] bg-[#f8fcff]",
  inset: "rounded-xl border border-[#dce9f2] bg-white/92",
  chartFrame:
    "rounded-2xl border border-[#dce9f2] bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
  stat: "rounded-xl border border-[#dce9f2] bg-white/90",
  statStatus: "rounded-xl border border-[#dce9f2] bg-white/90",
  empty: "rounded-2xl border border-dashed border-[#b8dcec] bg-white/78",
  listItem:
    "rounded-xl border border-[#dce9f2] bg-white/88 shadow-[0_4px_12px_rgba(14,116,144,0.05)]",
  header: "bg-[#f3faff] border-b border-[#d9e7f0]",
  heading: "text-[#7b5b37]",
  mutedText: "text-slate-500",
  bodyText: "text-[#244f66]",
  titleText: "text-[#1f3442]",
  badge: "bg-sky-100 text-sky-800",
  timelineButton:
    "rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 transition hover:bg-sky-200",
  timelineChipActive: "bg-sky-100 text-sky-800",
  timelineChipIdle: "text-[#5f7f91] hover:bg-sky-50",
  statLabel: "text-[9px] font-black tracking-[0.1em] text-[#6b8798]",
  statValue: "mt-0.5 text-sm font-black text-[#1f3442]",
  statusDotBase:
    "inline-flex h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow",
  statusActiveText: "text-emerald-700",
  statusInactiveText: "text-rose-700",
  statusActiveSoft: "bg-emerald-50/70 text-emerald-700",
  statusInactiveSoft: "bg-rose-50/70 text-rose-700",
};

export const EVIDENCE_CREATOR_THEME = {
  section: "border-[#e2d4bd] bg-[#fffaf0]/96",
  badge: "border border-[#ead7b2] bg-[#fff2d8] text-[#7b5b37]",
  primaryButton:
    "rounded-2xl border border-[#c89a3a] bg-[#c89a3a] px-5 py-3 font-black text-white shadow-[0_7px_0_rgba(200,154,58,0.18)] hover:bg-[#b98b2b]",
  surface:
    "shrink-0 rounded-[28px] border border-[#e2d4bd] bg-[#fff7ea] p-4 shadow-[0_12px_28px_rgba(45,41,34,0.06)]",
  sectionPanel: "rounded-[24px] border border-[#e2d4bd] bg-[#fffaf0]",
  header: "border-b border-[#eadfcf] bg-[#fff3dc]",
  heading: "text-[#7b5b37]",
  titleText: "text-[#332c24]",
  bodyText: "text-[#6d5e49]",
  badgeSoft: "bg-[#fff0cf] text-[#7b5b37]",
  toggleButton:
    "rounded-full border border-[#d8cbb3] bg-[#fffdf8] px-2.5 py-1 text-[10px] font-black text-[#5f5545] transition hover:border-[#c89a3a] hover:bg-[#fff1d6]",
  infoPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff7ea]",
  inset: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  chartFrame:
    "rounded-2xl border border-[#eadfcf] bg-[#fffdf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
  statusBox: "rounded-xl border border-[#eadfcf] bg-[#fffdf8]",
  listPanel: "rounded-[18px] border border-[#eadfcf] bg-[#fff8ef]",
  listItem:
    "rounded-xl border border-[#eadfcf] bg-[#fffdf8] shadow-[0_4px_12px_rgba(140,108,54,0.06)]",
  timelineButton:
    "rounded-full border border-[#d8cbb3] bg-[#fff0cf] px-3 py-1 text-xs font-black text-[#7b5b37] transition hover:bg-[#ffe6b2]",
  timelineChipActive: "bg-[#fff0cf] text-[#7b5b37]",
  timelineChipIdle: "text-[#7a6754] hover:bg-[#fff4df]",
  textarea:
    "min-h-[128px] rounded-2xl border border-[#d8cbb3] bg-[#fffdf8] px-3 py-3 text-sm font-medium leading-6 text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#9b7b55] focus:ring-4 focus:ring-[#ead7b2]/35",
  helperBox:
    "rounded-2xl border border-[#e2d4bd] bg-[#fff7ea] px-4 py-3 text-sm font-black text-stone-600",
  modalShell:
    "grid max-h-[calc(100svh-2rem)] w-full max-w-[78rem] grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] gap-3 overflow-x-auto overflow-y-auto rounded-[28px] border border-[#d8cbb3] bg-[#fffaf0] p-3 shadow-[0_24px_80px_rgba(45,41,34,0.22)]",
  previewFrame:
    "flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[22px] border border-[#e2d4bd] bg-[#fff7ea] p-2",
  previewImage:
    "max-h-[68svh] max-w-full rounded-[18px] border border-[#eadfcf] bg-[#fffdf8] object-contain",
  secondaryButton:
    "rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:bg-[#9b3b3b]",
  confirmButton:
    "rounded-xl border border-[#c89a3a] bg-[#c89a3a] px-5 py-3 text-white transition hover:bg-[#b98b2b] disabled:cursor-not-allowed disabled:border-[#f0e0b9] disabled:bg-[#f5e9cf] disabled:text-[#c3aa71] disabled:opacity-100",
  captureAccent: "rgba(236, 201, 118, 0.5)",
};
