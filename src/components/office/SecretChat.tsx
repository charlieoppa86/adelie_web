"use client";

/**
 * 비밀 대화 UI — 받은 신청 카드 · 보낸 신청 카드 · 1:1 대화창.
 * 대화 내용은 두 펭귄의 화면에만 있고, 대화가 끝나면 사라집니다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Penguin } from "@/components/penguin/Penguin";
import { DM_MAX, REPORT_REASONS, REPORT_THRESHOLD, type DmMessage, type PeerInfo, type ReportReason } from "@/shared/protocol";
import { ROLE_LABEL, formatClock } from "./presence";

export interface DmRequestView {
  requestId: string;
  peer: PeerInfo;
  /** 남은 시간(ms) — 받은 시점에 계산해 카운트다운 바에 씀 */
  remainingMs: number;
}

export interface DmSessionView {
  sessionId: string;
  peer: PeerInfo;
  startedAt: number;
  messages: DmMessage[];
  minimized: boolean;
  unread: number;
}

function Countdown({ ms, tone }: { ms: number; tone: "coral" | "brand" }) {
  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={`dm-countdown h-full ${tone === "coral" ? "bg-coral-400" : "bg-brand-400"}`}
        style={{ animationDuration: `${Math.max(0, ms)}ms` }}
      />
    </div>
  );
}

/* ---------------- 받은 신청 ---------------- */
export function IncomingRequestCard({ req, onRespond }: { req: DmRequestView; onRespond: (accept: boolean) => void }) {
  return (
    <div
      role="alertdialog"
      aria-labelledby={`dm-in-${req.requestId}`}
      className="dm-pop w-80 rounded-2xl border border-coral-400/40 bg-ink-900/95 p-4 shadow-2xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 shrink-0">
          <Penguin cap={req.peer.role === "teacher"} expr="happy" anim={["bounce"]} />
        </div>
        <div className="min-w-0">
          <p id={`dm-in-${req.requestId}`} className="font-extrabold text-white">
            🔒 비밀 대화 신청
          </p>
          <p className="text-sm text-ink-200">
            <strong className="text-coral-200">{req.peer.name}</strong> ({ROLE_LABEL[req.peer.role]}) 님이 둘만의 대화를 원해요
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="rounded-xl bg-white/10 py-2 text-sm font-bold text-ink-200 hover:bg-white/15"
        >
          거절
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => onRespond(true)}
          className="rounded-xl bg-coral-500 py-2 text-sm font-bold text-white hover:bg-coral-400"
        >
          수락하기
        </button>
      </div>
      <Countdown ms={req.remainingMs} tone="coral" />
    </div>
  );
}

/* ---------------- 보낸 신청 ---------------- */
export function OutgoingRequestCard({ req, onCancel }: { req: DmRequestView; onCancel: () => void }) {
  return (
    <div
      className="dm-pop w-72 rounded-2xl border border-white/10 bg-ink-900/90 p-3 shadow-xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      role="status"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-100">
          🔒 <strong className="text-white">{req.peer.name}</strong> 님의 답을 기다리는 중…
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-ink-300 hover:bg-white/10 hover:text-white"
        >
          취소
        </button>
      </div>
      <Countdown ms={req.remainingMs} tone="brand" />
    </div>
  );
}

/* ---------------- 대화창 ---------------- */
interface PanelProps {
  session: DmSessionView;
  selfId: string;
  onSend: (text: string) => void;
  onLeave: () => void;
  onToggle: () => void;
  onReport: (reason: ReportReason, detail: string, endChat: boolean) => void;
}

