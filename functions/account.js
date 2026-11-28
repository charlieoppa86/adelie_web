/**
 * 회원 탈퇴 — 7일 유예
 *
 * 1) requestAccountDeletion (호출형): 방금 구글로 다시 로그인한 본인만 신청 가능 → users/{uid}/deleteAt = 지금 + 7일
 *    - 유예 중에는 규칙이 스터디룸 입장 · 닉네임 변경 · 비밀 대화 신청 받기를 막음
 *    - 다시 로그인해 "탈퇴 취소"를 누르면 deleteAt 을 지워 복구 (규칙상 본인만 지울 수 있고, 쓰기는 서버만)
 *    - 관리자 · 정지 중인 펭귄은 신청 불가
 * 2) purgeDeletedAccounts (매시간): deleteAt 이 지난 계정의 데이터와 로그인 계정을 지움
 *    - 지우는 것: 프로필, 출석 기록, 스터디룸 흔적, 비밀 대화 신청·진행, 정지 기록, 로그인 계정
 *    - 남기는 것: 닉네임 예약(옛 닉네임 포함 — 다른 펭귄이 같은 이름으로 사칭하지 못하게),
 *      신고 검토 기록(moderation — 운영 기록)
 */
import { getAuth } from "firebase-admin/auth";
import { getDatabaseWithUrl } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

export const DELETE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** 탈퇴 신청은 구글로 다시 로그인한 지 이 시간 안에만 */
const RECENT_LOGIN_S = 5 * 60;
const REGION = "asia-southeast1";
const DB_URL = "https://adelie-8e417-default-rtdb.asia-southeast1.firebasedatabase.app";
const ROOM = "rooms/main";

const db = () => getDatabaseWithUrl(DB_URL).ref();
const seoulDay = (ms) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

export const requestAccountDeletion = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요해요.");
  const authTime = Number(req.auth.token.auth_time) || 0;
  if (Date.now() / 1000 - authTime > RECENT_LOGIN_S)
    throw new HttpsError("failed-precondition", "구글 계정을 다시 확인해 주세요.", { reason: "recent-login" });

  const root = db();
  const [user, ban] = await Promise.all([root.child(`users/${uid}`).get(), root.child(`bans/${uid}/until`).get()]);
  if (!user.exists()) throw new HttpsError("failed-precondition", "가입 정보가 없어요.", { reason: "no-profile" });
  const u = user.val();
  if (u.deleteAt) return { deleteAt: u.deleteAt };
  if (u.role === "admin")
    throw new HttpsError("failed-precondition", "관리자는 역할을 바꾼 뒤 탈퇴할 수 있어요.", { reason: "admin" });
  if (Number(ban.val()) > Date.now())
    throw new HttpsError("failed-precondition", "퇴장 기간이 끝난 뒤 탈퇴할 수 있어요.", { reason: "banned" });

  const deleteAt = Date.now() + DELETE_GRACE_MS;
  await root.child(`users/${uid}/deleteAt`).set(deleteAt);
  return { deleteAt };
});

/** 한 계정의 데이터 + 로그인 계정 삭제 (테스트에서도 씀) */
export async function purgeAccount(root, auth, uid) {
  const [user, seats, active, requests] = await Promise.all([
    root.child(`users/${uid}`).get(),
    root.child(`${ROOM}/seats`).get(),
    root.child(`dm/active/${uid}`).get(),
    root.child("dm/requests").get(),
  ]);
  const paths = {
    [`users/${uid}`]: null,
    [`bans/${uid}`]: null,
    [`dm/requests/${uid}`]: null,
    [`dm/active/${uid}`]: null,
  };
  for (const k of ["players", "pos", "emotes", "bubbles"]) paths[`${ROOM}/${k}/${uid}`] = null;
  for (const [seat, who] of Object.entries(seats.val() ?? {})) if (who === uid) paths[`${ROOM}/seats/${seat}`] = null;
  for (const [to, froms] of Object.entries(requests.val() ?? {})) if (to !== uid && froms?.[uid]) paths[`dm/requests/${to}/${uid}`] = null;

  // 출석 기록: attendance/{날짜}/{uid} — 가입일부터 오늘까지 날짜별로 (읽지 않고 지움)
  const from = Number(user.val()?.createdAt) || Date.now();
  for (let t = from - 86_400_000; t <= Date.now() + 86_400_000; t += 86_400_000) paths[`attendance/${seoulDay(t)}/${uid}`] = null;

  await root.update(paths);
  // 진행 중이던 비밀 대화 — 세션을 지우면 onSessionEnded 가 메시지를 정리
  const sid = active.val();
  if (sid) {
    const s = (await root.child(`dm/sessions/${sid}`).get()).val();
    const peer = s && (s.a === uid ? s.b : s.a);
    await root.child(`dm/sessions/${sid}`).remove();
    if (peer && (await root.child(`dm/active/${peer}`).get()).val() === sid) await root.child(`dm/active/${peer}`).remove();
  }
  await auth.deleteUser(uid).catch((e) => {
    if (e?.code !== "auth/user-not-found") throw e;
  });
}

export const purgeDeletedAccounts = onSchedule(
  { schedule: "every 1 hours", region: REGION, timeZone: "Asia/Seoul" },
  () => purgeDue(db(), getAuth(), Date.now()),
);

/** 유예가 끝난 계정 모두 정리 — 하나가 실패해도 나머지는 계속 (다음 시간에 다시 시도) */
export async function purgeDue(root, auth, now) {
  const due = await root.child("users").orderByChild("deleteAt").startAt(1).endAt(now).get();
  const done = [];
  for (const uid of Object.keys(due.val() ?? {})) {
    try {
      await purgeAccount(root, auth, uid);
      done.push(uid);
      console.log("[purge] 탈퇴 완료", uid);
    } catch (e) {
      console.error("[purge] 실패 — 다음 시간에 다시 시도", uid, e);
    }
  }
  return done;
}

/**
 * 내 역할 사본 다시 맞추기 (📚 자료실이 사본이 없거나 틀렸을 때 부름)
 * syncRole 배포 전에 지정된 강사 · 관리자, 콘솔에서 손으로 만든 사본이 틀린 경우를 스스로 고침.
 * 언제나 RTDB users/{uid}/role(진짜 역할)을 그대로 복사할 뿐이라 권한이 올라가지 않음.
 */
export const syncMyRole = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요해요.");
  const role = (await db().child(`users/${uid}/role`).get()).val();
  const doc = getFirestore().doc(`roles/${uid}`);
  if (role === "teacher" || role === "admin") await doc.set({ role, at: Date.now() });
  else await doc.delete();
  return { role: role ?? "student" };
});
