/**
 * 계정: Google 로그인 + Realtime Database 프로필(users/{uid}) + 닉네임 예약(nicknames/{소문자 닉네임}).
 * 규칙은 firebase/database.rules.json 참고.
 *
 * - 닉네임 변경: 30일에 2번까지 (nameChangedAt · prevNameChangedAt 로 규칙이 셈)
 *   옛 닉네임 예약은 지우지 않아 다른 펭귄이 쓸 수 없음 — 나는 다시 그 이름으로 돌아갈 수 있음
 * - 회원 탈퇴: 신청하면 7일 유예(deleteAt) 뒤 서버가 지움. 그 전에 다시 로그인해 취소하면 복구 (functions/account.js)
 */
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { get, onValue, ref, remove, serverTimestamp, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";
import { cloudFunctions, firebaseAuth, rtdb } from "@/lib/firebase";
import { NICKNAME_RE, type Role } from "@/shared/protocol";

/** 닉네임은 이 기간에 RENAME_LIMIT 번까지 바꿀 수 있음 (규칙과 같은 값) */
export const RENAME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const RENAME_LIMIT = 2;

export interface AccountProfile {
  name: string;
  role: Role;
  /** 마지막 · 그 전 닉네임 변경 시각 */
  nameChangedAt?: number;
  prevNameChangedAt?: number;
  /** 탈퇴 신청 중이면 이 시각에 계정이 지워짐 */
  deleteAt?: number;
}

export type AccountState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "needsProfile"; user: User }
  | { status: "pendingDeletion"; user: User; profile: AccountProfile; deleteAt: number }
  | { status: "ready"; user: User; profile: AccountProfile };

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

export async function loadAccountProfile(uid: string): Promise<AccountProfile | null> {
  const snap = await get(ref(rtdb(), `users/${uid}`));
  if (!snap.exists()) return null;
  const d = snap.val();
  return {
    name: String(d.name),
    role: (d.role as Role) ?? "student",
    nameChangedAt: num(d.nameChangedAt),
    prevNameChangedAt: num(d.prevNameChangedAt),
    deleteAt: num(d.deleteAt),
  };
}

/** 로그인 상태와 프로필을 함께 구독합니다. 반환값은 구독 해제 함수. */
export function watchAccount(cb: (s: AccountState) => void): () => void {
  let seq = 0;
  return onAuthStateChanged(firebaseAuth(), async (user) => {
    const my = ++seq;
    if (!user) return cb({ status: "signedOut" });
    cb({ status: "loading" });
    try {
      const profile = await loadAccountProfile(user.uid);
      if (my !== seq) return; // 그 사이 로그인 상태가 바뀜
      if (!profile) cb({ status: "needsProfile", user });
      else if (profile.deleteAt) cb({ status: "pendingDeletion", user, profile, deleteAt: profile.deleteAt });
      else cb({ status: "ready", user, profile });
    } catch (e) {
      console.error("[account] 프로필을 불러오지 못했어요", e);
      if (my === seq) cb({ status: "needsProfile", user });
    }
  });
}

export async function signInWithGoogle() {
  await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
}

export async function signOutAccount() {
  await signOut(firebaseAuth());
}

export type CreateProfileError = "invalid" | "taken" | "unknown";

/** 닉네임을 예약하고 프로필을 만듭니다(한 번의 다중 경로 쓰기 — 둘 다 되거나 둘 다 안 됨). */
export async function createProfile(user: User, rawName: string): Promise<AccountProfile | CreateProfileError> {
  const name = rawName.trim();
  if (!NICKNAME_RE.test(name)) return "invalid";
  const db = rtdb();
  const key = name.toLowerCase();
  try {
    if ((await get(ref(db, `nicknames/${key}`))).exists()) return "taken";
    await update(ref(db), {
      [`nicknames/${key}`]: user.uid,
      [`users/${user.uid}`]: { name, role: "student", createdAt: serverTimestamp() },
    });
    return { name, role: "student" };
  } catch (e) {
    // 동시에 같은 닉네임을 잡으면 규칙(비어 있을 때만 쓰기)에 막혀 PERMISSION_DENIED 가 납니다.
    if (String((e as Error)?.message ?? e).includes("PERMISSION_DENIED")) return "taken";
    console.error("[account] 프로필 생성 실패", e);
    return "unknown";
  }
}

