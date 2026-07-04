/**
 * Central tweakable constants for the first-person prototype.
 * Everything that affects "game feel" lives here so designers can tune
 * the experience without hunting through component code.
 */

// --- Player movement -------------------------------------------------------
export const WALK_SPEED = 5.5; // m/s while walking
export const SPRINT_SPEED = 9.5; // m/s while sprinting (Shift)
export const ACCELERATION = 60; // how quickly we ramp up to target speed
export const DECELERATION = 50; // how quickly we slow down when no input

// Simple vertical physics. Not a full physics engine — just enough for a
// satisfying jump + gravity so the prototype feels "game-like".
export const JUMP_VELOCITY = 6.2; // initial upward speed on Space
export const GRAVITY = 18.0; // downward acceleration m/s^2
export const PLAYER_HEIGHT = 1.7; // eye height above the platform
export const PLAYER_RADIUS = 0.4; // used for soft boundary clamping

// --- Camera bobbing --------------------------------------------------------
// Bobbing is driven by a phase that advances with horizontal speed.
// Amplitude & frequency scale up while sprinting for a heavier stride.
export const BOB_AMOUNT_WALK = 0.045; // vertical bob amplitude walking (m)
export const BOB_AMOUNT_SPRINT = 0.085; // vertical bob amplitude sprinting
export const BOB_FREQUENCY_WALK = 7.5; // strides per second walking
export const BOB_FREQUENCY_SPRINT = 11.0; // strides per second sprinting
export const BOB_LATERAL = 0.04; // side-to-side sway amplitude
export const BOB_SMOOTH = 8.0; // how fast bobbing eases in/out

// --- Mouse look ------------------------------------------------------------
export const MOUSE_SENSITIVITY = 1.0; // multiplier for pointer-lock look
export const PITCH_LIMIT = Math.PI / 2 - 0.05; // clamp vertical look (~89deg)

// --- World -----------------------------------------------------------------
export const PLATFORM_SIZE = 80; // square platform edge length (m)
export const PLATFORM_THICKNESS = 1.0; // how thick the floor slab is
export const SPAWN_POSITION: [number, number, number] = [0, PLAYER_HEIGHT, 12];
export const FALL_THRESHOLD = -15; // y below which we reset the player to spawn

// --- Atmosphere / fog ------------------------------------------------------
// A cool blue-grey haze that gives depth without obscuring nearby geometry.
export const FOG_COLOR = "#0a0e16";
export const SCENE_BACKGROUND = "#070a11";
export const FOG_NEAR = 12;
export const FOG_FAR = 75;

// --- Lighting --------------------------------------------------------------
export const AMBIENT_INTENSITY = 0.35;
export const HEMISPHERE_INTENSITY = 0.5;
export const SUN_INTENSITY = 1.6;
export const SUN_POSITION: [number, number, number] = [18, 30, 12];
export const SUN_COLOR = "#cfe2ff";
export const HEMI_SKY_COLOR = "#1a2740";
export const HEMI_GROUND_COLOR = "#0a0d14";

// --- Palette ---------------------------------------------------------------
// Minimal sci-fi materials. Kept here so the whole scene reads as one piece.
export const COLORS = {
  floor: "#12161f",
  floorPanel: "#0c0f16",
  floorEdge: "#2a3245",
  panel: "#1a2030",
  pillar: "#222a3b",
  terminal: "#2b3550",
  terminalEmissive: "#3bd0d0",
  ramp: "#191f2c",
  accent: "#4fd1c5",
} as const;
