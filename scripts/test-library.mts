/**
 * 📚 자료실 보안 규칙 검증 (Firestore library · roles + Storage library/)
 * 실행: npm run test:library  (Firestore · Storage 에뮬레이터를 잠깐 띄워 실행하고 끕니다)
 */
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestContext } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { deleteObject, ref as sref, uploadBytes } from "firebase/storage";

const env = await initializeTestEnvironment({
  projectId: "demo-adelie-library",
  firestore: { rules: readFileSync("firebase/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  storage: { rules: readFileSync("firebase/storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
});
await env.clearFirestore();
await env.clearStorage();

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

// 역할 사본 (실제로는 함수 syncRole 이 씀) — 학생은 사본 없음
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "roles/teacher1"), { role: "teacher" });
  await setDoc(doc(db, "roles/teacher2"), { role: "teacher" });
  await setDoc(doc(db, "roles/admin"), { role: "admin" });
});

const t1 = env.authenticatedContext("teacher1");
const t2 = env.authenticatedContext("teacher2");
const admin = env.authenticatedContext("admin");
const stu = env.authenticatedContext("student");
const anon = env.unauthenticatedContext();
const fs = (c: RulesTestContext) => c.firestore();

const meta = (uid: string, name: string, visibility = "private", extra: Record<string, unknown> = {}) => ({
  title: "1회차 — 설치하고 세팅하기",
  icon: "📱",
  visibility,
  ownerId: uid,
  ownerName: name,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  updatedByName: name,
  ...extra,
});
function create(c: RulesTestContext, id: string, m: Record<string, unknown>, body = '{"type":"doc"}') {
  const b = writeBatch(fs(c));
  b.set(doc(fs(c), `library/${id}`), m);
  b.set(doc(fs(c), `library/${id}/body/main`), { doc: body });
  return b.commit();
}
const stamp = (uid: string, name: string) => ({ updatedAt: serverTimestamp(), updatedBy: uid, updatedByName: name });
function saveBody(c: RulesTestContext, id: string, uid: string, name: string, body = '{"type":"doc","content":[]}') {
  const b = writeBatch(fs(c));
  b.set(doc(fs(c), `library/${id}/body/main`), { doc: body });
  b.update(doc(fs(c), `library/${id}`), stamp(uid, name));
  return b.commit();
}

console.log("만들기");
await check("학생은 자료를 못 만듦", () => assertFails(create(stu, "s1", meta("student", "학생"))));
await check("로그인 안 하면 못 만듦", () => assertFails(create(anon, "x1", meta("anon", "익명"))));
await check("강사가 자료 만들기 (나만 보기)", () => assertSucceeds(create(t1, "d1", meta("teacher1", "강사1"))));
await check("남의 이름(ownerId)으로 만들면 거부", () => assertFails(create(t1, "d2", meta("teacher2", "강사2"))));
await check("모르는 필드가 있으면 거부", () => assertFails(create(t1, "d3", meta("teacher1", "강사1", "private", { pinned: true }))));
await check("잘못된 공유 범위 거부", () => assertFails(create(t1, "d4", meta("teacher1", "강사1", "public"))));
await check("관리자도 자료 만들기 (모두에게 공유로 바로)", () => assertSucceeds(create(admin, "a1", meta("admin", "관리자", "all"))));
await check("강사2 자료 (선생과 공유)", () => assertSucceeds(create(t2, "t2doc", meta("teacher2", "강사2", "teachers"))));
await check("강사2 자료 하나 더 (선생과 공유)", () => assertSucceeds(create(t2, "t2doc2", meta("teacher2", "강사2", "teachers"))));
await check("강사1 초안 하나 더 (나만 보기, 끝까지 유지)", () => assertSucceeds(create(t1, "draft", meta("teacher1", "강사1"))));
await check("본문만 따로 남의 자료에 만들기 거부", () =>
  assertFails(setDoc(doc(fs(t2), "library/d1/body/extra"), { doc: "{}" })),
);

