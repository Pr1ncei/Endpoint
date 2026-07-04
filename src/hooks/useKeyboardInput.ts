"use client";

import { useEffect, useRef } from "react";

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

/**
 * Tracks raw keyboard state into a mutable ref. Using a ref (rather than
 * React state) means input changes never trigger re-renders — the Player's
 * useFrame loop just reads the current values each tick. This keeps input
 * latency minimal and avoids GC churn.
 *
 * Returns a stable ref object whose `.current` fields mutate over time.
 */
export function useKeyboardInput() {
  const input = useRef<InputState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  });

  useEffect(() => {
    const setKey = (code: string, value: boolean) => {
      const i = input.current;
      switch (code) {
        case "KeyW":
        case "ArrowUp":
          i.forward = value;
          break;
        case "KeyS":
        case "ArrowDown":
          i.backward = value;
          break;
        case "KeyA":
        case "ArrowLeft":
          i.left = value;
          break;
        case "KeyD":
        case "ArrowRight":
          i.right = value;
          break;
        case "Space":
          i.jump = value;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          i.sprint = value;
          break;
        default:
          break;
      }
    };

    const onDown = (e: KeyboardEvent) => {
      // Prevent the page from scrolling when using Space / arrows.
      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
      }
      setKey(e.code, true);
    };
    const onUp = (e: KeyboardEvent) => setKey(e.code, false);

    // If the window loses focus (alt-tab), release everything so the player
    // doesn't keep walking forever.
    const onBlur = () => {
      const i = input.current;
      i.forward = i.backward = i.left = i.right = i.jump = i.sprint = false;
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return input;
}
