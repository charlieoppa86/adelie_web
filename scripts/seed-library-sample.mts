/**
 * 📚 자료실 샘플 자료를 로컬 에뮬레이터에 넣기 (npm run dev 가 켜져 있어야 함)
 * 실행: npm run seed:library [-- --visibility all|teachers|private]
 * 작성자는 에뮬레이터의 강사 · 관리자 중 첫 번째 (없으면 안내 후 종료). 운영 DB에는 쓰지 않음.
 */
import { SAMPLE } from "./samples/ai-app-fullstack.mjs";

const PROJECT = "adelie-8e417";
const RTDB = `http://127.0.0.1:9000/users.json?ns=${PROJECT}-default-rtdb`;
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const visibility = arg("visibility") ?? "all";
if (!["all", "teachers", "private"].includes(visibility)) throw new Error(`잘못된 공유 범위: ${visibility}`);

const users = (await (await fetch(RTDB, { headers: OWNER }).catch(() => {
  throw new Error("에뮬레이터에 연결하지 못했어요. npm run dev 를 먼저 켜 주세요.");
})).json()) as Record<string, { name: string; role: string }> | null;
const staff = Object.entries(users ?? {}).find(([, u]) => u.role === "teacher" || u.role === "admin");
if (!staff) {
  console.log("에뮬레이터에 강사 · 관리자 계정이 없어요. 로그인한 뒤 users/{uid}/role 을 admin 으로 바꾸고 다시 실행해 주세요.");
  process.exit(1);
}
const [uid, owner] = staff;

const now = new Date().toISOString();
const str = (v: string) => ({ stringValue: v });
const id = `sample-${Date.now().toString(36)}`;
const meta = {
  title: str(SAMPLE.title),
  icon: str(SAMPLE.icon),
  visibility: str(visibility),
  ownerId: str(uid),
  ownerName: str(owner.name),
  createdAt: { timestampValue: now },
  updatedAt: { timestampValue: now },
  updatedBy: str(uid),
  updatedByName: str(owner.name),
};
const body = { doc: str(JSON.stringify(SAMPLE.doc)) };

for (const [path, fields] of [
  [`library/${id}`, meta],
  [`library/${id}/body/main`, body],
] as const) {
  const r = await fetch(`${FS}/${path}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${path} 쓰기 실패: ${r.status} ${await r.text()}`);
}
console.log(`✓ '${SAMPLE.title}' 추가 (작성자 ${owner.name}, ${visibility}, ${body.doc.stringValue.length.toLocaleString()}자)`);
console.log(`  http://localhost:3000/library#${id}`);
