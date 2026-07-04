import * as THREE from "three";
import { RAMP_DEFS, BOX_DEFS, PILLAR_DEFS } from "./layout";

/**
 * Lightweight collision helpers for the prototype.
 *
 *  - `sampleGroundHeight(x, z)` returns the walkable surface height at a point.
 *    0 = flat platform. A ramp's tilted surface is sampled analytically, so the
 *    player can walk smoothly up/down ramps. (Visuals are tilted slabs whose
 *    top surface matches this plane — see Environment.Ramp.)
 *
 *  - `resolveBodyCollisions(pos, radius)` pushes a circle (the player's body
 *    in XZ) out of every box (OBB) and pillar (cylinder). This makes walls,
 *    terminals and pillars solid.
 *
 * These are deliberately simple — no full physics engine — but enough for a
 * first-person test chamber to feel grounded.
 */

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// The ramp visual is a thin slab (0.2 thick). Its top surface sits ~0.1m above
// the analytical center plane, so we add this offset to keep the player's feet
// on top of the slab instead of sunk into it.
const RAMP_SURFACE_OFFSET = 0.1;

// Reusable temp vectors (avoid per-frame allocation).
const _local = new THREE.Vector3();
const _push = new THREE.Vector3();

/**
 * Returns the ground height (Y) at world (x, z). Walks every ramp; if the point
 * is inside a ramp's footprint, returns the ramp's surface height there
 * (0 at the low end, ramp.height at the high end). Returns 0 when not on a ramp.
 */
export function sampleGroundHeight(x: number, z: number): number {
  let best = 0;
  for (const r of RAMP_DEFS) {
    // Transform the world point into the ramp's local space (undo rotationY).
    _local
      .set(x - r.position[0], 0, z - r.position[1])
      .applyAxisAngle(Y_AXIS, -r.rotationY);
    const lx = _local.x;
    const lz = _local.z;
    if (Math.abs(lx) <= r.width / 2 && Math.abs(lz) <= r.length / 2) {
      // t = 0 at the low end (lz = -length/2), 1 at the high end (lz = +length/2).
      const t = (lz + r.length / 2) / r.length;
      const h = THREE.MathUtils.clamp(t, 0, 1) * r.height + RAMP_SURFACE_OFFSET;
      if (h > best) best = h;
    }
  }
  return best;
}

/**
 * Pushes `pos` (mutated in place) out of every box and pillar so the player's
 * circular body (given radius) doesn't overlap solid geometry. Boxes are
 * treated as oriented bounding boxes (honoring rotationY); pillars as
 * cylinders (circle-vs-circle in XZ).
 */
export function resolveBodyCollisions(
  pos: THREE.Vector3,
  radius: number
): void {
  // --- Boxes (OBB vs circle) ---------------------------------------------
  for (const b of BOX_DEFS) {
    // Player -> box-local space.
    _local
      .set(pos.x - b.position[0], 0, pos.z - b.position[2])
      .applyAxisAngle(Y_AXIS, -b.rotationY);

    const hx = b.size[0] / 2;
    const hz = b.size[2] / 2;
    // Closest point on the box rectangle to the player center.
    const cx = THREE.MathUtils.clamp(_local.x, -hx, hx);
    const cz = THREE.MathUtils.clamp(_local.z, -hz, hz);
    const dx = _local.x - cx;
    const dz = _local.z - cz;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-4) {
        // Push out along the vector from the closest point to the center.
        _push.set(
          (dx / dist) * (radius - dist),
          0,
          (dz / dist) * (radius - dist)
        );
      } else {
        // Center is inside the box: eject along the nearest face.
        const px = hx - Math.abs(_local.x);
        const pz = hz - Math.abs(_local.z);
        if (px < pz) {
          _push.set((Math.sign(_local.x) || 1) * (px + radius), 0, 0);
        } else {
          _push.set(0, 0, (Math.sign(_local.z) || 1) * (pz + radius));
        }
      }
      // Push vector back to world space.
      _push.applyAxisAngle(Y_AXIS, b.rotationY);
      pos.x += _push.x;
      pos.z += _push.z;
    }
  }

  // --- Pillars (circle vs circle) ----------------------------------------
  for (const p of PILLAR_DEFS) {
    const dx = pos.x - p.position[0];
    const dz = pos.z - p.position[2];
    const minDist = radius + p.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.sqrt(distSq) || 1e-4;
      const overlap = minDist - dist;
      pos.x += (dx / dist) * overlap;
      pos.z += (dz / dist) * overlap;
    }
  }
}
