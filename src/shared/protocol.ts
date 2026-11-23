/**
 * 실시간 서버 ↔ 클라이언트 이벤트 규약 (Socket.IO)
 */

export type Role = "student" | "teacher" | "admin";

export interface PlayerState {
  id: string;
  name: string;
  role: Role;
  x: number;
  y: number;
  /** 바라보는 방향: 1 = 오른쪽, -1 = 왼쪽 */
  dir: 1 | -1;
  moving: boolean;
  seatId: string | null;
  /** 오늘 처음 입장한 시각 (ms) */
  enteredAt: number;
  /** 지금까지 누적된 공부 시간 (ms) — 현재 공부 중인 구간은 studySince로 계산 */
  studyMs: number;
  studySince: number | null;
}

export interface JoinPayload {
  id: string;
  name: string;
  role: Role;
}

export interface MovePayload {
  x: number;
  y: number;
  dir: 1 | -1;
  moving: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  /** 본문에서 @닉네임으로 부른, 현재 접속 중인 펭귄들 */
  mentions: { id: string; name: string }[];
  at: number;
}

export const CHAT_MAX = 200;
/** 말풍선이 머리 위에 떠 있는 시간 */
export const BUBBLE_MS = 6000;
/** 본문에서 @닉네임 토큰 찾기 */
export const MENTION_RE = /@([가-힣a-zA-Z0-9_]{2,12})/g;

/* ---------- 비밀 대화 (1:1, 신청 → 수락) ---------- */
export const DM_MAX = 500;
export const DM_REQUEST_MS = 30_000;

export interface PeerInfo {
  id: string;
  name: string;
  role: Role;
}

export interface DmMessage {
  id: string;
  sessionId: string;
  from: string;
  text: string;
  at: number;
}

export type DmCloseReason = "declined" | "timeout" | "busy" | "cancelled" | "offline";

/* ---------- 신고 · 관리자 ---------- */
export const REPORT_THRESHOLD = 2;
export const KICK_BAN_MS = 24 * 60 * 60 * 1000;

export type ReportReason = "abuse" | "harass" | "sexual" | "spam" | "other";
export const REPORT_REASONS: Record<ReportReason, string> = {
  abuse: "욕설 · 비하",
  harass: "괴롭힘 · 집착",
  sexual: "성적인 내용",
  spam: "도배 · 광고",
  other: "기타",
};

export interface ReportView {
  id: string;
  at: number;
  reporterName: string;
  reason: ReportReason;
  detail: string;
  /** 신고 시점까지의 비밀 대화 내용 (신고된 대화만) */
  snapshot: { from: string; text: string; at: number }[];
}

/** 관리자에게 보이는 "확인 필요" 펭귄 — 서로 다른 신고자가 REPORT_THRESHOLD명 이상일 때만 */
export interface ModerationFlag {
  targetKey: string;
  targetName: string;
  online: boolean;
  reporterCount: number;
  reports: ReportView[];
}

export interface ServerToClientEvents {
  init: (data: { selfId: string; players: PlayerState[]; serverNow: number }) => void;
  "join:error": (data: { message: string }) => void;
  "player:joined": (p: PlayerState) => void;
  "player:left": (data: { id: string }) => void;
  "player:moved": (data: { id: string } & MovePayload) => void;
  "player:updated": (p: PlayerState) => void;
  "player:emote": (data: { id: string; emote: "jump" }) => void;
  notice: (data: { message: string }) => void;
  chat: (m: ChatMessage) => void;
  /** 내가 보낸 신청이 접수됨 */
  "dm:requested": (data: { requestId: string; to: PeerInfo; expiresAt: number }) => void;
  /** 나에게 온 신청 */
  "dm:incoming": (data: { requestId: string; from: PeerInfo; expiresAt: number }) => void;
  /** 신청이 끝남 (거절·만료·취소·상대 퇴장). 양쪽 모두 받음 */
  "dm:closed": (data: { requestId: string; reason: DmCloseReason; peerName: string }) => void;
  "dm:started": (data: { sessionId: string; peer: PeerInfo; startedAt: number }) => void;
  "dm:message": (m: DmMessage) => void;
  "dm:ended": (data: { sessionId: string; byName: string; reason: "left" | "disconnected" }) => void;
  /** 지금 비밀 대화 중인 펭귄 쌍 — 누구나 받지만 내용은 없음 (🔒 표시용) */
  "dm:locks": (data: { pairs: [string, string][] }) => void;
  "report:ack": (data: { ok: boolean; message: string }) => void;
  /** 관리자 전용: 확인이 필요한 신고 목록 */
  "admin:flags": (data: { flags: ModerationFlag[] }) => void;
  /** 관리자 전용: 새로 기준을 넘은 신고 */
  "admin:alert": (data: { targetName: string; reporterCount: number }) => void;
  /** 관리자 조치로 퇴장됨 */
  kicked: (data: { message: string; until: number }) => void;
}

export interface ClientToServerEvents {
  join: (p: JoinPayload) => void;
  move: (p: MovePayload) => void;
  sit: (data: { seatId: string }) => void;
  stand: () => void;
  emote: (data: { emote: "jump" }) => void;
  chat: (data: { text: string }) => void;
  "dm:request": (data: { to: string }) => void;
  "dm:cancel": (data: { requestId: string }) => void;
  "dm:respond": (data: { requestId: string; accept: boolean }) => void;
  "dm:send": (data: { sessionId: string; text: string }) => void;
  "dm:leave": (data: { sessionId: string }) => void;
  report: (data: { sessionId: string; reason: ReportReason; detail: string; endChat: boolean }) => void;
  "admin:kick": (data: { targetKey: string }) => void;
  "admin:dismiss": (data: { targetKey: string }) => void;
}

export const NICKNAME_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

export function studyMsNow(p: Pick<PlayerState, "studyMs" | "studySince">, now: number): number {
  return p.studyMs + (p.studySince ? Math.max(0, now - p.studySince) : 0);
}
