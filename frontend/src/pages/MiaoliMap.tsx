import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { mediaUrl } from "@/api/apiClient";
import { MIAOLI_MAP_VIEW_BOX, labelPositions, regions } from "../data/miaoliMapView";

type RegionState = "保育" | "開發" | "我不知道" | "";
type FinalChoice = "保育" | "開發" | "我不知道";
type MapMode = "personal" | "group" | "class";

const PERSONAL_MAP_CHOICE_LIMIT = 9;

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
};

const styles = `
:root {
  --app-bg:#f7efe2;
  --paper:#fffaf0;
  --paper-strong:#fffaf0;
  --panel:rgba(255, 250, 240, .94);
  --text:#292524;
  --muted:#756957;
  --line:#c7b28f;
  --grid:rgba(120,92,58,.07);
  --white:#ffffff;
  --idle:#fff8e8;
  --idle-stroke:#b99d72;
  --map-border:#b69f7b;
  --map-border-strong:#8d7758;
  --hover:#c8d8b8;
  --conserve:#c9e7b8;
  --conserve-dark:#6b9561;
  --develop:#efc0ad;
  --develop-dark:#9c6f63;
  --shadow:0 8px 0 rgba(116,94,68,.10), 0 22px 46px rgba(46,33,24,.12);
  --piece-shadow:0 6px 0 rgba(116,94,68,.10);
  --unknown:#d5d8de;
  --unknown-dark:#7c8794;
  --tie:#c5b6ff;
  --tie-dark:#7565c8;
  --active-gold:#f4d88b;
}
* { box-sizing:border-box; }
.miaoli-page {
  margin:0;
  min-height:100vh;
  font-family:inherit;
  color:var(--text);
  background:
    radial-gradient(circle at 14% 14%, rgba(255,255,255,.78), transparent 16rem),
    radial-gradient(circle at 88% 12%, rgba(239,214,138,.30), transparent 17rem),
    radial-gradient(circle at 52% 105%, rgba(156,175,134,.30), transparent 30rem),
    linear-gradient(145deg, #fff3cf 0%, #ead7a7 44%, #b5c99a 100%);
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
    radial-gradient(circle at 60px 60px, rgba(214,211,209,.22), transparent 260px),
    radial-gradient(circle at 100% 100%, rgba(182,193,173,.16), transparent 360px);
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
.back-btn:hover {
  transform:translateY(-1px);
  background:#fffaf0;
  box-shadow:0 14px 30px rgba(45,41,34,.16);
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
  border:2px solid rgba(182,159,123,.72);
  border-radius:34px;
  box-shadow:var(--shadow);
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
  border-bottom:1px solid #c5bba3;
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
  border:1px solid #d7c8ad;
  border-radius:22px;
  background:rgba(255,250,240,.72);
}
.mode-btn {
  appearance:none;
  border:1px solid #c8b48f;
  border-radius:16px;
  background:#fffdf6;
  color:#6d5e49;
  padding:12px 10px;
  font-size:14px;
  font-weight:900;
  letter-spacing:.04em;
  cursor:pointer;
  box-shadow:0 8px 18px rgba(45,41,34,.06);
  transition:transform .16s ease, box-shadow .16s ease, background .16s ease;
}
.mode-btn:hover {
  transform:translateY(-1px);
  box-shadow:0 12px 22px rgba(45,41,34,.1);
}
.mode-btn.active {
  background:#4f4333;
  border-color:#4f4333;
  color:#fffaf0;
}
.stage {
  position:relative;
  z-index:1;
  border:3px solid rgba(182,159,123,.70);
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
.piece:hover {
  transform:translate3d(0,-2px,0) scale(1.006);
}
.piece.locked {
  cursor:not-allowed;
}
.piece.locked:hover {
  transform:none;
  filter:none;
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
  background:rgba(255,250,240,.88);
  border:1px solid #d7c8ad;
  border-radius:24px;
  padding:18px;
  box-shadow:0 10px 24px rgba(45,41,34,.07);
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
  border:1px solid #c8b48f;
  background:#fffdf6;
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
  margin:4px 0 2px;
  font-weight:700;
  color:#2f2a24;
}
.selected-state {
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
.map-btn:hover {
  transform:translateY(-1px);
  box-shadow:0 12px 22px rgba(45,41,34,.12);
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

.btn-unknown:hover:not(:disabled) {
  background:rgba(154,160,166,.28);
  transform: translateY(-1px);
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
.region-clue-btn:hover:not(:disabled) {
  transform:translateY(-1px);
  box-shadow:0 8px 0 rgba(74,46,27,.14), 0 18px 28px rgba(45,41,34,.16);
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
@media (hover: hover) {
  .map-btn:hover, .mode-btn:hover, .back-btn:hover {
    transform:translate3d(0,-1px,0);
  }
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
  onSelect: (name: string) => void;
};

const MapBoard = memo(function MapBoard({
  activeMode,
  visibleState,
  decisionState,
  selectedName,
  isGroupLeader,
  isTeacher,
  onSelect,
}: MapBoardProps) {
  const regionViewModels = regions.map((region) => {
    const currentState = visibleState[region.name] || "";
    const decision = decisionState[region.name];
    const label = labelPositions[region.name];
    const isActive = selectedName === region.name;
    const isTieArea = Boolean(decision?.isTie && !currentState);
    const canEdit =
      activeMode === "personal" ||
      (activeMode === "group" &&
        isGroupLeader &&
        Boolean(decision?.isTie && !decision?.locked)) ||
      (activeMode === "class" &&
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
  mode = "personal",
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
  unlockedCards = [],
}: MiaoliMapProps) {
  const [activeMode, setActiveMode] = useState<MapMode>(mode);
  const [selectedName, setSelectedName] = useState("");
  const [isRegionClueModalOpen, setIsRegionClueModalOpen] = useState(false);
  const [personalState, setPersonalState] = useState<PersonalDecisionMap>(() =>
    normalizePersonalState(initialState),
  );
  const [manualDecisionState, setManualDecisionState] =
    useState<RegionDecisionMap>({});

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
    const timer = window.setTimeout(() => setActiveMode(mode), 0);
    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedName("");
      setIsRegionClueModalOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMode]);

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
      ? `個人地圖限制：保育最多 ${PERSONAL_MAP_CHOICE_LIMIT} 個、開發最多 ${PERSONAL_MAP_CHOICE_LIMIT} 個，可少但不能超過。`
      : "";
  const selectedCanEdit =
    Boolean(selectedName) &&
    (activeMode === "personal" ||
      (activeMode === "group" &&
        isGroupLeader &&
        Boolean(
          selectedDecision &&
          !selectedDecision.locked &&
          selectedDecision.isTie,
        )) ||
      (activeMode === "class" &&
        isTeacher &&
        Boolean(
          selectedDecision &&
          !selectedDecision.locked &&
          selectedDecision.isTie,
        )));

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
      if (wouldExceedPersonalChoiceLimit(personalState, name, nextState)) return;

      const copy = { ...personalState };

      if (!nextState) delete copy[name];
      else copy[name] = nextState;

      if (arePersonalStatesSame(personalState, copy)) return;

      setPersonalState(copy);
      notifyChange(copy);
      return;
    }

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



  function changeMode(nextMode: MapMode) {
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
              </div>
              <p className="sub">
                {activeMode === "personal" &&
                  "點擊任區塊後，將該地區標記為保育、開發或我不知道；保育與開發各最多 9 個。"}
                {activeMode === "group" &&
                  "系統會根據同組學生個人選擇進行統計，多數決自動鎖定，平手地區開放小組討論後決定。"}
                {activeMode === "class" &&
                  (isTeacher
                    ? "系統會根據六組小組結果進行統計，多數決自動鎖定，平手地區由教師帳號決定。"
                    : "系統會根據六組小組結果進行統計；學生只能閱覽全班地圖，不能進行選擇。")}
              </p>
            </div>
            {onBack && (
              <div className="header-actions">
                <button className="back-btn" type="button" onClick={onBack}>
                  回到首頁
                </button>
              </div>
            )}
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
              onClick={() => changeMode("group")}
            >
              小組地圖
            </button>
            <button
              className={`mode-btn ${activeMode === "class" ? "active" : ""}`}
              type="button"
              onClick={() => changeMode("class")}
            >
              全班地圖
            </button>
          </div>

          <div className="stage">
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
            ) : null}
            <MapBoard
              activeMode={activeMode}
              visibleState={visibleState}
              decisionState={decisionState}
              selectedName={selectedName}
              isGroupLeader={isGroupLeader}
              isTeacher={isTeacher}
              onSelect={handleSelectRegion}
            />
          </div>
        </section>

        <aside className="panel side">
          <section className="card">
            <div className="overview-title-row">
              <h2>整體統計</h2>
              <div className="chips">
                <div className="chip">18 個鄉鎮市</div>
                <div className="chip">{getModeText(activeMode)}</div>
              </div>
            </div>
            <div className="meta">
              <div className="stat">
                <span>保育區</span>
                <strong>{counts.conserve}</strong>
              </div>
              <div className="stat">
                <span>開發區</span>
                <strong>{counts.develop}</strong>
              </div>
            </div>
          </section>

          {activeMode !== "personal" && (
            <section className="card">
              <h3>決策狀態</h3>
              <div className="meta">
                <div className="stat">
                  <span>小組共識區</span>
                  <strong>{counts.locked}</strong>
                </div>
                <div className="stat">
                  <span>爭議地區</span>
                  <strong>{counts.tie}</strong>
                </div>
              </div>
              <p className="note">
                多數決地區不可修改；平手地區可由小組或全班討論後手動選擇。
              </p>
            </section>
          )}

          <section className="card compact-card">
            <div className="card-title-row">
              <h3>目前組員</h3>
              <span className="group-name">{groupName || "尚未取得小組"}</span>
            </div>

            <div className="member-avatar-list">
              {groupMembers.length === 0 ? (
                <div className="empty-members">尚未分配小組</div>
              ) : (
                groupMembers.map((member, index) => {
                  const displayName =
                    member.name || member.username || `組員${index + 1}`;

                  return (
                    <div
                      key={member.id ?? `${displayName}-${index}`}
                      className={`member-avatar ${member.isGroupLeader ? "leader" : ""}`}
                      title={displayName}
                    >
                      <span className="avatar-circle">
                        {displayName.slice(0, 1)}
                      </span>
                      <span className="avatar-name">{displayName}</span>
                      {member.isGroupLeader ? (
                        <span className="leader-crown">👑</span>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="card">
            <h3>圖例與區塊設定</h3>
            <div className="legend legend-inline">
              <div className="legend-item">
                <span className="swatch" style={{ background: "#ffffff" }} />
                未標記
              </div>
              <div className="legend-item">
                <span
                  className="swatch"
                  style={{ background: "var(--conserve)" }}
                />
                保育
              </div>
              <div className="legend-item">
                <span
                  className="swatch"
                  style={{ background: "var(--develop)" }}
                />
                開發
              </div>
              
              <div className="legend-item">
                <span
                  className="swatch"
                  style={{ background: "var(--unknown)" }}
                />
                我不知道
              </div>
              <div className="legend-item">
                <span className="swatch" style={{ background: "#c7b7ff" }} />
                {activeMode === "class" ? "平手待教師決定" : "平手待組長決定"}
              </div>
            </div>

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

            {activeMode !== "personal" && selectedName && selectedDecision && (
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
            )}

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
