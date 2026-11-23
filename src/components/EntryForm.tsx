"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile } from "@/lib/localProfile";
import { NICKNAME_RE, type Role } from "@/shared/protocol";

/** 임시 입장 폼 — 로그인 단계에서 "Google로 입장하기"로 바뀝니다. */
export function EntryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장된 값은 마운트 후에만 읽을 수 있음
      setName(p.name);
      setRole(p.role);
    }
  }, []);

  const valid = NICKNAME_RE.test(name.trim());

  return (
    <form
      className="mt-10 w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!valid) return;
        saveProfile({ name: name.trim(), role });
        router.push("/office");
      }}
    >
      <label htmlFor="nick" className="text-sm font-bold text-brand-100">
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
        aria-invalid={touched && !valid}
        aria-describedby="nick-help"
        className="mt-2 w-full rounded-xl border border-white/15 bg-ink-900/60 px-4 py-3 text-white outline-none placeholder:text-ink-500 focus:border-brand-400 aria-[invalid=true]:border-coral-500"
      />
      <p id="nick-help" className={`mt-1.5 text-xs ${touched && !valid ? "text-coral-300" : "text-ink-400"}`}>
        한글·영문·숫자·_ 2~12자 (띄어쓰기 없이 — @태그에 쓰여요)
      </p>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-brand-100">역할</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["student", "학생 아델리", "🎒"],
              ["teacher", "선생 아델리", "🎓"],
            ] as const
          ).map(([value, label, icon]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-3 text-sm font-bold text-ink-200 has-checked:border-brand-400 has-checked:bg-brand-500/15 has-checked:text-white"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              <span aria-hidden="true">{icon}</span>
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-400">임시 선택이에요. 로그인이 붙으면 선생 역할은 관리자가 부여해요.</p>
      </fieldset>

      <button
        type="submit"
        className="mt-6 w-full rounded-full bg-brand-500 py-3.5 font-extrabold text-white shadow-brand transition hover:bg-brand-400 active:scale-[.98]"
      >
        스터디룸 입장하기
      </button>
    </form>
  );
}
