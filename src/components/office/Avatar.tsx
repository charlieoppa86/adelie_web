"use client";

import { memo } from "react";
import { Penguin } from "@/components/penguin/Penguin";
import type { ChatMessage, PlayerState } from "@/shared/protocol";
import { presenceOf } from "./presence";

export const AVATAR_W = 64;
/** 펭귄 그림에서 발이 닿는 높이 (viewBox 250 중 ~232 지점) */
const FOOT_Y = Math.round((AVATAR_W * 232) / 240);
const BODY_H = Math.round((AVATAR_W * 250) / 240);
/** 이름표 레이어는 소품·빈자리 표시보다 항상 위 */
export const LABEL_Z = 3000;

export type AvatarPart = "body" | "label";

export interface Bubble {
  msg: ChatMessage;
  /** 내가 태그됐는지 */
  mentionsMe: boolean;
}

/** 본문의 @닉네임 중 실제 태그된 것만 강조 */
export function MentionText({ text, mentions, selfName }: { text: string; mentions: ChatMessage["mentions"]; selfName?: string }) {
  const names = new Set(mentions.map((m) => m.name.toLowerCase()));
  const parts = text.split(/(@[가-힣a-zA-Z0-9_]{2,12})/g);
  return (
    <>
      {parts.map((part, i) => {
        const name = part.startsWith("@") ? part.slice(1).toLowerCase() : null;
        if (!name || !names.has(name)) return part;
        const me = selfName && name === selfName.toLowerCase();
        return (
          <span key={i} className={`rounded px-0.5 font-extrabold ${me ? "bg-coral-100 text-coral-700" : "bg-brand-100 text-brand-700"}`}>
            {part}
          </span>
        );
      })}
    </>
  );
}

interface Props {
  player: PlayerState;
  isSelf: boolean;
  jumping: boolean;
  selected: boolean;
  bubble?: Bubble;
  /** 누군가 지금 이 펭귄을 @로 부르는 중 */
  called: boolean;
  /** 비밀 대화 중 — 다른 펭귄에게는 🔒 표시만 보임 */
  locked: boolean;
  selfName?: string;
  /** 위치는 게임 루프가 style.transform으로 직접 갱신합니다 (리렌더 없이) */
  setEl: (id: string, part: AvatarPart, el: HTMLDivElement | null) => void;
  onSelect: (id: string) => void;
}

/**
 * 펭귄 한 마리 = 몸통(테이블·책상과 y 기준 깊이 정렬) + 이름표·상태(항상 위에 표시).
 * 테이블 뒤에 앉아도 몸은 가려지고 이름은 보입니다.
 */
export const Avatar = memo(function Avatar({
  player,
  isSelf,
  jumping,
  selected,
  bubble,
  called,
  locked,
  selfName,
  setEl,
  onSelect,
}: Props) {
  const { pose, anim, status } = presenceOf(player);
  const transform = `translate3d(${player.x}px, ${player.y}px, 0)`;
  const select = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(player.id);
  };
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <>
      <div
        ref={(el) => setEl(player.id, "body", el)}
        className="absolute left-0 top-0 will-change-transform"
        style={{ transform, zIndex: Math.round(player.y) }}
      >
        <button
          type="button"
          onPointerDown={stop}
          onClick={select}
          aria-label={`${player.name} (${status.label})`}
          className="absolute outline-none"
          style={{ left: -AVATAR_W / 2, top: -FOOT_Y, width: AVATAR_W, height: BODY_H }}
        >
          {called && (
            <span
              aria-hidden="true"
              className="called-ring absolute left-1/2 rounded-[50%] border-4 border-coral-400"
              style={{ top: FOOT_Y - 12, width: AVATAR_W, height: 24 }}
            />
          )}
          {(selected || isSelf) && (
            <span
              aria-hidden="true"
              className={`absolute left-1/2 -translate-x-1/2 rounded-[50%] ${selected ? "bg-aurora-green/60" : "bg-coral-400/45"}`}
              style={{ top: FOOT_Y - 7, width: AVATAR_W * 0.9, height: 14 }}
            />
          )}
          <div style={{ transform: player.dir === -1 ? "scaleX(-1)" : undefined }}>
            <Penguin {...pose} anim={anim} jumping={jumping} delay={(player.id.charCodeAt(0) % 7) * 0.13} />
          </div>
        </button>
      </div>

      <div
        ref={(el) => setEl(player.id, "label", el)}
        className="pointer-events-none absolute left-0 top-0 will-change-transform"
        style={{ transform, zIndex: LABEL_Z + Math.round(player.y) }}
        aria-hidden="true"
      >
        {bubble ? (
          // 바깥: 화면 배율 보정(발 위 기준점에서 확대) · 안쪽: 팝 애니메이션 + 가운데 정렬
          <div className="absolute left-0 w-0" style={{ bottom: FOOT_Y + 10, scale: "var(--ui, 1)", transformOrigin: "0 100%" }}>
            <div
              key={bubble.msg.id}
              className={`bubble-pop relative w-max max-w-[220px] rounded-2xl px-3 py-2 text-[13px] font-semibold leading-snug text-ink-900 shadow-lg ${
                bubble.mentionsMe ? "bg-coral-50 ring-2 ring-coral-400" : "bg-white"
              }`}
            >
              <p className="line-clamp-4 whitespace-pre-wrap break-words">
                <MentionText text={bubble.msg.text} mentions={bubble.msg.mentions} selfName={selfName} />
              </p>
              <span
                aria-hidden="true"
                className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 ${bubble.mentionsMe ? "bg-coral-50" : "bg-white"}`}
              />
            </div>
          </div>
        ) : (
          <span
            className={`absolute h-5 -translate-x-1/2 whitespace-nowrap rounded-full px-2 text-[11px] font-bold leading-5 text-white shadow ${
              locked ? "bg-coral-600/90" : "bg-ink-900/75"
            }`}
            style={{ top: -FOOT_Y - 22, scale: "var(--ui, 1)", transformOrigin: "50% 100%" }}
          >
            {called ? "📣 부르는 중" : locked ? "🔒 비밀 대화 중" : `${status.emoji} ${status.label}`}
          </span>
        )}
        <span
          onPointerDown={stop}
          onClick={select}
          style={{ scale: "var(--ui, 1)", transformOrigin: "50% 0" }}
          className={`pointer-events-auto absolute top-0.5 -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-extrabold shadow ${
            isSelf
              ? "bg-coral-500 text-white"
              : player.role === "teacher"
                ? "bg-brand-700 text-white"
                : player.role === "admin"
                  ? "bg-ink-700 text-white"
                  : "bg-white text-ink-900"
          }`}
        >
          {player.role === "teacher" && "🎓 "}
          {player.role === "admin" && "🛡️ "}
          {player.name}
        </span>
      </div>
    </>
  );
});
