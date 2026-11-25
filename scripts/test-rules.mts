/**
 * Realtime Database 보안 규칙 검증 (F1 계정 프로필·닉네임, F2 접속·위치·자리·점프·출석)
 * 실행: npm run test:rules  (Database 에뮬레이터를 잠깐 띄워 실행하고 끕니다)
 */
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { get, ref, remove, serverTimestamp, set, update } from "firebase/database";

const env = await initializeTestEnvironment({
  projectId: "demo-adelie-rules",
  database: { rules: readFileSync("firebase/database.rules.json", "utf8") },
});
// 이전 실행에서 남은 테스트 데이터 정리 (테스트 전용 네임스페이스라 앱 데이터와는 무관)
await env.clearDatabase();

let pass = 0;
let fail = 0;
async function check(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}

const db = (ctx: RulesTestContext) => ctx.database();
/** 닉네임 예약 + 프로필 생성을 한 번에 */
function signup(ctx: RulesTestContext, uid: string, name: string, extra: Record<string, unknown> = {}) {
  return update(ref(db(ctx)), {
    [`nicknames/${name.toLowerCase()}`]: uid,
    [`users/${uid}`]: { name, role: "student", createdAt: serverTimestamp(), ...extra },
  });
}
const meta = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  role: "student",
  conn: "tab-1",
  enteredAt: Date.now(),
  studyMs: 0,
  ...extra,
});

const alice = env.authenticatedContext("alice");
const bob = env.authenticatedContext("bob");
const carol = env.authenticatedContext("carol"); // 로그인했지만 프로필 없음
const anon = env.unauthenticatedContext();

console.log("계정 프로필 · 닉네임");
await check("로그인 안 하면 가입 불가", () => assertFails(signup(anon, "nobody", "아무개")));
await check("닉네임 예약 없이 프로필만 만들면 거부", () =>
  assertFails(set(ref(db(alice), "users/alice"), { name: "앨리스", role: "student", createdAt: serverTimestamp() })),
);
await check("처음부터 선생 역할로 가입하면 거부", () => assertFails(signup(alice, "alice", "앨리스", { role: "teacher" })));
await check("잘못된 닉네임(공백 포함) 거부", () => assertFails(signup(alice, "alice", "앨 리스")));
await check("남의 uid로 가입하면 거부", () => assertFails(signup(alice, "bob", "가짜밥")));
await check("정상 가입 (한글 닉네임)", () => assertSucceeds(signup(alice, "alice", "펭귄Penguin")));
await check("가입 후 다른 닉네임으로 또 가입 불가", () => assertFails(signup(alice, "alice", "두번째")));
await check("대소문자만 다른 닉네임은 중복으로 거부", () => assertFails(signup(bob, "bob", "펭귄penguin")));
await check("다른 닉네임으로 bob 가입", () => assertSucceeds(signup(bob, "bob", "밥펭귄")));
await check("스스로 선생으로 승격 불가", () => assertFails(set(ref(db(alice), "users/alice/role"), "teacher")));
await check("닉네임 예약을 빼앗을 수 없음", () => assertFails(set(ref(db(bob), "nicknames/펭귄penguin"), "bob")));
await check("로그인 안 하면 프로필 읽기 불가", () => assertFails(get(ref(db(anon), "users/alice"))));

