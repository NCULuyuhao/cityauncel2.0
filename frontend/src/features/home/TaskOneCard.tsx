/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能元件 TaskOneCard，負責任務入口、稱號或首頁區塊呈現。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { forwardRef, type ReactNode } from "react";

export const TaskOneCard = forwardRef<HTMLElement, { children: ReactNode }>(
  function TaskOneCard({ children }, ref) {
    return (
      <section
        ref={ref}
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#d7c8ad] bg-[#efe5d1]/88 p-3 sm:rounded-[34px] sm:p-5 shadow-[0_24px_70px_rgba(45,41,34,0.16)] backdrop-blur-md"
      >
        {children}
      </section>
    );
  },
);
