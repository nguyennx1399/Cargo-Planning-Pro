#!/usr/bin/env node
/**
 * Procedural generator for the BBC SAO PAULO visual exterior GLB.
 *
 *   node scripts/build-bbc-sao-paulo-glb.mjs [out.glb]
 *   (default out: public/vessels/bbc-sao-paulo/bbc_sao_paulo_lod0.glb)
 *
 * Source of truth for dimensions: the vessel's stowage spec, src/data/vessel-specs/
 * bbc-sao-paulo.stowage.json (particulars, hatch covers, cranes — itself sourced from Confluence
 * "BBC SAO PAULO — 3D Model Production Plan", Section 0, with per-value confidence). Shapes that Section 0 does NOT give (hull form, superstructure massing, crane
 * proportions, bridge wings, mast, lifeboat, hull side openings, livery split) come from the
 * BBC-13K-500A GA drawing (BBC Chartering fleet sheet p.21: stem/stern profile, deck heights, crane
 * heights and jib stowage — confidence B) and a starboard-bow-quarter photo (livery, windows,
 * openings — C/D), tagged per node in `extras`.
 *
 * This is still NOT the Blender asset of Phases 1–21 — it is a dependency-free, reproducible
 * stand-in that is recognisably this ship (forward accommodation on a raised forecastle, full-beam
 * bridge wings, two yellow Liebherr cranes on the port side at 36.1 m spacing, six hatch sections,
 * blue hull with two rows of side openings, red antifouling). Visual only — not for construction,
 * stability analysis, cargo planning, navigation, class approval or fabrication.
 *
 * Authoring frame (unchanged from the previous placeholder, what GltfHull's offset expects):
 *   X: AP = 0 -> FP = LBP (bow +X), transom at −aft_end_to_ap_m · Y: keel = 0 -> up · Z: +starboard
 *   (port = −Z). Units: metres.
 *
 * Node tree follows Phase 8 of the Confluence plan; crane nodes are real pivots (slew about the
 * rotating_house Y axis, luff about the boom Z axis) so they can be animated later.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT =
  process.argv[2] ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../public/vessels/bbc-sao-paulo/bbc_sao_paulo_lod0.glb");

// ───────────────────────── Stowage spec (planning source of truth) ─────────────────────────
// Particulars, hatch covers, cranes and the accommodation's aft face are READ from the vessel's
// stowage spec — the same JSON the planner uses — so the picture always follows the data. Edit the
// JSON (and re-run this script), never these numbers.
const SPEC_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../src/data/vessel-specs/bbc-sao-paulo.stowage.json");
const SPEC = JSON.parse(readFileSync(SPEC_PATH, "utf8"));
const need = (v, what) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`stowage spec: ${what} is required to build the model`);
  return v;
};
const P = {
  loa: SPEC.particulars.loa_m,
  lbp: SPEC.particulars.lbp_m,
  beam: SPEC.particulars.beam_m,
  depth: SPEC.particulars.depth_m, // to the MAIN deck (13.2 m) — the hatch covers sit well above it
  draft: SPEC.particulars.summer_draft_m,
  maxHeight: SPEC.particulars.max_height_above_keel_m ?? 42.2,
};
const HALF_B = P.beam / 2;
const AFT_END = SPEC.particulars.aft_end_to_ap_m ?? P.loa - P.lbp; // GA: AP 2.74 m forward of the stern
const X_TRANSOM = -AFT_END;
const X_BOW = P.loa - AFT_END; // forward-most point (bulb / flare), LOA from the transom
const SHELL_TOP = need(SPEC.particulars.side_shell_top_above_keel_m, "particulars.side_shell_top_above_keel_m");
const HATCHES = SPEC.cargo_spaces
  .filter((s) => s.level === "weather_deck")
  .map((s) => ({
    id: s.id,
    x_aft: need(s.x_aft_m, `${s.id}.x_aft_m`),
    x_fwd: need(s.x_fwd_m, `${s.id}.x_fwd_m`),
    width: need(s.width_m, `${s.id}.width_m`),
    centerZ: s.center_z_m ?? 0,
    coverTop: need(s.surface_above_baseline_m, `${s.id}.surface_above_baseline_m`),
  }))
  .sort((a, b) => a.x_aft - b.x_aft);
const COVER_TOP = Math.min(...HATCHES.map((h) => h.coverTop));
const DECK_Y = COVER_TOP - 0.3; // side-deck plate just below the hatch-cover tops; side shell (bulwark) rises to SHELL_TOP
const CRANES = SPEC.cranes.map((c) => ({ id: c.id, x: need(c.x_m, `${c.id}.x_m`), z: need(c.z_m, `${c.id}.z_m`), swl: c.swl_t, tandem: c.tandem_swl_t }));
const CRANE_FOUNDATIONS = SPEC.obstructions.filter((o) => o.kind === "crane_pedestal" && o.id.endsWith("_foundation"));
const ACCOMMODATION = SPEC.obstructions.find((o) => o.kind === "superstructure");
const AFT_DECK_STRUCTURE = SPEC.obstructions.find((o) => o.id === "aft_deck_structure");

// ─── Shapes from the GA side view that aren't planning data (confidence B unless noted) ───
const FORECASTLE_X = need(ACCOMMODATION?.x_aft_m, "obstructions[accommodation].x_aft_m"); // aft face of the accommodation
const FORECASTLE_Y = 21.7; // forecastle deck ahead of the house (GA side view)
const ANTIFOULING_TOP_Y = 8.0; // red below, blue above (photo, C)

// ───────────────────────── math helpers ─────────────────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 1, 0];
};
const rad = (d) => (d * Math.PI) / 180;
const quatY = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
const quatZ = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
// 3×3 rotation matrices (row-major) applied as R·v
const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mulM = (A, B) => {
  const C = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) C[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
  return C;
};
const mulV = (M, v) => [
  M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
  M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
  M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
];

// ───────────────────────── mesh builder ─────────────────────────
class Mesh {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.idx = [];
  }
  get vcount() {
    return this.pos.length / 3;
  }
  v(p, n) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    return this.vcount - 1;
  }
  /** Flat-shaded quad; winding fixed so the face normal agrees with `out` (an outward hint). */
  quad(a, b, c, d, out) {
    let n = cross(sub(b, a), sub(c, a));
    if (len(n) < 1e-10) n = cross(sub(c, a), sub(d, a));
    if (len(n) < 1e-10) return;
    if (dot(n, out) < 0) [b, d] = [d, b];
    n = norm(dot(n, out) < 0 ? scale(n, -1) : n);
    const i = [a, b, c, d].map((p) => this.v(p, n));
    this.idx.push(i[0], i[1], i[2], i[0], i[2], i[3]);
  }
  tri(a, b, c, out) {
    let n = cross(sub(b, a), sub(c, a));
    if (len(n) < 1e-10) return;
    if (dot(n, out) < 0) [b, c] = [c, b];
    n = norm(dot(n, out) < 0 ? scale(n, -1) : n);
    const i = [a, b, c].map((p) => this.v(p, n));
    this.idx.push(i[0], i[1], i[2]);
  }
  append(m) {
    const off = this.vcount;
    for (let i = 0; i < m.pos.length; i++) {
      this.pos.push(m.pos[i]);
      this.nrm.push(m.nrm[i]);
    }
    for (let i = 0; i < m.idx.length; i++) this.idx.push(m.idx[i] + off);
    return this;
  }
  transform(R, T = [0, 0, 0]) {
    for (let i = 0; i < this.pos.length; i += 3) {
      const p = add(mulV(R, [this.pos[i], this.pos[i + 1], this.pos[i + 2]]), T);
      const n = mulV(R, [this.nrm[i], this.nrm[i + 1], this.nrm[i + 2]]);
      this.pos.splice(i, 3, ...p);
      this.nrm.splice(i, 3, ...n);
    }
    return this;
  }
}

