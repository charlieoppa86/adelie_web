/**
 * 남극 AI 스터디룸 — Cloud Functions (Realtime Database 트리거)
 *
 * 신고 처리: 신고자가 reports/pending/{세션ID_신고자uid} 를 쓰면
 *   1) 그 시점의 비밀 대화를 서버에서 직접 읽어 스냅샷으로 저장 (신고자가 내용을 조작할 수 없음)
 *   2) moderation/held/{대상} 에 보관 — 관리자도 못 봄
 *   3) 서로 다른 신고자가 2명 이상이면 moderation/flagged/{대상} 으로 올려 관리자에게 보임
 * 대화 정리: 비밀 대화가 끝나면(dm/sessions 삭제) 메시지를 지움. 처리 중인 신고가 있으면 신고 처리 쪽에서 지움.
 * 회원 탈퇴(7일 유예): account.js
 */
import { initializeApp } from "firebase-admin/app";
import { onValueCreated, onValueDeleted } from "firebase-functions/v2/database";

initializeApp();

export { purgeDeletedAccounts, requestAccountDeletion } from "./account.js";

const REPORT_THRESHOLD = 2;
const SNAPSHOT_MAX = 200;
// 트리거 리전 = DB 리전(asia-southeast1). 에뮬레이터는 DB를 us-central1 로 보므로 그때만 맞춰 줌
const REGION = process.env.FUNCTIONS_EMULATOR === "true" ? "us-central1" : "asia-southeast1";
const opts = (ref) => ({ ref, instance: "adelie-8e417-default-rtdb", region: REGION });

/** 이벤트가 난 DB 인스턴스의 루트 — 기본 DB 설정과 무관하게 항상 같은 DB를 씀 */
const rootOf = (event) => event.data.ref.root;
const nameOf = async (db, uid) => (await db.child(`users/${uid}/name`).get()).val() ?? "펭귄";

export const onReport = onValueCreated(opts("/reports/pending/{rid}"), async (event) => {
  const db = rootOf(event);
  const rid = event.params.rid;
  const r = event.data.val();
  const pendingRef = event.data.ref;

  const keyRef = db.child(`moderation/reportKeys/${rid}`);
  if ((await keyRef.get()).exists()) {
    await pendingRef.remove(); // 같은 대화를 같은 사람이 또 신고
    return;
  }

  const [msgs, reporterName, targetName] = await Promise.all([
    db.child(`dm/messages/${r.sid}`).orderByKey().limitToLast(SNAPSHOT_MAX).get(),
    nameOf(db, r.reporter),
    nameOf(db, r.target),
  ]);
  const snapshot = Object.values(msgs.val() ?? {})
    .sort((a, b) => a.at - b.at)
    .map((m) => ({ from: m.from === r.reporter ? reporterName : targetName, text: m.text, at: m.at }));

  const record = { reporter: r.reporter, reporterName, reason: r.reason, detail: r.detail ?? "", at: r.at, snapshot };
  await db.update({
    [`moderation/held/${r.target}/${rid}`]: record,
    [`moderation/reportKeys/${rid}`]: true,
  });

  const held = (await db.child(`moderation/held/${r.target}`).get()).val() ?? {};
  const reporterCount = new Set(Object.values(held).map((x) => x.reporter)).size;
  if (reporterCount >= REPORT_THRESHOLD) {
    await db.child(`moderation/flagged/${r.target}`).set({ targetName, reporterCount, at: Date.now(), reports: held });
  }

  // 순서 중요: 신고 대기 기록을 먼저 지우고, 그다음 대화가 이미 끝났으면 메시지 정리 (onSessionEnded 와 겹쳐도 메시지가 남지 않게)
  await pendingRef.remove();
  if (!(await db.child(`dm/sessions/${r.sid}`).get()).exists()) await db.child(`dm/messages/${r.sid}`).remove();
});

export const onSessionEnded = onValueDeleted(opts("/dm/sessions/{sid}"), async (event) => {
  const db = rootOf(event);
  const sid = event.params.sid;
  const pending = await db.child("reports/pending").orderByKey().startAt(`${sid}_`).endAt(`${sid}_`).get();
  if (pending.exists()) return; // 신고 처리 함수가 스냅샷을 뜬 뒤 지움
  await db.child(`dm/messages/${sid}`).remove();
});