console.log("🔒 나만 보기");
await check("작성자는 읽기", () => assertSucceeds(getDoc(doc(fs(t1), "library/d1"))));
await check("작성자는 본문 읽기", () => assertSucceeds(getDoc(doc(fs(t1), "library/d1/body/main"))));
await check("다른 강사는 못 읽음", () => assertFails(getDoc(doc(fs(t2), "library/d1"))));
await check("관리자도 못 읽음", () => assertFails(getDoc(doc(fs(admin), "library/d1"))));
await check("학생은 못 읽음", () => assertFails(getDoc(doc(fs(stu), "library/d1/body/main"))));
await check("관리자도 남의 초안은 못 고침", () => assertFails(saveBody(admin, "d1", "admin", "관리자")));
await check("다른 강사도 남의 초안은 못 고침", () => assertFails(saveBody(t2, "d1", "teacher2", "강사2")));
await check("다른 강사도 남의 초안은 못 지움", () => assertFails(deleteDoc(doc(fs(t2), "library/draft"))));
await check("작성자가 본문 고치기", () => assertSucceeds(saveBody(t1, "d1", "teacher1", "강사1")));
await check("수정 시각 없이 본문만 고치면 거부", () => assertFails(setDoc(doc(fs(t1), "library/d1/body/main"), { doc: "{}" })));

console.log("👩‍🏫 선생과 공유");
await check("작성자가 선생과 공유로 바꾸기", () =>
  assertSucceeds(updateDoc(doc(fs(t1), "library/d1"), { visibility: "teachers", ...stamp("teacher1", "강사1") })),
);
await check("다른 강사는 읽기", () => assertSucceeds(getDoc(doc(fs(t2), "library/d1/body/main"))));
await check("관리자는 읽기", () => assertSucceeds(getDoc(doc(fs(admin), "library/d1"))));
await check("학생은 못 읽음", () => assertFails(getDoc(doc(fs(stu), "library/d1"))));
await check("다른 강사도 고치기 (강사 = 관리자)", () => assertSucceeds(saveBody(t2, "d1", "teacher2", "강사2")));
await check("다른 강사도 제목 고치기", () =>
  assertSucceeds(updateDoc(doc(fs(t2), "library/d1"), { title: "1회차 (수정)", ...stamp("teacher2", "강사2") })),
);
await check("다른 강사가 남의 자료를 나만 보기로 돌리면 거부", () =>
  assertFails(updateDoc(doc(fs(t2), "library/d1"), { visibility: "private", ...stamp("teacher2", "강사2") })),
);
await check("관리자는 고치기", () => assertSucceeds(saveBody(admin, "d1", "admin", "관리자")));
await check("관리자가 남의 자료를 나만 보기로 돌리면 거부", () =>
  assertFails(updateDoc(doc(fs(admin), "library/d1"), { visibility: "private", ...stamp("admin", "관리자") })),
);
await check("작성자 정보는 못 바꿈", () =>
  assertFails(updateDoc(doc(fs(admin), "library/d1"), { ownerId: "admin", ...stamp("admin", "관리자") })),
);

console.log("🌏 모두에게 공유");
await check("관리자가 모두에게 공유로 바꾸기", () =>
  assertSucceeds(updateDoc(doc(fs(admin), "library/d1"), { visibility: "all", ...stamp("admin", "관리자") })),
);
await check("학생은 읽기", () => assertSucceeds(getDoc(doc(fs(stu), "library/d1/body/main"))));
await check("학생은 못 고침", () => assertFails(saveBody(stu, "d1", "student", "학생")));
await check("학생은 못 지움", () => assertFails(deleteDoc(doc(fs(stu), "library/d1"))));
await check("로그인 안 하면 못 읽음", () => assertFails(getDoc(doc(fs(anon), "library/d1"))));

