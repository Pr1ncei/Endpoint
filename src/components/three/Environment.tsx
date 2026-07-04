"use client";

import { useEffect, useRef } from "react";
import { Grid, Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  AMBIENT_INTENSITY,
  COLORS,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  HEMI_GROUND_COLOR,
  HEMI_SKY_COLOR,
  HEMISPHERE_INTENSITY,
  PLATFORM_SIZE,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
} from "@/game/constants";
import { RAMP_DEFS, BOX_DEFS, PILLAR_DEFS } from "@/game/layout";
import { useGameStore } from "@/store/useGameStore";

const DOOR_POSITION = new THREE.Vector3(0, 0, -37.5);
const KEYPAD_POSITION = new THREE.Vector3(3.2, 1.35, -36.9);
const _cameraDirection = new THREE.Vector3();
const _keypadDirection = new THREE.Vector3();

/** A ramp rendered as a tilted slab whose top surface matches the collider's
 *  analytical plane (low end at ground, high end at `height`). */
function Ramp({
  def,
}: {
  def: (typeof RAMP_DEFS)[number];
}) {
  const { width, length, height, rotationY, position } = def;
  const slabLen = Math.hypot(length, height);
  const tilt = -Math.atan2(height, length); // tilt up along +Z
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotationY, 0]}>
      <mesh
        castShadow
        receiveShadow
        position={[0, height / 2, 0]}
        rotation={[tilt, 0, 0]}
      >
        <boxGeometry args={[width, 0.2, slabLen]} />
        <meshStandardMaterial
          color={COLORS.ramp}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
      {/* Accent strip at the high edge so the ramp's top is readable. */}
      <mesh position={[0, height + 0.02, length / 2]}>
        <boxGeometry args={[width, 0.04, 0.12]} />
        <meshStandardMaterial
          color={COLORS.accent}
          emissive={COLORS.accent}
          emissiveIntensity={0.5}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** A box prop (terminal or wall). Optional emissive accent cap on top. */
