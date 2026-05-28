/**
 * CityAuncel maintainability notes
 * 檔案用途：頁面級元件 MiaoliMap，組合多個功能模組形成完整使用流程。
 * 維護重點：這裡只補充閱讀脈絡與流程責任，避免改動既有功能邏輯。
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mediaUrl } from "@/api/apiClient";
import { MIAOLI_MAP_VIEW_BOX, labelPositions, regions } from "../data/miaoliMapView";

type RegionState = "保育" | "開發" | "我不知道" | "";
type FinalChoice = "保育" | "開發" | "我不知道";
type MapMode = "personal" | "group" | "class";
type PendingLockTarget = "personal" | "group" | null;
type MapFlowMessage = { type: "info" | "success" | "error"; text: string };
type MapSyncStatus = {
  state: "live" | "syncing" | "synced" | "unstable";
  text: string;
  updatedAt?: number;
};

const PERSONAL_MAP_CHOICE_LIMIT = 9;
const GROUP_LOCK_FALLBACK_NAMES = [
  "🌿棲地保育局",
  "🚧土地規劃局",
  "🐄農業生計局",
  "🐕犬貓管理局",
  "☀️科技投資局",
  "🎓公眾教育局",
];

type RegionDecision = {
  result: RegionState;
  locked: boolean;
  isTie: boolean;
  conserveCount: number;
  developCount: number;
  finalChoice?: FinalChoice;
};

type PersonalDecisionMap = Record<string, RegionState>;
type RegionDecisionValue = RegionDecision | RegionState;
type RegionDecisionMap = Record<string, RegionDecision>;
type ExternalDecisionMap = Record<string, RegionDecisionValue>;

type GroupMember = {
  id?: number | string;
  username?: string;
  name?: string;
  email?: string;
  isGroupLeader?: boolean;
  isPersonalMapLocked?: boolean;
  personalMapLockedAt?: string | null;
};

type MapLockSummary = {
  lockedCount: number;
  totalCount: number;
  unlockedCount: number;
  allLocked?: boolean;
};

type GroupMapLockStatus = {
  groupId?: string | number | null;
  groupName?: string | null;
  isLocked?: boolean;
  lockedAt?: string | null;
  lockedByUserId?: number | string | null;
};

export type MapUnlockedCardData =
  | string
  | {
      id: string;
      cardId?: string;
      category?: string;
      type?: string;
      title?: string;
      revealedTitle?: string;
      content?: string;
      note?: string;
      studentNote?: string;
      reflectionNote?: string;
      imageSrc?: string;
      image?: string;
      sourceType?: string;
      source?: string;
      snapshotMeta?: Record<string, unknown>;
      snapshot?: Record<string, unknown>;
      unlocked?: boolean;
      sharedFromOtherPlayer?: boolean;
      unlockedAt?: string | number | null;
    };

type RegionClueCard = {
  id: string;
  title: string;
  category: string;
  imageSrc: string;
  content: string;
  regionName: string | null;
  isGlobal: boolean;
  sourceType: string;
};

type RegionClueCardSide = "front" | "back";

type MiaoliMapProps = {
  onBack?: () => void;
  uiStorageKey?: string;

  /**
   * personal：個人自由決策
   * group：根據同組學生個人選擇統計，多數決鎖定，平手開放決策
   * class：根據六組小組結果統計，多數決鎖定，平手開放決策
   */
  mode?: MapMode;

  /** 小組模式使用：同一組內每位學生的個人地圖選擇 */
  personalData?: PersonalDecisionMap[];

  /** 全班模式使用：六個小組的小組地圖結果 */
  groupData?: ExternalDecisionMap[];

  /** 小組平手後存進資料庫的最終決策 */
  groupFinalChoices?: PersonalDecisionMap;

  /** 全班平手後存進資料庫的最終決策 */
  classFinalChoices?: PersonalDecisionMap;

  /** 外部傳入初始值，通常可接資料庫讀取結果 */
  initialState?: PersonalDecisionMap | RegionDecisionMap;

  /** 使用者切換個人 / 小組 / 全班地圖時回傳，方便 App.tsx 同步目前模式 */
  onModeChange?: (mode: MapMode) => void;

  /** 目前登入者的小組成員，通常由 /api/my-group 或 /api/me 取得 */
  groupMembers?: GroupMember[];

  /** 目前登入者的小組名稱，通常由 /api/my-group 或 /api/me 取得 */
  groupName?: string | null;

  /** 目前登入者是否為小組組長；只有組長可以決定小組平手地區 */
  isGroupLeader?: boolean;

  /** 目前登入者是否為教師；只有教師可以決定全班平手地區 */
  isTeacher?: boolean;

  /** 個人地圖鎖定後不能再修改，並作為小組地圖開放條件之一。 */
  isPersonalMapLocked?: boolean;

  /** 小組成員個人地圖鎖定進度。 */
  personalLockSummary?: MapLockSummary;

  /** 小組全員個人地圖鎖定後，才開放小組地圖。 */
  isGroupReady?: boolean;

  /** 組長鎖定小組地圖後，該組結果成為全班地圖輸入。 */
  isGroupMapLocked?: boolean;

  /** 所有小組地圖鎖定進度。 */
  groupLockSummary?: MapLockSummary;

  /** 所有小組地圖的鎖定狀態，用於顯示對應的局名。 */
  groupLockStatuses?: GroupMapLockStatus[];

  /** 所有組長鎖定小組地圖後，才開放全班地圖。 */
  allGroupsLocked?: boolean;

  /** 目前玩家已解鎖的數據卡，用於個人地圖右上角的「閱覽地區線索」。 */
  unlockedCards?: MapUnlockedCardData[];

  /** 每次地圖結果改變時回傳，方便 App.tsx 或資料庫同步 */
  onDecisionsChange?: (payload: {
    mode: MapMode;
    personalState: PersonalDecisionMap;
    decisionState: RegionDecisionMap;
  }) => void;

  /** 小組/全班平手後，手動決策需要寫回資料庫 */
  onManualDecisionChange?: (payload: {
    mode: "group" | "class";
    districtName: string;
    choice: FinalChoice | "";
  }) => void;

  /** 玩家確認完成個人地圖後呼叫，後端會鎖定並保留選擇歷程。 */
  onLockPersonalMap?: (latestMapState: PersonalDecisionMap) => void | Promise<void>;

  /** 組長確認完成小組地圖後呼叫，後端會鎖定小組結果。 */
  onLockGroupMap?: () => void | Promise<void>;

  /** 地圖同步/鎖定狀態訊息，由外層 API 結果提供。 */
  mapFlowMessage?: MapFlowMessage | null;

  /** 即時同步連線狀態。 */
  mapSyncStatus?: MapSyncStatus | null;

  /** 鎖定 API 送出中，避免重複點擊。 */
  isLockPersonalMapPending?: boolean;
  isLockGroupMapPending?: boolean;
};

type MiaoliMapUiState = {
  activeMode?: MapMode;
  selectedName?: string;
  isRegionClueModalOpen?: boolean;
};

function readMiaoliMapUiState(storageKey?: string): MiaoliMapUiState {
  if (!storageKey || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as MiaoliMapUiState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMiaoliMapUiState(storageKey: string | undefined, state: MiaoliMapUiState) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage 失敗不影響主要流程。
  }
}

