/* eslint-disable @typescript-eslint/no-explicit-any -- 테스트: 임의 이벤트 로그를 검사 */
/**
 * 신고 정책 검증: 신고자 1명이면 관리자 알림 없음 → 서로 다른 2명이면 알림·열람 →
 * 일반 펭귄은 퇴장 불가 → 관리자 퇴장 시 즉시 퇴장 + 재입장 차단.
 * 실행: npm run test:report  (실시간 서버가 켜져 있어야 함, ADMIN_NAMES 기본값 "운영자" 사용)
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/shared/protocol";

type C = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.REALTIME_URL ?? "http://localhost:3001";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tag = Date.now().toString(36).slice(-4);

interface Client {
  s: C;
  id: string;
  name: string;
  log: { ev: string; data: any }[];
}
function client(name: string, exact = false): Promise<Client> {
  return new Promise((resolve, reject) => {
    const s: C = io(URL, { transports: ["websocket"], forceNew: true, reconnection: false });
    const full = exact ? name : `${name}${tag}`;
    const log: Client["log"] = [];
    s.onAny((ev, data) => log.push({ ev, data }));
    s.on("connect", () => s.emit("join", { id: `t-${full}-${tag}`, name: full, role: "student" }));
    s.on("init", ({ selfId }) => resolve({ s, id: selfId, name: full, log }));
    s.on("join:error", ({ message }) => reject(new Error(message)));
  });
}
const last = (c: Client, ev: string) => [...c.log].reverse().find((l) => l.ev === ev)?.data;

async function chatAndReport(reporter: Client, target: Client, text: string, endChat = true) {
  reporter.s.emit("dm:request", { to: target.id });
  await sleep(150);
  target.s.emit("dm:respond", { requestId: last(target, "dm:incoming").requestId, accept: true });
  await sleep(150);
  const sessionId = last(reporter, "dm:started").sessionId;
  target.s.emit("dm:send", { sessionId, text });
  await sleep(150);
  reporter.s.emit("report", { sessionId, reason: "abuse", detail: "테스트 신고", endChat });
  await sleep(200);
  return sessionId;
}

let fails = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) fails++;
};

const admin = await client("운영자", true);
check(last(admin, "init").players.find((p: any) => p.id === admin.id)?.role === "admin", "ADMIN_NAMES 닉네임은 관리자 역할");
const bad = await client("문제");
const r1 = await client("신고A");
const r2 = await client("신고B");
const other = await client("일반");

// 신고자 1명
const s1 = await chatAndReport(r1, bad, `나쁜말1-${tag}`);
check(last(r1, "report:ack")?.ok === true, "1번째 신고 접수");
check(!admin.log.some((l) => l.ev === "admin:alert"), "신고자 1명 → 관리자 알림 없음");
check(!(last(admin, "admin:flags")?.flags ?? []).some((f: any) => f.targetName === bad.name), "신고자 1명 → 관리자 목록에 안 보임");
check(last(bad, "dm:ended") !== undefined, "endChat=true면 대화 종료");

// 같은 사람이 또 신고해도 1명으로 셈
await chatAndReport(r1, bad, `나쁜말2-${tag}`);
check(!admin.log.some((l) => l.ev === "admin:alert"), "같은 신고자가 다시 신고해도 알림 없음");

// 다른 신고자 → 기준 도달
await chatAndReport(r2, bad, `나쁜말3-${tag}`);
const alert = last(admin, "admin:alert");
check(alert?.targetName === bad.name && alert?.reporterCount === 2, "서로 다른 신고자 2명 → 관리자 알림");
const flag = (last(admin, "admin:flags")?.flags ?? []).find((f: any) => f.targetName === bad.name);
check(
  flag?.reports.length === 3 && flag.reports.some((r: any) => r.snapshot.some((m: any) => m.text === `나쁜말1-${tag}`)),
  "관리자는 신고된 대화 스냅샷을 볼 수 있음",
);
check(!other.log.some((l) => l.ev === "admin:flags" || l.ev === "admin:alert"), "일반 펭귄은 신고 정보를 못 받음");
check(
  !bad.log.some((l) => l.ev === "admin:alert" || (l.ev === "notice" && String(l.data?.message).includes("신고"))),
  "신고당한 펭귄에게는 알리지 않음",
);
check(r1.log.find((l) => l.ev === "dm:started")?.data.sessionId === s1, "세션 확인");

// 일반 펭귄은 퇴장 불가
other.s.emit("admin:kick", { targetKey: bad.name });
await sleep(200);
check(bad.s.connected, "일반 펭귄의 퇴장 요청은 무시");

// 관리자 퇴장
admin.s.emit("admin:kick", { targetKey: bad.name });
await sleep(400);
check(last(bad, "kicked") !== undefined, "퇴장 알림 받음");
check(!bad.s.connected, "즉시 연결 종료");
check(!(last(admin, "admin:flags")?.flags ?? []).some((f: any) => f.targetName === bad.name), "처리 후 목록에서 사라짐");
try {
  await client(bad.name, true).then((c) => c.s.disconnect());
  check(false, "재입장 차단");
} catch (e) {
  check(String(e).includes("퇴장"), "재입장 차단 (24시간)");
}

[admin, r1, r2, other].forEach((c) => c.s.disconnect());
console.log(fails ? `\n${fails}개 실패` : "\n모두 통과");
process.exit(fails ? 1 : 0);