export function SecretChatPanel({ session, selfId, onSend, onLeave, onToggle, onReport }: PanelProps) {
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length, session.minimized]);

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 110)}px`;
  }, [text]);

  if (session.minimized) {
    return (
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        className="dm-pop flex items-center gap-2 rounded-full border border-coral-400/40 bg-ink-900/95 px-4 py-2.5 text-sm font-bold text-white shadow-2xl"
      >
        🔒 {session.peer.name} 님과 비밀 대화
        {session.unread > 0 && <span className="rounded-full bg-coral-500 px-2 py-0.5 text-xs">{session.unread}</span>}
      </button>
    );
  }

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <section
      aria-label={`${session.peer.name} 님과 비밀 대화`}
      className="dm-pop relative flex h-full w-80 flex-col overflow-hidden rounded-2xl border border-coral-400/40 bg-ink-900/95 shadow-2xl backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="w-8 shrink-0">
          <Penguin cap={session.peer.role === "teacher"} expr="happy" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-white">🔒 {session.peer.name}</p>
          <p className="text-[11px] text-coral-200">두 펭귄만 볼 수 있어요</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="대화창 접기"
          className="rounded-lg px-2 py-1 text-ink-300 hover:bg-white/10 hover:text-white"
        >
          —
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-lg px-2 py-1 text-xs font-bold text-ink-300 hover:bg-coral-500/20 hover:text-coral-200"
        >
          나가기
        </button>
      </header>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] leading-relaxed text-ink-300">
          {formatClock(session.startedAt)} · {session.peer.name} 님과 비밀 대화를 시작했어요.
          <br />
          대화가 끝나면 내용은 사라져요.
        </p>
        {session.messages.map((m) => {
          const mine = m.from === selfId;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <p
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                  mine ? "rounded-br-md bg-coral-500 text-white" : "rounded-bl-md bg-white/10 text-ink-100"
                }`}
              >
                {m.text}
              </p>
              <span className="mt-0.5 px-1 text-[10px] text-ink-500">{formatClock(m.at)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-2">
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-ink-800 p-1.5 pl-3 focus-within:border-coral-400">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            maxLength={DM_MAX}
            placeholder={`${session.peer.name} 님에게만 보내기`}
            aria-label="비밀 메시지 입력"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              } else if (e.key === "Escape") e.currentTarget.blur();
            }}
            className="max-h-[110px] min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-white outline-none placeholder:text-ink-500"
          />
          <button
            type="button"
            onClick={send}
            disabled={!text.trim()}
            aria-label="비밀 메시지 보내기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-coral-500 text-white hover:bg-coral-400 disabled:bg-white/10 disabled:text-ink-500"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-ink-500">
          <span>Enter 보내기 · Shift+Enter 줄바꿈</span>
          <button type="button" onClick={() => setReporting(true)} className="font-bold text-ink-400 hover:text-coral-300">
            🚨 신고하기
          </button>
        </div>
      </div>
      {reporting && (
        <ReportDialog
          peerName={session.peer.name}
          onCancel={() => setReporting(false)}
          onSubmit={(reason, detail, endChat) => {
            onReport(reason, detail, endChat);
            setReporting(false);
          }}
        />
      )}
    </section>
  );
}

/* ---------------- 신고 양식 (대화창 안 오버레이) ---------------- */
function ReportDialog({
  peerName,
  onCancel,
  onSubmit,
}: {
  peerName: string;
  onCancel: () => void;
  onSubmit: (reason: ReportReason, detail: string, endChat: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [endChat, setEndChat] = useState(true);
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-ink-900/97 p-4" role="dialog" aria-labelledby="report-title">
      <p id="report-title" className="font-extrabold text-white">
        🚨 {peerName} 님 신고하기
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-300">
        신고하면 지금까지의 이 대화 내용이 운영진 확인용으로 저장돼요. 서로 다른 {REPORT_THRESHOLD}명 이상에게 신고되면 관리자가 확인하고
        퇴장시킬 수 있어요. 상대에게는 알리지 않아요.
      </p>
      <fieldset className="mt-3 space-y-1.5">
        <legend className="sr-only">신고 이유</legend>
        {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([value, label]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-ink-100 has-checked:border-coral-400 has-checked:bg-coral-500/15"
          >
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="accent-coral-500"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder="(선택) 운영진이 알아야 할 내용"
        aria-label="신고 내용"
        className="mt-3 resize-none rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none placeholder:text-ink-500 focus:border-coral-400"
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-200">
        <input type="checkbox" checked={endChat} onChange={(e) => setEndChat(e.target.checked)} className="accent-coral-500" />
        신고하고 이 대화 끝내기
      </label>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
        <button type="button" onClick={onCancel} className="rounded-xl bg-white/10 py-2 text-sm font-bold text-ink-200 hover:bg-white/15">
          취소
        </button>
        <button
          type="button"
          disabled={!reason}
          onClick={() => reason && onSubmit(reason, detail, endChat)}
          className="rounded-xl bg-coral-500 py-2 text-sm font-bold text-white hover:bg-coral-400 disabled:bg-white/10 disabled:text-ink-500"
        >
          신고하기
        </button>
      </div>
    </div>
  );
}
