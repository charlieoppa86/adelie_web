"use client";

/**
 * 스터디 LIVE — 집중 개인석 벽의 스크린 · 강의 만들기 창 · 유튜브 플레이어 창
 *
 * 강의 개설은 관리자만:
 *   - 관리자: 강의가 없으면 "강의 만들기"(링크 + LIVE/기존 영상 체크), 강의 중이면 "보기 · 참여하기" + "종료"
 *   - 그 밖의 펭귄: 라이브 중이면 "LIVE 중", 기존(녹화) 영상이면 "뭐 보지?" 버튼으로 시청
 * 라이브: 빨간 녹화 표시 + LIVE + 진행자 닉네임. 유튜브는 플레이어 창, 줌·미트는 새 창
 * 기존 영상: ▶ 녹화 영상 + 올린 사람 닉네임, 플레이어 창 (각자 처음부터)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DURATION_CHOICES,
  EXTEND_MS,
  LECTURE_KIND_LABEL,
  lectureLabel,
  linkFitsMode,
  parseLectureUrl,
  youtubeEmbedUrl,
  type Broadcast,
  type LectureLink,
  type LectureMode,
} from "@/lib/broadcast";
import { LECTURE_SCREEN } from "@/shared/officeMap";

/** 종료 예정 시각 "15:30" (오늘이 아니면 "내일 07:30") */
export function formatEndsAt(at: number) {
  const d = new Date(at);
  const hm = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toDateString() === new Date().toDateString() ? hm : `내일 ${hm}`;
}

/** 맵 클릭(이동)으로 번지지 않게 */
const stop = (e: React.PointerEvent) => e.stopPropagation();

/** 줌·미트·유튜브 페이지를 새 창으로 — 듀얼 모니터면 다른 화면으로 옮겨 둘 수 있게 팝업 창으로 엶 */
/**
 * 줌 · 미트 · 유튜브를 새 창으로 — 창을 닫았는지 알 수 있게 창 핸들을 돌려줌 (팝업이 막히면 null).
 * noopener 를 쓰면 핸들을 못 받으므로, 빈 창을 연 뒤 opener 를 끊고 주소로 이동
 */
export function openLectureWindow(url: string): Window | null {
  const w = window.open("", "_blank", "popup,width=1280,height=760");
  if (!w) return null;
  w.opener = null;
  w.location.href = url;
  return w;
}

/** 빨간 녹화 표시 (깜빡임) */
function RecDot({ size = 10 }: { size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full bg-red-500/70" />
      <span className="relative inline-flex h-full w-full animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,.7)]" />
    </span>
  );
}

/** 스크린 · 플레이어 머리말: 라이브면 빨간 점등 + LIVE, 녹화 영상이면 ▶ 녹화 영상 */
function StatusTag({ b, size = 10 }: { b: Broadcast; size?: number }) {
  return b.mode === "live" ? (
    <span className="flex items-center gap-1.5 font-black tracking-[0.18em] text-red-400">
      <RecDot size={size} />
      LIVE
    </span>
  ) : (
    <span className="font-black tracking-wider text-[#8fd1ec]">▶ 녹화 영상</span>
  );
}

/** 영상 키비주얼 색 (자료 보드의 책 색과 같은 팔레트) */
const FRAMES = ["#2fa8d9", "#8b7bff", "#5ff2c1", "#ffd66b", "#ec7a5f"];

/**
 * 스크린 윗부분 키비주얼: 필름 한 줄 + 가운데 재생 버튼 (자료 보드의 책 한 줄 + 선반과 같은 자리 · 크기).
 * 강의 중이면 가운데에 LIVE / ▶ 녹화 영상 표시
 */
