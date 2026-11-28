"use client";

import { useEffect, useState } from "react";
import {
  RENAME_LIMIT,
  loadAccountProfile,
  renameAllowance,
  renameNickname,
  requestDeletion,
  type AccountProfile,
  type DeletionError,
  type RenameError,
} from "@/lib/account";
import { firebaseAuth } from "@/lib/firebase";
import { NICKNAME_RE } from "@/shared/protocol";

const RENAME_ERRORS: Record<RenameError, string> = {
  invalid: "한글·영문·숫자·_ 2~12자로 지어 주세요.",
  same: "지금 쓰는 닉네임과 같아요.",
  taken: "이미 다른 펭귄이 쓰고 있거나, 예전에 쓰던 닉네임이에요.",
  limit: `닉네임은 30일 동안 ${RENAME_LIMIT}번까지만 바꿀 수 있어요.`,
  unknown: "바꾸지 못했어요. 잠시 후 다시 시도해 주세요.",
};
const DELETE_ERRORS: Record<Exclude<DeletionError, "cancelled">, string> = {
  admin: "관리자 계정은 탈퇴할 수 없어요. 다른 관리자에게 역할 변경을 부탁한 뒤 탈퇴해 주세요.",
  banned: "스터디룸 퇴장 기간이 끝난 뒤에 탈퇴할 수 있어요.",
  unknown: "탈퇴 신청을 하지 못했어요. 잠시 후 다시 시도해 주세요.",
};

export const formatDate = (at: number) =>
  new Date(at).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

const stop = (e: React.PointerEvent) => e.stopPropagation();
const INPUT =
  "mt-2 w-full rounded-xl border border-white/15 bg-ink-900/60 px-3 py-2.5 text-sm text-white outline-none placeholder:text-ink-500 focus:border-brand-400 aria-[invalid=true]:border-coral-500";

