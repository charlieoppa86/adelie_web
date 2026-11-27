"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { watchAccount } from "@/lib/account";
import { convertToReplay, endBroadcast, extendBroadcast, startBroadcast, watchBroadcast, type Broadcast } from "@/lib/broadcast";
import { LANDING_URL } from "@/lib/links";
import { startDm, type DmHandle } from "@/lib/dm";
import { dismiss, kick, setRole, watchBan, watchFlags, type FlaggedTarget } from "@/lib/moderation";
import { joinRoom, type RoomHandle } from "@/lib/room";
import { CAMP_OFFSET, CAMP_VIEW, LANDSCAPE, SEATS, WORLD, isBlocked } from "@/shared/officeMap";
import { findPath } from "@/shared/pathfind";
import {
  BUBBLE_MS,
  findMentions,
  studyMsNow,
  type ModerationFlag,
  type PlayerState,
} from "@/shared/protocol";
import { AdminPanel } from "./AdminPanel";
import { AttendancePanel } from "./AttendancePanel";
import { Avatar, LABEL_Z, type AvatarPart, type Bubble } from "./Avatar";
import { Composer, type ComposerHandle } from "./Composer";
import { Landscape } from "./Landscape";
import { CreateLectureDialog, EndLectureDialog, LecturePlayer, LectureScreen, formatEndsAt, openLectureWindow } from "./LectureScreen";
import { MapFloor, MapProps } from "./MapArt";
import { IncomingRequestCard, OutgoingRequestCard, SecretChatPanel } from "./SecretChat";
import { useSecretChat } from "./useSecretChat";
import { WeatherBanner, WeatherChip, WeatherLayer, useHourlyWeather } from "./Weather";
import { formatClock, formatDuration, presenceOf, ROLE_LABEL } from "./presence";

type Pt = { x: number; y: number };

const SEAT_LABEL = { desk: "집중 개인석", standing: "스탠딩석", cafe: "카페석", sofa: "카페 소파" } as const;

const SPEED = 210; // px/s
/** 위치 전송 간격 — 전송량이 접속자 수의 제곱으로 늘어 비용에 직결되므로 초당 5번으로 제한 */
const SEND_EVERY = 200; // ms (5Hz)
/** 다른 펭귄 보간 속도 — 전송 간격이 길어진 만큼 부드럽게 따라가도록 낮춤 */
const LERP_RATE = 6;
/**
 * 이보다 작게는 줄이지 않음. 모니터 절반 크기 창(1366×768 노트북 화면을 위아래로 나눈 창까지)에서도
 * 강의장 전체가 들어오도록 낮게 둠 — 펭귄 이름표 · 말풍선은 배율 반대로 커져서 읽힘 (--ui)
 * 이보다 더 작은 창이면 카메라가 내 펭귄을 따라감
 */
const MIN_SCALE = 0.25;
const MAX_SCALE = 1.8;