const styles = `

:root {
  --app-bg:#f4efe5;
  --paper:#fffdf8;
  --paper-strong:#fff8eb;
  --panel:rgba(255, 253, 248, .94);
  --text:#243126;
  --muted:#6f7669;
  --line:#d5c6a8;
  --grid:rgba(41,83,61,.055);
  --white:#ffffff;
  --idle:#fffaf0;
  --idle-stroke:#c9b58f;
  --map-border:#bda982;
  --map-border-strong:#846f50;
  --hover:#dfead2;
  --conserve:#bfe6bf;
  --conserve-dark:#4e8c58;
  --develop:#f3b89f;
  --develop-dark:#9a604f;
  --shadow:0 14px 40px rgba(50,55,38,.13);
  --piece-shadow:0 6px 0 rgba(73,82,52,.08);
  --unknown:#d9dee7;
  --unknown-dark:#768193;
  --tie:#c9b8ff;
  --tie-dark:#6e5ac8;
  --active-gold:#f7cf6f;
  --forest:#35694a;
  --forest-deep:#214831;
  --mint:#dff2d4;
  --sun:#f6c95f;
  --coral:#ef9b7a;
}
* { box-sizing:border-box; }
.miaoli-page {
  margin:0;
  min-height:100vh;
  font-family:inherit;
  color:var(--text);
  background:
    radial-gradient(circle at 12% 10%, rgba(255,255,255,.9), transparent 18rem),
    radial-gradient(circle at 88% 8%, rgba(191,230,191,.42), transparent 18rem),
    radial-gradient(circle at 50% 105%, rgba(246,201,95,.24), transparent 28rem),
    linear-gradient(145deg, #f9f5eb 0%, #e7ead7 48%, #bfd5ac 100%);
  overflow-x:hidden;
  overflow-y:auto;
  position:relative;
}
.miaoli-page::before {
  content:"";
  pointer-events:none;
  position:absolute;
  inset:0;
  background:
    linear-gradient(115deg, rgba(255,255,255,.30), transparent 30%),
    radial-gradient(circle at 100% 100%, rgba(53,105,74,.12), transparent 360px);
}
.back-btn {
  flex:0 0 auto;
  padding:10px 16px;
  border-radius:14px;
  border:1px solid #d6c8ae;
  background:rgba(255,250,240,.92);
  color:#4f4333;
  font-weight:900;
  letter-spacing:.08em;
  cursor:pointer;
  box-shadow:0 10px 24px rgba(45,41,34,.12);
  transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
}
.wrap {
  position:relative;
  z-index:1;
  max-width:1440px;
  margin:0 auto;
  width:min(100%, 1440px);
  min-width:0;
  padding:clamp(12px, 2.2vw, 24px);
  display:grid;
  grid-template-columns:minmax(0,1.22fr) minmax(280px,.78fr);
  gap:20px;
}
.panel {
  background:var(--panel);
  border:1px solid rgba(255,255,255,.78);
  border-radius:34px;
  box-shadow:var(--shadow), inset 0 1px 0 rgba(255,255,255,.86);
  overflow:hidden;
}
.map-panel {
  min-width:0;
  padding:clamp(12px, 2vw, 22px);
  position:relative;
}
.map-panel::before,
.side::before {
  content:"";
  pointer-events:none;
  position:absolute;
  inset:0;
  opacity:.7;
  background:
    linear-gradient(90deg, var(--grid) 1px, transparent 1px),
    linear-gradient(rgba(120,92,58,.05) 1px, transparent 1px);
  background-size:28px 28px;
}

.header {
  position:relative;
  z-index:1;
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16px;
  margin-bottom:16px;
  border-bottom:1px solid rgba(53,105,74,.16);
  padding-bottom:16px;
}
.title-row {
  display:flex;
  align-items:center;
  gap:14px;
  flex-wrap:wrap;
}
h1 {
  margin:0 0 8px 0;
  font-family:inherit;
  font-size:34px;
  line-height:1.15;
  letter-spacing:.12em;
  font-weight:650;
  color:#292524;
}
.sub { margin:0; font-size:14px; line-height:1.8; color:var(--muted); }
.chips { display:flex; flex-wrap:wrap; gap:8px; }
.header-actions {
  display:flex;
  justify-content:flex-end;
  align-items:flex-start;
  flex:0 0 auto;
}
.chip {
  background:rgba(255,250,240,.88);
  border:1px solid #c8b48f;
  border-radius:999px;
  padding:8px 12px;
  font-size:13px;
  font-weight:800;
  color:#6d5e49;
  white-space:nowrap;
}
.mode-switch {
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
  margin-bottom:16px;
  padding:10px;
  border:1px solid rgba(53,105,74,.18);
  border-radius:22px;
  background:rgba(255,255,255,.58);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.88);
}
.mode-btn {
  appearance:none;
  border:1px solid rgba(53,105,74,.18);
  border-radius:16px;
  background:rgba(255,253,248,.88);
  color:#5e685b;
  padding:12px 10px;
  font-size:14px;
  font-weight:900;
  letter-spacing:.04em;
  cursor:pointer;
  box-shadow:0 8px 18px rgba(45,41,34,.06);
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
}
.mode-btn.active {
  background:linear-gradient(135deg,var(--forest-deep),var(--forest));
  border-color:rgba(33,72,49,.72);
  color:#fffdf8;
  box-shadow:0 10px 24px rgba(33,72,49,.24);
}
.stage {
  position:relative;
  z-index:1;
  border:1px solid rgba(255,255,255,.76);
  border-radius:30px;
  overflow:hidden;
  width:100%;
  max-width:100%;
  min-width:0;
  min-height:0;
  aspect-ratio: 1 / 1;
  background:
    radial-gradient(circle at 24% 18%, rgba(255,255,255,.70), transparent 32%),
    radial-gradient(circle at 82% 78%, rgba(176,197,157,.14), transparent 34%),
    radial-gradient(circle at 18% 18%, rgba(255,255,255,.72), transparent 24%),
    radial-gradient(circle at 84% 78%, rgba(176,197,157,.16), transparent 32%),
    linear-gradient(180deg, rgba(255,250,240,.98), rgba(239,231,210,.90));
  display:flex;
  align-items:center;
  justify-content:center;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);
}
.stage svg {
  display:block;
  width:100%;
  height:100%;
  max-height:100%;
  max-width:100%;
}
.piece {
  cursor:pointer;
  transition:transform .16s ease;
  will-change:transform;
}
.piece:focus { outline:none; }
.piece.locked {
  cursor:not-allowed;
}
.piece.active {
  transform:translate3d(0,-2px,0) scale(1.01);
}
.piece-shape {
  fill:var(--idle);
  stroke:var(--idle-stroke);
  stroke-width:.55;
  stroke-linejoin:round;
  stroke-linecap:round;
  vector-effect:non-scaling-stroke;
  transition:fill .16s ease, stroke .16s ease, stroke-width .16s ease;
}

.piece.active .piece-shape {
  stroke:var(--active-gold);
  stroke-width:.95;
  filter:none;
}

.piece.active .label,
.label.is-active {
  fill:#24301f;
  stroke:#fff7d6;
  stroke-width:1.4px;
}

.piece[data-state="保育"] .piece-shape {
  fill:var(--conserve);
  stroke:var(--conserve-dark);
  stroke-width:.72;
  filter:none;
  stroke-linejoin:round;
  stroke-linecap:round;
  vector-effect:non-scaling-stroke;
}

.piece[data-state="開發"] .piece-shape {
  fill:var(--develop);
  stroke:var(--develop-dark);
  stroke-width:.72;
  filter:none;
  stroke-linejoin:round;
  stroke-linecap:round;
  vector-effect:non-scaling-stroke;
}

.piece[data-state="我不知道"] .piece-shape {
  fill:var(--unknown);
  stroke:var(--unknown-dark);
  stroke-width:.72;
  filter:none;
  stroke-linejoin:round;
  stroke-linecap:round;
  vector-effect:non-scaling-stroke;
}

.piece.tie .piece-shape {
  fill:var(--tie);
  stroke:var(--tie-dark);
  stroke-width:.78;
  filter:none;
  stroke-linejoin:round;
  stroke-linecap:round;
  vector-effect:non-scaling-stroke;
}

.piece.active:not([data-state="保育"]):not([data-state="開發"]):not([data-state="我不知道"]) .piece-shape {
  fill:#fff0a8;
  stroke:var(--active-gold);
  stroke-width:.95;
}
.piece.tie:not([data-state="保育"]):not([data-state="開發"]):not([data-state="我不知道"]) .piece-shape {
  fill:var(--tie);
  stroke:var(--tie-dark);
  stroke-width:.78;
}
.piece.tie:not([data-state="保育"]):not([data-state="開發"]) .label {
  fill:#282052;
}
.label {
  pointer-events:none;
  text-anchor:middle;
  paint-order:stroke;
  stroke:rgba(255,255,255,.95);
  stroke-width:1.8px;
  stroke-linejoin:round;
  font-weight:900;
  fill:#20304a;
  letter-spacing:.03em;
}
.piece[data-state="保育"] .label,
.piece[data-state="開發"] .label,
.piece[data-state="我不知道"] .label {
  fill:#20304a;
  stroke:rgba(255,255,255,.95);
  stroke-width:1.8px;
}
.side {
  min-width:0;
  padding:clamp(12px, 2vw, 20px);
  display:flex;
  flex-direction:column;
  gap:16px;
  position:relative;
}
.card {
  position:relative;
  z-index:1;
  background:rgba(255,253,248,.82);
  border:1px solid rgba(255,255,255,.72);
  border-radius:24px;
  padding:18px;
  box-shadow:0 12px 28px rgba(50,55,38,.09), inset 0 1px 0 rgba(255,255,255,.78);
}
.card h2,.card h3 {
  margin:0 0 12px 0;
  font-family:inherit;
  font-size:22px;
  letter-spacing:.08em;
  color:#332c24;
}
.overview-title-row {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}
.overview-title-row h2 {
  margin:0;
}
.overview-title-row .chips {
  justify-content:flex-end;
  margin-left:auto;
}
.meta {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}
.stat {
  border:1px solid rgba(53,105,74,.16);
  background:rgba(255,255,255,.62);
  border-radius:18px;
  padding:12px;
  color:#6d5e49;
}
.stat strong {
  display:block;
  font-size:28px;
  margin-top:4px;
  color:#2f2a24;
}
.legend {
  display:grid;
  gap:8px;
  color:var(--muted);
  font-size:14px;
}
.legend-item {
  display:flex;
  align-items:center;
  gap:10px;
}
.swatch {
  width:16px;
  height:16px;
  border-radius:5px;
  border:1px solid rgba(61,51,35,.32);
}
.member-list {
  display:grid;
  gap:8px;
}
.member-pill {
  border:1px solid #d8c7a6;
  background:#fffdf6;
  border-radius:14px;
  padding:9px 10px;
  font-size:13px;
  font-weight:800;
  color:#4f4638;
}
.member-pill small {
  display:block;
  margin-top:2px;
  font-size:11px;
  font-weight:700;
  color:#8a7a62;
}
.empty-members {
  border:1px dashed #cdbb9a;
  border-radius:16px;
  padding:12px;
  color:#8a7a62;
  font-size:13px;
  font-weight:800;
  background:#fffdf6;
}
.selected-name {
  font-family:inherit;
  font-size:28px;
  min-height:34px;
  margin:4px 0 2px;
  font-weight:700;
  color:#2f2a24;
  display:flex;
  align-items:center;
}
.selected-state {
  min-height:28px;
  display:flex;
  align-items:center;
  font-size:14px;
  color:var(--muted);
  margin-bottom:12px;
}
.actions {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}
.map-btn {
  appearance:none;
  border:1px solid transparent;
  cursor:pointer;
  border-radius:14px;
  padding:12px 14px;
  font-weight:900;
  font-size:14px;
  box-shadow:0 8px 18px rgba(45,41,34,.08);
  transition:transform .15s ease, box-shadow .15s ease, background .15s ease;
}
.map-btn:disabled {
  opacity:.45;
  cursor:not-allowed;
  transform:none;
  box-shadow:none;
}
.btn-conserve {
  border-color:rgba(66,93,60,.28);
  background:rgba(111,143,101,.18);
  color:#425d3c;
}
.btn-develop {
  border-color:rgba(124,63,52,.25);
  background:rgba(185,106,85,.16);
  color:#7c3f34;
}
.btn-reset {
  border-color:#d7c8ad;
  background:#fffdf6;
  color:#6d5e49;
}
.btn-clearall {
  border-color:#c8b48f;
  background:#efe5d1;
  color:#4f4333;
}
.note {
  font-size:13px;
  color:var(--muted);
  line-height:1.75;
  margin:0;
}
.vote-box {
  margin:12px 0;
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}
.vote-pill {
  border:1px solid #d7c8ad;
  background:#fffdf6;
  border-radius:16px;
  padding:10px 12px;
  font-size:13px;
  color:#6d5e49;
}
.vote-pill strong {
  display:block;
  font-size:22px;
  color:#2f2a24;
  margin-top:2px;
}
.lock-info {
  border-radius:16px;
  border:1px solid #d7c8ad;
  background:rgba(255,253,246,.76);
  padding:12px;
  font-size:13px;
  line-height:1.7;
  color:#6d5e49;
  margin-bottom:12px;
}
.decision-detail-area {
  min-height:132px;
}
.decision-empty-hint {
  border-radius:16px;
  border:1px dashed #d7c8ad;
  background:rgba(255,253,246,.6);
  padding:12px;
  font-size:13px;
  line-height:1.7;
  color:#8a765d;
  margin-bottom:12px;
}


.flow-status-card {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(53,105,74,.18);
  background:
    radial-gradient(circle at 16% 0%, rgba(255,255,255,.94), transparent 8rem),
    linear-gradient(145deg, rgba(255,253,248,.96), rgba(225,238,213,.80));
  border-radius:24px;
  padding:16px;
  display:grid;
  gap:12px;
  box-shadow:0 14px 28px rgba(42,69,47,.10), inset 0 1px 0 rgba(255,255,255,.86);
}
.flow-status-card::before {
  content:"";
  position:absolute;
  inset:auto 18px 0;
  height:4px;
  border-radius:999px 999px 0 0;
  background:linear-gradient(90deg, transparent, var(--forest), var(--sun), transparent);
  opacity:.45;
}
.flow-status-card > * { position:relative; z-index:1; }
.lock-command-card {
  display:grid;
  gap:12px;
}
.lock-command-top {
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
}
.lock-command-kicker {
  margin:0 0 4px;
  font-size:11px;
  font-weight:1000;
  letter-spacing:.16em;
  color:var(--forest);
}
.lock-command-title {
  margin:0;
  font-size:17px;
  font-weight:1000;
  color:var(--forest-deep);
}
.lock-command-subtitle {
  margin:4px 0 0;
  color:#65705f;
  font-size:12px;
  font-weight:800;
  line-height:1.55;
}
.lock-hint {
  margin:0;
  color:#65705f;
  font-size:12px;
  font-weight:900;
  line-height:1.6;
  text-align:center;
}
.lock-core {
  width:54px;
  height:54px;
  flex:0 0 auto;
  border-radius:18px;
  position:relative;
  display:grid;
  place-items:center;
  background:linear-gradient(145deg, #ffffff 0%, #e6f3dc 62%, #f8d979 100%);
  box-shadow:0 14px 24px rgba(42,69,47,.14);
}
.lock-core::before {
  content:"";
  position:absolute;
  inset:-5px;
  border-radius:22px;
  border:1px solid rgba(53,105,74,.18);
}
.lock-core span {
  font-size:25px;
  filter:drop-shadow(0 2px 0 rgba(255,255,255,.66));
}
.lock-map-btn {
  width:100%;
  position:relative;
  overflow:hidden;
  border:0;
  border-radius:18px;
  background:linear-gradient(135deg,var(--forest-deep) 0%, var(--forest) 62%, #5a9c62 100%);
  color:#fffdf8;
  padding:14px 16px;
  font-weight:1000;
  letter-spacing:.08em;
  cursor:pointer;
  box-shadow:0 10px 0 rgba(33,72,49,.20), 0 18px 32px rgba(42,69,47,.20);
  transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.lock-map-btn::after {
  content:"";
  position:absolute;
  top:-90%;
  bottom:-90%;
  width:42px;
  left:-56px;
  transform:rotate(18deg);
  background:rgba(255,255,255,.36);
  transition:left .52s ease;
}
.lock-map-btn:disabled {
  cursor:not-allowed;
  opacity:.52;
  box-shadow:none;
}
.lock-map-btn:not(:disabled):hover {
  transform:translateY(-2px);
  box-shadow:0 12px 0 rgba(33,72,49,.18), 0 22px 38px rgba(42,69,47,.22);
}
.lock-map-btn:not(:disabled):hover::after { left:115%; }
.confirm-lock-backdrop {
  position:fixed;
  inset:0;
  z-index:60;
  display:grid;
  place-items:center;
  padding:22px;
  background:rgba(22,34,24,.40);
  backdrop-filter:blur(8px);
}
.confirm-lock-dialog {
  width:min(440px,100%);
  position:relative;
  overflow:hidden;
  border-radius:28px;
  border:1px solid rgba(255,255,255,.76);
  background:
    radial-gradient(circle at 18% 8%, rgba(255,255,255,.98), transparent 8rem),
    linear-gradient(145deg,#fffdf8 0%,#e9f2de 58%,#f7cf72 100%);
  box-shadow:0 26px 76px rgba(20,32,22,.32), inset 0 1px 0 rgba(255,255,255,.82);
  padding:24px;
}
.confirm-lock-dialog::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:linear-gradient(135deg, rgba(53,105,74,.09), transparent 42%);
}
.confirm-lock-dialog > * { position:relative; z-index:1; }
.confirm-lock-icon {
  width:62px;
  height:62px;
  display:grid;
  place-items:center;
  border-radius:22px;
  background:#ffffff;
  border:1px solid rgba(53,105,74,.16);
  box-shadow:0 14px 24px rgba(42,69,47,.13);
  font-size:32px;
  margin-bottom:14px;
}
.confirm-lock-title {
  margin:0;
  font-size:24px;
  font-weight:1000;
  color:var(--forest-deep);
}
.confirm-lock-message {
  margin:10px 0 0;
  color:#4f5e50;
  font-size:14px;
  font-weight:800;
  line-height:1.8;
}
.confirm-lock-warning {
  margin:14px 0 0;
  border-radius:18px;
  border:1px solid rgba(239,155,122,.28);
  background:rgba(255,247,232,.82);
  color:#8b4d38;
  padding:11px 12px;
  font-size:13px;
  font-weight:1000;
  line-height:1.55;
}
.confirm-lock-actions {
  margin-top:18px;
  display:grid;
  grid-template-columns:1fr 1.2fr;
  gap:10px;
}
.confirm-lock-cancel,
.confirm-lock-confirm {
  border:0;
  border-radius:16px;
  padding:12px 14px;
  cursor:pointer;
  font-weight:1000;
  letter-spacing:.06em;
  transition:transform .15s ease, box-shadow .15s ease;
}
.confirm-lock-cancel {
  background:rgba(255,255,255,.72);
  color:#4f5e50;
  border:1px solid rgba(53,105,74,.16);
}
.confirm-lock-confirm {
  background:linear-gradient(135deg,var(--forest-deep),var(--forest));
  color:#fffdf8;
  box-shadow:0 8px 0 rgba(33,72,49,.18), 0 14px 24px rgba(42,69,47,.18);
}
.confirm-lock-cancel:hover,
.confirm-lock-confirm:hover { transform:translateY(-1px); }
.sync-collector {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(53,105,74,.18);
  border-radius:26px;
  padding:18px;
  background:
    radial-gradient(circle at 14% 10%, rgba(255,255,255,.96), transparent 9rem),
    radial-gradient(circle at 92% 12%, rgba(246,201,95,.32), transparent 9rem),
    linear-gradient(145deg, rgba(255,253,248,.98), rgba(223,242,212,.78));
  box-shadow:0 18px 34px rgba(42,69,47,.12), inset 0 1px 0 rgba(255,255,255,.84);
}
.sync-collector::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(90deg, transparent, rgba(255,255,255,.46), transparent),
    repeating-linear-gradient(90deg, rgba(53,105,74,.06) 0 1px, transparent 1px 20px);
  transform:translateX(-100%);
  animation:collector-scan 2.8s ease-in-out infinite;
}
.sync-collector.is-complete {
  border-color:rgba(53,105,74,.34);
  background:
    radial-gradient(circle at 50% 8%, rgba(246,201,95,.46), transparent 11rem),
    linear-gradient(145deg, rgba(255,253,248,.98), rgba(210,241,199,.92));
}
.sync-collector.is-complete::after {
  content:"";
  position:absolute;
  inset:12px;
  border-radius:22px;
  pointer-events:none;
  border:1px solid rgba(246,201,95,.48);
  box-shadow:0 0 28px rgba(246,201,95,.32), inset 0 0 24px rgba(246,201,95,.16);
}
.sync-collector > * { position:relative; z-index:1; }
.sync-header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px;
}
.sync-kicker {
  margin:0 0 4px;
  color:var(--forest);
  font-size:11px;
  font-weight:1000;
  letter-spacing:.16em;
}
.sync-title {
  margin:0;
  font-size:19px;
  font-weight:1000;
  color:var(--forest-deep);
}
.sync-orb {
  width:68px;
  height:68px;
  flex:0 0 auto;
  border-radius:22px;
  display:grid;
  place-items:center;
  color:#fffdf8;
  font-size:20px;
  font-weight:1000;
  background:linear-gradient(145deg,var(--forest-deep),var(--forest) 58%,#68a46d);
  box-shadow:0 14px 24px rgba(42,69,47,.20), 0 0 0 7px rgba(53,105,74,.10);
}
.sync-track {
  height:20px;
  border-radius:999px;
  overflow:hidden;
  border:1px solid rgba(53,105,74,.18);
  background:rgba(255,255,255,.70);
  box-shadow:inset 0 2px 6px rgba(42,69,47,.10);
}
.sync-track-fill {
  height:100%;
  min-width:10px;
  border-radius:999px;
  background:linear-gradient(90deg,var(--forest) 0%,#77b86f 42%,var(--sun) 66%,#77b86f 100%);
  background-size:190% 100%;
  box-shadow:0 0 18px rgba(53,105,74,.34);
  animation:progress-flow 1.9s linear infinite;
  transition:width .55s cubic-bezier(.22,1,.36,1);
}
.sync-slots {
  margin-top:13px;
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(64px,1fr));
  gap:9px;
}
.sync-slot {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(53,105,74,.14);
  border-radius:18px;
  min-height:74px;
  background:rgba(255,255,255,.60);
  display:grid;
  place-items:center;
  gap:6px;
  padding:9px 6px;
  text-align:center;
  color:#6f7669;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.82);
}
.sync-slot.is-locked {
  border-color:rgba(53,105,74,.35);
  background:linear-gradient(180deg, rgba(223,242,212,.96), rgba(255,250,230,.92));
  color:var(--forest-deep);
  animation:slot-pop .38s ease both;
}
.sync-slot.is-pending {
  animation:member-pulse 1.9s ease-in-out infinite;
}
.sync-slot-mark {
  width:35px;
  height:35px;
  border-radius:14px;
  display:grid;
  place-items:center;
  font-size:16px;
  font-weight:1000;
  background:#fffdf8;
  border:1px solid rgba(53,105,74,.18);
}
.sync-slot.is-locked .sync-slot-mark {
  background:var(--forest);
  border-color:var(--forest);
  color:#fffdf8;
  box-shadow:0 0 0 6px rgba(53,105,74,.12);
}
.sync-slot-name {
  width:100%;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
  font-weight:1000;
}
.team-lock-panel {
  padding:16px;
}
.sync-header-stacked {
  align-items:flex-start;
}
.sync-group-meta {
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin-top:9px;
}
.sync-group-meta span {
  border:1px solid rgba(53,105,74,.16);
  background:rgba(255,255,255,.66);
  border-radius:999px;
  padding:4px 8px;
  color:#5f6a58;
  font-size:11px;
  font-weight:900;
}
.sync-slots.is-member-roster {
  grid-template-columns:1fr;
  gap:8px;
}
.sync-slots.is-member-roster .sync-slot {
  min-height:62px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  text-align:left;
  padding:10px 12px;
}
.sync-slots.is-member-roster .sync-slot.is-leader {
  border-color:rgba(216,145,34,.42);
  background:linear-gradient(135deg, rgba(255,248,226,.96), rgba(223,242,212,.78));
}
.sync-slot-body {
  min-width:0;
  display:grid;
  gap:3px;
}
.sync-slots.is-member-roster .sync-slot-name {
  width:auto;
  display:flex;
  align-items:center;
  gap:6px;
  font-size:13px;
  color:#2f3e31;
}
.sync-slot-status {
  color:#7d876f;
  font-size:11px;
  font-weight:900;
}
.sync-slot.is-locked .sync-slot-status {
  color:var(--forest);
}
.sync-leader-badge {
  flex:0 0 auto;
  border:1px solid rgba(216,145,34,.38);
  background:rgba(255,241,200,.92);
  color:#9b6818;
  border-radius:999px;
  padding:2px 6px;
  font-size:10px;
  line-height:1.2;
  font-weight:1000;
}
.sync-action-row {
  margin-top:12px;
  display:grid;
  gap:12px;
}
.sync-action-row .sync-note {
  margin:0;
}
.sync-action-row .lock-map-btn {
  width:100%;
}
.sync-note {
  margin:12px 0 0;
  color:#5d685d;
  font-size:12px;
  font-weight:800;
  line-height:1.65;
}
.sync-complete-banner {
  margin-top:12px;
  border-radius:18px;
  border:1px solid rgba(53,105,74,.22);
  background:linear-gradient(135deg, rgba(223,242,212,.96), rgba(255,238,161,.92));
  color:var(--forest-deep);
  padding:12px;
  font-size:13px;
  font-weight:1000;
  letter-spacing:.04em;
  text-align:center;
  box-shadow:0 12px 24px rgba(42,69,47,.11);
  animation:complete-bounce .88s ease-in-out infinite alternate;
}
@keyframes collector-scan {
  0% { transform:translateX(-100%); opacity:.10; }
  45% { opacity:.55; }
  100% { transform:translateX(100%); opacity:.10; }
}
@keyframes progress-flow {
  from { background-position:0 0; }
  to { background-position:240px 0; }
}
@keyframes member-pulse {
  0%,100% { transform:translateY(0); box-shadow:none; }
  50% { transform:translateY(-2px); box-shadow:0 9px 18px rgba(42,69,47,.10); }
}
@keyframes slot-pop {
  0% { transform:scale(.96); }
  70% { transform:scale(1.04); }
  100% { transform:scale(1); }
}
@keyframes complete-bounce {
  from { transform:translateY(0) scale(1); }
  to { transform:translateY(-3px) scale(1.012); }
}

.compact-card {
  padding: 14px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.card-title-row h3 {
  margin: 0;
}

.group-name {
  font-size: 12px;
  font-weight: 800;
  color: #7a6a52;
  background: #fff7df;
  border: 1px solid #e2cfaa;
  border-radius: 999px;
  padding: 4px 8px;
  white-space: nowrap;
}

.btn-unknown {
  background:rgba(154,160,166,.18);
  border:2px solid rgba(95,102,109,.28);
  border-radius:16px;
  color:#5f666d;
  font-weight:900;
  padding: 14px 0;
  box-shadow: none;
  transition: all 0.15s ease;
}

.member-avatar-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #ddc9a7;
  background: #fffaf0;
  border-radius: 999px;
  padding: 4px 8px 4px 4px;
  max-width: 120px;
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: #8fb66a;
  color: #fffdf6;
  font-size: 13px;
  font-weight: 900;
  flex: 0 0 auto;
}

.avatar-name {
  font-size: 12px;
  font-weight: 800;
  color: #4f4333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-avatar.leader {
  border-color: #f1b84b;
  background: #fff3cf;
}

.member-avatar.leader .avatar-circle {
  background: #d99122;
}

.leader-crown {
  font-size: 12px;
  line-height: 1;
}



/* compact right-side map flow panels */
.meta.is-compact-stats {
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
}
.meta.is-compact-stats .stat {
  padding:9px 8px;
  border-radius:15px;
}
.meta.is-compact-stats .stat span {
  display:block;
  min-height:16px;
  font-size:11px;
  font-weight:900;
  color:#6a725f;
  white-space:nowrap;
}
.meta.is-compact-stats .stat strong {
  font-size:22px;
  margin-top:1px;
}
.team-lock-panel {
  padding:12px;
  border-radius:20px;
}
.team-lock-panel .sync-header {
  gap:10px;
  margin-bottom:9px;
}
.team-lock-panel .sync-kicker {
  margin-bottom:2px;
  font-size:10px;
  letter-spacing:.12em;
}
.team-lock-panel .sync-title {
  font-size:15px;
  line-height:1.35;
}
.team-lock-panel .sync-group-meta {
  margin-top:6px;
  gap:5px;
}
.team-lock-panel .sync-group-meta span {
  padding:3px 7px;
  font-size:10px;
}
.team-lock-panel .sync-orb {
  width:50px;
  height:50px;
  border-radius:18px;
  font-size:15px;
  box-shadow:0 8px 18px rgba(42,69,47,.14), 0 0 0 5px rgba(53,105,74,.08);
}
.team-lock-panel .sync-track {
  height:13px;
}
.sync-slots.is-member-roster {
  grid-template-columns:repeat(auto-fit,minmax(116px,1fr));
  gap:6px;
  margin-top:8px;
}
.sync-slots.is-member-roster .sync-slot {
  min-height:42px;
  padding:7px 8px;
  border-radius:14px;
  gap:7px;
}
.sync-slots.is-member-roster .sync-slot-mark {
  width:25px;
  height:25px;
  border-radius:10px;
  font-size:12px;
}
.sync-slots.is-member-roster .sync-slot-name {
  font-size:11px;
  gap:4px;
}
.sync-slots.is-member-roster .sync-slot-status {
  font-size:10px;
}
.sync-slots.is-member-roster .sync-leader-badge {
  padding:1px 5px;
  font-size:9px;
}
.team-lock-panel .sync-note,
.team-lock-panel .sync-action-row {
  margin-top:8px;
}
.team-lock-panel .sync-note {
  font-size:11px;
  line-height:1.55;
}
.team-lock-panel .lock-map-btn {
  padding:11px 13px;
  border-radius:15px;
}
.sync-collector:not(.team-lock-panel) {
  padding:13px;
  border-radius:21px;
}
.sync-collector:not(.team-lock-panel) .sync-header {
  margin-bottom:10px;
}
.sync-collector:not(.team-lock-panel) .sync-title {
  font-size:16px;
}
.sync-collector:not(.team-lock-panel) .sync-orb {
  width:54px;
  height:54px;
  border-radius:18px;
  font-size:15px;
  box-shadow:0 9px 18px rgba(42,69,47,.16), 0 0 0 5px rgba(53,105,74,.09);
}
.sync-collector:not(.team-lock-panel) .sync-track {
  height:14px;
}
.sync-collector:not(.team-lock-panel) .sync-slots {
  grid-template-columns:repeat(auto-fit,minmax(92px,1fr));
  gap:7px;
}
.sync-collector:not(.team-lock-panel) .sync-slot {
  min-height:46px;
  border-radius:14px;
  padding:7px;
  gap:4px;
}
.sync-collector:not(.team-lock-panel) .sync-slot-mark {
  width:25px;
  height:25px;
  border-radius:10px;
  font-size:12px;
}
.sync-collector:not(.team-lock-panel) .sync-slot-name {
  font-size:10px;
  line-height:1.2;
  white-space:normal;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}
.sync-collector:not(.team-lock-panel) .sync-note {
  margin-top:9px;
  font-size:11px;
}
.compact-decision-card {
  padding:14px;
}
.compact-decision-card .selected-name {
  font-size:23px;
  min-height:28px;
}
.compact-decision-card .selected-state {
  min-height:22px;
  margin-bottom:8px;
  font-size:12px;
}
.compact-decision-card .lock-info,
.compact-decision-card .decision-empty-hint {
  padding:9px 10px;
  border-radius:13px;
  font-size:12px;
  line-height:1.55;
  margin-bottom:9px;
}
.compact-decision-card .decision-detail-area {
  min-height:0;
}
.compact-decision-card .vote-box {
  margin:8px 0;
  gap:7px;
}
.compact-decision-card .vote-pill {
  padding:8px 9px;
  border-radius:13px;
  font-size:12px;
}
.compact-decision-card .vote-pill strong {
  font-size:18px;
  margin-top:0;
}
.compact-decision-card .actions {
  gap:8px;
}
.compact-decision-card .map-btn {
  padding:10px 11px;
  border-radius:13px;
  font-size:13px;
}
@media (max-width: 1180px) {
  .meta.is-compact-stats {
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}

.legend-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  overflow-x: visible;
  padding-bottom: 4px;
}

.legend-inline .legend-item {
  flex: 0 1 auto;
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: break-word;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #fffaf0;
  border: 1px solid #e2cfaa;
}

.legend-inline .swatch {
  width: 14px;
  height: 14px;
}

.map-floating-legend {
  position:absolute;
  left:50%;
  top:14px;
  transform:translateX(-50%);
  z-index:4;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  flex-wrap:wrap;
  max-width:min(78%, 580px);
  padding:8px 10px;
  border:1px solid rgba(53,105,74,.18);
  border-radius:999px;
  background:rgba(255,255,255,.72);
  backdrop-filter:blur(12px);
  box-shadow:0 12px 24px rgba(42,69,47,.12), inset 0 1px 0 rgba(255,255,255,.82);
}
.map-floating-legend .legend-item {
  gap:5px;
  font-size:11px;
  font-weight:1000;
  color:#425347;
  white-space:nowrap;
}
.map-floating-legend .swatch {
  width:12px;
  height:12px;
  border-radius:5px;
  border-color:rgba(53,105,74,.20);
}


.stage::before {
  content:"石虎任務地圖";
  position:absolute;
  left:16px;
  top:14px;
  z-index:2;
  border:2px solid rgba(74,46,27,.48);
  border-radius:999px;
  background:linear-gradient(180deg,#fff8cf,#ffd86d);
  color:#4a2e1b;
  padding:7px 12px;
  font-size:12px;
  font-weight:1000;
  letter-spacing:.12em;
  box-shadow:0 5px 0 rgba(74,46,27,.16);
  pointer-events:none;
}
.stage::after {
  content:"🐾";
  position:absolute;
  right:18px;
  bottom:16px;
  z-index:2;
  display:grid;
  place-items:center;
  width:44px;
  height:44px;
  border-radius:18px;
  border:2px solid rgba(74,46,27,.42);
  background:rgba(255,250,226,.86);
  box-shadow:0 5px 0 rgba(74,46,27,.14);
  font-size:24px;
  pointer-events:none;
}

.region-clue-btn {
  position:absolute;
  right:18px;
  top:16px;
  z-index:4;
  border:2px solid rgba(74,46,27,.42);
  border-radius:999px;
  background:linear-gradient(180deg,#fffaf0,#f6df9f);
  color:#4a2e1b;
  padding:9px 14px;
  font-size:13px;
  font-weight:1000;
  letter-spacing:.08em;
  box-shadow:0 6px 0 rgba(74,46,27,.16), 0 14px 24px rgba(45,41,34,.14);
  cursor:pointer;
  transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
}
.region-clue-btn:disabled {
  cursor:not-allowed;
  opacity:.52;
  transform:none;
}
.clue-modal-backdrop {
  position:fixed;
  inset:0;
  z-index:80;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(38,32,24,.42);
  backdrop-filter:blur(5px);
}
.clue-modal {
  width:min(960px, 96vw);
  min-width:0;
  max-height:min(760px, 88vh);
  overflow:hidden;
  border:2px solid rgba(182,159,123,.88);
  border-radius:30px;
  background:#fffaf0;
  box-shadow:0 26px 70px rgba(35,28,20,.28);
  display:flex;
  flex-direction:column;
}
.clue-modal-header {
  display:flex;
  min-width:0;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px;
  padding:20px 22px 16px;
  border-bottom:1px solid #e0ceb0;
  background:linear-gradient(180deg,#fff8df,#fffaf0);
}
.clue-modal-title {
  margin:0;
  font-size:24px;
  font-weight:1000;
  letter-spacing:.08em;
  color:#332c24;
}
.clue-modal-subtitle {
  margin:7px 0 0;
  color:#756957;
  font-size:13px;
  line-height:1.7;
  font-weight:800;
}
.clue-modal-close {
  flex:0 0 auto;
  border:1px solid #d7c8ad;
  border-radius:14px;
  background:#fffdf6;
  color:#5b4b37;
  padding:9px 12px;
  font-weight:1000;
  cursor:pointer;
}
.clue-modal-body {
  overflow:auto;
  overflow-x:hidden;
  padding:18px 22px 22px;
  min-width:0;
}
.clue-section {
  min-width:0;
  max-width:100%;
}
.clue-section + .clue-section { margin-top:22px; }
.clue-section-title {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin:0 0 12px;
  font-size:17px;
  font-weight:1000;
  color:#3f3529;
  letter-spacing:.06em;
}
.clue-count-chip {
  border:1px solid #dfcba8;
  border-radius:999px;
  background:#fff7df;
  color:#7a6240;
  padding:4px 9px;
  font-size:12px;
  font-weight:1000;
}
.clue-grid {
  display:flex;
  flex-wrap:wrap;
  gap:16px;
  width:100%;
  max-width:100%;
  overflow:hidden;
}
.clue-card {
  aspect-ratio:22 / 21;
  width:100%;
  min-width:0;
  max-width:220px;
  border:0;
  border-radius:24px;
  background:transparent;
  padding:0;
  perspective:1000px;
  cursor:pointer;
  text-align:left;
  touch-action:pan-y;
}
.clue-card-shell {
  position:relative;
  width:100%;
  height:100%;
  border-radius:24px;
  transform-style:preserve-3d;
  transition:transform .45s cubic-bezier(.2,.75,.25,1);
}
.clue-card.is-flipped .clue-card-shell {
  transform:rotateY(180deg);
}
.clue-card-face {
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  min-width:0;
  max-width:100%;
  overflow:hidden;
  border:1px solid #e2d4bd;
  border-radius:24px;
  background:#fff7ea;
  padding:6px;
  box-shadow:0 12px 30px rgba(45,41,34,.08);
  backface-visibility:hidden;
}
.clue-card-face.back {
  transform:rotateY(180deg);
  background:#fffaf0;
}
.clue-card-image-wrap {
  flex:1 1 auto;
  min-height:0;
  width:100%;
  max-width:100%;
  overflow:hidden;
  border:1px solid #eadfcf;
  border-radius:18px;
  background:#fffaf0;
}
.clue-card-image {
  width:100%;
  height:100%;
  max-width:100%;
  object-fit:contain;
  display:block;
}
.clue-card-image.placeholder {
  display:grid;
  place-items:center;
  color:#9a8464;
  font-size:12px;
  font-weight:900;
}
.clue-card-title-wrap {
  flex:0 0 auto;
  padding:4px 8px 6px;
}
.clue-card-title {
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  width:100%;
  overflow:hidden;
  margin:0;
  color:#332c24;
  font-size:14px;
  line-height:1.42;
  font-weight:1000;
  text-align:center;
  overflow-wrap:anywhere;
}
.clue-record-content {
  flex:1 1 auto;
  min-height:0;
  overflow-y:auto;
  overscroll-behavior:contain;
  border:1px solid #eadfcf;
  border-radius:18px;
  background:rgba(255,255,255,.78);
  padding:10px;
  color:#575047;
  font-size:12px;
  font-weight:600;
  line-height:1.7;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
}
.clue-empty-record {
  color:#8a7a62;
  font-weight:800;
}
.clue-empty {
  border:1px dashed #d5bea0;
  border-radius:18px;
  background:#fffdf6;
  color:#8a7a62;
  padding:14px;
  font-size:13px;
  font-weight:900;
  line-height:1.7;
}
@media (max-width: 640px) {
  .map-floating-legend {
    top:52px;
    max-width:calc(100% - 24px);
    border-radius:18px;
    padding:6px 8px;
    gap:5px;
  }
  .map-floating-legend .legend-item {
    font-size:10px;
  }
  .region-clue-btn {
    right:12px;
    top:12px;
    padding:8px 10px;
    font-size:12px;
  }
  .clue-modal-header { padding:16px; }
  .clue-modal-body { padding:14px 16px 18px; }
  .clue-grid { justify-content:center; }
  .clue-card { max-width:min(100%, 260px); }
}
.map-panel, .side, .stage, .card, .mode-switch {
  transform:translateZ(0);
  backface-visibility:hidden;
}
@media (max-width: 1180px) and (min-width: 901px) {
  .wrap {
    grid-template-columns:minmax(0,1fr) minmax(240px,.68fr);
    gap:14px;
    padding:clamp(10px, 1.6vw, 18px);
  }

  .map-panel {
    padding:clamp(10px, 1.6vw, 16px);
  }

  .side {
    min-width:0;
  }
}

@media (max-width: 900px) {
  .wrap {
    grid-template-columns:1fr;
  }

  .stage {
    aspect-ratio:1 / 1;
  }
}
@media (max-width: 640px) {
  .header {
    flex-direction:column;
  }
  .header-actions {
    width:100%;
    justify-content:flex-end;
  }
  .overview-title-row {
    align-items:flex-start;
  }
  .overview-title-row .chips {
    flex:1 1 auto;
  }
  h1 {
    font-size:clamp(24px, 8vw, 34px);
  }
  .mode-switch {
    grid-template-columns:1fr;
  }
  .actions, .vote-box, .meta {
    grid-template-columns:1fr;
  }
  .panel {
    border-radius:24px;
  }
  .stage {
    border-radius:22px;
    min-height:min(92vw, 520px);
  }
}

/* final map layout and progress polish */
.wrap {
  padding:clamp(10px, 1.6vw, 18px);
  gap:clamp(12px, 1.6vw, 16px);
}
.map-panel {
  padding:clamp(10px, 1.45vw, 16px);
}
.side {
  padding:clamp(10px, 1.45vw, 16px);
  gap:12px;
}
.header {
  margin-bottom:12px;
  padding-bottom:12px;
  gap:12px;
}
h1 {
  font-size:clamp(26px, 2.45vw, 31px);
}
.sub {
  font-size:13px;
  line-height:1.65;
}
.chip {
  padding:6px 10px;
  font-size:12px;
}
.mode-switch {
  margin-bottom:12px;
  padding:8px;
  gap:8px;
  border-radius:19px;
}
.mode-btn {
  padding:10px 9px;
  border-radius:14px;
  font-size:13px;
}
.card {
  padding:14px;
  border-radius:21px;
}
.card h2,.card h3 {
  margin-bottom:10px;
  font-size:19px;
}
.stage {
  aspect-ratio:380 / 300;
  border-radius:25px;
}
.sync-track-fill {
  position:relative;
  overflow:hidden;
  background:
    repeating-linear-gradient(90deg,
      var(--forest) 0px,
      #5f9f60 56px,
      #f2cb66 112px,
      #5f9f60 168px,
      var(--forest) 224px);
  background-size:240px 100%;
  animation:progress-flow 5.8s linear infinite;
  box-shadow:0 0 12px rgba(53,105,74,.26), 0 0 22px rgba(246,201,95,.18);
}
.sync-track-fill::after {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:linear-gradient(180deg, rgba(255,255,255,.44), rgba(255,255,255,0) 48%, rgba(255,255,255,.18));
  mix-blend-mode:screen;
}
.sync-slots.is-member-roster .sync-slot.is-leader {
  border-color:rgba(53,105,74,.14);
  background:rgba(255,255,255,.60);
}
.sync-slots.is-member-roster .sync-slot.is-leader.is-locked {
  border-color:rgba(53,105,74,.35);
  background:linear-gradient(180deg, rgba(223,242,212,.96), rgba(255,250,230,.92));
}
.sync-leader-badge {
  border-color:rgba(53,105,74,.24);
  background:rgba(223,242,212,.86);
  color:var(--forest);
}
.team-lock-panel .sync-slots.is-member-roster .sync-slot {
  box-shadow:inset 0 1px 0 rgba(255,255,255,.82);
}
.team-lock-panel .sync-slots.is-member-roster .sync-slot.is-pending {
  color:#6f7669;
}
@media (max-width: 900px) {
  .stage {
    aspect-ratio:380 / 300;
  }
}
@media (max-width: 640px) {
  .wrap {
    padding:10px;
  }
  .stage {
    aspect-ratio:380 / 300;
    min-height:0;
  }
  .card {
    padding:12px;
  }
}


/* non-overlap map toolbar: every left-map control owns an explicit slot */
.map-stage-toolbar {
  position:relative;
  z-index:2;
  display:grid;
  grid-template-columns:minmax(116px, .62fr) minmax(260px, 1.45fr) minmax(132px, .7fr);
  align-items:center;
  gap:10px;
  margin-bottom:10px;
  min-width:0;
}
.map-stage-title {
  min-width:0;
  justify-self:start;
  border:1px solid rgba(53,105,74,.20);
  border-radius:999px;
  background:linear-gradient(180deg, rgba(255,253,248,.96), rgba(236,246,226,.92));
  color:var(--forest-deep);
  padding:7px 11px;
  font-size:12px;
  font-weight:1000;
  letter-spacing:.12em;
  white-space:nowrap;
  box-shadow:0 8px 18px rgba(42,69,47,.08), inset 0 1px 0 rgba(255,255,255,.84);
}
.map-stage-toolbar .map-floating-legend {
  position:static;
  left:auto;
  top:auto;
  transform:none;
  z-index:auto;
  justify-self:center;
  max-width:100%;
  width:auto;
  padding:7px 9px;
  border-color:rgba(53,105,74,.18);
  background:rgba(255,255,255,.74);
}
.map-toolbar-action {
  min-width:0;
  display:flex;
  justify-content:flex-end;
  align-items:center;
}
.map-stage-toolbar .region-clue-btn {
  position:static;
  right:auto;
  top:auto;
  z-index:auto;
  padding:8px 12px;
  font-size:12px;
  box-shadow:0 8px 18px rgba(42,69,47,.10), inset 0 1px 0 rgba(255,255,255,.84);
}
.map-toolbar-mode-chip {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(53,105,74,.18);
  border-radius:999px;
  background:rgba(255,253,248,.72);
  color:#617067;
  padding:7px 11px;
  font-size:12px;
  font-weight:1000;
  white-space:nowrap;
}
.stage {
  padding:10px;
  align-items:stretch;
  justify-content:stretch;
}
.stage::before,
.stage::after {
  content:none;
  display:none;
}
.stage svg {
  width:100%;
  height:100%;
  min-height:0;
}
@media (max-width: 1060px) {
  .map-stage-toolbar {
    grid-template-columns:1fr;
    justify-items:stretch;
  }
  .map-stage-title,
  .map-stage-toolbar .map-floating-legend,
  .map-toolbar-action {
    justify-self:stretch;
  }
  .map-stage-title,
  .map-toolbar-action {
    justify-content:center;
  }
  .map-toolbar-action {
    display:flex;
  }
  .map-stage-toolbar .region-clue-btn,
  .map-toolbar-mode-chip {
    width:100%;
  }
}
@media (max-width: 640px) {
  .map-stage-toolbar {
    gap:8px;
    margin-bottom:8px;
  }
  .map-stage-toolbar .map-floating-legend {
    max-width:100%;
    border-radius:18px;
    padding:6px 8px;
    gap:5px;
  }
  .map-stage-toolbar .region-clue-btn {
    padding:8px 10px;
    font-size:12px;
  }
}

/* unified compact controls: shared map controls size themselves by content */
.actions,
.compact-decision-card .actions {
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:flex-start;
  gap:8px;
}
.map-btn,
.compact-decision-card .map-btn,
.btn-unknown {
  width:auto;
  min-width:0;
  min-height:38px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  border-radius:999px;
  padding:9px 13px;
  font-size:13px;
  line-height:1.25;
  white-space:nowrap;
  letter-spacing:.03em;
}
.btn-conserve,
.btn-develop,
.btn-unknown,
.btn-reset,
.btn-clearall {
  border-width:1px;
  box-shadow:0 6px 14px rgba(45,41,34,.06);
}
.btn-unknown {
  border:1px solid rgba(95,102,109,.22);
  background:rgba(154,160,166,.16);
}

/* compact inline leader badge used inside the normal progress slots */
.sync-slot-name .sync-leader-badge {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:auto;
  margin-left:4px;
  border-radius:999px;
  border:1px solid rgba(53,105,74,.22);
  background:rgba(223,242,212,.82);
  color:var(--forest);
  padding:1px 5px;
  font-size:9px;
  font-weight:1000;
  line-height:1.2;
  white-space:nowrap;
}

/* member lock chips: one member owns only the space its text needs */
.sync-slots.is-member-roster {
  display:flex;
  flex-wrap:wrap;
  align-items:flex-start;
  justify-content:flex-start;
  grid-template-columns:none;
  gap:7px;
}
.sync-slots.is-member-roster .sync-slot {
  width:auto;
  max-width:100%;
  min-height:34px;
  flex:0 0 auto;
  display:inline-flex;
  align-items:center;
  justify-content:flex-start;
  gap:6px;
  padding:5px 8px 5px 6px;
  border-radius:999px;
  text-align:left;
}
.sync-slots.is-member-roster .sync-slot-mark {
  width:22px;
  height:22px;
  border-radius:999px;
  font-size:11px;
}
.sync-slots.is-member-roster .sync-slot-body {
  min-width:0;
  display:inline-flex;
  align-items:center;
  flex-wrap:wrap;
  gap:4px;
}
.sync-slots.is-member-roster .sync-slot-name {
  width:auto;
  max-width:132px;
  display:inline-flex;
  align-items:center;
  gap:4px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
  line-height:1.2;
}
.sync-slots.is-member-roster .sync-slot-status,
.sync-slots.is-member-roster .sync-leader-badge {
  width:auto;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  border-radius:999px;
  padding:2px 6px;
  font-size:9px;
  line-height:1.2;
  white-space:nowrap;
}
.sync-slots.is-member-roster .sync-slot-status {
  border:1px solid rgba(53,105,74,.14);
  background:rgba(255,255,255,.58);
  color:#6f7669;
}
.sync-slots.is-member-roster .sync-slot.is-locked .sync-slot-status {
  border-color:rgba(53,105,74,.22);
  background:rgba(223,242,212,.78);
  color:var(--forest);
}
.sync-slots.is-member-roster .sync-leader-badge {
  border:1px solid rgba(53,105,74,.22);
  background:rgba(223,242,212,.82);
  color:var(--forest);
}
@media (max-width: 640px) {
  .map-btn,
  .compact-decision-card .map-btn,
  .btn-unknown {
    min-height:36px;
    padding:8px 12px;
    font-size:12px;
  }
  .sync-slots.is-member-roster .sync-slot-name {
    max-width:118px;
  }
}


/* 統一個人 / 小組 / 全班整體統計：全部使用小組地圖的 compact 統計卡規格 */
.meta.is-compact-stats {
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:8px;
}
.meta.is-compact-stats .stat {
  min-height:56px;
  padding:9px 8px;
  border-radius:15px;
  border-color:rgba(53,105,74,.16);
  background:rgba(255,255,255,.62);
}
.meta.is-compact-stats .stat span {
  display:block;
  min-height:16px;
  font-size:11px;
  font-weight:900;
  color:#6a725f;
  white-space:nowrap;
}
.meta.is-compact-stats .stat strong {
  font-size:22px;
  margin-top:1px;
  color:#2f2a24;
}

/* 讓個人地圖的小組成員鎖定進度與小組地圖的班級鎖定進度使用同一套背景色與格子風格 */
.side .sync-collector {
  background:
    radial-gradient(circle at 14% 10%, rgba(255,255,255,.96), transparent 9rem),
    radial-gradient(circle at 92% 12%, rgba(246,201,95,.32), transparent 9rem),
    linear-gradient(145deg, rgba(255,253,248,.98), rgba(223,242,212,.78));
}
.side .sync-collector .sync-slot {
  border-color:rgba(53,105,74,.14);
  background:rgba(255,255,255,.60);
  color:#6f7669;
}
.side .sync-collector .sync-slot.is-locked {
  border-color:rgba(53,105,74,.35);
  background:linear-gradient(180deg, rgba(223,242,212,.96), rgba(255,250,230,.92));
  color:var(--forest-deep);
}
.side .sync-collector .sync-leader-badge {
  border-color:rgba(53,105,74,.24);
  background:rgba(223,242,212,.86);
  color:var(--forest);
}
@media (max-width: 640px) {
  .meta.is-compact-stats {
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}


/* final map UI consistency: toolbar pills/buttons share one visual size */
.map-stage-toolbar {
  grid-template-columns:minmax(max-content, .7fr) minmax(260px, 1.4fr) minmax(max-content, .7fr);
}
.map-stage-title,
.map-stage-toolbar .region-clue-btn,
.map-toolbar-mode-chip {
  min-height:38px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:auto;
  max-width:100%;
  border:1px solid rgba(53,105,74,.20);
  border-radius:999px;
  background:linear-gradient(180deg, rgba(255,253,248,.96), rgba(236,246,226,.92));
  color:var(--forest-deep);
  padding:0 14px;
  font-size:12px;
  font-weight:1000;
  line-height:1;
  letter-spacing:.08em;
  white-space:nowrap;
  box-shadow:0 8px 18px rgba(42,69,47,.08), inset 0 1px 0 rgba(255,255,255,.84);
}
.map-stage-toolbar .region-clue-btn {
  position:static;
  cursor:pointer;
}
.map-stage-toolbar .region-clue-btn:not(:disabled):hover,
.map-toolbar-mode-chip:hover,
.map-stage-title:hover {
  transform:none;
}
.map-toolbar-action {
  justify-content:flex-end;
}
.map-stage-toolbar .map-floating-legend {
  min-height:38px;
  padding:5px 10px;
  border-radius:999px;
}

/* progress panel: remove the extra outer card layer so personal progress matches class-lock progress */
.progress-shell-card {
  padding:0;
  border:0;
  background:transparent;
  box-shadow:none;
}
.progress-shell-card > .sync-collector,
.progress-shell-card > .flow-status-card {
  width:100%;
}

/* personal member progress uses a clean class-progress layout without the old orange glow/frame */
.progress-shell-card .sync-collector {
  border:1px solid rgba(53,105,74,.18);
  border-radius:26px;
  background:
    radial-gradient(circle at 14% 10%, rgba(255,255,255,.92), transparent 9rem),
    linear-gradient(145deg, rgba(255,253,248,.98), rgba(223,242,212,.78));
  box-shadow:0 12px 26px rgba(42,69,47,.10), inset 0 1px 0 rgba(255,255,255,.84);
}
.progress-shell-card .sync-collector.is-complete {
  border-color:rgba(53,105,74,.24);
  background:
    radial-gradient(circle at 14% 10%, rgba(255,255,255,.92), transparent 9rem),
    linear-gradient(145deg, rgba(255,253,248,.98), rgba(210,241,199,.86));
}
.progress-shell-card .sync-collector.is-complete::after {
  display:none;
}
.progress-shell-card .sync-slots {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(64px,1fr));
  gap:9px;
  margin-top:13px;
}

.progress-shell-card .sync-track-fill {
  background:linear-gradient(90deg, var(--forest) 0%, #77b86f 50%, #9bcf7e 100%);
  background-size:190% 100%;
  box-shadow:0 0 18px rgba(53,105,74,.30);
}
.progress-shell-card .sync-slot {
  min-height:74px;
  width:auto;
  display:grid;
  place-items:center;
  gap:6px;
  padding:9px 6px;
  border-radius:18px;
  text-align:center;
  border:1px solid rgba(53,105,74,.14);
  background:rgba(255,255,255,.60);
  color:#6f7669;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.82);
}
.progress-shell-card .sync-slot.is-locked {
  border-color:rgba(53,105,74,.35);
  background:linear-gradient(180deg, rgba(223,242,212,.96), rgba(255,250,230,.92));
  color:var(--forest-deep);
}
.progress-shell-card .sync-slot-mark {
  width:35px;
  height:35px;
  border-radius:14px;
  display:grid;
  place-items:center;
  font-size:16px;
  font-weight:1000;
  background:#fffdf8;
  border:1px solid rgba(53,105,74,.18);
}
.progress-shell-card .sync-slot.is-locked .sync-slot-mark {
  background:var(--forest);
  border-color:var(--forest);
  color:#fffdf8;
  box-shadow:0 0 0 6px rgba(53,105,74,.12);
}
.progress-shell-card .sync-slot-name {
  width:100%;
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:11px;
  font-weight:1000;
  line-height:1.25;
}
.progress-shell-card .sync-leader-badge {
  display:none;
}

@media (max-width: 1060px) {
  .map-stage-toolbar {
    grid-template-columns:1fr;
    justify-items:center;
  }
  .map-stage-title,
  .map-stage-toolbar .region-clue-btn,
  .map-toolbar-mode-chip,
  .map-stage-toolbar .map-floating-legend {
    justify-self:center;
    width:auto;
  }
  .map-toolbar-action {
    justify-content:center;
  }
}
@media (max-width: 640px) {
  .map-stage-title,
  .map-stage-toolbar .region-clue-btn,
  .map-toolbar-mode-chip {
    min-height:36px;
    padding:0 12px;
    font-size:11px;
  }
  .progress-shell-card .sync-slots {
    grid-template-columns:repeat(auto-fit,minmax(58px,1fr));
    gap:7px;
  }
  .progress-shell-card .sync-slot {
    min-height:68px;
  }
}

/* redesigned shared lock-progress panel: personal group progress and class progress use the same terminal-style design */
.progress-shell-card {
  padding:0;
  border:0;
  background:transparent;
  box-shadow:none;
}
.side .progress-shell-card .sync-collector,
.progress-shell-card .sync-collector {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(116, 215, 154, .28);
  border-radius:24px;
  background:
    radial-gradient(circle at 12% 0%, rgba(95, 240, 178, .22), transparent 9rem),
    radial-gradient(circle at 88% 8%, rgba(118, 210, 255, .14), transparent 8.5rem),
    linear-gradient(145deg, rgba(20, 45, 31, .96), rgba(34, 76, 49, .93) 52%, rgba(238, 249, 227, .94));
  box-shadow:
    0 18px 34px rgba(18, 55, 31, .18),
    inset 0 1px 0 rgba(255,255,255,.18);
  color:#f8fff4;
}
.progress-shell-card .sync-collector::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(120deg, transparent 0 28%, rgba(255,255,255,.14) 42%, transparent 58% 100%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.045) 0 1px, transparent 1px 22px);
  background-size:240% 100%, auto;
  animation:sync-panel-sheen 8s linear infinite;
  opacity:.72;
}
.progress-shell-card .sync-collector.is-complete {
  border-color:rgba(126, 244, 178, .48);
  background:
    radial-gradient(circle at 50% 0%, rgba(113, 255, 178, .32), transparent 9rem),
    radial-gradient(circle at 88% 8%, rgba(118, 210, 255, .18), transparent 8.5rem),
    linear-gradient(145deg, rgba(18, 66, 38, .97), rgba(39, 104, 61, .94) 54%, rgba(227, 250, 218, .96));
  box-shadow:
    0 20px 42px rgba(34, 92, 51, .22),
    0 0 0 1px rgba(126, 244, 178, .16),
    inset 0 1px 0 rgba(255,255,255,.22);
}
.progress-shell-card .sync-collector.is-complete::after {
  display:none;
}
.progress-shell-card .sync-header {
  gap:10px;
  margin-bottom:10px;
}
.progress-shell-card .sync-kicker {
  color:rgba(196, 255, 214, .82);
  letter-spacing:.14em;
}
.progress-shell-card .sync-title {
  color:#fffef4;
  text-shadow:0 1px 8px rgba(7, 28, 15, .32);
}
.progress-shell-card .sync-group-meta span {
  border-color:rgba(191, 255, 207, .20);
  background:rgba(255,255,255,.10);
  color:rgba(247, 255, 239, .88);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
}
.progress-shell-card .sync-orb {
  color:#092817;
  background:
    radial-gradient(circle at 35% 25%, rgba(255,255,255,.92), transparent 38%),
    linear-gradient(145deg, #caff9d, #66f0a4 52%, #31a966);
  box-shadow:
    0 10px 24px rgba(17, 68, 34, .26),
    0 0 0 6px rgba(106, 235, 153, .14),
    0 0 28px rgba(106, 235, 153, .28);
}
.progress-shell-card .sync-track {
  height:14px;
  border:1px solid rgba(201, 255, 218, .24);
  background:rgba(8, 34, 19, .36);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,.24),
    0 0 0 1px rgba(255,255,255,.05);
}
.progress-shell-card .sync-track-fill {
  position:relative;
  overflow:hidden;
  min-width:10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,0) 48%, rgba(255,255,255,.20)),
    repeating-linear-gradient(90deg,
      #34c776 0px,
      #63efaa 40px,
      #85f7cf 80px,
      #63efaa 120px,
      #34c776 160px);
  background-size:100% 100%, 160px 100%;
  box-shadow:
    0 0 12px rgba(80, 243, 156, .42),
    0 0 26px rgba(80, 243, 156, .26);
  animation:sync-progress-seamless 4.8s linear infinite;
  transition:width .55s cubic-bezier(.22,1,.36,1);
}
.progress-shell-card .sync-slots {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(68px,1fr));
  gap:8px;
  margin-top:11px;
}
.progress-shell-card .sync-slot {
  min-height:66px;
  padding:8px 6px;
  border:1px solid rgba(202, 255, 220, .17);
  border-radius:18px;
  background:rgba(255,255,255,.075);
  color:rgba(245,255,238,.80);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    0 8px 16px rgba(7, 28, 15, .08);
  backdrop-filter:blur(7px);
}
.progress-shell-card .sync-slot.is-pending {
  animation:sync-node-idle 2.8s ease-in-out infinite;
}
.progress-shell-card .sync-slot.is-locked {
  border-color:rgba(111, 246, 161, .42);
  background:linear-gradient(145deg, rgba(106, 235, 153, .24), rgba(255,255,255,.10));
  color:#f8fff4;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.20),
    0 0 20px rgba(93, 236, 145, .16);
}
.progress-shell-card .sync-slot-mark {
  width:30px;
  height:30px;
  border-radius:12px;
  background:rgba(255,255,255,.10);
  border:1px solid rgba(211, 255, 226, .22);
  color:rgba(247,255,239,.80);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
}
.progress-shell-card .sync-slot.is-locked .sync-slot-mark {
  color:#0b2b17;
  background:linear-gradient(145deg, #d9ffc2, #6cf1a6);
  border-color:rgba(167, 255, 194, .68);
  box-shadow:
    0 0 0 5px rgba(106, 235, 153, .12),
    0 0 18px rgba(106, 235, 153, .30);
}
.progress-shell-card .sync-slot-name {
  color:inherit;
  opacity:.96;
}
.progress-shell-card .sync-note {
  margin-top:10px;
  color:rgba(247, 255, 239, .78);
}
.progress-shell-card .sync-complete-banner {
  margin-top:10px;
  border:1px solid rgba(126, 244, 178, .30);
  background:rgba(218, 255, 203, .14);
  color:#f8fff4;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12);
}
.progress-shell-card .sync-action-row {
  margin-top:9px;
}
.progress-shell-card .lock-map-btn {
  border:1px solid rgba(199,255,211,.30);
  background:linear-gradient(135deg, #d6ffbc, #64e99d 48%, #2c9b5c);
  color:#0d2a17;
  box-shadow:0 12px 26px rgba(30, 105, 54, .22), 0 0 18px rgba(95, 240, 178, .20);
}
@keyframes sync-progress-seamless {
  from { background-position:0 0, 0 0; }
  to { background-position:0 0, 160px 0; }
}
@keyframes sync-panel-sheen {
  from { background-position:240% 0, 0 0; }
  to { background-position:-40% 0, 0 0; }
}
@keyframes sync-node-idle {
  0%, 100% { transform:translateY(0); }
  50% { transform:translateY(-1px); }
}
@media (max-width: 640px) {
  .progress-shell-card .sync-slots {
    grid-template-columns:repeat(auto-fit,minmax(62px,1fr));
  }
  .progress-shell-card .sync-slot {
    min-height:62px;
  }
}


  


/* light forest redesign override: keep the polished progress motion but make the whole map page bright and coherent */
:root {
  --light-page-1:#fffaf0;
  --light-page-2:#f3f8e8;
  --light-page-3:#dfeecf;
  --light-card:rgba(255,255,252,.88);
  --light-card-solid:#fffefa;
  --light-green:#2f7a4d;
  --light-green-2:#56a86c;
  --light-mint:#dff6dd;
  --light-mint-2:#f0fae9;
  --light-gold:#f4d36b;
  --light-line:rgba(72,117,76,.18);
  --light-text:#243526;
  --light-muted:#647463;
  --light-shadow:0 18px 42px rgba(58,86,50,.12);
}

.miaoli-page {
  color:var(--game-ink, #2e2118);
  background:
    radial-gradient(circle at 14% 14%, rgba(255,255,255,0.78), transparent 16rem),
    radial-gradient(circle at 88% 12%, rgba(239,214,138,0.30), transparent 17rem),
    radial-gradient(circle at 52% 105%, rgba(156,175,134,0.30), transparent 30rem),
    linear-gradient(145deg, #fff3cf 0%, #ead7a7 44%, #b5c99a 100%);
}
.miaoli-page::before {
  background:
    radial-gradient(circle at 11% 20%, rgba(74,46,27,0.10) 0 5px, transparent 6px),
    radial-gradient(circle at 16% 23%, rgba(74,46,27,0.07) 0 2px, transparent 3px),
    radial-gradient(circle at 84% 24%, rgba(74,46,27,0.08) 0 4px, transparent 5px),
    linear-gradient(100deg, rgba(255,255,255,0.26) 0 1px, transparent 1px 58px);
  background-size:210px 210px, 210px 210px, 260px 260px, 180px 180px;
  opacity:.9;
}
.panel {
  background:linear-gradient(180deg, rgba(255,255,253,.90), rgba(248,252,241,.86));
  border:1px solid rgba(255,255,255,.86);
  box-shadow:var(--light-shadow), inset 0 1px 0 rgba(255,255,255,.92);
}
.map-panel::before,
.side::before {
  opacity:.42;
  background:
    radial-gradient(circle at 8% 0%, rgba(244,211,107,.12), transparent 12rem),
    linear-gradient(90deg, rgba(47,122,77,.035) 1px, transparent 1px),
    linear-gradient(rgba(47,122,77,.025) 1px, transparent 1px);
  background-size:auto, 30px 30px, 30px 30px;
}
.header {
  border-bottom-color:rgba(47,122,77,.14);
}
h1 {
  color:#23442c;
  text-shadow:0 1px 0 rgba(255,255,255,.7);
}
.back-btn,
.chip,
.group-name {
  border-color:rgba(47,122,77,.18);
  background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(241,249,233,.88));
  color:#365a3f;
  box-shadow:0 10px 22px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.9);
}
.mode-switch {
  border-color:rgba(47,122,77,.16);
  background:rgba(255,255,255,.58);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 10px 24px rgba(58,86,50,.06);
}
.mode-btn {
  border-color:rgba(47,122,77,.14);
  background:linear-gradient(180deg, rgba(255,255,255,.95), rgba(244,250,237,.86));
  color:#55705b;
  box-shadow:0 8px 16px rgba(58,86,50,.06);
}
.mode-btn.active {
  color:#fffefa;
  border-color:rgba(47,122,77,.55);
  background:linear-gradient(135deg, #27633d, #3f9659 68%, #7bc77c);
  box-shadow:0 12px 26px rgba(47,122,77,.22), inset 0 1px 0 rgba(255,255,255,.26);
}
.stage {
  border-color:rgba(255,255,255,.82);
  background:
    radial-gradient(circle at 20% 16%, rgba(255,255,255,.84), transparent 30%),
    radial-gradient(circle at 82% 78%, rgba(191,231,178,.26), transparent 35%),
    linear-gradient(180deg, rgba(255,254,248,.99), rgba(236,246,226,.92));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.68), 0 16px 32px rgba(58,86,50,.09);
}
.card {
  background:linear-gradient(180deg, rgba(255,255,253,.88), rgba(248,252,241,.80));
  border-color:rgba(255,255,255,.78);
  box-shadow:0 14px 28px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.86);
}
.card h2,.card h3 {
  color:#29462f;
}
.stat {
  border-color:rgba(47,122,77,.15);
  background:linear-gradient(180deg, rgba(255,255,255,.86), rgba(241,249,233,.78));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.78);
}
.stat strong {
  color:#23442c;
}
.map-stage-title,
.map-stage-toolbar .region-clue-btn,
.map-toolbar-mode-chip,
.map-stage-toolbar .map-floating-legend {
  border-color:rgba(47,122,77,.18);
  background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(239,249,231,.86));
  color:#2f5c3a;
  box-shadow:0 9px 20px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.9);
}
.map-stage-toolbar .region-clue-btn:not(:disabled):hover,
.mode-btn:not(:disabled):hover,
.back-btn:hover,
.map-btn:not(:disabled):hover {
  transform:translateY(-1px);
  box-shadow:0 12px 24px rgba(58,86,50,.12), inset 0 1px 0 rgba(255,255,255,.9);
}
.legend-item,
.map-floating-legend .legend-item {
  color:#3f6148;
}
.selected-name {
  color:#253c2a;
}
.selected-state,
.note,
.lock-info,
.decision-empty-hint {
  color:#667563;
}
.btn-conserve {
  border-color:rgba(47,122,77,.22);
  background:linear-gradient(180deg, rgba(234,249,226,.94), rgba(210,238,199,.86));
  color:#2f6d42;
}
.btn-develop {
  border-color:rgba(168,91,65,.18);
  background:linear-gradient(180deg, rgba(255,244,237,.94), rgba(247,214,198,.80));
  color:#8a4f3d;
}
.btn-unknown,
.btn-reset,
.btn-clearall {
  border-color:rgba(88,104,94,.16);
  background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(240,244,237,.82));
  color:#58685e;
}
.lock-info,
.decision-empty-hint,
.vote-pill {
  border-color:rgba(47,122,77,.14);
  background:rgba(255,255,255,.70);
}

/* shared lock-progress panel: redesigned as light aurora glass so it matches the page */
.progress-shell-card {
  padding:0;
  border:0;
  background:transparent;
  box-shadow:none;
}
.side .progress-shell-card .sync-collector,
.progress-shell-card .sync-collector {
  position:relative;
  overflow:hidden;
  border:1px solid rgba(47,122,77,.16);
  border-radius:24px;
  color:#24452c;
  background:
    radial-gradient(circle at 10% 0%, rgba(255,255,255,.96), transparent 9rem),
    radial-gradient(circle at 90% 12%, rgba(151,221,151,.34), transparent 9rem),
    radial-gradient(circle at 55% 110%, rgba(244,211,107,.22), transparent 12rem),
    linear-gradient(145deg, rgba(255,255,253,.96), rgba(238,249,230,.90));
  box-shadow:0 18px 36px rgba(58,86,50,.11), inset 0 1px 0 rgba(255,255,255,.92);
}
.progress-shell-card .sync-collector::before {
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  opacity:.72;
  background:
    linear-gradient(120deg, transparent 0 28%, rgba(255,255,255,.70) 42%, transparent 58% 100%),
    repeating-linear-gradient(90deg, rgba(47,122,77,.035) 0 1px, transparent 1px 24px);
  background-size:260% 100%, auto;
  animation:sync-panel-sheen-light 9s linear infinite;
}
.progress-shell-card .sync-collector.is-complete {
  border-color:rgba(47,122,77,.28);
  background:
    radial-gradient(circle at 50% 0%, rgba(168,238,154,.44), transparent 10rem),
    radial-gradient(circle at 88% 8%, rgba(244,211,107,.26), transparent 9rem),
    linear-gradient(145deg, rgba(255,255,253,.98), rgba(225,247,215,.94));
  box-shadow:0 20px 42px rgba(58,86,50,.14), inset 0 1px 0 rgba(255,255,255,.94);
}
.progress-shell-card .sync-collector.is-complete::after {
  display:none;
}
.progress-shell-card .sync-kicker {
  color:#3b8551;
}
.progress-shell-card .sync-title {
  color:#24452c;
  text-shadow:none;
}
.progress-shell-card .sync-group-meta span {
  border-color:rgba(47,122,77,.14);
  background:rgba(255,255,255,.62);
  color:#59705a;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.74);
}
.progress-shell-card .sync-orb {
  color:#1f4e2f;
  background:
    radial-gradient(circle at 35% 24%, rgba(255,255,255,.95), transparent 38%),
    linear-gradient(145deg, #f6ffe9, #bff2b5 54%, #73c878);
  box-shadow:0 12px 24px rgba(58,86,50,.16), 0 0 0 7px rgba(80,166,90,.10), 0 0 28px rgba(98,184,105,.18);
}
.progress-shell-card .sync-track {
  height:14px;
  border:1px solid rgba(47,122,77,.15);
  background:rgba(255,255,255,.72);
  box-shadow:inset 0 2px 6px rgba(58,86,50,.10), 0 0 0 1px rgba(255,255,255,.62);
}
.progress-shell-card .sync-track-fill {
  position:relative;
  overflow:hidden;
  min-width:10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.52), rgba(255,255,255,0) 48%, rgba(255,255,255,.18)),
    repeating-linear-gradient(90deg,
      #2f9255 0px,
      #5ac978 44px,
      #a8e98c 88px,
      #5ac978 132px,
      #2f9255 176px);
  background-size:100% 100%, 176px 100%;
  box-shadow:0 0 12px rgba(60,170,90,.34), 0 0 24px rgba(60,170,90,.20);
  animation:sync-progress-light-seamless 5.2s linear infinite;
  transition:width .55s cubic-bezier(.22,1,.36,1);
}
.progress-shell-card .sync-slots {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(68px,1fr));
  gap:8px;
  margin-top:11px;
}
.progress-shell-card .sync-slot {
  min-height:66px;
  padding:8px 6px;
  border:1px solid rgba(47,122,77,.13);
  border-radius:18px;
  color:#5e705f;
  background:rgba(255,255,255,.60);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.84), 0 8px 16px rgba(58,86,50,.05);
  backdrop-filter:blur(7px);
}
.progress-shell-card .sync-slot.is-pending {
  animation:sync-node-idle-light 2.8s ease-in-out infinite;
}
.progress-shell-card .sync-slot.is-locked {
  color:#24452c;
  border-color:rgba(47,122,77,.30);
  background:linear-gradient(145deg, rgba(225,247,215,.96), rgba(255,255,252,.78));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.90), 0 0 18px rgba(65,160,86,.13);
}
.progress-shell-card .sync-slot-mark {
  width:30px;
  height:30px;
  border-radius:12px;
  color:#5d715f;
  background:rgba(255,255,255,.72);
  border:1px solid rgba(47,122,77,.16);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.86);
}
.progress-shell-card .sync-slot.is-locked .sync-slot-mark {
  color:#fffefa;
  background:linear-gradient(145deg, #2f7a4d, #65c56f);
  border-color:rgba(47,122,77,.42);
  box-shadow:0 0 0 5px rgba(91,194,101,.12), 0 0 18px rgba(91,194,101,.24);
}
.progress-shell-card .sync-slot-name {
  color:inherit;
  opacity:.98;
}
.progress-shell-card .sync-note {
  color:#607360;
}
.progress-shell-card .sync-complete-banner {
  margin-top:10px;
  border:1px solid rgba(47,122,77,.20);
  background:linear-gradient(135deg, rgba(225,247,215,.95), rgba(255,248,218,.90));
  color:#2f6940;
  box-shadow:0 10px 22px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.80);
}
.progress-shell-card .lock-map-btn,
.lock-map-btn {
  border:1px solid rgba(47,122,77,.22);
  background:linear-gradient(135deg, #2f7a4d, #63bb6d 64%, #a7df7c);
  color:#fffefa;
  box-shadow:0 12px 24px rgba(47,122,77,.22), 0 0 18px rgba(91,194,101,.16);
}
.flow-status-card {
  border-color:rgba(47,122,77,.16);
  background:linear-gradient(145deg, rgba(255,255,253,.92), rgba(238,249,230,.84));
  box-shadow:0 14px 28px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.86);
}

.map-flow-message {
  border-radius:18px;
  border:1px solid rgba(47,122,77,.18);
  background:linear-gradient(135deg, rgba(255,255,253,.92), rgba(238,249,230,.86));
  color:#385a3e;
  font-size:13px;
  font-weight:800;
  line-height:1.55;
  padding:10px 12px;
  box-shadow:0 10px 22px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.86);
}
.map-flow-message.is-error {
  border-color:rgba(168,91,65,.22);
  background:linear-gradient(135deg, rgba(255,250,246,.94), rgba(255,233,221,.84));
  color:#8a4f3d;
}
.map-flow-message.is-success {
  border-color:rgba(47,122,77,.24);
  background:linear-gradient(135deg, rgba(235,250,229,.96), rgba(255,249,221,.84));
  color:#2f6940;
}
.map-flow-message.is-info {
  border-color:rgba(65,125,164,.18);
  background:linear-gradient(135deg, rgba(250,253,255,.96), rgba(227,244,242,.84));
  color:#32606a;
}


.map-sync-status {
  display:inline-flex;
  align-items:center;
  gap:6px;
  width:max-content;
  border-radius:999px;
  border:1px solid rgba(65,122,82,.18);
  background:rgba(255,253,248,.86);
  color:#45634c;
  font-size:12px;
  font-weight:900;
  line-height:1;
  padding:7px 10px;
  box-shadow:0 8px 18px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.8);
}
.map-sync-status::before {
  content:"";
  width:8px;
  height:8px;
  border-radius:999px;
  background:#63a46e;
  box-shadow:0 0 0 4px rgba(99,164,110,.14), 0 0 12px rgba(69,143,86,.35);
}
.map-sync-status.is-syncing::before { animation: mapSyncPulse 1s ease-in-out infinite; }
.map-sync-status.is-synced::before { background:#4fae7b; }
.map-sync-status.is-unstable {
  border-color:rgba(169,100,68,.22);
  color:#8a563a;
  background:rgba(255,249,240,.9);
}
.map-sync-status.is-unstable::before {
  background:#d99055;
  box-shadow:0 0 0 4px rgba(217,144,85,.15), 0 0 12px rgba(183,103,54,.28);
}
.teacher-preview-chip {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:999px;
  border:1px solid rgba(73,124,85,.22);
  background:linear-gradient(135deg, rgba(235,249,226,.95), rgba(255,253,248,.92));
  color:#315f3c;
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  box-shadow:0 8px 16px rgba(58,86,50,.08);
}

.side-top-status {
  position:relative;
  z-index:1;
  display:flex;
  justify-content:flex-end;
  margin:-2px 0 10px;
}
.side-top-status .map-sync-status {
  background:rgba(255,253,248,.72);
  box-shadow:0 6px 14px rgba(58,86,50,.06), inset 0 1px 0 rgba(255,255,255,.78);
}

@keyframes mapSyncPulse {
  0%, 100% { transform:scale(1); opacity:1; }
  50% { transform:scale(.72); opacity:.55; }
}

.teacher-preview-banner {
  display:flex;
  align-items:flex-start;
  gap:9px;
  border:1px solid rgba(77,126,91,.22);
  border-radius:18px;
  background:linear-gradient(135deg, rgba(255,253,248,.94), rgba(235,247,225,.90));
  color:#385a3e;
  font-size:12px;
  font-weight:850;
  line-height:1.6;
  padding:10px 12px;
  box-shadow:0 10px 22px rgba(58,86,50,.08), inset 0 1px 0 rgba(255,255,255,.85);
}
.teacher-preview-icon {
  width:24px;
  height:24px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:999px;
  background:rgba(226,241,216,.9);
  flex:0 0 auto;
}
.lock-checklist {
  display:grid;
  gap:7px;
  width:100%;
  border-radius:18px;
  padding:10px;
  background:rgba(255,255,253,.68);
  border:1px solid rgba(54,118,75,.14);
}
.lock-checklist-title {
  color:#315f3c;
  font-size:12px;
  font-weight:950;
  letter-spacing:.04em;
}
.lock-check-item {
  display:flex;
  align-items:center;
  gap:8px;
  color:#58705d;
  font-size:12px;
  font-weight:850;
  line-height:1.45;
}
.lock-check-mark {
  width:20px;
  height:20px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:999px;
  font-size:12px;
  font-weight:950;
  flex:0 0 auto;
}
.lock-check-item.is-done .lock-check-mark {
  background:linear-gradient(135deg, #5fac69, #d8f3c8);
  color:#123c22;
  box-shadow:0 6px 14px rgba(68,132,72,.18);
}
.lock-check-item.is-pending .lock-check-mark {
  background:#fff4df;
  color:#9a6a23;
  border:1px solid rgba(174,122,42,.18);
}
.map-flow-message.is-success {
  position:relative;
  overflow:hidden;
  border-color:rgba(47,122,77,.30);
  background:linear-gradient(135deg, rgba(236,252,227,.98), rgba(255,250,225,.92));
  box-shadow:0 12px 26px rgba(58,118,66,.12), 0 0 0 1px rgba(255,255,255,.74) inset;
}
.map-flow-message.is-success::after {
  content:"";
  position:absolute;
  inset:-40% auto -40% -35%;
  width:42%;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.72), transparent);
  transform:skewX(-18deg);
  animation:map-success-sheen 1.7s ease-out both;
}
@keyframes map-success-sheen {
  from { left:-40%; opacity:0; }
  20% { opacity:1; }
  to { left:115%; opacity:0; }
}

.tie-worklist {
  border:1px solid rgba(110,90,200,.16);
  background:linear-gradient(135deg, rgba(255,255,253,.88), rgba(241,238,255,.70));
  border-radius:18px;
  padding:10px;
}
.tie-worklist-title {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  color:#51448f;
  font-size:12px;
  font-weight:900;
  letter-spacing:.05em;
}
.tie-worklist-title strong {
  min-width:26px;
  height:26px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border-radius:999px;
  background:#ebe7ff;
  color:#6e5ac8;
}
.tie-worklist-items {
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin-top:9px;
}
.tie-worklist-chip {
  width:auto;
  min-width:0;
  border:1px solid rgba(110,90,200,.18);
  border-radius:999px;
  background:rgba(255,255,255,.78);
  color:#5b5291;
  font-size:12px;
  font-weight:850;
  padding:6px 10px;
  cursor:pointer;
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
}
.tie-worklist-chip:hover,
.tie-worklist-chip.is-active {
  transform:translateY(-1px);
  background:#ebe7ff;
  box-shadow:0 8px 16px rgba(89,75,160,.12);
}
@keyframes sync-progress-light-seamless {
  from { background-position:0 0, 0 0; }
  to { background-position:0 0, 176px 0; }
}
@keyframes sync-panel-sheen-light {
  from { background-position:260% 0, 0 0; }
  to { background-position:-60% 0, 0 0; }
}
@keyframes sync-node-idle-light {
  0%, 100% { transform:translateY(0); }
  50% { transform:translateY(-1px); }
}


`;

