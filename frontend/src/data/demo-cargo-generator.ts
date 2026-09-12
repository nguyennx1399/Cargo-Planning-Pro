/**
 * Deterministic synthetic cargo for the demo (seeded PRNG). Never real shipment data (RT-1).
 */
import type { Container, ContainerSize, ContainerType, PortCall } from "@/types/domain";

export const DEMO_PORTS: PortCall[] = [
  { locode: "VNSGN", name: "Ho Chi Minh", sequence: 0, eta: null, etd: null },
  { locode: "SGSIN", name: "Singapore", sequence: 1, eta: null, etd: null },
  { locode: "MYPKG", name: "Port Klang", sequence: 2, eta: null, etd: null },
  { locode: "LKCMB", name: "Colombo", sequence: 3, eta: null, etd: null },
  { locode: "AEJEA", name: "Jebel Ali", sequence: 4, eta: null, etd: null },
];

/** mulberry32: tiny, fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO 6346 letter values: A=10 upward, skipping multiples of 11 (so B=12, L=23, V=34). */
const LETTER_VALUES: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let v = 10;
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (v % 11 === 0) v++;
    out[ch] = v++;
  }
  return out;
})();

/** ISO 6346 check digit for owner code (3 letters) + category (1 letter) + 6-digit serial. */
export function iso6346CheckDigit(first10: string): number {
  if (!/^[A-Z]{4}\d{6}$/.test(first10)) throw new Error(`Invalid ISO 6346 prefix: ${JSON.stringify(first10)}`);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = first10[i];
    sum += (i < 4 ? LETTER_VALUES[ch] : Number(ch)) * 2 ** i;
  }
  return (sum % 11) % 10; // remainder 10 is written as 0
}

/** Full container id with a valid check digit, e.g. makeContainerId(12) -> "DEMU000012" + digit. */
export function makeContainerId(serial: number, owner = "DEMU"): string {
  if (!Number.isInteger(serial) || serial < 0 || serial > 999_999) throw new Error(`Serial out of range: ${serial}`);
  const base = `${owner}${String(serial).padStart(6, "0")}`;
  return `${base}${iso6346CheckDigit(base)}`;
}

export interface DemoCargoOptions {
  forties?: number;
  twenties?: number;
  firstSerial?: number;
  /** 45', OPEN_TOP, FLAT_RACK, TANK — an additive slice on top of forties/twenties, each with
   * its own count. Opt-in only (defaults to none) so the default call's exact 470/400 size mix
   * (asserted by existing tests) never changes — pass this explicitly to exercise the other
   * declared ContainerSize/ContainerType values. */
  specialCounts?: Partial<Record<"45" | "OPEN_TOP" | "FLAT_RACK" | "TANK", number>>;
}

const IMDG_CLASSES = ["2.1", "3", "6.1", "8", "9"];

/** Mixed 20'/40' export cargo loaded at the first port: ~8% reefer, ~3% IMDG, ~30% of 40' high-cube. */
export function generateDemoCargo(seed = 42, opts: DemoCargoOptions = {}): Container[] {
  const { forties = 470, twenties = 400, firstSerial = 1, specialCounts = {} } = opts;
  const rng = mulberry32(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];
  const between = (lo: number, hi: number): number => Math.round((lo + rng() * (hi - lo)) * 10) / 10;

  const sizes: Array<"20" | "40"> = [...Array<"40">(forties).fill("40"), ...Array<"20">(twenties).fill("20")];
  for (let i = sizes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); // Fisher-Yates shuffle so sizes interleave
    [sizes[i], sizes[j]] = [sizes[j], sizes[i]];
  }
  const pods = DEMO_PORTS.filter((p) => p.sequence > 0).map((p) => p.locode);

  const base = sizes.map((size, i): Container => {
    const reefer = rng() < 0.08;
    const imdg = !reefer && rng() < 0.03;
    return {
      id: makeContainerId(firstSerial + i),
      size,
      type: reefer ? "REEFER" : "DRY",
      high_cube: size === "40" && rng() < 0.3,
      weight_t: size === "20" ? between(4, 28) : between(4, 30),
      pol: DEMO_PORTS[0].locode,
      pod: pick(pods),
      imdg_class: imdg ? pick(IMDG_CLASSES) : null,
      oog: false,
    };
  });

  let nextSerial = firstSerial + base.length;
  const special: Container[] = [];
  for (const [key, count] of Object.entries(specialCounts) as ["45" | "OPEN_TOP" | "FLAT_RACK" | "TANK", number][]) {
    const size: ContainerSize = key === "45" ? "45" : "40";
    const type: ContainerType = key === "45" ? "DRY" : (key as ContainerType);
    for (let i = 0; i < (count ?? 0); i++) {
      special.push({
        id: makeContainerId(nextSerial++),
        size,
        type,
        high_cube: false,
        weight_t: between(4, 30),
        pol: DEMO_PORTS[0].locode,
        pod: pick(pods),
        imdg_class: null,
        oog: false,
      });
    }
  }

  return [...base, ...special];
}
