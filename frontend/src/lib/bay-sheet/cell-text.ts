/**
 * cell-text.ts — what a BIG bay-sheet cell prints, SEACOS info-area style (stage-swap plan, phase 03):
 * a short POD and the weight, in an ink that stays readable on the cell's colour.
 */

/** The location part of a 5-letter UN/LOCODE (`SGSIN` → `SIN`); anything else, as is, at most 3 chars. */
export const shortPod = (locode: string): string =>
  /^[A-Z]{2}[A-Z0-9]{3}$/.test(locode) ? locode.slice(2) : locode.slice(0, 3);

/** Weight to one decimal (`22.25` → `"22.3"`); integers keep the decimal so a column reads evenly. */
export const cellWeightText = (t: number): string => t.toFixed(1);

/** The app's ink (`--ink`) and white — the two text colours a cell can take. */
export const INK_DARK = "#1D2B36";
export const INK_LIGHT = "#FFFFFF";

/** sRGB channels 0–255 of `#rgb`, `#rrggbb` or `hsl(h, s%, l%)` (the weight ramp's format); null otherwise. */
function rgbOf(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const hsl = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(c);
  if (!hsl) return null;
  const [h, s, l] = [Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return Math.round(v * 255);
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** WCAG relative luminance of sRGB channels. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const DARK_LUMINANCE = luminance([0x1d, 0x2b, 0x36]);

/** The ink with the higher contrast on `background`. Unknown formats get the dark ink (the app's text). */
export function readableInk(background: string): string {
  const rgb = rgbOf(background);
  if (!rgb) return INK_DARK;
  const l = luminance(rgb);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / (DARK_LUMINANCE + 0.05);
  return onWhite > onDark ? INK_LIGHT : INK_DARK;
}
