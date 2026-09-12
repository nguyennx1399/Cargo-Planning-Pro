import { describe, expect, it } from "vitest";
import { buildDemoVessel } from "../demo-container-vessel";
import { generateDemoCargo, iso6346CheckDigit, makeContainerId } from "../demo-cargo-generator";

describe("demo vessel", () => {
  const vessel = buildDemoVessel();

  it("has 800 x 40' cells (1,600 TEU)", () => {
    const cells = vessel.stacks.reduce((sum, s) => sum + s.tiers.length, 0);
    expect(vessel.bays).toHaveLength(10);
    expect(cells).toBe(800);
  });

  it("keeps under-deck rows inside the on-deck row list", () => {
    const underRows = new Set(vessel.stacks.filter((s) => s.deck === "under").map((s) => s.row));
    for (const r of underRows) expect(vessel.rows).toContain(r);
  });

  it("puts reefer plugs only on deck in the four aftmost bays", () => {
    const withPlugs = vessel.stacks.filter((s) => s.reefer_tiers.length > 0);
    expect(withPlugs.every((s) => s.deck === "on")).toBe(true);
    expect([...new Set(withPlugs.map((s) => s.bay))]).toEqual(vessel.bays.slice(-4));
  });
});

describe("ISO 6346", () => {
  it("matches the standard example CSQU305438 -> 3", () => {
    expect(iso6346CheckDigit("CSQU305438")).toBe(3);
  });
  it("builds ids with valid check digits and rejects bad input", () => {
    const id = makeContainerId(12);
    expect(id).toMatch(/^DEMU000012\d$/);
    expect(Number(id[10])).toBe(iso6346CheckDigit(id.slice(0, 10)));
    expect(() => makeContainerId(1_000_000)).toThrow();
    expect(() => iso6346CheckDigit("DEM0000001")).toThrow();
  });
});

describe("demo cargo", () => {
  const cargo = generateDemoCargo(42);

  it("is deterministic per seed", () => {
    expect(generateDemoCargo(42)).toEqual(cargo);
    expect(generateDemoCargo(7)).not.toEqual(cargo);
  });

  it("has the planned size mix with unique valid ids", () => {
    expect(cargo.filter((c) => c.size === "40")).toHaveLength(470);
    expect(cargo.filter((c) => c.size === "20")).toHaveLength(400);
    expect(new Set(cargo.map((c) => c.id)).size).toBe(cargo.length);
    for (const c of cargo) expect(Number(c.id[10])).toBe(iso6346CheckDigit(c.id.slice(0, 10)));
  });

  it("keeps weights, HC and dangerous goods within the demo rules", () => {
    for (const c of cargo) {
      expect(c.weight_t).toBeGreaterThanOrEqual(4);
      expect(c.weight_t).toBeLessThanOrEqual(c.size === "20" ? 28 : 30);
      if (c.high_cube) expect(c.size).toBe("40");
      if (c.imdg_class) expect(c.type).toBe("DRY");
      expect(c.pol).toBe("VNSGN");
      expect(c.pod).not.toBe("VNSGN");
    }
    const reefers = cargo.filter((c) => c.type === "REEFER").length / cargo.length;
    expect(reefers).toBeGreaterThan(0.04);
    expect(reefers).toBeLessThan(0.12);
  });
});

describe("ISO 6346 check digit edge cases", () => {
  // Expected digits hand-computed from the standard letter table:
  // A10 B12 ... J20 K21 L23 (22 skipped) ... U32 V34 (33 skipped) ... Z38; weights 2^i; sum mod 11 mod 10.
  it("uses the skipped values around multiples of 11 (K=21, L=23, U=32, V=34)", () => {
    // 21*1 + 23*2 + 34*4 + 32*8 + 1*16 + 2*32 + 3*64 + 4*128 + 5*256 + 6*512 = 5595; 5595 mod 11 = 7
    expect(iso6346CheckDigit("KLVU123456")).toBe(7);
  });

  it("writes remainder 10 as check digit 0", () => {
    // CSQU305498: sum 7721, 7721 mod 11 = 10 -> 0
    expect(iso6346CheckDigit("CSQU305498")).toBe(0);
  });
});

describe("demo cargo determinism & options", () => {
  it("generates consistent cargo with the same seed", () => {
    const cargo1 = generateDemoCargo(12345);
    const cargo2 = generateDemoCargo(12345);
    expect(cargo1).toEqual(cargo2);
  });

  it("generates different cargo with different seeds", () => {
    const cargo1 = generateDemoCargo(1);
    const cargo2 = generateDemoCargo(2);
    expect(cargo1).not.toEqual(cargo2);
  });

  it("respects custom options for forties count", () => {
    const cargo = generateDemoCargo(99, { forties: 100 });
    expect(cargo.filter((c) => c.size === "40")).toHaveLength(100);
  });

  it("respects custom options for twenties count", () => {
    const cargo = generateDemoCargo(99, { twenties: 50 });
    expect(cargo.filter((c) => c.size === "20")).toHaveLength(50);
  });

  it("respects custom firstSerial option", () => {
    const cargo = generateDemoCargo(99, { forties: 10, twenties: 0, firstSerial: 1000 });
    const serials = cargo.map((c) => parseInt(c.id.slice(4, 10), 10)).sort((a, b) => a - b);
    expect(serials[0]).toBeGreaterThanOrEqual(1000);
  });

  it("maintains valid ISO 6346 check digits with custom options", () => {
    const cargo = generateDemoCargo(88, { forties: 50, twenties: 30, firstSerial: 500 });
    for (const c of cargo) {
      const digit = Number(c.id[10]);
      expect(digit).toBe(iso6346CheckDigit(c.id.slice(0, 10)));
    }
  });

  it("fills the vessel correctly with minimal cargo", () => {
    const cargo = generateDemoCargo(77, { forties: 5, twenties: 0 });
    expect(cargo).toHaveLength(5);
    expect(cargo.every((c) => c.size === "40")).toBe(true);
  });

  it("defaults to zero special (45'/OPEN_TOP/FLAT_RACK/TANK) cargo, unchanged from before", () => {
    const cargo = generateDemoCargo(42);
    expect(cargo.filter((c) => c.size === "45")).toHaveLength(0);
    expect(cargo.filter((c) => c.type === "OPEN_TOP" || c.type === "FLAT_RACK" || c.type === "TANK")).toHaveLength(0);
  });

  it("produces every special size/type when explicitly requested via specialCounts", () => {
    const cargo = generateDemoCargo(42, { specialCounts: { "45": 2, OPEN_TOP: 2, FLAT_RACK: 2, TANK: 2 } });
    expect(cargo.filter((c) => c.size === "45")).toHaveLength(2);
    expect(cargo.filter((c) => c.type === "OPEN_TOP")).toHaveLength(2);
    expect(cargo.filter((c) => c.type === "FLAT_RACK")).toHaveLength(2);
    expect(cargo.filter((c) => c.type === "TANK")).toHaveLength(2);
    // requesting specials must not disturb the base 470/400 forties/twenties mix
    expect(cargo.filter((c) => c.size === "40" && (c.type === "DRY" || c.type === "REEFER"))).toHaveLength(470);
    expect(cargo.filter((c) => c.size === "20")).toHaveLength(400);
  });
});
