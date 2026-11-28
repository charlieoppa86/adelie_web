"use client";

/**
 * 스터디룸 로딩 화면 — 입장 · 새로고침 때 데이터가 모두 올 때까지 화면 전체를 덮음.
 * 얼음 책상에서 노트북으로 공부하는 펭귄 + 책 · 핫초코. 화면 비율에 맞춰 크기를 정함:
 *   배경(오로라 · 설산 · 얼음 바닥)은 화면을 꽉 채우고(잘라서 맞춤), 가운데 장면은 가로 · 세로 중 짧은 쪽 기준.
 * 미리 만든 HTML 에도 들어가므로 새로고침 직후 빈 화면 없이 바로 보임.
 */
import { useEffect, useState } from "react";
import { Penguin } from "@/components/penguin/Penguin";

export type LoadingStep = "account" | "room" | "data";

const STEPS: { id: LoadingStep; label: string }[] = [
  { id: "account", label: "펭귄 확인" },
  { id: "room", label: "스터디룸 연결" },
  { id: "data", label: "자리 · 자료 불러오기" },
];

const TIPS = [
  "오늘의 목표: 30분간 뭐라도 하기 ✏️",
  "빈 책상을 누르면 바로 앉아서 공부 시간이 쌓여요",
  "Space 를 누르면 펭귄이 폴짝 뛰어요 🐧",
  "채팅에서 @닉네임 으로 다른 펭귄을 부를 수 있어요",
  "📚 자료실 판에서 공유된 수업 자료를 볼 수 있어요",
  "카페석은 쉬는 자리 — 공부 시간은 책상 · 스탠딩석에서 쌓여요 ☕",
];
const TIP_MS = 3200;
const FADE_MS = 400;

