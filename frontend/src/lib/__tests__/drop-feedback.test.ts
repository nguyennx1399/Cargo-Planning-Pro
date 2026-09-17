/**
 * drop-feedback — the one wording every drop surface renders (P1/D4). The load-bearing assertions are
 * about AGREEMENT, on the real vessels' own plans: a warning must never be worded as a refusal, the
 * reason must be the predicate's message verbatim, and the hover verdict and the committed outcome
 * must quote the SAME reason for the same slot — that identity is what lets the at-cursor chip change
 * from "hovering" to "committed" without the sentence flickering to different words.
 */
import { describe, expect, it } from "vitest";
import {
  dropCursorClass,
  dropOutcomeOf,
  dropOutcomeText,
  dropVerdictText,
  quotedReason,
  type DropCursorState,
} from "../drop-feedback";
import { verdictForSlot } from "../drop-verdict";
import { canPlaceContainer } from "@/engine/placement/can-place-container";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { buildStowageModel } from "@/engine/stowage-model";
import { slotCode } from "@/engine/slot-helpers";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import type { Reason } from "@/engine/placement/reason";
import type { Slot, StowagePlan, Vessel } from "@/types/domain";

const bbc = buildBbcSaoPauloVesselAndCargo();
const demo = buildDemoVesselAndCargo();
const demoPlan = buildLoadedDemoPlan(demo.vessel, demo.containers);
const forty = (plan: StowagePlan) => plan.containers.find((c) => c.size === "40")!;

const REAL: [string, Vessel, StowagePlan][] = [
  ["MV Demo Horizon", demo.vessel, demoPlan],
  ["BBC SAO PAULO", bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers)],
];

describe("dropVerdictText", () => {
  it.each(REAL)("words every offered slot of the real plan once (%s)", (_name, vessel, plan) => {
    const container = forty(plan);
    const valid = validSlotsFor(vessel, plan, container);
    expect(valid.length).toBeGreaterThan(0);

    for (const slot of valid) {
      const verdict = verdictForSlot(vessel, plan, container, slot);
      const text = dropVerdictText(slot, verdict, container.id);
      expect(text.headline).toBe(`Slot ${slotCode(slot)} — placing ${container.id}`);
      // `slotCode` zero-pads to six digits; a hand-built `${bay}${row}${tier}` would render these real
      // slots as four or five ("22686") and disagree with the Sidebar.
      expect(text.headline).toMatch(/^Slot \d{6} — placing /);
      if (verdict.verdict === "warning") {
        expect(text.tone).toBe("warn"); // amber: recorded, not fatal (M3)
        expect(text.detail).toBe(`Recorded, not refused — the checks below will list it: ${verdict.reason!.message}`);
        expect(text.detail).not.toContain("Refused");
      } else {
        expect(text.tone).toBe("ok");
        expect(text.detail).toBe("Clean drop — no rule is triggered.");
      }
    }
  });

  it.each(REAL)("words a refusal with the blocking reason, never with a warning (%s)", (_name, vessel, plan) => {
    const container = forty(plan);
    // A 40' box in an odd (20') bay: `size_fits_bay` blocks it, exactly as the report does.
    const wrongBay: Slot = { bay: vessel.bays[0] + 1, row: vessel.rows[0], tier: 82 };
    const verdict = verdictForSlot(vessel, plan, container, wrongBay);

    expect(verdict.verdict).toBe("invalid");
    expect(verdict.reason?.severity).toBe("error");
    expect(dropVerdictText(wrongBay, verdict, container.id).detail).toBe(`Refused: ${verdict.reason!.message}`);
  });

  it("finds a real recorded-not-fatal slot on the demo plan and words it amber", () => {
    const container = forty(demoPlan);
    const recorded = validSlotsFor(demo.vessel, demoPlan, container)
      .map((slot) => [slot, verdictForSlot(demo.vessel, demoPlan, container, slot)] as const)
      .filter(([, verdict]) => verdict.verdict === "warning");
    expect(recorded.length).toBeGreaterThan(0); // the overstow slots the browser script's step 20 uses

    for (const [slot, verdict] of recorded) {
      const text = dropVerdictText(slot, verdict, container.id);
      expect(text.tone).toBe("warn");
      expect(text.detail).toBe(`Recorded, not refused — the checks below will list it: ${verdict.reason!.message}`);
    }
  });
});

