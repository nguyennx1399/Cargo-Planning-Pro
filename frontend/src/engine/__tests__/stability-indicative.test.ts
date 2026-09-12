import { describe, expect, it } from "vitest";
import { computeIndicativeStability, type WeightItem } from "../stability-indicative";
import { computeHydrostaticTable } from "../hull/hydrostatic-table-calculator";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { generateDemoCargo } from "@/data/demo-cargo-generator";
import { naiveFillPlan } from "../naive-fill-plan";
import { cargoWeightItem } from "@/lib/cargo-weight-item";
import { DEMO_LIGHTSHIP, DEMO_CONSTANT } from "@/data/demo-lightship";

// A small, hand-controlled hydrostatic table (not the real demo hull) for the unit-level sign
// and threshold tests below — isolates the stability MATH from the hull's own numbers.
// Range covers 5000-19500t so every test below (weight totals ~9000-9000+8000) actually lands
// inside the table instead of silently hitting out_of_range (which happened on the first pass
// here — toBeCloseTo(0) on a null list_deg coerced to 0 and masked it; toBeGreaterThan/LessThan
// correctly threw "received object" for the rest, which is what caught the bug).
const SIMPLE_TABLE = [
  { draft_m: 3, displacement_volume_m3: 4878, displacement_t: 5000, kb_m: 1.5, lcb_m: 80, waterplane_area_m2: 4200, lcf_m: 80, tpc_t_per_cm: 43, bmt_m: 8, kmt_m: 9.5, bml_m: 300, mtc_t_m_per_cm: 280, cb: 0.68, cm: 0.95, cwp: 0.85 },
  { draft_m: 8, displacement_volume_m3: 19024, displacement_t: 19500, kb_m: 4, waterplane_area_m2: 4400, lcb_m: 80, lcf_m: 80, tpc_t_per_cm: 45, bmt_m: 3.5, kmt_m: 7.5, bml_m: 300, mtc_t_m_per_cm: 320, cb: 0.68, cm: 0.95, cwp: 0.85 },
];
const LBP_M = 160;
const MAX_DRAFT_M = 13;

function weight(overrides: Partial<WeightItem> = {}): WeightItem {
  return { weight_t: 5000, lcg_m: 80, tcg_m: 0, kg_m: 5, ...overrides };
}

describe("computeIndicativeStability — sign and threshold behavior (controlled table)", () => {
  it("symmetric load (tcg=0) gives list = 0", () => {
    const result = computeIndicativeStability(weight({ weight_t: 5000 }), weight({ weight_t: 1000 }), [weight({ weight_t: 3000, tcg_m: 0 })], SIMPLE_TABLE, LBP_M, MAX_DRAFT_M);
    expect(result.status).toBe("ok"); // guards against a null list_deg silently passing toBeCloseTo(0) below
    expect(result.list_deg).toBeCloseTo(0, 6);
  });

  it("a starboard-heavy load (positive tcg) gives a positive (starboard) list", () => {
    const result = computeIndicativeStability(weight({ weight_t: 5000 }), weight({ weight_t: 1000 }), [weight({ weight_t: 3000, tcg_m: 8 })], SIMPLE_TABLE, LBP_M, MAX_DRAFT_M);
    expect(result.list_deg).toBeGreaterThan(0);
  });

  it("a port-heavy load (negative tcg) gives a negative (port) list", () => {
    const result = computeIndicativeStability(weight({ weight_t: 5000 }), weight({ weight_t: 1000 }), [weight({ weight_t: 3000, tcg_m: -8 })], SIMPLE_TABLE, LBP_M, MAX_DRAFT_M);
    expect(result.list_deg).toBeLessThan(0);
  });

  it("GM at or below 0.15 m -> critical, no angle shown", () => {
    // Total 9000t -> interpolated KMt ≈ 8.95; KG=8.9 gives GM ≈ 0.05, comfortably <= 0.15.
    const result = computeIndicativeStability(weight({ weight_t: 8000, kg_m: 8.9 }), weight({ weight_t: 1000, kg_m: 8.9 }), [], SIMPLE_TABLE, LBP_M, MAX_DRAFT_M);
    expect(result.status).toBe("critical");
    expect(result.list_deg).toBeNull();
    expect(result.trim_m).toBeNull();
  });

  it("displacement beyond the table's max row -> out_of_range, no numbers", () => {
    const result = computeIndicativeStability(weight({ weight_t: 50000 }), weight({ weight_t: 5000 }), [], SIMPLE_TABLE, LBP_M, MAX_DRAFT_M);
    expect(result.status).toBe("out_of_range");
    expect(result.gm_m).toBeNull();
    expect(result.draft_mean_m).toBeNull();
  });

  it("LCG forward of LCB gives a positive (by-the-head) trim", () => {
    const result = computeIndicativeStability(
      weight({ weight_t: 5000, lcg_m: 80 }),
      weight({ weight_t: 1000, lcg_m: 80 }),
      [weight({ weight_t: 3000, lcg_m: 120 })], // well forward of LCB=80
      SIMPLE_TABLE, LBP_M, MAX_DRAFT_M
    );
    expect(result.trim_m).toBeGreaterThan(0);
  });

  it("LCG aft of LCB gives a negative (by-the-stern) trim", () => {
    const result = computeIndicativeStability(
      weight({ weight_t: 5000, lcg_m: 80 }),
      weight({ weight_t: 1000, lcg_m: 80 }),
      [weight({ weight_t: 3000, lcg_m: 40 })], // well aft of LCB=80
      SIMPLE_TABLE, LBP_M, MAX_DRAFT_M
    );
    expect(result.trim_m).toBeLessThan(0);
  });

  // lcf_m is ship-frame FROM AP (like lcb_m), not from midship. This table sets lcf_m=70,
  // meaningfully off midship (=80), so a formula that mistakenly assumed a midship-referenced
  // LCF (a bug once introduced here — see stability-indicative.ts) produces a lopsided fwd/aft
  // split instead of splitting trim in proportion to F's actual distance from each end.
  const OFF_CENTER_LCF_TABLE = [
    { ...SIMPLE_TABLE[0], lcf_m: 70 },
    { ...SIMPLE_TABLE[1], lcf_m: 70 },
  ];

  it("draft_fwd/draft_aft split trim in proportion to F's AP-referenced distance from each end", () => {
    const result = computeIndicativeStability(
      weight({ weight_t: 5000, lcg_m: 80 }),
      weight({ weight_t: 1000, lcg_m: 80 }),
      [weight({ weight_t: 3000, lcg_m: 120 })], // forward of LCB=80 -> positive (by-the-head) trim
      OFF_CENTER_LCF_TABLE, LBP_M, MAX_DRAFT_M
    );
    // "warning" is expected here (this load trims past the 1.5m comfort threshold) — only
    // critical/out_of_range would mean draft_fwd_m/draft_aft_m weren't computed at all.
    expect(result.status).not.toBe("critical");
    expect(result.status).not.toBe("out_of_range");
    const trimM = result.trim_m!;
    expect(trimM).toBeGreaterThan(0);
    // F is 70 m from AP, so 90 m from FP (LBP=160). Trim splits by those distances.
    expect(result.draft_fwd_m!).toBeCloseTo(result.draft_mean_m! + (trimM * (LBP_M - 70)) / LBP_M, 6);
    expect(result.draft_aft_m!).toBeCloseTo(result.draft_mean_m! - (trimM * 70) / LBP_M, 6);
    // Sanity check against the old (buggy) midship-referenced formula: it would give a
    // near-fully-forward split since it mistakes lcf_m=70 for "10 m aft of midship" instead of
    // "70 m from AP, i.e. 10 m forward of midship" — the two disagree noticeably here.
    const buggyFwd = result.draft_mean_m! + (trimM * (LBP_M / 2 - 70)) / LBP_M;
    expect(result.draft_fwd_m!).not.toBeCloseTo(buggyFwd, 3);
  });
});

