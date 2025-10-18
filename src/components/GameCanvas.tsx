import type {
  Bubble,
  ClusterMap,
  Cursor,
  Player,
  RoomMeta,
  Settings,
} from "../types/types";

import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";

import { CONFIG, initialBubbles, isGameWon } from "../utils/lib";
import { draw } from "../utils/draw";
import { sendCursor } from "../utils/firebase";
import { stepPhysics } from "../utils/physics";

interface GameCanvasProps {
  roomId: string;
  me: Partial<Player>;
  settings: Settings;
}
const worldDoc = (roomId: string) => doc(db, "rooms", roomId, "state", "world");
const playerDoc = (roomId: string, slot: number | null) =>
  doc(db, "rooms", roomId, "players", String(slot));

const W = 960;
const H = 540;

const GameCanvas = ({ roomId, me, settings }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [roomMeta, setRoomMeta] = useState<RoomMeta | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [won, setWon] = useState(false);

  const mouse = useRef<Cursor>({ x: W / 2, y: H / 2, inside: false });

  const bubblesRef = useRef<Bubble[]>([]);
  const clustersRef = useRef<ClusterMap>(new Map());
  const cursorsRef = useRef<Record<number, Cursor>>({});

  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(performance.now());

  const lastSyncRef = useRef(0);
  const lastHashRef = useRef<string>("");
  const stoppedRef = useRef(false);
  const pageVisibleRef = useRef(true);

  const hashBubbles = (bs: Bubble[]) => {
    let s = 0;
    for (let i = 0; i < bs.length; i += Math.ceil(bs.length / 8)) {
      const b = bs[i];
      s = (s << 5) - s + ((b.x | 0) * 31 + (b.y | 0));
      s |= 0;
    }
    return String(s);
  };

  const effectiveSettings = useMemo<Settings>(() => {
    const count = settings?.bubbleCount ?? 12;
    let cols = settings?.colors?.length ? settings.colors : CONFIG.COLORS;
    const paletteQty = Math.max(
      1,
      Math.round(count / CONFIG.BUBBLES_PER_PALETTE)
    );
    cols = cols.slice(0, paletteQty);
    return { bubbleCount: count, colors: cols };
  }, [settings]);

  useEffect(() => {
    const onVis = () => {
      pageVisibleRef.current = document.visibilityState === "visible";
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data() as RoomMeta | undefined;
      if (!data) return;
      setRoomMeta(data);
      setIsHost(data.host === me.name);
      if (typeof data.won === "boolean") setWon(data.won);
    });
    return () => unsub();
  }, [roomId, me.name]);

  useEffect(() => {
    if (!roomMeta || isHost) return;
    const unsub = onSnapshot(worldDoc(roomId), (snap) => {
      const data = snap.data() as { bubbles?: Bubble[] } | undefined;
      if (!data?.bubbles) return;
      bubblesRef.current = data.bubbles;
    });
    return () => unsub();
  }, [roomMeta, isHost, roomId]);

  const CURSOR_SEND_EVERY = 60;
  const lastCursorSendRef = useRef(0);
  const cursorRafRef = useRef<number>(0);

  useEffect(() => {
    if (!roomMeta) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
      mouse.current.inside = true;
    };

    const onPointerLeave = () => {
      mouse.current.inside = false;
    };

    const pump = () => {
      if (stoppedRef.current || won || !pageVisibleRef.current) return;
      if (typeof me.slot === "number" && mouse.current) {
        const now = performance.now();
        if (
          now - lastCursorSendRef.current >= CURSOR_SEND_EVERY &&
          mouse.current.inside
        ) {
          lastCursorSendRef.current = now;
          sendCursor(roomId, me.slot, mouse.current).catch(() => {});
        }
      }
      cursorRafRef.current = requestAnimationFrame(pump);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    cursorRafRef.current = requestAnimationFrame(pump);

    return () => {
      cancelAnimationFrame(cursorRafRef.current);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [roomMeta, me.slot, roomId, won]);

  useEffect(() => {
    if (!roomMeta) return;
    const unsubs: Array<() => void> = [];
    for (let s = 0; s < 4; s++) {
      if (s === me.slot) continue;
      unsubs.push(
        onSnapshot(playerDoc(roomId, s), (snap) => {
          const d = snap.data() as Cursor | undefined;
          cursorsRef.current[s] = d ?? { x: 0, y: 0, inside: false };
        })
      );
    }
    return () => unsubs.forEach((u) => u());
  }, [roomMeta, me.slot, roomId]);

  const quantize = (bs: Bubble[]) => {
    for (const b of bs) {
      b.x = b.x | 0;
      b.y = b.y | 0;
    }
    return bs;
  };
  useEffect(() => {
    if (!roomMeta || !isHost) return;

    const SYNC_INTERVAL_MS = 120;

    const tick = async () => {
      if (stoppedRef.current || won || !pageVisibleRef.current) return;
      const h = hashBubbles(bubblesRef.current);
      if (h !== lastHashRef.current) {
        lastHashRef.current = h;

        await updateDoc(worldDoc(roomId), {
          bubbles: quantize([...bubblesRef.current]),
          tick: Date.now(),
          updatedAt: serverTimestamp(),
        });
      }
    };

    const timer = window.setInterval(tick, SYNC_INTERVAL_MS);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [roomMeta, isHost, roomId, won]);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (!roomMeta || !isHost || initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      const seed =
        typeof roomMeta.seed === "number"
          ? roomMeta.seed
          : Math.floor(Math.random() * 2 ** 31);

      if (roomMeta.seed === undefined) {
        await updateDoc(doc(db, "rooms", roomId), { seed });
      }

      const bubbles = initialBubbles(
        effectiveSettings.bubbleCount,
        effectiveSettings.colors,
        W,
        H,
        seed
      );
      bubblesRef.current = bubbles;
      clustersRef.current = new Map();
      lastHashRef.current = hashBubbles(bubbles);
      lastSyncRef.current = 0;
      await setDoc(
        worldDoc(roomId),
        { bubbles, tick: 0, updatedAt: serverTimestamp(), won: false },
        { merge: true }
      );
      setWon(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomMeta, isHost, roomId]);

  useEffect(() => {
    if (!roomMeta) return;

    cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    stoppedRef.current = false;

    const loop = (ts: number) => {
      if (stoppedRef.current) return;
      const dt = (ts - lastRef.current) / 16.67;
      lastRef.current = ts;

      if (isHost && !won && pageVisibleRef.current) {
        stepPhysics(
          dt,
          W,
          H,
          bubblesRef.current,
          clustersRef.current,
          mouse.current,
          cursorsRef.current
        );

        if (isGameWon(bubblesRef.current, effectiveSettings.colors)) {
          setWon(true);
          stoppedRef.current = true;

          updateDoc(worldDoc(roomId), {
            bubbles: [...bubblesRef.current],
            tick: Math.floor(ts),
            updatedAt: serverTimestamp(),
            won: true,
          }).catch(() => {});

          return;
        }
      }

      draw(
        canvasRef.current,
        W,
        H,
        bubblesRef.current,
        clustersRef.current,
        isHost,
        typeof me.slot === "number" ? me.slot : 0,
        settings.colors
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stoppedRef.current = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    roomMeta,
    isHost,
    roomId,
    me.slot,
    won,
    effectiveSettings.colors,
    settings.colors,
  ]);

  useEffect(() => {
    if (!roomMeta || isHost) return;
    const unsub = onSnapshot(worldDoc(roomId), (snap) => {
      if (stoppedRef.current) return;
      const data = snap.data() as
        | { bubbles?: Bubble[]; won?: boolean }
        | undefined;
      if (!data) return;
      if (data.won) {
        stoppedRef.current = true;
        setWon(true);
      }
      if (data.bubbles) bubblesRef.current = data.bubbles;
    });
    return () => unsub();
  }, [roomMeta, isHost, roomId]);

  return (
    <div className="gameContainer">
      <div className="gameHeader">
        <span className="roomTitle">
          Room: <code>{location.origin + location.pathname}</code>
        </span>
        <span className={isHost ? "hostTitle" : "guestTitle"}>
          Role: {isHost ? "Host" : "Guest"}
        </span>
        {won && <span className="winTittle">✅ Sorted by colors — WIN!</span>}

        <a className="btn" href="/">
          Restart
        </a>
      </div>

      <canvas ref={canvasRef} width={W} height={H} />
    </div>
  );
};

export default GameCanvas;
