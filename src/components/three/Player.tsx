"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import type { PointerLockControls as PLCImpl } from "three-stdlib";
import * as THREE from "three";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useGameStore } from "@/store/useGameStore";
import {
  ACCELERATION,
  BOB_AMOUNT_SPRINT,
  BOB_AMOUNT_WALK,
  BOB_FREQUENCY_SPRINT,
  BOB_FREQUENCY_WALK,
  BOB_LATERAL,
  BOB_SMOOTH,
  DECELERATION,
  FALL_THRESHOLD,
  GRAVITY,
  JUMP_VELOCITY,
  MOUSE_SENSITIVITY,
  PLATFORM_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SPAWN_POSITION,
  SPRINT_SPEED,
  WALK_SPEED,
} from "@/game/constants";

// Reusable temp vectors so we don't allocate per frame.
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wishDir = new THREE.Vector3();
const _targetBob = new THREE.Vector3();

/**
 * First-person player controller.
 *
 * Responsibilities:
 *  - Owns the camera (we drive its position each frame; drei's
 *    PointerLockControls drives rotation via mouse).
 *  - Reads keyboard input for WASD movement + Shift sprint + Space jump.
 *  - Integrates simple gravity + jump (not a full physics engine — just
 *    enough to feel game-like).
 *  - Applies a polished head-bob that scales with speed.
 *  - Clamps the player to the platform and respawns on falling off.
 *
 * The camera never orbits — it is locked to the player's eyes. We keep the
 * "true" eye position in `eye` (physics) and add the bob offset on top when
 * writing to the camera each frame, so the bob never fights the ground clamp.
 */
export function Player() {
  const controlsRef = useRef<PLCImpl>(null);
  const { camera } = useThree();
  const input = useKeyboardInput();
  const setTelemetry = useGameStore((s) => s.setTelemetry);
  const registerLock = useGameStore((s) => s.registerLock);

  // Persistent per-frame state in refs (no re-renders).
  const eye = useRef(new THREE.Vector3(...SPAWN_POSITION)); // physics eye pos
  const velocity = useRef(new THREE.Vector3()); // horizontal velocity
  const verticalVel = useRef(0);
  const grounded = useRef(true);
  const bobPhase = useRef(0); // advances with horizontal speed
  const bobY = useRef(0); // smoothed vertical bob
  const bobX = useRef(0); // smoothed lateral bob

  useEffect(() => {
    camera.position.copy(eye.current);
  }, [camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // drei's PointerLockControls forwards to three-stdlib's impl which exposes
    // `pointerSpeed` (default 1). Setting it here lets MOUSE_SENSITIVITY work.
    controls.pointerSpeed = MOUSE_SENSITIVITY;
    // Expose a lock trigger so the HUD overlay can request pointer lock.
    registerLock(() => controls.lock());
    const onLock = () => useGameStore.getState().setLocked(true);
    const onUnlock = () => useGameStore.getState().setLocked(false);
    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);
    return () => {
      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);
      registerLock(null);
    };
  }, [registerLock]);

  useFrame((_, rawDelta) => {
    // Clamp delta so a tab-switch spike doesn't fling the player.
    const delta = Math.min(rawDelta, 1 / 30);
    const i = input.current;

    // --- Build the wish direction from input in camera space -----------
    // Flatten camera forward onto the XZ plane so we never fly.
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, camera.up).normalize();

    _wishDir.set(0, 0, 0);
    if (i.forward) _wishDir.add(_forward);
    if (i.backward) _wishDir.sub(_forward);
    if (i.right) _wishDir.add(_right);
    if (i.left) _wishDir.sub(_right);
    const hasInput = _wishDir.lengthSq() > 0;
    if (hasInput) _wishDir.normalize();

    // --- Horizontal velocity with accel/decel --------------------------
    const targetSpeed = i.sprint ? SPRINT_SPEED : WALK_SPEED;
    const targetX = _wishDir.x * targetSpeed;
    const targetZ = _wishDir.z * targetSpeed;

    const rate = (hasInput ? ACCELERATION : DECELERATION) / 10;
    velocity.current.x = THREE.MathUtils.damp(
      velocity.current.x,
      targetX,
      rate,
      delta
    );
    velocity.current.z = THREE.MathUtils.damp(
      velocity.current.z,
      targetZ,
      rate,
      delta
    );

    // --- Jump + gravity (simple vertical integration) ------------------
    if (i.jump && grounded.current) {
      verticalVel.current = JUMP_VELOCITY;
      grounded.current = false;
    }
    verticalVel.current -= GRAVITY * delta;

    // Integrate position.
    eye.current.x += velocity.current.x * delta;
    eye.current.z += velocity.current.z * delta;
    eye.current.y += verticalVel.current * delta;

    // Ground collision at eye height.
    if (eye.current.y <= PLAYER_HEIGHT) {
      eye.current.y = PLAYER_HEIGHT;
      verticalVel.current = 0;
      grounded.current = true;
    }

    // --- Boundary clamp: keep the player on the platform ---------------
    const half = PLATFORM_SIZE / 2 - PLAYER_RADIUS;
    eye.current.x = THREE.MathUtils.clamp(eye.current.x, -half, half);
    eye.current.z = THREE.MathUtils.clamp(eye.current.z, -half, half);

    // Safety net: respawn if we ever fall through.
    if (eye.current.y < FALL_THRESHOLD) {
      eye.current.set(...SPAWN_POSITION);
      velocity.current.set(0, 0, 0);
      verticalVel.current = 0;
      grounded.current = true;
    }

    // --- Head bobbing --------------------------------------------------
    // Advance the phase proportionally to horizontal speed. When idle the
    // phase freezes and the offset eases back to zero (via the damp below).
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    const sprintFactor = i.sprint ? 1 : 0;
    const amount = THREE.MathUtils.lerp(
      BOB_AMOUNT_WALK,
      BOB_AMOUNT_SPRINT,
      sprintFactor
    );
    const freq = THREE.MathUtils.lerp(
      BOB_FREQUENCY_WALK,
      BOB_FREQUENCY_SPRINT,
      sprintFactor
    );

    bobPhase.current += speed * freq * delta;
    const intensity = Math.min(speed / WALK_SPEED, 1);

    // Vertical bob uses a double-frequency sine for a footstep cadence;
    // lateral sway uses a single-frequency cosine.
    _targetBob.set(
      Math.cos(bobPhase.current) * BOB_LATERAL * intensity,
      Math.abs(Math.sin(bobPhase.current)) * amount * intensity * 2,
      0
    );
    if (speed < 0.05) _targetBob.set(0, 0, 0); // calm when idle

    bobX.current = THREE.MathUtils.damp(
      bobX.current,
      _targetBob.x,
      BOB_SMOOTH,
      delta
    );
    bobY.current = THREE.MathUtils.damp(
      bobY.current,
      _targetBob.y,
      BOB_SMOOTH,
      delta
    );

    // --- Commit to camera ---------------------------------------------
    // Lateral sway is applied along the camera's right vector so it follows
    // the view direction; vertical bob is a plain Y offset.
    // Mutating the R3F camera each frame is the intended pattern here, so we
    // silence the hooks-immutability lint rule for these assignments.
    // eslint-disable-next-line react-hooks/immutability
    camera.position.x = eye.current.x + _right.x * bobX.current;
    camera.position.z = eye.current.z + _right.z * bobX.current;
    camera.position.y = eye.current.y + bobY.current;

    setTelemetry(speed, grounded.current);
  });

  return <PointerLockControls ref={controlsRef} makeDefault />;
}
