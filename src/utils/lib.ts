import type { Bubble } from "../types/types";
import { mulberry32 } from "./rng";

export const CONFIG = {
  COLORS: ["#7c5cff", "#ffb700", "#36d399", "#60a5fa", "#2832f4", "#f44d28"],
  BUBBLES_PER_PALETTE: 6,
  RADIUS: 14,
  FRICTION: 0.985,
  COLLISION_PUSH: 0.5,
  MAX_SPEED: 6,
  WALL_BOUNCE: 0.9,
  CURSOR_PUSH_RADIUS: 40,
  CURSOR_PUSH_FORCE: 0.0012,
  COLOR_STICK_RADIUS: 48,
  COLOR_COHESION: 0.015,
  WIN_TOLERANCE: 56,
};

export const paletteByIndex = (i: number, colors: string[]) =>
  colors[i % colors.length];

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const dist2 = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x1 - x2,
    dy = y1 - y2;
  return dx * dx + dy * dy;
};
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const makeId = () => Math.random().toString(36).slice(2, 8);

export function initialBubbles(
  bubbleCount: number,
  colors: string[],
  W: number,
  H: number,
  seed: number
): Bubble[] {
  const rand = mulberry32(seed);
  const arr: Bubble[] = [];
  const R = CONFIG.RADIUS,
    pad = 2;
  const minDist = R * 2 + 4,
    minDist2 = minDist * minDist;

  const colorAt = (i: number) => colors[i % colors.length];

  for (let i = 0; i < bubbleCount; i++) {
    const color = colorAt(i);
    let x = 0,
      y = 0,
      placed = false;

    for (let t = 0; t < 300; t++) {
      const cx = R + pad + rand() * (W - 2 * (R + pad));
      const cy = R + pad + rand() * (H - 2 * (R + pad));
      if (arr.every((b) => dist2(cx, cy, b.x, b.y) > minDist2)) {
        x = cx;
        y = cy;
        placed = true;
        break;
      }
    }
    if (!placed) {
      x = R + pad + rand() * (W - 2 * (R + pad));
      y = R + pad + rand() * (H - 2 * (R + pad));
    }

    arr.push({
      id: i,
      x,
      y,
      vx: (rand() - 0.5) * 4,
      vy: (rand() - 0.5) * 4,
      r: R,
      color,
      clusterId: null,
      isLeader: false,
    });
  }

  for (const b of arr) {
    b.x |= 0;
    b.y |= 0;
  }
  return arr;
}

export function isGameWon(bubbles: Bubble[], colors: string[]): boolean {
  for (const color of colors) {
    const group = bubbles.filter((b) => b.color === color);
    if (group.length === 0) continue;

    const cx = group.reduce((s, b) => s + b.x, 0) / group.length;
    const cy = group.reduce((s, b) => s + b.y, 0) / group.length;

    for (const b of group) {
      const dx = b.x - cx,
        dy = b.y - cy;
      const d = Math.hypot(dx, dy);
      if (d > CONFIG.WIN_TOLERANCE) return false;
    }
  }
  return true;
}
