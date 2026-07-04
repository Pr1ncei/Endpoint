"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";

/**
 * Per-frame telemetry strip. Isolated into its own component (with memo) so
 * that the high-frequency `speed`/`grounded` store updates only re-render
 * this tiny element, not the whole HUD overlay.
 */
const Telemetry = memo(function Telemetry() {
  const speed = useGameStore((s) => s.speed);
  const grounded = useGameStore((s) => s.grounded);
  const showTelemetry = useGameStore((s) => s.showTelemetry);
  if (!showTelemetry) return null;

  return (
    <div className="telemetry">
      <span>{speed.toFixed(1)} m/s</span>
      <span className="dot" data-on={grounded} />
    </div>
  );
});

function AccessEditor() {
  const closeCodeEditor = useGameStore((s) => s.closeCodeEditor);
  const unlockDoor = useGameStore((s) => s.unlockDoor);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [code, setCode] = useState(
    `async function openDoor(api) {
  const response = await api.post("/door/access", {
    pin: "0000"
  });

  return response.ok;
}`
  );
  const [message, setMessage] = useState("Update the request body with the keypad PIN.");

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  const runScript = () => {
    const match = code.match(/pin:\s*["'](\d{4})["']/);
    if (match?.[1] === "0427") {
      setMessage("200 OK - access token accepted");
      unlockDoor();
      return;
    }
    setMessage("403 Forbidden - expected a four digit PIN accepted by /door/access");
  };

  return (
    <div
      className="editor-overlay"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <section className="editor-panel" aria-label="Door access code editor">
        <header className="editor-header">
          <div>
            <span className="editor-kicker">Door API</span>
            <h2>access-request.ts</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeCodeEditor} aria-label="Close editor">
            x
          </button>
        </header>
        <div className="editor-body">
          <aside className="editor-brief">
            <strong>Objective</strong>
            <span>Send the correct PIN to unlock the chamber door.</span>
            <code>POST /door/access</code>
            <span>Keypad hint: 0427</span>
          </aside>
          <textarea
            ref={editorRef}
            className="code-editor"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <footer className="editor-footer">
          <span>{message}</span>
          <button type="button" className="menu-button menu-button-primary" onClick={runScript}>
            Run
          </button>
        </footer>
      </section>
    </div>
  );
}

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
  const settingsOpen = useGameStore((s) => s.settingsOpen);
  const toggleSprint = useGameStore((s) => s.toggleSprint);
  const headBob = useGameStore((s) => s.headBob);
  const showTelemetry = useGameStore((s) => s.showTelemetry);
  const interactionPrompt = useGameStore((s) => s.interactionPrompt);
  const codeEditorOpen = useGameStore((s) => s.codeEditorOpen);
  const cursorMode = useGameStore((s) => s.cursorMode);
  const setStarted = useGameStore((s) => s.setStarted);
  const setSettingsOpen = useGameStore((s) => s.setSettingsOpen);
  const setToggleSprint = useGameStore((s) => s.setToggleSprint);
  const setHeadBob = useGameStore((s) => s.setHeadBob);
  const setShowTelemetry = useGameStore((s) => s.setShowTelemetry);
  const toggleCursorMode = useGameStore((s) => s.toggleCursorMode);
  const requestLock = useGameStore((s) => s.requestLock);

  const showStart = !locked && !codeEditorOpen && !cursorMode;

  const handleStart = () => {
    setStarted(true);
    setSettingsOpen(false);
    // Request pointer lock directly via the controls instance the Player
    // registered. This is what actually engages mouse-look.
    requestLock?.();
  };

  return (
    <div className="hud-root">
      {/* Crosshair — only while playing */}
      {locked && !cursorMode && (
        <div className="crosshair" aria-hidden>
          <span className="crosshair-dot" />
        </div>
      )}

      {interactionPrompt && locked && !cursorMode && (
        <div className="interaction-prompt">{interactionPrompt}</div>
      )}

      {cursorMode && !codeEditorOpen && (
        <div className="cursor-mode-layer">
          <button type="button" className="cursor-mode-pill" onClick={toggleCursorMode}>
            <kbd>Alt</kbd> Return to game
          </button>
        </div>
      )}

      {/* Start / pause prompt */}
      {showStart && (
        <div className="start-overlay">
          <div className="start-card">
            <div className="start-title">
              {started ? "PAUSED" : "PROTOTYPE TEST CHAMBER"}
            </div>
            <div className="start-sub">
              {started
                ? "Click to resume"
                : "Click to enter first-person mode"}
            </div>
            <div className="pause-actions">
              <button
                type="button"
                className="menu-button menu-button-primary"
                onClick={handleStart}
              >
                {started ? "Resume" : "Start"}
              </button>
              {started && (
                <button
                  type="button"
                  className="menu-button"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                >
                  Settings
                </button>
              )}
            </div>
            {settingsOpen && (
              <div className="settings-panel">
                <label className="setting-row">
                  <span>
                    <strong>Toggle sprint</strong>
                    <small>Tap Shift to switch sprint on or off.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={toggleSprint}
                    onChange={(e) => setToggleSprint(e.target.checked)}
                  />
                </label>
                <label className="setting-row">
                  <span>
                    <strong>Head bob</strong>
                    <small>Camera movement while walking and sprinting.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={headBob}
                    onChange={(e) => setHeadBob(e.target.checked)}
                  />
                </label>
                <label className="setting-row">
                  <span>
                    <strong>Telemetry</strong>
                    <small>Speed and grounded indicator.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={showTelemetry}
                    onChange={(e) => setShowTelemetry(e.target.checked)}
                  />
                </label>
              </div>
            )}
            <div className="start-controls">
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
              <span><kbd>Shift</kbd> Sprint</span>
              <span><kbd>Ctrl</kbd>/<kbd>C</kbd> Crouch / Slide</span>
              <span><kbd>Space</kbd> Jump</span>
              <span><kbd>Mouse</kbd> Look</span>
              <span><kbd>Alt</kbd> Cursor</span>
              <span><kbd>Esc</kbd> Release</span>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry strip (debug feel) */}
      <Telemetry />
      {codeEditorOpen && <AccessEditor />}
    </div>
  );
}
