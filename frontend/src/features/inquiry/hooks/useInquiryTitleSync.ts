/**
 * CityAuncel maintainability notes
 * 檔案用途：探究流程 hook useInquiryTitleSync，封裝草稿、前導任務、送出流程或畫面穩定化邏輯。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { useEffect } from "react";

type UseInquiryTitleSyncOptions<TTitle> = {
  token: string | null | undefined;
  titles: TTitle[];
  onTitleRewardsChange?: (titles: TTitle[]) => void;
  isSupportedTitle: (title: TTitle | null | undefined) => boolean;
  saveTitles: (token: string, titles: TTitle[]) => Promise<unknown>;
};

export function useInquiryTitleSync<TTitle>({
  token,
  titles,
  onTitleRewardsChange,
  isSupportedTitle,
  saveTitles,
}: UseInquiryTitleSyncOptions<TTitle>) {
  useEffect(() => {
    onTitleRewardsChange?.(titles.filter(isSupportedTitle));
  }, [titles, onTitleRewardsChange, isSupportedTitle]);

  useEffect(() => {
    if (!token) return;
    void saveTitles(token, titles.filter(isSupportedTitle)).catch((error) => {
      console.error("儲存探究稱號失敗", error);
    });
  }, [titles, token, isSupportedTitle, saveTitles]);
}