/** Hexahedron from 8 corners indexed c[i*4 + j*2 + k] (i,j,k ∈ {0,1}). */
function hexa(m, c) {
  const center = scale(c.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / 8);
  const cyc = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  for (let axis = 0; axis < 3; axis++)
    for (let side = 0; side < 2; side++) {
      const pts = cyc.map(([u, v]) => {
        const bits = [0, 0, 0];
        bits[axis] = side;
        bits[(axis + 1) % 3] = u;
        bits[(axis + 2) % 3] = v;
        return c[bits[0] * 4 + bits[1] * 2 + bits[2]];
      });
      const fc = scale(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / 4);
      m.quad(pts[0], pts[1], pts[2], pts[3], sub(fc, center));
    }
  return m;
}
function box(m, [x0, y0, z0], [x1, y1, z1]) {
  const c = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) c.push([x, y, z]);
  return hexa(m, c);
}
/** Box centred on the segment p0→p1 with cross-section w (horizontal-ish) × h, optionally tapered. */
function beam(m, p0, p1, w, h, w1 = w, h1 = h) {
  const d = norm(sub(p1, p0));
  const up = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const s = norm(cross(d, up));
  const u = cross(s, d);
  const c = [];
  for (const [p, ww, hh] of [
    [p0, w, h],
    [p1, w1, h1],
  ])
    for (const js of [-1, 1]) for (const ks of [-1, 1]) c.push(add(add(p, scale(s, (js * ww) / 2)), scale(u, (ks * hh) / 2)));
  return hexa(m, c);
}
/** Faceted (optionally tapered) cylinder along +Y from y=0 to h, centred on the Y axis. */
function cylinderY(m, r0, r1, h, seg = 24, caps = true) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    const am = (a0 + a1) / 2;
    m.quad(p(r0, a0, 0), p(r0, a1, 0), p(r1, a1, h), p(r1, a0, h), [Math.cos(am), 0, Math.sin(am)]);
    if (caps) {
      m.tri([0, h, 0], p(r1, a0, h), p(r1, a1, h), [0, 1, 0]);
      m.tri([0, 0, 0], p(r0, a0, 0), p(r0, a1, 0), [0, -1, 0]);
    }
  }
  return m;
}
/** Vertical prism from a closed XZ polygon (star-shaped about its centroid). */
function prism(m, poly, y0, y1) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const mid = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
    m.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], mid);
    m.tri([cx, y1, cz], [a[0], y1, a[1]], [b[0], y1, b[1]], [0, 1, 0]);
    m.tri([cx, y0, cz], [a[0], y0, a[1]], [b[0], y0, b[1]], [0, -1, 0]);
  }
  return m;
}
/** Smooth-shaded surface through grid[i][k]; `flip` reverses winding (port side mirror). */
function smoothGrid(m, grid, flip) {
  const ni = grid.length;
  const nk = grid[0].length;
  const acc = grid.map((row) => row.map(() => [0, 0, 0]));
  const faces = [];
  for (let i = 0; i < ni - 1; i++)
    for (let k = 0; k < nk - 1; k++) {
      const q = [
        [i, k],
        [i + 1, k],
        [i + 1, k + 1],
        [i, k + 1],
      ];
      if (flip) q.reverse();
      faces.push(q);
      for (const [a, b, c] of [
        [q[0], q[1], q[2]],
        [q[0], q[2], q[3]],
      ]) {
        const P0 = grid[a[0]][a[1]];
        const n = cross(sub(grid[b[0]][b[1]], P0), sub(grid[c[0]][c[1]], P0));
        for (const v of [a, b, c]) acc[v[0]][v[1]] = add(acc[v[0]][v[1]], n);
      }
    }
  const base = m.vcount;
  for (let i = 0; i < ni; i++) for (let k = 0; k < nk; k++) m.v(grid[i][k], norm(acc[i][k]));
  const id = ([i, k]) => base + i * nk + k;
  for (const q of faces) m.idx.push(id(q[0]), id(q[1]), id(q[2]), id(q[0]), id(q[2]), id(q[3]));
}

