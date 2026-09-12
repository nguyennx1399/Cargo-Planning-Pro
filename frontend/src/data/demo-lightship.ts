// SYNTHETIC lightship + constant (fuel/water/stores/crew, lumped) weight items for the demo
// vessel's indicative stability calc. Tuned empirically against the demo hull's ACTUAL computed
// hydrostatic table (see engine/__tests__/stability-indicative.test.ts's "demo full load"
// case) so GM stays sane both empty and fully loaded — not analytically derived, since this
// hull's own Cb is itself an approximation (see demo-horizon-geometry.ts's cb comment).
import type { WeightItem } from "@/engine/stability-indicative";

export const DEMO_LIGHTSHIP: WeightItem = { weight_t: 13000, lcg_m: 75, tcg_m: 0, kg_m: 9.5 };
export const DEMO_CONSTANT: WeightItem = { weight_t: 1500, lcg_m: 70, tcg_m: 0, kg_m: 4 };
