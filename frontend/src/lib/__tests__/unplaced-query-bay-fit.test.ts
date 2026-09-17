/**
 * The Unplaced list's "Fits bay NN" claim (P2), which is a SIZE/PARITY claim by decision — the exact
 * `canPlaceContainer` variant measured ≈11.2k predicate calls ≈ 39 ms per recompute, and it
 * recomputes after every drop (plan.md #2). An approximate claim is only safe if it can never be
 * WRONG IN THE EXPENSIVE DIRECTION: it may over-approximate (say "fits" where nothing is free), but
 * it must never hide a container the engine would accept in that bay. That is the anti-divergence
 * property below, asserted against `validSlotsFor` itself.
 *
 * The other half of the suite is the trap the phase file names (insight 3): "in bay 22" cannot mean
 * `slot.bay === 22`, because a 20' box lives in slot 21 or 23 and every bay a planner can select is
 * a 40' bay. A naive reading would hide the entire 20' fleet whenever a bay is picked.
 *
 * `slotInBay`'s own unit cases live in `drop-verdict.test.ts`, next to the function.
 */
import { describe, expect, it } from "vitest";
import type { Container } from "@/types/domain";
import type { SlotDef } from "@/engine/stowage-model";
import { buildStowageModel } from "@/engine/stowage-model";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { sizeFitsBay } from "@/engine/placement-checks";
import { slotInBay } from "@/lib/drop-verdict";
import { queryUnplacedRows } from "@/lib/unplaced-query";
import { DEMO_VESSEL, REAL, baySlotsOf, ctxOf, mk, q } from "./unplaced-query-fixtures";

describe("the bay filter's size/parity claim", () => {
  it.each(REAL)("admits every size, for every bay, on %s — the halves are what make it truthful", (name, vessel, plan) => {
    const fleet = plan.containers;
    for (const bay of vessel.bays) {
      // `baySlotsOf` is the halves reading: `slotInBay` includes the bay's own 40' cell AND its 20'
      // halves (bay 22 → slots in bays 22, 21, 23). The claim's subject IS this slot list.
      const ctx = { ...ctxOf(plan), baySlots: baySlotsOf(vessel, bay) };
      const result = queryUnplacedRows(fleet, q({ fitsBay: true }), ctx);
      expect(result.shown, `${name} bay ${bay}: a 40' bay holds its 40' cell AND its 20' halves`).toBe(fleet.length);
      expect(result.ordered.every((r) => r.fitsBay)).toBe(true);
      // Un-ticking exposes the same claim per row without hiding anything.
      expect(queryUnplacedRows(fleet, q(), ctx).shown).toBe(fleet.length);
    }
    // The naive reading (a slot is in bay 22 iff slot.bay === 22) calls a 40' bay all-40' and hides
    // the whole 20' fleet — the exact opposite of the truth (insight 3). SAME filter function, naive
    // slot set: 414 of the demo's 886 survive instead of 886.
    const naiveBay = vessel.bays[Math.floor(vessel.bays.length / 2)];
    const naiveCtx = { ...ctxOf(plan), baySlots: buildStowageModel(vessel).slots.filter((s) => s.bay === naiveBay) };
    const naiveShown = queryUnplacedRows(fleet, q({ fitsBay: true }), naiveCtx).shown;
    expect(naiveShown).toBe(fleet.filter((c) => c.size !== "20").length);
    expect(fleet.length - naiveShown, `${name}: the 20' fleet the naive reading would hide`).toBeGreaterThan(0);
  });

  it("does hide a size whose parity the bay's slots really lack (the filter is not vacuous)", () => {
    // Bay 22's own 40' slots only — no halves, as if the model had none.
    const evenOnly: SlotDef[] = buildStowageModel(DEMO_VESSEL).slots.filter((s) => s.bay === 22);
    const twenty = mk("TEST0000001", { size: "20" });
    const forty = mk("TEST0000002", { size: "40" });
    const ctx = { podSequence: {}, baySlots: evenOnly };
    expect(queryUnplacedRows([twenty, forty], q({ fitsBay: true }), ctx).shown).toBe(1);
    // Per-row badge, ticked or not: the claim lives on the row, not implied by the filter.
    const badged = queryUnplacedRows([twenty, forty], q(), ctx).ordered;
    expect(badged.map((r) => r.fitsBay)).toEqual([false, true]);
  });

  it.each(REAL)("cannot hide a container the engine accepts in that bay on %s (anti-divergence)", (name, vessel, plan) => {
    const candidates = [
      plan.containers.find((c) => c.size === "40"),
      plan.containers.find((c) => c.size === "20"),
      plan.containers.find((c) => c.type === "REEFER"),
    ].filter((c): c is Container => c !== undefined);
    expect(candidates.length, `${name}: candidates to check`).toBeGreaterThanOrEqual(2);

    let slotPairs = 0;
    let bayPairs = 0;
    for (const c of candidates) {
      const valid = validSlotsFor(vessel, plan, c);
      expect(valid.length, `${name}: ${c.id} has reachable slots`).toBeGreaterThan(0);
      const holderBays = new Set<number>();
      for (const slot of valid) {
        // The assumption the whole filter rests on, asserted HERE so a change to the predicate breaks
        // this suite rather than silently making the filter lie: `validSlotsFor` only accepts a slot
        // that passes the engine's own size/parity rule, and that rule is exactly what `bayFits` reads.
        expect(sizeFitsBay(c, slot.bay), `${name}: ${c.id} accepted in ${slot.key}`).toBe(true);
        slotPairs++;
        for (const bay of vessel.bays) if (slotInBay(slot, bay, vessel)) holderBays.add(bay);
      }
      // ... and so, for every bay that really holds one of those slots, the ticked filter keeps it.
      for (const bay of holderBays) {
        const ctx = { ...ctxOf(plan), baySlots: baySlotsOf(vessel, bay) };
        expect(queryUnplacedRows([c], q({ fitsBay: true }), ctx).shown, `${name}: ${c.id} from bay ${bay}`).toBe(1);
        bayPairs++;
      }
    }
    // Non-vacuous: the sweep really did compare this many (accepted slot, vessel bay) pairs — per
    // vessel today 247 slots / 14 bays (demo) and 223 / 16 (BBC), so a floor well under that catches a
    // sweep that silently stopped finding slots without pinning the count to the cargo.
    expect(slotPairs).toBeGreaterThan(150);
    expect(bayPairs).toBeGreaterThan(10);
  });
});
