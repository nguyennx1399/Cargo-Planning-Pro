import { describe, expect, it } from "vitest";
import { areasAt, buildStowageModel } from "../build-stowage-model";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildBbcSaoPauloVessel } from "@/data/bbc-sao-paulo-vessel";
import type { StackSpec, Vessel } from "@/types/domain";

/** A vessel with no breakbulk layout: exercises the generic weather-deck approximation and gives
 * one under-deck slot (inside `hold_1`) plus one on-deck slot. */
const stacks: StackSpec[] = [
  { bay: 2, row: 1, deck: "under", tiers: [2], max_weight_t: 50, max_height_m: null, reefer_tiers: [] },
  { bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] },
];

const crafted: Vessel = {
  id: "crafted",
  name: "Crafted",
  imo: null,
  length_m: 100,
  beam_m: 20,
  bays: [2],
  rows: [1, 3],
  stacks,
  breakbulk_holds: [
    {
      id: "hold_1",
      label: "Hold 1 tank top",
      level: "tank_top",
      hold: "1",
      area: { xMin: 0, xMax: 100, zMin: -10, zMax: 10 },
      keep_out: [],
      cargo_base_height_m: -9.5,
    },
  ],
};

describe("buildStowageModel — areas", () => {
  it("gives a generic vessel exactly one area: the approximated weather deck", () => {
    const model = buildStowageModel(buildDemoVessel());
    expect(model.areas).toHaveLength(1);
    const deck = model.areas[0];
    expect(deck.id).toBe("weather_deck");
    expect(deck.source).toBe("generic");
    expect(deck.onDeck).toBe(true);
    expect(deck.keepOuts).toEqual([]);
    expect(deck.loadRating).toBeUndefined();
    expect(deck.maxHeight).toBe(Infinity); // generic areas declare no overhead limit
  });

  it("reproduces the generic deck rect of the pre-refactor approximation exactly", () => {
    const vessel = buildDemoVessel();
    const deck = buildStowageModel(vessel).areas[0];
    // The original constants in breakbulk-deck-area.ts: 0.15 bow, 0.15 stern, 1.5 m off each shell.
    // This pins the contract against a refactor drift — the numbers must not change.
    const expected = {
      xMin: vessel.length_m * 0.15,
      xMax: vessel.length_m - vessel.length_m * 0.15,
      zMin: -vessel.beam_m / 2 + 1.5,
      zMax: vessel.beam_m / 2 - 1.5,
    };
    expect(deck.rect).toEqual(expected);
    // Spot-check the literal values a planner's tooltip would show.
    expect(expected.xMin).toBeCloseTo(25.8, 9);
    expect(expected.zMax).toBeCloseTo(12.2, 9);
  });

  it("lists the weather deck first, then declared holds — all marked declared", () => {
    const model = buildStowageModel(buildBbcSaoPauloVessel());
    expect(model.areas.length).toBeGreaterThan(1); // BBC declares holds
    expect(model.areas[0].id).toBe("weather_deck");
    expect(model.areas[0].source).toBe("declared");
    const holds = model.areas.filter((a) => !a.onDeck);
    expect(holds.length).toBe(model.areas.length - 1);
    for (const hold of holds) {
      expect(hold.source).toBe("declared");
      expect(hold.level === "tweendeck" || hold.level === "tank_top").toBe(true);
    }
    expect(model.areaById.get("weather_deck")).toBe(model.areas[0]);
  });
});

describe("buildStowageModel — cache and lookup", () => {
  it("caches per vessel object identity and rebuilds for a copy", () => {
    const vessel = buildDemoVessel();
    expect(buildStowageModel(vessel)).toBe(buildStowageModel(vessel));
    expect(buildStowageModel({ ...vessel })).not.toBe(buildStowageModel(vessel));
  });

  it("areasAt returns every area containing the point, and filters by deck", () => {
    const model = buildStowageModel(crafted);
    const both = areasAt(model, 50, 0);
    expect(both.map((a) => a.id)).toEqual(["weather_deck", "hold_1"]);
    expect(areasAt(model, 50, 0, true).map((a) => a.id)).toEqual(["weather_deck"]);
    expect(areasAt(model, 50, 0, false).map((a) => a.id)).toEqual(["hold_1"]);
    expect(areasAt(model, 500, 0)).toEqual([]); // off the vessel entirely
  });

  it("has no area for an unknown hold id (only the weather deck is synthesised)", () => {
    const model = buildStowageModel(crafted);
    expect(model.areaById.has("weather_deck")).toBe(true);
    expect(model.areaById.has("hold_1")).toBe(true);
    expect(model.areaById.has("hold_nope")).toBe(false);
  });
});

describe("buildStowageModel — purity", () => {
  it("imports nothing from react/three/zustand (the model is engine-layer only)", async () => {
    const read = (name: string): Promise<string> =>
      import("node:fs").then((fs) => fs.readFileSync(new URL(name, import.meta.url), "utf8"));
    // Both modules of the builder: this test is not recursive over the directory (see the phase file's
    // note on the RT-8 scan), so every file it should cover is named here.
    for (const name of ["../build-stowage-model.ts", "../slot-enumeration.ts"]) {
      expect(await read(name), name).not.toMatch(/from ["'](react|three|zustand|@react-three|@tanstack)/);
    }
  });
});
