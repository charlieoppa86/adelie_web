/**
 * test-account.mts 전용: 에뮬레이터에서 탈퇴 정리(purgeDue)를 한 번 돌리고 결과를 JSON 으로 출력
 * (관리자 SDK 와 클라이언트 SDK 를 한 프로세스에 함께 올리면 충돌해서 따로 실행)
 * 인자: 로그인 계정이 남아 있는지 확인할 uid 들
 */
process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= "127.0.0.1:9000";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp } = await import("../functions/node_modules/firebase-admin/lib/app/index.js");
const { getAuth } = await import("../functions/node_modules/firebase-admin/lib/auth/index.js");
const { getDatabaseWithUrl } = await import("../functions/node_modules/firebase-admin/lib/database/index.js");
const { purgeDue } = await import("../functions/account.js");

initializeApp({ projectId: "adelie-8e417" });
const root = getDatabaseWithUrl("https://adelie-8e417-default-rtdb.asia-southeast1.firebasedatabase.app").ref();
const auth = getAuth();
const done = await purgeDue(root, auth, Date.now());
const authExists = {};
for (const uid of process.argv.slice(2)) authExists[uid] = await auth.getUser(uid).then(() => true, () => false);
console.log(JSON.stringify({ done, authExists }));
process.exit(0);
