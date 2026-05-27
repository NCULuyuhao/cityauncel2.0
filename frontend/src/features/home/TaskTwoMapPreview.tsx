/**
 * CityAuncel maintainability notes
 * 檔案用途：首頁功能元件 TaskTwoMapPreview，負責任務入口、稱號或首頁區塊呈現。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { type ReactNode } from "react";

export function TaskTwoMapPreview({ children }: { children: ReactNode }) {
  return (
    <section className="uiux-home-map-section relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#d8cbb3] bg-[#f6f0e4]/88 p-3 sm:rounded-[34px] sm:p-5 shadow-[0_22px_62px_rgba(45,41,34,0.10)] backdrop-blur-md">
      {children}
    </section>
  );
}
