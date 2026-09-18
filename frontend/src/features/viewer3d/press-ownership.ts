/**
 * press-ownership.ts — "may THIS object act on this press?" (Phase 03).
 *
 * R3F delivers one pointer event to EVERY intersected object with a handler, nearest first, and the
 * props each handler reads are from the LAST render. That is fine while one layer owns the pointer, but
 * a project-cargo item resting on deck can have a container stack directly behind it along the view
 * ray, and then a single press arms BOTH gestures in the same dispatch: the item's mesh arms a
 * breakbulk move and `ContainerInstances`, whose handler still sees the pre-press store (the re-render
 * has not happened yet — React state updates are batched to the end of the event), arms a container
 * drag. The hand is ONE field, so the last writer wins and the planner picks up the wrong object. This
 * was found by driving the real gesture in a browser, not by a unit test.
 *
 * The rule: a press belongs to the FRONTMOST object among those that can START A GESTURE — the cargo
 * layers, which mark themselves with `GESTURE_LAYER`. Deliberately NOT "the frontmost object of any
 * kind": the passive pick layers (an empty-slot volume, an area drop plane) sit above the deck and are
 * often the nearest hit to a press on cargo under them, and treating them as contenders would make the
 * cargo unpickable — the first fix of this file did exactly that and the browser probe caught it. Those
 * layers still receive moves and clicks through the ordinary dispatch; they only must not be able to
 * block a press they have no handler for.
 *
 * `raycast={() => null}` layers are not affected either: R3F raycasts only the objects that registered
 * handlers, so a dead mesh (the ghost, the placeholders) can never be frontmost here.
 *
 * IDLE HOVER AND CLICK (cargo-click fix, 2026-09-18): the same "passive layers must not block cargo"
 * rule extends past the press. With nothing in hand, the empty-slot picker's INVISIBLE volumes sit over
 * the hatch covers and holds — exactly where project cargo rests, since no container is there — and
 * were the nearest hit at the centre of all 8 placed items on BBC SAO PAULO. Their `stopPropagation`
 * swallowed the item's hover and click, so an item was selectable only on the edges sticking out of the
 * slot grid. `rayHitsCargo` is the test the picker uses to step aside: the planner sees the cargo, not
 * the invisible volume, so visible cargo owns an idle pointer.
 */

/** `userData` for the meshes that may start a placement gesture (the two cargo layers). */
export const GESTURE_LAYER = { gestureLayer: true } as const;

/** One ray hit, structurally — THREE's `Intersection`/R3F's event carry these fields, and a test can
 * build them without a scene. Read tolerantly so a hit with no object can never throw in a handler. */
export interface RayHit {
  eventObject?: { userData?: Record<string, unknown> };
}

/** The part of an R3F pointer event these rules read. */
export interface RayEvent {
  intersections: readonly RayHit[];
  eventObject?: unknown;
}

const isGestureLayer = (hit: RayHit): boolean => hit.eventObject?.userData?.gestureLayer === true;

/** True when the object whose handler is running is the nearest GESTURE layer hit of this event. */
export function isFrontmostGestureHit(e: RayEvent): boolean {
  const front = e.intersections.find(isGestureLayer);
  return front !== undefined && front.eventObject === e.eventObject;
}

/** True when any cargo (a `GESTURE_LAYER` object) lies anywhere on this event's ray. */
export const rayHitsCargo = (e: RayEvent): boolean => e.intersections.some(isGestureLayer);
