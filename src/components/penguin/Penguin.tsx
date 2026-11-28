/**
 * 아델리 펭귄 — 랜딩(adelie_landing/assets/js/penguin.js)의 SVG 렌더러를 React로 옮긴 것.
 * 파츠(몸통/날개/눈/발/소품)를 분리해 그려서 CSS(globals.css의 .peng 규칙)로 각각 애니메이션합니다.
 */
import type { CSSProperties } from "react";

export const PENGUIN_COLORS = {
  ink: "#1a2436",
  dark: "#0b1220",
  coral: "#f3907a",
  coral2: "#ec7a5f",
  blush: "#f6a894",
  brand: "#2fa8d9",
  brand6: "#1d8fc0",
  brand7: "#146b94",
  ice: "#a9ddf1",
} as const;

export type PenguinAnim = "bounce" | "waddle" | "tilt" | "wave-r" | "point" | "flap" | "type";

export interface PenguinPose {
  laptop?: boolean;
  book?: boolean;
  cap?: boolean;
  pointer?: boolean;
  wave?: "r";
  expr?: "happy";
  look?: [number, number];
  sparkles?: boolean;
  /** AI 선글라스 — 스터디 LIVE 를 보는 중 */
  shades?: boolean;
}

export interface PenguinProps extends PenguinPose {
  anim?: PenguinAnim[];
  /** 애니메이션 시작 지연(초) — 여러 마리가 동시에 같은 동작을 하지 않게 */
  delay?: number;
  jumping?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

const C = PENGUIN_COLORS;

function Star({ x, y, s, fill, delay }: { x: number; y: number; s: number; fill: string; delay: number }) {
  const k = s * 0.3;
  return (
    <g className="p-spark" style={{ animationDelay: `${delay}s` }}>
      <path
        d={`M${x} ${y - s}L${x + k} ${y - k}L${x + s} ${y}L${x + k} ${y + k}L${x} ${y + s}L${x - k} ${y + k}L${x - s} ${y}L${x - k} ${y - k}Z`}
        fill={fill}
      />
    </g>
  );
}

export function PenguinSvg(o: PenguinPose) {
  const look = o.look ?? [0, 0];
  const holding = o.laptop || o.book;
  const showFlipL = !holding;
  const showFlipR = !holding || o.wave === "r";

  return (
    <svg className="peng-svg" viewBox="0 0 240 250" aria-hidden="true" focusable="false">
      <ellipse className="p-shadow" cx="120" cy="238" rx="58" ry="7" fill={C.dark} opacity=".12" />
      <g className="p-body">
        <ellipse className="p-foot-l" cx="98" cy="230" rx="17" ry="7.5" fill={C.coral} />
        <ellipse className="p-foot-r" cx="142" cy="230" rx="17" ry="7.5" fill={C.coral} />
        {showFlipL && (
          <g className="p-flip-l">
            <path d="M66 128C42 142 30 172 36 194C54 186 68 164 72 142Z" fill={C.ink} />
          </g>
        )}
        {showFlipR && (
          <g className="p-flip-r">
            {o.pointer && (
              <>
                <path d="M196 178L222 224" stroke="#c98b52" strokeWidth="5" strokeLinecap="round" />
                <circle cx="223" cy="226" r="5.5" fill={C.coral2} />
              </>
            )}
            <path d="M174 128C198 142 210 172 204 194C186 186 172 164 168 142Z" fill={C.ink} />
          </g>
        )}
        <path
          d="M120 40C174 40 194 96 192 150C190 200 162 228 120 228C78 228 50 200 48 150C46 96 66 40 120 40Z"
          fill={C.ink}
        />
        <ellipse cx="88" cy="70" rx="16" ry="9" fill="#fff" opacity=".1" transform="rotate(-30 88 70)" />
        <path
          d="M120 114C152 114 170 142 170 172C170 204 150 220 120 220C90 220 70 204 70 172C70 142 88 114 120 114Z"
          fill="#fff"
        />
        <g className="p-eyes">
          <circle cx="96" cy="98" r="15" fill="#fff" />
          <circle cx="144" cy="98" r="15" fill="#fff" />
          {o.expr === "happy" ? (
            <path
              d="M86 101Q96 89 106 101M134 101Q144 89 154 101"
              stroke={C.dark}
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <g className="p-pupils" transform={`translate(${look[0]} ${look[1]})`}>
              <circle cx="96" cy="99" r="8.5" fill={C.dark} />
              <circle cx="144" cy="99" r="8.5" fill={C.dark} />
              <circle cx="99" cy="95.5" r="3.2" fill="#fff" />
              <circle cx="147" cy="95.5" r="3.2" fill="#fff" />
              <circle cx="93.5" cy="102.5" r="1.4" fill="#fff" />
              <circle cx="141.5" cy="102.5" r="1.4" fill="#fff" />
            </g>
          )}
        </g>
        {o.shades && (
          <g className="p-shades">
            {/* 다리(템플) · 브리지 */}
            <path d="M66 92L78 95M162 95L174 92" stroke={C.dark} strokeWidth="5" strokeLinecap="round" />
            <path d="M114 96Q120 91 126 96" stroke="#5ff2c1" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* 렌즈: 짙은 유리 + 오로라 테 */}
            <rect x="74" y="84" width="42" height="28" rx="11" fill={C.dark} stroke="#5ff2c1" strokeWidth="3.5" />
            <rect x="124" y="84" width="42" height="28" rx="11" fill={C.dark} stroke="#8b7bff" strokeWidth="3.5" />
            {/* 반사광 */}
            <path d="M82 104L96 89M89 106L101 93" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
            <path d="M132 104L146 89M139 106L151 93" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".45" />
            {/* AI 표시 */}
            <text x="145" y="106" textAnchor="middle" fontSize="11" fontWeight="900" fill="#5ff2c1" opacity=".95">
              AI
            </text>
          </g>
        )}
        <path d="M109 114Q120 106 131 114Q126 126 120 129Q114 126 109 114Z" fill={C.coral2} />
        <ellipse cx="76" cy="124" rx="9" ry="5.5" fill={C.blush} opacity=".55" />
        <ellipse cx="164" cy="124" rx="9" ry="5.5" fill={C.blush} opacity=".55" />

        {o.cap && (
          <g className="p-cap">
            <path d="M88 52Q120 40 152 52L152 64Q120 54 88 64Z" fill={C.brand7} />
            <path d="M70 44L120 24L170 44L120 64Z" fill={C.brand6} />
            <path d="M70 44L120 64L170 44" fill="none" stroke={C.brand7} strokeWidth="2" />
            <circle cx="120" cy="44" r="3.5" fill={C.coral2} />
            <g className="p-tassel">
              <path d="M120 44L160 48L161 70" stroke={C.coral2} strokeWidth="3" fill="none" strokeLinecap="round" />
              <rect x="156" y="68" width="10" height="12" rx="3" fill={C.coral2} />
            </g>
          </g>
        )}
        {o.laptop && (
          <g className="p-laptop">
            <ellipse cx="120" cy="146" rx="46" ry="10" fill={C.ice} opacity=".55" />
            <rect x="76" y="150" width="88" height="58" rx="8" fill={C.brand} stroke={C.brand6} strokeWidth="2" />
            <text x="120" y="187" textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
              AI
            </text>
            <rect x="66" y="206" width="108" height="9" rx="4.5" fill="#44566a" />
          </g>
        )}
        {o.book && (
          <g className="p-book">
            <path d="M72 164Q96 154 120 164Q144 154 168 164L168 206Q144 196 120 206Q96 196 72 206Z" fill={C.coral2} />
            <path d="M76 162Q98 153 120 162L120 202Q98 193 76 202Z" fill="#fff8ef" stroke="#e8dccb" />
            <path d="M120 162Q142 153 164 162L164 202Q142 193 120 202Z" fill="#fff8ef" stroke="#e8dccb" />
            <path
              d="M86 173Q98 169 110 173M86 183Q98 179 110 183M130 173Q142 169 154 173M130 183Q142 179 154 183"
              stroke="#a8b7c2"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
        {/* 소품을 들면 옆 날개 대신 "어깨에서 앞으로 뻗은 날개"로 잡음 → 날개는 항상 2개 */}
        {holding && (
          <g className="p-grip-l">
            <path d="M64 128C54 152 58 176 78 190C90 184 90 166 80 142C76 134 70 130 64 128Z" fill={C.ink} />
          </g>
        )}
        {holding && o.wave !== "r" && (
          <g className="p-grip-r">
            <path d="M176 128C186 152 182 176 162 190C150 184 150 166 160 142C164 134 170 130 176 128Z" fill={C.ink} />
          </g>
        )}
      </g>
      {o.sparkles && (
        <>
          <Star x={20} y={70} s={9} fill={C.brand} delay={0} />
          <Star x={222} y={128} s={7} fill={C.coral2} delay={0.6} />
          <Star x={30} y={176} s={6} fill={C.brand6} delay={1.2} />
        </>
      )}
    </svg>
  );
}

export function Penguin({ anim = [], delay = 0, jumping, className = "", style, title, ...pose }: PenguinProps) {
  const cls = ["peng", ...anim.map((a) => `a-${a}`), jumping ? "is-jump" : "", className].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      style={{ ["--d" as string]: `${delay}s`, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      <PenguinSvg {...pose} />
    </div>
  );
}
