/**
 * The bay sheet's colour key (all-bay overview, phase 01): counts sum to the boxes, and every chip's
 * colour is the colour `containerColor` gives a box in that entry — the legend cannot lie about a cell.
 */
import { describe, expect, it } from "vitest";
import { colorLegend } from "../color-legend";
import { containerColor, podColorMap } from "@/lib/colors";
import { box, TEST_PORTS } from "@/engine/__tests__/test-vessel-fixture";

const boxes = [
  box("A", { pod: "SGSIN", weight_t: 4 }),
  box("B", { pod: "MYPKG", weight_t: 14, type: "REEFER" }),
  box("C", { pod: "SGSIN", weight_t: 24, imdg_class: "3" }),
  box("D", { pod: "XXXXX", weight_t: 31 }),
];
const pods = podColorMap(TEST_PORTS, "default");

describe("colorLegend", () => {
  it("POD: rotation order, placed boxes only, unknown PODs as Other", () => {
    const legend = colorLegend(boxes, "pod", pods, TEST_PORTS);
    expect(legend.map((e) => [e.label, e.count])).toEqual([["SGSIN", 2], ["MYPKG", 1], ["Other", 1]]);
    expect(legend[0].color).toBe(containerColor(boxes[0], "pod", pods));
  });

  it("type: IMDG counted once, in its own entry, with the colour the cells use", () => {
    const legend = colorLegend(boxes, "type", pods, TEST_PORTS);
    expect(legend.map((e) => [e.label, e.count])).toEqual([["DRY", 2], ["REEFER", 1], ["IMDG", 1]]);
    expect(legend.find((e) => e.label === "IMDG")!.color).toBe(containerColor(boxes[2], "type", pods));
  });

  it("weight: bands sum to the boxes, each band coloured like a box at its middle", () => {
    const legend = colorLegend(boxes, "weight", pods, TEST_PORTS);
    expect(legend.map((e) => e.count)).toEqual([1, 1, 1, 1]);
    expect(legend[1].color).toBe(containerColor(box("M", { weight_t: 15 }), "weight", pods));
  });
});
