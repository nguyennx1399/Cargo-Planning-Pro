# Lifting gear & suspension arrangements

Source: BBC Guideline v1.0 (2009) §1.1–1.2. Script: `scripts/lifting_calcs.py`.

## Gear inventory and ratings
- **Wire rope slings**: for shifting pontoons/equipment. **Wire grommets & wire belt slings**: for cargo.
  Rated by WLL (working load limit), WL (working length), rope diameter. Keep lightly greased, store sheltered.
- **Fibre (synthetic) endless slings**: WLL + WL; protect against chafe.
- **Lifting shackles** (HT steel): WLL, inside width A, inside length E, bolt dia D.
- **Lifting / spreader beams**: SWL and adjustable WL. Two heavy beams may be coupled as a connecting beam.
- **Safety factor = BL / WLL** — wire 4–5, synthetic fibre 7.1. Design every arrangement against WLL/SWL.

## Choosing a suspension
| Situation | Arrangement | Watch out |
|---|---|---|
| c.o.g. central between lifting points | 4 slings of *identical* length | one longer sling unloads itself + its diagonal partner, overloading the other two |
| c.o.g. off-centre | 4 slings cut to individual lengths from a scale drawing | include hook geometry, shackle & bracket lengths |
| slings may be shifted under the unit | 2 slings passed under the unit (4 legs) | self-equalising; shift slings to trim a small c.o.g. offset |
| slings must not run inwards (would slip) | longitudinal spreader/beam | — |
| slings must not touch unit sides | transverse spreaders | transverse instability |
| sides untouched + vertical slings | transverse spreaders + longitudinal beam | transverse *and* longitudinal instability |
| mass > one crane | two cranes | c.o.g. must lie between the hooks, ideally midway; hoist wires must stay vertical |
| two cranes, short unit (jib clash risk) or c.o.g. offset / hard-to-reach stowage | connecting beam | uneven crane or sling shares if c.o.g. not under beam centre |
| two cranes, long unit with distant lifting points | no connecting beam (saves beam weight) | transverse instability |

## Slinging height vs hoisting distance
- **Hoisting distance** = weather-deck hatch-cover top → highest hook position (shrinks at large radius).
- **Slinging height** = unit bottom → hook; depends on slings + spreaders. It must never exceed hoisting distance.
  Check mainly for lighter units stowed at large working radius.

## Net sling length
`gross = √(x² + y² + z²)`, `net = gross − (E + D/2)` — x, y horizontal offsets of the lifting point from the hook
plumb line, z vertical drop; (E + D/2) = effective shackle length. Read x, y, z from a scale drawing.

## Stability of the rig (virtual c.o.g.)
- **Primary suspension** (slings straight to hook): stable if fastening points are above the c.o.g., or the
  c.o.g. stays below the centre of suspension (c.o.s., ≈ hook bolt).
- **Secondary suspension** (unit hangs from spreaders/traverses that hang from the hook): a small c.o.g.
  offset tilts both stages; the effect behaves like free surface — model it as the c.o.g. rising by r:
  - `c = cos²γ − (1 + mT/mC)·sinγ·cosγ / tanφ`
  - `r = c·s − v·mT/mC − c·z·s·tanγ / (v·tanφ + s·tanγ)`
  - v = spreader→c.o.s. height, s = fastening points→spreader height, z = fastening points→real c.o.g.,
    φ = primary sling angle, γ = secondary sling angle (negative when slings converge towards the base),
    mT = spreader mass, mC = cargo mass.
  - Vertical secondary slings (γ = 0) → r ≈ s (ignoring the small v·mT/mC term).
- Stable when virtual c.o.g. (z + r) is below c.o.s. (s + v). Aim for ≥ 1 m margin, more if c.o.g. uncertain.
- Make **v long, s short, avoid negative γ**. A rig "stabilised" only by the unit touching the slings is still
  unstable — fatal if the unit can tip freely.

## Hanging forces (vertical share per lifting point)
- Symmetric: weight / number of points.
- **2 points** (inverse proportionality): `H1 = W·e2/(e1+e2)`, `H2 = W·e1/(e1+e2)`.
- **3 points** (A opposite pair B–C): `HA = W·eBC/(eA+eBC)`; pair share `W·eA/(eA+eBC)` split `HB ∝ eC`, `HC ∝ eB`.
- **4 points**: statically indeterminate — approximate as nested 2-point systems with longitudinal distances
  x1 + e/2, x2 + e/2 and transverse y1, y2. Cross-check ΣH = W.

## Effective force in inclined slings / shackles
- `F = H / cos γ`, γ = spatial angle from vertical. Prefer γ ≤ 30°, **never > 60°**.
- From side-view α and front-view β: `tan γ = √(tan²α + tan²β)` → `F = H·√(tan²α + tan²β + 1)`.
- Quick conservative estimate: `F = H / (cos α · cos β)` (a few % high — acceptable for 4-point rigs).

## Compression spreader support wires
Support wires carry the spreader plus part of the cargo load:
`F_S = (H·(1 − cos γ) + W_S/2) / cos γ` (H = sling hanging force, W_S = spreader weight, γ = sling angle).
Certify the wires to ≥ F_S. (The source's own example lands ~1.5 % below this formula; use the formula.)
