"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Player } from "@/components/three/Player";
import { Environment } from "@/components/three/Environment";
import { usePointerLockSync } from "@/hooks/usePointerLock";

/**
 * Top-level 3D scene. Mounts the R3F canvas, sets up soft shadows + tonemapping
 * for a slightly cinematic look, and drops in the Player + Environment.
 *
 * `usePointerLockSync` keeps the store's `locked` flag in sync with the
 * browser so the HUD overlay can react.
 */
export function GameScene() {
  usePointerLockSync();

  return (
    <Canvas
      shadows
      className="game-canvas"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ fov: 72, near: 0.1, far: 1000, position: [0, 1.7, 12] }}
    >
      <Suspense fallback={null}>
        <Environment />
        <Player />
      </Suspense>
    </Canvas>
  );
}
