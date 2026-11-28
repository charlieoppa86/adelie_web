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
await check("처음부터 강사 역할로 가입하면 거부", () => assertFails(signup(alice, "alice", "앨리스", { role: "teacher" })));
await check("잘못된 닉네임(공백 포함) 거부", () => assertFails(signup(alice, "alice", "앨 리스")));
await check("남의 uid로 가입하면 거부", () => assertFails(signup(alice, "bob", "가짜밥")));
await check("정상 가입 (한글 닉네임)", () => assertSucceeds(signup(alice, "alice", "펭귄Penguin")));
await check("가입 후 다른 닉네임으로 또 가입 불가", () => assertFails(signup(alice, "alice", "두번째")));
await check("대소문자만 다른 닉네임은 중복으로 거부", () => assertFails(signup(bob, "bob", "펭귄penguin")));
await check("다른 닉네임으로 bob 가입", () => assertSucceeds(signup(bob, "bob", "밥펭귄")));
await check("스스로 강사으로 승격 불가", () => assertFails(set(ref(db(alice), "users/alice/role"), "teacher")));
await check("닉네임 예약을 빼앗을 수 없음", () => assertFails(set(ref(db(bob), "nicknames/펭귄penguin"), "bob")));
await check("로그인 안 하면 프로필 읽기 불가", () => assertFails(get(ref(db(anon), "users/alice"))));