// ───────────────────────── hull form (profiles from the GA side view, sections approximate) ─────────────────────────
const interp = (table, y) => {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [y0, x0] = table[i - 1];
    const [y1, x1] = table[i];
    if (y <= y1) return lerp(x0, x1, (y - y0) / (y1 - y0));
  }
  return table[table.length - 1][1];
};
/** Stem profile (x from AP) by height above keel, scaled off the GA side view: large bulb reaching
 * the LOA end at 4–6 m, stem at the 8.5 m summer WL = FP (x = LBP), flare back out to the LOA end at
 * ~16 m, then the forecastle top. (B) */
const STEM_TABLE = [
  [0, 136.0], [0.5, 140.4], [2.0, 144.9], [4.0, 147.0], [5.5, X_BOW], [6.5, 146.6], [7.5, 144.3],
  [8.5, P.lbp], [10.0, 143.7], [13.2, 145.7], [16.0, X_BOW], [18.8, 146.6], [FORECASTLE_Y, 145.9],
];
function stemX(y) {
  return interp(STEM_TABLE, y);
}
/** Aft profile: propeller boss below ~5.8 m, counter sweeping aft to the vertical transom at 8.4 m
 * (GA side view). (B) */
function sternX(y) {
  if (y <= 5.8) return 4.4;
  if (y >= 8.4) return X_TRANSOM;
  const t = (y - 5.8) / 2.6;
  return 4.4 + (X_TRANSOM - 4.4) * (1 - (1 - t) * (1 - t));
}
const BILGE_R = 1.8;
const XF = 104; // forward end of parallel body
const XA = 22; // aft end of parallel body
function halfBreadth(x, y) {
  let f = 1;
  if (y < BILGE_R) f = (HALF_B - BILGE_R + Math.sqrt(Math.max(0, BILGE_R ** 2 - (BILGE_R - y) ** 2))) / HALF_B;
  if (x > XF) {
    const s = clamp((x - XF) / (stemX(y) - XF), 0, 1);
    const u = clamp(y / 16, 0, 1);
    const n = lerp(1.5, 2.6, u);
    const mm = lerp(1.2, 2.2, u); // fuller + flared toward the deck — blunt "LakerMax" bow
    f *= Math.pow(Math.max(0, 1 - Math.pow(s, n)), 1 / mm);
  }
  if (x < XA) {
    const s = clamp((XA - x) / (XA - sternX(y)), 0, 1);
    const low = Math.pow(Math.max(0, 1 - Math.pow(s, 1.9)), 1 / 1.35);
    const up = 1 - 0.12 * Math.pow(s, 2.5); // wide transom (GA main-deck plan: near-full beam aft)
    f *= lerp(low, up, smoothstep(5.5, 8.8, y));
  }
  return HALF_B * f;
}
const cosSpacing = (n) => Array.from({ length: n + 1 }, (_, i) => 0.5 - 0.5 * Math.cos((Math.PI * i) / n));

/** One side-shell band between the given absolute heights; returns [stbdGrid, portGrid]. */
function shellBand(levels, xFrom, xTo, samples = cosSpacing(140)) {
  const stbd = samples.map((s) => levels.map((y) => {
    const x = lerp(xFrom(y), xTo(y), s);
    return [x, y, halfBreadth(x, y)];
  }));
  const port = stbd.map((row) => row.map(([x, y, z]) => [x, y, -z]));
  return [stbd, port];
}
function addShell(m, levels, xFrom, xTo, samples, { transom = true, bottom = false } = {}) {
  const [stbd, port] = shellBand(levels, xFrom, xTo, samples);
  smoothGrid(m, stbd, false);
  smoothGrid(m, port, true);
  if (transom)
    for (let k = 0; k < levels.length - 1; k++)
      m.quad(stbd[0][k], stbd[0][k + 1], port[0][k + 1], port[0][k], [-1, 0, 0]);
  if (bottom)
    for (let i = 0; i < stbd.length - 1; i++) m.quad(stbd[i][0], stbd[i + 1][0], port[i + 1][0], port[i][0], [0, -1, 0]);
}
function deckPlate(m, y, x0, x1, step = 0.8, inset = 0) {
  const n = Math.max(2, Math.ceil((x1 - x0) / step));
  for (let i = 0; i < n; i++) {
    const xa = lerp(x0, x1, i / n);
    const xb = lerp(x0, x1, (i + 1) / n);
    const wa = Math.max(0, halfBreadth(xa, y) - inset);
    const wb = Math.max(0, halfBreadth(xb, y) - inset);
    m.quad([xa, y, wa], [xb, y, wb], [xb, y, -wb], [xa, y, -wa], [0, 1, 0]);
  }
}

// ───────────────────────── materials ─────────────────────────
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const MATERIALS = {};
function material(name, hex, metallic, roughness, extra = {}) {
  const rgb = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  MATERIALS[name] = {
    name,
    pbrMetallicRoughness: { baseColorFactor: [...rgb.map((v) => +v.toFixed(4)), 1], metallicFactor: metallic, roughnessFactor: roughness },
    doubleSided: true,
    ...extra,
  };
}
// Colours sampled from the reference photo (confidence C — no RAL spec published).
material("hull_blue", "#2C6FD4", 0.15, 0.55);
material("antifouling_red", "#9A2F26", 0.05, 0.8);
material("superstructure_white", "#F5F7F9", 0.0, 0.6);
material("deck_steel", "#5F6368", 0.3, 0.75);
material("hatch_darkgray", "#474B50", 0.3, 0.65);
material("crane_yellow", "#FFC20E", 0.1, 0.5);
material("window_glass", "#1A2430", 0.6, 0.15);
material("opening_dark", "#3B2226", 0.1, 0.9);
material("trim_dark", "#222428", 0.4, 0.6);
material("railing_gray", "#C3C9CF", 0.4, 0.5);
material("lifeboat_orange", "#F0641E", 0.05, 0.5);
material("propeller_bronze", "#B38A4E", 0.85, 0.35);
material("nav_red", "#FF2A1F", 0, 0.5, { emissiveFactor: [1, 0.05, 0.02] });
material("nav_green", "#1FFF4A", 0, 0.5, { emissiveFactor: [0.05, 1, 0.2] });
material("nav_white", "#FFFFFF", 0, 0.5, { emissiveFactor: [1, 1, 1] });

