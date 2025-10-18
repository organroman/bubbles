import type { Player, Settings } from "../types/types";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  collection,
  where,
  limit,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import Input from "./Input";

interface GameStartProps {
  room: string;
  name: string;
  bubbleCount: number;
  colors: string[];
  setSlot: Dispatch<SetStateAction<number | null>>;
  setReady: Dispatch<SetStateAction<boolean>>;
  setBubbleCount: Dispatch<SetStateAction<number>>;
  setColors: Dispatch<SetStateAction<string[]>>;
  setName: Dispatch<SetStateAction<string>>;
}
const roomDoc = (roomId: string) => doc(db, "rooms", roomId);
const playerDoc = (roomId: string, slot: number) =>
  doc(db, "rooms", roomId, "players", String(slot));

const GameStart = ({
  room,
  name,
  bubbleCount,
  colors,
  setSlot,
  setReady,
  setBubbleCount,
  setColors,
  setName,
}: GameStartProps) => {
  const shareUrl = useMemo(
    () => (room ? `${location.origin}/room/${room}` : ""),
    [room]
  );
  const onCreate = async () => {
    if (!name.trim()) return alert("Enter your name");
    await setDoc(
      roomDoc(room),
      {
        createdAt: serverTimestamp(),
        host: name,
        seed: Math.random().toString(36).slice(2),
        width: 960,
        height: 540,
        tick: 0,
        won: false,
        settings: { bubbleCount, colors } as Settings,
      },
      { merge: true }
    );

    await setDoc(playerDoc(room, 0), {
      name,
      slot: 0,
      joinedAt: serverTimestamp(),
    });

    localStorage.setItem("name", name);
    setSlot(0);
    setReady(true);
  };

  const onJoin = async () => {
    if (!name.trim()) {
      alert("Enter your name");
      return;
    }

    const rSnap = await getDoc(roomDoc(room));
    if (!rSnap.exists()) {
      alert("Room didn't created yet. Ask host to “Create room”");
      return;
    }
    const q = query(
      collection(db, "rooms", room, "players"),
      where("name", "==", name),
      limit(1)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      const doc0 = existing.docs[0].data() as { slot: number };
      localStorage.setItem("name", name);
      setSlot(doc0.slot);
      setReady(true);
      return;
    }

    const all = await getDocs(collection(db, "rooms", room, "players"));
    const taken = new Set<number>();
    all.docs.forEach((d) => taken.add((d.data() as Player).slot));
    const free = [0, 1, 2, 3].find((s) => !taken.has(s));
    if (free === undefined) {
      alert("Room is fulfilled (4/4)");
      return;
    }

    await setDoc(playerDoc(room, free), {
      name,
      slot: free,
      joinedAt: serverTimestamp(),
    });

    localStorage.setItem("name", name);
    setSlot(free);
    setReady(true);
  };
  return (
    <div className="desc">
      <h2>Sort Bubbles</h2>
      <p>Share the link to invite up to 3 players</p>
      <div className="inputs">
        <div className="setupInputs">
          <Input
            id="bubblesQuantity"
            value={bubbleCount}
            type="number"
            onChange={(e) => setBubbleCount(Number(e.target.value))}
            label="Bubbles quantity"
          />
          {colors.map((color, idx) => (
            <Input
              key={color}
              id="color"
              value={color}
              type="color"
              onChange={(e) => {
                const next = [...colors];
                next[idx] = e.target.value;
                setColors(next);
              }}
              label="Color"
              inputCn="colorInput"
            />
          ))}
        </div>

        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John"
          label="Name"
        />
      </div>
      <div className="btns">
        <button className="btn" onClick={onCreate}>
          Create room (host)
        </button>
        <button className="btn" onClick={onJoin}>
          Join room
        </button>
      </div>

      {room && (
        <div className="shareLink">
          Share URL: <code>{shareUrl}</code>
        </div>
      )}
    </div>
  );
};

export default GameStart;
