/**
 * 닉네임 변경 · 회원 탈퇴(7일 유예) 통합 검증 — Auth · Functions · Database 에뮬레이터
 * 실행: npm run test:account
 *
 * - 닉네임을 바꾸면 스터디룸 이름표가 따라 바뀜 (room.ts)
 * - 탈퇴 신청(호출형 함수): 학생은 deleteAt 이 7일 뒤로, 관리자 · 정지 중이면 거부
 * - 유예가 끝난 계정 정리(purgeDue): 데이터와 로그인 계정이 지워지고 닉네임 예약은 남음
 */
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= "127.0.0.1:9000";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, ref, serverTimestamp, set, update, type Database } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { execFileSync } from "node:child_process";
import { joinRoom, type RoomHandle } from "../src/lib/room";

const PROJECT = "adelie-8e417";
const NS = `${PROJECT}-default-rtdb`;
const DAY = 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 6);

// 관리자 쓰기는 에뮬레이터 REST(owner 토큰)로 — 관리자 SDK 는 클라이언트 SDK 와 한 프로세스에서 충돌
const admin = async (method: "GET" | "PUT" | "PATCH", path: string, body?: unknown) => {
  const res = await fetch(`http://127.0.0.1:9000/${path}.json?ns=${NS}`, {
    method,
    headers: { Authorization: "Bearer owner" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json();
};
const purge = (...uids: string[]) => {
  const out = execFileSync("node", ["scripts/purge-emulator.mjs", ...uids], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!) as { done: string[]; authExists: Record<string, boolean> };
};

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond || !extra ? "" : `\n    ${extra}`}`);
}
async function until(cond: () => boolean | Promise<boolean>, ms = 4000) {
  const end = Date.now() + ms;
  while (!(await cond()) && Date.now() < end) await sleep(50);
  return cond();
}

interface Penguin {
  app: FirebaseApp;
  db: Database;
  uid: string;
  name: string;
  call: () => Promise<{ deleteAt?: number; reason?: string }>;
}

async function makePenguin(label: string): Promise<Penguin> {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com` }, `${label}-${tag}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  const fns = getFunctions(app, "asia-southeast1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const cred = await createUserWithEmailAndPassword(auth, `${label}-${tag}@test.local`, "password123");
  const name = `탈퇴${label}${tag}`.slice(0, 12);
  await update(ref(db), {
    [`nicknames/${name.toLowerCase()}`]: cred.user.uid,
    [`users/${cred.user.uid}`]: { name, role: "student", createdAt: serverTimestamp() },
  });
  const call = async () => {
    try {
      return (await httpsCallable<void, { deleteAt: number }>(fns, "requestAccountDeletion")()).data;
    } catch (e) {
      return { reason: (e as { details?: { reason?: string } }).details?.reason ?? String(e) };
    }
  };
  return { app, db, uid: cred.user.uid, name, call };
}

async function main() {
  const sue = await makePenguin("sue");
  const ann = await makePenguin("ann");
  const max = await makePenguin("max");
  const bea = await makePenguin("bea");

  console.log("닉네임 변경 → 스터디룸 이름표");
  let room: RoomHandle | null = null; // 입장 후 leave
  let seenName = "";
  let ready = false;
  room = joinRoom(sue.uid, { name: sue.name, role: "student" }, {
    ready: () => (ready = true),
    connection: () => {},
    serverOffset: () => {},
    player: (p) => {
      if (p.id === sue.uid) seenName = p.name;
    },
    left: () => {},
    moved: () => {},
    emote: () => {},
    bubble: () => {},
    replaced: () => {},
  }, sue.db);
  ok("입장", await until(() => ready && seenName === sue.name, 15000));
  const newName = `새이름${tag}`;
  await update(ref(sue.db), {
    [`nicknames/${newName.toLowerCase()}`]: sue.uid,
    [`users/${sue.uid}/name`]: newName,
    [`users/${sue.uid}/nameChangedAt`]: serverTimestamp(),
  });
  ok("이름표가 새 닉네임으로 바뀜", await until(() => seenName === newName), `seen=${seenName}`);
  await room.leave();

  console.log("탈퇴 신청");
  const r1 = await sue.call();
  ok("학생은 신청되고 7일 뒤로 예약", !!r1.deleteAt && Math.abs(r1.deleteAt - (Date.now() + 7 * DAY)) < 60_000, JSON.stringify(r1));
  const again = await sue.call();
  ok("다시 신청해도 같은 예약 시각", again.deleteAt === r1.deleteAt);
  ok(
    "유예 중엔 스터디룸 입장 거부",
    await set(ref(sue.db, `rooms/main/players/${sue.uid}`), { name: newName, role: "student", conn: "x", enteredAt: 1, studyMs: 0 })
      .then(() => false)
      .catch(() => true),
  );

  await admin("PUT", `users/${ann.uid}/role`, "admin");
  ok("관리자는 거부", (await ann.call()).reason === "admin");
  await admin("PUT", `bans/${max.uid}`, { until: Date.now() + DAY, by: ann.uid });
  ok("정지 중이면 거부", (await max.call()).reason === "banned");

  console.log("유예 끝난 계정 정리");
  // bea: 유예 끝남 + 흔적 남겨 두기 / sue: 아직 유예 중
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  await admin("PATCH", "", {
    [`users/${bea.uid}/deleteAt`]: Date.now() - 1000,
    [`attendance/${today}/${bea.uid}`]: { enteredAt: 1, studyMs: 5 },
    [`rooms/main/seats/test-${tag}`]: bea.uid,
    [`dm/requests/${bea.uid}/${ann.uid}`]: { at: Date.now() },
    [`dm/requests/${ann.uid}/${bea.uid}`]: { at: Date.now() },
  });
  const { done, authExists } = purge(bea.uid);
  ok("유예가 끝난 계정만 정리", done.includes(bea.uid) && !done.includes(sue.uid), JSON.stringify(done));
  const gone = async (p: string) => (await admin("GET", p)) === null;
  ok("프로필 삭제", await gone(`users/${bea.uid}`));
  ok("출석 기록 삭제", await gone(`attendance/${today}/${bea.uid}`));
  ok("자리 비움", await gone(`rooms/main/seats/test-${tag}`));
  ok("받은 · 보낸 비밀 대화 신청 삭제", (await gone(`dm/requests/${bea.uid}`)) && (await gone(`dm/requests/${ann.uid}/${bea.uid}`)));
  ok("닉네임 예약은 남음 (사칭 방지)", (await admin("GET", `nicknames/${bea.name.toLowerCase()}`)) === bea.uid);
  ok("로그인 계정 삭제", authExists[bea.uid] === false);
  ok("유예 중인 계정은 그대로", (await get(ref(sue.db, `users/${sue.uid}/deleteAt`))).val() === r1.deleteAt);

  // 뒷정리
  await admin("PATCH", "", { [`users/${ann.uid}/role`]: "student", [`bans/${max.uid}`]: null });
  await Promise.all([sue, ann, max, bea].map((p) => deleteApp(p.app)));
  console.log(`\n${pass}개 통과, ${fail}개 실패`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
