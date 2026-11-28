"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage, Role } from "@/shared/protocol";
import { MentionText } from "./Avatar";

/**
 * 실시간 채팅 한 줄.
 * DB 에는 펭귄마다 마지막 말 한 칸만 있어서(rooms/main/bubbles) 기록은 화면에서만 모음 —
 * 유튜브 라이브 채팅처럼 들어온 뒤의 대화만 보임 (추가 저장 · 전송 없음)
 */
export type ChatLine =
  | {
      kind: "msg";
      seq: number;
      id: string;
      playerId: string;
      name: string;
      role: Role;
      text: string;
      mentions: ChatMessage["mentions"];
      at: number;
      mine: boolean;
      mentionsMe: boolean;
    }
  | { kind: "system"; seq: number; id: string; text: string; at: number };

/** 새로 넣는 줄 (번호는 넣을 때 붙임) */
export type ChatLineInput = { [K in ChatLine["kind"]]: Omit<Extract<ChatLine, { kind: K }>, "seq"> }[ChatLine["kind"]];

/** 화면에 남겨 두는 최대 줄 수 (오래된 것부터 버림) */
export const CHAT_KEEP = 300;
/** 맨 아래에서 이만큼 안쪽이면 "맨 아래를 보는 중"으로 침 */
const STICK_PX = 48;

const time = (at: number) => new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function ChatFeed(props: { lines: ChatLine[]; selfName?: string; onSelect: (playerId: string) => void }) {
  const { lines, selfName, onSelect } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  /** 맨 아래를 보고 있으면 새 말을 따라 내려감. 위로 올려 읽는 중이면 그대로 두고 "새 메시지" 버튼 */
  const stick = useRef(true);
  const [newBelow, setNewBelow] = useState(0);
  const lastSeq = lines.at(-1)?.seq ?? 0;
  const seenSeq = useRef(lastSeq);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || lastSeq === seenSeq.current) return;
    if (stick.current) {
      box.scrollTop = box.scrollHeight;
      seenSeq.current = lastSeq;
    } else {
      const added = lines.filter((l) => l.seq > seenSeq.current && l.kind === "msg").length;
      // 렌더 중이 아니라 레이아웃 단계에서 한 번만 갱신
      queueMicrotask(() => setNewBelow(added));
    }
  }, [lastSeq, lines]);

  // 처음 보일 때(탭 전환 등) 맨 아래로
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, []);

  const toBottom = () => {
    const box = boxRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    stick.current = true;
    seenSeq.current = lastSeq;
    setNewBelow(0);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={boxRef}
        role="log"
        aria-live="polite"
        aria-label="실시간 채팅"
        onScroll={(e) => {
          const b = e.currentTarget;
          stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < STICK_PX;
          if (stick.current && newBelow) {
            seenSeq.current = lastSeq;
            setNewBelow(0);
          }
        }}
        className="h-full overflow-y-auto px-3 py-2"
      >
        {lines.length === 0 ? (
          <p className="mt-6 px-2 text-center text-xs leading-relaxed text-ink-400">
            아직 대화가 없어요.
            <br />
            아래 입력창에 말하면 여기와 내 펭귄 머리 위에 함께 떠요.
            <br />
            <span className="text-ink-500">들어온 뒤의 대화만 보여요.</span>
          </p>
        ) : (
          <ul className="space-y-1.5">
            {lines.map((l) =>
              l.kind === "system" ? (
                <li key={l.id} className="px-1 text-center text-[11px] text-ink-400">
                  {l.text}
                </li>
              ) : (
                <li
                  key={l.id}
                  className={`rounded-lg px-2 py-1 text-[13px] leading-5 ${
                    l.mentionsMe ? "bg-coral-500/15 ring-1 ring-coral-400/60" : l.mine ? "bg-white/5" : ""
                  }`}
                >
                  <span className="mr-1.5 text-[10px] tabular-nums text-ink-500">{time(l.at)}</span>
                  <button
                    type="button"
                    onClick={() => onSelect(l.playerId)}
                    className={`mr-1.5 font-bold hover:underline ${
                      l.mine ? "text-coral-300" : l.role === "teacher" ? "text-brand-300" : l.role === "admin" ? "text-aurora-green" : "text-ink-200"
                    }`}
                  >
                    {l.role === "teacher" && <span aria-label="강사">🎓 </span>}
                    {l.name}
                  </button>
                  <span className="whitespace-pre-wrap break-words text-white">
                    <MentionText text={l.text} mentions={l.mentions} selfName={selfName} />
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
      {newBelow > 0 && (
        <button
          type="button"
          onClick={toBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white shadow-lg hover:bg-brand-400"
        >
          새 메시지 {newBelow}개 ↓
        </button>
      )}
    </div>
  );
}
