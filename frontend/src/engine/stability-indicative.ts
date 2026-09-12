// Indicative (DEMO DATA, not booklet-grade) stability from a weight distribution + a computed
// hydrostatic table. Safety guards come before numbers (RT-7): GM at/below the critical
// threshold hides the angle rather than showing a wrong one; displacement outside the table's
// range is an error, not a silent extrapolation.
import type { HydrostaticRow } from "./hull/hydrostatic-table-calculator";
import { interpolateHydrostatics } from "./hydrostatic-table-lookup";

export interface WeightItem {
  weight_t: number;
  lcg_m: number; // ship-frame x, from AP
  tcg_m: number; // ship-frame y, +starboard
  kg_m: number; // ship-frame z, from baseline
}

export type StabilityStatus = "ok" | "warning" | "critical" | "out_of_range";

export interface StabilityResult {
  status: StabilityStatus;
  displacement_t: number;
  kg_m: number;
  lcg_m: number;
  tcg_m: number;
  draft_mean_m: number | null;
  draft_fwd_m: number | null;
  draft_aft_m: number | null;
  gm_m: number | null;
  list_deg: number | null; // + = starboard
  trim_m: number | null; // + = by the head
  messages: string[];
}

const GM_CRITICAL_M = 0.15;
const GM_WARNING_M = 0.5;
const LIST_ERROR_DEG = 5;
const LIST_WARNING_DEG = 2;
const TRIM_WARNING_M = 1.5;

export function computeIndicativeStability(
  lightship: WeightItem,
  constant: WeightItem,
  cargo: WeightItem[],
  hydrostatics: HydrostaticRow[],
  lbpM: number,
  maxDraftM: number
): StabilityResult {
  const items = [lightship, constant, ...cargo];
  const displacement_t = items.reduce((sum, i) => sum + i.weight_t, 0);
  const weightedAvg = (get: (i: WeightItem) => number) => items.reduce((sum, i) => sum + i.weight_t * get(i), 0) / displacement_t;
  const lcg_m = weightedAvg((i) => i.lcg_m);
  const tcg_m = weightedAvg((i) => i.tcg_m);
  const kg_m = weightedAvg((i) => i.kg_m);

  const row = interpolateHydrostatics(hydrostatics, displacement_t);
  if (!row) {
    return {
      status: "out_of_range",
      displacement_t,
      kg_m,
      lcg_m,
      tcg_m,
      draft_mean_m: null,
      draft_fwd_m: null,
      draft_aft_m: null,
      gm_m: null,
      list_deg: null,
      trim_m: null,
      messages: [`Displacement ${displacement_t.toFixed(0)} t is outside the computed hydrostatic table range`],
    };
  }

  const gm_m = row.kmt_m - kg_m;
  if (gm_m <= GM_CRITICAL_M) {
    return {
      status: "critical",
      displacement_t,
      kg_m,
      lcg_m,
      tcg_m,
      draft_mean_m: row.draft_m,
      draft_fwd_m: null,
      draft_aft_m: null,
      gm_m,
      list_deg: null,
      trim_m: null,
      messages: ["GM at or below 0.15 m — unstable (loll risk); angle not shown"],
    };
  }

  const list_deg = (Math.atan(tcg_m / gm_m) * 180) / Math.PI;
  // lcg_m/row.lcb_m are both ship-frame-from-AP, so the reference frame cancels in this
  // difference — trim_m is correct regardless of what frame LCG/LCB are expressed in.
  const trim_m = (displacement_t * (lcg_m - row.lcb_m)) / (100 * row.mtc_t_m_per_cm);
  // The ship pivots about F (center of flotation) when trimming. row.lcf_m is ship-frame FROM
  // AP (like everything else here — NOT from midship, unlike the hand-typed table the original
  // P1-demo spec assumed). Distance from F to FP = lbpM - row.lcf_m; distance from F to AP =
  // row.lcf_m. Bug found in code review: an earlier version used the midship-referenced formula
  // `(lbpM/2 - row.lcf_m)` directly on this AP-referenced value, which is only correct when F
  // happens to sit exactly at midship — for the demo hull (LCF ~79m from AP, i.e. close to but
  // not at midship=80m) it produced a wildly lopsided ~99%/1% fwd/aft split instead of ~50/50.
  const draft_fwd_m = row.draft_m + (trim_m * (lbpM - row.lcf_m)) / lbpM;
  const draft_aft_m = row.draft_m - (trim_m * row.lcf_m) / lbpM;

  const messages: string[] = [];
  let status: StabilityStatus = "ok";
  if (gm_m < GM_WARNING_M) {
    status = "warning";
    messages.push("GM below 0.5 m — reduced stability margin");
  }
  if (Math.abs(list_deg) > LIST_WARNING_DEG) {
    status = "warning";
    messages.push(`List ${list_deg.toFixed(1)}° exceeds the 2° comfort threshold`);
  }
  if (Math.abs(trim_m) > TRIM_WARNING_M) {
    status = "warning";
    messages.push(`Trim ${trim_m.toFixed(2)} m exceeds the 1.5 m comfort threshold`);
  }
  if (Math.abs(list_deg) > LIST_ERROR_DEG) {
    status = "critical";
    messages.push(`List ${list_deg.toFixed(1)}° exceeds 5° — beyond the small-angle model`);
  }
  if (Math.max(draft_fwd_m, draft_aft_m) > maxDraftM) {
    status = "critical";
    messages.push(`Draft exceeds ${maxDraftM.toFixed(1)} m freeboard limit`);
  }

  return { status, displacement_t, kg_m, lcg_m, tcg_m, draft_mean_m: row.draft_m, draft_fwd_m, draft_aft_m, gm_m, list_deg, trim_m, messages };
}
