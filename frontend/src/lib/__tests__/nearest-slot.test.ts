/**
 * nearest-slot — the pointer-resolution rule (P1/D2), swept over the REAL slot centres of both app
 * vessels. This is where the phase's precision claims live: the pick volumes overlap by design (they
 * TILE, so no pointer can fall into a dead zone), and this rule is what stops that overlap — and with
 * it the camera azimuth — from deciding which slot the pointer resolves to.
 *
 * Each sweep prints what it measured, because the disputed numbers are claims about the DATA: the
 * "2400 vs 1520" pair count, the 0.402 m BBC band at the minimum pitch, and the 0.076 m sibling gap
 * the deleted size-aware volume cost. All three are re-measured here rather than restated.
 */
import { describe, expect, it } from "vitest";
import { cursorOnTierPlane, nearestSlotIndex, type Vec3 } from "../nearest-slot";
import { buildStowageModel, type SlotDef } from "@/engine/stowage-model";
import { sizeFitsBay } from "@/engine/placement-checks";
import { DIM, HALF_BAY_OFFSET_M, LAYOUT, bayCenterX } from "@/lib/geometry";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo } from "@/data/build-demo-plan";
import type { Container, Vessel } from "@/types/domain";

const bbc = buildBbcSaoPauloVesselAndCargo();
const demo = buildDemoVesselAndCargo();

/** The candidate set exactly as `EmptySlotPicker` builds it for a container in hand: every slot of the
 * bays its size can use, in the model's own — stable — order, which is the order the tie-break uses. */
const candidateSet = (vessel: Vessel, container: Container): SlotDef[] =>
  buildStowageModel(vessel).slots.filter((s) => sizeFitsBay(container, s.bay));

const centresOf = (slots: SlotDef[]): Vec3[] => slots.map((s) => s.center);
const key = (c: Vec3): string => c.map((n) => n.toFixed(6)).join(",");
const cellKey = (s: SlotDef): string => `${s.row}|${s.tier}`;
const pick = (cs: Container[], size: Container["size"]): Container => cs.find((c) => c.size === size)!;

const REAL = [
  { name: "MV Demo Horizon", vessel: demo.vessel, dry: pick(demo.containers, "40"), half: pick(demo.containers, "20") },
  { name: "BBC SAO PAULO", vessel: bbc.vessel, dry: pick(bbc.containers, "40"), half: pick(bbc.containers, "20") },
];

const sweep = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(x);
  return out;
};

describe("cursorOnTierPlane", () => {
  it("returns where the cursor ray crosses the tier's plane", () => {
    expect(cursorOnTierPlane(5, [0, 10, 0], [0, -1, 0])).toEqual([0, 5, 0]); // straight down
    expect(cursorOnTierPlane(5, [0, 10, 0], [2, -2, 0])).toEqual([5, 5, 0]); // oblique
  });

  it("refuses a ray that never crosses that plane in front of the camera", () => {
    expect(cursorOnTierPlane(5, [0, 10, 0], [1, 0, 0])).toBeNull(); // parallel to the deck
    expect(cursorOnTierPlane(5, [0, 10, 0], [0, 1, 0])).toBeNull(); // travelling away from it
    expect(cursorOnTierPlane(5, [0, 10, 0], [0, 1e-7, 0])).toBeNull(); // within the parallel tolerance
  });
});

