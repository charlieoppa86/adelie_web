/** Socket.IO 실시간 서버 주소 — 말풍선·비밀 대화·신고가 Firebase로 옮겨지면(F3~F5) 없어질 예정입니다. */
export function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? `${location.protocol}//${location.hostname}:3001`;
}
