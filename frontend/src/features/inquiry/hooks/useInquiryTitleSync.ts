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
