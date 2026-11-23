/**
 * 남극 빙붕 위 공부 캠프 — 바닥 레이어(깊이 정렬 없음)와 소품(펭귄과 함께 y 기준 깊이 정렬).
 * 모두 정적 SVG이고, 움직임은 CSS 애니메이션 몇 개(오로라·전구·유빙·김·물고기)만 씁니다.
 */
import { memo } from "react";
import { DIVIDER_SEGMENTS, PROPS, SEATS, WORLD, ZONES, type MapProp } from "@/shared/officeMap";

const BOOKS = ["#ec7a5f", "#ffd66b", "#5ff2c1", "#2fa8d9", "#8b7bff", "#f6a894"];
const SNOW = "#fbfeff";
const ICE_LINE = "#9fd3ea";

/** 지그재그 빙벽 윗선 (눈 처마) */
const CLIFF_TOP =
  "M78 96L120 84L170 98L215 78L270 92L330 72L390 90L450 70L515 88L575 74L640 92L700 70L760 86L820 66L880 84L940 70L1000 90L1060 72L1120 88L1180 70L1240 86L1300 68L1360 88L1420 74L1480 90L1522 80";

/* ============================================================
   바닥 레이어
   ============================================================ */
export const MapFloor = memo(function MapFloor() {
  const { w, h } = WORLD;
  const [focus, standing] = ZONES;
  const top = 200;
  const bottom = 962;
  return (
    <svg className="absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#061a30" />
          <stop offset="1" stopColor="#04223a" />
        </linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050f22" />
          <stop offset="1" stopColor="#0b2340" />
        </linearGradient>
        <linearGradient id="aurora-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5ff2c1" stopOpacity="0" />
          <stop offset=".3" stopColor="#5ff2c1" stopOpacity=".55" />
          <stop offset=".65" stopColor="#3fd0e0" stopOpacity=".4" />
          <stop offset="1" stopColor="#8b7bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora-p" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f6a894" stopOpacity="0" />
          <stop offset=".5" stopColor="#c58bff" stopOpacity=".35" />
          <stop offset="1" stopColor="#5ff2c1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6f6fd" />
          <stop offset=".35" stopColor="#a9ddf1" />
          <stop offset=".8" stopColor="#57b8e0" />
          <stop offset="1" stopColor="#2f86b8" />
        </linearGradient>
        <radialGradient id="snowfield" cx=".5" cy=".45" r=".75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".7" stopColor="#f1f9fd" />
          <stop offset="1" stopColor="#dcedf6" />
        </radialGradient>
        <linearGradient id="blueice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9ecfa" />
          <stop offset=".5" stopColor="#aee0f4" />
          <stop offset="1" stopColor="#9bd6ef" />
        </linearGradient>
        <radialGradient id="warm" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity=".55" />
          <stop offset=".6" stopColor="#ffb38a" stopOpacity=".18" />
          <stop offset="1" stopColor="#ffb38a" stopOpacity="0" />
        </radialGradient>
        {/* 바람이 깎아 만든 눈결(사스트루기) */}
        <pattern id="sastrugi" width="220" height="90" patternUnits="userSpaceOnUse">
          <path
            d="M10 30q30 -10 60 0t60 0M120 70q24 -8 48 0t48 0M0 78q14 -5 28 0"
            stroke="#d6eaf4"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="90" cy="54" r="1.4" fill="#fff" />
          <circle cx="180" cy="20" r="1.2" fill="#fff" />
        </pattern>
      </defs>

      {/* ---- 남극해 ---- */}
      <rect width={w} height={h} fill="url(#sea)" />
      {/* 유빙 조각들 */}
      {[
        [20, 250, 16],
        [52, 290, 10],
        [30, 420, 12],
        [58, 470, 8],
        [14, 690, 10],
        [44, 760, 14],
        [24, 900, 9],
        [1548, 260, 12],
        [1580, 300, 8],
        [1560, 430, 15],
        [1534, 560, 9],
        [1578, 640, 11],
        [1550, 780, 13],
        [1584, 930, 9],
      ].map(([x, y, r], i) => (
        <g key={i} className="bob" style={{ animationDelay: `${(i % 5) * 0.7}s` }}>
          <ellipse cx={x} cy={y + 3} rx={r} ry={r * 0.45} fill="#57b8e0" opacity=".35" />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.45} fill="#eaf6fb" />
        </g>
      ))}
      {/* 탁상형 빙산 */}
      <g className="bob" style={{ animationDelay: "1.1s" }}>
        <path d="M1528 168H1596V214H1534Z" fill="#a9ddf1" />
        <path d="M1524 160L1600 156V172L1528 176Z" fill="#f4fbfe" />
        <path d="M1540 176V212M1562 176V214M1582 174V210" stroke="#7cc4e4" strokeWidth="2" />
      </g>
      {/* 유빙 위 물개 */}
      <g className="bob" style={{ animationDelay: ".4s" }}>
        <ellipse cx="40" cy="606" rx="34" ry="12" fill="#eaf6fb" />
        <ellipse cx="40" cy="610" rx="34" ry="12" fill="#57b8e0" opacity=".25" />
        <path d="M18 600Q22 586 40 586Q58 588 62 600Q50 604 18 600Z" fill="#7d8ea3" />
        <circle cx="56" cy="592" r="7" fill="#8a9bb0" />
        <circle cx="58" cy="590" r="1.6" fill="#0b1220" />
        <path d="M16 600l-8 -4l2 8z" fill="#7d8ea3" />
      </g>
      {/* 고래 꼬리 */}
      <g className="whale">
        <path d="M1556 872q-4 -12 -16 -18q10 0 16 8q6 -8 16 -8q-12 6 -16 18z" fill="#2b3f57" />
        <path d="M1540 878q16 -6 32 0" stroke="#8fd1ec" strokeWidth="2" fill="none" opacity=".6" />
      </g>
      <g className="fish-jump">
        <path d="M24 360q8 -8 16 0q-8 8 -16 0zM24 360l-8 -6v12z" fill="#ffd66b" />
      </g>

      {/* ---- 하늘 · 오로라 · 설산 (빙벽 너머) ---- */}
      <rect x="78" y="0" width="1444" height="120" fill="url(#sky)" />
      <g className="aurora-sway">
        <path d="M60 46Q300 0 560 34T1060 20T1560 40V70Q1300 44 1060 56T560 64T60 80Z" fill="url(#aurora-g)" />
        <path d="M200 24Q480 -4 760 22T1400 10V30Q1080 30 760 40T200 44Z" fill="url(#aurora-p)" />
      </g>
      {[
        [140, 14],
        [310, 8],
        [520, 18],
        [690, 6],
        [870, 12],
        [1030, 8],
        [1210, 16],
        [1390, 6],
        [1470, 22],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.3 : 1.9} fill="#fff" className="twinkle" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
      <path
        d="M78 120L150 56L210 88L290 30L360 80L430 44L500 92L590 26L660 76L740 40L820 86L900 34L980 78L1060 46L1140 90L1230 32L1300 74L1380 42L1450 82L1522 50V120Z"
        fill="#2b3f57"
      />
      <path
        d="M150 56L136 70L150 66L162 72ZM290 30L270 50L290 44L306 52ZM590 26L570 46L590 40L606 48ZM900 34L882 52L900 46L916 54ZM1230 32L1212 50L1230 44L1246 52Z"
        fill="#eaf6fb"
      />

      {/* ---- 빙붕 (옆면 · 윗면 눈밭) ---- */}
      <path d="M78 214Q78 190 104 188H1496Q1522 190 1522 214V950Q1522 990 1484 992H116Q78 990 78 950Z" fill="#4aa3d4" />
      <path d="M92 972H1508M100 982H1500" stroke="#2f86b8" strokeWidth="2" opacity=".5" />
      <path d="M78 200Q78 176 104 174H1496Q1522 176 1522 200V936Q1522 966 1490 968H110Q78 966 78 936Z" fill="url(#snowfield)" />
      <path d="M78 200Q78 176 104 174H1496Q1522 176 1522 200V936Q1522 966 1490 968H110Q78 966 78 936Z" fill="url(#sastrugi)" />
      {/* 가장자리 눈더미 */}
      <path d="M82 960Q90 920 140 930Q190 900 240 936Q280 930 300 966Z" fill={SNOW} />
      <path d="M1520 560Q1484 590 1490 640Q1470 690 1520 720Z" fill={SNOW} />
      <path d="M1210 966Q1250 940 1300 950Q1350 936 1400 966Z" fill={SNOW} opacity=".9" />

      {/* ---- 구역 바닥 ---- */}
      {/* 집중석: 매끈한 청빙 */}
      <path
        d={`M${focus.rect.x1 + 2} ${top + 30}Q${focus.rect.x1 + 2} ${top + 8} 160 ${top + 6}H${focus.rect.x2 - 22}Q${focus.rect.x2 - 10} ${top + 8} ${focus.rect.x2 - 10} ${top + 30}V${bottom - 40}Q${focus.rect.x2 - 14} ${bottom - 14} ${focus.rect.x2 - 50} ${bottom - 16}H170Q${focus.rect.x1 + 4} ${bottom - 18} ${focus.rect.x1 + 2} ${bottom - 60}Z`}
        fill="url(#blueice)"
        opacity=".85"
      />
      <path
        d="M140 330l60 22l40 -10l70 28M380 260l30 40l-10 50l40 30M600 420l50 18l30 -14l60 26M200 600l40 -20l60 16M420 700l36 30l-6 46l44 20M640 560l40 -30l50 10M180 850l60 -18l50 14l40 -10M560 880l40 -24l70 8"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
        opacity=".75"
      />
      <path
        d="M140 330l60 22l40 -10M600 420l50 18M420 700l36 30M560 880l40 -24"
        stroke="#7cc4e4"
        strokeWidth="1.2"
        fill="none"
        transform="translate(2 3)"
      />
      {[
        [230, 400],
        [520, 560],
        [300, 760],
        [690, 330],
        [610, 760],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y}l70 -40M${x + 18} ${y + 10}l40 -24`}
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".45"
        />
      ))}

      {/* 스탠딩석: 다져진 눈길 + 펭귄 발자국 */}
      <path
        d={`M${standing.rect.x1 + 30} ${top + 10}Q938 ${top - 4} ${standing.rect.x2 - 30} ${top + 10}Q${standing.rect.x2 - 14} 560 ${standing.rect.x2 - 26} ${bottom - 6}H${standing.rect.x1 + 26}Q${standing.rect.x1 + 14} 560 ${standing.rect.x1 + 30} ${top + 10}Z`}
        fill="#e7eff4"
      />
      <path
        d={`M${standing.rect.x1 + 30} ${top + 10}Q${standing.rect.x1 + 14} 560 ${standing.rect.x1 + 26} ${bottom - 6}M${standing.rect.x2 - 30} ${top + 10}Q${standing.rect.x2 - 14} 560 ${standing.rect.x2 - 26} ${bottom - 6}`}
        stroke="#d2e2eb"
        strokeWidth="6"
        fill="none"
      />
      {Array.from({ length: 22 }, (_, i) => {
        const y = 940 - i * 33;
        const x = 900 + (i % 2) * 22 + Math.sin(i * 0.9) * 26;
        return (
          <path key={i} d={`M${x} ${y}l-5 -9M${x} ${y}v-10M${x} ${y}l5 -9`} stroke="#b4c8d6" strokeWidth="2.4" strokeLinecap="round" />
        );
      })}

      {/* 카페석: 랜턴 불빛이 고인 눈밭 */}
      {[
        [1190, 450],
        [1390, 450],
        [1190, 650],
        [1390, 650],
        [1110, 860],
        [1290, 300],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={i === 5 ? 200 : 120} ry={i === 5 ? 70 : 80} fill="url(#warm)" />
      ))}

      {/* 자리 표시 (얼음 의자 · 뜨개 방석 · 다진 눈 발판) */}
      {SEATS.map((s) =>
        s.kind === "desk" ? (
          <g key={s.id}>
            <ellipse cx={s.x} cy={s.y + 3} rx="22" ry="9" fill="#7cc4e4" opacity=".45" />
            <ellipse cx={s.x} cy={s.y} rx="20" ry="8" fill="#e3f4fb" stroke={ICE_LINE} />
          </g>
        ) : s.kind === "cafe" ? (
          <g key={s.id}>
            <ellipse cx={s.x} cy={s.y + 3} rx="22" ry="9" fill="#d85f45" opacity=".35" />
            <ellipse cx={s.x} cy={s.y} rx="20" ry="8" fill="#ec7a5f" />
            <path d={`M${s.x - 14} ${s.y - 2}h28M${s.x - 16} ${s.y + 2}h32`} stroke="#fde4de" strokeWidth="1.6" strokeDasharray="3 3" />
          </g>
        ) : s.kind === "standing" ? (
          <ellipse key={s.id} cx={s.x} cy={s.y} rx="22" ry="8" fill="#fff" stroke="#c9dde8" strokeWidth="2" />
        ) : null,
      )}

      {/* ---- 구역 경계: 얼음 블록 담 ---- */}
      {DIVIDER_SEGMENTS.map((r, i) => {
        const y2 = Math.min(r.y2, bottom - 4);
        const cx = (r.x1 + r.x2) / 2;
        const n = Math.max(1, Math.round((y2 - r.y1) / 24));
        const step = (y2 - r.y1) / n;
        return (
          <g key={i}>
            <rect x={cx - 13} y={r.y1 + 4} width="26" height={y2 - r.y1} rx="8" fill="#7cc4e4" opacity=".35" />
            {Array.from({ length: n }, (_, k) => {
              const off = k % 2 ? 2 : -2;
              return (
                <g key={k}>
                  <rect
                    x={cx - 12 + off}
                    y={r.y1 + k * step}
                    width="24"
                    height={step - 2}
                    rx="5"
                    fill="#e6f6fc"
                    stroke={ICE_LINE}
                    strokeWidth="1.5"
                  />
                  <path d={`M${cx - 7 + off} ${r.y1 + k * step + 5}l8 6`} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </g>
              );
            })}
            {/* 블록 끝 눈 덩이 */}
            <ellipse cx={cx} cy={r.y1 + 2} rx="17" ry="8" fill={SNOW} stroke="#d6eaf4" />
            <ellipse cx={cx} cy={y2 - 2} rx="17" ry="8" fill={SNOW} stroke="#d6eaf4" />
          </g>
        );
      })}

      {/* ---- 빙하 절벽 ---- */}
      <path d={`${CLIFF_TOP}L1522 200H78Z`} fill="url(#cliff)" />
      {/* 빙하 층리 */}
      {[118, 140, 160, 182].map((y, i) => (
        <path
          key={y}
          d={`M78 ${y}q120 ${i % 2 ? 6 : -6} 240 0t240 0t240 0t240 0t240 0t240 0`}
          stroke="#eaf8fe"
          strokeOpacity={0.5 - i * 0.08}
          strokeWidth="2"
          fill="none"
        />
      ))}
      {/* 크레바스 */}
      {[110, 250, 352, 505, 720, 860, 1010, 1100, 1470].map((x, i) => (
        <path key={x} d={`M${x} ${92 + (i % 3) * 4}l-6 ${60 + (i % 4) * 12}l10 -8l4 ${30 - (i % 3) * 6}z`} fill="#2f86b8" opacity=".55" />
      ))}
      {/* 눈 처마 */}
      <path d={CLIFF_TOP} stroke={SNOW} strokeWidth="12" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d={CLIFF_TOP} stroke="#d6eaf4" strokeWidth="3" fill="none" transform="translate(0 6)" />
      {/* 고드름 */}
      <path
        d={Array.from({ length: 48 }, (_, i) => {
          const x = 90 + i * 29.5;
          const len = 8 + ((i * 7) % 5) * 4;
          return `M${x} 200l5 ${len}l5 -${len}`;
        }).join("")}
        fill="#eaf8fe"
      />
      <path d="M78 200H1522" stroke="#8fd1ec" strokeWidth="5" />

      {/* 집중석 벽: 빙벽을 깎은 책 선반 + 얼음 표지판 */}
      {[140, 600].map((x0) => (
        <g key={x0}>
          <path
            d={`M${x0} 196V126Q${x0} 102 ${x0 + 24} 102H${x0 + 156}Q${x0 + 180} 102 ${x0 + 180} 126V196Z`}
            fill="#2f86b8"
            opacity=".55"
          />
          <path
            d={`M${x0 + 6} 196V130Q${x0 + 6} 108 ${x0 + 26} 108H${x0 + 154}Q${x0 + 174} 108 ${x0 + 174} 130`}
            stroke="#eaf8fe"
            strokeWidth="2"
            fill="none"
            opacity=".7"
          />
          {[0, 1].map((row) => (
            <g key={row}>
              {Array.from({ length: 10 }, (_, i) => {
                const bh = 22 + ((i + row) % 3) * 3;
                return (
                  <rect
                    key={i}
                    x={x0 + 14 + i * 15.5}
                    y={148 + row * 38 - bh}
                    width={11 + ((i + row) % 2) * 2}
                    height={bh}
                    rx="2"
                    fill={BOOKS[(i + row * 2) % BOOKS.length]}
                    opacity=".92"
                  />
                );
              })}
              <rect x={x0 + 8} y={148 + row * 38} width="164" height="6" rx="3" fill="#e6f6fc" />
            </g>
          ))}
        </g>
      ))}
      <g>
        <rect x="370" y="100" width="170" height="60" rx="12" fill="#f4fbfe" fillOpacity=".9" stroke="#8fd1ec" strokeWidth="2" />
        <path d="M376 104q40 -8 80 0t80 0" stroke={SNOW} strokeWidth="6" strokeLinecap="round" />
        <text x="455" y="129" textAnchor="middle" fontSize="17" fontWeight="800" fill="#146b94">
          🤫 쉿! 집중 중
        </text>
        <text x="455" y="150" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1d8fc0">
          대화는 카페석에서
        </text>
      </g>

      {/* 스탠딩석 벽: 얼음 목표판 */}
      <g>
        <rect x="820" y="80" width="236" height="104" rx="10" fill="#f4fbfe" fillOpacity=".88" stroke="#8fd1ec" strokeWidth="2" />
        <path d="M826 84q38 -8 76 0t76 0t76 0" stroke={SNOW} strokeWidth="6" strokeLinecap="round" />
        <text x="838" y="108" fontSize="15" fontWeight="800" fill="#146b94">
          오늘의 목표 ✔
        </text>
        {["강의 1개 듣기", "스터디 노트 정리", "질문 3개 하기"].map((t, i) => (
          <g key={t}>
            <rect x="838" y={118 + i * 21} width="13" height="13" rx="3" fill="none" stroke="#57b8e0" strokeWidth="2" />
            {i === 0 && <path d="M841 124l3 4l6 -8" stroke="#1fa97a" strokeWidth="2.5" fill="none" />}
            <text x="858" y={129 + i * 21} fontSize="12" fontWeight="700" fill="#2b3a4a">
              {t}
            </text>
          </g>
        ))}
      </g>

      {/* 카페석 벽: 빙벽에 붙여 지은 이글루 카페 */}
      <g>
        <path d="M1130 200Q1130 62 1285 58Q1440 62 1440 200Z" fill="#f4fbfe" stroke="#a9ddf1" strokeWidth="3" />
        <path
          d="M1140 170H1430M1150 140H1420M1168 112H1402M1196 86H1374M1230 66H1340M1200 200V170M1260 200V170M1320 200V170M1380 200V170M1180 170V140M1240 170V140M1330 170V140M1400 170V140M1210 140V112M1290 140V112M1360 140V112M1240 112V86M1320 112V86"
          stroke="#c9e6f3"
          strokeWidth="2"
          fill="none"
        />
        <path d="M1245 200V160Q1245 132 1285 132Q1325 132 1325 160V200Z" fill="#163a57" />
        <path d="M1255 200V164Q1255 142 1285 142Q1315 142 1315 164V200Z" fill="#ffcf7a" opacity=".55" />
        <rect x="1212" y="92" width="146" height="30" rx="6" fill="#8a5a3b" />
        <text x="1285" y="113" textAnchor="middle" fontSize="15" fontWeight="800" fill="#ffd66b">
          ☕ ADELIE CAFÉ
        </text>
        <text x="1235" y="158" textAnchor="end" fontSize="11" fontWeight="800" fill="#c25a40">
          빙하 라떼 · 핫초코
        </text>
        <text x="1335" y="158" fontSize="11" fontWeight="800" fill="#c25a40">
          크릴 쿠키 🐟
        </text>
      </g>
      {/* 랜턴 줄 */}
      <path d="M1096 54V200M1486 54V200" stroke="#8fd1ec" strokeWidth="6" strokeLinecap="round" />
      <path d="M1096 60Q1190 104 1290 64Q1390 104 1486 60" stroke="#44566a" strokeWidth="2" fill="none" />
      {Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const x = 1096 + t * 390;
        const y = 62 + Math.sin(((t * 2) % 1) * Math.PI) * 20;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="5"
            fill={["#ffd66b", "#f6a894", "#ffcf7a"][i % 3]}
            className="twinkle"
            style={{ animationDelay: `${(i % 5) * 0.4}s` }}
          />
        );
      })}

      {/* ---- 구역 이름 (빙벽 아래 얼음 명판) ---- */}
      {ZONES.map((z) => {
        if (z.id === "cafe") return null; // 카페는 이글루 간판으로 표시
        const cx = z.id === "focus" ? 455 : (z.rect.x1 + z.rect.x2) / 2;
        const text = `${z.emoji} ${z.label}`;
        const tw = text.length * 14 + 30;
        const fill = z.id === "focus" ? "#146b94" : "#1a7a63";
        return (
          <g key={z.id}>
            <rect x={cx - tw / 2} y="178" width={tw} height="28" rx="14" fill={fill} />
            <path
              d={`M${cx - tw / 2 + 10} 178q${tw / 4 - 5} -5 ${tw / 2 - 10} 0t${tw / 2 - 10} 0`}
              stroke={SNOW}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <text x={cx} y="197" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
              {text}
            </text>
          </g>
        );
      })}

      {/* ---- 입구: 눈 둔덕 ---- */}
      <path d="M864 960Q868 928 938 926Q1008 928 1012 960Z" fill={SNOW} stroke="#d6eaf4" strokeWidth="2" />
      <text x="938" y="951" textAnchor="middle" fontSize="12" fontWeight="800" fill="#146b94">
        입구 · WELCOME
      </text>
    </svg>
  );
});

/* ============================================================
   소품 (y 기준 깊이 정렬)
   ============================================================ */
const SIZE: Record<MapProp["kind"], [number, number]> = {
  desk: [132, 80],
  tallTable: [80, 92],
  cafeTable: [92, 64],
  snowBench: [320, 56],
  counter: [368, 92],
  crystal: [46, 72],
  signpost: [150, 140],
  lantern: [40, 120],
};

function PropSvg({ kind, variant }: { kind: MapProp["kind"]; variant: number }) {
  const [w, h] = SIZE[kind];
  const common = { width: w, height: h, viewBox: `0 0 ${w} ${h}`, "aria-hidden": true, overflow: "visible" } as const;
  switch (kind) {
    case "desk":
      // 얼음을 깎은 책상 + 왼쪽 눈 블록 바람막이
      return (
        <svg {...common}>
          <ellipse cx="68" cy="78" rx="62" ry="5" fill="#7cc4e4" opacity=".35" />
          <rect x="0" y="40" width="16" height="38" rx="4" fill={SNOW} stroke="#d6eaf4" />
          <rect x="2" y="16" width="16" height="26" rx="4" fill={SNOW} stroke="#d6eaf4" />
          <rect x="8" y="46" width="120" height="32" rx="6" fill="#8fd1ec" />
          <path d="M20 50l14 24M60 50l10 20M100 52l12 22" stroke="#bfe6f7" strokeWidth="3" strokeLinecap="round" />
          <rect x="8" y="34" width="120" height="20" rx="6" fill="#e6f6fc" stroke="#fff" strokeWidth="2" />
          <path d="M14 36q12 -6 24 0t24 0t24 0t24 0t14 0" stroke={SNOW} strokeWidth="5" strokeLinecap="round" fill="none" />
          {variant % 3 === 0 && (
            <g>
              <circle cx="112" cy="26" r="16" fill="#ffd66b" opacity=".25" />
              <rect x="105" y="20" width="14" height="16" rx="3" fill="#fff6d1" stroke="#c98b52" strokeWidth="2" />
              <path d="M106 20h12l-2 -4h-8z" fill="#c98b52" />
            </g>
          )}
          {variant % 3 === 1 && (
            <g>
              <rect x="104" y="26" width="14" height="11" rx="3" fill="#ec7a5f" />
              <path
                d="M107 24q2 -6 0 -11M113 24q2 -6 0 -11"
                stroke="#fff"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                className="steam"
              />
            </g>
          )}
          {variant % 3 === 2 && (
            <g>
              <rect x="100" y="30" width="20" height="5" rx="1" fill="#2fa8d9" />
              <rect x="102" y="25" width="18" height="5" rx="1" fill="#ffd66b" />
            </g>
          )}
        </svg>
      );
    case "tallTable":
      // 얼음 기둥 테이블
      return (
        <svg {...common}>
          <ellipse cx="40" cy="88" rx="26" ry="5" fill="#7cc4e4" opacity=".45" />
          <path d="M30 32L28 88H52L50 32Z" fill="#a9ddf1" />
          <path d="M34 36L33 84M44 38L46 82" stroke="#e6f6fc" strokeWidth="2" />
          <ellipse cx="40" cy="32" rx="38" ry="12" fill="#7cc4e4" />
          <ellipse cx="40" cy="28" rx="38" ry="12" fill="#e6f6fc" stroke="#fff" strokeWidth="2" />
          <path d="M8 26q8 -8 18 -6q8 -6 18 -2q10 -4 20 2q8 0 10 4" stroke={SNOW} strokeWidth="5" strokeLinecap="round" fill="none" />
          <rect x="30" y="20" width="18" height="12" rx="2" fill="#ffd66b" transform="rotate(-10 39 26)" />
        </svg>
      );
    case "cafeTable":
      // 얼음 드럼 테이블 + 코코아
      return (
        <svg {...common}>
          <ellipse cx="46" cy="62" rx="24" ry="4" fill="#7cc4e4" opacity=".45" />
          <rect x="34" y="28" width="24" height="34" rx="6" fill="#a9ddf1" />
          <path d="M40 32v26M50 32v26" stroke="#e6f6fc" strokeWidth="2" />
          <ellipse cx="46" cy="30" rx="44" ry="15" fill="#7cc4e4" />
          <ellipse cx="46" cy="26" rx="44" ry="15" fill="#e6f6fc" stroke="#fff" strokeWidth="2" />
          <path d="M6 26q20 -12 40 -12t40 12" stroke={SNOW} strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="20" y="16" width="13" height="11" rx="3" fill="#ec7a5f" />
          <path d="M24 14q2 -5 0 -9" stroke="#fff" strokeWidth="2" fill="none" className="steam" />
          <circle cx="62" cy="24" r="8" fill="#fff8ef" stroke="#e8dccb" />
          <circle cx="60" cy="22" r="3" fill="#c98b52" />
          <circle cx="66" cy="25" r="3" fill="#c98b52" />
        </svg>
      );
    case "snowBench":
      // 눈을 깎은 벤치 + 뜨개 담요
      return (
        <svg {...common}>
          <ellipse cx="160" cy="52" rx="160" ry="6" fill="#7cc4e4" opacity=".35" />
          <rect x="0" y="8" width="320" height="44" rx="16" fill={SNOW} stroke="#d6eaf4" strokeWidth="2" />
          <path d="M80 10V50M160 10V50M240 10V50M0 30H320" stroke="#e1eef5" strokeWidth="2" />
          {[
            [34, "#ec7a5f"],
            [128, "#ffd66b"],
            [222, "#ec7a5f"],
          ].map(([x, c]) => (
            <g key={x as number}>
              <rect x={x as number} y="4" width="64" height="40" rx="8" fill={c as string} />
              <path
                d={`M${(x as number) + 4} 14h56M${(x as number) + 4} 24h56M${(x as number) + 4} 34h56`}
                stroke="#fff"
                strokeOpacity=".55"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </g>
          ))}
        </svg>
      );
    case "counter":
      // 얼음 블록 바 카운터
      return (
        <svg {...common}>
          <ellipse cx="184" cy="90" rx="184" ry="5" fill="#7cc4e4" opacity=".35" />
          {[0, 1].map((row) =>
            Array.from({ length: 8 }, (_, i) => (
              <rect
                key={`${row}-${i}`}
                x={4 + i * 45 + (row ? 22 : 0) - (row && i === 7 ? 22 : 0)}
                y={50 + row * 20}
                width={row && i === 7 ? 22 : 44}
                height="19"
                rx="4"
                fill="#d9f0fa"
                stroke={ICE_LINE}
              />
            )),
          )}
          <rect x="4" y="30" width="360" height="22" rx="8" fill="#e6f6fc" stroke="#fff" strokeWidth="2" />
          <path
            d="M10 32q20 -7 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t30 0"
            stroke={SNOW}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* 주전자 · 보온병 */}
          <path d="M40 30V14Q40 4 54 4Q68 4 68 14V30Z" fill="#ec7a5f" />
          <path d="M68 14q12 2 12 12" stroke="#ec7a5f" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M52 2q2 -6 0 -12M58 2q2 -6 0 -12" stroke="#fff" strokeWidth="2" fill="none" className="steam" />
          <rect x="92" y="8" width="16" height="24" rx="4" fill="#2fa8d9" />
          {/* 쿠키 유리병 */}
          <rect x="150" y="6" width="56" height="26" rx="8" fill="#eaf8fe" opacity=".85" stroke="#a9ddf1" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={164 + i * 14} cy="22" r="5.5" fill="#c98b52" />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={262 + i * 16} y="18" width="12" height="14" rx="3" fill={["#fff", "#5ff2c1", "#ffd66b"][i]} />
          ))}
          <text x="184" y="66" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1d8fc0">
            ORDER HERE
          </text>
        </svg>
      );
    case "crystal":
      // 얼음 결정 (펜텐테)
      return (
        <svg {...common}>
          <ellipse cx="23" cy="70" rx="20" ry="4" fill="#7cc4e4" opacity=".4" />
          <path d="M6 70L12 30L18 70Z" fill="#bfe6f7" />
          <path d="M14 70L23 6L32 70Z" fill="#e6f6fc" stroke="#a9ddf1" />
          <path d="M28 70L36 24L42 70Z" fill="#a9ddf1" />
          <path d="M23 12L21 60" stroke="#fff" strokeWidth="2" />
        </svg>
      );
    case "lantern":
      return (
        <svg {...common}>
          <circle cx="20" cy="22" r="36" fill="#ffcf7a" opacity=".22" />
          <rect x="17" y="34" width="6" height="80" rx="3" fill="#a9ddf1" />
          <ellipse cx="20" cy="116" rx="14" ry="5" fill={SNOW} stroke="#d6eaf4" />
          <path d="M8 14H32L30 36H10Z" fill="#fff6d1" stroke="#c98b52" strokeWidth="2.5" />
          <path d="M6 14L20 2L34 14Z" fill="#8a5a3b" />
          <circle cx="20" cy="25" r="5" fill="#ffb347" />
        </svg>
      );
    case "signpost":
      // 남극 이정표
      return (
        <svg {...common}>
          <ellipse cx="75" cy="136" rx="24" ry="5" fill={SNOW} stroke="#d6eaf4" />
          <rect x="71" y="8" width="8" height="130" rx="3" fill="#8a5a3b" />
          <path d="M71 10h8" stroke={SNOW} strokeWidth="5" strokeLinecap="round" />
          {(
            [
              [18, "left", "✏️ 집중석", "#146b94"],
              [46, "right", "☕ 카페석", "#c25a40"],
              [74, "left", "🐧 남극점 1,280km", "#44566a"],
            ] as const
          ).map(([y, side, label, color]) => {
            const bw = [...label].length * 9 + 14;
            const x = side === "right" ? 79 : 71 - bw;
            const tip = side === "right" ? `M${x + bw} ${y}l10 10l-10 10` : `M${x} ${y}l-10 10l10 10`;
            return (
              <g key={label}>
                <rect x={x} y={y} width={bw} height="20" fill={color} />
                <path d={`${tip}Z`} fill={color} />
                <path d={`M${x + 2} ${y + 1}h${bw - 4}`} stroke={SNOW} strokeWidth="3" strokeLinecap="round" />
                <text x={x + bw / 2} y={y + 15} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      );
  }
}

/** 소품 하나를 바닥 중앙(x, y) 기준으로 배치. zIndex는 y (펭귄과 깊이 정렬) */
export const MapProps = memo(function MapProps() {
  return (
    <>
      {PROPS.map((p, i) => {
        const [w, h] = SIZE[p.kind];
        return (
          <div
            key={p.id}
            className="pointer-events-none absolute"
            style={{ left: p.x - w / 2, top: p.y - h, width: w, height: h, zIndex: Math.round(p.y) }}
          >
            <PropSvg kind={p.kind} variant={i} />
          </div>
        );
      })}
    </>
  );
});

/** 맵 전체에 내리는 눈 (배경 이미지 하나 + CSS 애니메이션) */
export function Snowfall() {
  return <div aria-hidden="true" className="snowfall pointer-events-none absolute inset-0" />;
}
