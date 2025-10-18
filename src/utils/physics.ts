import type { Bubble, ClusterMap, Cursor } from "../types/types";
import { ensureClusterFor, mergeClusters, updateCentroids } from "./cluster";
import { clamp, CONFIG } from "./lib";

export function stepPhysics(
  dt: number,
  W: number,
  H: number,
  bubbles: Bubble[],
  clusters: ClusterMap,
  myCursor: Cursor,
  others: Record<number, Cursor | undefined>
): void {
  // 1) cursor **push** field (repulsive)
  const cursors = [myCursor, ...Object.values(others)].filter(
    Boolean
  ) as Cursor[];
  for (const cur of cursors) {
    if (!cur.inside) continue;
    for (const b of bubbles) {
      const dx = b.x - cur.x;
      const dy = b.y - cur.y;
      const d2 = dx * dx + dy * dy;
      const R = CONFIG.CURSOR_PUSH_RADIUS;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1;
        const strength = CONFIG.CURSOR_PUSH_FORCE * (1 - d / R);
        // push away from cursor
        b.vx += (dx / d) * strength * dt * 1000;
        b.vy += (dy / d) * strength * dt * 1000;
      }
    }
  }

  // 2) pairwise collisions (separate) + **color stick** when close
  const stickR = CONFIG.COLOR_STICK_RADIUS;
  const stickR2 = stickR * stickR;

  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const A = bubbles[i],
        B = bubbles[j];
      const dx = B.x - A.x,
        dy = B.y - A.y;
      const d2 = dx * dx + dy * dy;
      if (d2 === 0) continue;

      // collision separation
      const rr = A.r + B.r;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2);
        const overlap = rr - d;
        const nx = dx / d,
          ny = dy / d;
        const push = overlap * CONFIG.COLLISION_PUSH;

        A.x -= nx * push * 0.5;
        A.y -= ny * push * 0.5;
        B.x += nx * push * 0.5;
        B.y += ny * push * 0.5;

        const rvx = B.vx - A.vx,
          rvy = B.vy - A.vy;
        const rel = rvx * nx + rvy * ny;
        if (rel < 0) {
          const jimp = -rel;
          A.vx -= jimp * nx * 0.5;
          A.vy -= jimp * ny * 0.5;
          B.vx += jimp * nx * 0.5;
          B.vy += jimp * ny * 0.5;
        }
      }

      // color stick (even if not colliding) => bond/merge clusters
      if (A.color === B.color && d2 < stickR2) {
        ensureClusterFor(A, clusters);
        ensureClusterFor(B, clusters);
        const newId = mergeClusters(
          A.clusterId,
          B.clusterId,
          clusters,
          bubbles
        );
        if (newId) {
          A.clusterId = newId;
          B.clusterId = newId;
        }
      }
    }
  }

  // 3) centroid cohesion for clusters
  updateCentroids(clusters, bubbles);

  // 4) integrate + walls + friction + speed clamp
  for (const b of bubbles) {
    b.vx = clamp(b.vx, -CONFIG.MAX_SPEED, CONFIG.MAX_SPEED);
    b.vy = clamp(b.vy, -CONFIG.MAX_SPEED, CONFIG.MAX_SPEED);

    b.x += b.vx;
    b.y += b.vy;

    if (b.x < b.r) {
      b.x = b.r;
      b.vx = -b.vx * CONFIG.WALL_BOUNCE;
    }
    if (b.x > W - b.r) {
      b.x = W - b.r;
      b.vx = -b.vx * CONFIG.WALL_BOUNCE;
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = -b.vy * CONFIG.WALL_BOUNCE;
    }
    if (b.y > H - b.r) {
      b.y = H - b.r;
      b.vy = -b.vy * CONFIG.WALL_BOUNCE;
    }

    b.vx *= CONFIG.FRICTION;
    b.vy *= CONFIG.FRICTION;
  }
}
