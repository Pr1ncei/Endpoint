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
  CROUCH_CAMERA_DROP,
  CROUCH_SPEED,
  DECELERATION,
  FALL_THRESHOLD,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  MOUSE_SENSITIVITY,
  PLATFORM_SIZE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SLIDE_CAMERA_DROP,
  SLIDE_CAMERA_SMOOTH,
  SLIDE_COOLDOWN,
  SLIDE_DECELERATION,
  SLIDE_DURATION,
  SLIDE_MIN_SPEED,
  SLIDE_SPRINT_GRACE,
  SLIDE_SPEED,
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
  const registerUnlock = useGameStore((s) => s.registerUnlock);
  const toggleSprint = useGameStore((s) => s.toggleSprint);
  const headBob = useGameStore((s) => s.headBob);
  const locked = useGameStore((s) => s.locked);
  const codeEditorOpen = useGameStore((s) => s.codeEditorOpen);
  const cursorMode = useGameStore((s) => s.cursorMode);

  // Persistent per-frame state in refs (no re-renders).
  const eye = useRef(new THREE.Vector3(...SPAWN_POSITION)); // physics eye pos
  const velocity = useRef(new THREE.Vector3()); // horizontal velocity
  const verticalVel = useRef(0);
  const grounded = useRef(true);
  const jumpHeld = useRef(false); // for edge-triggered jump
  const jumpBuffer = useRef(0); // seconds a queued jump stays valid
  const slideHeld = useRef(false);
  const slideTimer = useRef(0);
  const slideCooldown = useRef(0);
  const slideSprintGrace = useRef(0);
  const slideNeedsReset = useRef(false);
  const slideDir = useRef(new THREE.Vector3());
  const slideCameraDrop = useRef(0);
  const sprintHeld = useRef(false);
  const sprintLatched = useRef(false);
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
    registerUnlock(() => controls.unlock());
    const onLock = () => useGameStore.getState().setLocked(true);
    const onUnlock = () => useGameStore.getState().setLocked(false);
    controls.addEventListener("lock", onLock);
    controls.addEventListener("unlock", onUnlock);
    return () => {
      controls.removeEventListener("lock", onLock);
      controls.removeEventListener("unlock", onUnlock);
      registerLock(null);
      registerUnlock(null);
    };
  }, [registerLock, registerUnlock]);

  useFrame((_, rawDelta) => {
    // Clamp delta so a tab-switch spike doesn't fling the player.
    const delta = Math.min(rawDelta, 1 / 30);
    const i = input.current;

    if (!locked || codeEditorOpen || cursorMode) {
      velocity.current.set(0, 0, 0);
      verticalVel.current = 0;
      slideTimer.current = 0;
      slideCooldown.current = 0;
      slideSprintGrace.current = 0;
      sprintLatched.current = false;
      bobX.current = THREE.MathUtils.damp(bobX.current, 0, BOB_SMOOTH, delta);
      bobY.current = THREE.MathUtils.damp(bobY.current, 0, BOB_SMOOTH, delta);
      slideCameraDrop.current = THREE.MathUtils.damp(
        slideCameraDrop.current,
        0,
        SLIDE_CAMERA_SMOOTH,
        delta
      );
      camera.position.x = eye.current.x + bobX.current;
      camera.position.z = eye.current.z;
      camera.position.y = eye.current.y + bobY.current - slideCameraDrop.current;
      setTelemetry(0, grounded.current);
      return;
    }

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

    const sprintPressed = i.sprint && !sprintHeld.current;
    sprintHeld.current = i.sprint;
    if (toggleSprint && sprintPressed) {
      sprintLatched.current = !sprintLatched.current;
    } else if (!toggleSprint) {
      sprintLatched.current = false;
    }

    const effectiveSprint = toggleSprint ? sprintLatched.current : i.sprint;
    const sprinting = effectiveSprint && hasInput;
    let sliding = slideTimer.current > 0;
    if (sprinting) {
      slideSprintGrace.current = SLIDE_SPRINT_GRACE;
    } else if (slideSprintGrace.current > 0) {
      slideSprintGrace.current -= delta;
    }
    if (slideCooldown.current > 0) {
      slideCooldown.current -= delta;
    }

    // --- Jump (edge-triggered + buffered, fully decoupled from sprint) -
    // Resolve jump before slide/movement so Shift never gates Space.
    const jumpPressed = i.jump && !jumpHeld.current;
    jumpHeld.current = i.jump;
    if (jumpPressed) jumpBuffer.current = JUMP_BUFFER_TIME;
    else if (jumpBuffer.current > 0) jumpBuffer.current -= delta;

    if (jumpBuffer.current > 0 && grounded.current) {
      verticalVel.current = JUMP_VELOCITY;
      grounded.current = false;
      jumpBuffer.current = 0;
      slideTimer.current = 0;
      sliding = false;
    }

    const crouching =
      i.slide &&
      grounded.current &&
      !sliding &&
      slideSprintGrace.current <= 0;

    // --- Slide ---------------------------------------------------------
    // Start a COD-style slide only from a grounded sprint. Once started, it
    // keeps its own forward momentum so releasing Shift mid-slide does not
    // immediately kill the motion.
    const slidePressed = i.slide && !slideHeld.current;
    slideHeld.current = i.slide;
    if (!i.slide && slideTimer.current <= 0 && slideCooldown.current <= 0) {
      slideNeedsReset.current = false;
    }
    if (
      slidePressed &&
      hasInput &&
      slideSprintGrace.current > 0 &&
      grounded.current &&
      slideCooldown.current <= 0 &&
      !slideNeedsReset.current
    ) {
      slideDir.current.copy(_wishDir);
      slideTimer.current = SLIDE_DURATION;
      velocity.current.x = slideDir.current.x * SLIDE_SPEED;
      velocity.current.z = slideDir.current.z * SLIDE_SPEED;
      slideNeedsReset.current = true;
      sliding = true;
    }

    // --- Horizontal velocity (sprint is independent of jump) -----------
    if (sliding) {
      slideTimer.current -= delta;
      const slideSpeed = Math.max(
        0,
        Math.hypot(velocity.current.x, velocity.current.z) -
          SLIDE_DECELERATION * delta
      );
      velocity.current.x = slideDir.current.x * slideSpeed;
      velocity.current.z = slideDir.current.z * slideSpeed;

      if (slideTimer.current <= 0 || slideSpeed < SLIDE_MIN_SPEED) {
        slideTimer.current = 0;
        slideCooldown.current = SLIDE_COOLDOWN;
      }
    } else {
      const targetSpeed = crouching
        ? CROUCH_SPEED
        : effectiveSprint
          ? SPRINT_SPEED
          : WALK_SPEED;
      const preserveAirMomentum = !grounded.current && !hasInput;
      const targetX = preserveAirMomentum
        ? velocity.current.x
        : _wishDir.x * targetSpeed;
      const targetZ = preserveAirMomentum
        ? velocity.current.z
        : _wishDir.z * targetSpeed;
      const rate = (hasInput || preserveAirMomentum ? ACCELERATION : DECELERATION) / 10;
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
    const sprintFactor = effectiveSprint || slideTimer.current > 0 ? 1 : 0;
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

    bobPhase.current += freq * Math.min(speed / SPRINT_SPEED, 1) * delta;
    const intensity = Math.min(speed / WALK_SPEED, 1);

    if (headBob) {
      _targetBob.set(
        Math.cos(bobPhase.current) * BOB_LATERAL * intensity,
        Math.abs(Math.sin(bobPhase.current)) * amount * intensity * 2,
        0
      );
      if (speed < 0.05) _targetBob.set(0, 0, 0);
    } else {
      _targetBob.set(0, 0, 0);
    }

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
    slideCameraDrop.current = THREE.MathUtils.damp(
      slideCameraDrop.current,
      sliding && grounded.current
        ? SLIDE_CAMERA_DROP
        : crouching
          ? CROUCH_CAMERA_DROP
          : 0,
      SLIDE_CAMERA_SMOOTH,
      delta
    );

    // --- Commit to camera ---------------------------------------------
    // Lateral sway follows the camera's right vector; vertical bob is a Y
    // offset. Mutating the R3F camera each frame is the intended pattern, so
    // we silence the hooks-immutability lint rule for these assignments.
    // eslint-disable-next-line react-hooks/immutability
    camera.position.x = eye.current.x + _right.x * bobX.current;
    camera.position.z = eye.current.z + _right.z * bobX.current;
    camera.position.y = eye.current.y + bobY.current - slideCameraDrop.current;

    setTelemetry(speed, grounded.current);
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      makeDefault
      enabled={!codeEditorOpen && !cursorMode}
      selector=".game-canvas"
    />
  );
}
