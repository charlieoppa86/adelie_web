"use client";

/**
 * 📚 자료실 — 왼쪽 자료 목록 + 오른쪽 문서 (노션처럼 열면 바로 고칠 수 있음)
 * 강사 · 관리자: 만들기 · 고치기 · 지우기 · 공유 범위(🔒 나만 보기 / 👩‍🏫 선생과 공유 / 🌏 모두에게 공유)
 * 학생: 모두에게 공유된 자료 읽기만
 */
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { watchAccount } from "@/lib/account";
import {
  canEdit,
  createLibraryDoc,
  deleteLibraryDoc,
  isStaff,
  ensureRoleSynced,
  type RoleSync,
  saveLibraryBody,
  updateLibraryMeta,
  uploadLibraryImage,
  VISIBILITY,
  watchBody,
  watchLibrary,
  type LibraryDoc,
  type Me,
  type Visibility,
} from "@/lib/library";
import { DocEditor } from "./DocEditor";

const ROLE_LABEL = { student: "학생", teacher: "강사", admin: "관리자" } as const;
const ICONS = ["📄", "📱", "💻", "🖥️", "🤖", "💬", "🧠", "📚", "📝", "📊", "🎨", "🛠️", "🚀", "🔥", "✅", "🐧", "🧊", "❄️", "🎯", "💡"];
const ORDER: Visibility[] = ["all", "teachers", "private"];

type SaveState = "saved" | "saving" | "dirty" | "error";

