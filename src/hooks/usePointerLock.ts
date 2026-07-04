"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/useGameStore";

/**
 * Keeps the global `locked` flag in the Zustand store in sync with the
 * browser's Pointer Lock API. The Player component requests the lock on
 * click; this hook just observes the resulting state changes so the HUD
 * overlay can show/hide the "click to play" prompt.
 */
export function usePointerLockSync() {
  const setLocked = useGameStore((s) => s.setLocked);

  useEffect(() => {
    const onChange = () => {
      setLocked(!!document.pointerLockElement);
    };
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, [setLocked]);
}
