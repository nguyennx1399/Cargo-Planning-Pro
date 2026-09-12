import { describe, expect, it } from "vitest";
import { buildHatchCoversMesh, buildLashingBridgesMesh } from "../hatch-and-lashing-geometry";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";

describe("buildHatchCoversMesh", () => {
  const vessel = buildDemoVessel();
  const geometry = buildDemoHorizonGeometry();

  it("produces one box per bay (12 triangles/box -> index length = bays * 36)", () => {
    const mesh = buildHatchCoversMesh(vessel, geometry);
    expect(mesh.index.length).toBe(vessel.bays.length * 36); // BoxGeometry: 6 faces * 2 tris * 3 idx
  });

  it("is finite and has a positive triangle count", () => {
    const mesh = buildHatchCoversMesh(vessel, geometry);
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
    expect(mesh.index.length).toBeGreaterThan(0);
  });
});

describe("buildLashingBridgesMesh", () => {
  const vessel = buildDemoVessel();
  const geometry = buildDemoHorizonGeometry();

  it("places a bridge every 3rd bay for the demo vessel's 10 bays (indices 1,4,7 -> 3 bridges)", () => {
    const mesh = buildLashingBridgesMesh(vessel, geometry);
    expect(mesh).not.toBeNull();
    expect(mesh!.index.length).toBe(3 * 36); // 3 bridges * (BoxGeometry: 6 faces * 2 tris * 3 idx)
  });

  it("returns null when there are no bays", () => {
    const emptyVessel = { ...vessel, bays: [] };
    expect(buildLashingBridgesMesh(emptyVessel, geometry)).toBeNull();
  });
});
