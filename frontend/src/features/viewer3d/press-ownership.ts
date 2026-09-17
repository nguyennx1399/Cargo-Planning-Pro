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
 */
import type { ThreeEvent } from "@react-three/fiber";

/** `userData` for the meshes that may start a placement gesture (the two cargo layers). */
export const GESTURE_LAYER = { gestureLayer: true } as const;

/** Structural, not THREE's `Object3D`: all this needs is `userData`, and reading it tolerantly means a
 * hit that somehow carries no object can never throw inside a pointer handler. */
const isGestureLayer = (hit: { eventObject?: { userData?: Record<string, unknown> } }): boolean =>
  hit.eventObject?.userData?.gestureLayer === true;

/** True when the object whose handler is running is the nearest GESTURE layer hit of this event. */
export function isFrontmostGestureHit(e: ThreeEvent<PointerEvent | MouseEvent>): boolean {
  const front = e.intersections.find(isGestureLayer);
  return front?.eventObject === e.eventObject;
}
