/**
 * 신고 · 퇴장 기록 (로컬 개발용 파일 저장: .data/moderation.json)
 * 정책:
 *   - 비밀 대화 참여자가 상대를 신고하면, 그 시점까지의 대화 내용을 스냅샷으로 저장
 *   - 같은 펭귄이 "서로 다른 신고자" REPORT_THRESHOLD명 이상에게 신고되면 관리자에게 알림 · 열람 가능
 *   - 관리자가 퇴장시키면 KICK_BAN_MS 동안 재입장 불가
 * TODO(로그인 단계): 닉네임 대신 사용자 ID로 기록하고 DB로 옮기기
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { KICK_BAN_MS, REPORT_THRESHOLD, type ModerationFlag, type ReportReason, type ReportView } from "../src/shared/protocol";

interface StoredReport extends ReportView {
  reporterKey: string;
  targetKey: string;
  targetName: string;
  sessionId: string;
  status: "open" | "dismissed" | "kicked";
}

interface Store {
  reports: StoredReport[];
  /** 닉네임(소문자) → 재입장 가능 시각 */
  bans: Record<string, number>;
}

const FILE = join(process.cwd(), ".data", "moderation.json");

function load(): Store {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as Store;
    return { reports: Array.isArray(s.reports) ? s.reports : [], bans: s.bans ?? {} };
  } catch {
    return { reports: [], bans: {} };
  }
}

const store = load();

function save() {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

export const keyOf = (name: string) => name.toLowerCase();

/** 관리자 닉네임 목록 (환경변수 ADMIN_NAMES, 쉼표 구분). 로그인 전 임시 방식 */
export const ADMIN_NAMES = new Set(
  (process.env.ADMIN_NAMES ?? "운영자")
    .split(",")
    .map((n) => keyOf(n.trim()))
    .filter(Boolean),
);

export function banUntil(name: string): number | null {
  const until = store.bans[keyOf(name)];
  if (!until) return null;
  if (until <= Date.now()) {
    delete store.bans[keyOf(name)];
    save();
    return null;
  }
  return until;
}

/** 같은 대화에서 같은 사람이 이미 신고했는지 */
export function alreadyReported(sessionId: string, reporterName: string) {
  return store.reports.some((r) => r.sessionId === sessionId && r.reporterKey === keyOf(reporterName));
}

const openReportsOf = (targetKey: string) => store.reports.filter((r) => r.targetKey === targetKey && r.status === "open");
const reporterCount = (reports: StoredReport[]) => new Set(reports.map((r) => r.reporterKey)).size;

/** 신고 저장. 이번 신고로 처음 기준을 넘었으면 crossed = true */
export function addReport(input: {
  reporterName: string;
  targetName: string;
  sessionId: string;
  reason: ReportReason;
  detail: string;
  snapshot: ReportView["snapshot"];
}): { crossed: boolean; reporterCount: number } {
  const targetKey = keyOf(input.targetName);
  const before = reporterCount(openReportsOf(targetKey));
  store.reports.push({
    id: randomUUID(),
    at: Date.now(),
    reporterName: input.reporterName,
    reporterKey: keyOf(input.reporterName),
    targetKey,
    targetName: input.targetName,
    sessionId: input.sessionId,
    reason: input.reason,
    detail: input.detail,
    snapshot: input.snapshot,
    status: "open",
  });
  save();
  const after = reporterCount(openReportsOf(targetKey));
  return { crossed: before < REPORT_THRESHOLD && after >= REPORT_THRESHOLD, reporterCount: after };
}

/** 관리자 화면용: 기준을 넘은 펭귄과 그 신고들만 */
export function flags(isOnline: (key: string) => boolean): ModerationFlag[] {
  const byTarget = new Map<string, StoredReport[]>();
  for (const r of store.reports) if (r.status === "open") byTarget.set(r.targetKey, [...(byTarget.get(r.targetKey) ?? []), r]);
  return [...byTarget.entries()]
    .filter(([, rs]) => reporterCount(rs) >= REPORT_THRESHOLD)
    .map(([key, rs]) => ({
      targetKey: key,
      targetName: rs[rs.length - 1].targetName,
      online: isOnline(key),
      reporterCount: reporterCount(rs),
      reports: rs.map(({ id, at, reporterName, reason, detail, snapshot }) => ({ id, at, reporterName, reason, detail, snapshot })),
    }))
    .sort((a, b) => b.reporterCount - a.reporterCount);
}

function resolve(targetKey: string, status: "dismissed" | "kicked") {
  let n = 0;
  for (const r of store.reports)
    if (r.targetKey === targetKey && r.status === "open") {
      r.status = status;
      n++;
    }
  return n;
}

export function kick(targetKey: string): number {
  resolve(targetKey, "kicked");
  const until = Date.now() + KICK_BAN_MS;
  store.bans[targetKey] = until;
  save();
  return until;
}

export function dismiss(targetKey: string) {
  resolve(targetKey, "dismissed");
  save();
}
