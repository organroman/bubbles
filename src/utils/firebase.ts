import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import type { Cursor } from "../types/types";

const playerDoc = (roomId: string, slot: number) =>
  doc(db, "rooms", roomId, "players", String(slot));

export async function sendCursor(roomId: string, slot: number, cur: Cursor) {
  // Ensure you call this only when slot is defined (slot !== null)
  await setDoc(
    playerDoc(roomId, slot),
    {
      x: Math.round(cur.x),
      y: Math.round(cur.y),
      inside: !!cur.inside,
      ts: Date.now(),
    },
    { merge: true }
  );
}
