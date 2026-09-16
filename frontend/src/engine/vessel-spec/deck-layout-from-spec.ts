/**
 * VesselStowageSpec (real spec data, AP-referenced) -> the breakbulk stowage areas the packer,
 * validator and renderer consume (BreakbulkDeckLayout for the weather deck, BreakbulkHoldArea[] under
 * deck), in BreakbulkPlacement.x_m's length_m/2-symmetric convention. This is the ONLY place that
 * coordinate conversion happens for spec-driven vessels — it uses the spec's own LOA/LBP, never the
 * 3D model.
 *
 * The packer works on one rectangle per area. So within each group of spaces that share a level,
 * hold and surface height, this picks the contiguous run whose common-width envelope (run length ×
 * narrowest width in the run) is largest — e.g. on BBC SAO PAULO the main hatch covers (19.7 m)
 * beat a run that includes the 9 m-wide Hold 1 cover, and Hold 2's tank top drops its 12.9 m-wide
 * aft recess zone. Every space not used is reported with the reason, so nothing is silently dropped.
 * Tweendeck pontoons with adjustable levels are not packed yet: the tank top below is planned with
 * the pontoons stowed ashore (the sheet's own capacity assumption).
 */
import type { BreakbulkDeckLayout, BreakbulkHoldArea } from "@/types/domain";
import type { CargoSpace, CargoSpaceLevel, VesselStowageSpec } from "@/types/vessel-stowage-spec";
import { missingPlanningFields } from "./validate-stowage-spec";

export interface DeckLayoutFromSpec {
  layout: BreakbulkDeckLayout | null;
  used_space_ids: string[];
  skipped: { id: string; reason: string }[];
}

export interface HoldAreasFromSpec {
  areas: BreakbulkHoldArea[];
  used_space_ids: string[];
  skipped: { id: string; reason: string }[];
}

/** Longitudinal gap (m) still treated as contiguous (hatch-cover joints, coaming webs). */
const CONTIGUITY_TOLERANCE_M = 0.5;

/** AP-referenced x -> BreakbulkPlacement.x_m (scene x = x - lbp/2, as GltfHull/shipToScene render it). */
export function apXToPlacementX(spec: VesselStowageSpec, xFromAp: number): number {
  return xFromAp - spec.particulars.lbp_m / 2 + spec.particulars.loa_m / 2;
}

type CompleteSpace = CargoSpace & {
  x_aft_m: number;
  x_fwd_m: number;
  width_m: number;
  surface_above_baseline_m: number;
  max_load_t_per_m2: number;
};

type Skipped = { id: string; reason: string }[];

/** Spaces of the given levels that are complete enough to plan on; the rest go to `skipped`. */
function plannableSpaces(spec: VesselStowageSpec, levels: CargoSpaceLevel[], skipped: Skipped): CompleteSpace[] {
  const out: CompleteSpace[] = [];
  for (const s of spec.cargo_spaces) {
    if (!levels.includes(s.level)) continue;
    const missing = missingPlanningFields(s);
    if (missing.length) {
      skipped.push({ id: s.id, reason: `missing ${missing.join(", ")}` });
      continue;
    }
    if (typeof s.surface_above_baseline_m !== "number") {
      skipped.push({
        id: s.id,
        reason: s.adjustable_levels?.length
          ? "adjustable pontoon levels aren't planned yet — the space below is planned with pontoons ashore"
          : "needs a fixed surface_above_baseline_m",
      });
      continue;
    }
    if ((s.center_z_m ?? 0) !== 0) {
      skipped.push({ id: s.id, reason: "off-centreline spaces are not supported by the single-envelope packer yet" });
      continue;
    }
    out.push(s as CompleteSpace);
  }
  return out;
}

