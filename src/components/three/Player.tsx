"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import type { PointerLockControls as PLCImpl } from "three-stdlib";
import * as THREE from "three";
import { useKeyboardInput } from "@/hooks/useKeyboardInput";
import { useGameStore } from "@/store/useGameStore";
import { resolveBodyCollisions, sampleGroundHeight } from "@/game/colliders";
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
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  MOUSE_SENSITIVITY,
  PLATFORM_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SPAWN_POSITION,
  SPRINT_SPEED,
  STEP_MAX,
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
 *  - Jump is edge-triggered with a small input buffer, and fully decoupled
 *    from sprint — you can sprint while jumping and vice versa.
 *  - Integrates gravity + jump, and resolves ground against the flat platform
 *    AND the ramps (heightfield), so you can walk up/down ramps.
 *  - Resolves body collisions against boxes + pillars (push-out) so the world
 *    feels solid. A step limit prevents teleporting up walls.
 *  - Applies a polished head-bob that scales with speed.
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
  const jumpHeld = useRef(false); // for edge-triggered jump
  const jumpBuffer = useRef(0); // seconds a queued jump stays valid
  const bobPhase = useRef(0); // advances with horizontal speed
  const bobY = useRef(0); // smoothed vertical bob
  const bobX = useRef(0); // smoothed lateral bob

  useEffect(() => {
    camera.position.copy(eye.current);
  }, [camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.pointerSpeed = MOUSE_SENSITIVITY;
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

    // --- Horizontal velocity (sprint is independent of jump) -----------
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

    // --- Jump (edge-triggered + buffered, fully decoupled from sprint) -
    // A press only counts on the rising edge so holding Space doesn't
    // auto-bunny-hop. A short buffer lets a slightly-early press still fire
    // the moment we touch the ground. None of this touches `i.sprint`, so
    // sprinting + jumping work in any combination.
    const jumpPressed = i.jump && !jumpHeld.current;
    jumpHeld.current = i.jump;
    if (jumpPressed) jumpBuffer.current = JUMP_BUFFER_TIME;
    else if (jumpBuffer.current > 0) jumpBuffer.current -= delta;

    if (jumpBuffer.current > 0 && grounded.current) {
      verticalVel.current = JUMP_VELOCITY;
      grounded.current = false;
      jumpBuffer.current = 0;
    }

    // --- Gravity -------------------------------------------------------
    verticalVel.current -= GRAVITY * delta;

    // --- Integrate horizontal ------------------------------------------
    const oldX = eye.current.x;
    const oldZ = eye.current.z;
    eye.current.x += velocity.current.x * delta;
    eye.current.z += velocity.current.z * delta;

    // --- Body collisions (boxes + pillars push the player out) ---------
    resolveBodyCollisions(eye.current, PLAYER_RADIUS);

    // --- Ground height (flat platform OR ramp surface) -----------------
    let groundH = sampleGroundHeight(eye.current.x, eye.current.z);
    const feet = eye.current.y - PLAYER_HEIGHT;

    // Step limit: if the ground ahead is much higher than our feet (e.g. the
    // high face of a ramp or a wall), block the horizontal move. Ramps ascend
    // gradually so their per-frame rise is tiny and never triggers this.
    if (grounded.current && groundH - feet > STEP_MAX) {
      eye.current.x = oldX;
      eye.current.z = oldZ;
      groundH = sampleGroundHeight(eye.current.x, eye.current.z);
    }

    // --- Integrate vertical + resolve ground ---------------------------
    eye.current.y += verticalVel.current * delta;
    const groundY = groundH + PLAYER_HEIGHT;
    if (eye.current.y <= groundY) {
      eye.current.y = groundY;
      verticalVel.current = 0;
      grounded.current = true;
    } else {
      grounded.current = false;
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

    _targetBob.set(
      Math.cos(bobPhase.current) * BOB_LATERAL * intensity,
      Math.abs(Math.sin(bobPhase.current)) * amount * intensity * 2,
      0
    );
    if (speed < 0.05) _targetBob.set(0, 0, 0);

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
    // Lateral sway follows the camera's right vector; vertical bob is a Y
    // offset. Mutating the R3F camera each frame is the intended pattern, so
    // we silence the hooks-immutability lint rule for these assignments.
    // eslint-disable-next-line react-hooks/immutability
    camera.position.x = eye.current.x + _right.x * bobX.current;
    camera.position.z = eye.current.z + _right.z * bobX.current;
    camera.position.y = eye.current.y + bobY.current;

    setTelemetry(speed, grounded.current);
  });

  return <PointerLockControls ref={controlsRef} makeDefault />;
}
