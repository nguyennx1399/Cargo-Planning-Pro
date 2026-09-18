/** Big-cell text (stage-swap plan, phase 03): short POD, weight, and an ink readable on every cell colour. */
import { describe, expect, it } from "vitest";
import { INK_DARK, INK_LIGHT, cellWeightText, readableInk, shortPod } from "../cell-text";
import { HIGHLIGHT, IMDG_COLOR, TYPE_COLORS, weightColor } from "@/lib/colors";

describe("shortPod", () => {
  it("keeps the location part of a UN/LOCODE, anything else as is (max 3)", () => {
    expect(shortPod("SGSIN")).toBe("SIN");
    expect(shortPod("AEJEA")).toBe("JEA");
    expect(shortPod("XX")).toBe("XX");
    expect(shortPod("unknown")).toBe("unk");
  });
});

describe("cellWeightText", () => {
  it("prints one decimal", () => {
    expect(cellWeightText(22.25)).toBe("22.3");
    expect(cellWeightText(5)).toBe("5.0");
  });
});

describe("readableInk", () => {
  it("dark ink on light colours, white on dark ones — hex and the weight ramp's hsl", () => {
    expect(readableInk("#F0E442")).toBe(INK_DARK); // POD yellow
    expect(readableInk("#0072B2")).toBe(INK_LIGHT); // POD navy
    expect(readableInk(weightColor(30))).toBe(INK_LIGHT); // hsl(210, 35%, 32%)
    expect(readableInk(weightColor(0))).toBe(INK_DARK); // hsl(210, 35%, 82%)
    expect(readableInk(IMDG_COLOR)).toBe(INK_LIGHT);
    expect(readableInk(TYPE_COLORS.DRY)).toBe(INK_DARK);
  });

  it("dark ink on the highlight colours, and on anything it cannot parse", () => {
    expect(readableInk(HIGHLIGHT.hover)).toBe(INK_DARK);
    expect(readableInk(HIGHLIGHT.selected)).toBe(INK_DARK);
    expect(readableInk("rebeccapurple")).toBe(INK_DARK);
  });
});
