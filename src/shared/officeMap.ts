/**
 * 남극AI빌리지 스터디룸 맵 정의 — 클라이언트(렌더링·이동)와 실시간 서버(자리 검증)가 함께 씁니다.
 * 좌표계: 월드 픽셀. 펭귄의 (x, y)는 "발 위치"이고, y가 클수록 화면 앞쪽(아래)에 그려집니다.
 *
 * 공간 구획 (걸을 수 있는 얼음판 가로폭 기준)
 *   집중 개인석 50%  |  스탠딩석 20%  |  카페석 30%
 *   x 110 ─────── 800 ──────── 1076 ─────── 1490
 */

/**
 * 세로 배치 (2026-11-28): 공부 공간(빙벽 아래 바닥)을 세로로 20% 줄이고, 빙벽은 10% 높임.
 * 바닥 좌표는 처음 설계한 좌표(빙벽 밑선 y=200 기준)를 fy() 로 옮겨 씁니다.
 * MapArt 의 바닥 그림도 같은 변환(FLOOR_TRANSFORM)을 써서 자리 · 소품과 정확히 겹칩니다.
 */
/** 빙벽 밑선 — 벽이 10% 높아져 200 → 213 */
export const WALL_BASE = 213;
/** 바닥 세로 배율 */
export const FLOOR_SCALE = 0.8;
/** 처음 설계한 바닥 y 좌표 → 지금 좌표 */
export const fy = (y: number) => Math.round(WALL_BASE + (y - 200) * FLOOR_SCALE);
/** SVG transform: 처음 설계 좌표로 그린 바닥 그림을 지금 좌표로 */
export const FLOOR_TRANSFORM = `matrix(1 0 0 ${FLOOR_SCALE} 0 ${WALL_BASE - 200 * FLOOR_SCALE})`;
/** 빙붕 아래쪽 끝 (옆면 포함) */
export const CAMP_BOTTOM = fy(992);

/** 공부 캠프(빙붕) 좌표계 — 자리 · 이동 · 충돌은 모두 이 좌표를 씁니다 */
export const WORLD = { w: 1600, h: 870 } as const;

/**
 * 화면에 그리는 전체 남극 풍경. 공부 캠프는 그 안의 CAMP_OFFSET 위치에 놓이고,
 * 빙붕(공부 공간)이 풍경 전체의 약 60%를 차지합니다. 나머지는 빙하 · 설산 · 바다 · 남극 동물.
 */
export const LANDSCAPE = { w: 2000, h: 1200 } as const;
/** 캠프 아래쪽 끝은 예전 자리(풍경 y 1112)에 두고, 줄어든 만큼 위쪽 설산 · 빙상 고원이 더 보이게 */
export const CAMP_OFFSET = { x: 200, y: 1112 - CAMP_BOTTOM } as const;
/**
 * 화면에 한눈에 담을 강의장(공부 캠프) 범위 — 풍경 좌표.
 * 빙붕 좌우 끝(78 · 1522), 빙벽 윗선 · 랜턴 줄(약 50), 빙붕 아래 끝(CAMP_BOTTOM)에 여백을 조금 둠
 */
export const CAMP_VIEW = {
  x1: CAMP_OFFSET.x + 60,
  y1: CAMP_OFFSET.y + 36,
  x2: CAMP_OFFSET.x + 1540,
  y2: CAMP_OFFSET.y + CAMP_BOTTOM + 14,
} as const;

/** 걸어다닐 수 있는 얼음판 범위 (위쪽은 빙벽, 가장자리는 바다) */
export const WALKABLE = { x1: 110, y1: fy(215), x2: 1490, y2: fy(935) } as const;

/** 구역 경계(칸막이) x 좌표 */
export const DIVIDERS = [800, 1076] as const;
/** 칸막이에 뚫린 통로 (y 범위) */
export const DOORWAYS: [number, number][] = [
  [fy(420), fy(500)],
  [fy(720), fy(800)],
];

