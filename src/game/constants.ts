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
export const PLAYER_HEIGHT = 1.7; // eye height above the ground
export const PLAYER_RADIUS = 0.4; // body radius for collisions + edge clamp

// Jump feel: a short input buffer lets a Space press "count" even if it lands a
// hair before becoming grounded. Jump is edge-triggered (holding Space does not
// auto-bunny-hop), and fully independent of sprint so you can sprint-jump.
export const JUMP_BUFFER_TIME = 0.12; // seconds a queued jump stays valid

// Max step height the player can walk up without jumping. Lets ramps (gentle
// slope) be climbed, while the high face of a ramp / walls act as blockers.
export const STEP_MAX = 0.5;

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

// --- World -----------------------------------------------------------------
export const PLATFORM_SIZE = 80; // square platform edge length (m)
export const PLATFORM_THICKNESS = 1.0; // how thick the floor slab is
export const SPAWN_POSITION: [number, number, number] = [0, PLAYER_HEIGHT, 12];
export const FALL_THRESHOLD = -15; // y below which we reset the player to spawn

// --- Atmosphere / fog / sky ------------------------------------------------
// Light, airy test chamber: pale-blue horizon haze fading into a blue sky dome.
export const FOG_COLOR = "#c8d6e8"; // matches the sky horizon so depth blends
export const SCENE_BACKGROUND = "#c8d6e8"; // fallback flat color (sky dome covers it)
export const FOG_NEAR = 18;
export const FOG_FAR = 95;

// Sky dome gradient (top = zenith, bottom = horizon). Rendered as a big inverted
// sphere in Environment with a tiny shader; see <SkyDome/>.
export const SKY_TOP_COLOR = "#4a8fc7"; // medium sky blue at the zenith
export const SKY_BOTTOM_COLOR = "#dbe7f2"; // pale, near-white at the horizon

// --- Lighting --------------------------------------------------------------
// Bright, clean daylight so the white platform reads as a sunlit test chamber.
export const AMBIENT_INTENSITY = 0.7;
export const HEMISPHERE_INTENSITY = 0.8;
export const SUN_INTENSITY = 2.2;
export const SUN_POSITION: [number, number, number] = [20, 35, 15];
export const SUN_COLOR = "#fff4e0"; // warm white sunlight
export const HEMI_SKY_COLOR = "#cfe3f5";
export const HEMI_GROUND_COLOR = "#b9c2cf";

// --- Palette ---------------------------------------------------------------
// Light, minimal sci-fi materials. White/grey surfaces with teal accents so the
// scene reads as a clean test chamber rather than a dark or toy-like one.
export const COLORS = {
  floor: "#eef2f7", // near-white platform, slight cool tint
  floorPanel: "#e2e8f0",
  floorEdge: "#9fb0c8", // soft blue-grey grid lines
  panel: "#d2dae6", // walls
  pillar: "#c4cedd",
  terminal: "#c6d0de",
  terminalEmissive: "#16a3a3", // teal accent (pops on white)
  ramp: "#dde5f0",
  accent: "#1f8f8f",
  trim: "#3a567a", // perimeter edge line (non-emissive, painted look)
} as const;