function isRegionDecision(value: unknown): value is RegionDecision {
  return Boolean(
    value &&
    typeof value === "object" &&
    "result" in value &&
    "locked" in value &&
    "isTie" in value,
  );
}

function normalizePersonalState(
  value?: PersonalDecisionMap | RegionDecisionMap,
) {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).map(([name, decision]) => [
      name,
      isRegionDecision(decision) ? decision.result : decision,
    ]),
  ) as PersonalDecisionMap;
}

function arePersonalStatesSame(
  a: PersonalDecisionMap,
  b: PersonalDecisionMap,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => a[key] === b[key]);
}

function areDecisionStatesSame(
  a: RegionDecisionMap,
  b: RegionDecisionMap,
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => {
    const left = a[key];
    const right = b[key];

    return (
      left?.result === right?.result &&
      left?.locked === right?.locked &&
      left?.isTie === right?.isTie &&
      left?.conserveCount === right?.conserveCount &&
      left?.developCount === right?.developCount &&
      left?.finalChoice === right?.finalChoice
    );
  });
}

function createPersonalSignature(value?: PersonalDecisionMap | RegionDecisionMap) {
  if (!value) return "";

  return regions
    .map((region) => {
      const decision = value[region.name];
      const result = isRegionDecision(decision) ? decision.result : decision || "";

      return `${region.name}:${result}`;
    })
    .join("|");
}