console.log("스터디룸 접속 · 위치");
await check("프로필 없는 계정은 스터디룸 못 봄", () => assertFails(get(ref(db(carol), "rooms/main"))));
await check("가입한 펭귄은 스터디룸 볼 수 있음", () => assertSucceeds(get(ref(db(bob), "rooms/main"))));
await check("내 이름으로 입장", () => assertSucceeds(set(ref(db(alice), "rooms/main/players/alice"), meta("펭귄Penguin"))));
await check("남의 닉네임으로 입장하면 거부", () => assertFails(set(ref(db(bob), "rooms/main/players/bob"), meta("펭귄Penguin"))));
await check("역할을 강사으로 속여 입장하면 거부", () =>
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

console.log("스터디 LIVE");
const dave = env.authenticatedContext("dave");
const erin = env.authenticatedContext("erin");
await check("dave 가입", () => assertSucceeds(signup(dave, "dave", "관리펭귄")));
await check("erin 가입", () => assertSucceeds(signup(erin, "erin", "강사펭귄")));
// 역할은 콘솔·관리자만 바꾸므로 테스트에서는 규칙을 끄고 지정 (alice · dave 관리자, erin 강사)
await env.withSecurityRulesDisabled(async (ctx) => {
  await set(ref(ctx.database(), "users/alice/role"), "admin");
  await set(ref(ctx.database(), "users/dave/role"), "admin");
  await set(ref(ctx.database(), "users/erin/role"), "teacher");
});
const BC = "rooms/main/broadcast";
const lecture = (uid: string, name: string, extra: Record<string, unknown> = {}) => ({
  hostUid: uid,
  hostName: name,
  mode: "live",
  kind: "youtube",
  videoId: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  startedAt: serverTimestamp(),
  endsAt: Date.now() + 3_600_000,
  ...extra,
});
await check("학생은 강의를 만들 수 없음", () => assertFails(set(ref(db(bob), BC), lecture("bob", "밥펭귄"))));
await check("강사도 강의를 만들 수 없음 (관리자만)", () => assertFails(set(ref(db(erin), BC), lecture("erin", "강사펭귄"))));
await check("남의 이름으로 강의를 만들 수 없음", () => assertFails(set(ref(db(alice), BC), lecture("alice", "밥펭귄"))));
await check("남을 진행자로 적을 수 없음", () => assertFails(set(ref(db(alice), BC), lecture("bob", "밥펭귄"))));
await check("영상 ID와 다른 유튜브 주소 거부", () =>
  assertFails(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { url: "https://evil.example/watch?v=dQw4w9WgXcQ" }))),
);
await check("지원하지 않는 주소 거부", () =>
  assertFails(
    set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { kind: "zoom", videoId: null, url: "https://zoom.evil.com/j/1" })),
  ),
);
await check("javascript: 주소 거부", () =>
  assertFails(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { kind: "zoom", videoId: null, url: "javascript:alert(1)" }))),
);
await check("시작 시각을 속이면 거부", () =>
  assertFails(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { startedAt: Date.now() - 1000 }))),
);
await check("관리자가 유튜브 강의 만들기", () => assertSucceeds(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin"))));
await check("모든 펭귄이 강의를 볼 수 있음", () => assertSucceeds(get(ref(db(bob), BC))));
await check("강의 중에는 다른 관리자도 새 강의를 못 만듦 (한 번에 1명)", () =>
  assertFails(set(ref(db(dave), BC), lecture("dave", "관리펭귄"))),
);
await check("진행자도 강의 중에 덮어쓸 수 없음", () =>
  assertFails(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { kind: "meet", videoId: null, url: "https://meet.google.com/abc-defg-hij" }))),
);
await check("학생은 강의를 끝낼 수 없음", () => assertFails(remove(ref(db(bob), BC))));
await check("강사도 강의를 끝낼 수 없음", () => assertFails(remove(ref(db(erin), BC))));
await check("관리자가 30분 연장", () => assertSucceeds(update(ref(db(alice), BC), { endsAt: Date.now() + 5_400_000 })));
await check("다른 관리자도 연장 가능", () => assertSucceeds(update(ref(db(dave), BC), { endsAt: Date.now() + 7_200_000 })));
await check("학생은 연장 불가", () => assertFails(update(ref(db(bob), BC), { endsAt: Date.now() + 9_000_000 })));
await check("24시간 넘게 연장 불가", () => assertFails(update(ref(db(alice), BC), { endsAt: Date.now() + 25 * 3_600_000 })));
await check("이미 지난 시각으로 바꿀 수 없음", () => assertFails(update(ref(db(alice), BC), { endsAt: Date.now() - 1000 })));
await check("진행 중에는 진행자를 바꿀 수 없음", () => assertFails(update(ref(db(dave), BC), { hostUid: "dave", hostName: "관리펭귄" })));
await check("유튜브 LIVE → 다시보기(기존 영상) 전환", () =>
  assertSucceeds(update(ref(db(alice), BC), { mode: "vod", endsAt: Date.now() + 23 * 3_600_000 })),
);
await check("진행자가 강의 끝내기", () => assertSucceeds(remove(ref(db(alice), BC))));
await check("구글 미트 강의", () =>
  assertSucceeds(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { kind: "meet", videoId: null, url: "https://meet.google.com/abc-defg-hij" }))),
);
await check("다른 관리자가 강의 끝내기", () => assertSucceeds(remove(ref(db(dave), BC))));
await check("관리자가 줌 강의 만들기", () =>
  assertSucceeds(
    set(ref(db(dave), BC), lecture("dave", "관리펭귄", { kind: "zoom", videoId: null, url: "https://us02web.zoom.us/j/1234567890?pwd=abc" })),
  ),
);
await check("줌 LIVE는 다시보기로 전환 불가", () =>
  assertFails(update(ref(db(dave), BC), { mode: "vod", endsAt: Date.now() + 3_600_000 })),
);
await check("방식(mode)이 없으면 거부", () => assertSucceeds(remove(ref(db(dave), BC))).then(() =>
  assertFails(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { mode: null }))),
));
await check("줌은 기존 영상으로 등록 불가", () =>
  assertFails(
    set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { mode: "vod", kind: "zoom", videoId: null, url: "https://zoom.us/j/1" })),
  ),
);
await check("기존 유튜브 영상 등록", () => assertSucceeds(set(ref(db(alice), BC), lecture("alice", "펭귄Penguin", { mode: "vod" }))));
await check("종료 시각이 지난 강의는 다른 관리자가 새 강의로 덮어쓰기", async () => {
  await env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), `${BC}/endsAt`), Date.now() - 1000));
  await assertSucceeds(set(ref(db(dave), BC), lecture("dave", "관리펭귄")));
});
await check("종료 시각이 없으면 거부", async () => {
  await assertSucceeds(remove(ref(db(dave), BC)));
  await assertFails(set(ref(db(dave), BC), lecture("dave", "관리펭귄", { endsAt: null })));
});
await check("종료 시각이 24시간 넘으면 거부", () =>
  assertFails(set(ref(db(dave), BC), lecture("dave", "관리펭귄", { endsAt: Date.now() + 25 * 3_600_000 }))),
);