/** Largest contiguous common-width run of `candidates`, as a BreakbulkDeckLayout; unused ones go to `skipped`. */
function bestEnvelope(spec: VesselStowageSpec, candidates: CompleteSpace[], level: CargoSpaceLevel, skipped: Skipped) {
  const sorted = [...candidates].sort((a, b) => a.x_aft_m - b.x_aft_m);
  let best: { from: number; to: number; area: number } | null = null;
  for (let i = 0; i < sorted.length; i++) {
    let minWidth = Infinity;
    for (let j = i; j < sorted.length; j++) {
      if (j > i && sorted[j].x_aft_m - sorted[j - 1].x_fwd_m > CONTIGUITY_TOLERANCE_M) break;
      minWidth = Math.min(minWidth, sorted[j].width_m);
      const area = (sorted[j].x_fwd_m - sorted[i].x_aft_m) * minWidth;
      if (!best || area > best.area + 1e-9) best = { from: i, to: j, area };
    }
  }
  if (!best) return null;

  const run = sorted.slice(best.from, best.to + 1);
  for (const s of sorted) {
    if (!run.includes(s)) skipped.push({ id: s.id, reason: "outside the largest contiguous envelope for its level" });
  }

  const halfWidth = Math.min(...run.map((s) => s.width_m)) / 2;
  // Conservative across the run: cargo rests on the HIGHEST surface it may span, its top must stay
  // under the LOWEST overhead limit (surface + clear height) of any space, and the LOWEST rating applies.
  const surface = Math.max(...run.map((s) => s.surface_above_baseline_m));
  const ceilings = run
    .filter((s) => typeof s.clear_height_m === "number")
    .map((s) => s.surface_above_baseline_m + (s.clear_height_m as number));
  const clearAbove = ceilings.length ? Math.min(...ceilings) - surface : undefined;

  const layout: BreakbulkDeckLayout = {
    area: {
      xMin: apXToPlacementX(spec, run[0].x_aft_m),
      xMax: apXToPlacementX(spec, run[run.length - 1].x_fwd_m),
      zMin: -halfWidth,
      zMax: halfWidth,
    },
    keep_out: spec.obstructions
      .filter((o) => o.levels.includes(level))
      .map((o) => ({
        id: o.id,
        label: o.label,
        xMin: apXToPlacementX(spec, o.x_aft_m),
        xMax: apXToPlacementX(spec, o.x_fwd_m),
        zMin: o.z_min_m,
        zMax: o.z_max_m,
      })),
    cargo_base_height_m: surface - spec.particulars.depth_m,
    max_cargo_height_m: clearAbove,
    deck_load_t_per_m2: Math.min(...run.map((s) => s.max_load_t_per_m2)),
  };
  return { layout, run };
}

export function deckLayoutFromSpec(spec: VesselStowageSpec): DeckLayoutFromSpec {
  const skipped: Skipped = [];
  for (const s of spec.cargo_spaces) {
    if (s.level !== "weather_deck") skipped.push({ id: s.id, reason: `${s.level} spaces are planned as hold areas, not on the weather deck` });
  }
  const result = bestEnvelope(spec, plannableSpaces(spec, ["weather_deck"], skipped), "weather_deck", skipped);
  if (!result) return { layout: null, used_space_ids: [], skipped };
  return { layout: result.layout, used_space_ids: result.run.map((s) => s.id), skipped };
}

const LEVEL_NAME: Record<"tweendeck" | "tank_top", string> = { tweendeck: "tweendeck level", tank_top: "tank top" };

/**
 * Under-deck stowage areas: one per (level, hold, surface height) group — e.g. BBC SAO PAULO gets
 * "Hold 2 tank top", "Hold 2 aft section at main-deck level" and "Hold 1 tank top". Ordered
 * largest first, which is the order the packer spills into them.
 */
export function holdAreasFromSpec(spec: VesselStowageSpec): HoldAreasFromSpec {
  const skipped: Skipped = [];
  const used: string[] = [];
  const groups = new Map<string, CompleteSpace[]>();
  for (const s of plannableSpaces(spec, ["tweendeck", "tank_top"], skipped)) {
    const key = `${s.level}|${s.hold ?? ""}|${s.surface_above_baseline_m}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const areas: (BreakbulkHoldArea & { size: number })[] = [];
  for (const spaces of groups.values()) {
    const level = spaces[0].level as "tweendeck" | "tank_top";
    const hold = spaces[0].hold;
    const result = bestEnvelope(spec, spaces, level, skipped);
    if (!result) continue;
    used.push(...result.run.map((s) => s.id));
    const a = result.layout.area;
    const label =
      result.run.length === 1
        ? result.run[0].label
        : `${hold ? `Hold ${hold} ` : ""}${LEVEL_NAME[level]}`;
    let id = result.run.length === 1 ? result.run[0].id : `${level}_hold${hold ?? ""}`;
    if (areas.some((x) => x.id === id)) id = `${id}_${areas.length + 1}`; // same level+hold at a second height
    areas.push({ ...result.layout, id, label, level, ...(hold ? { hold } : {}), size: (a.xMax - a.xMin) * (a.zMax - a.zMin) });
  }
  areas.sort((x, y) => y.size - x.size);
  return { areas: areas.map(({ size: _size, ...rest }) => rest), used_space_ids: used, skipped };
}
