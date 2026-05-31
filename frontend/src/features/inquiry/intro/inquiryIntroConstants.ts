/**
 * CityAuncel maintainability notes
 * 檔案用途：任務一前導流程常數，集中管理選項與嫌疑角色群組。
 * 維護重點：註解說明此檔責任範圍，避免維護時把流程、API 與 UI 狀態混在同一層。
 */

export const INTRO_TEXT_MIN_LENGTH = 8;
export const SUSPECT_REASON_PROMPT_PREFIX = "我懷疑的原因是：";
export const SUSPECT_REASON_INTUITION_TEXT = "我靠的是直覺，沒有理由";

export const INQUIRY_SUSPECT_GROUPS = [
  { id: "public", name: "一般民眾", shortName: "一般民眾" },
  { id: "developer", name: "建商/企業", shortName: "建商/企業" },
  { id: "resident", name: "當地居民", shortName: "當地居民" },
  { id: "farmer", name: "農民", shortName: "農民" },
  { id: "authority", name: "地方主管機關", shortName: "地方主管機關" },
  { id: "media", name: "媒體", shortName: "媒體" },
];
