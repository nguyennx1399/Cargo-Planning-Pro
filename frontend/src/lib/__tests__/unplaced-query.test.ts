/**
 * unplaced-query — what the Unplaced list SHOWS: the default rendering, search, size/type filters,
 * sort, grouping, the header string and the arrow-key step (P2).
 *
 * The load-bearing claim is the first suite: the DEFAULT query must reproduce the pre-P2 rendering
 * byte for byte, because acceptance script step 1 reads `Unplaced (20)` out loud and is the one
 * human step that would otherwise catch a regression here. Everything else is list logic that had no
 * machine-checkable half before this phase.
 *
 * No DOM anywhere in this repo (decision D7), so the wiring in `UnplacedCargoList` — the event
 * handlers, the focus walk, the collapsed groups — is what script steps 29-34 cover by hand.
 */
import { describe, expect, it } from "vitest";
import { nextRowIndex, queryUnplacedRows, unplacedHeaderLabel } from "@/lib/unplaced-query";
import { DEMO_FLEET, REAL, ctxOf, ids, mk, q, unplacedOf } from "./unplaced-query-fixtures";

describe("the default query is today's rendering", () => {
  it.each(REAL)("keeps plan order, hides nothing and prints the old header on %s", (name, _vessel, plan) => {
    const unplaced = unplacedOf(plan);
    const result = queryUnplacedRows(unplaced, q(), ctxOf(plan));

    expect(result.total).toBe(unplaced.length);
    expect(result.shown).toBe(unplaced.length);
    expect(result.ordered.map((r) => r.container.id)).toEqual(unplaced.map((c) => c.id));
    // Ungrouped = one nameless group holding every row, so the component has ONE render path.
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].label).toBe("");
    expect(result.groups[0].rows).toHaveLength(result.shown);
    // No bay filtered = no bay claim to make, so no row is marked.
    expect(result.ordered.every((r) => r.fitsBay === false)).toBe(true);
    expect(unplacedHeaderLabel(result), `${name}: script step 1`).toBe(
      name === "BBC SAO PAULO" ? "Unplaced (20)" : "Unplaced (400)"
    );
  });

  it("has the recorded row counts (400 unplaced of 886 on the demo, 20 of 130 on BBC)", () => {
    expect(unplacedOf(REAL[0][2])).toHaveLength(400);
    expect(REAL[0][2].containers).toHaveLength(886);
    expect(unplacedOf(REAL[1][2])).toHaveLength(20);
  });
});

describe("search, filters, header", () => {
  it("matches POD case-insensitively, and only matching rows survive", () => {
    const plan = REAL[0][2];
    const unplaced = unplacedOf(plan);
    const expected = unplaced.filter((c) => c.pod === "SGSIN").length;
    expect(expected, "the demo has SGSIN cargo").toBeGreaterThan(0);
    for (const text of ["SGSIN", "sgsin", "  SGSIn "]) {
      const result = queryUnplacedRows(unplaced, q({ text }), ctxOf(plan));
      expect(result.shown).toBe(expected);
      expect(result.ordered.every((r) => r.container.pod === "SGSIN")).toBe(true);
      expect(unplacedHeaderLabel(result)).toBe(`Unplaced (${expected} of 400)`);
    }
  });

  it("finds a box by its weight (the numeric query the plan asks for)", () => {
    const plan = REAL[0][2];
    const unplaced = unplacedOf(plan);
    const target = unplaced.find((c) => String(c.weight_t).includes("."))!;
    const result = queryUnplacedRows(unplaced, q({ text: String(target.weight_t) }), ctxOf(plan));
    expect(result.shown).toBeGreaterThan(0);
    expect(result.ordered.map((r) => r.container.id)).toContain(target.id);
  });

  it("filters by size and type over the whole fleet, and by their intersection", () => {
    const shown = (patch: Parameters<typeof q>[0]) => queryUnplacedRows(DEMO_FLEET, q(patch), ctxOf(REAL[0][2])).shown;
    expect(shown({ size: "20" })).toBe(DEMO_FLEET.filter((c) => c.size === "20").length);
    expect(shown({ size: "45" })).toBe(4); // the demo's special-count slice
    const reefer = DEMO_FLEET.filter((c) => c.type === "REEFER");
    expect(reefer.length).toBeGreaterThan(0);
    expect(shown({ type: "REEFER" })).toBe(reefer.length);
    expect(shown({ size: "20", type: "REEFER" })).toBe(reefer.filter((c) => c.size === "20").length);
    // BBC's 20 unplaced are all 20' (the packer places no 20' box), so a 40' filter empties the list.
    const bbcUnplaced = unplacedOf(REAL[1][2]);
    const empty = queryUnplacedRows(bbcUnplaced, q({ size: "40" }), ctxOf(REAL[1][2]));
    expect(empty.shown).toBe(0);
    expect(unplacedHeaderLabel(empty)).toBe("Unplaced (0 of 20)");
  });
});

