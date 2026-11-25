"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProfile,
  signInWithGoogle,
  signOutAccount,
  watchAccount,
  type AccountState,
  type CreateProfileError,
} from "@/lib/account";
import { NICKNAME_RE } from "@/shared/protocol";

const CARD = "w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur";
const PRIMARY =
  "mt-6 w-full rounded-full bg-brand-500 py-3.5 font-extrabold text-white shadow-brand transition hover:bg-brand-400 active:scale-[.98] disabled:opacity-60";

const PROFILE_ERRORS: Record<CreateProfileError, string> = {
  invalid: "한글·영문·숫자·_ 2~12자로 지어 주세요.",
  taken: "이미 다른 펭귄이 쓰고 있는 닉네임이에요.",
  unknown: "저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
};

/** 입장: Google 로그인 → (처음이면) 닉네임 정하기 → 스터디룸 입장 */
export function EntryForm() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      watchAccount(setAccount),
    [],
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (account.status === "loading") {
    return (
      <div className={`${CARD} text-center text-sm text-ink-300`} role="status">
        펭귄 확인 중…
      </div>
    );
  }

  if (account.status === "signedOut") {
    return (
      <div className={CARD}>
        <p className="text-center text-sm text-ink-300">Google 계정으로 들어와요. 가입하면 누구나 입장할 수 있어요.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              try {
                await signInWithGoogle();
              } catch (e) {
                const code = (e as { code?: string })?.code;
                if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
                  console.error("[login]", e);
                  setError("로그인하지 못했어요. 팝업 차단을 확인하고 다시 시도해 주세요.");
                }
              }
            })
          }
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-full bg-white py-3.5 font-extrabold text-ink-900 transition hover:bg-brand-50 active:scale-[.98] disabled:opacity-60"
        >
          <GoogleMark />
          Google로 입장하기
        </button>
        {error && <p className="mt-3 text-center text-xs text-coral-300">{error}</p>}
      </div>
    );
  }

  if (account.status === "needsProfile") {
    return <NicknameForm key={account.user.uid} busy={busy} error={error} onSubmit={(name) =>
      run(async () => {
        const r = await createProfile(account.user, name);
        if (typeof r === "string") setError(PROFILE_ERRORS[r]);
        else setAccount({ status: "ready", user: account.user, profile: r });
      })
    } onCancel={() => run(signOutAccount)} />;
  }

  const { profile, user } = account;
  return (
    <div className={CARD}>
      <p className="text-center text-sm text-ink-300">{user.email}</p>
      <p className="mt-1 text-center text-lg font-extrabold">
        {profile.role === "teacher" ? "🎓 강사" : "🎒 학생"} 아델리 <span className="text-brand-300">{profile.name}</span>
      </p>
      <button
        type="button"
        className={PRIMARY}
        onClick={() => router.push("/office")}
      >
        스터디룸 입장하기
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(signOutAccount)}
        className="mt-3 w-full text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
      >
        다른 계정으로 로그인
      </button>
    </div>
  );
}

function NicknameForm(props: {
  busy: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = NICKNAME_RE.test(name.trim());
  const message = props.error ?? (touched && !valid ? PROFILE_ERRORS.invalid : null);

  return (
    <form
      className={CARD}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (valid) props.onSubmit(name);
      }}
    >
      <p className="text-sm text-ink-300">처음 오셨네요! 스터디룸에서 쓸 닉네임을 정해 주세요.</p>
      <label htmlFor="nick" className="mt-4 block text-sm font-bold text-brand-100">
        닉네임
      </label>
      <input
        id="nick"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setTouched(true)}
        maxLength={12}
        placeholder="예) 펭귄공부왕"
        autoComplete="off"
        aria-invalid={!!message}
        aria-describedby="nick-help"
        className="mt-2 w-full rounded-xl border border-white/15 bg-ink-900/60 px-4 py-3 text-white outline-none placeholder:text-ink-500 focus:border-brand-400 aria-[invalid=true]:border-coral-500"
      />
      <p id="nick-help" className={`mt-1.5 text-xs ${message ? "text-coral-300" : "text-ink-400"}`}>
        {message ?? "한글·영문·숫자·_ 2~12자 (띄어쓰기 없이 — @태그에 쓰여요). 정하면 바꿀 수 없어요."}
      </p>
      <p className="mt-3 text-xs text-ink-400">처음엔 🎒 학생 아델리로 시작하고, 강사 역할은 관리자가 부여해요.</p>
      <button type="submit" disabled={props.busy} className={PRIMARY}>
        이 닉네임으로 시작하기
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onCancel}
        className="mt-3 w-full text-center text-xs text-ink-400 underline-offset-4 hover:text-ink-200 hover:underline"
      >
        로그아웃
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
