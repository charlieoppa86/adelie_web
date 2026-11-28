"use client";

import { useEffect, useState } from "react";
import { Penguin } from "@/components/penguin/Penguin";
import { studyMsNow, type PlayerState } from "@/shared/protocol";
import { formatClock, formatDuration, presenceOf, ROLE_LABEL } from "./presence";

interface Props {
  players: PlayerState[];
  selfId: string | null;
  selectedId: string | null;
  clockOffset: number;
  onSelect: (id: string) => void;
}

/** 실시간 출석부 — 지금 스터디룸에 있는 펭귄과 오늘의 공부 시간 */
export function AttendancePanel({ players, selfId, selectedId, clockOffset, onSelect }: Props) {
  // 현재 시각은 마운트 후에만 읽음 (프리렌더 시점의 값이 굳지 않도록)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const serverNow = now === null ? null : now + clockOffset;

  const sorted = [...players].sort((a, b) => {
    const ra = a.role === "teacher" ? 0 : 1;
    const rb = b.role === "teacher" ? 0 : 1;
    return ra - rb || a.enteredAt - b.enteredAt;
  });
  const studying = players.filter((p) => presenceOf(p).status.studying).length;

  return (
    <section aria-labelledby="att-title" className="flex h-full flex-col">
      <header className="border-b border-white/10 px-4 py-3">
        <h2 id="att-title" className="text-sm font-extrabold text-white">
          오늘의 출석부
        </h2>
        <p className="mt-0.5 text-xs text-ink-300">
          지금 <strong className="text-aurora-green">{players.length}명</strong> 출석 · 공부 중{" "}
          <strong className="text-brand-300">{studying}명</strong>
        </p>
      </header>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {sorted.map((p) => {
          const { status, pose } = presenceOf(p);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5 ${
                  selectedId === p.id ? "bg-white/10" : ""
                }`}
              >
                <div className="relative w-9 shrink-0">
                  <Penguin cap={p.role === "teacher"} expr={status.studying || pose.shades ? undefined : "happy"} shades={pose.shades} />
                  <span
                    className={`absolute -right-0.5 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-ink-900 ${
                      status.studying ? "bg-aurora-green" : "bg-ink-300"
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-white">{p.name}</span>
                    <span
                      className={`shrink-0 rounded px-1 text-[10px] font-bold ${
                        p.role === "teacher" ? "bg-brand-500/25 text-brand-200" : "bg-white/10 text-ink-200"
                      }`}
                    >
                      {ROLE_LABEL[p.role]}
                    </span>
                    {p.id === selfId && (
                      <span className="shrink-0 rounded bg-coral-500/25 px-1 text-[10px] font-bold text-coral-200">나</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-300">
                    {status.emoji} {status.label}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    입장 {formatClock(p.enteredAt)} · 공부 {serverNow === null ? "—" : formatDuration(studyMsNow(p, serverNow))}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