describe("nearestSlotIndex", () => {
  it("is deterministic, and breaks an exact tie by the caller's candidate order", () => {
    const centres: Vec3[] = [[0, 0, 0], [10, 0, 0], [0, 0, 10]];
    const midway: Vec3 = [5, 0, 0]; // exactly 5 away from the first two
    expect(nearestSlotIndex(midway, centres)).toBe(0);
    expect(nearestSlotIndex(midway, centres)).toBe(nearestSlotIndex(midway, centres));
    // Same two candidates, swapped order: the LOWEST INDEX still wins, so the rule depends on a stable
    // candidate order (production passes `StowageModel.slots` filtered, never re-sorted).
    expect(nearestSlotIndex(midway, [centres[1], centres[0], centres[2]])).toBe(0);
    expect(nearestSlotIndex(midway, [])).toBe(-1); // no candidates: caller's `?? fallback` decides
  });

  it.each(REAL)("resolves a point on every slot centre to that slot ($name)", ({ name, vessel, dry, half }) => {
    for (const [label, container] of [["40'", dry], ["20'", half]] as const) {
      const slots = candidateSet(vessel, container);
      const centres = centresOf(slots);
      // Two slots sharing a centre would make "nearest to its own centre" ambiguous by construction, so
      // pin it rather than assume it: it is what lets the assertion below be an equality of indices.
      expect(new Set(centres.map(key)).size, `${label} centres must be unique`).toBe(slots.length);

      const missed = slots.filter((slot, i) => nearestSlotIndex(slot.center, centres) !== i);
      expect(missed.map((s) => s.key)).toEqual([]);
      console.log(`nearest-slot: ${name} ${label} — ${slots.length} centres swept, all resolve to themselves`);
    }
  });

  it.each(REAL)("keeps a point inside a pick box on that box's own tier ($name)", ({ vessel, dry, half }) => {
    for (const [label, container] of [["40'", dry], ["20'", half]] as const) {
      const slots = candidateSet(vessel, container);
      const centres = centresOf(slots);
      // ±1.32 m is just inside the ±tierPitch/2 (1.325 m) the box reaches: the nearest OTHER tier's
      // centre is then 1.33 m away, so only the 3-D (not horizontal) metric can pass this.
      const probes = slots.flatMap((s) => [1.32, -1.32].map((dy) => [s.center[0], s.center[1] + dy, s.center[2]] as Vec3));
      const ownTier = slots.flatMap((s) => [s.key, s.key]);
      const wrong = probes.filter((p, i) => slots[nearestSlotIndex(p, centres)]?.key !== ownTier[i]);
      expect(wrong).toEqual([]);
      console.log(`nearest-slot: ${vessel.id} ${label} — ${probes.length} vertical probes inside ${slots.length} boxes`);
    }
  });
});

describe("BBC SAO PAULO's minimum bay pitch", () => {
  it("splits at the midpoint of the two bay centres, not at the pick boxes' 0.402 m overlap", () => {
    const bays = bbc.vessel.bays;
    const cx = new Map(bays.map((b) => [b, bayCenterX(bbc.vessel, b)]));
    const pairs = bays.slice(0, -1).map((bay, i) => ({
      bay, next: bays[i + 1], pitch: Math.abs(cx.get(bay)! - cx.get(bays[i + 1])!),
    }));
    const worst = pairs.reduce((m, p) => (p.pitch < m.pitch ? p : m));
    expect(worst.pitch).toBeCloseTo(12.99, 2); // the reconciled worst case, not the 13.0388 mean

    const slots = candidateSet(bbc.vessel, pick(bbc.containers, "40"));
    const xa = cx.get(worst.bay)!;
    const xb = cx.get(worst.next)!;
    const lo = Math.min(xa, xb);
    const hi = Math.max(xa, xb);
    const mid = (xa + xb) / 2;
    const nearerBay = (x: number): number => (Math.abs(x - xa) < Math.abs(x - xb) ? worst.bay : worst.next);

    // Hold y and z on a real slot both bays carry, so the sweep probes bays only.
    const inNext = new Set(slots.filter((s) => s.bay === worst.next).map(cellKey));
    const anchor = slots.find((s) => s.bay === worst.bay && inNext.has(cellKey(s)))!;
    expect(anchor).toBeTruthy();

    const centres = centresOf(slots);
    const at = (x: number) => slots[nearestSlotIndex([x, anchor.center[1], anchor.center[2]], centres)];
    const samples = sweep(lo, hi, 0.005);
    const wrong = samples.filter((x) => at(x).bay !== nearerBay(x));
    expect(wrong.map((x) => `${x.toFixed(3)} -> bay ${at(x).bay}`)).toEqual([]);

    // The band where the two pitch boxes overlap (the old camera-decides hazard): the split must now
    // sit INSIDE it, at the midpoint — both halves of the band answering to their own bay.
    const boxHalf = (DIM.len40 + LAYOUT.bayGap) / 2;
    const band = samples.filter((x) => x >= hi - boxHalf && x <= lo + boxHalf);
    const bandBays = new Set(band.map((x) => at(x).bay));
    expect([...bandBays].sort((p, q) => p - q)).toEqual([worst.bay, worst.next].sort((p, q) => p - q));
    console.log(
      `nearest-slot: BBC min pitch ${worst.pitch.toFixed(3)} m (bays ${worst.bay}/${worst.next}) — ` +
        `${samples.length} samples, ${band.length} of them inside the ${(2 * boxHalf - worst.pitch).toFixed(3)} m overlap band, split at ${mid.toFixed(3)}`,
    );
  });
});

