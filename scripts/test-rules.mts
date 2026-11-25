/**
 * Firestore 보안 규칙 검증 (F1: 계정 프로필·닉네임 예약).
 * 실행: npm run test:rules  (Firestore 에뮬레이터를 잠깐 띄워 실행하고 끕니다)
 */
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-adelie-rules",
  firestore: { rules: readFileSync("firebase/firestore.rules", "utf8") },
});

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

/** 닉네임 예약 + 프로필 생성을 한 배치로 */
function signup(ctx: RulesTestContext, uid: string, name: string, extra: Record<string, unknown> = {}) {
  const db = ctx.firestore();
  const b = writeBatch(db);
  b.set(doc(db, "nicknames", name.toLowerCase()), { uid });
  b.set(doc(db, "users", uid), { name, role: "student", createdAt: serverTimestamp(), ...extra });
  return b.commit();
}

const alice = env.authenticatedContext("alice");
const bob = env.authenticatedContext("bob");
const anon = env.unauthenticatedContext();

console.log("Firestore 규칙");
await check("로그인 안 하면 프로필 못 만듦", () => assertFails(signup(anon, "nobody", "아무개")));
await check("닉네임 예약 없이 프로필만 만들면 거부", () =>
  assertFails(setDoc(doc(alice.firestore(), "users", "alice"), { name: "앨리스", role: "student", createdAt: serverTimestamp() })),
);
await check("처음부터 선생 역할로 가입하면 거부", () => assertFails(signup(alice, "alice", "앨리스", { role: "teacher" })));
await check("잘못된 닉네임(공백 포함) 거부", () => assertFails(signup(alice, "alice", "앨 리스")));
await check("남의 uid로 가입하면 거부", () => assertFails(signup(alice, "bob", "가짜밥")));
await check("정상 가입", () => assertSucceeds(signup(alice, "alice", "Penguin")));
await check("가입 후 다른 닉네임으로 또 가입 불가", () => assertFails(signup(alice, "alice", "두번째")));
await check("대소문자만 다른 닉네임은 중복으로 거부", () => assertFails(signup(bob, "bob", "penguin")));
await check("다른 닉네임으로 bob 가입", () => assertSucceeds(signup(bob, "bob", "밥펭귄")));
await check("스스로 선생으로 승격 불가", () => assertFails(updateDoc(doc(alice.firestore(), "users", "alice"), { role: "teacher" })));
await check("닉네임 예약을 빼앗을 수 없음", () =>
  assertFails(setDoc(doc(bob.firestore(), "nicknames", "penguin"), { uid: "bob" })),
);
await check("로그인한 펭귄은 다른 프로필 읽기 가능", () => assertSucceeds(getDoc(doc(bob.firestore(), "users", "alice"))));
await check("로그인 안 하면 프로필 읽기 불가", () => assertFails(getDoc(doc(anon.firestore(), "users", "alice"))));

await env.cleanup();
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
