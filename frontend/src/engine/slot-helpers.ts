/**
 * ISO bay-row-tier slot helpers. TS port of backend/app/domain/slot.py, extended for mixed 20'/40'.
 * See docs/DOMAIN.md: odd bay = 20' position, even bay = 40' spanning (bay - 1, bay + 1),
 * bays numbered bow -> stern, so bay - 1 is the FORE half and bay + 1 the AFT half.
 */
import type { DeckLevel, Slot } from "@/types/domain";

export type HalfSide = "fore" | "aft";

/** Where a slot sits: its 40' bay and which 20' halves of that bay it covers. */
export interface BayPosition {
  fortyBay: number;
  halves: HalfSide[];
}

export const isFortyBay = (bay: number): boolean => bay % 2 === 0;
export const isOnDeck = (tier: number): boolean => tier >= 80;
export const deckOf = (tier: number): DeckLevel => (isOnDeck(tier) ? "on" : "under");

/** Bay 02 spans 20' bays 01 (fore) and 03 (aft). */
export function twentyBaysOf(fortyBay: number): [number, number] {
  if (!isFortyBay(fortyBay)) throw new Error(`Expected an even (40') bay, got ${fortyBay}`);
  return [fortyBay - 1, fortyBay + 1];
}

/**
 * Map any bay number to its 40' bay on this vessel. Even bays cover both halves; odd bay b is the
 * fore half of b + 1 or the aft half of b - 1. Returns null when the vessel has no such 40' bay.
 */
export function bayPosition(bay: number, fortyBays: readonly number[]): BayPosition | null {
  if (isFortyBay(bay)) return fortyBays.includes(bay) ? { fortyBay: bay, halves: ["fore", "aft"] } : null;
  if (fortyBays.includes(bay + 1)) return { fortyBay: bay + 1, halves: ["fore"] };
  if (fortyBays.includes(bay - 1)) return { fortyBay: bay - 1, halves: ["aft"] };
  return null;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** { bay: 14, row: 6, tier: 82 } -> "140682" */
export const slotCode = (s: Slot): string => `${pad2(s.bay)}${pad2(s.row)}${pad2(s.tier)}`;

/** "140682" -> { bay: 14, row: 6, tier: 82 } */
export function parseSlotCode(code: string): Slot {
  const c = code.trim();
  if (!/^\d{6}$/.test(c)) throw new Error(`Invalid slot code: ${JSON.stringify(code)}`);
  return { bay: Number(c.slice(0, 2)), row: Number(c.slice(2, 4)), tier: Number(c.slice(4, 6)) };
}