describe("the two 20' siblings of one 40' bay", () => {
  it.each(REAL)("never leaves a dead zone and splits at the siblings' midpoint ($name)", ({ vessel, half }) => {
    const slots = candidateSet(vessel, half);
    const centres = centresOf(slots);
    const pitch = DIM.len40 + LAYOUT.bayGap;
    const at = (x: number, y: number, z: number) => slots[nearestSlotIndex([x, y, z], centres)];

    // The middle 40' bay whose two halves are both real candidates on this vessel.
    const parent = vessel.bays.slice(1, -1).find((bay) => {
      const halves = new Set(slots.filter((s) => s.bay === bay - 1 || s.bay === bay + 1).map(cellKey));
      return [...halves].length > 0 && slots.some((s) => s.bay === bay - 1) && slots.some((s) => s.bay === bay + 1);
    })!;
    expect(parent).toBeTruthy();

    const fore = slots.find((s) => s.bay === parent - 1)!;
    const aft = slots.filter((s) => s.bay === parent + 1 && cellKey(s) === cellKey(fore))[0]
      ?? slots.find((s) => s.bay === parent + 1)!;
    const mid = (fore.center[0] + aft.center[0]) / 2;
    expect(Math.abs(fore.center[0] - aft.center[0])).toBeCloseTo(2 * HALF_BAY_OFFSET_M, 6);

    // Across the WHOLE pitch: a resolution must exist at every sample (zero dead zones).
    const samples = sweep(mid - pitch / 2, mid + pitch / 2, 0.004);
    const resolved = samples.map((x) => at(x, fore.center[1], fore.center[2]));
    expect(resolved.filter((s) => !s)).toEqual([]);

    // Between the two sibling centres the split is their midpoint — the pointer decides, never the
    // camera. The old 0.076 m gap the size-aware volume cost sits at that midpoint and must resolve.
    const span = samples.map((x, i) => ({ x, bay: resolved[i].bay })).filter((s) => Math.abs(s.x - mid) < HALF_BAY_OFFSET_M);
    const wrong = span.filter((s) => s.bay !== (s.x > mid ? fore.bay : aft.bay));
    expect(wrong.map((s) => s.x.toFixed(3))).toEqual([]);
    const gap = span.filter((s) => Math.abs(s.x - mid) <= (2 * HALF_BAY_OFFSET_M - DIM.len20) / 2);
    expect(gap.length).toBeGreaterThan(10);
    expect(new Set(gap.map((s) => s.bay)).size).toBe(2); // both sides of the deleted 0.076 m dead zone
    console.log(
      `nearest-slot: ${vessel.id} bay ${parent} halves ${parent - 1}/${parent + 1} — ` +
        `${samples.length} samples across the pitch, ${gap.length} inside the old ${(2 * HALF_BAY_OFFSET_M - DIM.len20).toFixed(3)} m gap, all resolved`,
    );
  });
});
