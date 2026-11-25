"use client";

import { useEffect, useState } from "react";

/** 모바일로 들어오면 화면은 그대로 보여 주고, 잠시 뒤 PC 이용을 권하는 안내를 띄움 */
const DELAY_MS = 3000;
const SEEN_KEY = "adelie.mobileNoticeSeen";

function isMobile(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|Mobile|KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua)) return true;
  // iPadOS 는 데스크톱 Safari 로 보이므로 터치 지원으로 구분
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

export function MobileNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile() || sessionStorage.getItem(SEEN_KEY)) return;
    const t = window.setTimeout(() => {
      sessionStorage.setItem(SEEN_KEY, "1"); // 한 번 방문(탭)에 한 번만
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-night/70 px-6 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mobile-notice-title"
        aria-describedby="mobile-notice-desc"
        className="w-full max-w-xs rounded-3xl border border-white/10 bg-ink-900/95 p-6 text-center shadow-2xl"
      >
        <p className="text-3xl" aria-hidden="true">
          💻
        </p>
        <p id="mobile-notice-title" className="mt-3 text-lg font-extrabold">
          불편하시죠?
        </p>
        <p id="mobile-notice-desc" className="mt-2 text-sm text-ink-300">
          남극AI빌리지는 넓은 화면에 맞춰 만들었어요.
          <br />
          노트북이나 PC 환경에서 다시 진행해주세요.
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-full bg-brand-500 py-3 font-extrabold text-white transition hover:bg-brand-400 active:scale-[.98]"
        >
          확인
        </button>
      </div>
    </div>
  );
}
