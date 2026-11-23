/**
 * 아델리 빙하 오피스 — 실시간 서버 (로컬 개발용, 메모리 저장)
 * 접속·위치·자리·출석 상태를 관리하고 브로드캐스트합니다.
 * 실행: npm run dev (Next와 함께) 또는 npm run realtime
 */
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import {
  CHAT_MAX,
  DM_MAX,
  DM_REQUEST_MS,
  type DmCloseReason,
  type DmMessage,
  type PeerInfo,
  MENTION_RE,
  NICKNAME_RE,
  type ClientToServerEvents,
  type PlayerState,
  type Role,
  type ServerToClientEvents,
} from "../src/shared/protocol";
import { SEAT_BY_ID, SPAWN, STUDY_SEAT_KINDS, WORLD } from "../src/shared/officeMap";
import { REPORT_REASONS } from "../src/shared/protocol";
import * as moderation from "./moderation";

const PORT = Number(process.env.REALTIME_PORT ?? 3001);
const ALLOWED_ORIGINS = (process.env.REALTIME_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000").split(",");

type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { playerId?: string }>;

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("adelie realtime ok");
});
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { playerId?: string }>(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
});

/** 현재 접속 중인 펭귄 */
const players = new Map<string, PlayerState>();
const socketOf = new Map<string, string>(); // playerId → socket.id

/**
 * 오늘의 출석 기록 (닉네임 기준). 나갔다 다시 들어와도 첫 입장 시각과 공부 시간이 이어집니다.
 * TODO(DB 단계): 사용자 ID 기준으로 DB에 저장
 */
const attendance = new Map<string, { day: string; enteredAt: number; studyMs: number }>();
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

const ROLES: Role[] = ["student", "teacher"];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* ---------- 비밀 대화 ---------- */
interface DmRequest {
  id: string;
  from: string;
  to: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
}
interface DmSession {
  id: string;
  a: string;
  b: string;
  startedAt: number;
  /**
   * 신고 시 스냅샷용으로 서버 메모리에만 보관 (최근 200개). 대화가 끝나면 지워집니다.
   * 이 내용은 두 참여자 외 누구에게도 전송하지 않습니다. 신고되면 그 시점의 스냅샷만 moderation 기록에 남습니다.
   */
  messages: DmMessage[];
}
const dmRequests = new Map<string, DmRequest>();
const dmSessions = new Map<string, DmSession>();
const sessionOf = new Map<string, string>(); // playerId → sessionId

function emitTo<E extends keyof ServerToClientEvents>(playerId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>) {
  const sid = socketOf.get(playerId);
  if (sid) io.to(sid).emit(event, ...args);
}
const peerInfo = (id: string): PeerInfo | null => {
  const p = players.get(id);
  return p ? { id: p.id, name: p.name, role: p.role } : null;
};
const nameOf = (id: string) => players.get(id)?.name ?? "펭귄";

function broadcastLocks() {
  io.emit("dm:locks", { pairs: [...dmSessions.values()].map((s) => [s.a, s.b] as [string, string]) });
}

function closeRequest(req: DmRequest, reason: DmCloseReason, notify: "both" | "from" | "to" = "both") {
  clearTimeout(req.timer);
  dmRequests.delete(req.id);
  if (notify !== "to") emitTo(req.from, "dm:closed", { requestId: req.id, reason, peerName: nameOf(req.to) });
  if (notify !== "from") emitTo(req.to, "dm:closed", { requestId: req.id, reason, peerName: nameOf(req.from) });
}

function endSession(sessionId: string, byId: string, reason: "left" | "disconnected") {
  const s = dmSessions.get(sessionId);
  if (!s) return;
  dmSessions.delete(sessionId);
  sessionOf.delete(s.a);
  sessionOf.delete(s.b);
  for (const pid of [s.a, s.b]) emitTo(pid, "dm:ended", { sessionId, byName: nameOf(byId), reason });
  broadcastLocks();
}

/* ---------- 관리자 알림 ---------- */
const isOnline = (key: string) => [...players.values()].some((p) => moderation.keyOf(p.name) === key);
function emitAdmins<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) {
  for (const p of players.values()) if (p.role === "admin") emitTo(p.id, event, ...args);
}
const pushFlags = () => emitAdmins("admin:flags", { flags: moderation.flags(isOnline) });

function stopStudy(p: PlayerState, now: number) {
  if (p.studySince) {
    p.studyMs += now - p.studySince;
    p.studySince = null;
  }
}

function saveAttendance(p: PlayerState, now: number) {
  const rec = attendance.get(p.name.toLowerCase());
  if (rec) rec.studyMs = p.studyMs + (p.studySince ? now - p.studySince : 0);
}

