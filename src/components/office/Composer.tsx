"use client";

import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { Penguin } from "@/components/penguin/Penguin";
import { CHAT_MAX, type PlayerState } from "@/shared/protocol";
import { ROLE_LABEL } from "./presence";

export interface ComposerHandle {
  /** 입력창에 @닉네임을 넣고 포커스 */
  mention: (name: string) => void;
  focus: () => void;
}

interface Props {
  ref?: Ref<ComposerHandle>;
  players: PlayerState[];
  selfId: string | null;
  disabled: boolean;
  onSend: (text: string) => void;
}

/** 커서 앞의 "@검색어" (공백·줄 시작 뒤에서만 — 이메일 같은 건 무시) */
const MENTION_QUERY = /(^|\s)@([가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_]*)$/;
const MAX_ROWS_PX = 132;

/**
 * 하단 말하기 창 — LLM 프롬프트창처럼 쓰고 Enter로 보내면 내 펭귄 머리 위에 말풍선이 떠요.
 * @를 입력하면 지금 접속 중인 펭귄을 자동완성으로 태그할 수 있어요.
 */
export function Composer({ ref, players, selfId, disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [active, setActive] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // 높이 자동 조절 + 멘션 삽입 후 커서 위치 복원
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_ROWS_PX)}px`;
    if (pendingCaret.current !== null) {
      ta.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  const candidates = useMemo(() => {
    if (!query) return [];
    const q = query.q.toLowerCase();
    return players
      .filter((p) => p.id !== selfId && p.name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name, "ko"),
      )
      .slice(0, 6);
  }, [players, selfId, query]);
  const open = candidates.length > 0;

  const readQuery = (value: string, caret: number) => {
    const m = MENTION_QUERY.exec(value.slice(0, caret));
    setQuery(m ? { start: caret - m[2].length - 1, q: m[2] } : null);
    setActive(0);
  };

  const insertMention = (name: string, start: number, end: number) => {
    const before = text.slice(0, start);
    const after = text.slice(end).replace(/^\s+/, "");
    const token = `@${name} `;
    const next = (before + token + after).slice(0, CHAT_MAX);
    pendingCaret.current = Math.min(next.length, before.length + token.length);
    setText(next);
    setQuery(null);
    taRef.current?.focus();
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => taRef.current?.focus(),
      mention: (name: string) => {
        const ta = taRef.current;
        const caret = ta ? ta.selectionEnd : text.length;
        const needsSpace = caret > 0 && !/\s/.test(text[caret - 1] ?? "");
        const before = text.slice(0, caret) + (needsSpace ? " " : "");
        const token = `@${name} `;
        const next = (before + token + text.slice(caret)).slice(0, CHAT_MAX);
        pendingCaret.current = Math.min(next.length, before.length + token.length);
        setText(next);
        ta?.focus();
      },
    }),
    [text],
  );

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
    setQuery(null);
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* @ 자동완성 */}
      {open && query && (
        <ul
          role="listbox"
          id="mention-list"
          aria-label="부를 펭귄 고르기"
          className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-ink-800/95 p-1 shadow-2xl backdrop-blur"
        >
          {candidates.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // 입력창 포커스 유지
                  insertMention(p.name, query.start, taRef.current?.selectionEnd ?? text.length);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-sm ${i === active ? "bg-brand-500/25" : ""}`}
              >
                <span className="w-7 shrink-0">
                  <Penguin cap={p.role === "teacher"} expr="happy" />
                </span>
                <span className="font-bold text-white">@{p.name}</span>
                <span className="ml-auto text-[11px] text-ink-400">{ROLE_LABEL[p.role]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-ink-800/90 p-2 pl-4 shadow-2xl transition focus-within:border-brand-400 focus-within:shadow-brand">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          maxLength={CHAT_MAX}
          disabled={disabled}
          placeholder="모두에게 말하기… @로 펭귄을 불러보세요"
          aria-label="말풍선으로 말하기"
          aria-autocomplete="list"
          aria-controls={open ? "mention-list" : undefined}
          onChange={(e) => {
            setText(e.target.value);
            readQuery(e.target.value, e.target.selectionEnd);
          }}
          onSelect={(e) => readQuery(e.currentTarget.value, e.currentTarget.selectionEnd)}
          onBlur={() => setQuery(null)}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter는 글자 확정용 — 보내지 않음
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (open && query) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const d = e.key === "ArrowDown" ? 1 : -1;
                setActive((a) => (a + d + candidates.length) % candidates.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(candidates[active].name, query.start, e.currentTarget.selectionEnd);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            } else if (e.key === "Escape") e.currentTarget.blur();
          }}
          className="max-h-[132px] min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          disabled={disabled || !text.trim()}
          aria-label="보내기"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-400 disabled:bg-white/10 disabled:text-ink-500"
        >
          <svg
            width="18"
            height="18"
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
      <div className="mt-1.5 flex items-center justify-between gap-3 px-2 text-[11px] text-ink-400">
        <span>
          <kbd className="font-bold text-ink-200">Enter</kbd> 보내기 · <kbd className="font-bold text-ink-200">Shift+Enter</kbd> 줄바꿈 ·{" "}
          <kbd className="font-bold text-ink-200">@닉네임</kbd>으로 부르기 · 말풍선은 6초 뒤 사라져요
        </span>
        <span className="hidden shrink-0 sm:inline">
          <kbd className="font-bold text-ink-200">WASD</kbd> 이동 · <kbd className="font-bold text-ink-200">Space</kbd> 점프 ·{" "}
          <span className={text.length > CHAT_MAX - 20 ? "text-coral-300" : ""}>
            {text.length}/{CHAT_MAX}
          </span>
        </span>
      </div>
    </div>
  );
}
