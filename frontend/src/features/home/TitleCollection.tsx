/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能元件 TitleCollection，負責任務入口、稱號或首頁區塊呈現。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { forwardRef, type ReactNode } from "react";

export const TitleCollection = forwardRef<HTMLElement, { children: ReactNode }>(
  function TitleCollection({ children }, ref) {
    return (
      <section
        ref={ref}
        className="relative overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#f7f1e6]/86 p-4 sm:rounded-[34px] sm:p-6 shadow-[0_22px_70px_rgba(45,41,34,0.11)] backdrop-blur-md"
      >
        {children}
      </section>
    );
  },
);