/* ---------- 닉네임 변경 ---------- */

/** 지금 몇 번 더 바꿀 수 있는지, 다 썼다면 언제 다시 되는지 */
export function renameAllowance(p: AccountProfile, now: number): { left: number; nextAt: number | null } {
  const recent = [p.nameChangedAt, p.prevNameChangedAt].filter((t): t is number => !!t && t > now - RENAME_WINDOW_MS);
  const left = Math.max(0, RENAME_LIMIT - recent.length);
  // 다 썼으면 둘 중 오래된 변경이 30일을 넘기는 때 다시 가능
  return { left, nextAt: left ? null : Math.min(...recent) + RENAME_WINDOW_MS };
}

export type RenameError = "invalid" | "same" | "taken" | "limit" | "unknown";

/**
 * 닉네임 바꾸기 — 새 이름 예약 + 프로필 이름 + 변경 시각을 한 번에 씀 (모두 되거나 모두 안 됨).
 * 스터디룸 이름표는 room.ts 가 프로필 이름을 지켜보다가 따라 바꿈.
 */
export async function renameNickname(uid: string, profile: AccountProfile, rawName: string, now: number): Promise<AccountProfile | RenameError> {
  const name = rawName.trim();
  if (!NICKNAME_RE.test(name)) return "invalid";
  if (name === profile.name) return "same";
  if (!renameAllowance(profile, now).left) return "limit";
  const db = rtdb();
  const key = name.toLowerCase();
  try {
    const owner = (await get(ref(db, `nicknames/${key}`))).val();
    if (owner && owner !== uid) return "taken";
    await update(ref(db), {
      ...(owner ? {} : { [`nicknames/${key}`]: uid }), // 내 옛 닉네임이면 예약이 이미 있음
      [`users/${uid}/name`]: name,
      [`users/${uid}/nameChangedAt`]: serverTimestamp(),
      ...(profile.nameChangedAt ? { [`users/${uid}/prevNameChangedAt`]: profile.nameChangedAt } : {}),
    });
    return (await loadAccountProfile(uid)) ?? { ...profile, name };
  } catch (e) {
    if (String((e as Error)?.message ?? e).includes("PERMISSION_DENIED")) {
      // 그 사이 누가 이름을 잡았거나, 다른 탭에서 이미 바꿔 횟수를 다 씀
      const owner = (await get(ref(db, `nicknames/${key}`)).catch(() => null))?.val();
      return owner && owner !== uid ? "taken" : "limit";
    }
    console.error("[account] 닉네임 변경 실패", e);
    return "unknown";
  }
}

/* ---------- 회원 탈퇴 (7일 유예) ---------- */

export type DeletionError = "cancelled" | "admin" | "banned" | "unknown";

/** 구글로 다시 로그인해 본인 확인 → 서버에 탈퇴 신청. 성공하면 지워지는 시각 */
export async function requestDeletion(user: User): Promise<number | DeletionError> {
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    await user.getIdToken(true); // 방금 로그인한 시각이 담긴 토큰으로
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "cancelled";
    console.error("[account] 본인 확인 실패", e);
    return "unknown";
  }
  try {
    const r = await httpsCallable<void, { deleteAt: number }>(cloudFunctions(), "requestAccountDeletion")();
    return r.data.deleteAt;
  } catch (e) {
    const reason = (e as { details?: { reason?: string } })?.details?.reason;
    if (reason === "admin" || reason === "banned") return reason;
    console.error("[account] 탈퇴 신청 실패", e);
    return "unknown";
  }
}

/** 탈퇴 취소 — 유예 기간 안에 다시 로그인한 본인만 (규칙) */
export function cancelDeletion(uid: string) {
  return remove(ref(rtdb(), `users/${uid}/deleteAt`));
}

/** 다른 탭 · 기기에서 탈퇴를 신청하면 알림 */
export function watchDeletion(uid: string, on: (deleteAt: number | null) => void): () => void {
  return onValue(ref(rtdb(), `users/${uid}/deleteAt`), (s) => on(num(s.val()) ?? null), () => {});
}
