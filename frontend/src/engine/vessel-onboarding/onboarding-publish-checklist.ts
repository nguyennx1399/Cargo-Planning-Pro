// Aggregates every pre-publish check from phase-05's F8 checklist into one readiness verdict —
// residual, fairness, hull fit, and schema validation each already exist as their own module
// (phases 2 and 4); this just runs them together and decides pass/fail (DRY: no re-implemented
// checks, only orchestration).
import type { Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import { validateVesselGeometry, type GeometryIssue } from "@/engine/vessel-geometry/validate-vessel-geometry";
import { checkSlotsInsideHull, type HullFitIssue } from "@/engine/hull/slots-inside-hull-check";
import type { FairnessWarning } from "@/engine/hull/offsets-fairness-check";

/** F8's residual tolerance: 0.2% of LBP. */
const RESIDUAL_TOLERANCE_FRACTION_OF_LBP = 0.002;

export interface PublishChecklistResult {
  calibrationOk: boolean;
  calibrationResidualM: number;
  calibrationToleranceM: number;
  fairnessWarningCount: number;
  hullFitIssues: HullFitIssue[];
  geometryIssues: GeometryIssue[];
  readyToPublish: boolean;
}

export function checkOnboardingReadiness(
  geometry: VesselGeometry,
  vessel: Vessel,
  calibrationResidualM: number,
  fairnessWarnings: FairnessWarning[],
  bayXShipFrame: (bay: number) => number,
  rowYShipFrame: (row: number) => number
): PublishChecklistResult {
  const calibrationToleranceM = geometry.particulars.lbp_m * RESIDUAL_TOLERANCE_FRACTION_OF_LBP;
  const calibrationOk = calibrationResidualM <= calibrationToleranceM;
  const hullFitIssues = checkSlotsInsideHull(vessel, geometry, bayXShipFrame, rowYShipFrame);
  const geometryIssues = validateVesselGeometry(geometry);
  const geometryErrors = geometryIssues.filter((i) => i.severity === "error");

  return {
    calibrationOk,
    calibrationResidualM,
    calibrationToleranceM,
    fairnessWarningCount: fairnessWarnings.length,
    hullFitIssues,
    geometryIssues,
    readyToPublish: calibrationOk && hullFitIssues.length === 0 && geometryErrors.length === 0,
  };
}
