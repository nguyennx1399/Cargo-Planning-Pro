/**
 * area-label-text — requirement 3's exact sentence and requirement 1's exact badge. These strings are
 * read over the hull by a planner deciding whether a drop is legitimate, so they are pinned here: the
 * drawn label is a DOM overlay inside a WebGL canvas and there is no DOM test capability (a standing
 * decision), which makes this the only place the wording can be asserted at all.
 */
import { describe, expect, it } from "vitest";
import { APPROXIMATE_AREA_BADGE, areaLabelBadge, areaLabelTitle } from "../area-label-text";
import { buildStowageModel, type StowageArea } from "@/engine/stowage-model";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo } from "@/data/build-demo-plan";

const area = (over: Partial<StowageArea>): StowageArea => ({
  id: "weather_deck",
  label: "Weather deck",
  level: "weather_deck",
  onDeck: true,
  rect: { xMin: 0, xMax: 10, zMin: 0, zMax: 5 },
  keepOuts: [],
  surfaceY: 0,
  maxHeight: Infinity,
  source: "declared",
  ...over,
});

describe("areaLabelTitle", () => {
  it("shows the rating AND the clear height, in that order (requirement 3)", () => {
    expect(areaLabelTitle(area({ label: "Hold 2 tank top", loadRating: 20, maxHeight: 14.6 }))).toBe(
      "Hold 2 tank top · 20 t/m² · clear 14.6 m",
    );
  });

  it("omits a number the area does not declare, keeping the separator count right", () => {
    expect(areaLabelTitle(area({ label: "Hold 2 tank top", maxHeight: 14.6 }))).toBe(
      "Hold 2 tank top · clear 14.6 m",
    );
    expect(areaLabelTitle(area({ label: "Weather deck", loadRating: 4.5 }))).toBe("Weather deck · 4.5 t/m²");
  });

  it("treats an infinite clear height as 'declares none', not as a real ceiling", () => {
    // The generic deck's maxHeight is Infinity — printing "clear Infinity m" would be the badge's
    // exact failure mode in the other direction: a number that looks measured and is not.
    expect(areaLabelTitle(area({ label: "Weather deck" }))).toBe("Weather deck");
  });
});

describe("areaLabelBadge", () => {
  it("badges an approximated area with the wording requirement 1 names", () => {
    expect(areaLabelBadge(area({ source: "generic" }))).toBe("approximate — no GA layout");
    expect(APPROXIMATE_AREA_BADGE).toBe("approximate — no GA layout");
  });

  it("badges a declared area not at all — there is nothing to warn about", () => {
    expect(areaLabelBadge(area({ source: "declared" }))).toBeNull();
  });
});

/** The real models, because the strings above are the ones a planner reads over the hull and the
 * synthetic fixture cannot show what the spec's own numbers do to them. */
describe("the real vessels", () => {
  const bbc = buildStowageModel(buildBbcSaoPauloVesselAndCargo().vessel);
  const demo = buildStowageModel(buildDemoVesselAndCargo().vessel);

  it("prints requirement 3's exact sentence for BBC's Hold 2 tank top, unbadged", () => {
    const hold = bbc.areaById.get("tank_top_hold2")!;
    expect(areaLabelTitle(hold)).toBe("Hold 2 tank top · 20 t/m² · clear 14.6 m");
    expect(areaLabelBadge(hold)).toBeNull();
  });

  it("rounds the spec's float noise rather than printing it as a measurement", () => {
    // The spec states 3.9 m; the model carries 3.8999999999999986 after the unit round-trip.
    expect(areaLabelTitle(bbc.areaById.get("main_deck_aft_hold2")!)).toContain("clear 3.9 m");
    expect(bbc.areaById.get("main_deck_aft_hold2")!.maxHeight).not.toBe(3.9); // the noise is real
  });

  it("badges MV Demo Horizon's single area — the 15 %/85 % LOA guess, with no numbers to show", () => {
    expect(demo.areas).toHaveLength(1);
    expect(areaLabelTitle(demo.areas[0])).toBe("weather deck");
    expect(areaLabelBadge(demo.areas[0])).toBe(APPROXIMATE_AREA_BADGE);
  });
});
