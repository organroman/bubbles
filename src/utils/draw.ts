import type { Bubble, ClusterMap } from "../types/types";
import { paletteByIndex } from "./lib";

export function draw(
  canvas: HTMLCanvasElement | null,
  W: number,
  H: number,
  bubbles: Bubble[],
  clusters: ClusterMap,
  isHost: boolean,
  mySlot: number,
  colors: string[]
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, W, H);

  // faint grid
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#e9ecf1";
  for (let y = 0; y < H; y += 24) {
    for (let x = 0; x < W; x += 24) ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();

  // cluster links
  clusters.forEach((cl) => {
    const ids = Array.from(cl.members);
    if (ids.length < 2) return;
    ctx.strokeStyle = cl.color + "55";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < ids.length; i++) {
      const a = bubbles[ids[i]];
      const b = bubbles[ids[(i + 1) % ids.length]];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  });

  // bubbles
  for (const b of bubbles) {
    ctx.beginPath();
    ctx.fillStyle = b.color;
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = b.isLeader ? 3 : 2;
    ctx.strokeStyle = b.isLeader ? "#fff" : "#1c2245";
    ctx.stroke();
  }

  // role badge
  ctx.fillStyle = paletteByIndex(mySlot, colors);
  ctx.fillRect(10, 10, 10, 10);
  ctx.fillStyle = "#a7b0c2";
  ctx.font = "12px Inter, system-ui";
  ctx.fillText(isHost ? "Host" : "Guest", 26, 19);
}