function BoxProp({ def }: { def: (typeof BOX_DEFS)[number] }) {
  const [w, h, d] = def.size;
  return (
    <group position={def.position} rotation={[0, def.rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={def.accent ? COLORS.terminal : COLORS.panel}
          metalness={0.3}
          roughness={0.55}
        />
      </mesh>
      {def.accent && (
        <mesh position={[0, h + 0.011, 0]}>
          <boxGeometry args={[w * 0.7, 0.02, d * 0.7]} />
          <meshStandardMaterial
            color={COLORS.terminalEmissive}
            emissive={COLORS.terminalEmissive}
            emissiveIntensity={1.6}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

/** A cylindrical pillar with a subtle accent cap ring. */
function Pillar({ def }: { def: (typeof PILLAR_DEFS)[number] }) {
  const { position, radius, height } = def;
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius, radius, height, 24]} />
        <meshStandardMaterial
          color={COLORS.pillar}
          metalness={0.35}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[0, height + 0.02, 0]}>
        <cylinderGeometry args={[radius + 0.04, radius + 0.04, 0.06, 24]} />
        <meshStandardMaterial
          color={COLORS.accent}
          emissive={COLORS.accent}
          emissiveIntensity={0.7}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** Thin painted line framing the platform edge so the boundary is visible. */
function PerimeterTrim() {
  const half = PLATFORM_SIZE / 2;
  const t = 0.08; // trim thickness
  const h = 0.05; // trim height
  const mat = (
    <meshStandardMaterial
      color={COLORS.trim}
      metalness={0.3}
      roughness={0.6}
    />
  );
  return (
    <group position={[0, 0.02, 0]}>
      <mesh position={[0, h / 2, half]}>
        <boxGeometry args={[PLATFORM_SIZE, h, t]} />
        {mat}
      </mesh>
      <mesh position={[0, h / 2, -half]}>
        <boxGeometry args={[PLATFORM_SIZE, h, t]} />
        {mat}
      </mesh>
      <mesh position={[half, h / 2, 0]}>
        <boxGeometry args={[t, h, PLATFORM_SIZE]} />
        {mat}
      </mesh>
      <mesh position={[-half, h / 2, 0]}>
        <boxGeometry args={[t, h, PLATFORM_SIZE]} />
        {mat}
      </mesh>
    </group>
  );
}

function ApiDoor() {
  const leftDoor = useRef<THREE.Mesh>(null);
  const rightDoor = useRef<THREE.Mesh>(null);
  const statusLight = useRef<THREE.Mesh>(null);
  const promptVisible = useRef(false);
  const { camera } = useThree();
  const doorUnlocked = useGameStore((s) => s.doorUnlocked);
  const openCodeEditor = useGameStore((s) => s.openCodeEditor);
  const setInteractionPrompt = useGameStore((s) => s.setInteractionPrompt);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyE") return;
      const state = useGameStore.getState();
      if (state.codeEditorOpen || state.doorUnlocked) return;

      const distance = camera.position.distanceTo(KEYPAD_POSITION);
      camera.getWorldDirection(_cameraDirection);
      _keypadDirection.copy(KEYPAD_POSITION).sub(camera.position).normalize();
      if (distance < 4 && _cameraDirection.dot(_keypadDirection) > 0.55) {
        event.preventDefault();
        openCodeEditor();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [camera, openCodeEditor]);

  useFrame((_, delta) => {
    const distance = camera.position.distanceTo(KEYPAD_POSITION);
    camera.getWorldDirection(_cameraDirection);
    _keypadDirection.copy(KEYPAD_POSITION).sub(camera.position).normalize();
    const canInteract =
      !doorUnlocked && distance < 4 && _cameraDirection.dot(_keypadDirection) > 0.55;
    if (promptVisible.current !== canInteract) {
      promptVisible.current = canInteract;
      setInteractionPrompt(canInteract ? "Press E to edit access script" : null);
    }

    const openAmount = doorUnlocked ? 1.25 : 0;
    if (leftDoor.current) {
      leftDoor.current.position.x = THREE.MathUtils.damp(
        leftDoor.current.position.x,
        -openAmount,
        6,
        delta
      );
    }
    if (rightDoor.current) {
      rightDoor.current.position.x = THREE.MathUtils.damp(
        rightDoor.current.position.x,
        openAmount,
        6,
        delta
      );
    }
    if (statusLight.current) {
      statusLight.current.scale.setScalar(
        THREE.MathUtils.damp(statusLight.current.scale.x, doorUnlocked ? 1.35 : 1, 7, delta)
      );
    }
  });

  return (
    <group position={DOOR_POSITION}>
      <mesh castShadow receiveShadow position={[0, 2.2, -0.2]}>
        <boxGeometry args={[6.2, 4.4, 0.35]} />
        <meshStandardMaterial color="#b8c5d4" metalness={0.35} roughness={0.48} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2.2, -0.01]}>
        <boxGeometry args={[4.2, 3.45, 0.42]} />
        <meshStandardMaterial color="#2f4258" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh ref={leftDoor} castShadow receiveShadow position={[-0.54, 2.05, 0.16]}>
        <boxGeometry args={[1.95, 3.1, 0.24]} />
        <meshStandardMaterial color="#d7dde6" metalness={0.4} roughness={0.42} />
      </mesh>
      <mesh ref={rightDoor} castShadow receiveShadow position={[0.54, 2.05, 0.17]}>
        <boxGeometry args={[1.95, 3.1, 0.24]} />
        <meshStandardMaterial color="#d7dde6" metalness={0.4} roughness={0.42} />
      </mesh>
      <mesh position={[0, 3.9, 0.02]}>
        <boxGeometry args={[3.4, 0.18, 0.16]} />
        <meshStandardMaterial
          color={doorUnlocked ? COLORS.terminalEmissive : "#8aa0b8"}
          emissive={doorUnlocked ? COLORS.terminalEmissive : "#27415c"}
          emissiveIntensity={doorUnlocked ? 1.4 : 0.35}
        />
      </mesh>
      <group position={[3.2, 1.35, 0.35]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.95, 1.45, 0.22]} />
          <meshStandardMaterial color="#26384d" metalness={0.35} roughness={0.38} />
        </mesh>
        <mesh position={[0, 0.42, 0.12]}>
          <boxGeometry args={[0.62, 0.22, 0.03]} />
          <meshStandardMaterial
            color={doorUnlocked ? COLORS.terminalEmissive : "#d7e5f2"}
            emissive={doorUnlocked ? COLORS.terminalEmissive : "#7ba8d1"}
            emissiveIntensity={doorUnlocked ? 1.8 : 0.55}
          />
        </mesh>
        {[-0.24, 0, 0.24].map((x) =>
          [-0.14, -0.38, -0.62].map((y) => (
            <mesh key={`${x}-${y}`} position={[x, y, 0.13]}>
              <boxGeometry args={[0.14, 0.14, 0.04]} />
              <meshStandardMaterial color="#dfe7f0" metalness={0.2} roughness={0.45} />
            </mesh>
          ))
        )}
        <mesh ref={statusLight} position={[0.34, 0.42, 0.16]}>
          <sphereGeometry args={[0.06, 16, 8]} />
          <meshStandardMaterial
            color={doorUnlocked ? "#2be4a8" : "#ffcf66"}
            emissive={doorUnlocked ? "#2be4a8" : "#ffcf66"}
            emissiveIntensity={1.4}
          />
        </mesh>
        <Text
          position={[0, 0.76, 0.14]}
          fontSize={0.12}
          color="#eaf4ff"
          anchorX="center"
          anchorY="middle"
        >
          API
        </Text>
      </group>
    </group>
  );
}

/**
 * The full test-chamber environment: scene background/fog, daylight lighting, floor
 * slab + panel grid, perimeter trim, and all props (rendered from the shared
 * layout so they line up perfectly with the colliders).
 */
export function Environment() {
  return (
    <group>
      {/* Keep sky/fog as scene state, not a nearby world-space mesh, to avoid camera-distance scaling artifacts near platform edges. */}
      <color attach="background" args={[FOG_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Daylight: ambient fill + hemisphere sky/ground + a warm key light. */}
      <ambientLight intensity={AMBIENT_INTENSITY} color={"#eaf1ff"} />
      <hemisphereLight
        intensity={HEMISPHERE_INTENSITY}
        color={HEMI_SKY_COLOR}
        groundColor={HEMI_GROUND_COLOR}
      />
      <directionalLight
        position={SUN_POSITION}
        intensity={SUN_INTENSITY}
        color={SUN_COLOR}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-40, 40, 40, -40, 0.1, 120]}
        />
      </directionalLight>

      {/* Main floor baseplate */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PLATFORM_SIZE, PLATFORM_SIZE]} />
        <meshStandardMaterial
          color={COLORS.floor}
          metalness={0.1}
          roughness={0.7}
        />
      </mesh>

      {/* Subtle panel grid on the floor for sci-fi readability. Sits a hair
          above the slab to avoid z-fighting. */}
      <Grid
        position={[0, 0.01, 0]}
        args={[PLATFORM_SIZE, PLATFORM_SIZE]}
        cellSize={2}
        cellThickness={0.6}
        cellColor={COLORS.floorEdge}
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor={COLORS.floorPanel}
        fadeDistance={FOG_FAR}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* Perimeter trim */}
      <PerimeterTrim />
      <ApiDoor />

      {/* Props — rendered from the shared layout (also used for collision). */}
      {RAMP_DEFS.map((r, idx) => (
        <Ramp key={`ramp-${idx}`} def={r} />
      ))}
      {BOX_DEFS.map((b, idx) => (
        <BoxProp key={`box-${idx}`} def={b} />
      ))}
      {PILLAR_DEFS.map((p, idx) => (
        <Pillar key={`pillar-${idx}`} def={p} />
      ))}
    </group>
  );
}
