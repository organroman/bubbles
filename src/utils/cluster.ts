import type { Bubble, ClusterMap } from "../types/types";
import { CONFIG } from "./lib";

export function ensureClusterFor(b: Bubble, clusters: ClusterMap): void {
  if (b.clusterId == null) {
    const id = `c${b.id}-${b.color}`;
    b.clusterId = id;
    clusters.set(id, { color: b.color, members: new Set([b.id]) });
    b.isLeader = true;
  } else if (!clusters.has(b.clusterId)) {
    clusters.set(b.clusterId, { color: b.color, members: new Set([b.id]) });
  }
}

export function mergeClusters(
  idA: string | null,
  idB: string | null,
  clusters: ClusterMap,
  bubbles: Bubble[]
): string {
  if (!idA && idB) return idB;
  if (!idB && idA) return idA;
  if (!idA && !idB) return ""; // should be replaced by caller with a fresh id
  if (idA === idB) return idA!;

  const A = clusters.get(idA!),
    B = clusters.get(idB!);
  if (!A || !B) return (A && idA) || (B && idB) || "";

  if (A.color !== B.color) return idA!;

  const [bigId, smallId] =
    A.members.size >= B.members.size ? [idA!, idB!] : [idB!, idA!];
  const big = clusters.get(bigId)!;
  const small = clusters.get(smallId)!;

  small.members.forEach((mid) => {
    big.members.add(mid);
    const m = bubbles[mid];
    m.clusterId = bigId;
    m.isLeader = false;
  });
  clusters.delete(smallId);
  return bigId;
}

export function updateCentroids(clusters: ClusterMap, bubbles: Bubble[]): void {
  clusters.forEach((cl) => {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const mid of cl.members as Set<number>) {
      const b = bubbles[mid]!;
      sx += b.x;
      sy += b.y;
      n++;
    }
    if (n === 0) return;
    const cx = sx / n,
      cy = sy / n;

    // leader = closest to centroid
    let best: Bubble | null = null;
    let bestDist = Infinity;

    for (const mid of cl.members as Set<number>) {
      const b = bubbles[mid]!;
      const dx = b.x - cx,
        dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        best = b;
      }
    }
    for (const mid of cl.members as Set<number>) {
      bubbles[mid]!.isLeader = false;
    }
    if (best) best.isLeader = true;

    // cohesion towards centroid
    cl.members.forEach((mid) => {
      const b = bubbles[mid];
      const ax = (cx - b.x) * CONFIG.COLOR_COHESION;
      const ay = (cy - b.y) * CONFIG.COLOR_COHESION;
      b.vx += ax;
      b.vy += ay;
    });
  });
}