/** Scene-graph node: { name, t?, r?, extras?, parts: Map<material, Mesh>, children: [] } */
function node(name, opts = {}) {
  const n = { name, children: [], parts: new Map(), ...opts };
  n.mesh = (mat) => {
    if (!MATERIALS[mat]) throw new Error(`unknown material ${mat}`);
    if (!n.parts.has(mat)) n.parts.set(mat, new Mesh());
    return n.parts.get(mat);
  };
  n.add = (...c) => {
    n.children.push(...c);
    return n;
  };
  return n;
}

// ───────────────────────── HULL ─────────────────────────
function buildHull() {
  const hull = node("hull");
  const shell = node("hull_shell", { extras: { confidence: "B/C", note: "Stem/stern profiles and deck heights scaled from the BBC-13K-500A GA; sections approximate (no lines plan)" } });
  const lowLevels = [0, 0.12, 0.35, 0.7, 1.15, 1.8, 2.6, 3.4, 4.2, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, ANTIFOULING_TOP_Y];
  const topLevels = [ANTIFOULING_TOP_Y, 8.4, 8.8, 9.6, 10.6, 11.8, P.depth, 14.6, 16.0, 17.4, SHELL_TOP];
  addShell(shell.mesh("antifouling_red"), lowLevels, sternX, stemX, undefined, { bottom: true });
  addShell(shell.mesh("hull_blue"), topLevels, sternX, stemX);
  // Raised forecastle topsides ahead of the accommodation's aft face (blue band under the white house)
  const fcSamples = Array.from({ length: 41 }, (_, i) => Math.sin((Math.PI / 2) * (i / 40)));
  addShell(shell.mesh("hull_blue"), [SHELL_TOP, 20.2, FORECASTLE_Y], () => FORECASTLE_X, stemX, fcSamples, { transom: false });

  // Two rows of rectangular side openings along the cargo section (both sides) — photo (C)
  const openings = node("hull_side_openings", { extras: { confidence: "C", note: "Count/spacing photo-estimated" } });
  const om = openings.mesh("opening_dark");
  const rows = [
    { y0: 16.9, y1: 17.9, x0: X_TRANSOM + 1.5, x1: 104 },
    { y0: 14.5, y1: 15.5, x0: 10, x1: 100 },
  ];
  for (const r of rows)
    for (let xc = r.x0; xc <= r.x1; xc += 1.9) {
      const yc = (r.y0 + r.y1) / 2;
      const z = halfBreadth(xc, yc) + 0.03;
      for (const sgn of [1, -1]) box(om, [xc - 0.65, r.y0, sgn * z - 0.04], [xc + 0.65, r.y1, sgn * z + 0.04]);
    }

  const thruster = node("bow_thruster", { extras: { confidence: "D", note: "850 kW tunnel (A); position generic" } });
  const tm = thruster.mesh("trim_dark");
  for (const sgn of [1, -1]) {
    const x = 135;
    const y = 4.6;
    const z = halfBreadth(x, y) + 0.02;
    tm.append(cylinderY(new Mesh(), 0.95, 0.95, 0.06, 24).transform(rotX(Math.PI / 2), [x, y, sgn * (z + 0.12)]));
  }

  // Propeller: single FPP (A), ~5.9 m diameter and position scaled off the GA side view (B); blade shape generic (D).
  const PROP_X = 3.0;
  const PROP_Y = 3.0;
  const prop = node("propeller", { t: [PROP_X, PROP_Y, 0], extras: { confidence: "B (position, diameter) / D (blades)", spin_axis: "x" } });
  const pm = prop.mesh("propeller_bronze");
  pm.append(cylinderY(new Mesh(), 0.6, 0.5, 1.4, 16).transform(rotZ(-Math.PI / 2), [-0.7, 0, 0]));
  for (let b = 0; b < 4; b++) {
    const blade = box(new Mesh(), [-0.12, 0.5, -0.75], [0.12, 2.9, 0.75]);
    blade.transform(rotY(rad(28)));
    blade.transform(rotX((b * Math.PI) / 2));
    pm.append(blade);
  }
  const boss = node("stern_tube_boss");
  boss.mesh("antifouling_red").append(cylinderY(new Mesh(), 0.55, 0.85, 2.4, 16).transform(rotZ(-Math.PI / 2), [3.7, PROP_Y, 0]));

  // Rudder aft of the prop, spanning ~0.3–8.4 m and ~−2.5…+2.1 m from AP on the GA side view (B). Node origin = stock ≈ AP.
  const rudder = node("rudder", { t: [0.4, 0, 0], extras: { confidence: "B (extent) / D (section)", steer_axis: "y" } });
  const rm = rudder.mesh("antifouling_red");
  hexa(rm, [
    // corner order c[i*4+j*2+k]: i = aft/fwd, j = bottom/top, k = port/stbd; tapered trailing edge
    [-2.9, 0.3, -0.12], [-2.9, 0.3, 0.12], [-2.9, 8.6, -0.15], [-2.9, 8.6, 0.15],
    [1.7, 0.3, -0.4], [1.7, 0.3, 0.4], [1.7, 8.6, -0.45], [1.7, 8.6, 0.45],
  ]);

  return hull.add(shell, openings, thruster, prop, boss, rudder);
}