/** e.code 기준 — 한글 입력 상태에서도 WASD가 동작 */
const KEY_DIR: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function Office() {
  const router = useRouter();
  const [conn, setConn] = useState<"connecting" | "ready" | "offline">("connecting");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerState>>({});
  const [jumping, setJumping] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  /** 지금 머리 위에 떠 있는 말풍선 (펭귄 ID → 마지막 말) */
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const composerRef = useRef<ComposerHandle>(null);
  /** 관리자: 확인이 필요한 신고 */
  const [flagged, setFlagged] = useState<FlaggedTarget[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [kicked, setKicked] = useState<{ message: string; until: number } | null>(null);
  /** 스터디 LIVE 강의 (한 번에 하나) */
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  /** 내가 방금 끝낸 강의 — 시청자용 "강의가 끝났어요" 알림을 띄우지 않으려고 */
  const selfEndedRef = useRef(false);
  const dmRef = useRef<DmHandle | null>(null);
  const roomRef = useRef<RoomHandle | null>(null);
  const playersRef = useRef(players);
  const selfIdRef = useRef<string | null>(null);
  /** 렌더 위치: 내 펭귄은 로컬 입력, 다른 펭귄은 서버 위치(t)를 향해 보간 */
  const pos = useRef(new Map<string, { x: number; y: number; tx: number; ty: number }>());
  const els = useRef(new Map<string, { body?: HTMLDivElement; label?: HTMLDivElement }>());
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cam = useRef({ s: 1, ox: 0, oy: 0, vw: 0, vh: 0 });
  const keys = useRef(new Set<string>());
  const path = useRef<{ points: Pt[]; seatId?: string } | null>(null);
  /** 배경 드래그로 옮긴 화면 위치 (기본 카메라 위치에서 얼마나 옮겼는지, 화면 px) */
  const pan = useRef({ x: 0, y: 0 });
  /** 진행 중인 배경 드래그. moved 가 false 로 끝나면 클릭(그 자리로 걸어가기)으로 처리 */
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const [panned, setPanned] = useState(false);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const offsetRef = useRef(0);
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);
  const dm = useSecretChat(dmRef, showToast, serverNow);
  const dmEvents = dm.events;

  /** 정시에 날씨가 바뀌면 모든 펭귄이 깜짝 점프 */
  const jumpAll = useCallback(() => {
    setJumping(Object.fromEntries(Object.keys(playersRef.current).map((id) => [id, true])));
    window.setTimeout(() => setJumping({}), 800);
  }, []);
  const { weather, preview: previewWeather } = useHourlyWeather(clockOffset, jumpAll);

  const upsert = useCallback((p: PlayerState) => {
    const cur = pos.current.get(p.id);
    if (!cur) pos.current.set(p.id, { x: p.x, y: p.y, tx: p.x, ty: p.y });
    else if (p.id === selfIdRef.current) {
      // 서버가 자리에 앉힌 경우에만 내 위치를 맞춤
      if (p.seatId) Object.assign(cur, { x: p.x, y: p.y, tx: p.x, ty: p.y });
    } else Object.assign(cur, { tx: p.x, ty: p.y });
    setPlayers((prev) => {
      const next = { ...prev, [p.id]: p };
      if (p.id === selfIdRef.current && prev[p.id]) {
        // 내 움직임 표시(방향·걷기)는 로컬 값을 유지
        next[p.id] = { ...p, dir: prev[p.id].dir, moving: prev[p.id].moving };
      }
      return next;
    });
  }, []);

  /* ---------- 입장: 로그인 확인 → 스터디룸(접속·위치·자리·말풍선) + 비밀 대화 + 퇴장 확인 (모두 Realtime Database) ---------- */
  useEffect(() => {
    let room: RoomHandle | null = null;
    let dm: DmHandle | null = null;
    const unsubs: (() => void)[] = [];

    const start = (uid: string, profile: { name: string; role: PlayerState["role"] }) => {
      room = joinRoom(uid, profile, {
        ready: (id) => {
          selfIdRef.current = id;
          setSelfId(id);
          setConn("ready");
        },
        connection: (online) => setConn((c) => (online ? (c === "offline" ? "connecting" : c) : "offline")),
        serverOffset: (ms) => {
          offsetRef.current = ms;
          setClockOffset(ms);
        },
        player: (p, joined) => {
          upsert(p);
          if (joined && p.id !== selfIdRef.current)
            showToast(`${p.role === "teacher" ? "🎓 강사" : "🐧 학생"} 아델리 ${p.name} 님이 입장했어요`);
        },
        moved: (pid, { x, y, dir, moving }) => {
          const cur = pos.current.get(pid);
          if (cur) Object.assign(cur, { tx: x, ty: y });
          const prev = playersRef.current[pid];
          if (prev && (prev.dir !== dir || prev.moving !== moving))
            setPlayers((ps) => (ps[pid] ? { ...ps, [pid]: { ...ps[pid], dir, moving, x, y } } : ps));
        },
        left: (pid) => {
          dm?.peerLeft(pid);
          pos.current.delete(pid);
          setPlayers((ps) => {
            const { [pid]: gone, ...rest } = ps;
            if (gone) showToast(`${gone.name} 님이 퇴장했어요`);
            return rest;
          });
          setSelectedId((s) => (s === pid ? null : s));
        },
        emote: (pid) => {
          setJumping((j) => ({ ...j, [pid]: true }));
          window.setTimeout(() => setJumping((j) => ({ ...j, [pid]: false })), 800);
        },
        bubble: ({ id: msgId, playerId, text, at }) => {
          const sender = playersRef.current[playerId];
          if (!sender) return;
          const msg = { id: msgId, playerId, name: sender.name, text, at, mentions: findMentions(text, Object.values(playersRef.current), playerId) };
          const self = selfIdRef.current;
          const mentionsMe = !!self && playerId !== self && msg.mentions.some((m) => m.id === self);
          setBubbles((b) => (b[playerId]?.msg.id === msgId ? b : { ...b, [playerId]: { msg, mentionsMe } }));
          window.setTimeout(() => {
            setBubbles((b) => {
              if (b[playerId]?.msg.id !== msgId) return b;
              const rest = { ...b };
              delete rest[playerId];
              return rest;
            });
          }, BUBBLE_MS);
          if (mentionsMe && self) {
            showToast(`📣 ${msg.name} 님이 나를 불렀어요`);
            setJumping((j) => ({ ...j, [self]: true }));
            window.setTimeout(() => setJumping((j) => ({ ...j, [self]: false })), 800);
          }
        },
        replaced: () => {
          setJoinError("다른 탭이나 기기에서 스터디룸에 들어가서 이 화면은 빠졌어요.");
          void dm?.stop();
        },
      });
      roomRef.current = room;

      dm = startDm(
        uid,
        {
          peer: (id) => {
            const p = playersRef.current[id];
            return p ? { id: p.id, name: p.name, role: p.role } : null;
          },
          serverNow,
        },
        dmEvents,
      );
      dmRef.current = dm;

      // 관리자가 퇴장시키면 바로 나감 (규칙상 기간 동안 다시 못 들어옴)
      unsubs.push(
        watchBan(uid, (until) => {
          if (!until || until <= serverNow()) return;
          setKicked({ message: "신고가 누적돼 운영진이 스터디룸에서 퇴장시켰어요.", until });
          void dm?.stop();
          void room?.leave();
        }),
      );
      // 스터디 LIVE: 시작 · 다시보기 전환 · 종료(직접 · 예약 시각) 알림, 끝나면 플레이어 닫기
      let prev: Broadcast | null | undefined; // undefined = 아직 첫 값 전
      unsubs.push(
        watchBroadcast((b) => {
          setBroadcast(b);
          if (!b) {
            setPlayerOpen(false);
            setEndOpen(false);
          }
          if (prev !== undefined) {
            if (b && (!prev || b.startedAt !== prev.startedAt)) {
              if (b.hostUid !== uid)
                showToast(
                  b.mode === "live"
                    ? `🔴 ${b.hostName} 님이 LIVE를 시작했어요 — 스터디 LIVE에서 "LIVE 중"을 눌러 보세요`
                    : `🍿 ${b.hostName} 님이 영상을 올렸어요 — 스터디 LIVE에서 "뭐 보지?"를 눌러 보세요`,
                );
            } else if (b && prev && prev.mode === "live" && b.mode === "vod") {
              showToast("▶ LIVE가 끝나고 다시보기로 바뀌었어요 — \"뭐 보지?\"로 볼 수 있어요");
            } else if (!b && prev) {
              if (selfEndedRef.current) selfEndedRef.current = false;
              else showToast("📺 스터디 LIVE 강의가 끝났어요");
            }
          }
          prev = b;
        }, serverNow),
      );
      // 관리자만 읽을 수 있음 (아니면 빈 목록)
      if (profile.role === "admin")
        unsubs.push(
          watchFlags({
            flags: setFlagged,
            alert: (targetName, reporterCount) =>
              showToast(`🚨 ${targetName} 펭귄이 ${reporterCount}명에게 신고됐어요 — 확인이 필요해요`),
          }),
        );
    };

    const stopWatching = watchAccount((a) => {
      if (a.status === "signedOut" || a.status === "needsProfile") router.replace("/");
      else if (a.status === "ready" && !room) start(a.user.uid, a.profile);
    });

    return () => {
      stopWatching();
      unsubs.forEach((u) => u());
      void dm?.stop();
      dmRef.current = null;
      void room?.leave();
      roomRef.current = null;
    };
  }, [router, upsert, showToast, dmEvents, serverNow]);

  /* ---------- 스터디 LIVE: 자동 종료 10분 전 관리자에게 알림 ---------- */
  const endsAt = broadcast?.endsAt;
  const amAdmin = selfId ? players[selfId]?.role === "admin" : false;
  useEffect(() => {
    if (!endsAt || !amAdmin) return;
    const wait = endsAt - 10 * 60 * 1000 - serverNow();
    if (wait <= 0) return;
    const t = window.setTimeout(() => showToast("⏱ 스터디 LIVE가 10분 뒤 자동 종료돼요 — 스크린의 +30분으로 연장할 수 있어요"), wait);
    return () => window.clearTimeout(t);
  }, [endsAt, amAdmin, serverNow, showToast]);

  /* ---------- 키보드 ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (KEY_DIR[e.code]) {
        keys.current.add(e.code);
        e.preventDefault();
      } else if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) roomRef.current?.jump();
      } else if (e.key === "Enter") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === "Escape") setSelectedId(null);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  /* ---------- 화면 크기 → 카메라 배율 ---------- */
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => {
      const vw = vp.clientWidth;
      const vh = vp.clientHeight;
      // 강의장(CAMP_VIEW) 전체가 화면에 한눈에 들어오는 배율(contain). 남는 곳엔 주변 남극 풍경이 보임
      const fit = Math.min(vw / (CAMP_VIEW.x2 - CAMP_VIEW.x1), vh / (CAMP_VIEW.y2 - CAMP_VIEW.y1));
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
      Object.assign(cam.current, { vw, vh, s });
      // 멀리서 봐도 이름표 · 말풍선 글씨가 읽히도록 화면 배율의 반대로 키움
      worldRef.current?.style.setProperty("--ui", String(Math.min(2.4, Math.max(1, 0.85 / s))));
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [conn]);

  /* ---------- 게임 루프: 이동 · 보간 · 카메라 ---------- */
  useEffect(() => {
    if (!selfId) return;
    let raf = 0;
    let last = performance.now();
    let lastSent = 0;
    let sentMoving = false;
    let standing = false;

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const me = pos.current.get(selfId);
      const meState = playersRef.current[selfId];

      if (me && meState) {
        let vx = 0;
        let vy = 0;
        keys.current.forEach((k) => {
          const d = KEY_DIR[k];
          if (d) {
            vx += d[0];
            vy += d[1];
          }
        });
        if (vx || vy) path.current = null;
        else if (path.current) {
          const wp = path.current.points[0];
          const dx = wp.x - me.x;
          const dy = wp.y - me.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 4) {
            me.x = wp.x;
            me.y = wp.y;
            path.current.points.shift();
            if (!path.current.points.length) {
              const seatId = path.current.seatId;
              path.current = null;
              if (seatId) {
                const room = roomRef.current;
                room?.sit(seatId, meState.dir).then((ok) => {
                  if (ok) return;
                  const who = Object.values(playersRef.current).find((o) => o.seatId === seatId && o.id !== selfId);
                  showToast(who ? `${who.name} 펭귄이 먼저 앉았어요.` : "앉지 못했어요. 다시 시도해 주세요.");
                });
              }
            }
          } else {
            vx = dx / dist;
            vy = dy / dist;
          }
        }

        const len = Math.hypot(vx, vy);
        let moved = false;
        if (len > 0) {
          if (meState.seatId && !standing) {
            standing = true;
            roomRef.current?.stand();
          }
          const step = (SPEED * dt) / len;
          const nx = me.x + vx * step;
          const ny = me.y + vy * step;
          // 자리에서 일어나는 순간(테이블 바로 뒤 등)에도 빠져나올 수 있게, 막힌 곳 → 막힌 곳 이동은 허용 안 함
          if (!isBlocked(nx, me.y) || isBlocked(me.x, me.y)) {
            me.x = nx;
            moved = true;
          }
          if (!isBlocked(me.x, ny) || isBlocked(me.x, me.y)) {
            me.y = ny;
            moved = true;
          }
          if (!moved) path.current = null;
          me.tx = me.x;
          me.ty = me.y;
        }
        if (!meState.seatId) standing = false;

        const dir: 1 | -1 = vx < -0.01 ? -1 : vx > 0.01 ? 1 : meState.dir;
        if (dir !== meState.dir || moved !== meState.moving) {
          setPlayers((ps) => (ps[selfId] ? { ...ps, [selfId]: { ...ps[selfId], dir, moving: moved } } : ps));
          playersRef.current = { ...playersRef.current, [selfId]: { ...meState, dir, moving: moved } };
        }
        if ((moved && t - lastSent > SEND_EVERY) || moved !== sentMoving) {
          lastSent = t;
          sentMoving = moved;
          roomRef.current?.move({ x: Math.round(me.x), y: Math.round(me.y), dir, moving: moved });
        }
      }

      // 다른 펭귄 보간 + DOM 반영
      const k = Math.min(1, dt * LERP_RATE);
      pos.current.forEach((p, id) => {
        if (id !== selfId) {
          p.x += (p.tx - p.x) * k;
          p.y += (p.ty - p.y) * k;
        }
        const el = els.current.get(id);
        if (el) {
          const tf = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
          const z = Math.round(p.y);
          if (el.body) {
            el.body.style.transform = tf;
            el.body.style.zIndex = String(z);
          }
          if (el.label) {
            el.label.style.transform = tf;
            el.label.style.zIndex = String(LABEL_Z + z);
          }
        }
      });

      // 카메라: 강의장이 화면에 다 들어가면 강의장 가운데에 고정, 아주 작은 창이라 넘치면 내 펭귄을 따라감
      //        그다음 풍경 밖(빈 곳)이 보이지 않게 풍경 안으로 맞춤 — 강의장은 풍경 안에 있어 계속 다 보임
      const c = cam.current;
      const world = worldRef.current;
      if (world && me && c.vw) {
        // 배경 드래그로 옮긴 만큼(pan)을 더한 뒤 풍경 안으로 맞춤. 풍경 끝에 닿으면 더 끌려도 pan 이 늘지 않게 되돌림
        const axis = (view: number, a: number, b: number, mine: number, land: number, k: "x" | "y") => {
          const base =
            (b - a) * c.s <= view
              ? view / 2 - ((a + b) / 2) * c.s
              : Math.min(-a * c.s, Math.max(view - b * c.s, view / 2 - mine * c.s));
          const L = land * c.s;
          const o = L <= view ? (view - L) / 2 : Math.min(0, Math.max(view - L, base + pan.current[k]));
          if (L > view) pan.current[k] = o - base;
          return o;
        };
        const ox = axis(c.vw, CAMP_VIEW.x1, CAMP_VIEW.x2, me.x + CAMP_OFFSET.x, LANDSCAPE.w, "x");
        const oy = axis(c.vh, CAMP_VIEW.y1, CAMP_VIEW.y2, me.y + CAMP_OFFSET.y, LANDSCAPE.h, "y");
        // 끄는 동안은 손을 바로 따라오게, 그 밖에는 부드럽게
        const follow = drag.current?.moved ? 1 : Math.min(1, dt * 8);
        c.ox += (ox - c.ox) * follow;
        c.oy += (oy - c.oy) * follow;
        world.style.transform = `translate3d(${c.ox.toFixed(1)}px, ${c.oy.toFixed(1)}px, 0) scale(${c.s})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selfId, showToast]);

  /* ---------- 클릭 이동 ---------- */
  const toWorld = (clientX: number, clientY: number): Pt | null => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const r = vp.getBoundingClientRect();
    const c = cam.current;
    // 화면 → 풍경 좌표 → 공부 캠프 좌표
    return { x: (clientX - r.left - c.ox) / c.s - CAMP_OFFSET.x, y: (clientY - r.top - c.oy) / c.s - CAMP_OFFSET.y };
  };

  const walkTo = (target: Pt, seatId?: string) => {
    const me = selfId ? pos.current.get(selfId) : undefined;
    if (!me) return;
    const points = findPath(me, target);
    if (!points) {
      showToast("거기로는 갈 수 없어요 🧊");
      return;
    }
    path.current = { points, seatId };
  };

  const setEl = useCallback((id: string, part: AvatarPart, el: HTMLDivElement | null) => {
    const entry = els.current.get(id) ?? {};
    if (el) entry[part] = el;
    else delete entry[part];
    if (entry.body || entry.label) els.current.set(id, entry);
    else els.current.delete(id);
  }, []);

  const list = useMemo(() => Object.values(players), [players]);
  const occupied = useMemo(() => new Map(list.filter((p) => p.seatId).map((p) => [p.seatId!, p])), [list]);
  const me = selfId ? players[selfId] : undefined;
  /** 지금 떠 있는 말풍선에서 @로 불린 펭귄들 */
  const calledIds = useMemo(() => new Set(Object.values(bubbles).flatMap((b) => b.msg.mentions.map((m) => m.id))), [bubbles]);
  const sendChat = useCallback(
    (text: string) => {
      void roomRef.current?.say(text).then((r) => {
        if (r === "tooFast") showToast("말이 너무 빨라요 🐧 잠시 후 다시 말해주세요.");
        else if (r === "error") showToast("말을 보내지 못했어요. 연결을 확인해 주세요.");
      });
    },
    [showToast],
  );
  const selected = selectedId ? players[selectedId] : undefined;
  const isAdmin = me?.role === "admin";
  const watchLecture = () => {
    if (!broadcast) return;
    if (broadcast.kind === "youtube") setPlayerOpen(true);
    else openLectureWindow(broadcast.url);
  };
  const endLecture = () => {
    selfEndedRef.current = true;
    endBroadcast()
      .then(() => {
        setEndOpen(false);
        showToast("강의를 끝냈어요. 줌 회의 · OBS 방송도 각 프로그램에서 꺼 주세요.");
      })
      .catch(() => {
        selfEndedRef.current = false;
        setEndOpen(false);
        showToast("강의를 끝내지 못했어요.");
      });
  };
  const replayLecture = () => {
    convertToReplay(serverNow())
      .then(() => {
        setEndOpen(false);
        showToast("▶ 다시보기로 바꿨어요. OBS · 유튜브 방송도 꺼 주세요.");
      })
      .catch(() => {
        setEndOpen(false);
        showToast("다시보기로 바꾸지 못했어요.");
      });
  };
  const extendLecture = () => {
    if (!broadcast) return;
    extendBroadcast(broadcast, serverNow())
      .then(() => showToast("⏱ 30분 연장했어요."))
      .catch(() => showToast("연장하지 못했어요."));
  };
  /** 관리자 패널용: 신고 목록 + 지금 접속 중인지 */
  const flags = useMemo<ModerationFlag[]>(
    () =>
      flagged.map((f) => ({
        targetKey: f.targetId,
        targetName: f.targetName,
        online: !!players[f.targetId],
        reporterCount: f.reporterCount,
        reports: f.reports,
      })),
    [flagged, players],
  );

  /** 나가기: 자리·위치를 먼저 정리하고 랜딩 메인으로 (정리가 늦어도 1초 뒤엔 이동) */
  const exitToLanding = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // 새 탭으로 열기는 그대로
    e.preventDefault();
    const cleanup = Promise.allSettled([dmRef.current?.stop(), roomRef.current?.leave()]);
    void Promise.race([cleanup, new Promise((r) => setTimeout(r, 1000))]).then(() => window.location.assign(LANDING_URL));
  };

  if (kicked) {
    return (
      <main className="glacier-sky flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-4xl" aria-hidden="true">
          🚪
        </p>
        <p className="text-lg font-bold">{kicked.message}</p>
        <p className="text-sm text-ink-300">
          {new Date(kicked.until).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} 이후에
          다시 들어올 수 있어요.
        </p>
        <a href={LANDING_URL} className="mt-2 rounded-full bg-white/10 px-6 py-3 font-bold text-white">
          처음으로
        </a>
      </main>
    );
  }

  if (joinError) {
    return (
      <main className="glacier-sky flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold">{joinError}</p>
        <a href={LANDING_URL} className="rounded-full bg-brand-500 px-6 py-3 font-bold text-white">
          처음으로
        </a>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-night">
      {/* 상단 바 */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-night/80 px-4 backdrop-blur">
        <a href={LANDING_URL} onClick={exitToLanding} className="flex items-center gap-2">
          <Image src="/brand/logo-mark.svg" alt="" width={28} height={28} />
          <span className="font-extrabold">남극AI빌리지</span>
        </a>
        <span
          className={`ml-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            conn === "ready"
              ? "bg-aurora-green/15 text-aurora-green"
              : conn === "offline"
                ? "bg-coral-500/20 text-coral-300"
                : "bg-white/10 text-ink-200"
          }`}
          role="status"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${conn === "ready" ? "bg-aurora-green" : conn === "offline" ? "bg-coral-400" : "bg-ink-300"}`}
          />
          {conn === "ready" ? `${list.length}명 접속 중` : conn === "offline" ? "연결 끊김 — 다시 연결 중…" : "입장 중…"}
        </span>
        <WeatherChip weather={weather} onPreview={previewWeather} />
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminOpen((o) => !o)}
              aria-expanded={adminOpen}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                flags.length ? "bg-coral-500 text-white" : "bg-white/10 text-ink-200"
              }`}
            >
              🛡️ 신고 확인
              {flags.length > 0 && <span className="rounded-full bg-white px-1.5 text-[10px] text-coral-600">{flags.length}</span>}
            </button>
          )}
          {me && (
            <span className="hidden text-sm text-ink-200 sm:inline">
              <strong className="text-white">{me.name}</strong> · {ROLE_LABEL[me.role]} 아델리
            </span>
          )}
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold lg:hidden"
            aria-expanded={panelOpen}
            aria-controls="attendance"
          >
            출석부
          </button>
          <a href={LANDING_URL} onClick={exitToLanding} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-ink-200 hover:bg-white/5">
            나가기
          </a>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 스터디룸 뷰 */}
          <div
            ref={viewportRef}
            className="relative min-h-0 min-w-0 flex-1 cursor-grab touch-none select-none overflow-hidden bg-[#041a2e] active:cursor-grabbing"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              // 버튼 · 입력창 · 패널 위에서 누른 건 그쪽 동작 (드래그 · 걸어가기 아님)
              if ((e.target as HTMLElement).closest("button, a, input, textarea, [role=dialog], [role=alertdialog], [role=region]")) return;
              drag.current = { sx: e.clientX, sy: e.clientY, px: pan.current.x, py: pan.current.y, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const dx = e.clientX - d.sx;
              const dy = e.clientY - d.sy;
              if (!d.moved) {
                if (Math.hypot(dx, dy) < 5) return; // 손떨림은 클릭으로
                d.moved = true;
                // 실제로 끌기 시작했을 때만 포인터를 붙잡음 (화면 밖으로 나가도 계속 끌리게)
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              pan.current = { x: d.px + dx, y: d.py + dy };
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              if (!d) return;
              if (d.moved) {
                setPanned(Math.abs(pan.current.x) > 1 || Math.abs(pan.current.y) > 1);
                return;
              }
              // 끌지 않고 뗐으면 클릭: 그 자리로 걸어가기
              const p = toWorld(e.clientX, e.clientY);
              if (p) walkTo(p);
              setSelectedId(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <div ref={worldRef} className="absolute left-0 top-0 origin-top-left" style={{ width: LANDSCAPE.w, height: LANDSCAPE.h }}>
              {/* 남극 풍경 (빙하 · 설산 · 바다 · 동물) */}
              <Landscape />
              {/* 매시간 날씨 — 풍경 전체 (펭귄 위 · 이름표 아래) */}
              <div className="pointer-events-none absolute inset-0" style={{ zIndex: LABEL_Z - 100 }}>
                <WeatherLayer weather={weather} />
              </div>

              {/* 공부 캠프: z-index 없이 배치해 안의 펭귄 · 소품이 날씨 · 이름표와 함께 깊이 정렬됨 */}
              <div className="absolute" style={{ left: CAMP_OFFSET.x, top: CAMP_OFFSET.y, width: WORLD.w, height: WORLD.h }}>
                <MapFloor />
                <MapProps />
                <LectureScreen
                  broadcast={broadcast}
                  isAdmin={isAdmin && conn === "ready"}
                  canEnd={!!broadcast && isAdmin}
                  onCreate={() => setCreateOpen(true)}
                  onWatch={watchLecture}
                  onExtend={extendLecture}
                  onEnd={() => setEndOpen(true)}
                />

                {/* 빈 자리 */}
                {SEATS.map((seat) => {
                  const who = occupied.get(seat.id);
                  if (who) return null;
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      title="여기 앉기"
                      aria-label={`빈 자리에 앉기 (${SEAT_LABEL[seat.kind]})`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => walkTo({ x: seat.x, y: seat.y }, seat.id)}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ left: seat.x, top: seat.y - 4, width: 40, height: 22, zIndex: 1500 }}
                    >
                      <span className="absolute inset-0 rounded-[50%] border-2 border-dashed border-[#1f3b52]/75 bg-white/35 transition group-hover:scale-110 group-hover:border-solid group-hover:bg-aurora-green/50" />
                    </button>
                  );
                })}

                {list.map((p) => (
                  <Avatar
                    key={p.id}
                    player={p}
                    isSelf={p.id === selfId}
                    jumping={!!jumping[p.id]}
                    selected={p.id === selectedId}
                    bubble={bubbles[p.id]}
                    called={calledIds.has(p.id)}
                    locked={dm.partnerOf.has(p.id)}
                    selfName={me?.name}
                    setEl={setEl}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            </div>

            {/* 선택한 펭귄 카드 */}
            {selected && (
              <div
                className="absolute bottom-4 left-1/2 z-20 w-[min(92%,22rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-ink-900/90 p-4 shadow-2xl backdrop-blur"
                onPointerDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-label={`${selected.name} 프로필`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold">
                      {selected.role === "teacher" && "🎓 "}
                      {selected.name}
                      {selected.id === selfId && <span className="ml-1.5 text-xs text-coral-300">(나)</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-300">
                      {ROLE_LABEL[selected.role]} 아델리 · {presenceOf(selected).status.emoji} {presenceOf(selected).status.label}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      입장 {formatClock(selected.enteredAt)} · 오늘 공부 {formatDuration(studyMsNow(selected, Date.now() + clockOffset))}
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="text-ink-400 hover:text-white" aria-label="닫기">
                    ✕
                  </button>
                </div>
                {selected.id !== selfId && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        composerRef.current?.mention(selected.name);
                        setSelectedId(null);
                      }}
                      className="rounded-xl bg-brand-500/25 py-2 text-sm font-bold text-brand-100 hover:bg-brand-500/40"
                    >
                      @{selected.name} 부르기
                    </button>
                    <SecretChatButton
                      targetId={selected.id}
                      mySessionPeer={dm.session?.peer.id ?? null}
                      targetBusy={dm.partnerOf.has(selected.id)}
                      pendingTo={dm.outgoing?.peer.id ?? null}
                      onRequest={() => dm.request(selected.id)}
                      onCancel={dm.cancel}
                      onOpen={() => {
                        dm.open();
                        setSelectedId(null);
                      }}
                    />
                  </div>
                )}
                {isAdmin && selected.id !== selfId && selected.role !== "admin" && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = selected.role === "teacher" ? "student" : "teacher";
                      setRole(selected.id, next)
                        .then(() => showToast(`${selected.name} 님을 ${next === "teacher" ? "🎓 강사" : "🎒 학생"} 아델리로 바꿨어요`))
                        .catch(() => showToast("역할을 바꾸지 못했어요."));
                    }}
                    className="mt-2 w-full rounded-xl border border-white/15 py-2 text-xs font-bold text-ink-200 hover:bg-white/5"
                  >
                    🛡️ {selected.role === "teacher" ? "학생으로 되돌리기" : "강사 역할 주기"}
                  </button>
                )}
              </div>
            )}

            {panned && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  pan.current = { x: 0, y: 0 };
                  setPanned(false);
                }}
                className="absolute bottom-3 right-3 z-20 rounded-full bg-ink-900/85 px-3 py-1.5 text-xs font-bold text-ink-100 shadow-lg backdrop-blur hover:bg-ink-800"
                title="배경을 끌어 옮긴 화면을 강의장 가운데로 되돌려요"
              >
                ⟲ 원래 위치로
              </button>
            )}
            {toast && (
              <div
                role="status"
                className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-ink-900/90 px-4 py-2 text-sm font-bold shadow-xl"
              >
                {toast}
              </div>
            )}
            <WeatherBanner weather={weather} />

            {/* 비밀 대화: 받은 신청(오른쪽 위) · 보낸 신청(왼쪽 위) · 대화창(오른쪽) */}
            {dm.incoming.length > 0 && !dm.session && (
              <div className="absolute right-3 top-3 z-40 flex flex-col gap-2">
                {dm.incoming.map((req) => (
                  <IncomingRequestCard key={req.requestId} req={req} onRespond={(accept) => dm.respond(req.requestId, accept)} />
                ))}
              </div>
            )}
            {dm.outgoing && (
              <div className="absolute left-3 top-3 z-40">
                <OutgoingRequestCard req={dm.outgoing} onCancel={dm.cancel} />
              </div>
            )}
            {dm.session && selfId && (
              <div className={`absolute right-3 z-40 ${dm.session.minimized ? "bottom-3" : "bottom-3 top-3"}`}>
                <SecretChatPanel
                  session={dm.session}
                  selfId={selfId}
                  onSend={dm.send}
                  onLeave={dm.leave}
                  onToggle={dm.toggle}
                  onReport={dm.report}
                />
              </div>
            )}

            {playerOpen && broadcast?.kind === "youtube" && (
              <LecturePlayer broadcast={broadcast} onClose={() => setPlayerOpen(false)} />
            )}
            {createOpen && isAdmin && me && selfId && (
              <CreateLectureDialog
                onClose={() => setCreateOpen(false)}
                onSubmit={async (mode, link, durationMs) => {
                  const endsAt = serverNow() + durationMs;
                  await startBroadcast({ uid: selfId, name: me.name }, mode, link, endsAt);
                  setCreateOpen(false);
                  showToast(`${mode === "live" ? "🔴 LIVE" : "▶ 기존 영상"} 강의를 시작했어요 (${formatEndsAt(endsAt)}에 자동 종료).`);
                }}
              />
            )}
            {endOpen && isAdmin && broadcast && (
              <EndLectureDialog broadcast={broadcast} onEnd={endLecture} onReplay={replayLecture} onClose={() => setEndOpen(false)} />
            )}

            {adminOpen && isAdmin && (
              <div className="absolute bottom-3 left-3 top-3 z-50">
                <AdminPanel
                  flags={flags}
                  onKick={(targetId) => {
                    if (!selfId) return;
                    const name = flagged.find((f) => f.targetId === targetId)?.targetName ?? "펭귄";
                    kick(selfId, targetId, players[targetId]?.seatId ?? null, serverNow())
                      .then(() => showToast(`${name} 펭귄을 퇴장시켰어요 (24시간 재입장 제한)`))
                      .catch(() => showToast("퇴장시키지 못했어요."));
                  }}
                  onDismiss={(targetId) =>
                    dismiss(targetId)
                      .then(() => showToast("문제없음으로 처리했어요."))
                      .catch(() => showToast("처리하지 못했어요."))
                  }
                  onClose={() => setAdminOpen(false)}
                />
              </div>
            )}

            {conn === "connecting" && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-night/70 text-sm text-ink-200">
                남극AI빌리지에 들어가는 중…
              </div>
            )}
          </div>

          {/* 말하기 창 */}
          <div className="shrink-0 border-t border-white/10 bg-night px-4 pb-3 pt-3">
            <Composer ref={composerRef} players={list} selfId={selfId} disabled={conn !== "ready"} onSend={sendChat} />
          </div>
        </div>

        {/* 출석부 */}
        <aside
          id="attendance"
          className={`absolute inset-y-0 right-0 z-30 w-72 border-l border-white/10 bg-night/95 backdrop-blur transition-transform lg:static lg:translate-x-0 ${
            panelOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <AttendancePanel
            players={list}
            selfId={selfId}
            selectedId={selectedId}
            clockOffset={clockOffset}
            onSelect={(id) => {
              setSelectedId(id);
              setPanelOpen(false);
            }}
          />
        </aside>
      </div>
    </div>
  );
}