function leaveSeat(p: PlayerState, now: number) {
  if (!p.seatId) return false;
  stopStudy(p, now);
  p.seatId = null;
  return true;
}

io.on("connection", (socket: IoSocket) => {
  socket.on("join", (data) => {
    if (socket.data.playerId) return;
    const id = String(data?.id ?? "").slice(0, 64);
    const name = String(data?.name ?? "").trim();
    const role: Role = ROLES.includes(data?.role) ? data.role : "student";
    if (!id || !NICKNAME_RE.test(name)) {
      socket.emit("join:error", { message: "닉네임은 한글·영문·숫자·_ 2~12자로 정해주세요." });
      return;
    }

    // 같은 탭이 새로고침된 경우: 이전 연결을 정리
    const prevSocketId = socketOf.get(id);
    if (prevSocketId && prevSocketId !== socket.id) io.sockets.sockets.get(prevSocketId)?.disconnect(true);

    const banned = moderation.banUntil(name);
    if (banned) {
      const t = new Date(banned).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      socket.emit("join:error", { message: `운영 정책에 따라 퇴장된 펭귄이에요. ${t} 이후에 다시 들어올 수 있어요.` });
      return;
    }

    const dup = [...players.values()].find((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase());
    if (dup) {
      socket.emit("join:error", { message: `'${name}' 펭귄이 이미 오피스에 있어요. 다른 닉네임을 써주세요.` });
      return;
    }

    const now = Date.now();
    const key = name.toLowerCase();
    let rec = attendance.get(key);
    if (!rec || rec.day !== today()) {
      rec = { day: today(), enteredAt: now, studyMs: 0 };
      attendance.set(key, rec);
    }

    const player: PlayerState = {
      id,
      name,
      // 관리자는 서버 설정(ADMIN_NAMES)으로만 정해짐 — 로그인 단계에서 계정 기준으로 교체
      role: moderation.ADMIN_NAMES.has(moderation.keyOf(name)) ? "admin" : role,
      x: SPAWN.x + Math.round((Math.random() - 0.5) * 120),
      y: SPAWN.y,
      dir: 1,
      moving: false,
      seatId: null,
      enteredAt: rec.enteredAt,
      studyMs: rec.studyMs,
      studySince: null,
    };
    players.set(id, player);
    socketOf.set(id, socket.id);
    socket.data.playerId = id;

    socket.emit("init", { selfId: id, players: [...players.values()], serverNow: now });
    socket.emit("dm:locks", { pairs: [...dmSessions.values()].map((s) => [s.a, s.b] as [string, string]) });
    socket.broadcast.emit("player:joined", player);
    console.log(`[join] ${name} (${player.role}) — 접속 ${players.size}명`);
    pushFlags();
  });

  const me = () => (socket.data.playerId ? players.get(socket.data.playerId) : undefined);

  socket.on("move", (m) => {
    const p = me();
    if (!p || !isNum(m?.x) || !isNum(m?.y)) return;
    p.x = clamp(m.x, 0, WORLD.w);
    p.y = clamp(m.y, 0, WORLD.h);
    p.dir = m.dir === -1 ? -1 : 1;
    p.moving = Boolean(m.moving);
    socket.broadcast.volatile.emit("player:moved", { id: p.id, x: p.x, y: p.y, dir: p.dir, moving: p.moving });
  });

  socket.on("sit", (data) => {
    const p = me();
    const seat = typeof data?.seatId === "string" && Object.hasOwn(SEAT_BY_ID, data.seatId) ? SEAT_BY_ID[data.seatId] : undefined;
    if (!p || !seat) return;
    const taken = [...players.values()].find((o) => o.seatId === seat.id && o.id !== p.id);
    if (taken) {
      socket.emit("notice", { message: `${taken.name} 펭귄이 먼저 앉았어요.` });
      return;
    }
    const now = Date.now();
    leaveSeat(p, now);
    p.seatId = seat.id;
    p.x = seat.x;
    p.y = seat.y;
    p.moving = false;
    if (STUDY_SEAT_KINDS.includes(seat.kind)) p.studySince = now;
    io.emit("player:updated", p);
  });

  socket.on("stand", () => {
    const p = me();
    if (!p) return;
    const now = Date.now();
    if (leaveSeat(p, now)) {
      saveAttendance(p, now);
      io.emit("player:updated", p);
    }
  });

  socket.on("emote", (data) => {
    const p = me();
    if (p && data?.emote === "jump") io.emit("player:emote", { id: p.id, emote: "jump" });
  });

  /* 말풍선 대화: 5초에 5개까지 */
  const chatTimes: number[] = [];
  socket.on("chat", (data) => {
    const p = me();
    if (!p || typeof data?.text !== "string") return;
    const text = data.text
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, CHAT_MAX);
    if (!text) return;
    const now = Date.now();
    while (chatTimes.length && now - chatTimes[0] > 5000) chatTimes.shift();
    if (chatTimes.length >= 5) {
      socket.emit("notice", { message: "말이 너무 빨라요 🐧 잠시 후 다시 말해주세요." });
      return;
    }
    chatTimes.push(now);

    // @닉네임 → 지금 접속 중인 펭귄만 태그로 인정
    const byName = new Map([...players.values()].map((o) => [o.name.toLowerCase(), o]));
    const mentions = new Map<string, { id: string; name: string }>();
    for (const m of text.matchAll(MENTION_RE)) {
      const target = byName.get(m[1].toLowerCase());
      if (target && target.id !== p.id) mentions.set(target.id, { id: target.id, name: target.name });
    }
    io.emit("chat", { id: randomUUID(), playerId: p.id, name: p.name, text, mentions: [...mentions.values()], at: now });
  });

  /* ---------- 비밀 대화 ---------- */
  socket.on("dm:request", (data) => {
    const p = me();
    const target = typeof data?.to === "string" ? players.get(data.to) : undefined;
    if (!p || !target || target.id === p.id) return;
    if (sessionOf.has(p.id)) return void socket.emit("notice", { message: "이미 비밀 대화 중이에요. 지금 대화를 마친 뒤 신청해주세요." });
    const mine = [...dmRequests.values()].find((r) => r.from === p.id);
    if (mine) return void socket.emit("notice", { message: `${nameOf(mine.to)} 님의 답을 기다리는 중이에요.` });
    if ([...dmRequests.values()].some((r) => r.from === target.id && r.to === p.id))
      return void socket.emit("notice", { message: `${target.name} 님이 먼저 신청했어요. 받은 신청을 확인해주세요.` });

    const id = randomUUID();
    const expiresAt = Date.now() + DM_REQUEST_MS;
    if (sessionOf.has(target.id)) {
      socket.emit("dm:closed", { requestId: id, reason: "busy", peerName: target.name });
      return;
    }
    const req: DmRequest = {
      id,
      from: p.id,
      to: target.id,
      expiresAt,
      timer: setTimeout(() => dmRequests.has(id) && closeRequest(req, "timeout"), DM_REQUEST_MS),
    };
    dmRequests.set(id, req);
    socket.emit("dm:requested", { requestId: id, to: peerInfo(target.id)!, expiresAt });
    emitTo(target.id, "dm:incoming", { requestId: id, from: peerInfo(p.id)!, expiresAt });
  });

  socket.on("dm:cancel", (data) => {
    const p = me();
    const req = typeof data?.requestId === "string" ? dmRequests.get(data.requestId) : undefined;
    if (p && req && req.from === p.id) closeRequest(req, "cancelled");
  });

  socket.on("dm:respond", (data) => {
    const p = me();
    const req = typeof data?.requestId === "string" ? dmRequests.get(data.requestId) : undefined;
    if (!p || !req || req.to !== p.id) return;
    if (!data.accept) return closeRequest(req, "declined");
    if (sessionOf.has(req.from) || sessionOf.has(req.to) || !players.has(req.from)) return closeRequest(req, "busy");

    clearTimeout(req.timer);
    dmRequests.delete(req.id);
    // 두 펭귄이 걸어둔 다른 신청은 정리
    for (const other of [...dmRequests.values()])
      if ([req.from, req.to].includes(other.from) || [req.from, req.to].includes(other.to)) closeRequest(other, "busy");

    const session: DmSession = { id: randomUUID(), a: req.from, b: req.to, startedAt: Date.now(), messages: [] };
    dmSessions.set(session.id, session);
    sessionOf.set(session.a, session.id);
    sessionOf.set(session.b, session.id);
    emitTo(session.a, "dm:started", { sessionId: session.id, peer: peerInfo(session.b)!, startedAt: session.startedAt });
    emitTo(session.b, "dm:started", { sessionId: session.id, peer: peerInfo(session.a)!, startedAt: session.startedAt });
    broadcastLocks();
  });

  const dmTimes: number[] = [];
  socket.on("dm:send", (data) => {
    const p = me();
    const session = typeof data?.sessionId === "string" ? dmSessions.get(data.sessionId) : undefined;
    if (!p || !session || (session.a !== p.id && session.b !== p.id) || typeof data.text !== "string") return;
    const text = data.text
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, DM_MAX);
    if (!text) return;
    const now = Date.now();
    while (dmTimes.length && now - dmTimes[0] > 5000) dmTimes.shift();
    if (dmTimes.length >= 6) return void socket.emit("notice", { message: "조금 천천히 말해주세요 🐧" });
    dmTimes.push(now);
    const msg: DmMessage = { id: randomUUID(), sessionId: session.id, from: p.id, text, at: now };
    session.messages.push(msg);
    if (session.messages.length > 200) session.messages.shift();
    // 두 참여자에게만 전달
    emitTo(session.a, "dm:message", msg);
    emitTo(session.b, "dm:message", msg);
  });

  socket.on("dm:leave", (data) => {
    const p = me();
    if (p && typeof data?.sessionId === "string" && sessionOf.get(p.id) === data.sessionId) endSession(data.sessionId, p.id, "left");
  });

  /* ---------- 신고 · 관리자 조치 ---------- */
  socket.on("report", (data) => {
    const p = me();
    const session = typeof data?.sessionId === "string" ? dmSessions.get(data.sessionId) : undefined;
    if (!p || !session || (session.a !== p.id && session.b !== p.id)) {
      socket.emit("report:ack", { ok: false, message: "진행 중인 비밀 대화에서만 신고할 수 있어요." });
      return;
    }
    const targetId = session.a === p.id ? session.b : session.a;
    const targetName = nameOf(targetId);
    if (moderation.alreadyReported(session.id, p.name)) {
      socket.emit("report:ack", { ok: false, message: "이 대화는 이미 신고했어요." });
      return;
    }
    const reason = Object.hasOwn(REPORT_REASONS, data.reason) ? data.reason : "other";
    const { crossed, reporterCount } = moderation.addReport({
      reporterName: p.name,
      targetName,
      sessionId: session.id,
      reason,
      detail: typeof data.detail === "string" ? data.detail.trim().slice(0, 300) : "",
      snapshot: session.messages.map((m) => ({ from: nameOf(m.from), text: m.text, at: m.at })),
    });
    console.log(`[report] ${p.name} → ${targetName} (${reason}) · 신고자 ${reporterCount}명`);
    socket.emit("report:ack", { ok: true, message: "신고가 접수됐어요. 운영진이 확인할게요." });
    if (crossed) emitAdmins("admin:alert", { targetName, reporterCount });
    pushFlags();
    if (data.endChat) endSession(session.id, p.id, "left");
  });

  socket.on("admin:kick", (data) => {
    const p = me();
    if (p?.role !== "admin" || typeof data?.targetKey !== "string") return;
    const key = moderation.keyOf(data.targetKey);
    const until = moderation.kick(key);
    const target = [...players.values()].find((o) => moderation.keyOf(o.name) === key);
    if (target) {
      emitTo(target.id, "kicked", { message: "신고가 누적돼 운영진이 오피스에서 퇴장시켰어요.", until });
      const sid = socketOf.get(target.id);
      setTimeout(() => sid && io.sockets.sockets.get(sid)?.disconnect(true), 150);
    }
    console.log(`[kick] ${p.name} → ${data.targetKey}`);
    socket.emit("notice", { message: `${target?.name ?? data.targetKey} 펭귄을 퇴장시켰어요 (24시간 재입장 제한)` });
    pushFlags();
  });

  socket.on("admin:dismiss", (data) => {
    const p = me();
    if (p?.role !== "admin" || typeof data?.targetKey !== "string") return;
    moderation.dismiss(moderation.keyOf(data.targetKey));
    socket.emit("notice", { message: "문제없음으로 처리했어요." });
    pushFlags();
  });

  socket.on("disconnect", () => {
    const id = socket.data.playerId;
    if (!id || socketOf.get(id) !== socket.id) return;
    for (const r of [...dmRequests.values()]) if (r.from === id || r.to === id) closeRequest(r, "offline", r.from === id ? "to" : "from");
    const sessionId = sessionOf.get(id);
    if (sessionId) endSession(sessionId, id, "disconnected");
    const p = players.get(id);
    if (p) {
      const now = Date.now();
      leaveSeat(p, now);
      attendance.set(p.name.toLowerCase(), { day: today(), enteredAt: p.enteredAt, studyMs: p.studyMs });
      console.log(`[leave] ${p.name} — 접속 ${players.size - 1}명`);
    }
    players.delete(id);
    socketOf.delete(id);
    io.emit("player:left", { id });
    pushFlags();
  });
});

httpServer.listen(PORT, () => {
  console.log(`🐧 adelie realtime listening on http://localhost:${PORT}`);
});
