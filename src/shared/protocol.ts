/**
 * 스터디룸 공통 타입·상수 (화면 · Realtime Database 모듈 · 테스트가 함께 씀)
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
  /** 스터디 LIVE 강의 · 영상을 보는 중 (AI 선글라스 표시) */
  watching?: boolean;
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

export const NICKNAME_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

export function studyMsNow(p: Pick<PlayerState, "studyMs" | "studySince">, now: number): number {
  return p.studyMs + (p.studySince ? Math.max(0, now - p.studySince) : 0);
}

/** 말풍선 본문 정리: 줄바꿈 통일, 빈 줄 3개 이상 → 2개, 앞뒤 공백 제거, 길이 제한 */
export function normalizeChat(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, CHAT_MAX);
}

/** 본문의 @닉네임 중 지금 접속 중인 펭귄만 태그로 인정 (보낸 사람 자신은 제외) */
export function findMentions(
  text: string,
  players: Iterable<{ id: string; name: string }>,
  senderId: string,
): { id: string; name: string }[] {
  const byName = new Map([...players].map((p) => [p.name.toLowerCase(), p]));
  const found = new Map<string, { id: string; name: string }>();
  for (const m of text.matchAll(MENTION_RE)) {
    const target = byName.get(m[1].toLowerCase());
    if (target && target.id !== senderId) found.set(target.id, { id: target.id, name: target.name });
  }
  return [...found.values()];
}
