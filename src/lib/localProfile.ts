/**
 * 임시 입장 정보 — Google 로그인(마지막 단계)으로 교체될 예정.
 * 닉네임·역할은 브라우저에 저장하고, 탭마다 다른 펭귄 ID를 써서 탭 여러 개로 다중 접속을 테스트할 수 있게 합니다.
 */
import type { Role } from "@/shared/protocol";

export interface LocalProfile {
  name: string;
  role: Role;
}

const PROFILE_KEY = "adelie.profile";
const TAB_ID_KEY = "adelie.tabId";

export function loadProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LocalProfile;
    return typeof p?.name === "string" ? p : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: LocalProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

/** 탭별 고유 ID (새로고침해도 유지, 탭마다 다름) */
export function tabPlayerId(): string {
  let id = sessionStorage.getItem(TAB_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, id);
  }
  return id;
}

export function realtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? `${location.protocol}//${location.hostname}:3001`;
}
