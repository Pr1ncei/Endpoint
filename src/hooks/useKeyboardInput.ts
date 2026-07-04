"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/useGameStore";

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  slide: boolean;
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
    slide: false,
  });

  useEffect(() => {
    const releaseAll = () => {
      const i = input.current;
      i.forward =
        i.backward =
        i.left =
        i.right =
        i.jump =
        i.sprint =
        i.slide =
          false;
    };

    const capturedCodes = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ShiftLeft",
      "ShiftRight",
      "ControlLeft",
      "ControlRight",
      "KeyC",
      "AltLeft",
      "AltRight",
    ];

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
        case "ControlLeft":
        case "ControlRight":
        case "KeyC":
          i.slide = value;
          break;
        default:
          break;
      }
    };

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
    };

    const onDown = (e: KeyboardEvent) => {
      const gameState = useGameStore.getState();
      if ((e.code === "AltLeft" || e.code === "AltRight") && !e.repeat) {
        e.preventDefault();
        releaseAll();
        gameState.toggleCursorMode();
        return;
      }

      if (
        gameState.codeEditorOpen ||
        gameState.cursorMode ||
        isTypingTarget(e.target)
      ) {
        releaseAll();
        return;
      }
      // Prevent the page from scrolling when using Space / arrows.
      if (capturedCodes.includes(e.code)) {
        e.preventDefault();
      }
      setKey(e.code, true);
    };
    const onUp = (e: KeyboardEvent) => {
      const gameState = useGameStore.getState();
      if (
        gameState.codeEditorOpen ||
        gameState.cursorMode ||
        isTypingTarget(e.target)
      ) {
        releaseAll();
        return;
      }
      if (capturedCodes.includes(e.code)) {
        e.preventDefault();
      }
      setKey(e.code, false);
    };

    // If the window loses focus (alt-tab), release everything so the player
    // doesn't keep walking forever.
    const onBlur = () => releaseAll();

    window.addEventListener("keydown", onDown, { capture: true });
    window.addEventListener("keyup", onUp, { capture: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown, { capture: true });
      window.removeEventListener("keyup", onUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return input;
}
