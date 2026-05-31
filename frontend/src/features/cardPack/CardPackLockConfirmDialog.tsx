/**
 * CityAuncel maintainability notes
 * 檔案用途：角色卡包鎖定確認對話框，提醒組長送出後會同步到組員並進入公告投票流程。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import type { CardPackGroupMeta, PackCard } from "./cardPackModel";

type CardPackLockConfirmDialogProps = {
  selectedCards: PackCard[];
  meta: CardPackGroupMeta;
  lockReason: string;
  trimmedLockReasonLength: number;
  canConfirmLock: boolean;
  onLockReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CardPackLockConfirmDialog({
  selectedCards,
  meta,
  lockReason,
  trimmedLockReasonLength,
  canConfirmLock,
  onLockReasonChange,
  onCancel,
  onConfirm,
}: CardPackLockConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="確認送出鎖定卡牌"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-3xl rounded-[34px] border border-[#ead7a7] bg-[#fff8e6] p-6 text-center text-[#332417] shadow-[0_28px_90px_rgba(59,35,13,0.28),0_0_54px_rgba(251,191,36,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300 bg-amber-100 text-2xl shadow-[0_0_30px_rgba(251,191,36,0.25)]">
          🔒
        </div>

        <h2 className="text-2xl font-black tracking-[0.08em] text-[#3f2412]">
          確認送出鎖定卡牌？
        </h2>
        <p className="mt-3 text-sm font-bold leading-relaxed text-[#6b4b2f]">
          鎖定後會將這三張卡牌同步給所有組員。確定要鎖定目前選擇的三張卡牌嗎？
        </p>

        <div className="mt-5 grid max-h-[44vh] gap-3 overflow-y-auto rounded-[26px] border border-amber-200 bg-white/72 p-3 text-left shadow-inner md:grid-cols-3">
          {selectedCards.map((card) => (
            <div
              key={card.id}
              className={`overflow-hidden rounded-[22px] border border-white/75 bg-gradient-to-br ${meta.cardFace} p-3 shadow-[0_10px_24px_rgba(120,53,15,0.12)]`}
            >
              <div className="mb-2">
                <span className={`text-sm font-black ${meta.cardText}`}>
                  {card.title}
                </span>
              </div>
              <div className="rounded-2xl bg-white/70 px-3 py-3 shadow-sm">
                <p className={`text-sm font-black leading-6 ${meta.cardText}`}>
                  {card.frontText}
                </p>
              </div>
            </div>
          ))}
        </div>

        <textarea
          value={lockReason}
          onChange={(event) => onLockReasonChange(event.target.value)}
          placeholder="請輸入至少 20 字，說明為什麼選擇這三張牌..."
          className="mt-5 h-32 w-full rounded-2xl border-2 border-amber-200 bg-white p-4 text-sm font-bold text-[#3f3023] outline-none placeholder:text-[#9a7a55] focus:border-amber-400 focus:ring-4 focus:ring-amber-200/55"
        />

        <p
          className={`mt-2 text-xs font-bold tracking-[0.12em] ${trimmedLockReasonLength >= 20 ? "text-emerald-700" : "text-amber-700"}`}
        >
          目前字數：{trimmedLockReasonLength} / 至少 20 字
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-[#d8c79f] bg-white px-4 py-3 text-sm font-black tracking-[0.12em] text-[#5b4630] transition hover:bg-[#fff1d4]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirmLock}
            className="rounded-2xl border border-amber-300 bg-[linear-gradient(135deg,#facc15,#f59e0b)] px-4 py-3 text-sm font-black tracking-[0.12em] text-[#3f2412] shadow-[0_0_28px_rgba(251,191,36,0.34)] transition disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-none disabled:bg-stone-100 disabled:text-stone-400 disabled:shadow-none"
          >
            確認送出鎖定
          </button>
        </div>
      </div>
    </div>
  );
}
