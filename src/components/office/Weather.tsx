"use client";

/**
 * 매시간 바뀌는 남극 날씨 — 훅(정시 전환) · 맵 위 효과 레이어 · 바뀔 때 알림 배너 · 상단 칩.
 * 효과는 CSS 그라디언트 + transform/opacity 애니메이션만 써서 가볍게 유지합니다.
 */
import { useEffect, useRef, useState } from "react";
import { LANDSCAPE } from "@/shared/officeMap";
import { WEATHERS, WEATHER_ORDER, nextChangeAt, weatherAt, type WeatherId } from "@/shared/weather";

const FADE_MS = 3000;

export interface WeatherState {
  id: WeatherId;
  /** 페이드아웃 중인 이전 날씨 */
  prev: WeatherId | null;
  /** 이번 날씨가 정시 전환으로 바뀐 것인지 (처음 입장 시엔 false) */
  changed: boolean;
  nextAt: number;
  /** 바뀐 횟수 — 배너 재생용 키 */
  seq: number;
}

/** 서버 시각 기준으로 정시마다 날씨를 바꿈. onChange는 정시 전환 때만 호출 */
export function useHourlyWeather(clockOffset: number, onChange?: (id: WeatherId) => void) {
  const [state, setState] = useState<WeatherState | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let timer = 0;
    let fade = 0;
    const now = () => Date.now() + clockOffset;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          const id = weatherAt(now());
          setState((s) =>
            s && s.id === id ? s : { id, prev: s?.id ?? null, changed: true, nextAt: nextChangeAt(now()), seq: (s?.seq ?? 0) + 1 },
          );
          onChangeRef.current?.(id);
          window.clearTimeout(fade);
          fade = window.setTimeout(() => setState((s) => (s ? { ...s, prev: null } : s)), FADE_MS + 200);
          schedule();
        },
        Math.max(200, nextChangeAt(now()) - now() + 150),
      );
    };
    const first = window.setTimeout(() => {
      setState((s) => s ?? { id: weatherAt(now()), prev: null, changed: false, nextAt: nextChangeAt(now()), seq: 0 });
    }, 0);
    schedule();
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(timer);
      window.clearTimeout(fade);
    };
  }, [clockOffset]);

  /** 개발용: 다음 날씨 미리보기 (정시 전환과 같은 연출) */
  const preview = () => {
    if (!state) return;
    const id = WEATHER_ORDER[(WEATHER_ORDER.indexOf(state.id) + 1) % WEATHER_ORDER.length];
    setState({ ...state, id, prev: state.id, changed: true, seq: state.seq + 1 });
    onChangeRef.current?.(id);
    window.setTimeout(() => setState((s) => (s ? { ...s, prev: null } : s)), FADE_MS + 200);
  };

  return { weather: state, preview };
}

/* ---------------- 맵 위 날씨 효과 (월드 좌표, 펭귄 위 · 이름표 아래) ---------------- */
function Effect({ id }: { id: WeatherId }) {
  switch (id) {
    case "clear":
      return (
        <>
          <div className="wx-sun absolute inset-0" />
          <div className="absolute inset-0 bg-[#fff2cf]/[.07]" />
        </>
      );
    case "snow":
      return <div className="snowfall absolute inset-0" />;
    case "blizzard":
      return (
        <>
          <div className="absolute inset-0 bg-[#eef6fa]/30" />
          <div className="wx-wind absolute inset-y-0 -left-full w-[200%]" />
          <div className="wx-blizzard absolute inset-0" />
          <div className="wx-blizzard wx-blizzard-2 absolute inset-0" />
        </>
      );
    case "aurora":
      return (
        <>
          <div className="absolute inset-0 bg-[#06123a]/40" />
          <div className="wx-aurora absolute inset-x-0 top-0 h-[55%]" />
          <div className="wx-stars absolute inset-0" />
        </>
      );
    case "fog":
      return (
        <>
          <div className="absolute inset-0 bg-[#e9f2f6]/25" />
          <div className="wx-fog absolute inset-y-0 -left-full w-[200%]" />
          <div className="wx-fog wx-fog-2 absolute inset-y-0 -left-full w-[200%]" />
        </>
      );
    case "diamond":
      return (
        <>
          <div className="wx-sun absolute inset-0" />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${LANDSCAPE.w} ${LANDSCAPE.h}`} aria-hidden="true">
            {/* 햇무리와 환일(선독) */}
            <circle cx="1840" cy="40" r="22" fill="#fffbe6" opacity=".9" />
            <circle cx="1840" cy="40" r="92" fill="none" stroke="#fff6d1" strokeWidth="6" opacity=".45" />
            <circle cx="1840" cy="40" r="98" fill="none" stroke="#f6a894" strokeWidth="2" opacity=".35" />
            <circle cx="1748" cy="40" r="8" fill="#fff" opacity=".85" className="twinkle" />
            <circle cx="1932" cy="40" r="8" fill="#fff" opacity=".85" className="twinkle" style={{ animationDelay: ".8s" }} />
          </svg>
          <div className="wx-diamond absolute inset-0" />
          <div className="wx-diamond wx-diamond-2 absolute inset-0" />
        </>
      );
  }
}

export function WeatherLayer({ weather }: { weather: WeatherState | null }) {
  if (!weather) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {weather.prev && (
        <div key={`out-${weather.seq}`} className="wx-out absolute inset-0">
          <Effect id={weather.prev} />
        </div>
      )}
      <div key={`in-${weather.seq}`} className={`${weather.changed ? "wx-in" : ""} absolute inset-0`}>
        <Effect id={weather.id} />
      </div>
    </div>
  );
}

/* ---------------- 날씨가 바뀔 때 배너 (화면 좌표) ---------------- */
export function WeatherBanner({ weather }: { weather: WeatherState | null }) {
  if (!weather?.changed) return null;
  const w = WEATHERS[weather.id];
  const hour = new Date(weather.nextAt - 3_600_000).toLocaleTimeString("ko-KR", { hour: "numeric", hour12: false });
  return (
    <div
      key={weather.seq}
      role="status"
      className="wx-banner pointer-events-none absolute left-1/2 top-14 z-30 flex items-center gap-3 rounded-2xl border border-white/15 bg-ink-900/85 px-5 py-3 shadow-2xl backdrop-blur"
    >
      <span className="wx-banner-emoji text-4xl" aria-hidden="true">
        {w.emoji}
      </span>
      <div>
        <p className="text-xs font-bold text-brand-200">{hour} 남극 날씨</p>
        <p className="text-lg font-extrabold text-white">
          {w.label} <span className="text-sm font-bold text-ink-200">· {w.announce}</span>
        </p>
      </div>
    </div>
  );
}

/* ---------------- 상단 날씨 칩 ---------------- */
export function WeatherChip({ weather, onPreview }: { weather: WeatherState | null; onPreview?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (!weather) return null;
  const w = WEATHERS[weather.id];
  const mins = now === null ? null : Math.max(1, Math.ceil((weather.nextAt - now) / 60_000));
  const dev = process.env.NODE_ENV === "development";
  return (
    <button
      type="button"
      onClick={dev ? onPreview : undefined}
      title={dev ? "개발 모드: 눌러서 다음 날씨 미리보기" : "날씨는 매시 정각에 바뀌어요"}
      className={`flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-ink-100 ${dev ? "hover:bg-white/20" : "cursor-default"}`}
    >
      <span aria-hidden="true">{w.emoji}</span>
      {w.label}
      {mins !== null && <span className="font-medium text-ink-400">· {mins}분 뒤 바뀜</span>}
    </button>
  );
}