/** 내 정보: 닉네임 바꾸기 (30일에 2번) · 회원 탈퇴 신청 (7일 유예) */
export function AccountDialog(props: {
  uid: string;
  now: () => number;
  onRenamed: (name: string) => void;
  onDeletionRequested: (deleteAt: number) => void;
  onClose: () => void;
}) {
  const { uid, now, onClose } = props;
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [view, setView] = useState<"main" | "delete">("main");

  useEffect(() => {
    let alive = true;
    loadAccountProfile(uid)
      .then((p) => alive && setProfile(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-night/60 p-4" onPointerDown={stop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="내 정보"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(100%,26rem)] rounded-2xl border border-white/10 bg-ink-900/95 p-5 shadow-2xl backdrop-blur"
      >
        {!profile ? (
          <p className="py-6 text-center text-sm text-ink-300" role="status">
            불러오는 중…
          </p>
        ) : view === "main" ? (
          <RenameSection
            key={profile.name}
            uid={uid}
            profile={profile}
            now={now}
            onRenamed={(p) => {
              setProfile(p);
              props.onRenamed(p.name);
            }}
            onDelete={() => setView("delete")}
            onClose={onClose}
          />
        ) : (
          <DeleteSection profile={profile} onDone={props.onDeletionRequested} onBack={() => setView("main")} />
        )}
      </div>
    </div>
  );
}

function RenameSection(props: {
  uid: string;
  profile: AccountProfile;
  now: () => number;
  onRenamed: (p: AccountProfile) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { profile } = props;
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { left, nextAt } = renameAllowance(profile, props.now());
  const typed = name.trim();
  const invalid = typed.length > 0 && !NICKNAME_RE.test(typed);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !typed) return;
    setBusy(true);
    setError(null);
    const r = await renameNickname(props.uid, profile, typed, props.now());
    setBusy(false);
    if (typeof r === "string") return setError(RENAME_ERRORS[r]);
    setDone(true);
    props.onRenamed(r);
  };

  return (
    <>
      <p className="text-lg font-extrabold">내 정보</p>
      <p className="mt-1 text-sm text-ink-300">
        지금 닉네임 <strong className="text-brand-300">{profile.name}</strong>
      </p>
      {done && (
        <p className="mt-3 rounded-xl bg-aurora-green/15 px-3 py-2 text-xs font-bold text-aurora-green" role="status">
          닉네임을 바꿨어요. 스터디룸 이름표도 바로 바뀌어요.
        </p>
      )}

      <form onSubmit={submit} className="mt-4">
        <label htmlFor="rename" className="text-sm font-bold text-brand-100">
          닉네임 바꾸기
        </label>
        <input
          id="rename"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          disabled={!left}
          maxLength={12}
          placeholder={left ? "새 닉네임" : "지금은 바꿀 수 없어요"}
          autoComplete="off"
          aria-invalid={invalid || !!error}
          aria-describedby="rename-help"
          className={INPUT}
        />
        <p id="rename-help" className={`mt-1.5 text-xs ${error || invalid ? "text-coral-300" : "text-ink-400"}`}>
          {error ??
            (invalid
              ? RENAME_ERRORS.invalid
              : left
                ? `30일 동안 ${RENAME_LIMIT}번까지 바꿀 수 있어요 · 남은 횟수 ${left}번`
                : `${formatDate(nextAt!)}부터 다시 바꿀 수 있어요`)}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
          예전 닉네임은 사칭을 막기 위해 다른 펭귄이 쓸 수 없어요. 나는 언제든 다시 그 닉네임으로 돌아갈 수 있어요.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={props.onClose} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-ink-200 hover:bg-white/15">
            닫기
          </button>
          <button
            type="submit"
            disabled={busy || !left || !typed || invalid}
            className="rounded-xl bg-brand-500 py-2.5 text-sm font-extrabold text-white hover:bg-brand-400 disabled:opacity-50"
          >
            {busy ? "바꾸는 중…" : "바꾸기"}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={props.onDelete}
        className="mt-5 w-full border-t border-white/10 pt-3 text-center text-xs text-ink-400 underline-offset-4 hover:text-coral-300 hover:underline"
      >
        회원 탈퇴
      </button>
    </>
  );
}

function DeleteSection(props: { profile: AccountProfile; onDone: (deleteAt: number) => void; onBack: () => void }) {
  const { profile } = props;
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = profile.role === "admin";
  const matches = confirm.trim() === profile.name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = firebaseAuth().currentUser;
    if (busy || !matches || !user) return;
    setBusy(true);
    setError(null);
    const r = await requestDeletion(user);
    setBusy(false);
    if (typeof r === "number") return props.onDone(r);
    if (r !== "cancelled") setError(DELETE_ERRORS[r]);
  };

  return (
    <form onSubmit={submit} aria-label="회원 탈퇴">
      <p className="text-lg font-extrabold">회원 탈퇴</p>
      <ul className="mt-3 space-y-1.5 rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-ink-200">
        <li>
          • 신청하면 <strong className="text-white">7일 뒤</strong> 계정이 완전히 지워져요.
        </li>
        <li>• 7일 안에 다시 로그인하면 탈퇴를 취소하고 그대로 돌아올 수 있어요.</li>
        <li>• 기다리는 동안에는 스터디룸에 들어갈 수 없어요.</li>
        <li>• 지워지는 것: 프로필, 출석 · 공부 시간 기록, 비밀 대화 신청</li>
        <li className="text-ink-400">
          • 남는 것: 쓰던 닉네임들(다른 펭귄이 사칭하지 못하게 계속 묶여 있음), 운영진이 검토 중인 신고 기록
        </li>
      </ul>

      {isAdmin ? (
        <p className="mt-3 rounded-xl bg-coral-500/15 px-3 py-2 text-xs font-bold text-coral-300">{DELETE_ERRORS.admin}</p>
      ) : (
        <>
          <label htmlFor="delete-confirm" className="mt-4 block text-sm font-bold text-brand-100">
            확인을 위해 닉네임 <span className="text-coral-300">{profile.name}</span> 을(를) 입력해 주세요
          </label>
          <input
            id="delete-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-400">신청 버튼을 누르면 구글 계정을 한 번 더 확인해요.</p>
          {error && <p className="mt-2 text-xs font-bold text-coral-300">{error}</p>}
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={props.onBack} className="rounded-xl bg-white/10 py-2.5 text-sm font-bold text-ink-200 hover:bg-white/15">
          돌아가기
        </button>
        <button
          type="submit"
          disabled={busy || isAdmin || !matches}
          className="rounded-xl bg-red-500 py-2.5 text-sm font-extrabold text-white hover:bg-red-400 disabled:opacity-50"
        >
          {busy ? "확인 중…" : "탈퇴 신청"}
        </button>
      </div>
    </form>
  );
}
