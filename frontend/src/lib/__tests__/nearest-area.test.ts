/**
 * The area resolver's rule (Phase 02), swept over the REAL areas of both vessels.
 *
 * The defect it exists for: disjoint per-area pick planes, so the pointer produced `weather deck` →
 * nothing → `Hold 2 tank top` → nothing down one screen line. The regression to protect is therefore
 * "no gaps over the ship, and the topmost visible surface wins".
 */
import { describe, expect, it } from "vitest";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { buildStowageModel, sceneXToPlacementX, placementXToSceneX } from "@/engine/stowage-model";
import { areaUnderCursor, cursorOnAreaPlane, type AreaProbe, type Vec3 } from "@/lib/nearest-area";

const { vessel } = getVesselCatalogEntry("bbc-sao-paulo");
const areas = buildStowageModel(vessel).areas;
const probes: AreaProbe[] = areas.map((a) => ({ id: a.id, surfaceY: a.surfaceY, rect: a.rect }));
const toRectX = (x: number) => sceneXToPlacementX(x, vessel.length_m);

/** A ray straight down onto (placement x, z) — the simplest pointer there is. */
const straightDown = (xPlacement: number, z: number): { origin: Vec3; dir: Vec3 } => ({
  origin: [placementXToSceneX(xPlacement, vessel.length_m), 500, z],
  dir: [0, -1, 0],
});

const idAt = (xPlacement: number, z: number, pad: [number, number] = [0, 0]): string | null => {
  const { origin, dir } = straightDown(xPlacement, z);
  const hit = areaUnderCursor(probes, origin, dir, pad, toRectX);
  return hit ? probes[hit.index].id : null;
};

describe("cursorOnAreaPlane", () => {
  it("crosses where the ray meets the surface height", () => {
    expect(cursorOnAreaPlane(4, [0, 10, 0], [0, -1, 0])).toEqual([0, 4, 0]);
  });

  it("is null for a ray parallel to the deck", () => {
    expect(cursorOnAreaPlane(4, [0, 10, 0], [1, 0, 0])).toBeNull();
  });

  it("is null when the crossing lies behind the camera", () => {
    expect(cursorOnAreaPlane(4, [0, 10, 0], [0, 1, 0])).toBeNull();
  });
});

describe("areaUnderCursor on BBC SAO PAULO", () => {
  const weather = areas.find((a) => a.id === "weather_deck")!;
  const hold = areas.find((a) => !a.onDeck && a.rect.xMax - a.rect.xMin > 40)!;

  it("the vessel really does stack one area over another (fixture assumption)", () => {
    expect(weather.surfaceY).toBeGreaterThan(hold.surfaceY);
    expect(hold.rect.xMin).toBeGreaterThanOrEqual(weather.rect.xMin);
  });

  it("picks the TOPMOST surface where areas overlap", () => {
    const x = (hold.rect.xMin + hold.rect.xMax) / 2;
    expect(idAt(x, 0)).toBe("weather_deck");
  });

  it("picks the deeper area once the higher one is not a candidate (deck toggle off)", () => {
    const x = (hold.rect.xMin + hold.rect.xMax) / 2;
    const withoutDeck = probes.filter((p) => p.id !== "weather_deck");
    const { origin, dir } = straightDown(x, 0);
    const hit = areaUnderCursor(withoutDeck, origin, dir, [0, 0], toRectX);
    expect(hit && withoutDeck[hit.index].id).toBe(hold.id);
  });

  it("answers over EVERY point of every area's own rect — no gaps", () => {
    for (const area of areas) {
      for (let x = area.rect.xMin; x <= area.rect.xMax; x += 2) {
        for (let z = area.rect.zMin; z <= area.rect.zMax; z += 1) {
          expect(idAt(x, z), `${area.id} at ${x.toFixed(1)}/${z.toFixed(1)}`).not.toBeNull();
        }
      }
    }
  });

  it("is null off the ship — a real answer, not a guess", () => {
    expect(idAt(weather.rect.xMin - 30, 0)).toBeNull();
    expect(idAt((weather.rect.xMin + weather.rect.xMax) / 2, weather.rect.zMax + 30)).toBeNull();
  });

  it("padding keeps the last half-footprint before an edge reachable", () => {
    const x = (weather.rect.xMin + weather.rect.xMax) / 2;
    const justOutside = weather.rect.zMax + 1.5;
    expect(idAt(x, justOutside)).toBeNull();
    expect(idAt(x, justOutside, [0, 2.75])).toBe("weather_deck");
  });
});

describe("areaUnderCursor on the demo container vessel", () => {
  const demo = getVesselCatalogEntry("demo-horizon").vessel;
  const demoAreas = buildStowageModel(demo).areas;
  const demoProbes: AreaProbe[] = demoAreas.map((a) => ({ id: a.id, surfaceY: a.surfaceY, rect: a.rect }));

  it("answers over every point of its (generic) weather deck", () => {
    for (const area of demoAreas) {
      for (let x = area.rect.xMin; x <= area.rect.xMax; x += 2) {
        for (let z = area.rect.zMin; z <= area.rect.zMax; z += 1) {
          const hit = areaUnderCursor(
            demoProbes,
            [placementXToSceneX(x, demo.length_m), 500, z],
            [0, -1, 0],
            [0, 0],
            (sx) => sceneXToPlacementX(sx, demo.length_m),
          );
          expect(hit, `${area.id} at ${x.toFixed(1)}/${z.toFixed(1)}`).not.toBeNull();
        }
      }
    }
  });
});

describe("an oblique ray, the camera's real case", () => {
  it("resolves by WHERE the ray crosses each surface, not by which is nearest the camera", () => {
    const weather = areas.find((a) => a.id === "weather_deck")!;
    const hold = areas.find((a) => !a.onDeck && a.rect.xMax - a.rect.xMin > 40)!;
    // Aimed so the deck-level crossing is outside the deck rect in z, while the deeper crossing lands
    // inside the hold: the exact geometry that used to make "pointing at the deck" report the hold.
    const xScene = placementXToSceneX((hold.rect.xMin + hold.rect.xMax) / 2, vessel.length_m);
    // Down and inboard: 0.5 m of z per metre of drop. Starting 7 m outboard of the deck edge and 10 m
    // above it, the deck-level crossing lands 2 m OUTSIDE the deck rect, while the same ray reaches
    // the hold 15.5 m lower at z ≈ 4 m — comfortably inside it.
    const origin: Vec3 = [xScene, weather.surfaceY + 10, weather.rect.zMax + 7];
    const dir: Vec3 = [0, -1, -0.5];
    const bare = areaUnderCursor(probes, origin, dir, [0, 0], toRectX);
    expect(bare && probes[bare.index].id).toBe(hold.id); // documented, and why the padding exists
    // With the item's own half-width as padding the deck keeps its own edge strip, which is what the
    // planner is pointing at.
    const padded = areaUnderCursor(probes, origin, dir, [0, 6], toRectX);
    expect(padded && probes[padded.index].id).toBe("weather_deck");
  });
});