// ───────────────────────── DECK + HATCHES ─────────────────────────
function buildCargoDeck() {
  const deck = node("cargo_deck", { extras: { confidence: "B", y_m: DECK_Y } });
  deckPlate(deck.mesh("deck_steel"), DECK_Y, X_TRANSOM, FORECASTLE_X);
  const fc = node("forecastle_deck");
  deckPlate(fc.mesh("deck_steel"), FORECASTLE_Y, FORECASTLE_X, stemX(FORECASTLE_Y) - 0.05, 0.5);
  // accommodation aft face below the white house (deck -> forecastle deck)
  const bm = fc.mesh("superstructure_white");
  const ys = [DECK_Y, SHELL_TOP, 20.2, FORECASTLE_Y];
  for (let k = 0; k < ys.length - 1; k++) {
    const w0 = halfBreadth(FORECASTLE_X, ys[k]);
    const w1 = halfBreadth(FORECASTLE_X, ys[k + 1]);
    bm.quad([FORECASTLE_X, ys[k], w0], [FORECASTLE_X, ys[k + 1], w1], [FORECASTLE_X, ys[k + 1], -w1], [FORECASTLE_X, ys[k], -w0], [-1, 0, 0]);
  }
  if (AFT_DECK_STRUCTURE) {
    const o = AFT_DECK_STRUCTURE;
    box(fc.mesh("hatch_darkgray"), [Math.max(o.x_aft_m, X_TRANSOM + 0.3), DECK_Y, o.z_min_m], [o.x_fwd_m, DECK_Y + 1.2, o.z_max_m]);
  }
  return deck.add(fc);
}

function buildHatches() {
  const group = node("hatch_group", {
    extras: { source: "stowage spec cargo_spaces (weather_deck)", sections_aft_to_fwd_m: HATCHES.map((h) => +(h.x_fwd - h.x_aft).toFixed(2)) },
  });
  const COVER_THICKNESS = 0.55;
  for (const { id, x_aft, x_fwd, width, centerZ, coverTop } of HATCHES) {
    const L = x_fwd - x_aft;
    const COAMING_TOP = coverTop - COVER_THICKNESS;
    const x0 = x_aft + 0.2;
    const x1 = x_fwd - 0.2;
    const maxHalf = Math.min(halfBreadth(x0, DECK_Y), halfBreadth(x1, DECK_Y)) - 0.35;
    const zMin = Math.max(centerZ - width / 2, -maxHalf);
    const zMax = Math.min(centerZ + width / 2, maxHalf);
    const h = node(id, { extras: { length_m: +L.toFixed(2), width_m: width, x_aft_m: x_aft, cover_top_above_keel_m: coverTop } });
    const m = h.mesh("hatch_darkgray");
    box(m, [x0, DECK_Y, zMin], [x1, COAMING_TOP, zMax]); // coaming
    box(m, [x0 - 0.1, COAMING_TOP, zMin - 0.12], [x1 + 0.1, coverTop, zMax + 0.12]); // cover
    const panels = Math.max(1, Math.round(L / 7.6));
    const seams = h.mesh("trim_dark");
    for (let p = 1; p < panels; p++) {
      const xs = lerp(x0, x1, p / panels);
      box(seams, [xs - 0.12, coverTop, zMin - 0.12], [xs + 0.12, coverTop + 0.1, zMax + 0.12]);
    }
    box(seams, [x0, coverTop, centerZ - 0.1], [x1, coverTop + 0.06, centerZ + 0.1]); // centre joint
    group.add(h);
  }
  return group;
}

// ───────────────────────── SUPERSTRUCTURE (forward) ─────────────────────────
function housePoly(xAft, xFront, inset, samples = 16) {
  const side = [];
  for (let i = 0; i <= samples; i++) {
    const x = lerp(xAft, xFront, i / samples);
    side.push([x, Math.max(0.5, halfBreadth(x, FORECASTLE_Y) - inset)]);
  }
  return [...side.map(([x, z]) => [x, z]), ...side.reverse().map(([x, z]) => [x, -z])];
}
function inflate(poly, d) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  return poly.map(([x, z]) => [x + Math.sign(x - cx) * d, z + Math.sign(z) * d]);
}