console.log("닉네임 변경 (30일에 2번) · 탈퇴 유예");
const frank = env.authenticatedContext("frank");
const gina = env.authenticatedContext("gina");
const DAY = 86_400_000;
const adminSet = (path: string, v: unknown) => env.withSecurityRulesDisabled((ctx) => set(ref(ctx.database(), path), v));
const readAs = async (path: string) => {
  let v: unknown;
  await env.withSecurityRulesDisabled(async (ctx) => (v = (await get(ref(ctx.database(), path))).val()));
  return v;
};
/** 앱과 같은 방식: 새 닉네임 예약(내 것이 아니면) + 이름 + 변경 시각 (직전 변경 시각은 prev 로 밀어냄) */
async function rename(ctx: RulesTestContext, uid: string, name: string, opts: { skipPrev?: boolean; skipStamp?: boolean } = {}) {
  const key = name.toLowerCase();
  const last = (await readAs(`users/${uid}/nameChangedAt`)) as number | null;
  const owned = (await readAs(`nicknames/${key}`)) === uid;
  return update(ref(db(ctx)), {
    ...(owned ? {} : { [`nicknames/${key}`]: uid }),
    [`users/${uid}/name`]: name,
    ...(opts.skipStamp ? {} : { [`users/${uid}/nameChangedAt`]: serverTimestamp() }),
    ...(last && !opts.skipPrev ? { [`users/${uid}/prevNameChangedAt`]: last } : {}),
  });
}
await check("frank 가입", () => assertSucceeds(signup(frank, "frank", "프랭크")));
await check("변경 시각 없이 이름만 바꾸면 거부", () => assertFails(rename(frank, "frank", "프랭키", { skipStamp: true })));
await check("남이 쓰는 닉네임으로 변경 거부", () => assertFails(rename(frank, "frank", "밥펭귄")));
await check("남의 닉네임 바꾸기 거부", () => assertFails(rename(bob, "frank", "해커펭")));
await check("1번째 변경", () => assertSucceeds(rename(frank, "frank", "프랭키")));
await check("옛 닉네임은 계속 묶여 있어 다른 펭귄이 못 씀", () => assertFails(signup(gina, "gina", "프랭크")));
await check("옛 닉네임 예약을 지울 수 없음", () => assertFails(remove(ref(db(frank), "nicknames/프랭크"))));
await check("2번째 변경 (직전 변경 시각을 prev 로)", () => assertSucceeds(rename(frank, "frank", "프랭키2")));
await check("30일 안에 3번째 변경은 거부", () => assertFails(rename(frank, "frank", "프랭키3")));
await check("변경 시각만 따로 고치기 거부", () => assertFails(set(ref(db(frank), "users/frank/nameChangedAt"), serverTimestamp())));
await check("prev 만 지우기 거부", () => assertFails(remove(ref(db(frank), "users/frank/prevNameChangedAt"))));
await adminSet("users/frank/prevNameChangedAt", Date.now() - 31 * DAY);
await check("30일 지나면 다시 변경 가능 — 단 prev 를 안 밀면 거부", () => assertFails(rename(frank, "frank", "프랭키3", { skipPrev: true })));
await check("30일 지나면 다시 변경 가능 (내 옛 닉네임으로 돌아가기)", () => assertSucceeds(rename(frank, "frank", "프랭크")));
await check("스터디룸 이름표는 새 이름으로만", async () => {
  await assertFails(set(ref(db(frank), "rooms/main/players/frank"), meta("프랭키2")));
  await assertSucceeds(set(ref(db(frank), "rooms/main/players/frank"), meta("프랭크")));
  await assertSucceeds(remove(ref(db(frank), "rooms/main/players/frank")));
});
await check("탈퇴 예정 시각을 스스로 쓸 수 없음 (서버만)", () =>
  assertFails(set(ref(db(frank), "users/frank/deleteAt"), Date.now() + 7 * DAY)),
);
await adminSet("users/frank/deleteAt", Date.now() + 7 * DAY);
await adminSet("users/frank/prevNameChangedAt", Date.now() - 31 * DAY);
await check("탈퇴 유예 중엔 스터디룸 입장 거부", () => assertFails(set(ref(db(frank), "rooms/main/players/frank"), meta("프랭크"))));
await check("탈퇴 유예 중엔 닉네임 변경 거부", () => assertFails(rename(frank, "frank", "프랭키4")));
await check("탈퇴 유예 중인 펭귄에게 비밀 대화 신청 거부", () =>
  assertFails(set(ref(db(bob), "dm/requests/frank/bob"), { at: serverTimestamp() })),
);
await check("남이 탈퇴 취소 거부", () => assertFails(remove(ref(db(bob), "users/frank/deleteAt"))));
await check("본인은 탈퇴 취소(복구) 가능", () => assertSucceeds(remove(ref(db(frank), "users/frank/deleteAt"))));
await check("복구하면 다시 입장 가능", async () => {
  await assertSucceeds(set(ref(db(frank), "rooms/main/players/frank"), meta("프랭크")));
  await assertSucceeds(remove(ref(db(frank), "rooms/main/players/frank")));
});

await env.cleanup();
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
