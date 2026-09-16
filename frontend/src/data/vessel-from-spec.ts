/**
 * Builds the app's `Vessel` from a real VesselStowageSpec — generic for any vessel with a spec
 * file: name/IMO/LOA/beam from the spec particulars, the breakbulk deck layout from its cargo
 * spaces and obstructions (deckLayoutFromSpec), under-deck hold areas (holdAreasFromSpec), and —
 * when the spec has `containers.stowage` — the container bay/row/tier grid with each bay's real
 * position and resting surfaces. The 3D model (geometry_id) is optional and plays no part in where
 * cargo may go.
 */
import type { ContainerLayout, StackSpec, Vessel } from "@/types/domain";
import type { ContainerBayDeck, StackLevel, VesselStowageSpec } from "@/types/vessel-stowage-spec";
import { apXToPlacementX, deckLayoutFromSpec, holdAreasFromSpec } from "@/engine/vessel-spec/deck-layout-from-spec";

/** Default stack limit when the spec gives no stack weight for a level (generous, so it never binds silently). */
const FALLBACK_STACK_WEIGHT_T = 200;

interface ContainerGrid {
  bays: number[];
  rows: number[];
  stacks: StackSpec[];
  container_layout: ContainerLayout;
}

/** Container bays/rows/stacks + layout from `spec.containers.stowage`, or null when the spec has none. */
export function containerGridFromSpec(spec: VesselStowageSpec): ContainerGrid | null {
  const st = spec.containers?.stowage;
  if (!st || st.bays.length === 0) return null;
  const spaces = new Map(spec.cargo_spaces.map((s) => [s.id, s]));
  const stackWeight40 = (level: StackLevel) => spec.containers?.stack_weights.find((w) => w.level === level)?.t40 ?? FALLBACK_STACK_WEIGHT_T;

  const layout: ContainerLayout = { bay_center_x_m: {}, on_deck_base_y_m: {}, under_deck_base_y_m: {} };
  const stacks: StackSpec[] = [];
  // Aft-most bay first: the naive container fill takes stacks in this order, so a part load
  // occupies the aft bays and leaves the forward hatch covers/holds free for project cargo.
  const aftToFwd = [...st.bays].sort((a, b) => a.x_center_m - b.x_center_m);

  const addStacks = (bay: number, deck: "on" | "under", group: ContainerBayDeck) => {
    const space = spaces.get(group.space_id);
    if (!space || typeof space.surface_above_baseline_m !== "number") {
      throw new Error(`container stowage bay ${bay} (${deck} deck): space "${group.space_id}" is missing or has no fixed surface height`);
    }
    const baseY = space.surface_above_baseline_m - spec.particulars.depth_m;
    if (deck === "on") layout.on_deck_base_y_m[bay] = baseY;
    else layout.under_deck_base_y_m[bay] = baseY;
    const tiers = Array.from({ length: group.tiers }, (_, i) => (deck === "on" ? 82 : 2) + 2 * i);
    const reefer = st.reefer && st.reefer.deck === deck && st.reefer.bays.includes(bay) ? st.reefer.tiers.filter((t) => tiers.includes(t)) : [];
    for (const row of group.rows) {
      stacks.push({
        bay,
        row,
        deck,
        tiers,
        max_weight_t: stackWeight40(space.level),
        max_height_m: deck === "under" ? space.clear_height_m : null,
        reefer_tiers: reefer,
      });
    }
  };

  for (const b of aftToFwd) {
    layout.bay_center_x_m[b.bay] = apXToPlacementX(spec, b.x_center_m);
    if (b.under_deck) addStacks(b.bay, "under", b.under_deck);
    if (b.on_deck) addStacks(b.bay, "on", b.on_deck);
  }

  const rowsUsed = new Set(stacks.map((s) => s.row));
  const rows = [...new Set([...st.rows_on_deck, ...st.rows_under_deck])].filter((r) => rowsUsed.has(r));
  // Vessel.bays is listed bow -> stern (domain.ts convention).
  const bays = [...aftToFwd].reverse().map((b) => b.bay);
  return { bays, rows, stacks, container_layout: layout };
}

export function buildVesselFromSpec(spec: VesselStowageSpec, opts: { geometry_id?: string } = {}): Vessel {
  const { layout } = deckLayoutFromSpec(spec);
  const { areas: holds } = holdAreasFromSpec(spec);
  const grid = containerGridFromSpec(spec);
  return {
    id: spec.vessel_id,
    name: spec.name,
    imo: spec.imo,
    length_m: spec.particulars.loa_m,
    beam_m: spec.particulars.beam_m,
    bays: grid?.bays ?? [],
    rows: grid?.rows ?? [],
    stacks: grid?.stacks ?? [],
    ...(grid ? { container_layout: grid.container_layout } : {}),
    ...(opts.geometry_id ? { geometry_id: opts.geometry_id } : {}),
    ...(layout ? { breakbulk_deck: layout } : {}),
    ...(holds.length ? { breakbulk_holds: holds } : {}),
  };
}
