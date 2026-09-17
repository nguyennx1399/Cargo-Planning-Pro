/**
 * breakbulk-pose — pointer position → droppable pose. The load-bearing assertion is the D-P1
 * regression: snap and clamp do not commute, so clamp-then-snap silently leaves 0.15 m of a 6.5 m
 * wide item outside BBC's Hold 2 tank top. That test asserts the FOOTPRINT, not the centre, because
 * the centre looks plausible either way; reversing the order fails it.
 */
import { describe, expect, it } from "vitest";
import { canPlaceBreakbulk } from "../can-place-breakbulk";
import {
  clampPoseToArea,
  footprintExtents,
  poseFromScenePoint,
  rotationNext,
  snapPose,
} from "../breakbulk-pose";
import { buildStowageModel, placementXToSceneX, rectContainsRect, rectFromCenter, type StowageArea } from "@/engine/stowage-model";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildLoadedDemoPlan } from "@/data/build-demo-plan";
import type { Rect } from "@/engine/breakbulk-overlap-check";
import type { BreakbulkCargo } from "@/types/domain";

const item = (patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo => ({
  id: "ITEM", category: "wind_turbine_blade", length_m: 62, width_m: 4.5, height_m: 3.5, weight_t: 22,
  kg_above_base_m: 1.7, pol: "A", pod: "B", ...patch,
});

/** Only the geometry matters to the pose maths, so a synthetic area is enough for the bound cases. */
const areaWith = (rect: Rect, patch: Partial<StowageArea> = {}): StowageArea => ({
  id: "a", label: "area", level: "weather_deck", onDeck: true, rect, keepOuts: [], surfaceY: 0,
  maxHeight: Infinity, source: "declared", ...patch,
});

const bbc = buildBbcSaoPauloVesselAndCargo();
const bbcModel = buildStowageModel(bbc.vessel);
const bbcPlan = buildLoadedDemoPlan(bbc.vessel, bbc.containers);
const hold2 = bbcModel.areaById.get("tank_top_hold2")!; // z ±9.1 m, 18.2 m usable beam
const yacht30 = item({ id: "YACHT", category: "yacht", length_m: 30, width_m: 6.5, height_m: 7, weight_t: 95 });

describe("snapPose", () => {
  it("snaps only the centre, leaving the area and the rotation alone", () => {
    expect(snapPose({ areaId: "hold", x_m: 12.3, z_m: -6.7, rotation_deg: 90 })).toEqual({
      areaId: "hold", x_m: 12.5, z_m: -6.5, rotation_deg: 90,
    });
  });

  it("takes the step from the caller", () => {
    expect(snapPose({ x_m: 12.4, z_m: -6.6 }, 1)).toEqual({ x_m: 12, z_m: -7 });
  });
});

describe("rotationNext", () => {
  it("cycles 0 ↔ 90 — the only two rotations the footprint maths swaps on", () => {
    expect(rotationNext(0)).toBe(90);
    expect(rotationNext(90)).toBe(0);
    expect(rotationNext(45)).toBe(90);
    expect(rotationNext(180)).toBe(90);
  });
});

describe("footprintExtents", () => {
  it("is the length × width pair, swapped at 90° like rectFromCenter", () => {
    const long = item({ length_m: 20, width_m: 4 });
    expect(footprintExtents(long)).toEqual([20, 4]);
    expect(footprintExtents(long, 90)).toEqual([4, 20]);
    const rect = rectFromCenter(3, 4, 20, 4, 90);
    expect(footprintExtents(long, 90)).toEqual([rect.xMax - rect.xMin, rect.zMax - rect.zMin]);
  });
});

describe("clampPoseToArea", () => {
  it("keeps a 6.5 m wide item inside a z ±9.1 m hold: snap FIRST, then clamp (D-P1)", () => {
    const clamped = clampPoseToArea(hold2, yacht30, { areaId: "tank_top_hold2", x_m: 60, z_m: -6.0 });
    const footprint = rectFromCenter(clamped.x_m, clamped.z_m, yacht30.length_m, yacht30.width_m, clamped.rotation_deg);

    expect(rectContainsRect(hold2.rect, footprint)).toBe(true);
    expect(footprint.zMin).toBeGreaterThan(hold2.rect.zMin); // strictly inside, not merely touching
    expect(clamped.z_m).toBe(-5.5);
    // The reason the assertions above are on the FOOTPRINT: what the reversed order (clamp into the
    // raw bounds, then snap) would have produced is a centre that still looks reasonable — -6.0 —
    // while the footprint pokes 0.15 m out of the hold. That is the silent bug D-P1 is about.
    const naiveZ = Math.round(Math.min(Math.max(-6.0, hold2.rect.zMin + 3.25), hold2.rect.zMax - 3.25) / 0.5) * 0.5;
    expect(naiveZ).toBe(-6.0);
    expect(rectContainsRect(hold2.rect, rectFromCenter(60, naiveZ, 30, 6.5, 0))).toBe(false);

    // The clamped pose is refused by the predicate only for where it sits, never for the area edge.
    const result = canPlaceBreakbulk(bbcModel, bbcPlan, yacht30, clamped, bbc.vessel);
    expect(result.reasons.map((r) => r.rule)).not.toContain("breakbulk_out_of_deck_area");
  });

  it("leaves an item longer than the area untouched, for the predicate to refuse with its own message", () => {
    const hold1 = bbcModel.areaById.get("tank_top_hold1")!; // 7.7 m long, 8.4 m usable beam
    const pose = { areaId: "tank_top_hold1", x_m: 119.75, z_m: 0 };

    expect(clampPoseToArea(hold1, item({ id: "BLADE" }), pose)).toEqual(pose);
    const result = canPlaceBreakbulk(bbcModel, bbcPlan, item({ id: "BLADE" }), pose, bbc.vessel);
    expect(result.reasons[0]).toEqual({
      rule: "breakbulk_out_of_deck_area",
      message: "BLADE: footprint extends outside Hold 1 tank top",
      severity: "error",
    });
  });

  it("rotates which axis clamps when the item turns 90°", () => {
    const area = areaWith({ xMin: 0, xMax: 40, zMin: -12, zMax: 12 });
    const long = item({ length_m: 20, width_m: 4 });
    const raw = { x_m: 35, z_m: 15 };

    // 0°: the 20 m length runs fore-aft, so the x bound is the tight one and both axes clamp.
    const at0 = clampPoseToArea(area, long, { ...raw, rotation_deg: 0 });
    expect([at0.x_m, at0.z_m]).toEqual([30, 10]);
    // 90°: the same 20 m now runs athwartships — x fits untouched, z takes the clamp.
    const at90 = clampPoseToArea(area, long, { ...raw, rotation_deg: 90 });
    expect([at90.x_m, at90.z_m]).toEqual([35, 2]);
    expect(at90.rotation_deg).toBe(90);

    for (const pose of [at0, at90]) {
      const footprint = rectFromCenter(pose.x_m, pose.z_m, 20, 4, pose.rotation_deg);
      expect(rectContainsRect(area.rect, footprint)).toBe(true);
    }
  });

  it("leaves a pose alone rather than nudging it when no grid position fits (sub-grid rect)", () => {
    // 6.4 m of area for a 6.4 m item: the inward bounds cross (lo 3.5 > hi 3.0). Choosing either would
    // move the pose, so the raw pose survives — here an exact fit that the predicate then accepts.
    const area = areaWith({ xMin: 0, xMax: 6.4, zMin: -3, zMax: 3 });
    const exact = item({ length_m: 6.4, width_m: 2 });
    const inside = { x_m: 3.2, z_m: 0 };
    const outside = { x_m: 40, z_m: 0 };

    expect(clampPoseToArea(area, exact, inside)).toEqual(inside);
    expect(rectContainsRect(area.rect, rectFromCenter(3.2, 0, 6.4, 2))).toBe(true);
    expect(clampPoseToArea(area, exact, outside)).toEqual(outside);
  });

  it("never lets a fitting item out of the area, wherever the pointer is (inward-only clamp)", () => {
    for (let z = -12; z <= 12; z += 0.41) {
      for (let x = 34; x <= 120; x += 0.37) {
        const pose = clampPoseToArea(hold2, yacht30, { x_m: x, z_m: z });
        expect(Number.isInteger(pose.x_m * 2) && Number.isInteger(pose.z_m * 2)).toBe(true); // on the 0.5 m grid
        expect(rectContainsRect(hold2.rect, rectFromCenter(pose.x_m, pose.z_m, 30, 6.5))).toBe(true);
      }
    }
  });
});

describe("poseFromScenePoint", () => {
  it("goes through the shared scene→x_m offset, keeping the area and the rotation", () => {
    const vessel = bbc.vessel; // 149.95 m LOA
    const pose = poseFromScenePoint(vessel, "tank_top_hold2", placementXToSceneX(60, vessel.length_m), -5, 90);

    expect(pose).toEqual({ areaId: "tank_top_hold2", x_m: 60, z_m: -5, rotation_deg: 90 });
  });

  it("returns the raw point: snapping is the caller's chain, not this function's", () => {
    const vessel = bbc.vessel;
    const pose = poseFromScenePoint(vessel, "weather_deck", 0.3, -0.7);

    expect(pose.x_m).toBeCloseTo(vessel.length_m / 2 + 0.3, 9);
    expect(pose.z_m).toBe(-0.7);
    expect(pose.rotation_deg).toBe(0);
  });
});
