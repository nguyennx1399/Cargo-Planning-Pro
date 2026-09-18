# Securing principles, equipment & welded fittings

Source: BBC Guideline v1.0 (2009) §3.1–3.2. Script: `scripts/securing_equipment_calcs.py`.

## Forces at sea
- Sources: gravity components from roll/pitch, inertia from ship accelerations, wind & spray on deck cargo.
- Check Fx (longitudinal), Fy (transverse), Fz (vertical) separately. Peak transverse may combine with 60 % of
  longitudinal/vertical peaks; longitudinal and vertical peaks can coincide at 100 % (pitch + heave).
- Magnitudes: IMO CSS Code Annex 13 calculation (depends on ship size/speed/stability, stowage position,
  mass, dimensions, weather, voyage). Expect more in: roll resonance > ±30°, slamming at speed head seas,
  following/quartering seas with marginal stability → reduce speed / alter heading.
- Very large deck units: add the rotational-inertia tipping moment (see assessment reference).

## Aims and allowed methods
Prevent: transverse/longitudinal sliding, transverse/longitudinal tipping, racking, stack collapse, deck cargo
floating off, local damage. **Sliding first, then tipping.**
Project cargo must be secured by **direct force transfer** to the ship: lashings (wire, chain, web), timber
shoring, welded stoppers/stanchions, twistlocks into flatracks/foundations. **Not allowed** for heavy units:
down-strapping (friction lashing) and compacting into blocks.

## Friction
- No steel-on-steel: timber dunnage/plywood under footprints, and under steel spreading beams unless those are
  welded/shored. Separate stacked items with dunnage.
- CSS friction values are conservative (dirt, oil, vibration, shocks).
- Midship hold/tween-deck: friction may cover longitudinal sliding, but add some vertical lashing component.
- Forward stowage: vertical accelerations periodically unload the unit → friction alone fails longitudinally.

## MSL (maximum securing load) as % of breaking load (CSS Annex 13)
| Element | MSL |
|---|---|
| Shackles, rings, deck eyes, turnbuckles (mild steel) | 50 % |
| Fibre rope | 33 % · Web lashing 50 % |
| Wire rope single use / re-usable | 80 % / 30 % |
| Steel band single use | 70 % · HT chain 50 % |
| Timber | 0.3 kN/cm² normal to grain |
A class WLL (e.g. container chain 80 kN) is not automatically the MSL — use 50 % of BL unless they coincide.

## Lashings
- **Wire rope** (clips + turnbuckle), three accepted builds:
  - Type A: wire doubled through the turnbuckle; 3 clips per end for 16–18 mm wire.
  - Type B: for weak turnbuckles; double turn at the lower end (2 clips), 3 clips at the upper end.
  - Type C: long lashings / half loops; doubled at both ends, wire ≈ 1.4× thicker for equal strength.
  - **"La Paloma"** (no bends at the connection) — rejected regardless of clip count.
  - Narrow bends cut strength (residual vs bend ratio b/d, rope steady / slipping):
    0.5→50/25 %, 1→65/50 %, 2→77/65 %, 3→85/75 %, 4→93/83 %, 5→99/90 %. Wire running round corners of a big
    unit counts as slipping. A 180° turn over two sharp edges leaves 25 % per part — double the wire.
  - Clips: U-bolt on the dead end, greased threads, spacing ≥ 6× wire diameter.
  - Lashing MSL = its **weakest element** (deck ring, shackle, turnbuckle, wire × parts × residual, cargo fitting).
- **Chain** 13 mm long-link: BL 200 kN → MSL 100 kN; lever tensioner at ~45°, never > 80°; re-tightening
  hook only for re-tightening.
- **Web lashing**: MSL 25 or 50 kN (label "LC" in daN; 1 kN = 100 daN). Very elastic — don't mix with wire or
  chain on the same load path; protect against chafe.
- Turnbuckles, shackles, insertable D-rings: use documented MSL; a container-system WLL is MSL only if = 50 % BL.

## Welded stoppers & lashing points
Positioned over structure, welded by an **external professional welder, not crew**. Assumptions: S235 ≤ 20 mm,
normal safety class, ordinary seams, fillet A-measure ≥ 6 mm.
| Seam | Shear | Tension |
|---|---|---|
| Fillet (A = 6 mm) | 5 kN per cm | 6 kN per cm |
| Butt (A = plate thickness) | 8.7 kN/cm² | 12 kN/cm² |
Fitting MSLs (L, b, t, h, e in cm):
- Plate stopper: `5·(2L + t)`; as vertical clip (seam all round) `MSLxy = 5·2(L+t)`,
  `MSLz = min(10.4·h·t, 6·2(L+t)·L/(L + 5e))`. Face plate for sensitive units.
- Low H-beam: upright welded all round `5·6·b`; laid flat on flange edges `5·2·L`.
- High H-beam (tall strong edge): H ≤ L, angle/triangle plate, seam all round. MSL comes from the source's
  tables (H = L, §3.2.3), which are not bundled — ask the user for the table value, never estimate it.
  For H < L scale by L/H but cap at `5·2·(L + b)`. If L − b > 40 cm use the stiffer construction or
  strengthen the triangle plate edge.
- Angle stopper `5·2·L` (both directions). Lashing plate aligned with the lashing `5·2·(L + t)`.
- D-ring saddle: full-penetration multi-layer butt weld → MSL = 0.5 × certified BL.
- **Not allowed**: face plates / H-pieces with a single fillet loaded across the seam ("silly stoppers").
- Inspect after deslagging: A-measure (gauge), undercut, hot/cold cracks, porosity, slag inclusion; dye
  penetrant for cracks. Report serious faults to the supercargo/port captain.

## Timber shores
Build as a free-standing frame in the gap: shores bear on cross-beams (short overlaps) carried by uprights,
shores resting on nailed benches, diagonal braces. Unsupported shore length ≤ 2 m (buckling) — else add
intermediate supports. Expect shrinkage slack at sea.

## Anti-sliding mats
μ ≈ 0.6 dry, ≈ 0.4 wet. Limited pressure/shear capacity: only up to ~3–4 bar (30–40 t/m²). Check the pressure
under spreading beams *and* at footprint-on-beam crossings; use hardwood where it is higher.
