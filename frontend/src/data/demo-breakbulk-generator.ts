import type { BreakbulkCargo } from "@/types/domain";
import { BREAKBULK_CATALOG } from "./breakbulk-cargo-catalog";

/** Deterministic demo breakbulk cargo: 2 complete wind turbine sets (3 blades + 1 nacelle + 2
 * tower sections each) plus 2 yachts — fixed catalog entries, not randomized (unlike container
 * cargo) since there are few enough items that a fixed, readable set is clearer for a demo. */
export function generateDemoBreakbulkCargo(): BreakbulkCargo[] {
  const items: BreakbulkCargo[] = [];
  let serial = 1;
  const add = (entry: (typeof BREAKBULK_CATALOG)[keyof typeof BREAKBULK_CATALOG][number], pod: string) => {
    items.push({ ...entry, id: `BB${String(serial++).padStart(3, "0")}`, pol: "VNSGN", pod });
  };

  for (const pod of ["SGSIN", "MYPKG"]) {
    const blade = BREAKBULK_CATALOG.wind_turbine_blade[0];
    const tower = BREAKBULK_CATALOG.wind_turbine_tower[0];
    add(blade, pod);
    add(blade, pod);
    add(blade, pod);
    add(BREAKBULK_CATALOG.wind_turbine_nacelle[0], pod);
    add(tower, pod);
    add(tower, pod);
  }
  add(BREAKBULK_CATALOG.yacht[0], "LKCMB");
  add(BREAKBULK_CATALOG.yacht[1], "AEJEA");

  return items;
}