function normalizeDecisionState(
  value?: PersonalDecisionMap | RegionDecisionMap,
) {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value).map(([name, decision]) => {
      if (isRegionDecision(decision)) return [name, decision];

      return [
        name,
        {
          result: decision,
          locked: false,
          isTie: false,
          conserveCount: decision === "保育" ? 1 : 0,
          developCount: decision === "開發" ? 1 : 0,
        },
      ];
    }),
  ) as RegionDecisionMap;
}

function resolveVote(choices: RegionState[]): RegionDecision {
  const conserveCount = choices.filter((choice) => choice === "保育").length;
  const developCount = choices.filter((choice) => choice === "開發").length;
  const unknownCount = choices.filter((choice) => choice === "我不知道").length;
  const knownVotes = conserveCount + developCount;

  if (conserveCount > developCount) {
    return {
      result: "保育",
      locked: true,
      isTie: false,
      conserveCount,
      developCount,
    };
  }

  if (developCount > conserveCount) {
    return {
      result: "開發",
      locked: true,
      isTie: false,
      conserveCount,
      developCount,
    };
  }

  if (knownVotes === 0 && unknownCount === choices.length && choices.length > 0) {
    return {
      result: "我不知道",
      locked: true,
      isTie: false,
      conserveCount,
      developCount,
    };
  }

  return {
    result: "",
    locked: false,
    isTie: knownVotes > 0 && conserveCount === developCount,
    conserveCount,
    developCount,
  };
}

