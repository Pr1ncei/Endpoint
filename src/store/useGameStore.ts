"use client";

import { create } from "zustand";

/**
 * Global game state. Kept intentionally small — most per-frame values live
 * inside refs in the Player component (mutating refs is cheaper than
 * triggering React re-renders every frame). The store holds only things the
 * UI layer needs to react to (lock state, start/overlay visibility).
 */
interface GameState {
  /** True while pointer lock is active (mouse controls the camera). */
  locked: boolean;
  /** True until the player clicks to start the session. */
  started: boolean;
  /** Simple HUD telemetry for debugging feel. */
  speed: number;
  grounded: boolean;
  /**
   * Function that requests pointer lock. Registered by the Player component
   * (which owns the PointerLockControls instance) so the HUD overlay can
   * trigger it without needing a direct ref into the R3F scene.
   */
  requestLock: (() => void) | null;

  setLocked: (locked: boolean) => void;
  setStarted: (started: boolean) => void;
  setTelemetry: (speed: number, grounded: boolean) => void;
  registerLock: (fn: (() => void) | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  locked: false,
  started: false,
  speed: 0,
  grounded: true,
  requestLock: null,
  setLocked: (locked) => set({ locked }),
  setStarted: (started) => set({ started }),
  setTelemetry: (speed, grounded) => set({ speed, grounded }),
  registerLock: (fn) => set({ requestLock: fn }),
}));