/** 프로필 카드의 비밀 대화 버튼 — 상황에 따라 신청 · 취소 · 대화창 열기 */
function SecretChatButton(props: {
  targetId: string;
  mySessionPeer: string | null;
  targetBusy: boolean;
  pendingTo: string | null;
  onRequest: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const base = "rounded-xl py-2 text-sm font-bold";
  if (props.mySessionPeer === props.targetId)
    return (
      <button type="button" onClick={props.onOpen} className={`${base} bg-coral-500 text-white hover:bg-coral-400`}>
        🔒 대화창 열기
      </button>
    );
  if (props.pendingTo === props.targetId)
    return (
      <button type="button" onClick={props.onCancel} className={`${base} bg-white/10 text-ink-200 hover:bg-white/15`}>
        신청 취소
      </button>
    );
  const blocked = props.mySessionPeer
    ? "이미 비밀 대화 중"
    : props.targetBusy
      ? "다른 대화 중이에요"
      : props.pendingTo
        ? "답을 기다리는 중"
        : null;
  return (
    <button
      type="button"
      disabled={!!blocked}
      onClick={props.onRequest}
      className={`${base} bg-coral-500/25 text-coral-100 hover:bg-coral-500/40 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-ink-500`}
    >
      {blocked ?? "🔒 비밀 대화 신청"}
    </button>
  );
}
