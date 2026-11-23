/**
 * 개발용 봇 펭귄 — 혼자서도 여러 명이 있는 오피스를 확인할 수 있게 합니다.
 * - 자리에 앉아 공부하고, 가끔 말풍선으로 서로 @태그하며 대화해요.
 * - 사람이 입장하면 "선생아델리"가 @닉네임으로 인사해요 (멘션 알림 테스트용).
 * - 비밀 대화를 신청하면 봇이 자동으로 수락하고 짧게 답해요 ("쉬는중"은 거절 — 거절 흐름 테스트용).
 * 실행: npm run bots  (Ctrl+C로 종료하면 모두 퇴장)
 */
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, Role, ServerToClientEvents } from "../src/shared/protocol";
import { SEAT_BY_ID, SPAWN, isBlocked } from "../src/shared/officeMap";
import { findPath } from "../src/shared/pathfind";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const URL = process.env.REALTIME_URL ?? "http://localhost:3001";

const BOTS: { name: string; role: Role; seatId?: string }[] = [
  { name: "선생아델리", role: "teacher", seatId: "stand-1" },
  { name: "코딩펭귄", role: "student", seatId: "desk-2" },
  { name: "책벌레", role: "student", seatId: "desk-6" },
  { name: "새벽공부", role: "student", seatId: "desk-10" },
  { name: "라떼러버", role: "student", seatId: "cafe-1" },
  { name: "수다펭귄", role: "student", seatId: "cafe-2" },
  { name: "쉬는중", role: "student", seatId: "sofa-2" },
  { name: "산책러", role: "student" },
];
const BOT_IDS = new Set(BOTS.map((_, i) => `bot-${i}`));

const LINES: [from: string, text: string][] = [
  ["수다펭귄", "@라떼러버 이 문제 같이 풀어볼래?"],
  ["라떼러버", "@수다펭귄 좋아! 빙하 라떼 한 잔 하고 ☕"],
  ["선생아델리", "질문 있으면 언제든 @선생아델리 불러주세요 🎓"],
  ["코딩펭귄", "오늘 목표 절반 달성 ✏️"],
  ["쉬는중", "5분만 쉬고 다시 갈게요 🛋️"],
  ["수다펭귄", "@선생아델리 프롬프트 예시 하나만 더 보여주실 수 있나요?"],
];

const sockets = new Map<string, Client>();

BOTS.forEach((bot, i) => {
  const s: Client = io(URL, { transports: ["websocket"] });
  sockets.set(bot.name, s);
  s.on("connect", () => s.emit("join", { id: `bot-${i}`, name: bot.name, role: bot.role }));
  s.on("join:error", ({ message }) => console.warn(`[${bot.name}] ${message}`));
  s.on("init", () => {
    console.log(`🐧 ${bot.name} 입장`);
    if (bot.seatId && SEAT_BY_ID[bot.seatId]) setTimeout(() => s.emit("sit", { seatId: bot.seatId! }), 300 + i * 150);
    else wander(s);
  });
  // 비밀 대화: 자동 수락(쉬는중은 거절) + 짧은 답장
  s.on("dm:incoming", ({ requestId, from }) => {
    const accept = bot.name !== "쉬는중";
    setTimeout(() => s.emit("dm:respond", { requestId, accept }), 1200);
    if (accept) console.log(`🔒 ${bot.name} ← ${from.name} 비밀 대화 수락`);
  });
  let selfId = `bot-${i}`;
  s.on("init", ({ selfId: sid }) => (selfId = sid));
  s.on("dm:started", ({ sessionId, peer }) => {
    setTimeout(() => s.emit("dm:send", { sessionId, text: `${peer.name} 님 안녕하세요! 저는 ${bot.name}예요 🐧 무슨 이야기할까요?` }), 800);
  });
  s.on("dm:message", (m) => {
    if (m.from === selfId) return;
    setTimeout(() => s.emit("dm:send", { sessionId: m.sessionId, text: `"${m.text.slice(0, 20)}" 좋아요! 우리끼리 비밀이에요 🤫` }), 1000);
  });
  if (bot.role === "teacher") {
    s.on("player:joined", (p) => {
      if (!BOT_IDS.has(p.id)) setTimeout(() => s.emit("chat", { text: `@${p.name} 빙하 오피스에 온 걸 환영해요! 🐧` }), 1500);
    });
  }
});

// 가끔 대화
let line = 0;
setInterval(() => {
  const [from, text] = LINES[line++ % LINES.length];
  sockets.get(from)?.emit("chat", { text });
}, 7000);

/** 자리 없는 봇은 스탠딩석·카페 사이를 길찾기로 돌아다님 */
function wander(s: Client) {
  let x: number = SPAWN.x;
  let y: number = SPAWN.y;
  let route: { x: number; y: number }[] = [];
  setInterval(() => {
    if (!route.length) {
      let tx: number;
      let ty: number;
      do {
        tx = 840 + Math.random() * 560;
        ty = 360 + Math.random() * 480;
      } while (isBlocked(tx, ty));
      route = findPath({ x, y }, { x: tx, y: ty }) ?? [];
      if (!route.length) return;
    }
    const wp = route[0];
    const d = Math.hypot(wp.x - x, wp.y - y);
    const step = Math.min(d, 9);
    if (d > 0) {
      x += ((wp.x - x) / d) * step;
      y += ((wp.y - y) / d) * step;
    }
    if (d <= 9) route.shift();
    s.emit("move", { x: Math.round(x), y: Math.round(y), dir: wp.x < x ? -1 : 1, moving: route.length > 0 });
  }, 66);
}

process.on("SIGINT", () => {
  sockets.forEach((s) => s.disconnect());
  process.exit(0);
});