function getDecisionResult(decision?: RegionDecision | RegionState): RegionState {
  if (
    decision === "保育" ||
    decision === "開發" ||
    decision === "我不知道" ||
    decision === ""
  ) {
    return decision;
  }

  return decision?.finalChoice || decision?.result || "";
}

function buildGroupState(
  personalData: PersonalDecisionMap[] | undefined,
  manualState: RegionDecisionMap,
) {
  const next: RegionDecisionMap = {};

  regions.forEach((region) => {
    const votes =
      personalData?.map((student) => student[region.name] || "") || [];
    const resolved = resolveVote(votes);
    const manualChoice =
      manualState[region.name]?.finalChoice || manualState[region.name]?.result;

    next[region.name] =
      resolved.isTie && manualChoice
        ? { ...resolved, result: manualChoice, finalChoice: manualChoice }
        : resolved;
  });

  return next;
}

function buildClassState(
  groupData: ExternalDecisionMap[] | undefined,
  manualState: RegionDecisionMap,
) {
  const next: RegionDecisionMap = {};

  regions.forEach((region) => {
    const votes =
      groupData?.map((group) => getDecisionResult(group[region.name])) || [];
    const resolved = resolveVote(votes);
    const manualChoice =
      manualState[region.name]?.finalChoice || manualState[region.name]?.result;

    next[region.name] =
      resolved.isTie && manualChoice
        ? { ...resolved, result: manualChoice, finalChoice: manualChoice }
        : resolved;
  });

  return next;
}

