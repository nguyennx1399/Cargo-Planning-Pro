# Bedding & load spreading

Source: BBC Guideline v1.0 (2009) §2. Script: `scripts/bedding_calcs.py`.

## Structural capacities
- **PAL** (permissible area load, t/m²) is defined for tank top, tween-deck pontoons and weather-deck hatch
  covers, plus **stack loads** (t/stack) where containers are carried. Take them from the capacity plan.
- Example only (BBC "Asia" type — not universal): tank top 16 t/m², pontoons 2.5–3 t/m², hatch covers
  2.5 t/m²; stacks: hold 100 t (20') / 120 t (40'), deck 60 t (20') / 80 t (40').
- Two strategies: **spread** a small footprint over enough area, or **transfer** it onto primary girders
  (hatch-cover/pontoon main girders, container-socket transverse girders) with timber or steel beams.

## Beam theory in one paragraph
A cover/pontoon is a beam on two end supports. Support reactions → shear-force curve; the bending moment at x
is the area under the shear curve up to x, so **BM_max sits where shear crosses zero**. Stresses: shear
`τ ≈ SF/A`, bending `σ = BM/Wx` (Wx = section modulus). Stay in the elastic range with margin.

## Hatch covers & tween-deck pontoons — check bending, not just pressure
- A uniform PAL load defines the moment the panel is built for (including sea-going vertical accelerations).
  A concentrated load is acceptable if its **bending moment ≤ BM_lim** — spreading a footprint until
  pressure ≤ PAL is *not* the criterion here; getting the load onto the girders / towards the supports is.
- Same BM for different point loads: loads closer to mid-span raise BM. Spread loads across the full panel
  length with beams.
- Limits: `BM_lim = PAL·w·L_fa·g·w / 8` (w transverse span between supports, L_fa fore-aft panel length);
  over container sockets `BM_lim = n·m_s·g·w / 8` (n stacks incl. partial, m_s permitted stack mass).
  The socket-girder figure already reserves half of each girder for the neighbouring bay; it may be
  doubled only when there is no cargo fore and aft of the unit.

## Actual bending moment
Span t = transverse distance between supports (same as w above — not L_fa), loaded length s, offset e of
the load centre from mid-span, mass m:
- Load carried over the whole length s: `BM = m·g/8 · (2t − s) · (1 − 4e²/t²)`
- Unit bridging s (bears only at the ends of s — unit must be stiff enough):
  `BM = m·g/8 · (2t − 2s − (4e/t)·(2e − s))`
- Reactions: `F1,2 = m·g/2 · (1 ± 2e/t)` (F1 = support nearer the load).
- Several units: `F2 = g·Σ(mᵢ·aᵢ)/w`, `F1 = g·Σmᵢ − F2` (aᵢ = distance from support 1). Draw the shear curve
  (loads spread over their bedding widths), sum rectangles/trapezia/triangles up to the zero crossing.
- Fixes if BM > BM_lim: move the unit off-centre, bed on the unit's ends (bridging), or reduce mass.
  A result near the limit leaves no room for other cargo on that panel.

## Tank top
The double bottom is backed by sea pressure, so local overload means local damage, not collapse. Still spread
to satisfy PAL, and lay spreading beams **across** the double-bottom main girders (check yard drawings).

## Bedding materials
- **Timber**: use square sections (don't topple); actual size < nominal. σp = 1 kN/cm² (conifer).
  Nominal 10/15/20/25 cm → actual ≈ 9.6/14.6/19.5/24.5 cm, Wx ≈ 147/519/1236/2451 cm³.
- **Steel**: mild steel σp = 15 kN/cm² (yield ≈ 23); high-tensile ≤ 65 % of yield. HEB section data from
  standard tables. Twin beams resist rolling/wobbling.
- **Number of beams**
  - Condition A (beam length r lies fully on the deck, loaded over s): `n = m·g·(r − s)·100 / (8·σp·Wx)`
    — timber: `/(8·Wx)`, steel: `/(120·Wx)`. Beam length limited (deflects more than the deck):
    `r_max = min(1.2·s + k1, s + k2)` with k1/k2 growing with section (e.g. steel 26×26: 4.0/5.0 m).
  - Condition B (beams bridge a weak zone between supports r apart, e.g. between socket girders; practically
    steel): `n = m·g·(2r − s)·100 / (8·σp·Wx)`; loaded off-centre by e multiply by `(1 − 4e²/r²)`.
  - Round up.
- **Steel plates**: only against local denting (e.g. rubber-tyred gantry wheels on covers), ideally over timber.
  They don't carry point loads to girders. Leave sizing to the planning department.
- **ISO flatracks / platforms** (section modulus unknown → use rated payload P0):
  - Concentrated load: `P = P0 · factor`, `factor = L/((2L − s)(1 − 4e²/L²))`, L = 6 m (20'), 12 m (40')
    (s = loaded length, e = offset). Load must fit: e + s/2 ≤ L/2.
  - Bridging s between two bearings: `P = P0·r/(2r − 2s)` (r ≈ corner-casting centres, 5.85 m on 20').
    If s > r/2 this exceeds P0 — then corner-casting loads on the ship govern.
  - 40' racks have ~2.5 cm built-in hog and should be flat at full payload; sagging = overloaded.
