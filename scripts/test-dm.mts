/**
 * 비밀 대화 서버 검증: 두 참여자만 메시지를 받는지, 거절·취소·나가기가 동작하는지.
 * 실행: npm run test:dm  (실시간 서버가 켜져 있어야 함)
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/shared/protocol";

type C = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.REALTIME_URL ?? "http://localhost:3001";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString(36).slice(-4);

function client(name: string): Promise<{ s: C; id: string; log: string[] }> {
  return new Promise((resolve) => {
    const s: C = io(URL, { transports: ["websocket"], forceNew: true });
    const log: string[] = [];
    s.onAny((ev, data) => log.push(`${ev} ${JSON.stringify(data)}`));
    s.on("connect", () => s.emit("join", { id: `t-${name}-${tag}`, name: `${name}${tag}`, role: "student" }));
    s.on("init", ({ selfId }) => resolve({ s, id: selfId, log }));
  });
}

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) fails++;
};

const A = await client("가");
const B = await client("나");
const C = await client("다");

// 1) 거절
A.s.emit("dm:request", { to: B.id });
await sleep(200);
const reqId = B.log.find((l) => l.startsWith("dm:incoming"))?.match(/"requestId":"([^"]+)"/)?.[1];
check(!!reqId, "B가 신청을 받음");
check(!C.log.some((l) => l.startsWith("dm:incoming")), "C는 신청을 못 받음");
B.s.emit("dm:respond", { requestId: reqId!, accept: false });
await sleep(200);
check(
  A.log.some((l) => l.includes('"reason":"declined"')),
  "A가 거절 알림을 받음",
);

// 2) 취소
A.s.emit("dm:request", { to: B.id });
await sleep(200);
const req2 = A.log
  .filter((l) => l.startsWith("dm:requested"))
  .pop()
  ?.match(/"requestId":"([^"]+)"/)?.[1];
A.s.emit("dm:cancel", { requestId: req2! });
await sleep(200);
check(
  B.log.some((l) => l.includes('"reason":"cancelled"')),
  "B가 취소 알림을 받음",
);

// 3) 수락 → 대화 → 제3자 차단
A.s.emit("dm:request", { to: B.id });
await sleep(200);
const req3 = B.log
  .filter((l) => l.startsWith("dm:incoming"))
  .pop()
  ?.match(/"requestId":"([^"]+)"/)?.[1];
B.s.emit("dm:respond", { requestId: req3!, accept: true });
await sleep(200);
const sessionId = A.log.find((l) => l.startsWith("dm:started"))?.match(/"sessionId":"([^"]+)"/)?.[1];
check(!!sessionId && B.log.some((l) => l.startsWith("dm:started")), "두 사람 모두 대화 시작");
check(
  C.log.some((l) => l.startsWith("dm:locks") && l.includes(A.id) && l.includes(B.id)),
  "C는 🔒 표시용 쌍 정보만 받음",
);

const SECRET = `비밀-${tag}`;
A.s.emit("dm:send", { sessionId: sessionId!, text: SECRET });
// C가 세션 ID를 알아도 끼어들 수 없어야 함
C.s.emit("dm:send", { sessionId: sessionId!, text: "끼어들기" });
await sleep(300);
check(
  B.log.some((l) => l.startsWith("dm:message") && l.includes(SECRET)),
  "B가 비밀 메시지를 받음",
);
check(!C.log.some((l) => l.includes(SECRET)), "C는 비밀 메시지를 못 받음");
check(!A.log.some((l) => l.includes("끼어들기")) && !B.log.some((l) => l.includes("끼어들기")), "C의 끼어들기 메시지는 전달되지 않음");

// 4) C가 대화 중인 B에게 신청 → busy
C.s.emit("dm:request", { to: B.id });
await sleep(200);
check(
  C.log.some((l) => l.includes('"reason":"busy"')),
  "대화 중인 펭귄에게 신청하면 busy",
);

// 5) 나가기
A.s.emit("dm:leave", { sessionId: sessionId! });
await sleep(200);
check(
  B.log.some((l) => l.startsWith("dm:ended")),
  "A가 나가면 B에게 종료 알림",
);
check(
  C.log
    .filter((l) => l.startsWith("dm:locks"))
    .pop()
    ?.includes("[]") ?? false,
  "🔒 표시가 모두에게서 사라짐",
);

[A, B, C].forEach((c) => c.s.disconnect());
console.log(fails ? `\n${fails}개 실패` : "\n모두 통과");
process.exit(fails ? 1 : 0);
