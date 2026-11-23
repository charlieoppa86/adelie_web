"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, DmCloseReason, ReportReason, ServerToClientEvents } from "@/shared/protocol";
import type { DmRequestView, DmSessionView } from "./SecretChat";

type IoClient = Socket<ServerToClientEvents, ClientToServerEvents>;

const CLOSE_MSG: Record<DmCloseReason, { mine: (n: string) => string; theirs: (n: string) => string }> = {
  declined: { mine: (n) => `${n} 님이 비밀 대화를 거절했어요`, theirs: (n) => `${n} 님의 신청을 거절했어요` },
  timeout: { mine: (n) => `${n} 님의 답이 없어 신청이 만료됐어요`, theirs: (n) => `${n} 님의 신청이 만료됐어요` },
  busy: { mine: (n) => `${n} 님은 지금 다른 비밀 대화 중이에요`, theirs: () => "다른 비밀 대화가 시작돼 신청이 닫혔어요" },
  cancelled: { mine: () => "비밀 대화 신청을 취소했어요", theirs: (n) => `${n} 님이 신청을 취소했어요` },
  offline: { mine: (n) => `${n} 님이 스터디룸을 나갔어요`, theirs: (n) => `${n} 님이 스터디룸을 나갔어요` },
};

/** 비밀 대화 상태 + 소켓 이벤트 처리. bind(socket)은 연결할 때 한 번 호출 */
export function useSecretChat(socketRef: RefObject<IoClient | null>, notify: (msg: string) => void) {
  const [outgoing, setOutgoing] = useState<DmRequestView | null>(null);
  const [incoming, setIncoming] = useState<DmRequestView[]>([]);
  const [session, setSession] = useState<DmSessionView | null>(null);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  /** 나에게 온 신청 ID — 닫힘 알림 문구를 고를 때 씀 */
  const incomingIds = useRef(new Set<string>());
  /** 내가 "나가기"를 누른 대화 — 종료 알림 문구용 */
  const leavingId = useRef<string | null>(null);
  /** 신고하면서 끝낸 대화 — 종료 알림 대신 "신고 접수" 알림을 남김 */
  const reportedEnd = useRef<string | null>(null);

  const bind = useCallback(
    (socket: IoClient) => {
      socket.on("dm:requested", ({ requestId, to, expiresAt }) =>
        setOutgoing({ requestId, peer: to, remainingMs: expiresAt - Date.now() }),
      );
      socket.on("dm:incoming", ({ requestId, from, expiresAt }) => {
        incomingIds.current.add(requestId);
        setIncoming((list) => [
          ...list.filter((r) => r.requestId !== requestId),
          { requestId, peer: from, remainingMs: expiresAt - Date.now() },
        ]);
        notify(`🔒 ${from.name} 님이 비밀 대화를 신청했어요`);
      });
      socket.on("dm:closed", ({ requestId, reason, peerName }) => {
        const mine = !incomingIds.current.delete(requestId);
        setOutgoing((o) => (o?.requestId === requestId ? null : o));
        setIncoming((list) => list.filter((r) => r.requestId !== requestId));
        notify(mine ? CLOSE_MSG[reason].mine(peerName) : CLOSE_MSG[reason].theirs(peerName));
      });
      socket.on("dm:started", ({ sessionId, peer, startedAt }) => {
        setOutgoing(null);
        setIncoming((list) => list.filter((r) => r.peer.id !== peer.id));
        setSession({ sessionId, peer, startedAt, messages: [], minimized: false, unread: 0 });
        notify(`🔒 ${peer.name} 님과 비밀 대화를 시작했어요`);
      });
      socket.on("dm:message", (m) =>
        setSession((s) =>
          s && s.sessionId === m.sessionId ? { ...s, messages: [...s.messages, m].slice(-200), unread: s.minimized ? s.unread + 1 : 0 } : s,
        ),
      );
      socket.on("dm:ended", ({ sessionId, byName, reason }) => {
        setSession((s) => (s?.sessionId === sessionId ? null : s));
        const mine = leavingId.current === sessionId;
        leavingId.current = null;
        if (reportedEnd.current === sessionId) {
          reportedEnd.current = null;
          return;
        }
        notify(
          mine
            ? "🔒 비밀 대화를 마쳤어요 · 내용은 사라졌어요"
            : reason === "disconnected"
              ? `${byName} 님의 연결이 끊겨 비밀 대화가 끝났어요`
              : `🔒 ${byName} 님이 비밀 대화를 마쳤어요 · 내용은 사라졌어요`,
        );
      });
      socket.on("dm:locks", ({ pairs }) => setPairs(pairs));
      socket.on("report:ack", ({ message }) => notify(message));
    },
    [notify],
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

  const emit = socketRef;
  return {
    bind,
    outgoing,
    incoming,
    session,
    partnerOf,
    request: (to: string) => emit.current?.emit("dm:request", { to }),
    cancel: () => outgoing && emit.current?.emit("dm:cancel", { requestId: outgoing.requestId }),
    respond: (requestId: string, accept: boolean) => {
      emit.current?.emit("dm:respond", { requestId, accept });
      if (!accept) setIncoming((list) => list.filter((r) => r.requestId !== requestId));
    },
    send: (text: string) => session && emit.current?.emit("dm:send", { sessionId: session.sessionId, text }),
    leave: () => {
      if (!session) return;
      leavingId.current = session.sessionId;
      emit.current?.emit("dm:leave", { sessionId: session.sessionId });
    },
    report: (reason: ReportReason, detail: string, endChat: boolean) => {
      if (!session) return;
      if (endChat) {
        leavingId.current = session.sessionId;
        reportedEnd.current = session.sessionId;
      }
      emit.current?.emit("report", { sessionId: session.sessionId, reason, detail, endChat });
    },
    toggle: () => setSession((s) => (s ? { ...s, minimized: !s.minimized, unread: 0 } : s)),
    open: () => setSession((s) => (s ? { ...s, minimized: false, unread: 0 } : s)),
  };
}
