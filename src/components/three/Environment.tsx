"use client";

import { useMemo } from "react";
import { Grid } from "@react-three/drei";
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
  PLATFORM_THICKNESS,
  SCENE_BACKGROUND,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
} from "@/game/constants";

/**
 * A single sci-fi prop block. Built from a beveled-ish box with an optional
 * emissive accent strip on top, so the chamber reads as "test equipment"
 * rather than toy bricks.
 */
function PropBlock({
  position,
  size,
  color = COLORS.pillar,
  accent = false,
  rotationY = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  accent?: boolean;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.55}
        />
      </mesh>
      {accent && (
        <mesh position={[0, size[1] + 0.011, 0]}>
          <boxGeometry args={[size[0] * 0.7, 0.02, size[2] * 0.7]} />
          <meshStandardMaterial
            color={COLORS.terminalEmissive}
            emissive={COLORS.terminalEmissive}
            emissiveIntensity={2.2}
            metalness={0.1}
            roughness={0.4}
          />
        </mesh>
      )}
    </group>
  );
}

/** A ramp made from a rotated thin slab sitting on a wedge-ish base. */
function Ramp({
  position,
  width = 4,
  length = 6,
  height = 1.6,
  rotationY = 0,
}: {
  position: [number, number, number];
  width?: number;
  length?: number;
  height?: number;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* The ramp slab is pitched by rotating around X. */}
      <mesh
        castShadow
        receiveShadow
        position={[0, height / 2, 0]}
        rotation={[-Math.atan2(height, length), 0, 0]}
      >
        <boxGeometry args={[width, 0.2, Math.hypot(length, height)]} />
        <meshStandardMaterial
          color={COLORS.ramp}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}

/** A tall pillar. */
function Pillar({
  position,
  height = 5,
}: {
  position: [number, number, number];
  height?: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.55, 0.6, height, 24]} />
        <meshStandardMaterial
          color={COLORS.pillar}
          metalness={0.45}
          roughness={0.5}
        />
      </mesh>
      {/* Glowing cap ring */}
      <mesh position={[0, height + 0.02, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.06, 24]} />
        <meshStandardMaterial
          color={COLORS.accent}
          emissive={COLORS.accent}
          emissiveIntensity={1.4}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/**
 * The full test-chamber environment: floor slab + panel grid, perimeter trim,
 * scattered props (pillars, ramps, terminals), and cinematic lighting + fog.
 */
export function Environment() {
  // Precompute prop layouts once.
  const layout = useMemo(() => {
    const pillars: [number, number, number][] = [
      [-12, 0, -12],
      [12, 0, -12],
      [-12, 0, 12],
      [12, 0, 12],
      [-22, 0, 0],
      [22, 0, 0],
    ];
    const terminals: {
      pos: [number, number, number];
      size: [number, number, number];
      rot: number;
    }[] = [
      { pos: [0, 0, -18], size: [3, 1.4, 3], rot: 0 },
      { pos: [-8, 0, -22], size: [2.4, 1.1, 2.4], rot: 0.3 },
      { pos: [8, 0, -22], size: [2.4, 1.1, 2.4], rot: -0.3 },
      { pos: [-18, 0, 8], size: [2, 0.9, 2], rot: 0 },
      { pos: [18, 0, 8], size: [2, 0.9, 2], rot: 0 },
    ];
    const ramps: {
      pos: [number, number, number];
      rot: number;
    }[] = [
      { pos: [-6, 0, 4], rot: Math.PI },
      { pos: [6, 0, 4], rot: 0 },
      { pos: [0, 0, -4], rot: Math.PI / 2 },
    ];
    const walls: {
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [
      { pos: [-16, 0, -6], size: [6, 2.2, 0.4] },
      { pos: [16, 0, -6], size: [6, 2.2, 0.4] },
      { pos: [0, 0, 14], size: [0.4, 2.2, 8] },
    ];
    return { pillars, terminals, ramps, walls };
  }, []);

  return (
    <group>
      {/* Background + atmospheric fog give the chamber depth. */}
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Lighting: ambient fill + hemisphere sky/ground + a key "sun". */}
      <ambientLight intensity={AMBIENT_INTENSITY} color={"#9fb4d8"} />
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

      {/* Main floor slab */}
      <mesh
        receiveShadow
        position={[0, -PLATFORM_THICKNESS / 2, 0]}
      >
        <boxGeometry args={[PLATFORM_SIZE, PLATFORM_THICKNESS, PLATFORM_SIZE]} />
        <meshStandardMaterial
          color={COLORS.floor}
          metalness={0.5}
          roughness={0.45}
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
        sectionColor={COLORS.accent}
        fadeDistance={FOG_FAR}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* Perimeter trim — a thin glowing edge framing the platform. */}
      <PerimeterTrim />

      {/* Props */}
      {layout.pillars.map((p, idx) => (
        <Pillar key={`pillar-${idx}`} position={p} />
      ))}
      {layout.terminals.map((t, idx) => (
        <PropBlock
          key={`term-${idx}`}
          position={t.pos}
          size={t.size}
          color={COLORS.terminal}
          accent
          rotationY={t.rot}
        />
      ))}
      {layout.ramps.map((r, idx) => (
        <Ramp key={`ramp-${idx}`} position={r.pos} rotationY={r.rot} />
      ))}
      {layout.walls.map((w, idx) => (
        <PropBlock
          key={`wall-${idx}`}
          position={w.pos}
          size={w.size}
          color={COLORS.panel}
        />
      ))}

      {/* A raised central dais to break up the flat floor. */}
      <mesh receiveShadow castShadow position={[0, 0.15, -8]}>
        <cylinderGeometry args={[3, 3.2, 0.3, 48]} />
        <meshStandardMaterial
          color={COLORS.floorPanel}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}

/** Thin emissive frame around the platform edge so the boundary is visible. */
function PerimeterTrim() {
  const half = PLATFORM_SIZE / 2;
  const t = 0.08; // trim thickness
  const h = 0.06; // trim height
  const mat = (
    <meshStandardMaterial
      color={COLORS.accent}
      emissive={COLORS.accent}
      emissiveIntensity={1.1}
      metalness={0.2}
      roughness={0.4}
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