function buildSuperstructure() {
  const sup = node("superstructure", {
    extras: { confidence: "B/C", note: "Aft face, forecastle deck (21.7 m), bridge deck (~31 m) and roof (~33.4 m) scaled from the GA side view; tiers/windows from the photo" },
  });
  const X0 = FORECASTLE_X;
  const acc = node("accommodation");
  const wm = acc.mesh("superstructure_white");
  const windows = node("windows", { extras: { confidence: "C/D" } });
  const gm = windows.mesh("window_glass");
  const TIERS = [
    { y0: FORECASTLE_Y, y1: 24.3, inset: 1.0, xAft: X0, xFront: 138.6 },
    { y0: 24.3, y1: 26.9, inset: 1.1, xAft: X0, xFront: 138.2 },
    { y0: 26.9, y1: 29.5, inset: 1.25, xAft: X0 + 0.2, xFront: 137.8 },
  ];
  for (const t of TIERS) {
    prism(wm, housePoly(t.xAft, t.xFront, t.inset), t.y0, t.y1);
    const yc = (t.y0 + t.y1) / 2;
    for (let x = t.xAft + 1.6; x < t.xAft + 11.5; x += 2.7) {
      const z = halfBreadth(x, FORECASTLE_Y) - t.inset + 0.03;
      for (const s of [1, -1]) box(gm, [x - 0.45, yc - 0.45, s * z - 0.03], [x + 0.45, yc + 0.45, s * z + 0.03]);
    }
    for (let z = -7.5; z <= 7.5; z += 3.0) box(gm, [t.xAft - 0.04, yc - 0.45, z - 0.45], [t.xAft + 0.01, yc + 0.45, z + 0.45]);
    const fz = halfBreadth(t.xFront, FORECASTLE_Y) - t.inset - 1.2;
    for (let z = -fz; z <= fz + 1e-6; z += Math.max(1.5, (2 * fz) / 3)) box(gm, [t.xFront - 0.01, yc - 0.4, z - 0.45], [t.xFront + 0.05, yc + 0.4, z + 0.45]);
  }
  // The accommodation block between the main deck and the forecastle deck sits inside the blue forecastle shell.
  prism(wm, housePoly(X0, 138.6, 0.6), DECK_Y, FORECASTLE_Y);

  const bridge = node("bridge");
  const bm = bridge.mesh("superstructure_white");
  const bPoly = housePoly(X0 + 2.3, 137.4, 1.6);
  prism(bm, bPoly, 29.5, 32.4);
  prism(gm, inflate(bPoly, 0.06), 30.7, 32.0); // continuous bridge window band
  prism(bm, inflate(bPoly, 0.3), 32.4, 32.8); // roof with overhang
  const BR = 32.8;
  const exhaust = bridge.mesh("trim_dark");
  box(exhaust, [X0 + 2.8, BR, -2.4], [X0 + 5.4, BR + 1.8, -0.6]);
  box(exhaust, [X0 + 2.8, BR, 0.6], [X0 + 5.4, BR + 1.2, 2.4]);

  const wings = node("bridge_wings", { extras: { confidence: "B", note: "Bridge-deck level ~29.8–31 m and beam-wide extent per GA side view / photo" } });
  const wgm = wings.mesh("superstructure_white");
  box(wgm, [130.5, 29.0, -12.6], [136.5, 30.7, 12.6]);
  const wgw = wings.mesh("window_glass");
  for (const s of [1, -1]) {
    const zi = s * 10.9;
    const zo = s * 12.6;
    box(wgw, [131.1, 30.7, Math.min(zi, zo)], [135.9, 31.9, Math.max(zi, zo)]);
  }

  const mast = node("mast", { extras: { confidence: "D", note: "Top set to max height above keel (42.2 m, A)" } });
  const mm = mast.mesh("trim_dark");
  const MX = 132.4;
  const top = 40.9;
  for (const dx of [-0.85, 0.85]) for (const dz of [-0.85, 0.85]) beam(mm, [MX + dx * 1.3, BR, dz * 1.3], [MX + dx, top, dz], 0.22, 0.22);
  for (let y = BR + 1.8; y < top; y += 2.0) {
    const r = lerp(1.3, 1, (y - BR) / (top - BR)) * 0.85;
    box(mm, [MX - r, y - 0.08, -r], [MX + r, y + 0.08, r]);
  }
  box(mm, [MX - 0.15, 38.2, -3.6], [MX + 0.15, 38.4, 3.6]); // yardarm
  box(mm, [MX + 0.2, 35.6, -1.6], [MX + 3.2, 35.8, 1.6]); // radar platform
  box(mm, [MX + 1.6, 36.3, -2.9], [MX + 1.9, 36.6, 2.9]); // X-band scanner
  box(mm, [MX - 0.4, top, -0.4], [MX + 0.4, top + 0.25, 0.4]);
  mm.append(cylinderY(new Mesh(), 0.09, 0.07, P.maxHeight - top - 0.25 - 0.3, 8).transform(rotY(0), [MX, top + 0.25, 0]));
  beam(mm, [X0 + 1.0, BR, 3.6], [X0 + 1.0, 38.0, 3.6], 0.22, 0.22); // aft signal mast
  box(mm, [X0 + 0.85, 37.2, 1.8], [X0 + 1.15, 37.35, 5.4]);

  const lights = node("lights", { extras: { confidence: "D" } });
  box(lights.mesh("nav_green"), [135.3, 30.9, 12.6], [135.8, 31.3, 12.75]); // starboard sidelight
  box(lights.mesh("nav_red"), [135.3, 30.9, -12.75], [135.8, 31.3, -12.6]); // port sidelight
  box(lights.mesh("nav_white"), [MX - 0.18, P.maxHeight - 0.3, -0.18], [MX + 0.18, P.maxHeight, 0.18]); // masthead

  sup.add(acc, bridge, wings, windows, mast);
  return { sup, lights };
}

// ───────────────────────── CRANES (port side, rigged) ─────────────────────────
// GA side view: pedestal from the deck to the house at ~30 m abl, house/gantry to ~38 m, jib heel
// ~27 m abl on the pedestal front, jib stowed FORWARD almost horizontal along the port side onto a
// rest (crane 1 ends at crane 2's foundation, crane 2 at the accommodation). Jib length is set so
// the stowed tips land there; the 40.3 m max radius (A) is consistent with it. (B/C)
const HOUSE_BASE_Y = 30.0;
const JIB_HEEL = [2.2, 27.0 - HOUSE_BASE_Y, 0]; // in rotating_house frame
const GANTRY_TOP = [-1.2, 7.8, 0];
const JIB_LENGTH = 37.2;
const STOW_SLEW_OUTBOARD_DEG = 2.5; // GA plan: jib runs slightly outboard towards its rest
const STOW_LUFF_DEG = -1;

