import { useState } from "react";
import { SUSPECT_GROUPS } from "@/features/home/suspectVoting/suspectVotingModel";

export function SuspectVotingModal({
  ranking,
  message,
  isSubmitting,
  onMoveRole,
  onSubmit,
}: {
  ranking: string[];
  message: string;
  isSubmitting: boolean;
  onMoveRole: (roleId: string, direction: -1 | 1) => void;
  onSubmit: () => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const rankedGroups = ranking
    .map((roleId) => SUSPECT_GROUPS.find((group) => group.id === roleId))
    .filter((group): group is (typeof SUSPECT_GROUPS)[number] =>
      Boolean(group),
    );
  const canSubmit =
    !isSubmitting && rankedGroups.length === SUSPECT_GROUPS.length;

  function handleSubmitClick() {
    if (!canSubmit) return;
    setIsConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    setIsConfirmOpen(false);
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border-4 border-stone-800 bg-[#fffaf0] p-6 text-stone-800 shadow-[0_26px_90px_rgba(0,0,0,0.35)]">
        <p className="text-xs font-black tracking-[0.26em] text-[#8b5e34]">
          URGENT RANKING
        </p>
        <h2 className="mt-2 text-3xl font-black">小偵探排序投票開始</h2>
        <p className="mt-3 text-sm font-bold leading-7 text-stone-600">
          請把你調查後認為「造成石虎生存危機最相關」的角色排在最上面，依序排到最不相關。結算時只會統計每位學生排在第一名的角色。
        </p>

        <div className="mt-5 space-y-3">
          {rankedGroups.map((group, index) => (
            <div
              key={group.id}
              className="grid gap-3 rounded-2xl border-2 border-[#d5c39f] bg-white px-4 py-3 shadow-sm sm:grid-cols-[56px_1fr_88px] sm:items-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#cbb894] bg-[#fff0bd] text-xl font-black text-[#4f3514]">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-[#33251d]">
                  {group.name}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-stone-500">
                  {group.description}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:flex-col">
                <button
                  type="button"
                  onClick={() => onMoveRole(group.id, -1)}
                  disabled={isSubmitting || index === 0}
                  className="flex-1 rounded-xl border border-stone-300 bg-[#f8f1df] px-3 py-2 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:w-full"
                >
                  上移
                </button>
                <button
                  type="button"
                  onClick={() => onMoveRole(group.id, 1)}
                  disabled={isSubmitting || index === rankedGroups.length - 1}
                  className="flex-1 rounded-xl border border-stone-300 bg-[#f8f1df] px-3 py-2 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 sm:w-full"
                >
                  下移
                </button>
              </div>
            </div>
          ))}
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={!canSubmit}
          className="mt-6 w-full rounded-2xl border-2 border-stone-900 bg-stone-800 px-5 py-4 text-lg font-black text-white shadow-[0_8px_0_rgba(28,25,23,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {isSubmitting ? "送出排序中..." : "送出我的排序"}
        </button>
      </div>

      {isConfirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspect-vote-confirm-title"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[28px] border-4 border-stone-900 bg-[#fffaf0] p-6 text-center text-stone-800 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
            <p className="text-xs font-black tracking-[0.24em] text-[#8b5e34]">
              CONFIRM VOTE
            </p>
            <h3
              id="suspect-vote-confirm-title"
              className="mt-2 text-2xl font-black"
            >
              確認送出這次排序？
            </h3>
            <p className="mt-3 text-sm font-bold leading-7 text-stone-600">
              請再確認排序沒有放錯，送出後就無法更改了喲~
            </p>

            <div className="mt-5 rounded-2xl border border-[#d5c39f] bg-white px-4 py-3 text-left shadow-inner">
              <p className="text-xs font-black tracking-[0.16em] text-stone-500">
                你選擇的頭號嫌疑犯
              </p>
              <p className="mt-1 text-lg font-black text-[#33251d]">
                {rankedGroups[0]?.name || "尚未完成排序"}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="rounded-2xl border-2 border-stone-900 bg-stone-800 px-4 py-3 text-sm font-black text-white shadow-[0_6px_0_rgba(28,25,23,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                確認送出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
