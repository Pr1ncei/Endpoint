"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/three/Hud";
import "@/styles/game.css";

// Load the WebGL canvas client-side only. R3F touches `window`/`document`
// during mount, so we skip SSR for the scene entirely.
const GameScene = dynamic(
  () => import("@/scenes/GameScene").then((m) => m.GameScene),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          background: "#070a11",
          color: "#6f8bb8",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.2em",
          fontSize: "0.8rem",
        }}
      >
        LOADING CHAMBER…
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="game-root">
      <GameScene />
      <Hud />
    </main>
  );
}