function buildCrane({ id: name, x, z, swl, tandem }) {
  const crane = node(name, {
    t: [x, DECK_Y, z],
    extras: { maker: "Liebherr", swl_t: swl, tandem_swl_t: tandem, source: "stowage spec cranes[] + GA side view", confidence: "A (SWL/chart) / B (position, heights) / C (proportions)" },
  });
  const pedH = HOUSE_BASE_Y - DECK_Y;
  const ped = node(`${name}_pedestal`);
  ped.mesh("crane_yellow").append(cylinderY(new Mesh(), 1.45, 1.9, pedH, 28));
  const slew = rad(STOW_SLEW_OUTBOARD_DEG); // local +X -> forward and slightly outboard (−Z) for a port crane
  const house = node(`${name}_rotating_house`, { t: [0, pedH, 0], r: quatY(slew), extras: { animate: "rotation.y = slew" } });
  const hm = house.mesh("crane_yellow");
  box(hm, [-4.4, 0, -2.6], [2.8, 5.0, 2.6]); // machinery house
  box(hm, [-5.6, 0.4, -2.2], [-4.4, 4.0, 2.2]); // counterweight
  for (const zz of [-2.0, 2.0]) {
    beam(hm, [-3.8, 5.0, zz], [GANTRY_TOP[0], GANTRY_TOP[1], zz * 0.45], 0.6, 0.6);
    beam(hm, [1.8, 5.0, zz], [GANTRY_TOP[0], GANTRY_TOP[1], zz * 0.45], 0.5, 0.5);
  }
  box(hm, [GANTRY_TOP[0] - 0.6, GANTRY_TOP[1] - 0.4, -1.3], [GANTRY_TOP[0] + 0.6, GANTRY_TOP[1] + 0.4, 1.3]);
  box(hm, [1.4, 2.4, 2.6], [3.4, 4.6, 3.9]); // operator cab (inboard side)
  box(house.mesh("window_glass"), [3.4, 3.0, 2.7], [3.45, 4.4, 3.8]);
  beam(hm, [1.2, 0, 0], [JIB_HEEL[0], JIB_HEEL[1], 0], 1.6, 1.6); // heel bracket down the pedestal front

  const luff = rad(STOW_LUFF_DEG);
  const boom = node(`${name}_boom`, { t: JIB_HEEL, r: quatZ(luff), extras: { animate: "rotation.z = luff", length_m: JIB_LENGTH } });
  const bm = boom.mesh("crane_yellow");
  beam(bm, [0, 0, 0], [JIB_LENGTH, 0, 0], 1.9, 1.7, 0.9, 0.9);
  box(bm, [JIB_LENGTH - 0.4, -0.9, -0.6], [JIB_LENGTH + 0.8, 0.7, 0.6]); // head sheaves

  const tip = add(JIB_HEEL, [JIB_LENGTH * Math.cos(luff), JIB_LENGTH * Math.sin(luff), 0]);
  const hookY = tip[1] - 2.0; // hook block hoisted up under the jib head for sea passage
  const cable = node(`${name}_cable`);
  const cm = cable.mesh("trim_dark");
  beam(cm, GANTRY_TOP, [tip[0] - 0.5, tip[1] + 0.4, 0], 0.14, 0.14); // luffing ropes
  beam(cm, [tip[0] + 0.3, tip[1] - 0.6, 0], [tip[0] + 0.3, hookY + 0.7, 0], 0.1, 0.1); // hoist rope
  const hook = node(`${name}_hook`, { t: [tip[0] + 0.3, hookY, 0] });
  box(hook.mesh("trim_dark"), [-0.5, -0.7, -0.35], [0.5, 0.7, 0.35]);
  beam(hook.mesh("crane_yellow"), [0, -0.7, 0], [0, -1.5, 0], 0.25, 0.25);
  house.add(boom, cable, hook);

  // Jib rest under the stowed tip (world position of the tip, expressed in the crane node frame)
  const tipLocal = [Math.cos(slew) * tip[0], pedH + tip[1], -Math.sin(slew) * tip[0]];
  const rest = node(`${name}_jib_rest`);
  beam(rest.mesh("crane_yellow"), [tipLocal[0] - 0.6, 0, tipLocal[2]], [tipLocal[0] - 0.6, tipLocal[1] - 0.9, tipLocal[2]], 0.5, 0.5);

  crane.extras.stowed_hook_bottom_above_keel_m = +(DECK_Y + pedH + hookY - 1.5).toFixed(2);
  crane.extras.stowed_jib_tip_x_m = +(x + tipLocal[0]).toFixed(2);
  return crane.add(ped, house, rest);
}

function buildCraneFoundations() {
  const g = node("crane_foundations", { extras: { source: "stowage spec obstructions (GA grey blocks)", confidence: "B" } });
  for (const o of CRANE_FOUNDATIONS) box(g.mesh("crane_yellow"), [o.x_aft_m, DECK_Y, o.z_min_m], [o.x_fwd_m, DECK_Y + 1.4, Math.min(o.z_max_m, -0.1)]);
  return g;
}

// ───────────────────────── DECK EQUIPMENT / RAILINGS ─────────────────────────
function buildDeckEquipment() {
  const eq = node("deck_equipment", { extras: { confidence: "D" } });
  const g = eq.mesh("trim_dark");
  for (const z of [-7.2, 7.2]) box(g, [-1.8, DECK_Y, z - 1.2], [0.4, DECK_Y + 1.3, z + 1.2]); // aft mooring winches
  for (const [x, z] of [[-1.9, -9.6], [-1.9, 9.6], [4.8, -10.4], [4.8, 10.4], [141.0, -3.5], [141.0, 3.5]]) {
    const y = x > 100 ? FORECASTLE_Y : DECK_Y;
    g.append(cylinderY(new Mesh(), 0.3, 0.3, 0.8, 10).transform(rotY(0), [x, y, z]));
  }
  for (const s of [1, -1]) {
    const x = 141.5;
    const y = 16.8;
    const z = halfBreadth(x, y) + 0.02;
    box(g, [x - 0.7, y - 0.55, s * z - 0.05], [x + 0.7, y + 0.55, s * z + 0.05]); // anchor pockets
  }
  // Lifeboat (starboard, just aft of the accommodation, as in the photo — not on the GA)
  const boat = node("lifeboat", { extras: { confidence: "C" } });
  const om = boat.mesh("lifeboat_orange");
  const bx = FORECASTLE_X - 7.0;
  om.append(cylinderY(new Mesh(), 1.25, 1.25, 6.6, 18).transform(rotZ(-Math.PI / 2), [bx, DECK_Y + 3.4, 10.6]));
  box(om, [bx + 0.8, DECK_Y + 3.8, 9.7], [bx + 5.6, DECK_Y + 5.1, 11.5]);
  const dm = boat.mesh("railing_gray");
  for (const xx of [bx + 0.8, bx + 5.8]) beam(dm, [xx, DECK_Y, 11.2], [xx, DECK_Y + 5.8, 10.8], 0.3, 0.3);
  eq.add(boat);
  return eq;
}

