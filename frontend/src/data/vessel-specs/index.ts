/**
 * Registry of real vessel stowage specs (one JSON file per vessel in this folder). Adding a ship
 * with real planning data = add `<vessel-id>.stowage.json` here and register it below; the vessel,
 * its deck layout and its cargo rules are then built from that data (see vessel-from-spec.ts).
 * TODO(E4-06a): load from the backend's vessel CRUD endpoint instead of bundling JSON.
 */
import type { VesselStowageSpec } from "@/types/vessel-stowage-spec";
import { validateStowageSpec, type SpecIssue } from "@/engine/vessel-spec/validate-stowage-spec";
import bbcSaoPaulo from "./bbc-sao-paulo.stowage.json";

const RAW_SPECS: unknown[] = [bbcSaoPaulo];

export interface LoadedVesselSpec {
  spec: VesselStowageSpec;
  issues: SpecIssue[];
}

function load(raw: unknown): LoadedVesselSpec {
  const spec = raw as VesselStowageSpec; // JSON bypasses tsc — validateStowageSpec is the real shape check
  const issues = validateStowageSpec(spec);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) {
    throw new Error(`Invalid stowage spec "${spec?.vessel_id}":\n` + errors.map((e) => `  ${e.path}: ${e.message}`).join("\n"));
  }
  return { spec, issues };
}

const LOADED: Map<string, LoadedVesselSpec> = new Map(
  RAW_SPECS.map(load).map((l) => [l.spec.vessel_id, l])
);

export function getVesselSpec(vesselId: string): LoadedVesselSpec | undefined {
  return LOADED.get(vesselId);
}

export function listVesselSpecs(): LoadedVesselSpec[] {
  return [...LOADED.values()];
}