describe("grouping, sorting, header", () => {
  it("partitions the filtered set: every row once, counts summing to `shown`", () => {
    const plan = REAL[0][2];
    const result = queryUnplacedRows(unplacedOf(plan), q({ text: "SGSIN", group: "pod" }), ctxOf(plan));

    expect(result.groups.length).toBe(new Set(result.ordered.map((r) => r.container.pod)).size);
    expect(result.groups.reduce((n, g) => n + g.rows.length, 0)).toBe(result.shown);
    const seen = result.groups.flatMap((g) => g.rows.map((r) => r.container.id));
    expect(seen).toHaveLength(result.shown);
    expect(new Set(seen).size).toBe(result.shown);
    // Group order follows the sorted rows, and a group holds only its own key.
    expect(result.groups.map((g) => g.key)).toEqual([...new Set(result.ordered.map((r) => r.container.pod))]);
    for (const g of result.groups) expect(g.rows.every((r) => r.container.pod === g.key)).toBe(true);
    // Size groups are labelled the way the chips are.
    const bySize = queryUnplacedRows(DEMO_FLEET, q({ group: "size" }), ctxOf(plan));
    expect(bySize.groups.map((g) => g.label).sort()).toEqual(["20'", "40'", "45'"]);
  });

  it("sorts by weight descending, stably, and by POD rotation sequence", () => {
    const plan = REAL[0][2];
    const unplaced = unplacedOf(plan);
    const weights = queryUnplacedRows(unplaced, q({ sort: "weight" }), ctxOf(plan)).ordered.map((r) => r.container.weight_t);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    // Equal weights keep plan order: three 10t boxes and a 5t one, in that plan order.
    const tie = [mk("T1", { weight_t: 10 }), mk("T2", { weight_t: 5 }), mk("T3", { weight_t: 10 }), mk("T4", { weight_t: 10 })];
    const tieIds = queryUnplacedRows(tie, q({ sort: "weight" }), ctxOf(plan)).ordered.map((r) => r.container.id);
    expect(tieIds).toEqual(["T1", "T3", "T4", "T2"]);
    // POD rotation: non-decreasing sequence.
    const seq = ctxOf(plan).podSequence;
    const pods = queryUnplacedRows(unplaced, q({ sort: "pod" }), ctxOf(plan)).ordered.map((r) => seq[r.container.pod]);
    expect(pods).toEqual([...pods].sort((a, b) => a - b));
    expect(pods[0]).toBe(Math.min(...pods));
  });

  it("sorts ids by code unit, not by locale collation", () => {
    // `localeCompare` puts "a" before "B" (case is a tertiary difference); code units put every
    // uppercase first. This pins the locale-independent order the module guarantees.
    const fixture = ["a2", "a10", "A2", "B", "a"].map((id) => mk(id));
    const ordered = queryUnplacedRows(fixture, q({ sort: "id" }), { podSequence: {}, baySlots: null });
    expect(ordered.ordered.map((r) => r.container.id)).toEqual(["A2", "B", "a", "a10", "a2"]);
    // ... and it REORDERS: fed the demo rows backwards it returns them ascending, while `cargo`
    // passes the same input through untouched.
    const plan = REAL[0][2];
    const backwards = [...unplacedOf(plan)].reverse();
    const byId = queryUnplacedRows(backwards, q({ sort: "id" }), ctxOf(plan)).ordered.map((r) => r.container.id);
    expect(byId).toEqual([...byId].sort());
    expect(byId).not.toEqual(backwards.map((c) => c.id));
    expect(ids(plan)).toEqual(unplacedOf(plan).map((c) => c.id));
  });

  it("says `S of N` the moment anything is hidden, and `N` when it is not", () => {
    const plan = REAL[0][2];
    const result = queryUnplacedRows(unplacedOf(plan), q({ text: "MYPKG" }), ctxOf(plan));
    expect(result.shown).toBeLessThan(result.total);
    expect(unplacedHeaderLabel(result)).toBe(`Unplaced (${result.shown} of 400)`);
    // A query that matches everything hides nothing, so the header must not claim a subset.
    const all = queryUnplacedRows(unplacedOf(plan), q({ text: "demu" }), ctxOf(plan));
    expect(all.shown).toBe(all.total);
    expect(unplacedHeaderLabel(all)).toBe("Unplaced (400)");
  });
});

