import { useEffect, useState } from "react";

import GameCanvas from "./components/GameCanvas";
import GameStart from "./components/GameStart";

import { CONFIG, makeId } from "./utils/lib";

import "./App.css";

function App() {
  const initialRoom = (() => {
    const parts = new URL(window.location.href).pathname
      .split("/")
      .filter(Boolean);
    return parts[1] ?? null;
  })();
  const [room, setRoom] = useState<string | null>(initialRoom);
  const [slot, setSlot] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState<string>(localStorage.getItem("name") ?? "");
  const [bubbleCount, setBubbleCount] = useState<number>(12);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    if (room) return;
    const newId = makeId();
    history.replaceState({}, "", `/room/${newId}`);
    setRoom(newId);
  }, [room]);

  useEffect(() => {
    const paletteQuantity = Math.max(
      1,
      Math.round(bubbleCount / CONFIG.BUBBLES_PER_PALETTE)
    );
    const palette = CONFIG.COLORS.slice(0, paletteQuantity);
    setColors(palette);
  }, [bubbleCount]);

  if (!room) {
    return <div className="container">Initializing room…</div>;
  }

  return (
    <div className="container">
      {!ready ? (
        <GameStart
          room={room}
          setSlot={setSlot}
          name={name}
          setName={setName}
          bubbleCount={bubbleCount}
          setBubbleCount={setBubbleCount}
          colors={colors}
          setColors={setColors}
          setReady={setReady}
        />
      ) : (
        <GameCanvas
          roomId={room}
          me={{ name, slot: slot! }}
          settings={{ bubbleCount, colors }}
        />
      )}
    </div>
  );
}

export default App;
