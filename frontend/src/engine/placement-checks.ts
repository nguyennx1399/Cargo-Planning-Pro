/**
 * Small pure predicates shared by the validation rules and (phase 02) auto-stow,
 * so both enforce exactly the same limits (DRY: "validator before optimizer").
 */
import type { Container, StackSpec } from "@/types/domain";
import { isFortyBay } from "./slot-helpers";

export const isTwenty = (c: Container): boolean => c.size === "20";

/** TEU footprint: 20' = 1, 40'/45' = 2. */
export const teuOf = (c: Container): number => (isTwenty(c) ? 1 : 2);

/** 20' boxes go in odd (20') bays, 40'/45' boxes in even (40') bays. */
export const sizeFitsBay = (c: Container, bay: number): boolean =>
  isTwenty(c) ? !isFortyBay(bay) : isFortyBay(bay);

/** Tier directly below `tier` in this stack; null for the lowest tier or a tier the stack lacks. */
export function tierBelow(stack: StackSpec, tier: number): number | null {
  if (!stack.tiers.includes(tier)) return null;
  const lower = stack.tiers.filter((t) => t < tier);
  return lower.length ? Math.max(...lower) : null;
}

/** Reefers need a plug on this tier; other types fit anywhere. */
export const plugOk = (c: Container, stack: StackSpec, tier: number): boolean =>
  c.type !== "REEFER" || stack.reefer_tiers.includes(tier);
