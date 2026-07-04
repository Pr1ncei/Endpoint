/**
 * Single source of truth for the test-chamber layout.
 *
 * Both the Environment (rendering) and the colliders (physics) read from these
 * definitions, so visuals and collision can never drift apart. Add a prop here
 * and it will both render and collide automatically.
 */

export interface RampDef {
  /** Center of the ramp's ground footprint (x, z). */
  position: [number, number];
  /** Yaw rotation. 0 = ascends toward +Z (low end at -Z, high end at +Z). */
  rotationY: number;
  width: number; // across the ramp (X, local)
  length: number; // horizontal run along ascent (Z, local)
  height: number; // vertical rise at the high end
}

export interface BoxDef {
  /** World position of the box base center (x, y, z). y is usually 0. */
  position: [number, number, number];
  /** Full size (x, y, z). Box extends upward from y. */
  size: [number, number, number];
  rotationY: number;
  /** Render an emissive accent cap on top (terminal style). */
  accent?: boolean;
}

export interface PillarDef {
  position: [number, number, number];
  radius: number;
  height: number;
}

export const RAMP_DEFS: RampDef[] = [
  { position: [-6, 4], rotationY: Math.PI, width: 4, length: 6, height: 1.6 },
  { position: [6, 4], rotationY: 0, width: 4, length: 6, height: 1.6 },
  { position: [0, -4], rotationY: Math.PI / 2, width: 4, length: 6, height: 1.6 },
];

export const BOX_DEFS: BoxDef[] = [
  // Terminals (low blocks with glowing caps)
  { position: [0, 0, -18], size: [3, 1.4, 3], rotationY: 0, accent: true },
  { position: [-8, 0, -22], size: [2.4, 1.1, 2.4], rotationY: 0.3, accent: true },
  { position: [8, 0, -22], size: [2.4, 1.1, 2.4], rotationY: -0.3, accent: true },
  { position: [-18, 0, 8], size: [2, 0.9, 2], rotationY: 0, accent: true },
  { position: [18, 0, 8], size: [2, 0.9, 2], rotationY: 0, accent: true },
  // Walls
  { position: [-16, 0, -6], size: [6, 2.2, 0.4], rotationY: 0 },
  { position: [16, 0, -6], size: [6, 2.2, 0.4], rotationY: 0 },
  { position: [0, 0, 14], size: [0.4, 2.2, 8], rotationY: 0 },
];

export const PILLAR_DEFS: PillarDef[] = [
  { position: [-12, 0, -12], radius: 0.6, height: 5 },
  { position: [12, 0, -12], radius: 0.6, height: 5 },
  { position: [-12, 0, 12], radius: 0.6, height: 5 },
  { position: [12, 0, 12], radius: 0.6, height: 5 },
  { position: [-22, 0, 0], radius: 0.6, height: 5 },
  { position: [22, 0, 0], radius: 0.6, height: 5 },
];
