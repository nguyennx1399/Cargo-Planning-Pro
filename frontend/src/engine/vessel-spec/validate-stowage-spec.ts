/**
 * Validates a VesselStowageSpec loaded from JSON. Errors = the data is inconsistent and must not be
 * used for planning (e.g. a hatch wider than the ship). Warnings = the data is incomplete or
 * low-confidence — planning still works with whatever is complete, but the planner should know
 * which figures are estimates. Pure, framework-free; JSON imports bypass tsc, so this is also the
 * runtime shape check.
 */
import type { CargoSpace, Provenance, VesselStowageSpec } from "@/types/vessel-stowage-spec";

export interface SpecIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const LEVELS = new Set(["weather_deck", "tweendeck", "tank_top"]);
const CONFIDENCE = new Set(["A", "B", "C", "D"]);

/** Fields a space needs before the auto-stow planner can place cargo on it. */
export function missingPlanningFields(space: CargoSpace): string[] {
  const missing: string[] = [];
  if (!isNum(space.x_aft_m) || !isNum(space.x_fwd_m)) missing.push("x_aft_m/x_fwd_m");
  if (!isNum(space.width_m)) missing.push("width_m");
  if (!isNum(space.surface_above_baseline_m) && !(space.adjustable_levels?.length)) missing.push("surface_above_baseline_m");
  if (!isNum(space.max_load_t_per_m2)) missing.push("max_load_t_per_m2");
  return missing;
}