console.log("목록 질의 (화면과 같은 조건)");
await check("학생: 모두에게 공유만", async () => {
  const s = await assertSucceeds(getDocs(query(collection(fs(stu), "library"), where("visibility", "==", "all"))));
  if (s.size !== 2) throw new Error(`2개여야 하는데 ${s.size}개`);
});
await check("학생: 선생과 공유 질의는 거부", () =>
  assertFails(getDocs(query(collection(fs(stu), "library"), where("visibility", "==", "teachers")))),
);
await check("학생: 조건 없는 전체 질의는 거부", () => assertFails(getDocs(collection(fs(stu), "library"))));
await check("강사: 선생과 공유", () => assertSucceeds(getDocs(query(collection(fs(t1), "library"), where("visibility", "==", "teachers")))));
await check("강사: 내 자료 (초안 포함)", () => assertSucceeds(getDocs(query(collection(fs(t1), "library"), where("ownerId", "==", "teacher1")))));
await check("강사: 남의 자료 전부 질의는 거부", () =>
  assertFails(getDocs(query(collection(fs(t1), "library"), where("ownerId", "==", "teacher2")))),
);

console.log("역할 사본");
await check("본인 역할 읽기", () => assertSucceeds(getDoc(doc(fs(t1), "roles/teacher1"))));
await check("남의 역할 읽기 거부", () => assertFails(getDoc(doc(fs(t1), "roles/admin"))));
await check("스스로 강사 되기 거부", () => assertFails(setDoc(doc(fs(stu), "roles/student"), { role: "teacher" })));

console.log("이미지 (Storage)");
const png = new Uint8Array([137, 80, 78, 71]);
const st = (c: RulesTestContext) => c.storage();
await check("작성자가 이미지 올리기", () => assertSucceeds(uploadBytes(sref(st(t1), "library/d1/a.png"), png, { contentType: "image/png" })));
await check("관리자가 공유된 자료에 이미지 올리기", () =>
  assertSucceeds(uploadBytes(sref(st(admin), "library/d1/b.png"), png, { contentType: "image/png" })),
);
await check("다른 강사도 공유 자료에 올리기", () => assertSucceeds(uploadBytes(sref(st(t2), "library/d1/c.png"), png, { contentType: "image/png" })));
await check("남의 초안엔 못 올림", () => assertFails(uploadBytes(sref(st(t2), "library/draft/c.png"), png, { contentType: "image/png" })));
await check("내 초안엔 올리기", () => assertSucceeds(uploadBytes(sref(st(t1), "library/draft/a.png"), png, { contentType: "image/png" })));
await check("남의 초안 이미지는 못 지움", () => assertFails(deleteObject(sref(st(t2), "library/draft/a.png"))));
await check("학생은 못 올림", () => assertFails(uploadBytes(sref(st(stu), "library/d1/d.png"), png, { contentType: "image/png" })));
await check("이미지가 아닌 파일 거부", () =>
  assertFails(uploadBytes(sref(st(t1), "library/d1/e.exe"), png, { contentType: "application/octet-stream" })),
);
await check("없는 자료 폴더엔 못 올림", () => assertFails(uploadBytes(sref(st(t1), "library/nope/a.png"), png, { contentType: "image/png" })));
await check("다른 강사도 공유 자료 이미지 지우기", () => assertSucceeds(deleteObject(sref(st(t2), "library/d1/c.png"))));
await check("작성자는 이미지 지우기", () => assertSucceeds(deleteObject(sref(st(t1), "library/d1/a.png"))));

console.log("삭제");
await check("작성자가 본문 · 자료 지우기", () => {
  const b = writeBatch(fs(t1));
  b.delete(doc(fs(t1), "library/d1/body/main"));
  b.delete(doc(fs(t1), "library/d1"));
  return assertSucceeds(b.commit());
});
await check("관리자가 남의 공유 자료 지우기", () => assertSucceeds(deleteDoc(doc(fs(admin), "library/t2doc"))));
await check("다른 강사가 남의 공유 자료 지우기", () => assertSucceeds(deleteDoc(doc(fs(t1), "library/t2doc2"))));
await check("학생은 남의 공유 자료 못 지움", () => assertFails(deleteDoc(doc(fs(stu), "library/a1"))));

await env.cleanup();
console.log(`\n${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