export const SPAWN = { x: 938, y: fy(905) } as const;

/**
 * 집중 개인석 벽, 두 책 선반 사이의 "스터디 LIVE" 스크린 (강의 표시 · 강의 만들기).
 * 아래쪽은 예전 "집중 개인석" 명판 자리(빙벽 밑선 아래 13px)까지 내려옴
 */
export const LECTURE_SCREEN = { x: 330, y: 96, w: 260, h: 130 } as const;

export type SeatKind = "desk" | "standing" | "cafe" | "sofa";

export interface Seat {
  id: string;
  kind: SeatKind;
  x: number;
  y: number;
  /** 앉았을 때 들고 있을 소품 */
  prop?: "laptop" | "book";
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type PropKind = "desk" | "tallTable" | "cafeTable" | "snowBench" | "counter" | "crystal" | "signpost" | "lantern";

export interface MapProp {
  id: string;
  kind: PropKind;
  /** 그림의 기준점(바닥 중앙). 깊이 정렬에 y를 씀 */
  x: number;
  y: number;
  /** 충돌 영역 (없으면 통과 가능) */
  block?: Rect;
}

export type ZoneId = "focus" | "standing" | "cafe";

export interface Zone {
  id: ZoneId;
  label: string;
  emoji: string;
  rect: Rect;
}

export const ZONES: Zone[] = [
  { id: "focus", label: "집중 개인석", emoji: "✏️", rect: { x1: WALKABLE.x1, y1: WALKABLE.y1, x2: DIVIDERS[0], y2: WALKABLE.y2 } },
  { id: "standing", label: "스탠딩석", emoji: "🧍", rect: { x1: DIVIDERS[0], y1: WALKABLE.y1, x2: DIVIDERS[1], y2: WALKABLE.y2 } },
  { id: "cafe", label: "카페석", emoji: "☕", rect: { x1: DIVIDERS[1], y1: WALKABLE.y1, x2: WALKABLE.x2, y2: WALKABLE.y2 } },
];

/* ---------- 집중 개인석: 3열 × 4줄 = 12석 ---------- */
const DESK_COLS = [225, 452, 680];
const DESK_ROWS = [300, 470, 640, 810].map(fy);
const desks = DESK_ROWS.flatMap((y, r) =>
  DESK_COLS.map((x, c) => ({ id: `desk-${r * 3 + c + 1}`, x, y, prop: (r + c) % 2 ? "book" : "laptop" }) as const),
);

/* ---------- 스탠딩석: 높은 테이블 3개 × 양옆 = 6석 ---------- */
const TALL_X = 938;
const TALL_ROWS = [340, 590, 770].map(fy);

/* ---------- 카페석: 원형 테이블 4개 × 2석 + 소파 3석 ---------- */
const CAFE_TABLES: [number, number][] = [
  [1190, fy(450)],
  [1390, fy(450)],
  [1190, fy(650)],
  [1390, fy(650)],
];
const SOFA_XS = [1200, 1290, 1380];
const SOFA_Y = fy(868);

export const SEATS: Seat[] = [
  ...desks.map((d): Seat => ({ id: d.id, kind: "desk", x: d.x, y: d.y, prop: d.prop })),
  ...TALL_ROWS.flatMap((y, i): Seat[] => [
    { id: `stand-${i * 2 + 1}`, kind: "standing", x: TALL_X - 62, y, prop: "laptop" },
    { id: `stand-${i * 2 + 2}`, kind: "standing", x: TALL_X + 62, y, prop: i % 2 ? "laptop" : "book" },
  ]),
  ...CAFE_TABLES.flatMap(([x, y], i): Seat[] => [
    { id: `cafe-${i * 2 + 1}`, kind: "cafe", x: x - 62, y, prop: "laptop" },
    { id: `cafe-${i * 2 + 2}`, kind: "cafe", x: x + 62, y, prop: "book" },
  ]),
  ...SOFA_XS.map((x, i): Seat => ({ id: `sofa-${i + 1}`, kind: "sofa", x, y: SOFA_Y })),
];

export const SEAT_BY_ID: Record<string, Seat> = Object.fromEntries(SEATS.map((s) => [s.id, s]));

/** 칸막이 충돌 영역: 통로를 뺀 나머지 구간 */
const dividerBlocks: Rect[] = DIVIDERS.flatMap((x) => {
  const ys = [WALKABLE.y1, ...DOORWAYS.flat(), WALKABLE.y2 + 20];
  const out: Rect[] = [];
  for (let i = 0; i < ys.length; i += 2) out.push({ x1: x - 6, y1: ys[i], x2: x + 6, y2: ys[i + 1] });
  return out;
});
export const DIVIDER_SEGMENTS = dividerBlocks;

export const PROPS: MapProp[] = [
  ...desks.map((d): MapProp => ({
    id: d.id,
    kind: "desk",
    x: d.x,
    y: d.y + 44,
    block: { x1: d.x - 56, y1: d.y + 14, x2: d.x + 56, y2: d.y + 44 },
  })),
  ...TALL_ROWS.map((y, i): MapProp => ({
    id: `tall-${i + 1}`,
    kind: "tallTable",
    x: TALL_X,
    y: y + 4,
    block: { x1: TALL_X - 30, y1: y - 18, x2: TALL_X + 30, y2: y + 4 },
  })),
  ...CAFE_TABLES.map(([x, y], i): MapProp => ({
    id: `cafe-table-${i + 1}`,
    kind: "cafeTable",
    x,
    y: y + 6,
    block: { x1: x - 34, y1: y - 22, x2: x + 34, y2: y + 6 },
  })),
  { id: "snow-bench", kind: "snowBench", x: 1290, y: fy(912), block: { x1: 1140, y1: fy(880), x2: 1440, y2: fy(912) } },
  { id: "counter", kind: "counter", x: 1285, y: fy(268), block: { x1: 1110, y1: fy(215), x2: 1460, y2: fy(268) } },
  { id: "crystal-1", kind: "crystal", x: 136, y: fy(238), block: { x1: 116, y1: fy(224), x2: 156, y2: fy(240) } },
  { id: "crystal-2", kind: "crystal", x: 136, y: fy(918), block: { x1: 116, y1: fy(902), x2: 156, y2: fy(920) } },
  { id: "crystal-3", kind: "crystal", x: 1468, y: fy(330), block: { x1: 1448, y1: fy(314), x2: 1488, y2: fy(332) } },
  { id: "lantern-cafe", kind: "lantern", x: 1110, y: fy(880), block: { x1: 1100, y1: fy(868), x2: 1120, y2: fy(882) } },
  { id: "signpost", kind: "signpost", x: 1040, y: fy(922), block: { x1: 1032, y1: fy(910), x2: 1048, y2: fy(924) } },
];

export const OBSTACLES: Rect[] = [...PROPS.flatMap((p) => (p.block ? [p.block] : [])), ...dividerBlocks];

/** 펭귄 몸 반지름 — 충돌 판정용 */
export const BODY_R = 16;

export function isBlocked(x: number, y: number): boolean {
  if (x < WALKABLE.x1 || x > WALKABLE.x2 || y < WALKABLE.y1 || y > WALKABLE.y2) return true;
  return OBSTACLES.some(
    (r) => x > r.x1 - BODY_R && x < r.x2 + BODY_R && y > r.y1 - BODY_R / 2 && y < r.y2 + BODY_R / 2,
  );
}

export function zoneAt(x: number, y: number): Zone | undefined {
  return ZONES.find((z) => x >= z.rect.x1 && x <= z.rect.x2 && y >= z.rect.y1 && y <= z.rect.y2);
}

/** 공부 시간으로 인정되는 자리 */
export const STUDY_SEAT_KINDS: SeatKind[] = ["desk", "standing", "cafe"];
