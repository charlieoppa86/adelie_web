"use client";

/**
 * 📚 자료 보드 — 집중 개인석 벽, 스터디 LIVE 왼쪽 판 + "자료 보러가기" 목록 창
 * 🌏 모두에게 공유된 자료만 보여 줌 (학생부터 관리자까지 같은 목록). 누르면 자료실에서 새 탭으로 열림
 */
import { useEffect, useState } from "react";
import { watchSharedLibrary, type LibraryDoc } from "@/lib/library";
import { LIBRARY_BOARD } from "@/shared/officeMap";

const BOOKS = ["#ec7a5f", "#ffd66b", "#5ff2c1", "#2fa8d9", "#8b7bff", "#f6a894"];

/** 맵 클릭(이동)으로 번지지 않게 */
const stop = (e: React.PointerEvent) => e.stopPropagation();

/** 모두에게 공유된 자료 목록 (null = 불러오는 중) */
export function useSharedLibrary(enabled: boolean) {
  const [docs, setDocs] = useState<LibraryDoc[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    return watchSharedLibrary(
      (d) => {
        setDocs(d);
        setError(false);
      },
      (e) => {
        console.error("[library] 공유 자료 목록 실패", e);
        setError(true);
      },
    );
  }, [enabled]);
  return { docs, error };
}

/** 맵 위의 자료 보드 (공부 캠프 좌표) */
export function LibraryBoard({ count, onOpen }: { count: number | null; onOpen: () => void }) {
  const { x, y, w, h } = LIBRARY_BOARD;
  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-xl border-[3px] border-[#bfe6f6] bg-[#1d5f88] shadow-[0_6px_0_#2f86b8,0_0_24px_rgba(143,209,236,.45)]"
      style={{ left: x, top: y, width: w, height: h, zIndex: y + h }}
      onPointerDown={stop}
    >
      {/* 눈 처마 */}
      <span className="pointer-events-none absolute inset-x-1 -top-1 h-2 rounded-full bg-[#fbfeff]" />
      {/* 책 한 줄 + 얼음 선반 */}
      <div className="pointer-events-none mx-3 mt-3 flex h-[30px] items-end justify-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: 15 }, (_, i) => (
          <span
            key={i}
            className="rounded-[2px]"
            style={{
              width: 10 + (i % 2) * 2,
              height: 20 + (i % 3) * 4,
              background: BOOKS[i % BOOKS.length],
              opacity: 0.92,
              transform: i === 9 ? "rotate(-12deg) translateX(2px)" : undefined,
              transformOrigin: "bottom",
            }}
          />
        ))}
      </div>
      <span className="pointer-events-none mx-2 h-1.5 rounded-full bg-[#e6f6fc]" />
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-3 text-center">
        <p className="text-[13px] font-extrabold tracking-wide text-[#e6f6fc]">
          📚 자료실{count ? <span className="ml-1 text-[11px] font-bold text-[#8fd1ec]">· {count}개</span> : null}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-[#ffd66b] px-4 py-1.5 text-xs font-extrabold text-[#0b2a44] shadow-lg hover:bg-[#ffe08f]"
        >
          자료 보러가기 →
        </button>
      </div>
    </div>
  );
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

/** 자료 목록 창 — 제목 · 작성자 · 만든 날 */
export function LibraryListDialog({ docs, error, onClose }: { docs: LibraryDoc[] | null; error: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-night/60 p-4" onPointerDown={stop} onClick={onClose}>
      <div
        role="dialog"
        aria-label="자료 보러가기"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(100%,34rem)] w-[min(100%,36rem)] flex-col rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl backdrop-blur"
      >
        <div className="flex items-start gap-3 border-b border-white/10 px-5 pb-3 pt-5">
          <div className="flex-1">
            <p className="text-lg font-extrabold">📚 자료 보러가기</p>
            <p className="mt-1 text-sm text-ink-300">모두에게 공유된 수업 자료예요. 누르면 새 탭에서 열려요.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full px-2 py-1 text-ink-300 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p className="px-5 py-10 text-center text-sm text-coral-300">자료 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
        ) : docs === null ? (
          <p className="px-5 py-10 text-center text-sm text-ink-300">불러오는 중…</p>
        ) : docs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-300">아직 공유된 자료가 없어요.</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_6.5rem_7.5rem] gap-3 px-5 pb-1.5 pt-3 text-[11px] font-bold text-ink-400">
              <span>제목</span>
              <span>작성자</span>
              <span className="text-right">만든 날</span>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {docs.map((d) => (
                <li key={d.id}>
                  <a
                    href={`/library#${d.id}`}
                    target="_blank"
                    rel="noopener"
                    className="grid grid-cols-[1fr_6.5rem_7.5rem] items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-bold text-white">
                      <span className="shrink-0">{d.icon}</span>
                      <span className="truncate">{d.title || "제목 없음"}</span>
                    </span>
                    <span className="truncate text-ink-200">{d.ownerName}</span>
                    <span className="text-right text-xs text-ink-300">{fmtDate(d.createdAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
