"use client";

import type { ReactNode } from "react";

export type SideTab = "chat" | "attendance";

/** 오른쪽 패널: 채팅 / 출석부 탭 — 입장하면 펼쳐진 채로 시작, 접을 수 있음 */
export function SidePanel(props: {
  tab: SideTab;
  onTab: (t: SideTab) => void;
  onCollapse: () => void;
  /** 채팅 탭을 안 보는 동안 쌓인 다른 펭귄의 말 (나를 부른 말이 있으면 빨간 배지) */
  unread: { count: number; mention: boolean };
  online: number;
  chat: ReactNode;
  composer: ReactNode;
  attendance: ReactNode;
}) {
  const { tab, unread } = props;
  const tabCls = (on: boolean) =>
    `relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition ${
      on ? "text-white" : "text-ink-400 hover:text-ink-200"
    }`;

  return (
    <section aria-label="채팅 · 출석부" className="flex h-full flex-col">
      <div className="flex shrink-0 items-stretch border-b border-white/10" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "chat"} aria-controls="side-chat" onClick={() => props.onTab("chat")} className={tabCls(tab === "chat")}>
          💬 채팅
          {tab !== "chat" && unread.count > 0 && (
            <span
              className={`min-w-5 rounded-full px-1.5 text-[10px] leading-4 text-white ${unread.mention ? "bg-coral-500" : "bg-brand-500"}`}
              aria-label={`안 읽은 말 ${unread.count}개`}
            >
              {unread.count > 99 ? "99+" : unread.count}
            </span>
          )}
          {tab === "chat" && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded bg-brand-400" />}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "attendance"}
          aria-controls="side-attendance"
          onClick={() => props.onTab("attendance")}
          className={tabCls(tab === "attendance")}
        >
          📋 출석부 <span className="text-xs text-aurora-green">{props.online}</span>
          {tab === "attendance" && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded bg-brand-400" />}
        </button>
        <button
          type="button"
          onClick={props.onCollapse}
          title="패널 접기"
          aria-label="채팅 · 출석부 접기"
          className="w-9 shrink-0 text-ink-400 hover:bg-white/5 hover:text-white"
        >
          ›
        </button>
      </div>

      {tab === "chat" ? (
        <div id="side-chat" role="tabpanel" className="flex min-h-0 flex-1 flex-col">
          {props.chat}
        </div>
      ) : (
        <div id="side-attendance" role="tabpanel" className="min-h-0 flex-1">
          {props.attendance}
        </div>
      )}
      {/* 입력창은 두 탭 모두 아래에 그대로 (쓰던 글이 탭을 바꿔도 남음) */}
      <div className="shrink-0 border-t border-white/10 p-2">{props.composer}</div>
    </section>
  );
}
