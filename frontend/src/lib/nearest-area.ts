/**
 * nearest-area.ts — the PURE decision rule behind pointer-driven AREA resolution (Phase 02), the
 * area-shaped sibling of `nearest-slot.ts` and written for the same reason.
 *
 * WHAT WENT WRONG (measured, not theorised — see the phase file's mechanism table): the pick layer was
 * one invisible plane per area, each sized to that area's rect and sitting at that area's own height.
 * three.js only reports a hit where the ray crosses THAT plane's height INSIDE THAT rect, so the
 * surfaces were disjoint: walking the pointer down one screen line gave `weather deck` → nothing →
 * `Hold 2 tank top` → nothing. The gaps were silent (no pose, no ghost, a release did nothing), and
 * wherever the deck-level crossing fell outside the deck rect while the ray's deeper crossing landed
 * inside the hold rect, pointing AT THE DECK produced a pose in the HOLD. Which surface the ray
 * happened to enter was answering a question about WHERE THE POINTER IS.
 *
 * THE RULE: cross the ray with EVERY candidate area's plane, keep the areas whose rect contains that
 * crossing, and take the TOPMOST one (greatest `surfaceY`) — the surface the planner is looking down
 * at. Reaching a surface underneath a higher one is what the deck toggles are for: an area the viewer
 * has hidden is not in `areas` at all (`areaVisible`), which is the same disambiguation
 * `AreaPlaceholders` already relies on.
 *
 * THE PADDING: a rect is tested expanded by the item's own half-footprint, so the pointer near an edge
 * still resolves to that area and `clampPoseToArea` pulls the pose inside. Without it the last half
 * item-length before every edge is a dead zone of its own. The padding NEVER relaxes a rule: the pose
 * it produces is clamped into the real rect and then judged by `canPlaceBreakbulk` like any other.
 *
 * No three/react/store imports: the caller turns its pointer event into a ray in the SHIP frame (the
 * areas' own frame) and hands the numbers over.
 */
import type { Rect } from "@/engine/breakbulk-overlap-check";

/** A point or direction in the ship frame. Structurally what three's `Vector3` gives via `.toArray()`. */
export type Vec3 = readonly [number, number, number];

/** Below this the ray is parallel enough to a deck that its crossing is meaningless — the divisor
 * would put it a million metres away. Same guard, same constant as `cursorOnTierPlane`. */
const PARALLEL_EPS = 1e-6;

/** What the resolver needs to know about one candidate area. A projection of `StowageArea`, so the
 * caller passes the model's own objects and this module never learns about labels or load ratings. */
export interface AreaProbe {
  id: string;
  surfaceY: number;
  rect: Rect;
}

/** Where the ray crosses the horizontal plane at `surfaceY`. Null when it never does in front of the
 * camera: parallel to the deck, or the crossing is behind the origin. */
export function cursorOnAreaPlane(surfaceY: number, origin: Vec3, dir: Vec3): Vec3 | null {
  if (Math.abs(dir[1]) < PARALLEL_EPS) return null;
  const t = (surfaceY - origin[1]) / dir[1];
  if (t < 0) return null;
  return [origin[0] + dir[0] * t, surfaceY, origin[2] + dir[2] * t];
}

/** A crossing exactly ON an edge belongs to the area: the scene<->placement x round trip lands a
 * boundary point a few ulps outside, and losing the outermost row of a rect to float noise is the same
 * class of dead zone this module exists to remove. */
const EDGE_EPS = 1e-6;

/** The pose-side x of a crossing is in SCENE coordinates; the rect is in placement coordinates. The
 * caller does that conversion (it owns `vessel.length_m`), so this stays a plain rectangle test. */
const inside = (rect: Rect, x: number, z: number, padX: number, padZ: number): boolean =>
  x >= rect.xMin - padX - EDGE_EPS &&
  x <= rect.xMax + padX + EDGE_EPS &&
  z >= rect.zMin - padZ - EDGE_EPS &&
  z <= rect.zMax + padZ + EDGE_EPS;

export interface AreaHit {
  /** Index into the `areas` argument — the caller keeps its own objects. */
  index: number;
  /** The crossing on that area's surface, in the frame the caller passed the ray in. */
  point: Vec3;
}

/**
 * The area under the cursor: topmost surface whose (padded) rect contains the ray's crossing.
 *
 * `pad` is the item's half-footprint `[x, z]` — pass `[0, 0]` to test the bare rects. Returns null
 * when the ray reaches none of them, which is a real answer (the pointer is off the ship, over the sea
 * or the sky) and the caller should clear the hovered pose rather than invent one.
 *
 * Ties on `surfaceY` resolve to the LOWEST index, so the outcome depends only on the caller's order
 * (`model.areas`, never a distance sort).
 */
export function areaUnderCursor(
  areas: readonly AreaProbe[],
  origin: Vec3,
  dir: Vec3,
  pad: readonly [number, number] = [0, 0],
  /** Scene x -> the rect's x convention. Identity by default so the pure tests stay plain. */
  toRectX: (sceneX: number) => number = (x) => x,
): AreaHit | null {
  let best: AreaHit | null = null;
  let bestY = -Infinity;
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const point = cursorOnAreaPlane(area.surfaceY, origin, dir);
    if (!point) continue;
    if (!inside(area.rect, toRectX(point[0]), point[2], pad[0], pad[1])) continue;
    if (area.surfaceY > bestY) {
      bestY = area.surfaceY;
      best = { index: i, point };
    }
  }
  return best;
}