describe("the committed outcome", () => {
  it.each(REAL)("quotes the same reason as the hover verdict for the same slot (%s)", (_name, vessel, plan) => {
    const container = forty(plan);
    const slot: Slot = { bay: vessel.bays[0] + 1, row: vessel.rows[0], tier: 82 };
    const result = canPlaceContainer(buildStowageModel(vessel), plan, container, slot, vessel);
    const outcome = dropOutcomeOf(result, slot, "scene")!;

    expect(outcome.ok).toBe(false);
    // The hand-over: the chip's hover text and its post-click text must name the same reason.
    expect(outcome.message).toBe(verdictForSlot(vessel, plan, container, slot).reason!.message);
    expect(dropOutcomeText(outcome).detail).toBe(`Not placed — ${outcome.message}`);
    expect(dropOutcomeText(outcome).tone).toBe("error");
  });

  it("never words an applied drop as a refusal, and records the origin", () => {
    const slot: Slot = { bay: 2, row: 2, tier: 82 };
    const recorded = dropOutcomeOf({ ok: true, reasons: [{ rule: "overstow", message: "m", severity: "warning" }] }, slot, "bayplan")!;
    expect(recorded).toEqual({ slot, message: "m", ok: true, origin: "bayplan" });
    expect(dropOutcomeText(recorded)).toEqual({
      tone: "warn",
      headline: null,
      detail: "Placed. Recorded, not blocked — the checks below will list it: m",
    });
    // A clean accept and a nothing-to-commit release record nothing at all.
    expect(dropOutcomeOf({ ok: true, reasons: [] }, slot, "scene")).toBeNull();
  });

  it("quotes the first BLOCKING reason of a refusal, not a warning listed before it", () => {
    const warning: Reason = { rule: "overstow", message: "overstow", severity: "warning" };
    const blocking: Reason = { rule: "breakbulk_overlaps_container", message: "overlap", severity: "error" };
    // `canPlaceContainer` really can hand back this order: `overstow` is pushed before the breakbulk
    // overlap check, so a refusal must not be worded with the warning (D1).
    expect(quotedReason({ ok: false, reasons: [warning, blocking] })?.message).toBe("overlap");
    expect(quotedReason({ ok: true, reasons: [warning] })?.message).toBe("overstow");
    expect(quotedReason({ ok: true, reasons: [] })).toBeNull();
  });

  it("keeps the hover memo warm for the readers added by P1 (review M4)", () => {
    const container = forty(demoPlan);
    const slot = validSlotsFor(demo.vessel, demoPlan, container)[0];
    const first = verdictForSlot(demo.vessel, demoPlan, container, slot);
    // Same object identity on the second call: the chart, the cursor hook, the inspector and the ghost
    // all pass these same arguments, so they cost ONE predicate call per pointer move between them.
    expect(verdictForSlot(demo.vessel, demoPlan, container, slot)).toBe(first);
  });
});

describe("dropCursorClass", () => {
  it("maps the gesture state to the cursor, first match winning", () => {
    const idle: DropCursorState = { dragging: false, active: false, verdict: null, overContainer: false };
    expect(dropCursorClass(idle)).toBe("");
    expect(dropCursorClass({ ...idle, overContainer: true })).toBe("cursor-grab");
    expect(dropCursorClass({ ...idle, active: true, verdict: "valid" })).toBe("cursor-pointer");
    expect(dropCursorClass({ ...idle, active: true, verdict: "warning" })).toBe("cursor-pointer");
    expect(dropCursorClass({ ...idle, active: true, verdict: "invalid" })).toBe("cursor-not-allowed");
    expect(dropCursorClass({ ...idle, active: true })).toBe("cursor-crosshair");
    // A box in hand outranks a container under the cursor; a drag outranks every verdict.
    expect(dropCursorClass({ ...idle, active: true, overContainer: true })).toBe("cursor-crosshair");
    expect(dropCursorClass({ ...idle, dragging: true, active: true, verdict: "invalid" })).toBe("cursor-grabbing");
    expect(dropCursorClass({ ...idle, dragging: true, overContainer: true })).toBe("cursor-grabbing");
  });
});
