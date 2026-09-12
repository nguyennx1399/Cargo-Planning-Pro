// Sanity checks for a VesselGeometry document (RT-2: no silently-broken vessel data).
// Pure, synchronous, no I/O. See plans/260911-1409-vessel-3d-model-pipeline/phase-01.
import type { ComponentSpec, HullOffsets, VesselGeometry } from "@/types/vessel-geometry";

export interface GeometryIssue {
  path: string;
  severity: "error" | "warning";
  message: string;
}

export function validateVesselGeometry(g: VesselGeometry): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  checkParticulars(g, issues);
  checkFrames(g, issues);
  checkOffsets(g, issues);
  checkComponents(g, issues);
  checkLivery(g, issues);
  return issues;
}

function checkParticulars(g: VesselGeometry, issues: GeometryIssue[]) {
  const p = g.particulars;
  if (p.lbp_m >= p.loa_m) {
    issues.push({ path: "particulars.lbp_m", severity: "error", message: "LBP must be less than LOA" });
  }
  if (p.aft_overhang_m + p.lbp_m > p.loa_m + 1e-6) {
    issues.push({
      path: "particulars.aft_overhang_m",
      severity: "error",
      message: "aft_overhang_m + lbp_m exceeds loa_m",
    });
  }
  if (p.design_draft_m >= p.depth_m) {
    issues.push({ path: "particulars.design_draft_m", severity: "error", message: "design draft must be less than depth" });
  }
  if (p.cb < 0.35 || p.cb > 0.9) {
    issues.push({ path: "particulars.cb", severity: "error", message: "Cb outside plausible range [0.35, 0.90]" });
  }
}

function checkFrames(g: VesselGeometry, issues: GeometryIssue[]) {
  if (g.frames.length === 0) {
    issues.push({ path: "frames", severity: "error", message: "frames must have at least one segment" });
    return;
  }
  if (g.frames[0].from_frame !== 0) {
    // Hard requirement, not a style nit: frameToX/xToFrame anchor ship-frame x=0 at
    // frames[0].from_frame. If that isn't 0, "frame 0 = AP" (the G1 single-coordinate-system
    // contract every consumer relies on) silently stops being true.
    issues.push({ path: "frames[0].from_frame", severity: "error", message: "frame 0 must be the AP (x=0); frames[0].from_frame must be 0" });
  }
  g.frames.forEach((seg, i) => {
    if (seg.to_frame <= seg.from_frame) {
      issues.push({ path: `frames[${i}]`, severity: "error", message: "to_frame must be greater than from_frame" });
    }
    if (seg.spacing_m <= 0) {
      issues.push({ path: `frames[${i}].spacing_m`, severity: "error", message: "spacing_m must be positive" });
    }
    const prev = g.frames[i - 1];
    if (prev && seg.from_frame !== prev.to_frame) {
      issues.push({ path: `frames[${i}].from_frame`, severity: "error", message: "frame segments must be contiguous" });
    }
  });
}

function checkOffsets(g: VesselGeometry, issues: GeometryIssue[]) {
  const offsets: HullOffsets | undefined = g.hull.offsets;
  if (!offsets) return;
  const { stations_x_m, waterlines_z_m, half_breadths_m } = offsets;
  if (!isStrictlyAscending(stations_x_m)) {
    issues.push({ path: "hull.offsets.stations_x_m", severity: "error", message: "stations must be strictly ascending" });
  }
  if (!isStrictlyAscending(waterlines_z_m)) {
    issues.push({ path: "hull.offsets.waterlines_z_m", severity: "error", message: "waterlines must be strictly ascending" });
  }
  if (half_breadths_m.length !== stations_x_m.length) {
    issues.push({
      path: "hull.offsets.half_breadths_m",
      severity: "error",
      message: `expected ${stations_x_m.length} station rows, got ${half_breadths_m.length}`,
    });
  }
  const halfBeam = g.particulars.beam_m / 2 + 0.05;
  half_breadths_m.forEach((row, si) => {
    if (row.length !== waterlines_z_m.length) {
      issues.push({
        path: `hull.offsets.half_breadths_m[${si}]`,
        severity: "error",
        message: `expected ${waterlines_z_m.length} values, got ${row.length}`,
      });
    }
    row.forEach((v, wi) => {
      if (v !== null && (v < 0 || v > halfBeam)) {
        issues.push({
          path: `hull.offsets.half_breadths_m[${si}][${wi}]`,
          severity: "error",
          message: `half-breadth ${v} outside [0, beam/2] (beam/2=${(halfBeam - 0.05).toFixed(3)})`,
        });
      }
    });
  });
}

const COMPONENT_Y_TOLERANCE_M = 0.1; // small allowance for pedestal/base points right at the shell

function checkComponents(g: VesselGeometry, issues: GeometryIssue[]) {
  const { aft_overhang_m, loa_m, beam_m } = g.particulars;
  const minX = -aft_overhang_m;
  const maxX = loa_m - aft_overhang_m;
  const halfBeam = beam_m / 2 + COMPONENT_Y_TOLERANCE_M;
  g.components.forEach((c, i) => {
    for (const x of componentXs(c)) {
      if (x < minX || x > maxX) {
        issues.push({
          path: `components[${i}]`,
          severity: "error",
          message: `${c.kind} x=${x} outside hull extent [${minX.toFixed(1)}, ${maxX.toFixed(1)}]`,
        });
      }
    }
    for (const y of componentYExtents(c)) {
      if (Math.abs(y) > halfBeam) {
        issues.push({
          path: `components[${i}]`,
          severity: "error",
          message: `${c.kind} y=${y} outside hull beam [-${halfBeam.toFixed(1)}, ${halfBeam.toFixed(1)}]`,
        });
      }
    }
  });
}

function componentXs(c: ComponentSpec): number[] {
  switch (c.kind) {
    case "superstructure":
      return [c.x_aft_m, c.x_fwd_m];
    case "funnel":
    case "mast":
    case "lifeboat":
      return [c.x_m];
    case "crane":
      return [c.pedestal[0]];
  }
}

/** Transverse extents to check against the hull beam. For a superstructure this is both
 * outboard edges (centre +/- half width), not just its centreline. */
function componentYExtents(c: ComponentSpec): number[] {
  switch (c.kind) {
    case "superstructure": {
      const center = c.y_center_m ?? 0;
      return [center - c.width_m / 2, center + c.width_m / 2];
    }
    case "funnel":
    case "mast":
    case "lifeboat":
      return [c.y_m];
    case "crane":
      return [c.pedestal[1]];
  }
}

function checkLivery(g: VesselGeometry, issues: GeometryIssue[]) {
  const { boot_top_low_z_m, boot_top_high_z_m } = g.livery;
  if (boot_top_low_z_m >= boot_top_high_z_m) {
    issues.push({ path: "livery.boot_top_low_z_m", severity: "error", message: "boot_top_low_z_m must be less than boot_top_high_z_m" });
  }
  if (boot_top_high_z_m > g.particulars.depth_m) {
    issues.push({ path: "livery.boot_top_high_z_m", severity: "error", message: "boot_top_high_z_m exceeds depth" });
  }
}

function isStrictlyAscending(xs: number[]): boolean {
  return xs.every((x, i) => i === 0 || x > xs[i - 1]);
}