describe("nextRowIndex", () => {
  it("walks and clamps at both ends, and reports nothing to focus on an empty list", () => {
    expect([0, 1, 2, 3].map((i) => nextRowIndex(i, 1, 3))).toEqual([1, 2, 2, 2]);
    expect([0, 1, 2, 3].map((i) => nextRowIndex(i, -1, 3))).toEqual([0, 0, 1, 2]);
    expect(nextRowIndex(-1, 1, 400)).toBe(0); // first ArrowDown with nothing focused
    expect(nextRowIndex(-1, -1, 400)).toBe(399); // first ArrowUp goes to the last row
    expect(nextRowIndex(400, -1, 400)).toBe(399); // End
    expect(nextRowIndex(0, 1, 1)).toBe(0);
    expect(nextRowIndex(-1, 1, 0)).toBe(-1);
    expect(nextRowIndex(3, 5, 0)).toBe(-1);
  });

  it("never returns an out-of-range index, for any input", () => {
    for (const count of [0, 1, 2, 7, 400]) {
      for (let current = -3; current <= count + 3; current++) {
        for (const delta of [-5, -2, -1, 0, 1, 2, 5]) {
          const next = nextRowIndex(current, delta, count);
          expect(next === -1 || (next >= 0 && next <= count - 1), `count ${count}, ${current}+${delta} -> ${next}`).toBe(true);
        }
      }
    }
  });

  /** The component's group-header rule, in this function's terms: a group whose first row sits at
   * `seam` in the rendered list is entered by ArrowDown and left upwards by ArrowUp. Pinned here
   * because the WRAPPING (that even a seam of 0 steps to row 0, and that a header is an origin at all)
   * lives in the component's keydown guard, which only script step 33 can see — this covers the
   * arithmetic, not the guard. */
  it("steps into a group from its header and out of it upwards, for every seam", () => {
    const seamStep = (seam: number, arrow: 1 | -1, count: number) =>
      nextRowIndex(seam - (arrow < 0 ? 0 : 1), arrow, count);
    const count = 10;
    expect(seamStep(0, 1, count)).toBe(0); // the first header's ArrowDown must still reach row 0
    expect(seamStep(0, -1, count)).toBe(0); // nothing above it: clamped, never a wrap to the end
    expect(seamStep(4, 1, count)).toBe(4); // its own first row
    expect(seamStep(4, -1, count)).toBe(3); // the previous group's last row
    expect(seamStep(count, 1, count)).toBe(count - 1); // the last header: nothing below, clamped
    for (let seam = 0; seam <= count; seam++) {
      for (const arrow of [1, -1] as const) {
        const next = seamStep(seam, arrow, count);
        expect(next >= 0 && next <= count - 1, `seam ${seam}, arrow ${arrow} -> ${next}`).toBe(true);
      }
    }
  });
});
