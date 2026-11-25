/**
 * 비밀 대화 · 신고 · 관리자 흐름 검증 (src/lib/dm.ts · moderation.ts · room.ts + Cloud Functions, 에뮬레이터)
 * 실행: npm run test:dm  (npm run dev 중이면 켜져 있는 에뮬레이터를 씀)
 */
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, get, getDatabase, goOffline, ref, serverTimestamp, set, update, type Database } from "firebase/database";
import { startDm, type DmHandle } from "../src/lib/dm";
import { dismiss, kick, setRole, watchBan, watchFlags, type FlaggedTarget } from "../src/lib/moderation";
import { joinRoom, type RoomHandle } from "../src/lib/room";
import type { PlayerState } from "../src/shared/protocol";

const PROJECT = "adelie-8e417";
const NS = `${PROJECT}-default-rtdb`;
const EMU = "http://127.0.0.1:9000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 6);

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${name}`);
}
async function until(cond: () => boolean, ms = 6000) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await sleep(50);
  return cond();
}
/** 에뮬레이터 관리자 권한으로 읽기·쓰기 (규칙 무시) */
const owner = (path: string, init?: RequestInit) =>
  fetch(`${EMU}/${encodeURI(path)}.json?ns=${NS}`, { ...init, headers: { Authorization: "Bearer owner" } }).then((r) => r.json());

interface P {
  app: FirebaseApp;
  db: Database;
  uid: string;
  name: string;
  seen: Map<string, PlayerState>;
  ev: string[];
  room?: RoomHandle;
  dm?: DmHandle;
  ready: boolean;
}

async function make(label: string): Promise<P> {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com` }, `${label}-${tag}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  const cred = await createUserWithEmailAndPassword(auth, `${label}-${tag}@test.local`, "password123");
  const name = `${label}${tag}`;
  await update(ref(db), {
    [`nicknames/${name.toLowerCase()}`]: cred.user.uid,
    [`users/${cred.user.uid}`]: { name, role: "student", createdAt: serverTimestamp() },
  });
  return { app, db, uid: cred.user.uid, name, seen: new Map(), ev: [], ready: false };
}

function enter(p: P, role: PlayerState["role"] = "student") {
  p.room = joinRoom(
    p.uid,
    { name: p.name, role },
    {
      ready: () => (p.ready = true),
      connection: () => {},
      serverOffset: () => {},
      player: (s) => p.seen.set(s.id, s),
      left: (id) => {
        p.seen.delete(id);
        p.dm?.peerLeft(id);
      },
      moved: () => {},
      emote: () => {},
      bubble: () => {},
      replaced: () => {},
    },
    p.db,
  );
  p.dm = startDm(
    p.uid,
    {
      peer: (id) => {
        const s = p.seen.get(id);
        return s ? { id, name: s.name, role: s.role } : null;
      },
      serverNow: () => Date.now(),
    },
    {
      requested: (id) => p.ev.push(`requested:${id}`),
      incoming: (id) => p.ev.push(`incoming:${id}`),
      closed: (id, reason, _n, mine) => p.ev.push(`closed:${reason}:${mine ? "mine" : "theirs"}`),
      started: (sid) => p.ev.push(`started:${sid}`),
      message: (m) => p.ev.push(`msg:${m.text}`),
      ended: (_sid, _n, reason) => p.ev.push(`ended:${reason}`),
      locks: (pairs) => p.ev.push(`locks:${pairs.length}`),
      notice: (m) => p.ev.push(`notice:${m}`),
    },
    p.db,
  );
}
const has = (p: P, s: string) => p.ev.some((e) => e.startsWith(s));
const reset = (...ps: P[]) => ps.forEach((p) => (p.ev = []));
const sidOf = (p: P) => p.ev.find((e) => e.startsWith("started:"))?.slice(8) ?? "";

async function main() {
  const [a, b, c, adm] = await Promise.all(["A", "B", "C", "M"].map(make));
  await owner(`users/${adm.uid}/role`, { method: "PUT", body: JSON.stringify("admin") });
  for (const p of [a, b, c]) enter(p);
  enter(adm, "admin");
  ok("네 펭귄 입장", await until(() => [a, b, c, adm].every((p) => p.ready && p.seen.size >= 4)));

  console.log("신청 · 거절 · 취소");
  a.dm!.request(b.uid);
  ok("B가 신청을 받음", await until(() => has(b, `incoming:in:${a.uid}`)));
  b.dm!.respond(`in:${a.uid}`, false);
  ok("A에게 거절 알림", await until(() => has(a, "closed:declined:mine")));
  reset(a, b);
  a.dm!.request(b.uid);
  await until(() => has(b, "incoming:"));
  a.dm!.cancel();
  ok("A가 취소하면 B에게 취소 알림", await until(() => has(b, "closed:cancelled:theirs")));

  console.log("수락 · 메시지 · 잠금");
  reset(a, b, c);
  a.dm!.request(b.uid);
  await until(() => has(b, "incoming:"));
  b.dm!.respond(`in:${a.uid}`, true);
  ok("둘 다 대화 시작", await until(() => has(a, "started:") && has(b, "started:")));
  const sid1 = sidOf(a);
  ok("C에게 🔒 잠금 1쌍이 보임", await until(() => c.ev.includes("locks:1")));
  c.dm!.request(a.uid);
  ok("대화 중인 A에게 신청하면 '다른 대화 중'", await until(() => has(c, "closed:busy:mine")));
  a.dm!.send("안녕 B");
  b.dm!.send("안녕 A");
  ok("서로 메시지를 받음", await until(() => has(b, "msg:안녕 B") && has(a, "msg:안녕 A")));
  ok("C는 대화 내용을 읽을 수 없음", await get(ref(c.db, `dm/messages/${sid1}`)).then(() => false, () => true));
  ok("관리자도 대화 내용을 읽을 수 없음", await get(ref(adm.db, `dm/messages/${sid1}`)).then(() => false, () => true));

  console.log("신고 (1명)");
  let flags: FlaggedTarget[] = [];
  const alerts: string[] = [];
  const unFlags = watchFlags({ flags: (l) => (flags = l), alert: (n, k) => alerts.push(`${n}:${k}`) }, adm.db);
  const unFlagsA = watchFlags({ flags: () => {}, alert: () => alerts.push("A가 봄") }, a.db);
  ok("A가 B를 신고", (await a.dm!.report("abuse", "욕설을 했어요", false)) === "ok");
  ok("같은 대화를 또 신고하면 중복", (await a.dm!.report("abuse", "", false)) === "duplicate");
  await sleep(1500);
  ok("신고자 1명이면 관리자에게 안 보임", flags.length === 0 && alerts.length === 0);
  a.dm!.leave();
  ok("A가 나가면 B에게 '상대가 마침' 알림", await until(() => has(b, "ended:left") && has(a, "ended:mine")));
  ok("대화가 끝나면 메시지가 지워짐 (Cloud Function)", await until(() => false, 0).then(async () => {
    for (let i = 0; i < 60; i++) {
      if ((await owner(`dm/messages/${sid1}`)) === null) return true;
      await sleep(100);
    }
    return false;
  }));

  console.log("신고 (2명) · 관리자");
  reset(b, c);
  c.dm!.request(b.uid);
  await until(() => has(b, "incoming:"));
  b.dm!.respond(`in:${c.uid}`, true);
  await until(() => has(c, "started:"));
  b.dm!.send("나쁜 말");
  await until(() => has(c, "msg:나쁜 말"));
  ok("C가 B를 신고하며 대화 종료", (await c.dm!.report("harass", "", true)) === "ok");
  ok("B에게 대화 종료 알림", await until(() => has(b, "ended:")));
  ok("서로 다른 2명 → 관리자에게 보이고 알림", await until(() => flags[0]?.targetId === b.uid && flags[0].reporterCount === 2 && alerts.length === 1));
  const snap = flags[0]?.reports.find((r) => r.reporterName === c.name)?.snapshot ?? [];
  ok("신고 스냅샷에 그 시점 대화가 서버에서 담김", snap.some((m) => m.text === "나쁜 말" && m.from === b.name));
  ok("관리자가 아니면 신고 목록을 못 봄", !alerts.includes("A가 봄"));
  await dismiss(b.uid, adm.db);
  ok("문제없음 처리 → 목록에서 빠짐", await until(() => flags.length === 0));

  console.log("역할 · 퇴장");
  await setRole(c.uid, "teacher", adm.db);
  ok("관리자가 C에게 강사 역할 → 다른 펭귄 화면에도 반영", await until(() => a.seen.get(c.uid)?.role === "teacher"));
  ok("학생이 역할을 바꿀 수 없음", await setRole(b.uid, "teacher", a.db).then(() => false, () => true));
  let bannedUntil: number | null = null;
  const unBan = watchBan(b.uid, (u) => (bannedUntil = u), b.db);
  await kick(adm.uid, b.uid, null, Date.now(), adm.db);
  ok("퇴장당한 B가 알림을 받음", await until(() => (bannedUntil ?? 0) > Date.now()));
  ok("B가 다른 펭귄 화면에서 사라짐", await until(() => !a.seen.has(b.uid)));
  ok("퇴장 기간에는 다시 입장 못 함 (규칙)", await set(ref(b.db, `rooms/main/players/${b.uid}`), { name: b.name, role: "student", conn: "x", enteredAt: 1, studyMs: 0 }).then(() => false, () => true));
  ok("학생은 남을 퇴장시킬 수 없음", await kick(a.uid, c.uid, null, Date.now(), a.db).then(() => false, () => true));

  console.log("연결 끊김");
  reset(a, c);
  a.dm!.request(c.uid);
  await until(() => has(c, "incoming:"));
  c.dm!.respond(`in:${a.uid}`, true);
  await until(() => has(a, "started:"));
  goOffline(c.db);
  ok("상대 연결이 끊기면 대화 종료", await until(() => has(a, "ended:disconnected")));

  unFlags();
  unFlagsA();
  unBan();
  for (const p of [a, adm]) await p.dm!.stop();
  for (const p of [a, adm]) await p.room!.leave();
  // 테스트 흔적 정리
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  for (const p of [a, b, c, adm]) {
    for (const path of [`users/${p.uid}`, `nicknames/${p.name.toLowerCase()}`, `attendance/${day}/${p.uid}`, `bans/${p.uid}`, `rooms/main/players/${p.uid}`, `rooms/main/pos/${p.uid}`, `dm/active/${p.uid}`])
      await owner(path, { method: "DELETE" });
  }
  await owner("moderation", { method: "DELETE" });
  await Promise.all([a, b, c, adm].map((p) => deleteApp(p.app)));
  console.log(`\n${pass}개 통과, ${fail}개 실패`);
  process.exit(fail ? 1 : 0);
}

void main();
