/**
 * 스터디룸 접속 흐름 검증 (src/lib/room.ts 를 실제 에뮬레이터에 붙여 두 펭귄으로 실행)
 * 입장·서로 보기·이동·자리 다툼·점프·다른 탭 이어받기·퇴장·출석 이어받기
 * 실행: npm run test:room  (npm run dev 중이면 켜져 있는 에뮬레이터를 씀)
 */
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, goOffline, ref, serverTimestamp, update, type Database } from "firebase/database";
import { joinRoom, type RoomEvents, type RoomHandle } from "../src/lib/room";
import type { PlayerState } from "../src/shared/protocol";

const PROJECT = "adelie-8e417";
const NS = `${PROJECT}-default-rtdb`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Math.random().toString(36).slice(2, 6);

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "✓" : "✗"} ${name}${cond || !extra ? "" : `\n    ${extra}`}`);
}
async function until(cond: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await sleep(50);
  return cond();
}

interface Penguin {
  app: FirebaseApp;
  db: Database;
  uid: string;
  name: string;
  seen: Map<string, PlayerState>;
  events: string[];
  room?: RoomHandle;
  ready: boolean;
}

async function makePenguin(label: string): Promise<Penguin> {
  const app = initializeApp(
    { apiKey: "demo-key", projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com` },
    `${label}-${tag}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
  const cred = await createUserWithEmailAndPassword(auth, `${label}-${tag}@test.local`, "password123");
  const name = `테스트${label}${tag}`.slice(0, 12);
  await update(ref(db), {
    [`nicknames/${name.toLowerCase()}`]: cred.user.uid,
    [`users/${cred.user.uid}`]: { name, role: "student", createdAt: serverTimestamp() },
  });
  return { app, db, uid: cred.user.uid, name, seen: new Map(), events: [], ready: false };
}

function enter(p: Penguin) {
  const on: RoomEvents = {
    ready: () => (p.ready = true),
    connection: () => {},
    serverOffset: () => {},
    player: (s) => p.seen.set(s.id, s),
    left: (id) => {
      p.seen.delete(id);
      p.events.push(`left:${id}`);
    },
    moved: (id, m) => {
      const s = p.seen.get(id);
      if (s) p.seen.set(id, { ...s, x: m.x, y: m.y, moving: m.moving });
    },
    emote: (id) => p.events.push(`jump:${id}`),
    replaced: () => p.events.push("replaced"),
  };
  p.room = joinRoom(p.uid, { name: p.name, role: "student" }, on, p.db);
}

/** 에뮬레이터 관리자 권한으로 테스트 계정 흔적 지우기 */
async function cleanup(ps: Penguin[]) {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  for (const p of ps) {
    for (const path of [`users/${p.uid}`, `nicknames/${p.name.toLowerCase()}`, `attendance/${day}/${p.uid}`]) {
      await fetch(`http://127.0.0.1:9000/${encodeURI(path)}.json?ns=${NS}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer owner" },
      });
    }
  }
}

async function main() {
  const a = await makePenguin("A");
  const b = await makePenguin("B");

  console.log("입장");
  enter(a);
  enter(b);
  ok("두 펭귄 모두 입장 완료", await until(() => a.ready && b.ready));
  ok("A가 B를 봄", await until(() => a.seen.has(b.uid)));
  ok("B가 A를 봄 (이름도 맞음)", await until(() => b.seen.get(a.uid)?.name === a.name));

  console.log("이동");
  a.room!.move({ x: 321, y: 456, dir: -1, moving: true });
  ok("B 화면에서 A 위치가 바뀜", await until(() => b.seen.get(a.uid)?.x === 321 && b.seen.get(a.uid)?.y === 456));

  console.log("자리");
  ok("A가 집중석 desk-1에 앉음", await a.room!.sit("desk-1", 1));
  ok("B 화면에 A가 desk-1에 앉아 공부 중", await until(() => b.seen.get(a.uid)?.seatId === "desk-1" && !!b.seen.get(a.uid)?.studySince));
  ok("B는 같은 자리에 못 앉음", !(await b.room!.sit("desk-1", 1)));
  await sleep(1200);
  a.room!.stand();
  ok("A가 일어나면 공부 시간이 쌓임", await until(() => (b.seen.get(a.uid)?.studyMs ?? 0) >= 1000 && !b.seen.get(a.uid)?.seatId));
  ok("일어난 자리에 B가 앉음", await b.room!.sit("desk-1", 1));
  ok("B가 다른 자리로 옮기면 desk-1이 비고 A가 앉을 수 있음", (await b.room!.sit("stand-1", 1)) && (await a.room!.sit("desk-1", 1)));

  console.log("점프");
  b.room!.jump();
  ok("A가 B의 점프를 봄", await until(() => a.events.includes(`jump:${b.uid}`)));

  console.log("같은 계정 다른 탭");
  const aTab2: Penguin = { ...a, seen: new Map(), events: [], ready: false };
  enter(aTab2);
  ok("새 탭 입장", await until(() => aTab2.ready));
  ok("예전 탭은 '이어받음' 알림을 받음", await until(() => a.events.includes("replaced")));
  ok("B 화면에는 A가 한 명만 있음", b.seen.has(a.uid) && [...b.seen.values()].filter((s) => s.name === a.name).length === 1);
  ok("이어받은 탭의 출석 입장 시각이 처음 입장 시각과 같음", aTab2.seen.get(a.uid)?.enteredAt === b.seen.get(a.uid)?.enteredAt);

  console.log("퇴장 · 연결 끊김");
  await aTab2.room!.leave();
  ok("A가 나가면 B 화면에서 사라짐", await until(() => !b.seen.has(a.uid)));
  goOffline(b.db); // 창을 갑자기 닫은 것과 같음 → 서버가 onDisconnect 로 정리
  const c = await makePenguin("C");
  enter(c);
  ok("B가 끊기면 새로 온 C 화면에 B가 없음", (await until(() => c.ready)) && (await sleep(500), !c.seen.has(b.uid)));
  ok("B가 앉았던 자리 stand-1이 비어 C가 앉을 수 있음", await c.room!.sit("stand-1", 1));
  await c.room!.leave();

  await cleanup([a, b, c]);
  await Promise.all([a, b, c].map((p) => deleteApp(p.app)));
  console.log(`\n${pass}개 통과, ${fail}개 실패`);
  process.exit(fail ? 1 : 0);
}

void main();
