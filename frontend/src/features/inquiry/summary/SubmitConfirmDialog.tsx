/**
 * CityAuncel maintainability notes
 * 檔案用途：調查書送出確認對話框，送出前提醒學生檢查證據與理由。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

type SubmitConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SubmitConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2418]/42 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            className="w-full max-w-md overflow-hidden rounded-[34px] border border-[#d8cbb3] bg-[#fffaf0] p-6 shadow-[0_24px_70px_rgba(45,41,34,0.18)]"
          >
            <h2 className="font-serif text-2xl font-semibold tracking-[0.08em] text-[#332c24]">
              確認送出本案的調查結論？
            </h2>

            <p className="mt-3 text-sm font-medium leading-7 text-stone-600">
              送出後，本次調查記錄會存到首頁的案件紀錄，隨時供翻閱。
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-[#d8cbb3] bg-white px-5 py-3 text-[#5f4c3a] transition hover:-translate-y-0.5 hover:bg-[#fff3dc] active:translate-y-0"
              >
                繼續修改
              </Button>

              <Button
                type="button"
                onClick={onConfirm}
                className="rounded-xl border border-[#8f2f2f] bg-[#7f2f2f] px-5 py-3 text-white transition hover:-translate-y-0.5 hover:bg-[#9b3b3b] active:translate-y-0"
              >
                確認送出
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