function VideoVisual({ b }: { b: Broadcast | null }) {
  const live = b?.mode === "live";
  return (
    <>
      <div className="pointer-events-none relative mx-3 mt-3 h-[30px] overflow-hidden rounded-[3px] bg-[#16324a]" aria-hidden={!b}>
        {/* 필름 구멍 (위 · 아래) */}
        <span className="absolute inset-x-0 top-[2px] h-[3px] bg-[repeating-linear-gradient(90deg,#e6f6fc_0_4px,transparent_4px_9px)] opacity-60" />
        <span className="absolute inset-x-0 bottom-[2px] h-[3px] bg-[repeating-linear-gradient(90deg,#e6f6fc_0_4px,transparent_4px_9px)] opacity-60" />
        {/* 장면 칸 */}
        <div className="absolute inset-x-1 top-[7px] flex h-4 gap-[3px]">
          {FRAMES.map((c, i) => (
            <span
              key={i}
              className="flex-1 rounded-[2px]"
              style={{ background: `linear-gradient(160deg, ${c}, ${c}66)`, opacity: live ? 0.55 : 0.85 }}
            />
          ))}
        </div>
        {/* 가운데: 재생 버튼 또는 방송 상태 */}
        <div className="absolute inset-0 grid place-items-center">
          {b ? (
            <span className="rounded-full bg-[#0b2a44]/90 px-2 py-0.5 text-[10px]">
              <StatusTag b={b} size={8} />
            </span>
          ) : (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/95 shadow">
              <span className="ml-[2px] h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-[#0b2a44]" />
            </span>
          )}
        </div>
      </div>
      <span className="pointer-events-none mx-2 h-1.5 rounded-full bg-[#e6f6fc]" />
    </>
  );
}