function choicesToManualDecisionState(
  choices?: PersonalDecisionMap,
): RegionDecisionMap {
  const next: RegionDecisionMap = {};

  Object.entries(choices || {}).forEach(([name, choice]) => {
    if (choice !== "保育" && choice !== "開發") return;

    next[name] = {
      result: choice,
      locked: false,
      isTie: true,
      conserveCount: 0,
      developCount: 0,
      finalChoice: choice,
    };
  });

  return next;
}

function getPersonalChoiceCounts(state: PersonalDecisionMap) {
  const values = Object.values(state);

  return {
    conserve: values.filter((value) => value === "保育").length,
    develop: values.filter((value) => value === "開發").length,
  };
}

function wouldExceedPersonalChoiceLimit(
  state: PersonalDecisionMap,
  name: string,
  nextState: RegionState,
) {
  if (nextState !== "保育" && nextState !== "開發") return false;
  if (state[name] === nextState) return false;

  const counts = getPersonalChoiceCounts(state);
  const nextCount = nextState === "保育" ? counts.conserve : counts.develop;

  return nextCount >= PERSONAL_MAP_CHOICE_LIMIT;
}


const CATEGORY_LABELS: Record<string, string> = {
  water: "水資源",
  land: "土地資料",
  leopard: "石虎相關資訊",
  rumor: "謠言",
  other: "其他資料",
};

const FIXED_CARD_IMAGE_FILES_BY_CATEGORY: Record<string, string[]> = {
  water: [],
  land: [
    "dahu_development_population_density.webp",
    "dahu_development_traffic_volume.webp",
    "dahu_land_01.webp",
    "gongguan_development_population_density.webp",
    "gongguan_development_traffic_volume.webp",
    "gongguan_land_01.webp",
    "houlong_development_population_density.webp",
    "houlong_development_traffic_volume.webp",
    "houlong_land_01.webp",
    "miaoli_development_population_density.webp",
    "miaoli_development_traffic_volume.webp",
    "miaoli_land_01.webp",
    "nanzhuang_development_population_density.webp",
    "nanzhuang_land_01.webp",
    "sanwan_development_population_density.webp",
    "sanwan_development_traffic_volume.webp",
    "sanwan_land_01.webp",
    "sanyi_development_population_density.webp",
    "sanyi_development_traffic_volume.webp",
    "sanyi_land_01.webp",
    "shitan_development_population_density.webp",
    "shitan_development_traffic_volume.webp",
    "shitan_land_01.webp",
    "taian_development_population_density.webp",
    "taian_land_01.webp",
    "toufen_development_population_density.webp",
    "toufen_development_traffic_volume.webp",
    "tongluo_development_population_density.webp",
    "tongluo_development_traffic_volume.webp",
    "tongluo_land_01.webp",
    "tongxiao_development_population_density.webp",
    "tongxiao_development_traffic_volume.webp",
    "tongxiao_land_01.webp",
    "toufen_land_01.webp",
    "touwu_development_population_density.webp",
    "touwu_land_01.webp",
    "xihu_development_population_density.webp",
    "xihu_development_traffic_volume.webp",
    "xihu_land_01.webp",
    "yuanli_development_population_density.webp",
    "yuanli_development_traffic_volume.webp",
    "yuanli_land_01.webp",
    "zaoqiao_development_population_density.webp",
    "zaoqiao_development_traffic_volume.webp",
    "zaoqiao_land_01.webp",
    "zhunan_development_population_density.webp",
    "zhunan_development_traffic_volume.webp",
    "zhunan_land_01.webp",
    "zhuolan_development_population_density.webp",
    "zhuolan_development_traffic_volume.webp",
    "zhuolan_land_01.webp",
  ],
  leopard: [
    "dahu_leopard_01.webp",
    "dahu_leopard_03.webp",
    "gongguan_leopard_01.webp",
    "gongguan_leopard_03.webp",
    "houlong_leopard_01.webp",
    "houlong_leopard_02_1.webp",
    "houlong_leopard_02_2.webp",
    "houlong_leopard_02_3.webp",
    "houlong_leopard_03.webp",
    "miaoli_leopard_01.webp",
    "miaoli_leopard_03.webp",
    "nanzhuang_leopard_01.webp",
    "nanzhuang_leopard_03.webp",
    "sanwan_leopard_01.webp",
    "sanwan_leopard_03.webp",
    "sanyi_leopard_01.webp",
    "sanyi_leopard_02_1.webp",
    "sanyi_leopard_03.webp",
    "shitan_leopard_01.webp",
    "shitan_leopard_02_1.webp",
    "shitan_leopard_03.webp",
    "taian_leopard_03.webp",
    "tongluo_leopard_01.webp",
    "tongluo_leopard_03.webp",
    "tongxiao_leopard_01.webp",
    "tongxiao_leopard_02_1.webp",
    "tongxiao_leopard_02_2.webp",
    "tongxiao_leopard_02_3.webp",
    "tongxiao_leopard_03.webp",
    "toufen_leopard_01.webp",
    "toufen_leopard_03.webp",
    "touwu_leopard_01.webp",
    "touwu_leopard_03.webp",
    "xihu_leopard_01.webp",
    "xihu_leopard_03.webp",
    "yuanli_leopard_01.webp",
    "yuanli_leopard_02_1.webp",
    "yuanli_leopard_03.webp",
    "zaoqiao_leopard_01.webp",
    "zaoqiao_leopard_03.webp",
    "zhunan_leopard_03.webp",
    "zhuolan_leopard_01.webp",
    "zhuolan_leopard_02_1.webp",
    "zhuolan_leopard_03.webp",
  ],
  rumor: [
    "rumor_01.webp","rumor_02.webp","rumor_03.webp","rumor_04.webp","rumor_05.webp","rumor_06.webp","rumor_07.webp","rumor_08.webp","rumor_09.webp","rumor_10.webp","rumor_11.webp","rumor_12.webp","rumor_13.webp","rumor_14.webp","rumor_15.webp","rumor_16.webp","rumor_17.webp","rumor_18.webp","news_01.webp","news_02.webp","news_03.webp","news_04.webp","news_05.webp","news_06.webp","news_07.webp","news_08.webp","news_09.webp","news_10.webp","news_11.webp","news_12.webp","news_13.webp","news_14.webp","news_15.webp",
  ],
  other: [
    "Global_Card_01.webp","Global_Card_02.webp","Global_Card_03.webp","Global_Card_04.webp","Global_Card_05.webp","Global_Card_06.webp","Global_Card_07.webp","Global_Card_08.webp","Global_Card_09.webp","Global_Card_10.webp","Global_Card_11.webp","Global_Card_12.webp","Global_Card_13.webp",
  ],
};

const FILE_PREFIX_TO_REGION: Record<string, string> = {
  miaoli: "苗栗市",
  toufen: "頭份市",
  zhunan: "竹南鎮",
  houlong: "後龍鎮",
  tongxiao: "通霄鎮",
  yuanli: "苑裡鎮",
  zhuolan: "卓蘭鎮",
  dahu: "大湖鄉",
  gongguan: "公館鄉",
  tongluo: "銅鑼鄉",
  nanzhuang: "南庄鄉",
  touwu: "頭屋鄉",
  sanyi: "三義鄉",
  xihu: "西湖鄉",
  zaoqiao: "造橋鄉",
  sanwan: "三灣鄉",
  shitan: "獅潭鄉",
  taian: "泰安鄉",
};

function getCardId(card: MapUnlockedCardData) {
  return String(typeof card === "string" ? card : card.id || card.cardId || "").trim();
}

function getFixedCardMeta(cardId: string) {
  const match = cardId.match(/^([a-z]+)-(\d+)$/i);
  if (!match) return null;

  const category = match[1];
  const index = Number(match[2]) - 1;
  const fileName = FIXED_CARD_IMAGE_FILES_BY_CATEGORY[category]?.[index];
  if (!fileName) return null;

  const prefix = fileName.split("_")[0];
  const regionName = FILE_PREFIX_TO_REGION[prefix] ?? null;
  const isGlobal = category === "rumor" || category === "other" || !regionName;

  return {
    category,
    imageSrc: `/card/${fileName}`,
    regionName,
    isGlobal,
    sourceType: "fixedImage",
  };
}