export function validateStowageSpec(spec: VesselStowageSpec): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const err = (path: string, message: string) => issues.push({ severity: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ severity: "warning", path, message });

  if (spec?.schema_version !== 1) {
    err("schema_version", `unsupported schema_version ${String(spec?.schema_version)}`);
    return issues;
  }
  if (!spec.vessel_id) err("vessel_id", "required");

  const sourceIds = new Set((spec.sources ?? []).map((s) => s.id));
  const checkProvenance = (path: string, p: Provenance | undefined) => {
    if (!p) return err(path, "provenance required");
    if (!sourceIds.has(p.source)) err(`${path}.source`, `unknown source "${p.source}"`);
    if (!CONFIDENCE.has(p.confidence)) err(`${path}.confidence`, `must be A/B/C/D`);
  };

  const p = spec.particulars;
  for (const k of ["loa_m", "lbp_m", "beam_m", "depth_m", "summer_draft_m"] as const) {
    if (!isNum(p?.[k]) || p[k] <= 0) err(`particulars.${k}`, "must be a positive number");
  }
  if (issues.some((i) => i.severity === "error")) return issues; // nothing below is checkable
  if (p.lbp_m > p.loa_m) err("particulars.lbp_m", "LBP cannot exceed LOA");
  if (p.summer_draft_m >= p.depth_m) err("particulars.summer_draft_m", "draft must be less than depth");
  checkProvenance("particulars_provenance", spec.particulars_provenance);

  const halfBeam = p.beam_m / 2;
  // With aft_end_to_ap_m the hull's extent on the AP axis is known exactly; otherwise allow the
  // whole LOA−LBP overhang at either end.
  const aftEnd = isNum(p.aft_end_to_ap_m) ? p.aft_end_to_ap_m : p.loa_m - p.lbp_m;
  const xMinHull = -aftEnd - 1e-6;
  const xMaxHull = (isNum(p.aft_end_to_ap_m) ? p.loa_m - p.aft_end_to_ap_m : p.loa_m) + 1e-6;
  if (isNum(p.aft_end_to_ap_m) && (p.aft_end_to_ap_m < 0 || p.aft_end_to_ap_m > p.loa_m - p.lbp_m + 1e-6))
    err("particulars.aft_end_to_ap_m", "must lie between 0 and LOA − LBP");
  const ids = new Set<string>();
  const uniqueId = (path: string, id: string) => {
    if (!id) return err(`${path}.id`, "required");
    if (ids.has(id)) err(`${path}.id`, `duplicate id "${id}"`);
    ids.add(id);
  };

  (spec.cargo_spaces ?? []).forEach((s, i) => {
    const path = `cargo_spaces[${i}](${s.id})`;
    uniqueId(path, s.id);
    if (!LEVELS.has(s.level)) err(`${path}.level`, `unknown level "${s.level}"`);
    checkProvenance(`${path}.provenance`, s.provenance);
    for (const [field, fp] of Object.entries(s.field_provenance ?? {})) checkProvenance(`${path}.field_provenance.${field}`, fp);

    if (isNum(s.x_aft_m) && isNum(s.x_fwd_m)) {
      if (s.x_fwd_m <= s.x_aft_m) err(path, "x_fwd_m must be forward of x_aft_m");
      if (s.x_aft_m < xMinHull || s.x_fwd_m > xMaxHull) err(path, "longitudinal extent lies outside the hull (LOA)");
    }
    if (isNum(s.width_m)) {
      const cz = s.center_z_m ?? 0;
      if (s.width_m <= 0) err(`${path}.width_m`, "must be positive");
      else if (Math.abs(cz) + s.width_m / 2 > halfBeam + 1e-6) err(`${path}.width_m`, `extends past the ${p.beam_m} m beam`);
    }
    if (isNum(s.surface_above_baseline_m) && (s.surface_above_baseline_m < 0 || s.surface_above_baseline_m > (p.side_shell_top_above_keel_m ?? p.depth_m) + 10))
      err(`${path}.surface_above_baseline_m`, "implausible height above baseline");
    if (s.level === "weather_deck" && isNum(s.surface_above_baseline_m) && s.surface_above_baseline_m < p.depth_m)
      err(`${path}.surface_above_baseline_m`, "weather-deck surface is below the main deck (depth)");
    if (isNum(s.clear_height_m) && s.clear_height_m <= 0) err(`${path}.clear_height_m`, "must be positive");
    if (isNum(s.max_load_t_per_m2) && s.max_load_t_per_m2 <= 0) err(`${path}.max_load_t_per_m2`, "must be positive");
    if (isNum(s.area_m2) && isNum(s.width_m) && isNum(s.x_aft_m) && isNum(s.x_fwd_m)) {
      const rect = s.width_m * (s.x_fwd_m - s.x_aft_m);
      if (Math.abs(rect - s.area_m2) / s.area_m2 > 0.25) warn(path, `stated area ${s.area_m2} m² differs from length × width ${rect.toFixed(0)} m² by >25%`);
    }

    (s.adjustable_levels ?? []).forEach((lv, j) => {
      if (!isNum(lv.surface_above_baseline_m) || !isNum(lv.clear_height_m) || lv.clear_height_m <= 0)
        err(`${path}.adjustable_levels[${j}]`, "needs surface_above_baseline_m and a positive clear_height_m");
    });

    const missing = missingPlanningFields(s);
    if (missing.length) warn(path, `not usable for auto-stow yet — missing ${missing.join(", ")}`);
    const lowConfidence = Object.entries(s.field_provenance ?? {})
      .filter(([, fp]) => fp.confidence === "C" || fp.confidence === "D")
      .map(([f]) => f);
    if (lowConfidence.length) warn(path, `estimated (C/D) values used for planning: ${lowConfidence.join(", ")}`);
  });

  (spec.obstructions ?? []).forEach((o, i) => {
    const path = `obstructions[${i}](${o.id})`;
    uniqueId(path, o.id);
    checkProvenance(`${path}.provenance`, o.provenance);
    if (!(isNum(o.x_aft_m) && isNum(o.x_fwd_m) && o.x_fwd_m > o.x_aft_m)) err(path, "needs x_aft_m < x_fwd_m");
    if (!(isNum(o.z_min_m) && isNum(o.z_max_m) && o.z_max_m > o.z_min_m)) err(path, "needs z_min_m < z_max_m");
    if (!Array.isArray(o.levels) || o.levels.length === 0 || o.levels.some((l) => !LEVELS.has(l))) err(`${path}.levels`, "needs at least one valid level");
    if (o.provenance?.confidence === "C" || o.provenance?.confidence === "D") warn(path, "position is an estimate (C/D)");
  });

  (spec.cranes ?? []).forEach((c, i) => {
    const path = `cranes[${i}](${c.id})`;
    uniqueId(path, c.id);
    checkProvenance(`${path}.provenance`, c.provenance);
    if (!isNum(c.swl_t) || c.swl_t <= 0) err(`${path}.swl_t`, "must be positive");
    (c.load_chart ?? []).forEach((lc, j) => {
      if (!(lc.swl_t > 0 && lc.radius_min_m >= 0 && lc.radius_max_m > lc.radius_min_m)) err(`${path}.load_chart[${j}]`, "needs swl_t > 0 and radius_min_m < radius_max_m");
      if (lc.swl_t > c.swl_t) err(`${path}.load_chart[${j}]`, "chart SWL exceeds the crane's SWL");
    });
    if (c.x_m === null || c.z_m === null) warn(path, "slewing centre position unknown — outreach checks unavailable");
  });

  return issues;
}
