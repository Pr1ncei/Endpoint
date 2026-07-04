"use client";

import { memo } from "react";
import { useGameStore } from "@/store/useGameStore";

/**
 * Per-frame telemetry strip. Isolated into its own component (with memo) so
 * that the high-frequency `speed`/`grounded` store updates only re-render
 * this tiny element, not the whole HUD overlay.
 */
const Telemetry = memo(function Telemetry() {
  const speed = useGameStore((s) => s.speed);
  const grounded = useGameStore((s) => s.grounded);
  return (
    <div className="telemetry">
      <span>{speed.toFixed(1)} m/s</span>
      <span className="dot" data-on={grounded} />
    </div>
  );
});

/**
 * 2D overlay drawn on top of the canvas. Handles:
 *  - the "click to start" prompt (visible until pointer lock is engaged)
 *  - a minimalist crosshair
 *  - small telemetry readout for tuning game feel
 *
 * Clicking the start overlay calls `requestLock` (registered by the Player),
 * which asks the PointerLockControls to engage mouse-look.
 */
export function Hud() {
  const locked = useGameStore((s) => s.locked);
  const started = useGameStore((s) => s.started);
  const setStarted = useGameStore((s) => s.setStarted);
  const requestLock = useGameStore((s) => s.requestLock);

  const showStart = !locked;

  const handleStart = () => {
    setStarted(true);
    // Request pointer lock directly via the controls instance the Player
    // registered. This is what actually engages mouse-look.
    requestLock?.();
  };

  return (
    <div className="hud-root">
      {/* Crosshair — only while playing */}
      {locked && (
        <div className="crosshair" aria-hidden>
          <span className="crosshair-dot" />
        </div>
      )}

      {/* Start / pause prompt */}
      {showStart && (
        <button
          type="button"
          className="start-overlay"
          onClick={handleStart}
        >
          <div className="start-card">
            <div className="start-title">
              {started ? "PAUSED" : "PROTOTYPE TEST CHAMBER"}
            </div>
            <div className="start-sub">
              {started
                ? "Click to resume"
                : "Click to enter first-person mode"}
            </div>
            <div className="start-controls">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
              <span><kbd>Shift</kbd> Sprint</span>
              <span><kbd>Space</kbd> Jump</span>
              <span><kbd>Mouse</kbd> Look</span>
              <span><kbd>Esc</kbd> Release</span>
            </div>
          </div>
        </button>
      )}

      {/* Telemetry strip (debug feel) */}
      <Telemetry />
    </div>
  );
}
