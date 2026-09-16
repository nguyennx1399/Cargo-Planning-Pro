import type { Container, PortCall } from "@/types/domain";
import type { ColorMode, PaletteMode } from "@/store/usePlanStore";

// Discharge-port palette, ordered by rotation sequence (first discharge port first).
const POD_PALETTE = [
  "#C8553D",
  "#E0A030",
  "#2E8B8B",
  "#3D5A99",
  "#7A5195",
  "#5B8C3A",
];

// Okabe & Ito (2008) qualitative palette — the standard colorblind-safe categorical set,
// distinguishable under deuteranopia/protanopia/tritanopia (unlike POD_PALETTE, whose
// red-orange vs green pair is a classic red-green confusion risk for POD mode's 1:1 category
// distinction). Same length/order convention as POD_PALETTE (index i % length, wraps past 6 ports).
const POD_PALETTE_COLORBLIND = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
];

export function podColorMap(
  ports: PortCall[],
  paletteMode: PaletteMode = "default",
): Record<string, string> {
  const palette =
    paletteMode === "colorblind" ? POD_PALETTE_COLORBLIND : POD_PALETTE;
  const out: Record<string, string> = {};
  [...ports]
    .filter((p) => p.sequence > 0)
    .sort((a, b) => a.sequence - b.sequence)
    .forEach((p, i) => (out[p.locode] = palette[i % palette.length]));
  return out;
}

function weightColor(t: number): string {
  // 0t light -> 30t dark
  const k = Math.min(1, Math.max(0, t / 30));
  const l = Math.round(82 - k * 50);
  return `hsl(210, 35%, ${l}%)`;
}

const TYPE_COLORS: Record<Container["type"], string> = {
  DRY: "#9AA5B1",
  REEFER: "#3A86C8",
  OPEN_TOP: "#B08D57",
  FLAT_RACK: "#8C6E54",
  TANK: "#6C8E5B",
};

export function containerColor(
  c: Container,
  mode: ColorMode,
  pods: Record<string, string>,
): string {
  if (mode === "weight") return weightColor(c.weight_t);
  if (mode === "type") return c.imdg_class ? "#D64545" : TYPE_COLORS[c.type];
  return pods[c.pod] ?? "#999999";
}

export const HIGHLIGHT = {
  hover: "#FFFFFF",
  selected: "#FFD23F",
  ghost: "#42A5F5",
  /** Drop-target tints, one per `verdictOf` outcome (Phase C, decision D1) — NEVER derived from a
   * UI-local rule: green = accepted clean, amber = accepted but recorded (an overridable limit like
   * `overstow`, which the plan-wide report still lists), red = refused. Hexes match the app tokens
   * `--ok` / `--signal` / `--error` in styles.css so the canvas and the panels agree. */
  valid: "#2E7D5B",
  warning: "#E0A030",
  invalid: "#B83A2E",
};
