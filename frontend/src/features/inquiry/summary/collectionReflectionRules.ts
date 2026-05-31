/**
 * CityAuncel maintainability notes
 * 檔案用途：蒐集理由與調查結論的字數/批次規則，集中管理送出前檢查條件。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

export const COLLECTION_REFLECTION_BATCH_SIZE = 6;
export const COLLECTION_REFLECTION_BASE_MIN_LENGTH = 10;
export const COLLECTION_REFLECTION_STEP_MIN_LENGTH = 5;
export const COLLECTION_REFLECTION_MAX_MIN_LENGTH = 30;
export const CONCLUSION_MIN_LENGTH = 30;
export const NO_EVIDENCE_CONCLUSION = "本次探究無任何發現。";

export function getCollectionReflectionMinLength(cardCount: number) {
  if (cardCount <= 0) return COLLECTION_REFLECTION_BASE_MIN_LENGTH;
  return Math.min(
    COLLECTION_REFLECTION_BASE_MIN_LENGTH +
      (cardCount - 1) * COLLECTION_REFLECTION_STEP_MIN_LENGTH,
    COLLECTION_REFLECTION_MAX_MIN_LENGTH,
  );
}
