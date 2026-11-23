"use client";

/**
 * 관리자 신고 확인 패널 — 서로 다른 신고자가 기준 인원 이상인 펭귄만 보이고,
 * 신고된 비밀 대화의 스냅샷만 열람할 수 있어요.
 */
import { useState } from "react";
import { REPORT_REASONS, REPORT_THRESHOLD, type ModerationFlag } from "@/shared/protocol";
import { formatClock } from "./presence";

interface Props {
  flags: ModerationFlag[];
  onKick: (targetKey: string) => void;
  onDismiss: (targetKey: string) => void;
  onClose: () => void;
}

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function AdminPanel({ flags, onKick, onDismiss, onClose }: Props) {
  return (
    <section
      aria-labelledby="admin-title"
      className="dm-pop flex h-full w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-coral-400/40 bg-ink-900/97 shadow-2xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex-1">
          <h2 id="admin-title" className="font-extrabold text-white">
            🛡️ 신고 확인
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-300">
            서로 다른 {REPORT_THRESHOLD}명 이상에게 신고된 펭귄만 보여요. 신고된 비밀 대화만 열람할 수 있어요.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-ink-400 hover:text-white">
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {flags.length === 0 && (
          <p className="rounded-xl bg-white/5 px-4 py-8 text-center text-sm text-ink-300">확인이 필요한 신고가 없어요 🐧</p>
        )}
        {flags.map((f) => (
          <FlagCard key={f.targetKey} flag={f} onKick={() => onKick(f.targetKey)} onDismiss={() => onDismiss(f.targetKey)} />
        ))}
      </div>
    </section>
  );
}

function FlagCard({ flag, onKick, onDismiss }: { flag: ModerationFlag; onKick: () => void; onDismiss: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <article className="rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex items-center gap-2">
        <p className="font-extrabold text-white">{flag.targetName}</p>
        <span
          className={`rounded px-1.5 text-[10px] font-bold ${flag.online ? "bg-aurora-green/15 text-aurora-green" : "bg-white/10 text-ink-300"}`}
        >
          {flag.online ? "접속 중" : "오프라인"}
        </span>
        <span className="ml-auto rounded-full bg-coral-500/25 px-2 py-0.5 text-[11px] font-bold text-coral-200">
          신고자 {flag.reporterCount}명 · {flag.reports.length}건
        </span>
      </div>

      <ul className="mt-2 space-y-2">
        {flag.reports.map((r) => (
          <li key={r.id} className="rounded-lg bg-ink-800/80 p-2.5">
            <p className="text-xs text-ink-200">
              <strong className="text-coral-200">{REPORT_REASONS[r.reason]}</strong> · 신고자 {r.reporterName} · {dateTime(r.at)}
            </p>
            {r.detail && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-100">“{r.detail}”</p>}
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[11px] font-bold text-brand-300">신고된 대화 보기 ({r.snapshot.length}개)</summary>
              <ol className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md bg-black/20 p-2">
                {r.snapshot.length === 0 && <li className="text-[11px] text-ink-400">주고받은 메시지가 없어요.</li>}
                {r.snapshot.map((m, i) => (
                  <li key={i} className="text-[11px] leading-snug">
                    <span className="text-ink-500">{formatClock(m.at)}</span>{" "}
                    <strong className={m.from === flag.targetName ? "text-coral-300" : "text-ink-200"}>{m.from}</strong>
                    <span className="text-ink-100">: {m.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onDismiss} className="rounded-xl bg-white/10 py-2 text-xs font-bold text-ink-200 hover:bg-white/15">
          문제없음 처리
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={onKick}
            onBlur={() => setConfirming(false)}
            autoFocus
            className="rounded-xl bg-coral-600 py-2 text-xs font-bold text-white"
          >
            정말 퇴장시키기 (24시간)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-xl bg-coral-500/25 py-2 text-xs font-bold text-coral-100 hover:bg-coral-500/40"
          >
            🚪 퇴장시키기
          </button>
        )}
      </div>
    </article>
  );
}
