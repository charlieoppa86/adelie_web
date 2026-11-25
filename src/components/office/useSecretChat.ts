"use client";

import { useMemo, useRef, useState, type RefObject } from "react";
import type { DmEvents, DmHandle } from "@/lib/dm";
import type { DmCloseReason, ReportReason } from "@/shared/protocol";
import type { DmRequestView, DmSessionView } from "./SecretChat";

const CLOSE_MSG: Record<DmCloseReason, { mine: (n: string) => string; theirs: (n: string) => string }> = {
  declined: { mine: (n) => `${n} 님이 비밀 대화를 거절했어요`, theirs: (n) => `${n} 님의 신청을 거절했어요` },
  timeout: { mine: (n) => `${n} 님의 답이 없어 신청이 만료됐어요`, theirs: (n) => `${n} 님의 신청이 만료됐어요` },
  busy: { mine: (n) => `${n} 님은 지금 다른 비밀 대화 중이에요`, theirs: () => "다른 비밀 대화가 시작돼 신청이 닫혔어요" },
  cancelled: { mine: () => "비밀 대화 신청을 취소했어요", theirs: (n) => `${n} 님이 신청을 취소했어요` },
  offline: { mine: (n) => `${n} 님이 스터디룸을 나갔어요`, theirs: (n) => `${n} 님이 스터디룸을 나갔어요` },
};

/**
 * 비밀 대화 화면 상태. events 를 startDm(…)에 넘기고, 동작은 dmRef 로 보냅니다.
 * serverNow 는 바뀌지 않는 함수(useCallback)여야 합니다.
 */
export function useSecretChat(dmRef: RefObject<DmHandle | null>, notify: (msg: string) => void, serverNow: () => number) {
  const [outgoing, setOutgoing] = useState<DmRequestView | null>(null);
  const [incoming, setIncoming] = useState<DmRequestView[]>([]);
  const [session, setSession] = useState<DmSessionView | null>(null);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  /** 신고하면서 끝낸 대화 — 종료 알림 대신 "신고 접수" 알림을 남김 */
  const reportedEnd = useRef<string | null>(null);

  const events = useMemo<DmEvents>(
    () => ({
      requested: (requestId, to, expiresAt) => setOutgoing({ requestId, peer: to, remainingMs: expiresAt - serverNow() }),
      incoming: (requestId, from, expiresAt) => {
        setIncoming((list) => [
          ...list.filter((r) => r.requestId !== requestId),
          { requestId, peer: from, remainingMs: expiresAt - serverNow() },
        ]);
        notify(`🔒 ${from.name} 님이 비밀 대화를 신청했어요`);
      },
      closed: (requestId, reason, peerName, mine) => {
        setOutgoing((o) => (o?.requestId === requestId ? null : o));
        setIncoming((list) => list.filter((r) => r.requestId !== requestId));
        notify(mine ? CLOSE_MSG[reason].mine(peerName) : CLOSE_MSG[reason].theirs(peerName));
      },
      started: (sessionId, peer, startedAt) => {
        setOutgoing(null);
        setIncoming([]);
        setSession({ sessionId, peer, startedAt, messages: [], minimized: false, unread: 0 });
        notify(`🔒 ${peer.name} 님과 비밀 대화를 시작했어요`);
      },
      message: (m) =>
        setSession((s) =>
          s && s.sessionId === m.sessionId
            ? { ...s, messages: [...s.messages, m].slice(-200), unread: s.minimized ? s.unread + 1 : 0 }
            : s,
        ),
      ended: (sessionId, byName, reason) => {
        setSession((s) => (s?.sessionId === sessionId ? null : s));
        if (reportedEnd.current === sessionId) {
          reportedEnd.current = null;
          return;
        }
        notify(
          reason === "mine"
            ? "🔒 비밀 대화를 마쳤어요 · 내용은 사라졌어요"
            : reason === "disconnected"
              ? `${byName} 님의 연결이 끊겨 비밀 대화가 끝났어요`
              : `🔒 ${byName} 님이 비밀 대화를 마쳤어요 · 내용은 사라졌어요`,
        );
      },
      locks: setPairs,
      notice: notify,
    }),
    [notify, serverNow],
  );

  /** 펭귄 ID → 비밀 대화 상대 ID */
  const partnerOf = useMemo(() => {
    const m = new Map<string, string>();
    pairs.forEach(([a, b]) => {
      m.set(a, b);
      m.set(b, a);
    });
    return m;
  }, [pairs]);

  return {
    events,
    outgoing,
    incoming,
    session,
    partnerOf,
    request: (to: string) => dmRef.current?.request(to),
    cancel: () => dmRef.current?.cancel(),
    respond: (requestId: string, accept: boolean) => {
      dmRef.current?.respond(requestId, accept);
      if (!accept) setIncoming((list) => list.filter((r) => r.requestId !== requestId));
    },
    send: (text: string) => dmRef.current?.send(text),
    leave: () => dmRef.current?.leave(),
    report: (reason: ReportReason, detail: string, endChat: boolean) => {
      const dm = dmRef.current;
      if (!dm || !session) return;
      if (endChat) reportedEnd.current = session.sessionId;
      void dm.report(reason, detail, endChat).then((r) => {
        if (r !== "ok" && endChat) reportedEnd.current = null;
        notify(
          r === "ok"
            ? "신고가 접수됐어요. 운영진이 확인할게요."
            : r === "duplicate"
              ? "이 대화는 이미 신고했어요."
              : "진행 중인 비밀 대화에서만 신고할 수 있어요.",
        );
      });
    },
    toggle: () => setSession((s) => (s ? { ...s, minimized: !s.minimized, unread: 0 } : s)),
    open: () => setSession((s) => (s ? { ...s, minimized: false, unread: 0 } : s)),
  };
}
