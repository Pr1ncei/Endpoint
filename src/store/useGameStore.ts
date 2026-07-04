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
  settingsOpen: boolean;
  toggleSprint: boolean;
  headBob: boolean;
  showTelemetry: boolean;
  interactionPrompt: string | null;
  codeEditorOpen: boolean;
  cursorMode: boolean;
  doorUnlocked: boolean;
  /**
   * Function that requests pointer lock. Registered by the Player component
   * (which owns the PointerLockControls instance) so the HUD overlay can
   * trigger it without needing a direct ref into the R3F scene.
   */
  requestLock: (() => void) | null;
  releaseLock: (() => void) | null;

  setLocked: (locked: boolean) => void;
  setStarted: (started: boolean) => void;
  setTelemetry: (speed: number, grounded: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setToggleSprint: (enabled: boolean) => void;
  setHeadBob: (enabled: boolean) => void;
  setShowTelemetry: (enabled: boolean) => void;
  setInteractionPrompt: (prompt: string | null) => void;
  setCursorMode: (enabled: boolean) => void;
  toggleCursorMode: () => void;
  openCodeEditor: () => void;
  closeCodeEditor: () => void;
  unlockDoor: () => void;
  registerLock: (fn: (() => void) | null) => void;
  registerUnlock: (fn: (() => void) | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  locked: false,
  started: false,
  speed: 0,
  grounded: true,
  settingsOpen: false,
  toggleSprint: false,
  headBob: true,
  showTelemetry: true,
  interactionPrompt: null,
  codeEditorOpen: false,
  cursorMode: false,
  doorUnlocked: false,
  requestLock: null,
  releaseLock: null,
  setLocked: (locked) => set({ locked }),
  setStarted: (started) => set({ started }),
  setTelemetry: (speed, grounded) => set({ speed, grounded }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setToggleSprint: (toggleSprint) => set({ toggleSprint }),
  setHeadBob: (headBob) => set({ headBob }),
  setShowTelemetry: (showTelemetry) => set({ showTelemetry }),
  setInteractionPrompt: (interactionPrompt) => set({ interactionPrompt }),
  setCursorMode: (cursorMode) =>
    set((state) => {
      if (cursorMode) {
        state.releaseLock?.();
      } else if (state.started && !state.codeEditorOpen) {
        state.requestLock?.();
      }
      return { cursorMode };
    }),
  toggleCursorMode: () =>
    set((state) => {
      if (state.codeEditorOpen) return {};
      const cursorMode = !state.cursorMode;
      if (cursorMode) {
        state.releaseLock?.();
      } else if (state.started) {
        state.requestLock?.();
      }
      return { cursorMode };
    }),
  openCodeEditor: () =>
    set((state) => {
      state.releaseLock?.();
      return { codeEditorOpen: true, cursorMode: true, interactionPrompt: null };
    }),
  closeCodeEditor: () => set({ codeEditorOpen: false }),
  unlockDoor: () => set({ doorUnlocked: true, codeEditorOpen: false }),
  registerLock: (fn) => set({ requestLock: fn }),
  registerUnlock: (fn) => set({ releaseLock: fn }),
}));
