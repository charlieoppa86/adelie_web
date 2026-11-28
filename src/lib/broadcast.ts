/**
 * 스터디 LIVE — Realtime Database (rooms/main/broadcast)
 *
 *   rooms/main/broadcast  {hostUid, hostName, mode, kind, url, videoId?, startedAt, endsAt}  지금 열린 강의 하나
 *
 * - mode "live": 진행 중인 줌 · 구글 미트 회의나 유튜브 라이브
 * - mode "vod":  기존(녹화된) 유튜브 영상 (스터디룸 안 플레이어로 각자 처음부터 시청)
 *
 * - 강의는 한 번에 하나, 관리자만: 규칙상 비어 있거나 종료 예정 시각(endsAt)이 지난 강의만 새로 만들 수 있음
 * - 종료: 관리자가 직접 끝내거나, endsAt 이 지나면 모든 화면에서 자동으로 내려감 (서버 작업 없이 시각 비교)
 * - 진행 중에는 관리자가 연장(+30분)하거나, 유튜브 LIVE 를 같은 주소의 다시보기(vod)로 전환할 수 있음
 * - 오피스에서 끝내도 줌 회의 · OBS 방송은 각 프로그램에서 따로 꺼야 함
 * - 영상은 우리 서버를 거치지 않음: 유튜브 라이브는 플레이어로 끼워 넣고, 줌·구글 미트는 링크로 참여 → 비용 0
 * - 진행자가 새로고침하거나 잠깐 끊겨도 강의는 이어짐 (onDisconnect 로 지우지 않음)
 */
import { onValue, ref, remove, serverTimestamp, set, update, type Database } from "firebase/database";
import { rtdb } from "@/lib/firebase";

const PATH = "rooms/main/broadcast";
/** 종료 예정 시각은 지금부터 최대 24시간 뒤까지 (규칙과 같은 값) */
export const BROADCAST_MAX_MS = 24 * 60 * 60 * 1000;
/** 연장 한 번에 늘어나는 시간 */
export const EXTEND_MS = 30 * 60 * 1000;
/** 강의 만들 때 고르는 진행 시간 */
export const DURATION_CHOICES = [
  { label: "1시간", ms: 60 * 60 * 1000 },
  { label: "2시간", ms: 2 * 60 * 60 * 1000 },
  { label: "3시간", ms: 3 * 60 * 60 * 1000 },
] as const;
/** 서버 시각과 어긋나도 규칙의 24시간 상한을 넘지 않게 두는 여유 */
const CLOCK_MARGIN_MS = 60 * 1000;

export type LectureKind = "youtube" | "zoom" | "meet";
export type LectureMode = "live" | "vod";

export interface LectureLink {
  kind: LectureKind;
  url: string;
  /** 유튜브만: 11자 영상 ID */
  videoId?: string;
}

export interface Broadcast extends LectureLink {
  mode: LectureMode;
  hostUid: string;
  hostName: string;
  startedAt: number;
  /** 이 시각이 지나면 끝난 강의 (관리자가 연장 가능) */
  endsAt: number;
}

export const LECTURE_KIND_LABEL: Record<LectureKind, string> = {
  youtube: "유튜브",
  zoom: "줌",
  meet: "구글 미트",
};

/** 화면에 쓰는 이름: "유튜브 라이브" · "유튜브 녹화 영상" · "줌" · "구글 미트" */
export const lectureLabel = (kind: LectureKind, mode: LectureMode) =>
  kind === "youtube" ? `유튜브 ${mode === "live" ? "라이브" : "녹화 영상"}` : LECTURE_KIND_LABEL[kind];

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const MEET_CODE = /^\/([a-z]{3}-[a-z]{4}-[a-z]{3})(\/|$)/;

/**
 * 붙여 넣은 주소를 강의 링크로 바꿈. 지원하지 않는 주소면 null.
 * 규칙(database.rules.json)도 같은 형식만 받으므로, 여기서 정리한 모양 그대로 저장합니다.
 */
