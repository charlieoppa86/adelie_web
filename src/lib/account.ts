/**
 * 계정: Google 로그인 + Firestore 프로필(users/{uid}) + 닉네임 예약(nicknames/{소문자 닉네임}).
 * 규칙은 firebase/firestore.rules 참고.
 */
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase";
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
  const snap = await getDoc(doc(firestore(), "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
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

/** 닉네임을 예약하고 프로필을 만듭니다(한 배치 — 둘 다 되거나 둘 다 안 됨). */
export async function createProfile(user: User, rawName: string): Promise<AccountProfile | CreateProfileError> {
  const name = rawName.trim();
  if (!NICKNAME_RE.test(name)) return "invalid";
  const db = firestore();
  const nickRef = doc(db, "nicknames", name.toLowerCase());
  try {
    if ((await getDoc(nickRef)).exists()) return "taken";
    const batch = writeBatch(db);
    batch.set(nickRef, { uid: user.uid });
    batch.set(doc(db, "users", user.uid), { name, role: "student", createdAt: serverTimestamp() });
    await batch.commit();
    return { name, role: "student" };
  } catch (e) {
    // 동시에 같은 닉네임을 잡으면 규칙(create만 허용)에 막혀 permission-denied 가 납니다.
    if ((e as { code?: string })?.code === "permission-denied") return "taken";
    console.error("[account] 프로필 생성 실패", e);
    return "unknown";
  }
}
