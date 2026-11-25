/**
 * 비밀 대화 (1:1, 신청 → 수락) — Realtime Database (dm/...)
 *
 *   dm/requests/{받는 uid}/{보낸 uid}  {at, answer?}   신청. 받는 사람만 목록을 봄. 30초 지나면 수락 불가(규칙)
 *   dm/sessions/{sid}                  {a, b, startedAt}  두 사람만 읽음
 *   dm/active/{uid}                    sid  — 한 번에 하나만 (잠금). 내용 없이 누가 대화 중인지만 보여 🔒 표시에 씀
 *   dm/messages/{sid}/{id}             {from, text, at}  두 사람만 읽고 씀
 *
 * 대화가 끝나면 sessions·active 를 지우고, 메시지는 Cloud Function 이 지웁니다(신고 스냅샷을 먼저 뜨기 위해).
 * 연결이 끊기면 onDisconnect 로 대화가 끝나고 보낸 신청도 지워집니다.
 */
import {
  get,
  onChildAdded,
  onChildRemoved,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Database,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { DM_MAX, DM_REQUEST_MS, type DmCloseReason, type DmMessage, type PeerInfo, type ReportReason } from "@/shared/protocol";

export interface DmEvents {
  requested: (requestId: string, to: PeerInfo, expiresAt: number) => void;
  incoming: (requestId: string, from: PeerInfo, expiresAt: number) => void;
  /** 신청이 끝남. mine = 내가 보낸 신청 */
  closed: (requestId: string, reason: DmCloseReason, peerName: string, mine: boolean) => void;
  started: (sessionId: string, peer: PeerInfo, startedAt: number) => void;
  message: (m: DmMessage) => void;
  /** mine = 내가 끝냄 */
  ended: (sessionId: string, byName: string, reason: "mine" | "left" | "disconnected") => void;
  locks: (pairs: [string, string][]) => void;
  notice: (message: string) => void;
}

export interface DmContext {
  /** 지금 스터디룸에 있는 펭귄 정보 */
  peer: (uid: string) => PeerInfo | null;
  serverNow: () => number;
}

export type ReportResult = "ok" | "duplicate" | "error";

export interface DmHandle {
  request: (to: string) => void;
  cancel: () => void;
  respond: (requestId: string, accept: boolean) => void;
  send: (text: string) => void;
  leave: () => void;
  report: (reason: ReportReason, detail: string, endChat: boolean) => Promise<ReportResult>;
  /** 스터디룸에서 누가 나감 → 그 펭귄과의 신청 정리 */
  peerLeft: (uid: string) => void;
  /** 스터디룸을 떠날 때 — 신청·대화를 모두 정리 */
  stop: () => Promise<void>;
}

const OUT = "out:";
const IN = "in:";
/** 비밀 대화 전송 제한: 5초에 6개 */
const SEND_WINDOW_MS = 5000;
const SEND_MAX = 6;

export function startDm(uid: string, ctx: DmContext, on: DmEvents, db: Database = rtdb()): DmHandle {
  const dmRef = ref(db, "dm");
  const unsubs: (() => void)[] = [];
  let stopped = false;

  let outgoing: { to: string; name: string; timer: ReturnType<typeof setTimeout>; unsub: () => void } | null = null;
  const incoming = new Map<string, { name: string; expiresAt: number; timer: ReturnType<typeof setTimeout> }>();
  let session: { sid: string; a: string; b: string; peer: PeerInfo; leaving: boolean; unsub: () => void } | null = null;
  let locks: Record<string, string> = {};
  const reported = new Set<string>();
  const sendTimes: number[] = [];

  const nameOf = async (id: string) =>
    ctx.peer(id)?.name ?? ((await get(ref(db, `users/${id}/name`)).catch(() => null))?.val() as string | undefined) ?? "펭귄";
  const reqRef = (to: string, from: string) => ref(db, `dm/requests/${to}/${from}`);

  /* ---------- 보낸 신청 ---------- */
  function finishOutgoing(reason: DmCloseReason | null) {
    const o = outgoing;
    if (!o) return;
    outgoing = null;
    clearTimeout(o.timer);
    o.unsub();
    const r = reqRef(o.to, uid);
    void onDisconnect(r).cancel().catch(() => {});
    void remove(r).catch(() => {});
    if (reason) on.closed(OUT + o.to, reason, o.name, true);
  }

  async function request(to: string) {
    const peer = ctx.peer(to);
    if (stopped || !peer || to === uid) return;
    if (session) return on.notice("이미 비밀 대화 중이에요. 지금 대화를 마친 뒤 신청해주세요.");
    if (outgoing) return on.notice(`${outgoing.name} 님의 답을 기다리는 중이에요.`);
    if (incoming.has(to)) return on.notice(`${peer.name} 님이 먼저 신청했어요. 받은 신청을 확인해주세요.`);
    if (locks[to]) return on.closed(OUT + to, "busy", peer.name, true);

    const r = reqRef(to, uid);
    try {
      await set(r, { at: serverTimestamp() });
    } catch {
      return on.notice("비밀 대화를 신청하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    void onDisconnect(r).remove();
    const timer = setTimeout(() => finishOutgoing("timeout"), DM_REQUEST_MS);
    let seen = false;
    const unsub = onValue(r, (snap) => {
      if (outgoing?.to !== to) return;
      const v = snap.val() as { answer?: "declined" | "busy" } | null;
      if (v) {
        seen = true;
        if (v.answer) finishOutgoing(v.answer);
        return;
      }
      if (!seen) return;
      // 지워짐: 수락됐으면 곧 대화가 시작되고, 아니면 상대가 나갔거나 만료
      setTimeout(() => {
        if (outgoing?.to !== to) return;
        finishOutgoing(ctx.peer(to) ? "timeout" : "offline");
      }, 400);
    });
    outgoing = { to, name: peer.name, timer, unsub };
    on.requested(OUT + to, peer, ctx.serverNow() + DM_REQUEST_MS);
  }

  /* ---------- 받은 신청 ---------- */
  function dropIncoming(from: string) {
    const i = incoming.get(from);
    if (i) clearTimeout(i.timer);
    incoming.delete(from);
    return i;
  }

  unsubs.push(
    onChildAdded(ref(db, `dm/requests/${uid}`), async (snap) => {
      const from = snap.key!;
      const v = snap.val() as { at: number; answer?: string };
      if (v.answer || incoming.has(from)) return;
      const expiresAt = v.at + DM_REQUEST_MS;
      if (ctx.serverNow() >= expiresAt) {
        void remove(snap.ref).catch(() => {});
        return;
      }
      if (session) {
        void update(snap.ref, { answer: "busy" }).catch(() => {});
        return;
      }
      const peer = ctx.peer(from) ?? { id: from, name: await nameOf(from), role: "student" as const };
      const timer = setTimeout(() => {
        if (!dropIncoming(from)) return;
        void remove(snap.ref).catch(() => {});
        on.closed(IN + from, "timeout", peer.name, false);
      }, expiresAt - ctx.serverNow());
      incoming.set(from, { name: peer.name, expiresAt, timer });
      on.incoming(IN + from, peer, expiresAt);
    }),
  );
  unsubs.push(
    onChildRemoved(ref(db, `dm/requests/${uid}`), (snap) => {
      const from = snap.key!;
      const i = dropIncoming(from);
      if (!i) return; // 내가 수락·거절해서 지운 것
      const reason: DmCloseReason = ctx.serverNow() >= i.expiresAt - 1000 ? "timeout" : ctx.peer(from) ? "cancelled" : "offline";
      on.closed(IN + from, reason, i.name, false);
    }),
  );

  async function respond(requestId: string, accept: boolean) {
    const from = requestId.slice(IN.length);
    const i = dropIncoming(from);
    if (!i || stopped) return;
    const r = reqRef(uid, from);
    if (!accept) {
      void update(r, { answer: "declined" }).catch(() => {});
      on.closed(requestId, "declined", i.name, false);
      return;
    }
    if (session) {
      void update(r, { answer: "busy" }).catch(() => {});
      return on.notice("이미 비밀 대화 중이에요.");
    }
    const sid = push(ref(db, "dm/sessions")).key!;
    try {
      await update(dmRef, {
        [`sessions/${sid}`]: { a: from, b: uid, startedAt: serverTimestamp() },
        [`active/${from}`]: sid,
        [`active/${uid}`]: sid,
        [`requests/${uid}/${from}`]: null,
      });
    } catch {
      // 상대가 그새 다른 대화를 시작했거나 신청이 만료됨
      void update(r, { answer: "busy" }).catch(() => {});
      on.closed(requestId, "busy", i.name, true);
    }
  }

  /* ---------- 대화 ---------- */
  async function startSession(sid: string) {
    const s = (await get(ref(db, `dm/sessions/${sid}`))).val() as { a: string; b: string; startedAt: number } | null;
    if (!s || stopped || session) return;
    const peerId = s.a === uid ? s.b : s.a;
    const peer = ctx.peer(peerId) ?? { id: peerId, name: await nameOf(peerId), role: "student" as const };
    const unsub = onChildAdded(ref(db, `dm/messages/${sid}`), (m) => {
      const v = m.val() as { from: string; text: string; at: number };
      on.message({ id: m.key!, sessionId: sid, from: v.from, text: v.text, at: v.at });
    });
    session = { sid, a: s.a, b: s.b, peer, leaving: false, unsub };
    void onDisconnect(dmRef).update({ [`sessions/${sid}`]: null, [`active/${s.a}`]: null, [`active/${s.b}`]: null });

    // 대화가 시작되면 걸려 있던 신청은 모두 정리
    if (outgoing) finishOutgoing(outgoing.to === peerId ? null : "cancelled");
    for (const [from, i] of [...incoming]) {
      dropIncoming(from);
      void update(reqRef(uid, from), { answer: "busy" }).catch(() => {});
      on.closed(IN + from, "busy", i.name, false);
    }
    on.started(sid, peer, s.startedAt);
  }

  function endSession() {
    const s = session;
    if (!s) return;
    session = null;
    s.unsub();
    // dm 아래 onDisconnect 를 한꺼번에 취소하므로, 보낸 신청이 있으면 다시 걸어 둠
    void onDisconnect(dmRef)
      .cancel()
      .then(() => outgoing && onDisconnect(reqRef(outgoing.to, uid)).remove())
      .catch(() => {});
    if (s.leaving) return on.ended(s.sid, s.peer.name, "mine");
    // 상대의 연결이 끊긴 경우 스터디룸에서도 곧 빠지므로 잠깐 기다렸다 판단
    setTimeout(() => on.ended(s.sid, s.peer.name, ctx.peer(s.peer.id) ? "left" : "disconnected"), 400);
  }

  unsubs.push(
    onValue(ref(db, "dm/active"), (snap) => {
      locks = (snap.val() ?? {}) as Record<string, string>;
      const bySid = new Map<string, string[]>();
      for (const [id, sid] of Object.entries(locks)) bySid.set(sid, [...(bySid.get(sid) ?? []), id]);
      on.locks([...bySid.values()].filter((p) => p.length === 2).map((p) => [p[0], p[1]] as [string, string]));

      const mine = locks[uid] ?? null;
      if (mine && !session) void startSession(mine);
      else if (session && mine !== session.sid) endSession();
    }),
  );

  function leave() {
    if (!session) return;
    session.leaving = true;
    const { sid, a, b } = session;
    void update(dmRef, { [`sessions/${sid}`]: null, [`active/${a}`]: null, [`active/${b}`]: null }).catch(() => {});
  }

  return {
    request: (to) => void request(to),
    cancel: () => finishOutgoing("cancelled"),
    respond: (requestId, accept) => void respond(requestId, accept),

    send(raw) {
      if (!session) return;
      const text = raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, DM_MAX);
      if (!text) return;
      const t = Date.now();
      while (sendTimes.length && t - sendTimes[0] > SEND_WINDOW_MS) sendTimes.shift();
      if (sendTimes.length >= SEND_MAX) return on.notice("조금 천천히 말해주세요 🐧");
      sendTimes.push(t);
      void push(ref(db, `dm/messages/${session.sid}`), { from: uid, text, at: serverTimestamp() }).catch(() =>
        on.notice("메시지를 보내지 못했어요."),
      );
    },

    leave,

    async report(reason, detail, endChat) {
      if (!session) return "error";
      const { sid, peer } = session;
      if (reported.has(sid)) return "duplicate";
      try {
        await set(ref(db, `reports/pending/${sid}_${uid}`), {
          sid,
          reporter: uid,
          target: peer.id,
          reason,
          detail: detail.trim().slice(0, 300),
          at: serverTimestamp(),
        });
      } catch {
        return session?.sid === sid ? "duplicate" : "error";
      }
      reported.add(sid);
      if (endChat) leave();
      return "ok";
    },

    peerLeft(id) {
      if (outgoing?.to === id) finishOutgoing("offline");
      const i = dropIncoming(id);
      if (i) on.closed(IN + id, "offline", i.name, false);
    },

    async stop() {
      if (stopped) return;
      finishOutgoing(null);
      for (const [from] of [...incoming]) {
        dropIncoming(from);
        void remove(reqRef(uid, from)).catch(() => {});
      }
      if (session) {
        leave();
        session.unsub();
        session = null;
      }
      stopped = true;
      unsubs.splice(0).forEach((u) => u());
      await onDisconnect(dmRef).cancel().catch(() => {});
    },
  };
}
