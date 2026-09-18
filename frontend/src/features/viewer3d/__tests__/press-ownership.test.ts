/**
 * Pointer ownership between the 3D layers (cargo-click fix, 2026-09-18).
 *
 * The geometry these pin was measured in the browser: at the centre of every placed project-cargo item
 * on BBC SAO PAULO the nearest hit was the empty-slot picker's invisible volume, with the item's own
 * mesh behind it. The rules must hand that pointer to the item.
 */
import { describe, expect, it } from "vitest";
import { GESTURE_LAYER, isFrontmostGestureHit, rayHitsCargo, type RayHit } from "../press-ownership";

const slotVolume = { userData: {} };
const item = { userData: { ...GESTURE_LAYER } };
const stack = { userData: { ...GESTURE_LAYER } };
const hit = (eventObject: RayHit["eventObject"]): RayHit => ({ eventObject });

describe("rayHitsCargo", () => {
  it("is false for an empty ray", () => {
    expect(rayHitsCargo({ intersections: [] })).toBe(false);
  });

  it("is false when only passive layers are hit (empty deck)", () => {
    expect(rayHitsCargo({ intersections: [hit(slotVolume), hit(slotVolume)] })).toBe(false);
  });

  it("is true when cargo lies behind an invisible slot volume — the reported bug", () => {
    expect(rayHitsCargo({ intersections: [hit(slotVolume), hit(item), hit(slotVolume)] })).toBe(true);
  });

  it("tolerates a hit with no object", () => {
    expect(rayHitsCargo({ intersections: [{}, hit(item)] })).toBe(true);
  });
});

describe("isFrontmostGestureHit", () => {
  it("lets the nearest cargo act even with a slot volume in front of it", () => {
    expect(isFrontmostGestureHit({ intersections: [hit(slotVolume), hit(item)], eventObject: item })).toBe(true);
  });

  it("refuses a stack behind an item — the item owns the click and hover", () => {
    const e = { intersections: [hit(item), hit(stack)] };
    expect(isFrontmostGestureHit({ ...e, eventObject: stack })).toBe(false);
    expect(isFrontmostGestureHit({ ...e, eventObject: item })).toBe(true);
  });

  it("is false when no cargo is on the ray", () => {
    expect(isFrontmostGestureHit({ intersections: [hit(slotVolume)], eventObject: undefined })).toBe(false);
  });
});
