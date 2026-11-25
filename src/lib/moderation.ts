/**
 * 신고 확인 · 관리자 조치 — Realtime Database
 *
 *   moderation/flagged/{대상 uid}  서로 다른 신고자 2명 이상인 신고만 (Cloud Function 이 씀, 관리자만 읽음)
 *   bans/{uid}                    {until, by}  퇴장 — 기간 동안 스터디룸에 다시 못 들어옴(규칙)
 *   users/{uid}/role              관리자가 선생·학생 역할 부여
 *
 * 관리자 지정: 콘솔에서 users/{uid}/role 을 "admin" 으로 직접 바꿉니다.
 */
import { onValue, ref, set, update, type Database } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { KICK_BAN_MS, type ReportReason, type ReportView } from "@/shared/protocol";

export interface FlaggedTarget {
  targetId: string;
  targetName: string;
  reporterCount: number;
  reports: ReportView[];
}

interface FlagRaw {
  targetName: string;
  reporterCount: number;
  reports?: Record<
    string,
    { reporterName: string; reason: ReportReason; detail: string; at: number; snapshot?: { from: string; text: string; at: number }[] }
  >;
}

/** 관리자: 확인이 필요한 신고 목록 구독. 새로 기준을 넘거나 신고자가 늘면 alert */
export function watchFlags(
  on: { flags: (list: FlaggedTarget[]) => void; alert: (targetName: string, reporterCount: number) => void },
  db: Database = rtdb(),
): () => void {
  let prev: Map<string, number> | null = null;
  return onValue(
    ref(db, "moderation/flagged"),
    (snap) => {
      const raw = (snap.val() ?? {}) as Record<string, FlagRaw>;
      const list = Object.entries(raw)
        .map(([targetId, f]) => ({
          targetId,
          targetName: f.targetName,
          reporterCount: f.reporterCount,
          reports: Object.entries(f.reports ?? {})
            .map(([id, r]) => ({ id, at: r.at, reporterName: r.reporterName, reason: r.reason, detail: r.detail, snapshot: r.snapshot ?? [] }))
            .sort((a, b) => b.at - a.at),
        }))
        .sort((a, b) => b.reporterCount - a.reporterCount);
      if (prev) for (const f of list) if ((prev.get(f.targetId) ?? 0) < f.reporterCount) on.alert(f.targetName, f.reporterCount);
      prev = new Map(list.map((f) => [f.targetId, f.reporterCount]));
      on.flags(list);
    },
    () => on.flags([]), // 관리자가 아니면 읽기 거부 — 빈 목록
  );
}

/** 관리자: 퇴장 (24시간 재입장 불가) — 스터디룸에서 바로 빼고 신고 기록도 정리 */
export async function kick(adminUid: string, targetId: string, seatId: string | null, now: number, db: Database = rtdb()) {
  const until = now + KICK_BAN_MS;
  await update(ref(db), {
    [`bans/${targetId}`]: { until, by: adminUid },
    [`moderation/flagged/${targetId}`]: null,
    [`moderation/held/${targetId}`]: null,
    [`rooms/main/players/${targetId}`]: null,
    [`rooms/main/pos/${targetId}`]: null,
    [`rooms/main/bubbles/${targetId}`]: null,
    [`rooms/main/emotes/${targetId}`]: null,
    ...(seatId ? { [`rooms/main/seats/${seatId}`]: null } : {}),
  });
  return until;
}

/** 관리자: 문제없음 처리 — 신고 수를 처음부터 다시 셈 */
export function dismiss(targetId: string, db: Database = rtdb()) {
  return update(ref(db), { [`moderation/flagged/${targetId}`]: null, [`moderation/held/${targetId}`]: null });
}

/** 관리자: 선생·학생 역할 부여 */
export function setRole(targetId: string, role: "student" | "teacher", db: Database = rtdb()) {
  return set(ref(db, `users/${targetId}/role`), role);
}

/** 내가 퇴장당했는지 구독 (until 이 지금보다 뒤면 퇴장 중) */
export function watchBan(uid: string, cb: (until: number | null) => void, db: Database = rtdb()): () => void {
  return onValue(
    ref(db, `bans/${uid}/until`),
    (snap) => cb(typeof snap.val() === "number" ? (snap.val() as number) : null),
    () => cb(null),
  );
}
