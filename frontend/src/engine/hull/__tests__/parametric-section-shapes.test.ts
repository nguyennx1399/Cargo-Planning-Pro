import { describe, expect, it } from "vitest";
import { envelopeHalfBreadth, sectionHalfBreadth } from "../parametric-section-shapes";

describe("envelopeHalfBreadth", () => {
  const midbody: [number, number] = [0.3, 0.62];

  it("is full beam (1) across the parallel midbody", () => {
    expect(envelopeHalfBreadth(0.3, midbody, 2)).toBeCloseTo(1, 9);
    expect(envelopeHalfBreadth(0.45, midbody, 2)).toBeCloseTo(1, 9);
    expect(envelopeHalfBreadth(0.62, midbody, 2)).toBeCloseTo(1, 9);
  });

  it("tapers to 0 at AP (xi=0) and FP (xi=1)", () => {
    expect(envelopeHalfBreadth(0, midbody, 2)).toBeCloseTo(0, 9);
    expect(envelopeHalfBreadth(1, midbody, 2)).toBeCloseTo(0, 9);
  });

  it("is monotonically decreasing toward each end", () => {
    expect(envelopeHalfBreadth(0.1, midbody, 2)).toBeGreaterThan(envelopeHalfBreadth(0.05, midbody, 2));
    expect(envelopeHalfBreadth(0.9, midbody, 2)).toBeGreaterThan(envelopeHalfBreadth(0.95, midbody, 2));
  });

  describe("aftTaperExtraFrac (aft overhang)", () => {
    it("with no extra fraction (default), still reaches exactly 0 at xi=0 (AP)", () => {
      expect(envelopeHalfBreadth(0, midbody, 2)).toBe(0);
    });

    it("with an extra fraction, is NONZERO at xi=0 (AP) — the fix for the aft 'blade'", () => {
      const withOverhang = envelopeHalfBreadth(0, midbody, 2, 0.0375); // e.g. 6m overhang / 160m LBP
      expect(withOverhang).toBeGreaterThan(0);
    });

    it("with an extra fraction, reaches exactly 0 only at the extended tip (xi = -extraFrac)", () => {
      const extra = 0.0375;
      expect(envelopeHalfBreadth(-extra, midbody, 2, extra)).toBeCloseTo(0, 9);
      expect(envelopeHalfBreadth(-extra / 2, midbody, 2, extra)).toBeGreaterThan(0);
    });
  });
});

describe("sectionHalfBreadth", () => {
  it("is (halfBreadth - bilgeRadius) at the baseline (flat bottom)", () => {
    expect(sectionHalfBreadth(0, 10, 2)).toBeCloseTo(8, 9);
  });

  it("reaches full half-breadth at z = bilgeRadius and stays there above it", () => {
    expect(sectionHalfBreadth(2, 10, 2)).toBeCloseTo(10, 6);
    expect(sectionHalfBreadth(5, 10, 2)).toBeCloseTo(10, 9);
  });

  it("never exceeds halfBreadthM and never goes negative", () => {
    for (const z of [-1, 0, 0.5, 1, 2, 3, 10]) {
      const y = sectionHalfBreadth(z, 10, 2);
      expect(y).toBeLessThanOrEqual(10 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it("degenerates to 0 everywhere when halfBreadthM is 0 (bow/stern tip)", () => {
    expect(sectionHalfBreadth(0, 0, 2)).toBe(0);
    expect(sectionHalfBreadth(3, 0, 2)).toBe(0);
  });
});