function buildRailings() {
  const rails = node("railings", { extras: { confidence: "D" } });
  const m = rails.mesh("railing_gray");
  const inset = 0.12;
  const Y = SHELL_TOP;
  const xs = [];
  for (let x = X_TRANSOM + 0.3; x < FORECASTLE_X - 0.2; x += 1.6) xs.push(x);
  xs.push(FORECASTLE_X - 0.2);
  for (const s of [1, -1]) {
    const pts = xs.map((x) => [x, s * (halfBreadth(x, Y) - inset)]);
    for (const [x, z] of pts) box(m, [x - 0.04, Y, z - 0.04], [x + 0.04, Y + 1.0, z + 0.04]);
    for (let i = 0; i < pts.length - 1; i++)
      for (const y of [Y + 1.0, Y + 0.5]) beam(m, [pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], 0.06, 0.06);
  }
  const xa = X_TRANSOM + 0.3;
  const za = halfBreadth(xa, Y) - inset;
  for (const y of [Y + 1.0, Y + 0.5]) beam(m, [xa, y, -za], [xa, y, za], 0.06, 0.06);
  const fx = [];
  for (let x = 139.2; x < stemX(FORECASTLE_Y) - 0.6; x += 0.8) fx.push(x);
  for (const s of [1, -1]) {
    const pts = fx.map((x) => [x, s * Math.max(0.2, halfBreadth(x, FORECASTLE_Y) - inset)]);
    for (let i = 0; i < pts.length - 1; i++) beam(m, [pts[i][0], FORECASTLE_Y + 1.1, pts[i][1]], [pts[i + 1][0], FORECASTLE_Y + 1.1, pts[i + 1][1]], 0.06, 0.06);
    for (const [x, z] of pts) box(m, [x - 0.04, FORECASTLE_Y, z - 0.04], [x + 0.04, FORECASTLE_Y + 1.1, z + 0.04]);
  }
  return rails;
}

// ───────────────────────── assemble ─────────────────────────
const { sup, lights } = buildSuperstructure();
const root = node("BBC_SAO_PAULO", {
  extras: {
    model_class: "visual_exterior_digital_twin",
    generator: "scripts/build-bbc-sao-paulo-glb.mjs",
    not_for_use: ["construction", "stability_analysis", "cargo_planning", "navigation", "class_approval", "fabrication"],
    frame: "x: AP=0 -> bow (m), y: keel=0 -> up (m), z: +starboard (m)",
    particulars: { ...P, imo: SPEC.imo, design: SPEC.design, aft_end_to_ap_m: AFT_END, hatch_cover_top_m: COVER_TOP, side_shell_top_m: SHELL_TOP },
    sources: SPEC.sources.map((s) => s.title),
    confidence_legend: { A: "stated/labelled", B: "scaled from the GA drawing", C: "photo-estimated", D: "generic" },
  },
});
root.add(
  buildHull(),
  buildCargoDeck(),
  buildHatches(),
  sup,
  buildCraneFoundations(),
  ...CRANES.map(buildCrane),
  buildDeckEquipment(),
  buildRailings(),
  lights,
  node("decals", { extras: { todo: "BBC Chartering hull logo, name/IMO, draft marks — texture atlas in the Blender pass" } })
);

// ───────────────────────── GLB writer ─────────────────────────
function writeGlb(rootNode, file) {
  const matNames = Object.keys(MATERIALS);
  const json = {
    asset: { version: "2.0", generator: "cargo-planner build-bbc-sao-paulo-glb.mjs (procedural, v3)" },
    scene: 0,
    scenes: [{ name: "BBC_SAO_PAULO", nodes: [] }],
    nodes: [],
    meshes: [],
    materials: matNames.map((n) => MATERIALS[n]),
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  const chunks = [];
  let byteLen = 0;
  const view = (typed, target) => {
    byteLen = Math.ceil(byteLen / 4) * 4;
    chunks.push({ offset: byteLen, buf: Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength) });
    json.bufferViews.push({ buffer: 0, byteOffset: byteLen, byteLength: typed.byteLength, target });
    byteLen += typed.byteLength;
    return json.bufferViews.length - 1;
  };
  let tris = 0;
  const addNode = (n) => {
    const out = { name: n.name };
    const index = json.nodes.push(out) - 1;
    if (n.t) out.translation = n.t.map((v) => +v.toFixed(5));
    if (n.r) out.rotation = n.r.map((v) => +v.toFixed(7));
    if (n.extras) out.extras = n.extras;
    const primitives = [];
    for (const [mat, m] of n.parts) {
      if (!m.idx.length) continue;
      const pos = new Float32Array(m.pos);
      const nrm = new Float32Array(m.nrm);
      const big = m.vcount > 65535;
      const idx = big ? new Uint32Array(m.idx) : new Uint16Array(m.idx);
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i++) {
        min[i % 3] = Math.min(min[i % 3], pos[i]);
        max[i % 3] = Math.max(max[i % 3], pos[i]);
      }
      const pa = json.accessors.push({ bufferView: view(pos, 34962), componentType: 5126, count: m.vcount, type: "VEC3", min, max }) - 1;
      const na = json.accessors.push({ bufferView: view(nrm, 34962), componentType: 5126, count: m.vcount, type: "VEC3" }) - 1;
      const ia = json.accessors.push({ bufferView: view(idx, 34963), componentType: big ? 5125 : 5123, count: idx.length, type: "SCALAR" }) - 1;
      primitives.push({ attributes: { POSITION: pa, NORMAL: na }, indices: ia, material: matNames.indexOf(mat), mode: 4 });
      tris += idx.length / 3;
    }
    if (primitives.length) out.mesh = json.meshes.push({ name: n.name, primitives }) - 1;
    if (n.children.length) out.children = n.children.map(addNode);
    return index;
  };
  json.scenes[0].nodes.push(addNode(rootNode));
  byteLen = Math.ceil(byteLen / 4) * 4;
  const bin = Buffer.alloc(byteLen);
  for (const c of chunks) c.buf.copy(bin, c.offset);
  json.buffers.push({ byteLength: byteLen });
  let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (jsonBuf.length % 4)) % 4;
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([header, jh, jsonBuf, bh, bin]));
  return { bytes: 12 + 16 + jsonBuf.length + bin.length, tris, nodes: json.nodes.length };
}

const stats = writeGlb(root, OUT);
console.log(`wrote ${OUT} — ${(stats.bytes / 1024).toFixed(0)} KB, ${stats.tris} triangles, ${stats.nodes} nodes`);
