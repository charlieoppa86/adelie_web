/**
 * 스터디룸 접속·위치·자리·점프 — Realtime Database (rooms/main/...)
 *
 *   players/{uid}  이름·역할·자리·공부 시간 (자주 안 바뀜)
 *   pos/{uid}      위치 {x, y, d, m} — 초당 몇 번씩 바뀌므로 따로 둬서 전송량을 줄임
 *   seats/{seatId} 앉은 사람 uid — 비어 있을 때만 차지할 수 있음(규칙)
 *   emotes/{uid}   마지막 점프 시각
 *   bubbles/{uid}  마지막 말풍선 {id, text, at} — 한 펭귄당 한 칸만 써서 대화 기록이 쌓이지 않음 (1초에 1개, 규칙)
 *   attendance/{YYYY-MM-DD}/{uid}  오늘 입장 시각·공부 시간 (다시 들어와도 이어짐)
 *
 * 창을 닫거나 연결이 끊기면 onDisconnect 로 players·pos·emotes·bubbles·seats 가 자동으로 지워집니다.
 */
import {
  get,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type Database,
  type DatabaseReference,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { AccountProfile } from "@/lib/account";
import { SEAT_BY_ID, SPAWN, STUDY_SEAT_KINDS } from "@/shared/officeMap";
import { BUBBLE_MS, normalizeChat, type MovePayload, type PlayerState } from "@/shared/protocol";

const ROOM = "rooms/main";
/** 공부 중일 때 출석 기록에 공부 시간을 저장하는 간격 (창이 갑자기 닫혀도 최대 이만큼만 잃음) */
const FLUSH_MS = 60_000;
/** 이보다 오래된 점프 기록은 무시 (입장할 때 예전 점프가 다시 재생되지 않게) */
const EMOTE_FRESH_MS = 3_000;
/** 말풍선 간격 (규칙과 같은 값) */
export const CHAT_GAP_MS = 1_000;

export interface RoomBubble {
  id: string;
  playerId: string;
  text: string;
  at: number;
}
export type SayResult = "ok" | "empty" | "tooFast" | "error";

export interface RoomEvents {
  /** 입장 완료 (재연결 시에도 다시 불림) */
  ready: (selfId: string) => void;
  connection: (online: boolean) => void;
  serverOffset: (ms: number) => void;
  /** 펭귄 입장·정보 변경 (위치 포함 전체 상태) */
  player: (p: PlayerState, joined: boolean) => void;
  left: (id: string) => void;
  moved: (id: string, m: MovePayload) => void;
  emote: (id: string) => void;
  /** 누군가 말함 (내 말 포함) */
  bubble: (b: RoomBubble) => void;
  /** 같은 계정이 다른 탭(기기)에서 입장해 이 탭은 빠짐 */
  replaced: () => void;
}

export interface RoomHandle {
  move: (m: MovePayload) => void;
  /** 성공하면 true, 이미 누가 앉았으면 false */
  sit: (seatId: string, dir: 1 | -1) => Promise<boolean>;
  stand: () => void;
  jump: () => void;
  say: (text: string) => Promise<SayResult>;
  leave: () => Promise<void>;
}

const seoulDay = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

interface Meta {
  name: string;
  role: PlayerState["role"];
  conn: string;
  seatId?: string;
  enteredAt: number;
  studyMs: number;
  studySince?: number;
}
interface Pos {
  x: number;
  y: number;
  d: 1 | -1;
  m: boolean;
}

/** db 는 테스트에서 사용자별 연결을 넘길 때만 지정합니다. */
export function joinRoom(uid: string, profile: AccountProfile, on: RoomEvents, db: Database = rtdb()): RoomHandle {
  const r = (path: string) => ref(db, `${ROOM}/${path}`);
  const conn = crypto.randomUUID();
  const playerRef = r(`players/${uid}`);
  const posRef = r(`pos/${uid}`);
  const emoteRef = r(`emotes/${uid}`);
  const bubbleRef = r(`bubbles/${uid}`);
  /** 내가 자동으로 지우는 노드들 (연결 끊김·다른 탭 이어받기·퇴장 때 함께 처리) */
  const ownRefs = [playerRef, posRef, emoteRef, bubbleRef];
  let lastSaid = 0;
  /** 역할은 관리자가, 닉네임은 본인이 바꿀 수 있어 따로 들고 있음 */
  let role = profile.role;
  let name = profile.name;

  let offset = 0;
  const now = () => Date.now() + offset;
  let stopped = false;
  let entered = false;
  let seatRef: DatabaseReference | null = null;
  /** 내 상태 (서버에서 돌아온 값 기준) */
  let mine: Meta | null = null;
  let myPos: Pos = { x: SPAWN.x + Math.round((Math.random() - 0.5) * 120), y: SPAWN.y, d: 1, m: false };

  const metas = new Map<string, Meta>();
  const poses = new Map<string, Pos>();
  const merge = (id: string, m: Meta): PlayerState => {
    const p = poses.get(id) ?? { x: SPAWN.x, y: SPAWN.y, d: 1, m: false };
    return {
      id,
      name: m.name,
      role: m.role,
      x: p.x,
      y: p.y,
      dir: p.d,
      moving: p.m,
      seatId: m.seatId ?? null,
      enteredAt: m.enteredAt,
      studyMs: m.studyMs,
      studySince: m.studySince ?? null,
    };
  };

  const unsubs: (() => void)[] = [];

  unsubs.push(
    onValue(ref(db, ".info/serverTimeOffset"), (s) => {
      offset = Number(s.val()) || 0;
      on.serverOffset(offset);
    }),
  );

  /** 연결될 때마다(처음·재연결) 내 펭귄을 다시 올립니다. 끊기면 서버가 onDisconnect 로 지웠기 때문. */
  async function enter() {
    await Promise.all(ownRefs.map((x) => onDisconnect(x).remove()));
    const t = now();
    const attRef = ref(db, `attendance/${seoulDay(t)}/${uid}`);
    let enteredAt = t;
    let studyMs = 0;
    if (mine) {
      // 재연결: 끊긴 사이 자리는 풀렸으므로 공부 시간만 이어 받음
      studyMs = mine.studyMs + (mine.studySince ? Math.max(0, t - mine.studySince) : 0);
      enteredAt = mine.enteredAt;
    } else {
      const att = (await get(attRef)).val() as { enteredAt: number; studyMs: number } | null;
      if (att) ({ enteredAt, studyMs } = att);
    }
    if (stopped) return;
    seatRef = null;
    // 예전 탭(같은 계정)이 앉아 있던 자리가 남아 있으면 비움 — 새로 들어온 펭귄은 서 있는 상태로 시작
    const seats = ((await get(r("seats"))).val() ?? {}) as Record<string, string>;
    const stale = Object.keys(seats).filter((k) => seats[k] === uid);
    if (stale.length) await update(ref(db, ROOM), Object.fromEntries(stale.map((k) => [`seats/${k}`, null])));
    await set(attRef, { enteredAt, studyMs });
    myPos = { ...myPos, m: false };
    await set(posRef, myPos);
    await set(playerRef, { name, role, conn, enteredAt, studyMs } satisfies Meta);
    if (stopped) return;
    entered = true;
    on.ready(uid);
  }

  /* 관리자가 역할(강사·학생)을 바꾸면 내 펭귄에도 반영 (규칙: 펭귄 역할 = 프로필 역할) */
  unsubs.push(
    onValue(ref(db, `users/${uid}/role`), (s) => {
      const next = s.val() as PlayerState["role"] | null;
      if (!next || next === role) return;
      role = next;
      if (entered && !stopped) set(r(`players/${uid}/role`), role).catch(() => {});
    }),
  );

  /* 닉네임을 바꾸면(이 탭이든 다른 탭이든) 내 이름표도 바꿈 (규칙: 펭귄 이름 = 프로필 이름) */
  unsubs.push(
    onValue(ref(db, `users/${uid}/name`), (s) => {
      const next = s.val() as string | null;
      if (!next || next === name) return;
      name = next;
      if (entered && !stopped) set(r(`players/${uid}/name`), name).catch(() => {});
    }),
  );

  /* 연결 상태 */
  unsubs.push(
    onValue(ref(db, ".info/connected"), (s) => {
      const online = s.val() === true;
      on.connection(online);
      if (online && !stopped) {
        enter().catch((e) => console.error("[room] 입장 실패", e));
      }
    }),
  );

  /* 펭귄 목록 */
  const onMeta = (id: string, m: Meta, added: boolean) => {
    if (id === uid) {
      if (m.conn !== conn) {
        if (entered) replacedByOtherTab();
        return;
      }
      mine = m;
    }
    const isNew = !metas.has(id);
    metas.set(id, m);
    on.player(merge(id, m), added && isNew);
  };
  unsubs.push(onChildAdded(r("players"), (s) => onMeta(s.key!, s.val(), true)));
  unsubs.push(onChildChanged(r("players"), (s) => onMeta(s.key!, s.val(), false)));
  unsubs.push(
    onChildRemoved(r("players"), (s) => {
      const id = s.key!;
      if (!metas.delete(id)) return;
      poses.delete(id);
      on.left(id);
    }),
  );

  /* 위치 */
  const onPos = (id: string, p: Pos) => {
    poses.set(id, p);
    if (id !== uid && metas.has(id)) on.moved(id, { x: p.x, y: p.y, dir: p.d, moving: p.m });
  };
  unsubs.push(onChildAdded(r("pos"), (s) => onPos(s.key!, s.val())));
  unsubs.push(onChildChanged(r("pos"), (s) => onPos(s.key!, s.val())));

  /* 점프 */
  const onEmote = (id: string, at: unknown) => {
    if (typeof at === "number" && now() - at < EMOTE_FRESH_MS) on.emote(id);
  };
  unsubs.push(onChildAdded(r("emotes"), (s) => onEmote(s.key!, s.val())));
  unsubs.push(onChildChanged(r("emotes"), (s) => onEmote(s.key!, s.val())));

  /* 말풍선 (입장 전에 이미 사라졌어야 할 오래된 말은 무시) */
  const onBubble = (id: string, v: { id?: unknown; text?: unknown; at?: unknown } | null) => {
    if (!v || typeof v.text !== "string" || typeof v.at !== "number" || typeof v.id !== "string") return;
    if (now() - v.at > BUBBLE_MS) return;
    on.bubble({ id: v.id, playerId: id, text: v.text, at: v.at });
  };
  unsubs.push(onChildAdded(r("bubbles"), (s) => onBubble(s.key!, s.val())));
  unsubs.push(onChildChanged(r("bubbles"), (s) => onBubble(s.key!, s.val())));

  /* 공부 중이면 1분마다 출석 기록에 공부 시간 저장 */
  const flushTimer = setInterval(() => {
    if (!stopped && mine?.studySince) saveAttendance(mine.studyMs + Math.max(0, now() - mine.studySince));
  }, FLUSH_MS);

  function saveAttendance(studyMs: number) {
    if (!mine) return;
    set(ref(db, `attendance/${seoulDay(now())}/${uid}`), { enteredAt: mine.enteredAt, studyMs }).catch(() => {});
  }

  /** 자리에서 일어날 때 바뀌는 값 (공부 시간 정산 포함) */
  function standPatch(): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    if (!mine?.seatId) return patch;
    patch[`seats/${mine.seatId}`] = null;
    patch[`players/${uid}/seatId`] = null;
    if (mine.studySince) {
      const studyMs = mine.studyMs + Math.max(0, now() - mine.studySince);
      patch[`players/${uid}/studyMs`] = studyMs;
      patch[`players/${uid}/studySince`] = null;
      saveAttendance(studyMs);
    }
    return patch;
  }

  function stopListening() {
    stopped = true;
    clearInterval(flushTimer);
    unsubs.splice(0).forEach((u) => u());
  }

  function replacedByOtherTab() {
    // 다른 탭이 내 자리를 이어받음: 이 탭의 onDisconnect 가 그 탭의 펭귄을 지우지 않게 취소
    stopListening();
    void Promise.all(ownRefs.map((x) => onDisconnect(x).cancel()));
    if (seatRef) void onDisconnect(seatRef).cancel();
    on.replaced();
  }

  return {
    move(m) {
      if (stopped || !entered) return;
      myPos = { x: m.x, y: m.y, d: m.dir, m: m.moving };
      set(posRef, myPos).catch(() => {});
    },

    async sit(seatId, dir) {
      const seat = SEAT_BY_ID[seatId];
      if (stopped || !entered || !seat || !mine) return false;
      if (mine.seatId === seatId) return true;
      const prevSeatRef = seatRef;
      const patch = standPatch();
      const study = STUDY_SEAT_KINDS.includes(seat.kind);
      myPos = { x: seat.x, y: seat.y, d: dir, m: false };
      Object.assign(patch, {
        [`seats/${seatId}`]: uid,
        [`players/${uid}/seatId`]: seatId,
        [`players/${uid}/studySince`]: study ? serverTimestamp() : null,
        [`pos/${uid}`]: myPos,
      });
      try {
        await update(ref(db, ROOM), patch);
      } catch {
        return false; // 누가 먼저 앉음 (규칙: 빈 자리만 차지 가능)
      }
      seatRef = r(`seats/${seatId}`);
      await onDisconnect(seatRef).remove();
      if (prevSeatRef) void onDisconnect(prevSeatRef).cancel();
      return true;
    },

    stand() {
      if (stopped || !mine?.seatId) return;
      const prevSeatRef = seatRef;
      seatRef = null;
      update(ref(db, ROOM), standPatch()).catch((e) => console.error("[room] 일어나기 실패", e));
      if (prevSeatRef) void onDisconnect(prevSeatRef).cancel();
    },

    jump() {
      if (!stopped && entered) set(emoteRef, serverTimestamp()).catch(() => {});
    },

    async say(raw) {
      const text = normalizeChat(raw);
      if (!text) return "empty";
      if (stopped || !entered) return "error";
      const t = Date.now();
      if (t - lastSaid < CHAT_GAP_MS) return "tooFast";
      lastSaid = t;
      try {
        await set(bubbleRef, { id: crypto.randomUUID(), text, at: serverTimestamp() });
        return "ok";
      } catch {
        return "tooFast"; // 규칙의 1초 간격에 걸림 (시계 차이 등)
      }
    },

    async leave() {
      if (stopped) return;
      standPatch(); // 공부 시간 정산·출석 저장 (펭귄 노드는 통째로 지우므로 패치는 자리만 씀)
      const hadSeat = seatRef;
      const seatId = mine?.seatId;
      stopListening();
      try {
        await update(ref(db, ROOM), {
          ...(seatId ? { [`seats/${seatId}`]: null } : {}),
          [`players/${uid}`]: null,
          [`pos/${uid}`]: null,
          [`emotes/${uid}`]: null,
          [`bubbles/${uid}`]: null,
        });
      } catch {
        await Promise.all(ownRefs.map((x) => remove(x))).catch(() => {});
      }
      await Promise.all(ownRefs.map((x) => onDisconnect(x).cancel())).catch(() => {});
      if (hadSeat) await onDisconnect(hadSeat).cancel().catch(() => {});
    },
  };
}
