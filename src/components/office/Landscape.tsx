/**
 * 공부 캠프를 둘러싼 남극 풍경 — 오로라 하늘 · 설산 · 빙하 · 남극해와 그곳에 사는 동물들.
 * 정적 SVG 한 장이고, 움직임은 CSS 애니메이션(범고래 · 새 · 고래 물줄기 · 유빙 · 새끼 펭귄)만 씁니다.
 * 황제펭귄은 사용자 펭귄(아델리)과 헷갈리지 않게 작고, 노란 귀 무늬가 있는 실루엣으로 그립니다.
 */
import { memo } from "react";
import { CAMP_BOTTOM, CAMP_OFFSET, LANDSCAPE } from "@/shared/officeMap";

const SNOW = "#fbfeff";
const INK = "#1a2436";

/* ---------------- 동물 ---------------- */
function Emperor({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx="0" cy="0" rx="11" ry="3" fill="#7cc4e4" opacity=".45" />
      <path d="M-9 0Q-13 -22 -6 -38Q0 -46 6 -38Q12 -22 9 0Z" fill={INK} />
      <path d="M-5 -2Q-8 -20 -2 -33Q4 -34 6 -28Q9 -16 6 -2Z" fill="#fff" />
      <path d="M-1 -33Q4 -31 6 -24" stroke="#ffcf5a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="1" cy="-40" r="6" fill={INK} />
      <path d="M5 -40l8 2l-8 1.5z" fill={INK} />
      <path d="M6 -38.6l5 1" stroke="#ff9f5a" strokeWidth="1.2" />
      <path d="M-9 -24q-5 10 -2 18" stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Chick({ x, y, delay = 0 }: { x: number; y: number; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="chick-wiggle" style={{ animationDelay: `${delay}s` }}>
        <ellipse cx="0" cy="0" rx="7" ry="2" fill="#7cc4e4" opacity=".45" />
        <ellipse cx="0" cy="-9" rx="8" ry="10" fill="#b9c3cc" />
        <circle cx="0" cy="-21" r="6" fill={INK} />
        <path d="M-3.5 -22q3.5 -4 7 0q-1 4 -3.5 4q-2.5 0 -3.5 -4z" fill="#fff" />
        <circle cx="-1.5" cy="-21.5" r=".9" fill={INK} />
        <circle cx="1.5" cy="-21.5" r=".9" fill={INK} />
      </g>
    </g>
  );
}

function WeddellSeal({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="3" rx="34" ry="5" fill="#7cc4e4" opacity=".35" />
      <path d="M-34 0Q-30 -16 -4 -16Q22 -18 30 -6Q34 2 26 2Z" fill="#6f8296" />
      <path d="M-30 -2Q-20 -10 0 -10Q16 -10 24 -4" stroke="#90a3b6" strokeWidth="3" fill="none" />
      {[
        [-14, -9],
        [-4, -12],
        [8, -8],
        [-20, -5],
      ].map(([cx, cy], i) => (
        <ellipse key={i} cx={cx} cy={cy} rx="2.4" ry="1.4" fill="#4f6276" />
      ))}
      <circle cx="28" cy="-8" r="7.5" fill="#7d90a4" />
      <circle cx="31" cy="-10" r="1.3" fill="#0b1220" />
      <circle cx="34" cy="-6" r="1" fill="#0b1220" />
      <path d="M-34 0l-8 -5l1 8z" fill="#6f8296" />
    </g>
  );
}

function Orca({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-30 4Q-24 -6 0 -7Q20 -7 30 4Z" fill="#0b1220" />
      <path d="M-4 -6L2 -30L8 -6Z" fill="#0b1220" />
      <ellipse cx="18" cy="-1" rx="4" ry="1.8" fill="#fff" />
      <path d="M-6 0q6 -3 12 0" stroke="#cfd8df" strokeWidth="2" fill="none" />
      <path d="M-34 6q34 -6 68 0" stroke="#8fd1ec" strokeWidth="2" fill="none" opacity=".6" />
    </g>
  );
}

function Petrel({ x, y, s = 1, color = "#fff" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-14 0Q-7 -8 0 0Q7 -8 14 0" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="0" cy="0.5" r="2" fill={color} />
    </g>
  );
}

function Floe({ x, y, rx, ry = rx * 0.4 }: { x: number; y: number; rx: number; ry?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 3} rx={rx} ry={ry} fill="#57b8e0" opacity=".35" />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#eef8fc" />
    </g>
  );
}

/* ---------------- 풍경 ---------------- */
export const Landscape = memo(function Landscape() {
  const { w, h } = LANDSCAPE;
  const cx1 = CAMP_OFFSET.x + 78; // 캠프 빙붕 왼쪽 끝
  const cx2 = CAMP_OFFSET.x + 1522; // 오른쪽 끝
  const cyB = CAMP_OFFSET.y + CAMP_BOTTOM; // 아래쪽 끝
  const cyT = CAMP_OFFSET.y + 66; // 빙벽 윗선(가장 높은 곳)
  return (
    <svg className="absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#040c1d" />
          <stop offset=".6" stopColor="#0a2240" />
          <stop offset="1" stopColor="#123659" />
        </linearGradient>
        <linearGradient id="ls-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a3050" />
          <stop offset="1" stopColor="#041a2e" />
        </linearGradient>
        <linearGradient id="ls-aur-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5ff2c1" stopOpacity="0" />
          <stop offset=".3" stopColor="#5ff2c1" stopOpacity=".55" />
          <stop offset=".65" stopColor="#3fd0e0" stopOpacity=".4" />
          <stop offset="1" stopColor="#8b7bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ls-aur-p" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f6a894" stopOpacity="0" />
          <stop offset=".5" stopColor="#c58bff" stopOpacity=".35" />
          <stop offset="1" stopColor="#5ff2c1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ls-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9eef8" />
        </linearGradient>
        <linearGradient id="ls-plateau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eaf6fb" />
          <stop offset=".55" stopColor="#cfe9f5" />
          <stop offset="1" stopColor="#a9ddf1" />
        </linearGradient>
        <linearGradient id="ls-cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9ddf1" />
          <stop offset="1" stopColor="#2f86b8" />
        </linearGradient>
      </defs>

      {/* ---- 하늘 · 바다 ---- */}
      <rect width={w} height={h} fill="url(#ls-sea)" />
      <rect width={w} height="330" fill="url(#ls-sky)" />
      <g className="aurora-sway">
        <path d="M-40 70Q300 10 640 60T1320 40T2040 70V120Q1700 80 1320 96T640 104T-40 130Z" fill="url(#ls-aur-g)" />
        <path d="M100 40Q500 0 900 34T1900 20V44Q1500 50 900 60T100 70Z" fill="url(#ls-aur-p)" />
      </g>
      {[
        [60, 30],
        [210, 90],
        [380, 20],
        [560, 70],
        [760, 16],
        [980, 60],
        [1180, 24],
        [1420, 80],
        [1620, 30],
        [1820, 66],
        [1950, 18],
        [1300, 140],
        [480, 150],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.3 : 2} fill="#fff" className="twinkle" style={{ animationDelay: `${(i % 6) * 0.5}s` }} />
      ))}
      <circle cx="130" cy="70" r="22" fill="#fff6d1" opacity=".92" />
      <circle cx="140" cy="62" r="19" fill="#081a33" />

      {/* ---- 먼 설산 (트랜스안타틱 산맥) ---- */}
      <path
        d="M0 300L80 200L150 250L240 150L330 230L420 170L520 240L610 140L700 210L800 160L900 220L1000 130L1100 200L1200 150L1300 220L1400 140L1500 210L1600 160L1700 230L1800 150L1900 220L2000 170V330H0Z"
        fill="#2b3f57"
      />
      <path
        d="M240 150L220 176L240 170L258 180ZM610 140L588 166L610 160L630 170ZM1000 130L978 158L1000 152L1020 162ZM1400 140L1380 166L1400 160L1420 170ZM1800 150L1780 176L1800 170L1820 180ZM80 200L66 220L80 216L94 224Z"
        fill="#eaf6fb"
      />
      <path
        d="M0 330L120 260L230 300L360 240L470 300L560 270V330ZM1440 330L1540 270L1660 310L1780 250L1900 290L2000 260V330Z"
        fill="#46607c"
      />
      <path d="M120 260L104 280L124 276ZM360 240L340 262L362 258ZM1780 250L1760 272L1782 268ZM1540 270L1526 288L1544 284Z" fill="#eaf6fb" />

      {/* ---- 산맥 아래 내륙 빙상 고원 (캠프 빙벽 뒤로 펼쳐진 남극 대륙) ---- */}
      <path d={`M0 322Q260 306 520 318T1040 312T1560 320T2000 314V${cyT + 70}H0Z`} fill="url(#ls-plateau)" />
      <path
        d={`M0 336Q300 326 620 336T1260 332T2000 336M40 ${cyT - 20}Q420 ${cyT - 32} 820 ${cyT - 22}T1600 ${cyT - 26}T2000 ${cyT - 20}`}
        stroke="#ffffff"
        strokeOpacity=".55"
        strokeWidth="2"
        fill="none"
      />
      {/* 고원 위 누나탁(빙상 위로 솟은 바위 봉우리) */}
      <path d={`M560 ${cyT - 4}L590 ${cyT - 30}L606 ${cyT - 18}L624 ${cyT - 34}L656 ${cyT - 4}Z`} fill="#46607c" />
      <path d={`M590 ${cyT - 30}L582 ${cyT - 20}L594 ${cyT - 22}ZM624 ${cyT - 34}L616 ${cyT - 22}L628 ${cyT - 24}Z`} fill="#eaf6fb" />
      <path d={`M1380 ${cyT - 2}L1404 ${cyT - 24}L1430 ${cyT - 2}Z`} fill="#46607c" />
      <path d={`M1404 ${cyT - 24}L1396 ${cyT - 14}L1408 ${cyT - 16}Z`} fill="#eaf6fb" />
      {/* 남극 기지 깃발 (멀리 보이는 탐험대 캠프) */}
      <g transform={`translate(1640 ${cyT - 6})`}>
        <path d="M-26 0L-12 -16L2 0Z" fill="#ec7a5f" />
        <path d="M-6 0L6 -12L18 0Z" fill="#ffd66b" />
        <path d="M24 0V-26" stroke="#44566a" strokeWidth="2" />
        <path d="M24 -26H38L34 -21L38 -16H24Z" fill="#ec7a5f" />
      </g>
      {/* 고원을 걷는 황제펭귄 행렬 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Emperor key={i} x={300 + i * 22} y={cyT - 10 + (i % 2) * 3} s={0.45} />
      ))}

      {/* ---- 왼쪽: 바다로 흘러내리는 빙하 + 황제펭귄 무리 ---- */}
      <path d={`M0 300Q120 290 240 320Q${cx1 - 10} 340 ${cx1 + 10} 380V760Q200 800 120 790Q60 810 0 800Z`} fill="url(#ls-ice)" />
      <path d={`M0 800Q60 810 120 790Q200 800 ${cx1 + 10} 760V790Q200 834 120 822Q60 842 0 832Z`} fill="url(#ls-cliff)" />
      <path
        d="M30 360l40 30l-10 40M120 340l20 50l-20 30M200 380l-20 40l30 30M60 500l40 20M180 520l30 -16"
        stroke="#bfe3f4"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M20 806l6 22M70 812l5 20M130 800l6 22M190 798l4 18" stroke="#1d6f9c" strokeWidth="3" opacity=".6" />
      {/* 황제펭귄 무리 · 새끼 */}
      <g>
        <ellipse cx="140" cy="600" rx="120" ry="40" fill="#e3f1f8" />
        <Emperor x={70} y={580} s={1.05} />
        <Emperor x={104} y={568} s={0.95} flip />
        <Emperor x={150} y={590} s={1.1} />
        <Emperor x={196} y={575} flip />
        <Emperor x={232} y={600} s={0.9} />
        <Emperor x={84} y={628} s={1.05} flip />
        <Emperor x={176} y={634} s={1.0} />
        <Chick x={124} y={600} />
        <Chick x={212} y={620} delay={0.6} />
        <Chick x={52} y={612} delay={1.1} />
        <Chick x={134} y={640} delay={0.3} />
      </g>
      {/* 빙하 위 도둑갈매기 */}
      <g transform="translate(232 470)">
        <ellipse cx="0" cy="0" rx="8" ry="2" fill="#7cc4e4" opacity=".4" />
        <path d="M-8 -4Q-4 -14 6 -12L12 -14L8 -9Q6 -2 -8 -4Z" fill="#7a5a44" />
        <circle cx="7" cy="-12" r="1" fill="#0b1220" />
      </g>

      {/* ---- 오른쪽: 빙상 + 웨델물개 + 탁상형 빙산 ---- */}
      <path
        d={`M${w} 320Q1900 310 1820 330Q${cx2 + 10} 350 ${cx2 - 10} 390V650Q1820 690 1900 676Q1960 690 ${w} 680Z`}
        fill="url(#ls-ice)"
      />
      <path
        d={`M${cx2 - 10} 650Q1820 690 1900 676Q1960 690 ${w} 680V712Q1960 722 1900 708Q1820 722 ${cx2 - 10} 682Z`}
        fill="url(#ls-cliff)"
      />
      <path
        d="M1800 380l30 40l-14 40M1920 360l-20 50l26 34M1860 520l40 16"
        stroke="#bfe3f4"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <WeddellSeal x={1840} y={560} />
      <WeddellSeal x={1930} y={610} s={0.85} />
      <g transform="translate(1790 470)">
        <ellipse cx="0" cy="0" rx="8" ry="2" fill="#7cc4e4" opacity=".4" />
        <path d="M-8 -4Q-4 -14 6 -12L12 -14L8 -9Q6 -2 -8 -4Z" fill="#7a5a44" />
        <circle cx="7" cy="-12" r="1" fill="#0b1220" />
      </g>
      {/* 탁상형 빙산 */}
      <g className="bob" style={{ animationDelay: ".8s" }}>
        <path d="M1800 820H1980V880H1812Z" fill="#8fd1ec" />
        <path d="M1792 806L1990 800V824L1800 830Z" fill={SNOW} />
        <path d="M1830 830V878M1880 832V880M1940 830V876" stroke="#57b8e0" strokeWidth="2" />
      </g>

      {/* ---- 남극해: 유빙 · 물개 · 범고래 · 혹등고래 · 크릴 ---- */}
      <g className="bob">
        <Floe x={90} y={900} rx={56} />
        <WeddellSeal x={92} y={896} s={0.75} />
      </g>
      <g className="bob" style={{ animationDelay: "1.6s" }}>
        <Floe x={210} y={1010} rx={30} />
      </g>
      <g className="bob" style={{ animationDelay: ".9s" }}>
        <Floe x={60} y={1100} rx={36} />
        <Emperor x={52} y={1098} s={0.7} />
        <Emperor x={72} y={1100} s={0.65} flip />
      </g>
      <g className="bob" style={{ animationDelay: "2.2s" }}>
        <Floe x={1890} y={1000} rx={44} />
      </g>
      {[
        [400, 1170, 24],
        [760, 1150, 18],
        [1230, 1172, 22],
        [1560, 1156, 16],
        [1950, 1140, 20],
        [250, 880, 14],
      ].map(([x, y, r], i) => (
        <g key={i} className="bob" style={{ animationDelay: `${i * 0.6}s` }}>
          <Floe x={x} y={y} rx={r} />
        </g>
      ))}
      {/* 표범물개 (물 위로 고개만) */}
      <g transform="translate(1080 1166)">
        <path d="M-10 6Q-10 -12 2 -14Q14 -12 12 6Z" fill="#7d8ea3" />
        <circle cx="5" cy="-8" r="1.4" fill="#0b1220" />
        <path d="M-16 7q16 -5 32 0" stroke="#8fd1ec" strokeWidth="2" fill="none" />
      </g>
      {/* 범고래 떼 — 아래 바다를 천천히 가로지름 */}
      <g className="orca-swim">
        <Orca x={980} y={1150} />
        <Orca x={1050} y={1166} s={0.8} />
        <Orca x={920} y={1170} s={0.65} />
      </g>
      {/* 혹등고래 꼬리 + 물줄기 */}
      <g transform="translate(1890 760)">
        <g className="spout">
          <path d="M0 -40q-8 -18 0 -30q8 12 0 30" fill="#eaf8fe" opacity=".85" />
          <circle cx="-6" cy="-60" r="3" fill="#eaf8fe" opacity=".7" />
          <circle cx="6" cy="-64" r="2.4" fill="#eaf8fe" opacity=".7" />
        </g>
        <path d="M0 0q-6 -16 -22 -24q14 0 22 10q8 -10 22 -10q-16 8 -22 24z" fill="#2b3f57" />
        <path d="M-20 4q20 -8 40 0" stroke="#8fd1ec" strokeWidth="2" fill="none" />
      </g>
      {/* 크릴 떼 */}
      {[
        [330, 960],
        [1700, 1080],
        [600, 1185],
        [1840, 920],
      ].map(([x, y], i) => (
        <g key={i} fill="#ff9a8a" opacity=".65">
          {Array.from({ length: 9 }, (_, k) => (
            <circle key={k} cx={x + ((k * 13) % 34) - 16} cy={y + ((k * 7) % 14) - 6} r="1.6" />
          ))}
        </g>
      ))}
      {/* 캠프 아래쪽 바다 물결 */}
      {Array.from({ length: 10 }, (_, i) => (
        <path
          key={i}
          d={`M${120 + i * 190} ${cyB + 40 + (i % 2) * 18}q12 -5 24 0t24 0`}
          stroke="#57b8e0"
          strokeOpacity=".35"
          strokeWidth="2"
          fill="none"
        />
      ))}

      {/* ---- 하늘을 나는 새들 ---- */}
      <g className="bird-glide">
        <Petrel x={1500} y={230} />
        <Petrel x={1540} y={250} s={0.8} />
        <Petrel x={1470} y={256} s={0.7} />
      </g>
      <g className="bird-glide bird-glide-2">
        <Petrel x={400} y={200} s={0.9} />
        <Petrel x={440} y={186} s={0.7} />
      </g>
      <g className="bird-glide bird-glide-3">
        <Petrel x={1000} y={280} s={1.1} color="#7a5a44" />
      </g>
    </svg>
  );
});
