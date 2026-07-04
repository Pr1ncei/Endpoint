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
  SKY_BOTTOM_COLOR,
  SKY_TOP_COLOR,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_POSITION,
} from "@/game/constants";
import { RAMP_DEFS, BOX_DEFS, PILLAR_DEFS } from "@/game/layout";

/**
 * Smooth vertical-gradient sky dome. A big inverted sphere with a tiny shader
 * that blends from a pale horizon (SKY_BOTTOM_COLOR) up to a blue zenith
 * (SKY_TOP_COLOR). `fog={false}` keeps the sky crisp; `depthWrite={false}` +
 * `renderOrder={-1}` ensure it always sits behind the world geometry.
 */
function SkyDome() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(SKY_TOP_COLOR) },
      bottomColor: { value: new THREE.Color(SKY_BOTTOM_COLOR) },
    }),
    []
  );

  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[180, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        fog={false}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vPos;
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          void main() {
            float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
            // Ease toward the top color so the gradient feels like a real sky.
            gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0);
          }
        `}
      />
    </mesh>
  );
}

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

/**
 * The full test-chamber environment: sky dome, fog, daylight lighting, floor
 * slab + panel grid, perimeter trim, and all props (rendered from the shared
 * layout so they line up perfectly with the colliders).
 */
export function Environment() {
  return (
    <group>
      {/* Sky dome (drawn first, behind everything). */}
      <SkyDome />

      {/* Atmospheric haze that blends the platform edges into the horizon. */}
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

      {/* Main floor slab */}
      <mesh receiveShadow position={[0, -PLATFORM_THICKNESS / 2, 0]}>
        <boxGeometry
          args={[PLATFORM_SIZE, PLATFORM_THICKNESS, PLATFORM_SIZE]}
        />
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
        sectionColor={COLORS.accent}
        fadeDistance={FOG_FAR}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* Perimeter trim */}
      <PerimeterTrim />

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