export function parseLectureUrl(input: string): LectureLink | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();

  // 유튜브: watch?v= · /live/ID · /embed/ID · youtu.be/ID
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
    const seg = u.pathname.split("/").filter(Boolean);
    const id =
      host === "youtu.be"
        ? seg[0]
        : seg[0] === "watch"
          ? u.searchParams.get("v")
          : seg[0] === "live" || seg[0] === "embed" || seg[0] === "shorts"
            ? seg[1]
            : null;
    return id && YT_ID.test(id) ? { kind: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }

  // 구글 미트: meet.google.com/abc-defg-hij
  if (host === "meet.google.com") {
    const m = MEET_CODE.exec(u.pathname);
    return m ? { kind: "meet", url: `https://meet.google.com/${m[1]}` } : null;
  }

  // 줌: *.zoom.us · *.zoom.com (회의 암호가 담긴 pwd 쿼리는 그대로 둠)
  if (/^([a-z0-9-]+\.)*zoom\.(us|com)$/.test(host) && u.pathname.length > 1) {
    u.protocol = "https:";
    const url = u.toString();
    return url.length <= 500 ? { kind: "zoom", url } : null;
  }
  return null;
}

/** 이 방식(라이브 · 녹화 영상)으로 쓸 수 있는 주소인지 — 녹화 영상은 유튜브만 */
export const linkFitsMode = (link: LectureLink, mode: LectureMode) => mode === "live" || link.kind === "youtube";

/**
 * 유튜브 플레이어 주소 — 자동 재생은 브라우저 정책상 음소거로만 가능 (소리는 플레이어에서 켬)
 * enablejsapi: 재생이 끝났는지 알려 받아 시청 표시(AI 선글라스)를 내리기 위해
 */
export const youtubeEmbedUrl = (videoId: string, origin?: string) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${
    origin ? `&origin=${encodeURIComponent(origin)}` : ""
  }`;

/** 지금 열린 강의 구독 (없거나 종료 예정 시각이 지났으면 null — 그 시각이 되면 자동으로 null 을 다시 알림) */
export function watchBroadcast(
  on: (b: Broadcast | null) => void,
  serverNow: () => number,
  db: Database = rtdb(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsub = onValue(
    ref(db, PATH),
    (snap) => {
      clearTimeout(timer);
      const b = snap.val() as Broadcast | null;
      const left = b?.endsAt ? b.endsAt - serverNow() : 0;
      if (!b || left <= 0) return on(null);
      on(b);
      // setTimeout 상한(약 24.8일)보다 훨씬 짧으므로 그대로 예약
      timer = setTimeout(() => on(null), left);
    },
    () => on(null),
  );
  return () => {
    clearTimeout(timer);
    unsub();
  };
}

/** 강의 만들기 — 이미 강의가 있거나 권한이 없으면 규칙이 거부 */
export function startBroadcast(
  host: { uid: string; name: string },
  mode: LectureMode,
  link: LectureLink,
  endsAt: number,
  db: Database = rtdb(),
) {
  return set(ref(db, PATH), {
    hostUid: host.uid,
    hostName: host.name,
    mode,
    kind: link.kind,
    url: link.url,
    ...(link.videoId ? { videoId: link.videoId } : {}),
    startedAt: serverTimestamp(),
    endsAt,
  });
}

/** 관리자: 30분 연장 (최대 지금부터 24시간) */
export function extendBroadcast(b: Broadcast, now: number, db: Database = rtdb()) {
  const endsAt = Math.min(Math.max(b.endsAt, now) + EXTEND_MS, now + BROADCAST_MAX_MS - CLOCK_MARGIN_MS);
  return update(ref(db, PATH), { endsAt });
}

/** 관리자: 끝난 유튜브 LIVE 를 같은 주소의 다시보기(기존 영상)로 전환 — 24시간 동안 "뭐 보지?"로 남김 */
export function convertToReplay(now: number, db: Database = rtdb()) {
  return update(ref(db, PATH), { mode: "vod", endsAt: now + BROADCAST_MAX_MS - CLOCK_MARGIN_MS });
}

/** 강의 끝내기 — 관리자 */
export function endBroadcast(db: Database = rtdb()) {
  return remove(ref(db, PATH));
}