describe("computeIndicativeStability — demo hull, empty and fully loaded", () => {
  const geometry = buildDemoHorizonGeometry();
  const offsets = geometry.hull.offsets!;
  const drafts = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5); // 3..13m, matches MAX_DRAFT below
  const table = computeHydrostaticTable(offsets, geometry.particulars, { drafts });
  const lbpM = geometry.particulars.lbp_m;
  const maxDraftM = geometry.particulars.depth_m - 1;

  it("empty ship (lightship + constant only) is not critical or out_of_range, GM is positive and not absurd", () => {
    const result = computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, [], table, lbpM, maxDraftM);
    expect(result.status).not.toBe("out_of_range");
    expect(result.status).not.toBe("critical");
    expect(result.gm_m).not.toBeNull();
    expect(result.gm_m!).toBeGreaterThan(0.5);
    expect(result.gm_m!).toBeLessThan(15); // sanity ceiling, not a real naval-architecture bound
  });

  it("fully loaded (naiveFillPlan demo cargo) is not critical or out_of_range, GM stays positive", () => {
    const vessel = buildDemoVessel();
    const containers = generateDemoCargo(42);
    const { placements } = naiveFillPlan(vessel, containers);
    const byId = new Map(containers.map((c) => [c.id, c]));
    const cargo = placements.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));

    const result = computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, cargo, table, lbpM, maxDraftM);
    expect(result.status).not.toBe("out_of_range");
    expect(result.status).not.toBe("critical");
    expect(result.gm_m).not.toBeNull();
    expect(result.gm_m!).toBeGreaterThan(0.15);
    // The naive fill algorithm doesn't intentionally balance port/starboard, so some list is
    // expected — just confirm it stays within the small-angle model's error threshold.
    expect(Math.abs(result.list_deg!)).toBeLessThan(5);
  });

  it("loaded draft is deeper than empty draft (the ship visibly sinks when cargo is added)", () => {
    const vessel = buildDemoVessel();
    const containers = generateDemoCargo(42);
    const { placements } = naiveFillPlan(vessel, containers);
    const byId = new Map(containers.map((c) => [c.id, c]));
    const cargo = placements.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));

    const empty = computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, [], table, lbpM, maxDraftM);
    const loaded = computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, cargo, table, lbpM, maxDraftM);
    expect(loaded.draft_mean_m!).toBeGreaterThan(empty.draft_mean_m!);
  });
});
