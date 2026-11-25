/**
 * 계정: Google 로그인 + Realtime Database 프로필(users/{uid}) + 닉네임 예약(nicknames/{소문자 닉네임}).
 * 규칙은 firebase/database.rules.json 참고.
 */
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { get, ref, serverTimestamp, update } from "firebase/database";
import { firebaseAuth, rtdb } from "@/lib/firebase";
import { NICKNAME_RE, type Role } from "@/shared/protocol";

export interface AccountProfile {
  name: string;
  role: Role;
}

export type AccountState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "needsProfile"; user: User }
  | { status: "ready"; user: User; profile: AccountProfile };

export async function loadAccountProfile(uid: string): Promise<AccountProfile | null> {
  const snap = await get(ref(rtdb(), `users/${uid}`));
  if (!snap.exists()) return null;
  const d = snap.val();
  return { name: String(d.name), role: (d.role as Role) ?? "student" };
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
      cb(profile ? { status: "ready", user, profile } : { status: "needsProfile", user });
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