console.log("스터디룸 접속 · 위치");
await check("프로필 없는 계정은 스터디룸 못 봄", () => assertFails(get(ref(db(carol), "rooms/main"))));
await check("가입한 펭귄은 스터디룸 볼 수 있음", () => assertSucceeds(get(ref(db(bob), "rooms/main"))));
await check("내 이름으로 입장", () => assertSucceeds(set(ref(db(alice), "rooms/main/players/alice"), meta("펭귄Penguin"))));
await check("남의 닉네임으로 입장하면 거부", () => assertFails(set(ref(db(bob), "rooms/main/players/bob"), meta("펭귄Penguin"))));
await check("역할을 선생으로 속여 입장하면 거부", () =>
  assertFails(set(ref(db(bob), "rooms/main/players/bob"), meta("밥펭귄", { role: "teacher" }))),
);
await check("bob 입장", () => assertSucceeds(set(ref(db(bob), "rooms/main/players/bob"), meta("밥펭귄"))));
await check("남의 펭귄을 내보낼 수 없음", () => assertFails(remove(ref(db(bob), "rooms/main/players/alice"))));
await check("내 위치 보내기", () => assertSucceeds(set(ref(db(alice), "rooms/main/pos/alice"), { x: 100, y: 200, d: 1, m: true })));
await check("남의 위치를 바꿀 수 없음", () => assertFails(set(ref(db(bob), "rooms/main/pos/alice"), { x: 1, y: 1, d: 1, m: false })));
await check("맵 밖 좌표 거부", () => assertFails(set(ref(db(alice), "rooms/main/pos/alice"), { x: 99999, y: 0, d: 1, m: false })));

console.log("말풍선");
const say = (ctx: RulesTestContext, uid: string, text: string) =>
  set(ref(db(ctx), `rooms/main/bubbles/${uid}`), { id: `m-${Math.random()}`, text, at: serverTimestamp() });
await check("말하기", () => assertSucceeds(say(alice, "alice", "안녕하세요")));
await check("1초 안에 또 말하면 거부", () => assertFails(say(alice, "alice", "도배")));
await check("남의 이름으로 말하기 거부", () => assertFails(say(bob, "alice", "사칭")));
await check("201자 거부", () => assertFails(say(bob, "bob", "가".repeat(201))));
await check("빈 말 거부", () => assertFails(say(bob, "bob", "")));
await check("시각을 속이면 거부", () =>
  assertFails(set(ref(db(bob), "rooms/main/bubbles/bob"), { id: "x", text: "hi", at: Date.now() + 99_999 })),
);
await check("bob 말하기", () => assertSucceeds(say(bob, "bob", "@펭귄Penguin 반가워요")));

console.log("자리 · 점프 · 출석");
await check("빈 자리에 앉기", () => assertSucceeds(set(ref(db(alice), "rooms/main/seats/d1"), "alice")));
await check("남이 앉은 자리는 못 뺏음", () => assertFails(set(ref(db(bob), "rooms/main/seats/d1"), "bob")));
await check("남을 자리에서 일으킬 수 없음", () => assertFails(remove(ref(db(bob), "rooms/main/seats/d1"))));
await check("내 자리에서 일어나기", () => assertSucceeds(remove(ref(db(alice), "rooms/main/seats/d1"))));
await check("일어난 자리에 다른 펭귄이 앉기", () => assertSucceeds(set(ref(db(bob), "rooms/main/seats/d1"), "bob")));
await check("점프", () => assertSucceeds(set(ref(db(alice), "rooms/main/emotes/alice"), serverTimestamp())));
await check("미래 시각 점프 거부", () => assertFails(set(ref(db(alice), "rooms/main/emotes/alice"), Date.now() + 3_600_000)));
await check("내 출석 기록 저장", () =>
  assertSucceeds(set(ref(db(alice), "attendance/2026-11-25/alice"), { enteredAt: 1000, studyMs: 0 })),
);
await check("입장 시각은 바꿀 수 없음", () =>
  assertFails(set(ref(db(alice), "attendance/2026-11-25/alice"), { enteredAt: 5000, studyMs: 0 })),
);
await check("공부 시간 갱신", () =>
  assertSucceeds(set(ref(db(alice), "attendance/2026-11-25/alice"), { enteredAt: 1000, studyMs: 60_000 })),
);
await check("남의 출석 기록은 못 봄", () => assertFails(get(ref(db(bob), "attendance/2026-11-25/alice"))));

await env.cleanup();
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
