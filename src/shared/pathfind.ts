/**
 * 얼음판 위 길찾기 — 20px 격자 A* + 직선 구간 단순화.
 * 테이블 뒤쪽 자리처럼 직선으로 갈 수 없는 곳도 돌아서 걸어가게 합니다.
 */
import { WORLD, isBlocked } from "./officeMap";

const CELL = 20;
const COLS = Math.ceil(WORLD.w / CELL);
const ROWS = Math.ceil(WORLD.h / CELL);

type Pt = { x: number; y: number };

const center = (c: number, r: number): Pt => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
const cellOf = (p: Pt) => ({ c: Math.floor(p.x / CELL), r: Math.floor(p.y / CELL) });

let blockedGrid: Uint8Array | null = null;
function grid(): Uint8Array {
  if (!blockedGrid) {
    blockedGrid = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = center(c, r);
        blockedGrid[r * COLS + c] = isBlocked(p.x, p.y) ? 1 : 0;
      }
  }
  return blockedGrid;
}

const free = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && grid()[r * COLS + c] === 0;

/** 두 점 사이를 막힘 없이 직선으로 갈 수 있는지 */
export function lineClear(a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(d / 6);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

function nearestFree(c: number, r: number) {
  if (free(c, r)) return { c, r };
  for (let rad = 1; rad < 12; rad++)
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++)
        if (Math.max(Math.abs(dr), Math.abs(dc)) === rad && free(c + dc, r + dr)) return { c: c + dc, r: r + dr };
  return null;
}

/** from → to 경로(웨이포인트 목록, 마지막은 도착점). 갈 수 없으면 null */
export function findPath(from: Pt, to: Pt): Pt[] | null {
  if (lineClear(from, to)) return [to];
  const s = nearestFree(cellOf(from).c, cellOf(from).r);
  const g = nearestFree(cellOf(to).c, cellOf(to).r);
  if (!s || !g) return null;

  const N = COLS * ROWS;
  const gScore = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open: { i: number; f: number }[] = [];
  const si = s.r * COLS + s.c;
  const gi = g.r * COLS + g.c;
  const h = (i: number) => Math.hypot((i % COLS) - g.c, Math.floor(i / COLS) - g.r);
  gScore[si] = 0;
  open.push({ i: si, f: h(si) });

  while (open.length) {
    // 격자가 작아서 단순 선형 탐색으로 충분
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const { i } = open.splice(bi, 1)[0];
    if (i === gi) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (!free(nc, nr)) continue;
        if (dr && dc && (!free(c + dc, r) || !free(c, r + dr))) continue; // 모서리 끼어가기 금지
        const ni = nr * COLS + nc;
        const ng = gScore[i] + (dr && dc ? Math.SQRT2 : 1);
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = i;
          open.push({ i: ni, f: ng + h(ni) });
        }
      }
  }
  if (came[gi] === -1 && gi !== si) return null;

  const cells: Pt[] = [];
  for (let i = gi; i !== -1; i = came[i]) cells.unshift(center(i % COLS, Math.floor(i / COLS)));
  cells.push(to);

  // 직선으로 갈 수 있는 중간 점은 건너뛰어 자연스럽게
  const out: Pt[] = [];
  let anchor = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--)
      if (lineClear(anchor, cells[j])) {
        far = j;
        break;
      }
    out.push(cells[far]);
    anchor = cells[far];
    k = far + 1;
  }
  return out;
}