/** 얼음 책상 + 책 + 핫초코 (펭귄 앞에 겹쳐 그림) */
function Desk() {
  return (
    <svg viewBox="0 0 400 150" className="absolute inset-x-0 bottom-0 w-full" aria-hidden="true">
      {/* 책상 그림자 */}
      <ellipse cx="200" cy="142" rx="178" ry="8" fill="#9fdcf5" opacity=".18" />
      {/* 펼친 책 (왼쪽) */}
      <g transform="translate(52 34)">
        <path d="M0 22L38 14L38 40L0 46Z" fill="#fbfeff" />
        <path d="M76 22L38 14L38 40L76 46Z" fill="#eaf6fc" />
        <path d="M6 24L32 19M6 30L32 25M6 36L28 31M44 19L70 24M44 25L70 30" stroke="#a9ddf1" strokeWidth="2" strokeLinecap="round" />
        <path className="load-page" d="M38 14L64 18L64 42L38 40Z" fill="#ffffff" stroke="#d6eaf4" strokeWidth="1" />
        <path d="M-2 46L38 40L78 46L78 50L38 44L-2 50Z" fill="#ec7a5f" />
      </g>
      {/* 핫초코 (오른쪽) */}
      <g transform="translate(300 28)">
        <path className="steam" d="M12 0q-5 -7 0 -13t0 -12" stroke="#e6f6fc" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
        <path className="steam" style={{ animationDelay: ".8s" }} d="M24 2q-5 -7 0 -13t0 -12" stroke="#e6f6fc" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
        <path d="M0 10H36V40Q36 52 18 52Q0 52 0 40Z" fill="#f3907a" />
        <ellipse cx="18" cy="11" rx="18" ry="4" fill="#8a5a3b" />
        <path d="M36 18Q48 18 48 28Q48 38 36 38" stroke="#f3907a" strokeWidth="5" fill="none" />
      </g>
      {/* 책상 상판 · 앞판 (얼음) */}
      <rect x="20" y="78" width="360" height="16" rx="8" fill="#e6f6fc" />
      <path d="M34 92H366L356 138H44Z" fill="#a9ddf1" />
      <path d="M34 92H366L364 100H36Z" fill="#8fd1ec" />
      <path d="M70 108L96 104M86 122L130 116M290 110L320 106" stroke="#eaf8fe" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      {/* 눈 처마 */}
      <path d="M24 80Q60 70 100 80T180 80T260 80T340 80T378 80" stroke="#fbfeff" strokeWidth="7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** 배경: 설산 · 얼음 바닥 (화면 비율이 달라도 꽉 차게 잘라서 맞춤, 바닥 기준) */
function Backdrop() {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <path d="M0 770L170 660L300 730L470 610L640 720L800 640L980 740L1150 620L1320 720L1460 660L1600 730V900H0Z" fill="#12324d" opacity=".75" />
      <path d="M170 660L124 694L146 688L162 700L180 686L200 696L220 696ZM470 610L424 644L446 638L462 650L480 636L500 646L520 646ZM800 640L754 674L776 668L792 680L810 666L830 676L850 676ZM1150 620L1104 654L1126 648L1142 660L1160 646L1180 656L1200 656ZM1460 660L1414 694L1436 688L1452 700L1470 686L1490 696L1510 696Z" fill="#eaf8fe" opacity=".6" />
      <path d="M0 830Q400 800 800 822T1600 814V900H0Z" fill="#cdeaf6" />
      <path d="M0 846Q420 822 800 840T1600 834V900H0Z" fill="#e6f6fc" />
      <path d="M180 872L320 866M560 884L760 876M1000 870L1180 864M1300 888L1460 880" stroke="#a9ddf1" strokeWidth="5" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export function StudyLoading({ done, step }: { done: boolean; step: LoadingStep }) {
  const [tip, setTip] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS);
    return () => window.clearInterval(t);
  }, [done]);

  // 다 불러오면 부드럽게 사라진 뒤 빠짐
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  if (gone && done) return null;
  const at = STEPS.findIndex((s) => s.id === step);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-opacity ease-out ${done ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      {/* .glacier-sky 는 position: relative 라 바깥(fixed)과 나눔 */}
      <div className="glacier-sky h-full w-full overflow-hidden">
      <Backdrop />

      {/* 가운데 장면: 화면의 짧은 쪽에 맞춰 크기를 정함 (가로 화면은 높이, 세로 화면은 너비 기준) */}
      <div className="relative flex h-full flex-col items-center justify-center gap-[clamp(10px,2.4vmin,24px)] px-6 pb-[14vh]">
        <p className="text-[clamp(13px,2.1vmin,18px)] font-extrabold tracking-wide text-[#bfe6f6]">남극캠퍼스.ai 스터디룸</p>

        <div className="relative aspect-[4/3] w-[clamp(220px,min(78vw,52vh),460px)]">
          <div className="absolute bottom-[22%] left-1/2 w-[46%] -translate-x-1/2">
            <Penguin laptop anim={["type"]} look={[0, 4]} />
          </div>
          <Desk />
        </div>

        {/* 단계: 끝난 단계 ✓, 지금 단계는 점 세 개 */}
        <ol className="flex flex-wrap items-center justify-center gap-x-[clamp(8px,2vmin,18px)] gap-y-1.5 text-[clamp(12px,1.8vmin,15px)] font-bold">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`flex items-center gap-1.5 ${i < at ? "text-aurora-green" : i === at ? "text-white" : "text-ink-400"}`}
              aria-current={i === at ? "step" : undefined}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${
                  i < at ? "bg-aurora-green/20" : i === at ? "bg-brand-500" : "bg-white/10"
                }`}
                aria-hidden="true"
              >
                {i < at ? "✓" : i + 1}
              </span>
              {s.label}
              {i === at && (
                <span className="load-dots" aria-hidden="true">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              )}
              {i < STEPS.length - 1 && (
                <span className="ml-[clamp(4px,1.4vmin,14px)] text-ink-500" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>
        <span className="sr-only">{STEPS[at]?.label} 중이에요</span>

        <p key={tip} className="load-tip max-w-[min(90vw,32rem)] text-center text-[clamp(12px,1.7vmin,14px)] text-ink-300">
          💡 {TIPS[tip]}
        </p>
      </div>
      </div>
    </div>
  );
}