function getStringFromMeta(meta: Record<string, unknown> | undefined, keys: string[]) {
  if (!meta) return "";
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getInteractiveSnapshotMeta(card: Exclude<MapUnlockedCardData, string>) {
  if (isRecord(card.snapshotMeta)) return card.snapshotMeta;
  if (isRecord(card.snapshot)) return card.snapshot;
  return undefined;
}

function getInteractiveSnapshotImageSrc(card: Exclude<MapUnlockedCardData, string>) {
  const meta = getInteractiveSnapshotMeta(card);
  return mediaUrl(
    getStringFromMeta(meta, [
      "photoSnapshotRelativeUrl",
      "photoSnapshotImageUrl",
      "imageUrl",
      "relativeUrl",
      "imageSrc",
      "image",
    ]),
  );
}

function detectInteractiveCardRegion(card: Exclude<MapUnlockedCardData, string>) {
  const meta = getInteractiveSnapshotMeta(card);
  const filterText = [
    getStringFromMeta(meta, ["town", "townName", "district", "districtName", "region", "regionName", "selectedRegion", "selectedTown", "selection", "filterLabel"]),
    card.title || "",
    card.revealedTitle || "",
  ].join(" ");

  if (filterText.includes("全地區") || filterText.includes("不分區") || filterText.includes("全區")) {
    return { regionName: null, isGlobal: true };
  }

  const regionName = regions.find((region) => filterText.includes(region.name))?.name ?? null;
  return { regionName, isGlobal: !regionName };
}

function getStudentWrittenCardNote(card?: Exclude<MapUnlockedCardData, string>) {
  if (!card) return "";

  return String(
    card.note ||
      card.studentNote ||
      card.reflectionNote ||
      card.content ||
      "",
  ).trim();
}

function normalizeUnlockedCardForMap(card: MapUnlockedCardData): RegionClueCard | null {
  const id = getCardId(card);
  if (!id) return null;

  if (typeof card !== "string" && card.unlocked === false) return null;

  const fixedMeta = getFixedCardMeta(id);
  const objectCard = typeof card === "string" ? undefined : card;
  const interactiveMeta = objectCard && !fixedMeta ? detectInteractiveCardRegion(objectCard) : null;
  const category = String(objectCard?.category || objectCard?.type || fixedMeta?.category || "other");
  const sourceType = String(objectCard?.sourceType || objectCard?.source || fixedMeta?.sourceType || "fixedImage");
  const imageSrc = mediaUrl(
    objectCard?.imageSrc ||
      objectCard?.image ||
      (objectCard ? getInteractiveSnapshotImageSrc(objectCard) : "") ||
      fixedMeta?.imageSrc ||
      "",
  );
  const title =
    objectCard?.revealedTitle ||
    objectCard?.title ||
    `${CATEGORY_LABELS[category] || "數據"}卡 ${id.replace(/^[a-z]+-/i, "")}`;

  return {
    id,
    title,
    category,
    imageSrc,
    content: getStudentWrittenCardNote(objectCard),
    regionName: fixedMeta?.regionName ?? interactiveMeta?.regionName ?? null,
    isGlobal: fixedMeta?.isGlobal ?? interactiveMeta?.isGlobal ?? true,
    sourceType,
  };
}

function getRegionClueGroups(unlockedCards: MapUnlockedCardData[], selectedName: string) {
  const cards = unlockedCards
    .map(normalizeUnlockedCardForMap)
    .filter((card): card is RegionClueCard => Boolean(card));

  const selectedRegionCards = cards.filter(
    (card) => !card.isGlobal && card.regionName === selectedName,
  );
  const globalCards = cards.filter((card) => card.isGlobal);

  return { selectedRegionCards, globalCards };
}

function RegionClueCardView({ card }: { card: RegionClueCard }) {
  const [visibleSide, setVisibleSide] = useState<RegionClueCardSide>("front");
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  const flipCard = useCallback(() => {
    setVisibleSide((side) => (side === "front" ? "back" : "front"));
  }, []);

  const handlePointerEnd = useCallback((clientX: number) => {
    if (dragStartX === null) return;

    if (Math.abs(clientX - dragStartX) >= 38) flipCard();
    setDragStartX(null);
  }, [dragStartX, flipCard]);

  const recordText = card.content?.trim();

  return (
    <button
      type="button"
      className={`clue-card ${visibleSide === "back" ? "is-flipped" : ""}`}
      onClick={flipCard}
      onMouseDown={(event) => setDragStartX(event.clientX)}
      onMouseUp={(event) => handlePointerEnd(event.clientX)}
      onMouseLeave={() => setDragStartX(null)}
      onTouchStart={(event) => setDragStartX(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => handlePointerEnd(event.changedTouches[0]?.clientX ?? 0)}
      aria-label={`${card.title}，點擊或左右滑動翻面`}
    >
      <div className="clue-card-shell">
        <div className="clue-card-face front">
          <div className="clue-card-image-wrap">
            {card.imageSrc ? (
              <img className="clue-card-image" src={card.imageSrc} alt={card.title} loading="lazy" />
            ) : (
              <div className="clue-card-image placeholder" aria-label="沒有圖片的數據卡">無圖片</div>
            )}
          </div>

          <div className="clue-card-title-wrap">
            <h3 className="clue-card-title">{card.title}</h3>
          </div>
        </div>

        <div className="clue-card-face back">
          <div className={`clue-record-content ${recordText ? "" : "clue-empty-record"}`}>
            {recordText || "這張卡還沒有完成蒐集理由。"}
          </div>
        </div>
      </div>
    </button>
  );
}

function RegionClueModal({
  selectedName,
  selectedRegionCards,
  globalCards,
  onClose,
}: {
  selectedName: string;
  selectedRegionCards: RegionClueCard[];
  globalCards: RegionClueCard[];
  onClose: () => void;
}) {
  return (
    <div className="clue-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedName}地區線索`} onClick={onClose}>
      <div className="clue-modal" onClick={(event) => event.stopPropagation()}>
        <div className="clue-modal-header">
          <div>
            <h2 className="clue-modal-title">{selectedName}｜地區線索</h2>
            <p className="clue-modal-subtitle">
              只顯示目前玩家已解鎖的數據卡；不分區域的卡片會在每個地區常駐顯示。
            </p>
          </div>
          <button className="clue-modal-close" type="button" onClick={onClose}>關閉</button>
        </div>
        <div className="clue-modal-body">
          <section className="clue-section">
            <h3 className="clue-section-title">
              <span>1、{selectedName}已解鎖數據卡</span>
              <span className="clue-count-chip">{selectedRegionCards.length} 張</span>
            </h3>
            {selectedRegionCards.length > 0 ? (
              <div className="clue-grid">
                {selectedRegionCards.map((card) => <RegionClueCardView key={card.id} card={card} />)}
              </div>
            ) : (
              <div className="clue-empty">目前尚未解鎖「{selectedName}」專屬的數據卡。</div>
            )}
          </section>

          <section className="clue-section">
            <h3 className="clue-section-title">
              <span>2、不分區域的已解鎖數據卡</span>
              <span className="clue-count-chip">{globalCards.length} 張</span>
            </h3>
            {globalCards.length > 0 ? (
              <div className="clue-grid">
                {globalCards.map((card) => <RegionClueCardView key={card.id} card={card} />)}
              </div>
            ) : (
              <div className="clue-empty">目前尚未解鎖不分區域的數據卡。</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function getModeText(mode: MapMode) {
  if (mode === "group") return "繪製小組地圖";
  if (mode === "class") return "繪製全班地圖";
  return "繪製個人地圖";
}

type MapBoardProps = {
  activeMode: MapMode;
  visibleState: PersonalDecisionMap;
  decisionState: RegionDecisionMap;
  selectedName: string;
  isGroupLeader: boolean;
  isTeacher: boolean;
  isPersonalMapLocked: boolean;
  isGroupReady: boolean;
  isGroupMapLocked: boolean;
  allGroupsLocked: boolean;
  onSelect: (name: string) => void;
};

const MapBoard = memo(function MapBoard({
  activeMode,
  visibleState,
  decisionState,
  selectedName,
  isGroupLeader,
  isTeacher,
  isPersonalMapLocked,
  isGroupReady,
  isGroupMapLocked,
  allGroupsLocked,
  onSelect,
}: MapBoardProps) {
  const regionViewModels = regions.map((region) => {
    const currentState = visibleState[region.name] || "";
    const decision = decisionState[region.name];
    const label = labelPositions[region.name];
    const isActive = selectedName === region.name;
    const isTieArea = Boolean(decision?.isTie && !currentState);
    const canEdit =
      (activeMode === "personal" && !isPersonalMapLocked) ||
      (activeMode === "group" &&
        isGroupReady &&
        !isGroupMapLocked &&
        isGroupLeader &&
        Boolean(decision?.isTie && !decision?.locked)) ||
      (activeMode === "class" &&
        allGroupsLocked &&
        isTeacher &&
        Boolean(decision?.isTie && !decision?.locked));

    return { region, currentState, label, isActive, isTieArea, canEdit };
  });

  return (
    <svg viewBox={MIAOLI_MAP_VIEW_BOX} aria-label="苗栗拼圖按鈕地圖">
      {regionViewModels.map(({ region, currentState, isActive, isTieArea, canEdit }) => (
        <g
          key={region.name}
          className={`piece ${isActive ? "active" : ""} ${!canEdit ? "locked" : ""} ${isTieArea ? "tie" : ""}`}
          data-name={region.name}
          data-state={currentState}
          data-tie={isTieArea ? "true" : "false"}
          onClick={() => onSelect(region.name)}
        >
          <path className="piece-shape" d={region.d} />
        </g>
      ))}
      <g className="label-layer">
        {regionViewModels.map(({ region, label, isActive }) => (
          <text
            key={`${region.name}-label`}
            className={`label ${isActive ? "is-active" : ""}`}
            x={label.x}
            y={label.y}
            fontSize={label.size}
            dominantBaseline="middle"
            textAnchor="middle"
            writingMode={label.vertical ? "vertical-rl" : undefined}
          >
            {region.name}
          </text>
        ))}
      </g>
    </svg>
  );
});

export default function MiaoliMap({
  onBack,
  uiStorageKey,
  mode,
  personalData,
  groupData,
  groupFinalChoices = {},
  classFinalChoices = {},
  initialState,
  onModeChange,
  onDecisionsChange,
  onManualDecisionChange,
  groupMembers = [],
  groupName,
  isGroupLeader = false,
  isTeacher = false,
  isPersonalMapLocked = false,
  personalLockSummary = { lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false },
  isGroupReady = false,
  isGroupMapLocked = false,
  groupLockSummary = { lockedCount: 0, totalCount: 0, unlockedCount: 0, allLocked: false },
  groupLockStatuses = [],
  allGroupsLocked = false,
  unlockedCards = [],
  onLockPersonalMap,
  onLockGroupMap,
  mapFlowMessage = null,
  mapSyncStatus = null,
  isLockPersonalMapPending = false,
  isLockGroupMapPending = false,
}: MiaoliMapProps) {
  const initialUiState = readMiaoliMapUiState(uiStorageKey);
  const hasControlledMode =
    mode === "personal" || mode === "group" || mode === "class";
  const initialMode = hasControlledMode
    ? mode
    : initialUiState.activeMode === "personal" ||
        initialUiState.activeMode === "group" ||
        initialUiState.activeMode === "class"
      ? initialUiState.activeMode
      : "personal";
  const [activeMode, setActiveMode] = useState<MapMode>(initialMode);
  const [selectedName, setSelectedName] = useState(
    typeof initialUiState.selectedName === "string"
      ? initialUiState.selectedName
      : "",
  );
  const [isRegionClueModalOpen, setIsRegionClueModalOpen] = useState(
    Boolean(initialUiState.isRegionClueModalOpen),
  );
  const [personalState, setPersonalState] = useState<PersonalDecisionMap>(() =>
    normalizePersonalState(initialState),
  );
  const [manualDecisionState, setManualDecisionState] =
    useState<RegionDecisionMap>({});
  const [pendingLockTarget, setPendingLockTarget] = useState<PendingLockTarget>(null);
  const personalUnlockPlayedRef = useRef(false);
  const classUnlockPlayedRef = useRef(false);

  const initialStateSignature = useMemo(
    () => createPersonalSignature(initialState),
    [initialState],
  );
  const groupFinalChoicesSignature = useMemo(
    () => createPersonalSignature(groupFinalChoices),
    [groupFinalChoices],
  );
  const classFinalChoicesSignature = useMemo(
    () => createPersonalSignature(classFinalChoices),
    [classFinalChoices],
  );

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  useEffect(() => {
    if (!hasControlledMode || !mode || mode === activeMode) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelectedName("");
      setIsRegionClueModalOpen(false);
      setActiveMode(mode);
    });

    return () => {
      cancelled = true;
    };
  }, [activeMode, hasControlledMode, mode]);

  useEffect(() => {
    saveMiaoliMapUiState(uiStorageKey, {
      activeMode,
      selectedName,
      isRegionClueModalOpen,
    });
  }, [activeMode, isRegionClueModalOpen, selectedName, uiStorageKey]);

  useEffect(() => {
    const nextManualState =
      activeMode === "group"
        ? choicesToManualDecisionState(groupFinalChoices)
        : activeMode === "class"
          ? choicesToManualDecisionState(classFinalChoices)
          : {};

    const timer = window.setTimeout(() => {
      setManualDecisionState((prev) =>
        areDecisionStatesSame(prev, nextManualState) ? prev : nextManualState,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMode, classFinalChoices, classFinalChoicesSignature, groupFinalChoices, groupFinalChoicesSignature]);

  useEffect(() => {
    const nextPersonalState = normalizePersonalState(initialState);

    const timer = window.setTimeout(() => {
      setPersonalState((prev) =>
        arePersonalStatesSame(prev, nextPersonalState) ? prev : nextPersonalState,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialState, initialStateSignature]);

  const decisionState = useMemo<RegionDecisionMap>(() => {
    if (activeMode === "group")
      return buildGroupState(personalData, manualDecisionState);
    if (activeMode === "class")
      return buildClassState(groupData, manualDecisionState);

    return normalizeDecisionState(personalState);
  }, [
    activeMode,
    groupData,
    manualDecisionState,
    personalData,
    personalState,
  ]);

  const visibleState = useMemo<PersonalDecisionMap>(() => {
    if (activeMode === "personal") return personalState;

    return Object.fromEntries(
      Object.entries(decisionState).map(([name, decision]) => [
        name,
        getDecisionResult(decision),
      ]),
    ) as PersonalDecisionMap;
  }, [activeMode, decisionState, personalState]);

  const counts = useMemo(() => {
    const values = Object.values(visibleState).filter(Boolean);
    const locked = Object.values(decisionState).filter(
      (value) => value.locked,
    ).length;
    const tie = Object.values(decisionState).filter(
      (value) => value.isTie,
    ).length;

    return {
      total: regions.length,
      marked: values.length,
      conserve: values.filter((value) => value === "保育").length,
      develop: values.filter((value) => value === "開發").length,
      unknown: values.filter((value) => value === "我不知道").length,
      locked,
      tie,
    };
  }, [decisionState, visibleState]);

  const selectedDecision = selectedName
    ? decisionState[selectedName]
    : undefined;
  const selectedState = selectedName ? visibleState[selectedName] || "" : "";
  const selectedWouldExceedConserveLimit =
    activeMode === "personal" &&
    Boolean(selectedName) &&
    wouldExceedPersonalChoiceLimit(personalState, selectedName, "保育");
  const selectedWouldExceedDevelopLimit =
    activeMode === "personal" &&
    Boolean(selectedName) &&
    wouldExceedPersonalChoiceLimit(personalState, selectedName, "開發");
  const personalLimitMessage =
    activeMode === "personal"
      ? `個人地圖限制：保育最多 ${PERSONAL_MAP_CHOICE_LIMIT} 個、開發最多 ${PERSONAL_MAP_CHOICE_LIMIT} 個；我不知道不限數量。`
      : "";
  const incompletePersonalDistricts = useMemo(
    () => regions.filter((region) => {
      const choice = personalState[region.name];
      return choice !== "保育" && choice !== "開發" && choice !== "我不知道";
    }),
    [personalState],
  );
  const isPersonalMapComplete = incompletePersonalDistricts.length === 0;
  const canEnterGroupMap = isTeacher || isGroupReady || isGroupMapLocked;
  const canEnterClassMap = isTeacher || allGroupsLocked;
  const isTeacherPreviewMode =
    isTeacher &&
    ((activeMode === "group" && !isGroupReady && !isGroupMapLocked) ||
      (activeMode === "class" && !allGroupsLocked));
  const teacherPreviewMessage =
    activeMode === "group"
      ? "教師預覽模式：目前小組地圖尚未等到全員鎖定，畫面僅供教師掌握進度，不代表正式小組結果。"
      : activeMode === "class"
        ? "教師預覽模式：目前全班地圖尚未等到所有組長鎖定，畫面僅供教師掌握進度，不代表正式全班共識。"
        : "";
  const unresolvedTieDistrictNames = useMemo(
    () => regions
      .filter((region) => {
        const decision = decisionState[region.name];
        return Boolean(decision?.isTie && !decision?.finalChoice);
      })
      .map((region) => region.name),
    [decisionState],
  );
  const groupUnresolvedTieCount = activeMode === "group" ? unresolvedTieDistrictNames.length : 0;
  const classUnresolvedTieCount = activeMode === "class" ? unresolvedTieDistrictNames.length : 0;
  const personalLockTotal = personalLockSummary.totalCount || groupMembers.length || 0;
  const personalLockedCount = personalLockSummary.lockedCount || 0;
  const personalLockPercent = personalLockTotal > 0
    ? Math.min(100, Math.round((personalLockedCount / personalLockTotal) * 100))
    : 0;
  const groupLockTotal = groupLockStatuses.length || groupLockSummary.totalCount || 0;
  const groupLockedCount = groupLockStatuses.length > 0
    ? groupLockStatuses.filter((status) => status.isLocked).length
    : groupLockSummary.lockedCount || 0;
  const groupLockPercent = groupLockTotal > 0
    ? Math.min(100, Math.round((groupLockedCount / groupLockTotal) * 100))
    : 0;
  const personalCollectorComplete =
    personalLockTotal > 0 && personalLockedCount >= personalLockTotal && canEnterGroupMap;
  const groupCollectorComplete =
    groupLockTotal > 0 && groupLockedCount >= groupLockTotal && canEnterClassMap;
  const groupLockChecklistItems = [
    { label: "小組全員已鎖定個人地圖", done: Boolean(isGroupReady) },
    { label: "系統已完成小組票數統計", done: Boolean(isGroupReady) },
    { label: groupUnresolvedTieCount > 0 ? `尚有 ${groupUnresolvedTieCount} 個平手地區待決定` : "平手地區已全部處理", done: groupUnresolvedTieCount === 0 },
    { label: isGroupLeader ? "你是組長，可以鎖定小組地圖" : "只有組長可以鎖定小組地圖", done: Boolean(isGroupLeader) },
  ];
  const personalLockSlots = useMemo(() => {
    if (groupMembers.length > 0) {
      return groupMembers.map((member, index) => {
        const displayName = member.name || member.username || `組員${index + 1}`;
        return {
          key: String(member.id ?? `${displayName}-${index}`),
          name: displayName,
          locked: Boolean(member.isPersonalMapLocked),
          isLeader: Boolean(member.isGroupLeader),
          mark: displayName.slice(0, 1),
        };
      });
    }

    return Array.from({ length: personalLockTotal }, (_, index) => ({
      key: `personal-lock-slot-${index}`,
      name: `組員${index + 1}`,
      locked: index < personalLockedCount,
      isLeader: false,
      mark: String(index + 1),
    }));
  }, [groupMembers, personalLockTotal, personalLockedCount]);
  const groupLockSlots = useMemo(() => {
    if (Array.isArray(groupLockStatuses) && groupLockStatuses.length > 0) {
      return groupLockStatuses.map((status, index) => {
        const name =
          status.groupName ||
          GROUP_LOCK_FALLBACK_NAMES[index] ||
          `小組 ${index + 1}`;
        return {
          key: String(status.groupId ?? `group-lock-slot-${index}`),
          name,
          locked: Boolean(status.isLocked),
          mark: name.replace(/^\p{Emoji_Presentation}+/u, "").trim().slice(0, 1) || String(index + 1),
        };
      });
    }

    return Array.from({ length: groupLockTotal }, (_, index) => {
      const name = GROUP_LOCK_FALLBACK_NAMES[index] || `小組 ${index + 1}`;
      return {
        key: `group-lock-slot-${index}`,
        name,
        locked: index < groupLockedCount,
        mark: name.replace(/^\p{Emoji_Presentation}+/u, "").trim().slice(0, 1) || String(index + 1),
      };
    });
  }, [groupLockStatuses, groupLockTotal, groupLockedCount]);
  const lockDialogConfig = pendingLockTarget === "personal"
    ? {
        title: "確認鎖定個人地圖？",
        warning: "你的選擇會被鎖定，不能再修改囉",
        confirmText: "鎖定個人地圖",
        icon: "🔒",
      }
    : pendingLockTarget === "group"
      ? {
          title: "確認鎖定小組地圖？",
          message: "",
          warning: "你的選擇會被鎖定，不能再修改囉",
          confirmText: "鎖定小組地圖",
          icon: "🛡️",
        }
      : null;
  const selectedCanEdit =
    Boolean(selectedName) &&
    ((activeMode === "personal" && !isPersonalMapLocked) ||
      (activeMode === "group" &&
        isGroupReady &&
        !isGroupMapLocked &&
        isGroupLeader &&
        Boolean(
          selectedDecision &&
          !selectedDecision.locked &&
          selectedDecision.isTie,
        )) ||
      (activeMode === "class" &&
        allGroupsLocked &&
        isTeacher &&
        Boolean(
          selectedDecision &&
          !selectedDecision.locked &&
          selectedDecision.isTie,
        )));


  useEffect(() => {
    const fallbackMode =
      activeMode === "group" && !canEnterGroupMap
        ? "personal"
        : activeMode === "class" && !canEnterClassMap
          ? canEnterGroupMap
            ? "group"
            : "personal"
          : null;
    if (!fallbackMode) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelectedName("");
      setIsRegionClueModalOpen(false);
      setActiveMode(fallbackMode);
    });

    return () => {
      cancelled = true;
    };
  }, [activeMode, canEnterClassMap, canEnterGroupMap]);

  useEffect(() => {
    if (!canEnterGroupMap) personalUnlockPlayedRef.current = false;
  }, [canEnterGroupMap]);

  useEffect(() => {
    if (!canEnterClassMap) classUnlockPlayedRef.current = false;
  }, [canEnterClassMap]);

  useEffect(() => {
    if (
      activeMode !== "personal" ||
      !isPersonalMapLocked ||
      !personalCollectorComplete ||
      personalUnlockPlayedRef.current
    ) {
      return;
    }

    personalUnlockPlayedRef.current = true;

    const openTimer = window.setTimeout(() => {
      setSelectedName("");
      setIsRegionClueModalOpen(false);
      setActiveMode("group");
      onModeChange?.("group");
    }, 1400);

    return () => {
      window.clearTimeout(openTimer);
    };
  }, [
    activeMode,
    isPersonalMapLocked,
    onModeChange,
    personalCollectorComplete,
  ]);

  useEffect(() => {
    if (
      activeMode !== "group" ||
      !isGroupMapLocked ||
      !groupCollectorComplete ||
      classUnlockPlayedRef.current
    ) {
      return;
    }

    classUnlockPlayedRef.current = true;

    const openTimer = window.setTimeout(() => {
      setSelectedName("");
      setIsRegionClueModalOpen(false);
      setActiveMode("class");
      onModeChange?.("class");
    }, 1400);

    return () => {
      window.clearTimeout(openTimer);
    };
  }, [
    activeMode,
    groupCollectorComplete,
    isGroupMapLocked,
    onModeChange,
  ]);

  const { selectedRegionCards, globalCards } = useMemo(
    () => getRegionClueGroups(unlockedCards, selectedName),
    [selectedName, unlockedCards],
  );
  const canOpenRegionClues = activeMode === "personal" && Boolean(selectedName);

  function notifyChange(nextPersonalState: PersonalDecisionMap) {
    onDecisionsChange?.({
      mode: activeMode,
      personalState: nextPersonalState,
      decisionState,
    });
  }

  function applyState(name: string, nextState: RegionState) {
    if (!name || !selectedCanEdit) return;

    if (activeMode === "personal") {
      if (isPersonalMapLocked) return;
      if (wouldExceedPersonalChoiceLimit(personalState, name, nextState)) return;

      const copy = { ...personalState };

      if (!nextState) delete copy[name];
      else copy[name] = nextState;

      if (arePersonalStatesSame(personalState, copy)) return;

      setPersonalState(copy);
      notifyChange(copy);
      return;
    }

    if (activeMode === "group" && (!isGroupReady || isGroupMapLocked)) return;
    if (activeMode === "class" && !allGroupsLocked) return;
    if (nextState === "我不知道") return;

    setManualDecisionState((prev) => {
      const copy = { ...prev };
      const base = decisionState[name] || resolveVote([]);

      if (!nextState) {
        delete copy[name];
      } else {
        copy[name] = {
          ...base,
          result: nextState,
          locked: false,
          isTie: true,
          finalChoice: nextState,
        };
      }

      return copy;
    });

    onManualDecisionChange?.({
      mode: activeMode,
      districtName: name,
      choice: nextState,
    });
  }


  function confirmPendingLock() {
    const target = pendingLockTarget;
    setPendingLockTarget(null);

    if (target === "personal") {
      void onLockPersonalMap?.(personalState);
      return;
    }

    if (target === "group") {
      void onLockGroupMap?.();
    }
  }



  function changeMode(nextMode: MapMode) {
    if (nextMode === activeMode) return;
    if (nextMode === "group" && !canEnterGroupMap) return;
    if (nextMode === "class" && !canEnterClassMap) return;

    setSelectedName("");
    setIsRegionClueModalOpen(false);
    setActiveMode(nextMode);
    onModeChange?.(nextMode);
  }

  const handleSelectRegion = useCallback((name: string) => {
    setSelectedName(name);
  }, []);

  return (
    <div className="miaoli-page game-cute-font">
      <div className="wrap">
        <section className="panel map-panel">
          <div className="header">
            <div>
              <div className="title-row">
                <h1>{getModeText(activeMode)}</h1>
                {isTeacherPreviewMode ? <span className="teacher-preview-chip">預覽中</span> : null}
              </div>              
            </div>
            <div className="header-actions">
              {onBack ? (
                <button className="back-btn" type="button" onClick={onBack}>
                  回到首頁
                </button>
              ) : null}
            </div>
          </div>

          <div className="mode-switch" aria-label="地圖模式切換">
            <button
              className={`mode-btn ${activeMode === "personal" ? "active" : ""}`}
              type="button"
              onClick={() => changeMode("personal")}
            >
              個人地圖
            </button>
            <button
              className={`mode-btn ${activeMode === "group" ? "active" : ""}`}
              type="button"
              disabled={!canEnterGroupMap}
              title={!canEnterGroupMap ? "需等待小組全員鎖定個人地圖" : undefined}
              onClick={() => changeMode("group")}
            >
              小組地圖
            </button>
            <button
              className={`mode-btn ${activeMode === "class" ? "active" : ""}`}
              type="button"
              disabled={!canEnterClassMap}
              title={!canEnterClassMap ? "需等待所有組長鎖定小組地圖" : undefined}
              onClick={() => changeMode("class")}
            >
              全班地圖
            </button>
          </div>

          <div className="map-stage-toolbar" aria-label="地圖工具列">
            <div className="map-stage-title">石虎任務地圖</div>
            <div className="map-floating-legend" aria-label="圖例">
              <div className="legend-item">
                <span className="swatch" style={{ background: "#ffffff" }} />
                未標記
              </div>
              <div className="legend-item">
                <span className="swatch" style={{ background: "var(--conserve)" }} />
                保育
              </div>
              <div className="legend-item">
                <span className="swatch" style={{ background: "var(--develop)" }} />
                開發
              </div>
              <div className="legend-item">
                <span className="swatch" style={{ background: "var(--unknown)" }} />
                我不知道
              </div>
              <div className="legend-item">
                <span className="swatch" style={{ background: "#c7b7ff" }} />
                平手
              </div>
            </div>
            <div className="map-toolbar-action">
              {activeMode === "personal" ? (
                <button
                  className="region-clue-btn"
                  type="button"
                  disabled={!selectedName}
                  onClick={() => {
                    if (canOpenRegionClues) setIsRegionClueModalOpen(true);
                  }}
                >
                  閱覽地區線索
                </button>
              ) : (
                <span className="map-toolbar-mode-chip">{getModeText(activeMode)}{isTeacherPreviewMode ? "｜預覽中" : ""}</span>
              )}
            </div>
          </div>

          <div className="stage">
            <MapBoard
              activeMode={activeMode}
              visibleState={visibleState}
              decisionState={decisionState}
              selectedName={selectedName}
              isGroupLeader={isGroupLeader}
              isTeacher={isTeacher}
              isPersonalMapLocked={isPersonalMapLocked}
              isGroupReady={isGroupReady}
              isGroupMapLocked={isGroupMapLocked}
              allGroupsLocked={allGroupsLocked}
              onSelect={handleSelectRegion}
            />
          </div>
        </section>

        <aside className="panel side">
          {mapSyncStatus ? (
            <div className="side-top-status">
              <span className={`map-sync-status is-${mapSyncStatus.state}`} role="status">
                {mapSyncStatus.text}
              </span>
            </div>
          ) : null}

          <section className="card">
            <div className="overview-title-row">
              <h2>整體統計</h2>
              <div className="chips">
                <div className="chip">18 個鄉鎮市</div>
                <div className="chip">{getModeText(activeMode)}</div>
              </div>
            </div>
            <div className="meta is-compact-stats">
              <div className="stat">
                <span>保育區</span>
                <strong>{activeMode === "personal" ? `${counts.conserve}/${PERSONAL_MAP_CHOICE_LIMIT}` : counts.conserve}</strong>
              </div>
              <div className="stat">
                <span>開發區</span>
                <strong>{activeMode === "personal" ? `${counts.develop}/${PERSONAL_MAP_CHOICE_LIMIT}` : counts.develop}</strong>
              </div>
              {activeMode === "personal" ? (
                <>
                  <div className="stat">
                    <span>我不知道</span>
                    <strong>{counts.unknown}</strong>
                  </div>
                  <div className="stat">
                    <span>已標記</span>
                    <strong>{counts.marked}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat">
                    <span>{activeMode === "group" ? "小組共識" : "全班共識"}</span>
                    <strong>{counts.locked}</strong>
                  </div>
                  <div className="stat">
                    <span>平手爭議</span>
                    <strong>{counts.tie}</strong>
                  </div>
                </>
              )}
            </div>
          </section>

          {isTeacherPreviewMode ? (
            <div className="teacher-preview-banner" role="status">
              <span className="teacher-preview-icon">👁️</span>
              <span>{teacherPreviewMessage}</span>
            </div>
          ) : null}

          <section className="card progress-shell-card">
            {activeMode === "personal" ? (
              <div
                className={`sync-collector ${personalCollectorComplete ? "is-complete" : isPersonalMapLocked ? "is-charging" : "is-editing"}`}
                aria-live="polite"
              >
                <div className="sync-header">
                  <div>
                    <p className="sync-kicker">小組成員與鎖定進度</p>
                    <h4 className="sync-title">
                      {personalCollectorComplete
                        ? "全員鎖定完成"
                        : isPersonalMapLocked
                          ? "等待隊友送出鎖定地圖"
                          : "確認後送出你的個人地圖"}
                    </h4>
                    <div className="sync-group-meta">
                      <span>{groupName || "尚未取得小組"}</span>
                      <span>{personalLockedCount} 人已鎖定</span>
                      <span>
                        {personalLockTotal > 0
                          ? `剩 ${Math.max(personalLockTotal - personalLockedCount, 0)} 人`
                          : "等待小組資料"}
                      </span>
                    </div>
                  </div>
                  <div className="sync-orb">{personalLockedCount}/{personalLockTotal || personalLockSlots.length || 0}</div>
                </div>
                <div className="sync-track" aria-label="小組個人地圖鎖定進度">
                  <div
                    className="sync-track-fill"
                    style={{ width: `${personalLockPercent}%` }}
                  />
                </div>
                <div className="sync-slots">
                  {personalLockSlots.length === 0 ? (
                    <div className="sync-slot is-pending is-empty">
                      <span className="sync-slot-mark">?</span>
                      <span className="sync-slot-name">等待小組資料</span>
                    </div>
                  ) : (
                    personalLockSlots.map((slot) => (
                      <div
                        key={slot.key}
                        className={`sync-slot ${slot.locked ? "is-locked" : "is-pending"} ${slot.isLeader ? "is-leader" : ""}`}
                        title={slot.name}
                      >
                        <span className="sync-slot-mark">{slot.locked ? "✓" : slot.mark}</span>
                        <span className="sync-slot-name">
                          {slot.name}{slot.isLeader ? "（組長）" : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {personalCollectorComplete ? (
                  <div className="sync-complete-banner">進度集滿！正在開啟小組地圖…</div>
                ) : isPersonalMapLocked ? (
                  <p className="sync-note">你的個人地圖已鎖定，請等待隊友送出。全員集滿後會自動開啟小組地圖。</p>
                ) : (
                  <div className="sync-action-row">
                    <p className="sync-note">
                      {isPersonalMapComplete
                        ? "18 個鄉鎮市都已完成，鎖定後就會把你的個人地圖送進小組計算。"
                        : `目前完成 ${regions.length - incompletePersonalDistricts.length}/${regions.length}，還有 ${incompletePersonalDistricts.length} 個鄉鎮市尚未選擇。`}
                    </p>
                    <button
                      className="lock-map-btn"
                      type="button"
                      disabled={!onLockPersonalMap || !isPersonalMapComplete || isLockPersonalMapPending}
                      onClick={() => setPendingLockTarget("personal")}
                    >
                      {isLockPersonalMapPending ? "鎖定中…" : "鎖定個人地圖"}
                    </button>
                  </div>
                )}
              </div>
            ) : activeMode === "group" ? (
              isGroupMapLocked ? (
                <div className={`sync-collector ${groupCollectorComplete ? "is-complete" : "is-charging"}`} aria-live="polite">
                  <div className="sync-header">
                    <div>
                      <p className="sync-kicker">班級鎖定進度</p>
                      <h4 className="sync-title">{groupCollectorComplete ? "所有小組鎖定完成" : "等待其他組長鎖定"}</h4>
                    </div>
                    <div className="sync-orb">{groupLockedCount}/{groupLockTotal}</div>
                  </div>
                  <div className="sync-track" aria-label="全班小組地圖鎖定進度">
                    <div
                      className="sync-track-fill"
                      style={{ width: `${groupLockPercent}%` }}
                    />
                  </div>
                  <div className="sync-slots">
                    {groupLockSlots.map((slot) => (
                      <div
                        key={slot.key}
                        className={`sync-slot ${slot.locked ? "is-locked" : "is-pending"}`}
                        title={slot.name}
                      >
                        <span className="sync-slot-mark">{slot.locked ? "✓" : slot.mark}</span>
                        <span className="sync-slot-name">{slot.name}</span>
                      </div>
                    ))}
                  </div>
                  {groupCollectorComplete ? (
                    <div className="sync-complete-banner">進度集滿！正在開啟全班地圖…</div>
                  ) : (
                    <p className="sync-note">你的小組地圖已鎖定，正在等待其他組長送出。所有組別集滿後會自動開啟全班地圖。</p>
                  )}
                </div>
              ) : (
                <div className="flow-status-card">
                  <div className="lock-command-card">
                    <div className="lock-checklist" aria-label="小組地圖鎖定檢查表">
                      <div className="lock-checklist-title">小組地圖鎖定檢查</div>
                      {groupLockChecklistItems.map((item) => (
                        <div key={item.label} className={`lock-check-item ${item.done ? "is-done" : "is-pending"}`}>
                          <span className="lock-check-mark">{item.done ? "✓" : "!"}</span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      className="lock-map-btn"
                      type="button"
                      disabled={
                        !isGroupLeader ||
                        !isGroupReady ||
                        groupUnresolvedTieCount > 0 ||
                        !onLockGroupMap ||
                        isLockGroupMapPending
                      }
                      onClick={() => setPendingLockTarget("group")}
                    >
                      {isLockGroupMapPending ? "鎖定中…" : "鎖定小組地圖"}
                    </button>
                    {groupUnresolvedTieCount > 0 ? (
                      <p className="lock-hint">請先完成紫色平手地區，才能鎖定小組地圖。</p>
                    ) : !isGroupLeader ? (
                      <p className="lock-hint">只有組長可以鎖定小組地圖，組員目前可以閱覽結果。</p>
                    ) : (
                      <p className="lock-hint">所有條件完成後，鎖定會把本組結果送進全班地圖計算。</p>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className={`sync-collector ${groupCollectorComplete ? "is-complete" : "is-charging"}`} aria-live="polite">
                <div className="sync-header">
                  <div>
                    <p className="sync-kicker">全班地圖</p>
                    <h4 className="sync-title">全班地圖開放狀態</h4>
                  </div>
                  <div className="sync-orb">{groupLockedCount}/{groupLockTotal}</div>
                </div>
                <div className="sync-track" aria-label="全班地圖開放進度">
                  <div
                    className="sync-track-fill"
                    style={{ width: `${groupLockPercent}%` }}
                  />
                </div>
                <div className="sync-slots">
                  {groupLockSlots.map((slot) => (
                    <div
                      key={slot.key}
                      className={`sync-slot ${slot.locked ? "is-locked" : "is-pending"}`}
                      title={slot.name}
                    >
                      <span className="sync-slot-mark">{slot.locked ? "✓" : slot.mark}</span>
                      <span className="sync-slot-name">{slot.name}</span>
                    </div>
                  ))}
                </div>
                <p className="sync-note">
                  所有組長都鎖定小組地圖後，才會開放全班地圖；紫色平手地區由教師做最終決定。
                </p>
              </div>
            )}
          </section>

          {mapFlowMessage ? (
            <div className={`map-flow-message is-${mapFlowMessage.type}`} role="status">
              {mapFlowMessage.text}
            </div>
          ) : null}

          <section className="card compact-decision-card">
            <div className="selected-name">
              {selectedName || "請先點選鄉鎮"}
            </div>
            <div className="selected-state">
              {selectedName
                ? `目前狀態：${selectedState || "未標記"}`
                : "目前尚未選取區塊"}
            </div>

            {activeMode === "personal" ? (
              <div className="lock-info">{personalLimitMessage}</div>
            ) : null}

            {activeMode !== "personal" && (
              <div className="decision-detail-area">
                {selectedName && selectedDecision ? (
                  <>
                    <div className="vote-box">
                      <div className="vote-pill">
                        保育票數
                        <strong>{selectedDecision.conserveCount}</strong>
                      </div>
                      <div className="vote-pill">
                        開發票數
                        <strong>{selectedDecision.developCount}</strong>
                      </div>
                    </div>
                    <div className="lock-info">
                      {selectedDecision.locked
                        ? "此區域已有多數決結果，系統已自動鎖定，不能手動調整。"
                        : selectedDecision.isTie
                          ? activeMode === "group"
                            ? isGroupLeader
                              ? "此區域目前平手，請組長代表小組選擇保育或開發。"
                              : "此區域目前平手，只有組長可以代表小組做最後選擇。"
                            : isTeacher
                              ? "此區域目前平手，請教師帳號選擇保育或開發。"
                              : "此區域目前平手，學生只能閱覽，請等待教師帳號做最後選擇。"
                          : "此區域尚未有足夠票數，可等待成員完成選擇。"}
                    </div>
                  </>
                ) : (
                  <div className="decision-empty-hint">
                    請先點選鄉鎮，即可查看小組票數與決策狀態。
                  </div>
                )}
              </div>
            )}

            {activeMode !== "personal" && unresolvedTieDistrictNames.length > 0 ? (
              <div className="tie-worklist">
                <div className="tie-worklist-title">
                  <span>{activeMode === "group" ? "小組平手待決定" : "全班平手待決定"}</span>
                  <strong>{activeMode === "group" ? groupUnresolvedTieCount : classUnresolvedTieCount}</strong>
                </div>
                <div className="tie-worklist-items">
                  {unresolvedTieDistrictNames.map((districtName) => (
                    <button
                      key={districtName}
                      type="button"
                      className={`tie-worklist-chip ${selectedName === districtName ? "is-active" : ""}`}
                      onClick={() => setSelectedName(districtName)}
                    >
                      {districtName}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="actions">
              <button
                className="map-btn btn-conserve"
                type="button"
                disabled={!selectedCanEdit || selectedWouldExceedConserveLimit}
                title={selectedWouldExceedConserveLimit ? "需要保育已達 9 個上限" : undefined}
                onClick={() => applyState(selectedName, "保育")}
              >
                需要保育
              </button>
              <button
                className="map-btn btn-develop"
                type="button"
                disabled={!selectedCanEdit || selectedWouldExceedDevelopLimit}
                title={selectedWouldExceedDevelopLimit ? "需要開發已達 9 個上限" : undefined}
                onClick={() => applyState(selectedName, "開發")}
              >
                需要開發
              </button>
              <button
                className="map-btn btn-unknown"
                type="button"
                disabled={!selectedCanEdit || activeMode !== "personal"}
                onClick={() => applyState(selectedName, "我不知道")}
              >
                我不知道
              </button>
            </div>
          </section>
        </aside>
      </div>

      {lockDialogConfig ? (
        <div
          className="confirm-lock-backdrop"
          role="presentation"
          onClick={() => setPendingLockTarget(null)}
        >
          <div
            className="confirm-lock-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-lock-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-lock-icon" aria-hidden="true">{lockDialogConfig.icon}</div>
            <h2 id="confirm-lock-title" className="confirm-lock-title">
              {lockDialogConfig.title}
            </h2>
            <p className="confirm-lock-message">{lockDialogConfig.message}</p>
            <div className="confirm-lock-warning">{lockDialogConfig.warning}</div>
            <div className="confirm-lock-actions">
              <button
                className="confirm-lock-cancel"
                type="button"
                onClick={() => setPendingLockTarget(null)}
              >
                先不要
              </button>
              <button
                className="confirm-lock-confirm"
                type="button"
                onClick={confirmPendingLock}
              >
                {lockDialogConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isRegionClueModalOpen && selectedName ? (
        <RegionClueModal
          selectedName={selectedName}
          selectedRegionCards={selectedRegionCards}
          globalCards={globalCards}
          onClose={() => setIsRegionClueModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