export function Library() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [docs, setDocs] = useState<LibraryDoc[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [roleSync, setRoleSync] = useState<RoleSync>("ok");
  const synced = roleSync === "ok";

  useEffect(
    () =>
      watchAccount((a) => {
        if (a.status === "signedOut" || a.status === "needsProfile" || a.status === "pendingDeletion") router.replace("/");
        else if (a.status === "ready") setMe({ uid: a.user.uid, name: a.profile.name, role: a.profile.role });
      }),
    [router],
  );

  useEffect(() => {
    if (!me) return;
    ensureRoleSynced(me).then(setRoleSync);
    return watchLibrary(me, setDocs, (e) => {
      console.error("[library]", e);
      setToast("자료 목록을 불러오지 못했어요");
    });
  }, [me]);

  // 주소의 #자료ID 로 바로 열기 (링크 공유)
  useEffect(() => {
    const fromHash = () => setSelected(decodeURIComponent(location.hash.slice(1)) || null);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const open = (id: string | null) => {
    history.replaceState(null, "", id ? `#${id}` : location.pathname);
    setSelected(id);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const current = docs?.find((d) => d.id === selected) ?? null;
  const staff = me ? isStaff(me.role) : false;

  const groups = useMemo(() => {
    if (!docs || !me) return [];
    if (!staff) return [{ key: "all" as const, docs }];
    return ORDER.map((v) => ({ key: v, docs: docs.filter((d) => d.visibility === v) })).filter((g) => g.docs.length || g.key === "private");
  }, [docs, me, staff]);

  const create = async () => {
    if (!me) return;
    try {
      const id = await createLibraryDoc(me);
      open(id);
    } catch (e) {
      console.error(e);
      setToast(synced ? "자료를 만들지 못했어요" : "역할이 아직 반영되지 않아 만들 수 없어요 (아래 안내 참고)");
    }
  };

  if (!me) {
    return (
      <main className="glacier-sky flex min-h-screen items-center justify-center text-ink-300">
        <p role="status">자료실 여는 중…</p>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-night">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-night/80 px-4 backdrop-blur">
        <Link href="/office" className="flex items-center gap-2">
          <Image src="/brand/logo-mark.svg" alt="" width={28} height={28} />
          <span className="font-extrabold">남극캠퍼스.ai</span>
        </Link>
        <span className="text-ink-500">/</span>
        <button type="button" onClick={() => open(null)} className="font-bold text-white">
          📚 자료실
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-ink-200">
            <strong className="text-white">{me.name}</strong> · {ROLE_LABEL[me.role]} 아델리
          </span>
          <Link href="/office" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-ink-200 hover:bg-white/5">
            스터디룸으로
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- 자료 목록 ---------- */}
        <nav aria-label="자료 목록" className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-ink-900/60">
          {staff && (
            <div className="p-3">
              <button
                type="button"
                onClick={create}
                className="w-full rounded-lg bg-brand-500 py-2 text-sm font-bold text-white shadow-brand hover:bg-brand-600"
              >
                + 새 자료
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {docs === null ? (
              <p className="px-2 py-4 text-sm text-ink-400">불러오는 중…</p>
            ) : (
              groups.map((g) => (
                <section key={g.key} className="mt-3">
                  {staff && (
                    <h2 className="px-2 pb-1 text-[11px] font-bold text-ink-400">
                      {VISIBILITY[g.key].icon} {VISIBILITY[g.key].label}
                      <span className="ml-1 text-ink-500">{g.docs.length}</span>
                    </h2>
                  )}
                  {g.docs.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-ink-500">{staff ? "아직 없어요" : "아직 공유된 자료가 없어요"}</p>
                  ) : (
                    <ul>
                      {g.docs.map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => open(d.id)}
                            aria-current={d.id === selected ? "page" : undefined}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                              d.id === selected ? "bg-white/10 text-white" : "text-ink-200 hover:bg-white/5"
                            }`}
                          >
                            <span aria-hidden="true">{d.icon}</span>
                            <span className={`min-w-0 flex-1 truncate ${d.title ? "" : "text-ink-500"}`}>{d.title || "제목 없음"}</span>
                            {staff && d.ownerId !== me.uid && <span className="shrink-0 text-[10px] text-ink-500">{d.ownerName}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))
            )}
          </div>
          {staff && !synced && (
            <p className="m-3 rounded-lg bg-coral-500/15 p-3 text-xs leading-relaxed text-coral-200">
              {ROLE_LABEL[me.role]} 역할이 자료실에 반영되지 않아 자료를 만들 수 없어요.{" "}
              {roleSync === "error"
                ? "역할 정보를 읽지 못했어요. 새로고침해 보세요."
                : roleSync === "missing"
                  ? "역할 사본이 없고, 다시 맞추기도 실패했어요."
                  : "역할 사본이 실제 역할과 달라요."}
              <span className="mt-1 block text-coral-300/70">관리자에게 알려 주세요 (사본 상태: {roleSync})</span>
            </p>
          )}
        </nav>

        {/* ---------- 문서 ---------- */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {current ? (
            <DocView key={current.id} me={me} doc={current} onDeleted={() => open(null)} onToast={setToast} />
          ) : selected && docs ? (
            <Empty title="자료를 찾을 수 없어요" body="지워졌거나, 볼 수 있는 범위가 바뀌었어요." />
          ) : (
            <Empty
              title="📚 자료실"
              body={
                staff
                  ? "왼쪽에서 자료를 고르거나 '+ 새 자료'로 만들어 보세요. 새 자료는 🔒 나만 보기로 시작하고, 준비되면 👩‍🏫 선생과 공유나 🌏 모두에게 공유로 바꿀 수 있어요."
                  : "강사 아델리가 모두에게 공유한 수업 자료를 볼 수 있어요."
              }
            />
          )}
        </main>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-800 px-4 py-2 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-extrabold text-white">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}

/* ---------- 문서 하나 ---------- */

function DocView({ me, doc, onDeleted, onToast }: { me: Me; doc: LibraryDoc; onDeleted: () => void; onToast: (m: string) => void }) {
  const editable = canEdit(me, doc);
  const [body, setBody] = useState<{ json: string; version: number } | null>(null);
  const [title, setTitle] = useState(doc.title);
  const [save, setSave] = useState<SaveState>("saved");
  const [iconOpen, setIconOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending = useRef<{ json?: string; title?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocal = useRef<string | null>(null);

  // 본문: 처음 한 번 + 다른 사람이 고치면 (내가 고치는 중이 아닐 때만) 갈아끼움
  useEffect(
    () =>
      watchBody(
        doc.id,
        (json, fromMe) => {
          if (json === null || fromMe) return;
          setBody((prev) => {
            if (!prev) return { json, version: 0 };
            if (json === lastLocal.current || pending.current.json !== undefined) return prev;
            return { json, version: prev.version + 1 };
          });
        },
        (e) => {
          console.error("[library] 본문", e);
          onToast("본문을 불러오지 못했어요");
        },
      ),
    [doc.id, onToast],
  );

  // 다른 사람이 제목을 바꾸면 따라감 (내가 쓰는 중이 아닐 때)
  useEffect(() => {
    if (pending.current.title === undefined) setTitle(doc.title);
  }, [doc.title]);

  const flush = useCallback(async () => {
    timer.current = null;
    const p = pending.current;
    pending.current = {};
    if (p.json === undefined && p.title === undefined) return;
    setSave("saving");
    try {
      if (p.title !== undefined) await updateLibraryMeta(me, doc.id, { title: p.title });
      if (p.json !== undefined) {
        lastLocal.current = p.json;
        await saveLibraryBody(me, doc.id, p.json);
      }
      setSave(timer.current ? "dirty" : "saved");
    } catch (e) {
      console.error("[library] 저장 실패", e);
      setSave("error");
    }
  }, [me, doc.id]);

  const schedule = (patch: { json?: string; title?: string }) => {
    Object.assign(pending.current, patch);
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };

  // 다른 자료로 넘어가거나 페이지를 떠날 때 남은 변경 저장
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (timer.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  const setMeta = async (patch: Partial<Pick<LibraryDoc, "icon" | "visibility">>) => {
    try {
      await updateLibraryMeta(me, doc.id, patch);
      if (patch.visibility) onToast(`${VISIBILITY[patch.visibility].icon} ${VISIBILITY[patch.visibility].label}(으)로 바꿨어요`);
    } catch (e) {
      console.error(e);
      onToast("바꾸지 못했어요");
    }
  };

  const remove = async () => {
    try {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = {};
      await deleteLibraryDoc(doc.id);
      onToast("자료를 지웠어요");
      onDeleted();
    } catch (e) {
      console.error(e);
      onToast("지우지 못했어요");
    }
  };

  const updated = new Date(doc.updatedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <article className="pb-32">
      {/* 상단 막대: 공유 범위 · 저장 상태 · 삭제 */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/5 bg-night/90 px-6 py-2 text-xs backdrop-blur">
        <span className="truncate text-ink-400">
          {doc.ownerName} 작성 · {updated} {doc.updatedByName && doc.updatedByName !== doc.ownerName ? `${doc.updatedByName} 수정` : "수정"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {editable && (
            <span className={save === "error" ? "text-coral-300" : "text-ink-400"} role="status">
              {save === "saved" ? "저장됨" : save === "saving" ? "저장 중…" : save === "dirty" ? "고치는 중…" : "저장 실패 — 다시 고치면 재시도"}
            </span>
          )}
          {editable ? (
            <VisibilityPicker value={doc.visibility} isOwner={doc.ownerId === me.uid} onChange={(v) => setMeta({ visibility: v })} />
          ) : (
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-ink-200">
              {VISIBILITY[doc.visibility].icon} {VISIBILITY[doc.visibility].label} · 읽기 전용
            </span>
          )}
          {editable &&
            (confirmDelete ? (
              <span className="flex items-center gap-1">
                <button type="button" onClick={remove} className="rounded-full bg-coral-500 px-2.5 py-1 font-bold text-white">
                  정말 지우기
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-full px-2 py-1 text-ink-300 hover:bg-white/5">
                  취소
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full px-2.5 py-1 text-ink-300 hover:bg-coral-500/20 hover:text-coral-200">
                🗑 삭제
              </button>
            ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 pt-12 sm:px-12">
        <div className="relative">
          <button
            type="button"
            disabled={!editable}
            onClick={() => setIconOpen((o) => !o)}
            aria-label="아이콘 바꾸기"
            className="rounded-lg text-6xl leading-none enabled:hover:bg-white/5"
          >
            {doc.icon}
          </button>
          {iconOpen && editable && (
            <div className="absolute z-20 mt-2 grid w-72 grid-cols-8 gap-1 rounded-xl border border-white/10 bg-ink-800 p-2 shadow-2xl">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => {
                    setIconOpen(false);
                    void setMeta({ icon: ic });
                  }}
                  className="rounded-md p-1 text-xl hover:bg-white/10"
                >
                  {ic}
                </button>
              ))}
            </div>
          )}
        </div>

        {editable ? (
          <textarea
            value={title}
            rows={1}
            maxLength={200}
            placeholder="제목 없음"
            onChange={(e) => {
              const v = e.target.value.replace(/\n/g, "");
              setTitle(v);
              schedule({ title: v });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (document.querySelector(".doc-prose") as HTMLElement | null)?.focus();
              }
            }}
            className="mt-4 w-full resize-none overflow-hidden bg-transparent text-4xl font-extrabold leading-tight text-white placeholder:text-ink-600 focus:outline-none [field-sizing:content]"
          />
        ) : (
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white">{doc.title || "제목 없음"}</h1>
        )}

        <div className="mt-6">
          {body ? (
            <DocEditor
              initial={body.json}
              version={body.version}
              editable={editable}
              onChange={(json) => schedule({ json })}
              onUploadImage={(file) => uploadLibraryImage(doc.id, file)}
              onError={onToast}
            />
          ) : (
            <p className="text-sm text-ink-400">본문 불러오는 중…</p>
          )}
        </div>
      </div>
    </article>
  );
}

function VisibilityPicker({ value, isOwner, onChange }: { value: Visibility; isOwner: boolean; onChange: (v: Visibility) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`rounded-full px-2.5 py-1 font-bold ${value === "private" ? "bg-white/10 text-ink-100" : "bg-brand-500 text-white"}`}
      >
        {VISIBILITY[value].icon} {VISIBILITY[value].label} ▾
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-ink-800 p-1 shadow-2xl">
          {(["private", "teachers", "all"] as const).map((v) => {
            // 관리자가 남의 자료를 '나만 보기'로 돌릴 수는 없음 (규칙과 같음)
            const disabled = v === "private" && !isOwner;
            return (
              <li key={v}>
                <button
                  type="button"
                  role="option"
                  aria-selected={v === value}
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false);
                    if (v !== value) onChange(v);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left disabled:opacity-40 ${v === value ? "bg-white/10" : "enabled:hover:bg-white/5"}`}
                >
                  <span className="block text-sm font-bold text-white">
                    {VISIBILITY[v].icon} {VISIBILITY[v].label}
                  </span>
                  <span className="block text-xs text-ink-400">{disabled ? "작성자만 바꿀 수 있어요" : VISIBILITY[v].desc}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