/** 맵 위의 스터디 LIVE 스크린 (공부 캠프 좌표) */
export function LectureScreen(props: {
  broadcast: Broadcast | null;
  /** 관리자: 강의 만들기 · 끝내기 */
  isAdmin: boolean;
  canEnd: boolean;
  onCreate: () => void;
  onWatch: () => void;
  /** 관리자: 30분 연장 */
  onExtend: () => void;
  /** 관리자: 종료 창 열기 */
  onEnd: () => void;
  /** 지금 보고 있는 펭귄 수 (AI 선글라스) */
  watchers: number;
}) {
  const { broadcast: b } = props;
  const { x, y, w, h } = LECTURE_SCREEN;
  const live = b?.mode === "live";
  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-xl border-[3px] border-[#bfe6f6] bg-[#0b2a44] shadow-[0_6px_0_#2f86b8,0_0_24px_rgba(143,209,236,.45)]"
      style={{ left: x, top: y, width: w, height: h, zIndex: y + h }}
      onPointerDown={stop}
    >
      {/* 눈 처마 */}
      <span className="pointer-events-none absolute inset-x-1 -top-1 h-2 rounded-full bg-[#fbfeff]" />
      <VideoVisual b={b} />
      {b ? (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center ${
            live ? "bg-[radial-gradient(circle_at_50%_30%,rgba(239,68,68,.22),transparent_70%)]" : ""
          }`}
        >
          <p className="flex max-w-full items-center gap-1 text-[13px] font-extrabold text-white" title={b.hostName}>
            <span className="truncate">🎙️ {b.hostName}</span>
            <span className="shrink-0 text-[11px] font-bold text-[#8fd1ec]" title="이 시각에 자동으로 끝나요">
              · ⏱ {formatEndsAt(b.endsAt)}
            </span>
          </p>
          {props.watchers > 0 && (
            <p className="-mt-0.5 text-[10px] font-bold text-aurora-green" title="출석부에서 🕶️ 표시로 누가 보는지 볼 수 있어요">
              🕶️ {props.watchers}명 시청 중{live && <span className="text-ink-300"> · {lectureLabel(b.kind, b.mode)}</span>}
            </p>
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={props.onWatch}
              className={`rounded-full font-extrabold text-white shadow-lg ${
                props.isAdmin ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-xs"
              } ${live ? "bg-red-500 hover:bg-red-400" : "bg-brand-500 hover:bg-brand-400"}`}
            >
              {props.isAdmin ? (b.kind === "youtube" ? "▶ 보기" : "참여하기 ↗") : live ? "🔴 LIVE 중" : "🍿 뭐 보지?"}
            </button>
            {props.canEnd && (
              <>
                <button
                  type="button"
                  onClick={props.onExtend}
                  title={`종료 시각을 ${EXTEND_MS / 60000}분 늦춰요`}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/25"
                >
                  +30분
                </button>
                <button
                  type="button"
                  onClick={props.onEnd}
                  className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white hover:bg-white/25"
                >
                  종료
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center">
          <p className="text-[13px] font-extrabold tracking-wide text-[#e6f6fc]">📺 스터디 LIVE</p>
          {props.isAdmin ? (
            <button
              type="button"
              onClick={props.onCreate}
              className="rounded-full bg-brand-500 px-4 py-1.5 text-xs font-extrabold text-white shadow-lg hover:bg-brand-400"
            >
              ＋ 강의 만들기
            </button>
          ) : (
            <p className="py-1.5 text-xs font-bold text-[#8fd1ec]">강의가 열리면 여기에 떠요</p>
          )}
        </div>
      )}
    </div>
  );
}

const MODE_INFO: Record<LectureMode, { label: string; desc: string; submit: string }> = {
  live: { label: "🔴 LIVE", desc: "지금 진행 중인 방송 · 회의 (줌 · 구글 미트 · 유튜브 라이브)", submit: "LIVE 시작" },
  vod: { label: "▶ 기존 영상", desc: "이미 녹화된 유튜브 영상", submit: "영상 올리기" },
};

/** 관리자: 강의 만들기 창 — 영상 링크를 넣고 LIVE / 기존 영상 중 하나를 체크 */
export function CreateLectureDialog(props: {
  onSubmit: (mode: LectureMode, link: LectureLink, durationMs: number) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<LectureMode | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = value.trim() ? parseLectureUrl(value) : null;
  /** 줌 · 미트는 진행 중인 회의라 기존 영상으로 고를 수 없음 */
  const vodBlocked = !!parsed && !linkFitsMode(parsed, "vod");
  const chosen = vodBlocked && mode === "vod" ? null : mode;
  /** 진행 시간: 고른 칸(0~2) 또는 "직접"(분 입력) */
  const [duration, setDuration] = useState<number | "custom">(1);
  const [customMin, setCustomMin] = useState("90");
  const customOk = /^\d+$/.test(customMin) && +customMin >= 10 && +customMin <= 1440;
  const durationMs = duration === "custom" ? (customOk ? +customMin * 60 * 1000 : 0) : DURATION_CHOICES[duration].ms;
  const ready = !!parsed && !!chosen && durationMs > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed) return setError("줌, 구글 미트, 유튜브 주소만 넣을 수 있어요.");
    if (!chosen) return setError("LIVE인지 기존 영상인지 체크해 주세요.");
    setBusy(true);
    setError(null);
    try {
      if (!durationMs) {
        setBusy(false);
        return setError("진행 시간은 10분 ~ 1440분(24시간) 사이로 넣어 주세요.");
      }
      await props.onSubmit(chosen, parsed, durationMs);
    } catch {
      setError("강의를 만들지 못했어요. 이미 다른 강의가 열려 있을 수 있어요.");
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/60 p-4" onPointerDown={stop}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-label="강의 만들기"
        className="w-[min(100%,28rem)] rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-2xl backdrop-blur"
      >
        <p className="text-lg font-extrabold">📺 스터디 LIVE · 강의 만들기</p>
        <p className="mt-1 text-sm text-ink-300">영상 링크를 넣고 LIVE인지 기존 영상인지 체크하면 스터디 LIVE에 떠요.</p>

        <label className="mt-4 block text-xs font-bold text-ink-200" htmlFor="lecture-url">
          영상 링크
        </label>
        <input
          id="lecture-url"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="https://"
          inputMode="url"
          className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
        />
        <p className={`mt-1.5 text-xs ${parsed ? "text-aurora-green" : value.trim() ? "text-coral-300" : "text-ink-400"}`}>
          {parsed
            ? `✓ ${chosen ? lectureLabel(parsed.kind, chosen) : LECTURE_KIND_LABEL[parsed.kind]} — ${
                parsed.kind === "youtube" ? "스터디룸 안에서 바로 볼 수 있어요" : "펭귄들이 새 창으로 참여해요"
              }`
            : value.trim()
              ? "줌, 구글 미트, 유튜브 주소만 넣을 수 있어요."
              : "줌(zoom.us/j/…) · 구글 미트(meet.google.com/…) · 유튜브(youtube.com/… · youtu.be/…)"}
        </p>

        <fieldset className="mt-4">
          <legend className="text-xs font-bold text-ink-200">영상 종류 (하나를 체크)</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["live", "vod"] as const).map((m) => {
              const disabled = m === "vod" && vodBlocked;
              const on = chosen === m;
              const tone = m === "live" ? "border-red-400 bg-red-500/15" : "border-brand-400 bg-brand-500/15";
              return (
                <label
                  key={m}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 ${
                    disabled ? "cursor-not-allowed border-white/5 opacity-40" : on ? tone : "border-white/15 hover:bg-white/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                    checked={on}
                    disabled={disabled}
                    onChange={(e) => {
                      setMode(e.target.checked ? m : null);
                      setError(null);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-extrabold">{MODE_INFO[m].label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-300">
                      {disabled ? "줌 · 미트 회의는 LIVE로만 등록할 수 있어요" : MODE_INFO[m].desc}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-xs font-bold text-ink-200">진행 시간 (지나면 자동 종료 · 진행 중 +30분 연장 가능)</legend>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {DURATION_CHOICES.map((d, i) => (
              <button
                key={d.label}
                type="button"
                aria-pressed={duration === i}
                onClick={() => setDuration(i)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  duration === i ? "bg-brand-500 text-white" : "bg-white/10 text-ink-200 hover:bg-white/15"
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={duration === "custom"}
              onClick={() => setDuration("custom")}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                duration === "custom" ? "bg-brand-500 text-white" : "bg-white/10 text-ink-200 hover:bg-white/15"
              }`}
            >
              직접
            </button>
            {duration === "custom" && (
              <span className="flex items-center gap-1 text-xs text-ink-300">
                <input
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  aria-label="진행 시간(분)"
                  className={`w-16 rounded-lg border bg-white/5 px-2 py-1 text-right text-xs outline-none ${
                    customOk ? "border-white/15 focus:border-brand-400" : "border-coral-400"
                  }`}
                />
                분
              </span>
            )}
          </div>
        </fieldset>

        {error && <p className="mt-3 text-xs font-bold text-coral-300">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-ink-200 hover:bg-white/15"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy || !ready}
            className={`rounded-xl py-2.5 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-ink-500 ${
              chosen === "vod" ? "bg-brand-500 hover:bg-brand-400" : "bg-red-500 hover:bg-red-400"
            }`}
          >
            {busy ? "시작하는 중…" : chosen ? MODE_INFO[chosen].submit : "강의 시작"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * 관리자: 강의 종료 창 (스크린의 "종료" → 이 창에서 한 번 더 눌러야 끝남)
 * 유튜브 LIVE 는 "다시보기로 전환"도 고를 수 있음 (같은 주소가 방송 후 녹화 영상이 되므로)
 */
export function EndLectureDialog(props: { broadcast: Broadcast; onEnd: () => void; onReplay: () => void; onClose: () => void }) {
  const { broadcast: b } = props;
  const [busy, setBusy] = useState(false);
  const canReplay = b.mode === "live" && b.kind === "youtube";
  const external =
    b.mode === "vod" ? null : b.kind === "youtube" ? "OBS · 유튜브 방송은" : b.kind === "zoom" ? "줌 회의는" : "구글 미트 회의는";
  const act = (fn: () => void) => () => {
    setBusy(true);
    fn();
  };
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/60 p-4" onPointerDown={stop}>
      <div
        role="alertdialog"
        aria-label="강의 종료"
        className="w-[min(100%,26rem)] rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-2xl backdrop-blur"
      >
        <p className="text-lg font-extrabold">강의를 끝낼까요?</p>
        <p className="mt-1 text-sm text-ink-300">
          🎙️ {b.hostName} · {lectureLabel(b.kind, b.mode)} · ⏱ {formatEndsAt(b.endsAt)}까지
        </p>
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-ink-200">
          스터디 LIVE 화면이 내려가고, 보고 있던 펭귄들의 플레이어도 닫혀요.
          {external && (
            <>
              <br />
              <strong className="text-coral-300">{external} 각 프로그램에서 따로 꺼 주세요.</strong>
            </>
          )}
        </p>
        {canReplay && (
          <button
            type="button"
            disabled={busy}
            onClick={act(props.onReplay)}
            className="mt-3 w-full rounded-xl border border-brand-400/60 bg-brand-500/15 px-3 py-2.5 text-left hover:bg-brand-500/25 disabled:opacity-50"
          >
            <span className="block text-sm font-extrabold">▶ 다시보기로 전환</span>
            <span className="mt-0.5 block text-[11px] text-ink-300">
              같은 유튜브 영상을 24시간 동안 &quot;뭐 보지?&quot;로 남겨요. 유튜브에서 방송이 끝나야 처음부터 볼 수 있어요.
            </span>
          </button>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-ink-200 hover:bg-white/15"
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={act(props.onEnd)}
            className="rounded-xl bg-red-500 py-2.5 text-sm font-extrabold text-white hover:bg-red-400 disabled:opacity-50"
          >
            {canReplay ? "그냥 끝내기" : "끝내기"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 플레이어를 열면 소리를 켠 채 이 크기(%)로 시작 */
const SOUND_VOLUME = 50;

/** 유튜브 플레이어 창 (스터디룸 왼쪽 아래, 접기 가능) — 소리 켜짐 · 50% 로 시작 */
export function LecturePlayer(props: {
  broadcast: Broadcast;
  onClose: () => void;
  /** 영상 재생이 끝남(ended=true) · 다시 재생(false) — 녹화 영상이 끝나면 AI 선글라스를 내림 */
  onEnded: (ended: boolean) => void;
}) {
  const { broadcast: b, onEnded } = props;
  const [min, setMin] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** 소리 기본값(켜짐 · 50%)을 이미 맞췄는지 — 그 뒤엔 사용자가 바꾼 소리를 그대로 둠 */
  const soundSet = useRef(false);

  /** 플레이어에 명령 보내기 (유튜브 IFrame API, enablejsapi=1) */
  const command = useCallback((func: string, args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);
  /** "보기"를 눌러 연 플레이어라 소리를 켠 채 재생할 수 있음 — 소리 켬 + 50% */
  const setDefaultSound = useCallback(() => {
    if (soundSet.current) return;
    command("unMute");
    command("setVolume", [SOUND_VOLUME]);
    command("playVideo");
  }, [command]);

  // 유튜브 플레이어가 보내는 상태 알림 (0 = 끝남, 1 = 재생 중)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || !/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      let d: { event?: string; info?: unknown } | null = null;
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      const state =
        d?.event === "onStateChange"
          ? d.info
          : d?.event === "infoDelivery"
            ? (d.info as { playerState?: number } | null)?.playerState
            : undefined;
      if (d?.event === "onReady") setDefaultSound();
      if (state === 0) onEnded(true);
      else if (state === 1) {
        onEnded(false);
        // 재생이 시작되면 한 번 더 맞추고 끝 (준비 알림을 놓쳤을 때 대비)
        setDefaultSound();
        soundSet.current = true;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onEnded, setDefaultSound]);

  if (!b.videoId) return null;
  return (
    <div
      className="absolute bottom-3 left-3 z-40 w-[min(calc(100%-1.5rem),36rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur"
      onPointerDown={stop}
      role="region"
      aria-label={`${b.hostName} 님의 강의`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs">
          <StatusTag b={b} size={8} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">🎙️ {b.hostName}</span>
        <button
          type="button"
          onClick={() => openLectureWindow(b.url)}
          className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-ink-200 hover:bg-white/15"
          title="새 창으로 열어 다른 모니터로 옮길 수 있어요"
        >
          새 창 ↗
        </button>
        <button
          type="button"
          onClick={() => setMin((m) => !m)}
          className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-ink-200 hover:bg-white/15"
          aria-expanded={!min}
        >
          {min ? "펼치기" : "접기"}
        </button>
        <button type="button" onClick={props.onClose} className="px-1 text-ink-400 hover:text-white" aria-label="플레이어 닫기">
          ✕
        </button>
      </div>
      {/* 접어도 소리는 이어지도록 플레이어는 그대로 두고 높이만 0 */}
      <div className={min ? "h-0" : "aspect-video"}>
        <iframe
          ref={frameRef}
          key={b.videoId}
          src={youtubeEmbedUrl(b.videoId, typeof window === "undefined" ? undefined : window.location.origin)}
          // 상태 알림을 받겠다고 플레이어에 등록
          onLoad={(e) => {
            soundSet.current = false;
            e.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: b.videoId, channel: "widget" }), "*");
          }}
          title={`${b.hostName} 님의 유튜브 ${b.mode === "live" ? "라이브" : "녹화 영상"}`}
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
