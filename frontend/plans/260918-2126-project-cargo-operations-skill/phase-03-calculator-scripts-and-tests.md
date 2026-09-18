# Phase 03 — Calculator scripts + tests

## Context Links
- Plan: [plan.md](plan.md); formulas: [phase-02](phase-02-reference-docs.md)
- Convention: `.claude/skills/skill-creator/references/script-quality-criteria.md`; existing examples
  `.claude/skills/databases/scripts/` (snake_case, `scripts/tests/test_*.py`)

## Overview
Priority: high · Status: completed · Pure-function stdlib Python modules + one JSON CLI, each module <200 LOC,
unit-tested against the book's worked examples (numbers are facts → fine as fixtures).

## Key Insights
- LLMs make arithmetic slips on these multi-term formulas; deterministic scripts = main value of the skill.
- Units: mass t, force kN, length m (section modulus cm³, stress kN/cm²), angles degrees in / radians internal. g = 9.81.
- Every function returns a dict: inputs echo, result(s), limit check (`ok`, `margin`) where the book defines a limit.

## Architecture
```
scripts/
  lifting_calcs.py     net_sling_length, virtual_cog_rise, hanging_forces_2pt/3pt/4pt,
                       effective_sling_force(exact|approx), spreader_support_wire_force
  stability_calcs.py   crane_boom_heeling_mass, anti_heeling_ballast, lifting_kg_gm (GM* ≥0.6 check)
  bedding_calcs.py     bm_lim_pal, bm_lim_stacks, bm_single_contact, bm_single_bridging, support_forces,
                       bm_multi_units (shear-curve integration, loads spread over width b),
                       beams_required(condition A|B, offset), beam_max_length, flatrack_factor, flatrack_bridging_load
  securing_calcs.py    msl_from_bl(material), cs(msl, method), f_advanced, f_alternative(fy,fx),
                       wire_residual_strength(b_over_d, slipping), weld/stopper MSLs,
                       sliding_balance, tipping_balance (transverse/longitudinal), additional_tipping_moment,
                       roll/pitch period + angular accel, polar_radius(shape)
  cli.py               `python3 cli.py <function> '<json-kwargs>'` → JSON stdout; `cli.py list` prints functions
  tests/test_lifting_calcs.py, test_stability_calcs.py, test_bedding_calcs.py, test_securing_calcs.py
requirements.txt       (empty — stdlib only; comment line)
```

## Test fixtures (book worked examples; tolerance ±0.5% unless noted)
- Sling: z 8.2, x1 4.7, x2 7.9, y1 5.3, y2 2.6, E 0.33, D 0.085 → 10.47 / 9.43 / 11.31 / 12.19 m.
- Virtual c.o.g.: v 4.3, s 14.9, z 4.7, φ 63°, γ −6°, mT 40, mC 164 → c ≈1.06, r ≈15.87; unstable (s+v 19.2 < z+r 20.6).
  Tolerance 1% (book example uses cos γ, formula prints cos²γ — implement formula).
- 2-pt: W 1226.3, e1 8.4, e2 5.2 → H1 468.9, H2 757.4.
- 3-pt: W 981, eA 5.7, eB 2.9, eC 3.5, eBC 2.2 → 273.2 / 387.1 / 320.7.
- 4-pt: W 1177.2, e 0.8, x1 4.7, x2 7.9, y1 5.3, y2 2.6 → 240.0 / 489.2 / 300.6 / 147.4; ΣH = W.
  Forces (α1 29.8, α2 43.9, β1 32.9, β2 17.6): exact 317.2/584.7/427.9/225.7; approx 329.4/591.4/437.7/243.6.
- Spreader wire: m 244 (4 slings → H 598.4), γ 40°, spreader 2 t → printed formula 195.5 kN; book 192.8
  (tolerance 1.5%; test asserts formula value, comment the discrepancy).
- Stability: Δ 8000, KG 5.40, KM 9.15, P 474, R 26, Q 64.1, p 46.9, q 23.2, r 16.0, B/2 10.1, a 6.3, sy 18.2, sz 3.5
  → S 508 t, KG* 8.21, GM* 0.94 (ok). Q check: 56.2·16.5/28.2 = 32.9.
- BM_lim: PAL 3, w 16.1, t 6.3 → 6007 kN·m; stacks n 7, ms 60, w 16.1 → 8292.
- Single unit m 244, t 16.1, s 9.6: e 0 → 6762 (> 6007 fail); e 2.8 → 5944 (ok); bridging s 6.2, e 0 → 5924.
- Multi: w 16.1, m1 196 b1 2.8 a1 2.7, m2 240 b2 6.0 a2 11.6 → F2 2018.8, F1 2258.4, BM ≈ 8221.5 (±1%).
- Beams A: 346 t, r 5.0, s 3.6, steel Wx 1150 → n 3.44 → 4; r_max 26×26 = 1.2·3.6+4.0 = 8.3 m.
  Beams B offset: 40 t, r 6.2, s 0.6, e 1.6, Wx 570 → 4.97 → 5.
- Flatrack: 20' factor(s 3, e 0) 0.67; factor(s 1, e 2.5) 1.79; 40' factor(s 1, e 0) 0.52; bridging
  P0 32, r 5.85, s 2.3 → 26.4 t.
- Welds/stoppers: plate L 20 t 2 → 210; clip L 18 t 2 h 7 e 8 → MSLxy 200, MSLz 74 (weld governs vs 146);
  low H b 14 → 420, flat L 50 → 500; high H L 70 b 20 table 308 with H 40 → 539 ≤ bound 900;
  angle L 15 → 150; lashing plate L 15 t 2 → 170.
- Wire lashing: 18 mm BL 185, double, b/d≈1.8 steady 75%, single-use 80% → 222 kN; weakest link 157.
- Alt f-values μ 0.3: α 50 β 30 → fy 0.79 fx 0.55; α 30 β 30 → 0.90 / 0.58; α 50 β 60 → 0.55 / 0.79.
- RTG assessment: m 130, Fy 1219, Fx 799, Fz 790, μ 0.3, a 15, b_t 5.6, b_l 11.8, ΣCS·f transverse 1752,
  longitudinal 1156 → sliding 1969 / 1336 kN; tipping port 21542 vs 18285+1560; fwd 19047 vs 11985+6871.
- Additional tipping: B 20.2, GM 1.5 → Tφ 12.9 s, c ≈0.12; ip 10 → 1560 kN·m. Lpp 113.5 → Tψ 5.3 s, c ≈0.29; ip 13.5 → 6871.
  ip solid box w 12 h 25 → 8.0; hollow → 10.7.

## Implementation Steps
1. Write modules (pure functions, docstrings with book § reference, input validation raising ValueError
   on negative mass / γ ≥ 90° / zero spans).
2. `cli.py`: registry dict name→function, parse JSON kwargs, print JSON; non-zero exit + message on error.
3. Tests with `unittest` + `assertAlmostEqual`/relative tolerance helper; run
   `python3 -m unittest discover -s .claude/skills/project-cargo-operations/scripts/tests`.
4. Add CLI examples to SKILL.md Scripts section.

## Todo List
- [x] lifting_calcs.py + tests
- [x] stability_calcs.py + tests
- [x] bedding_calcs.py + tests
- [x] securing_calcs.py + tests
- [x] cli.py + smoke test
- [x] All tests green, each module <200 LOC

## Success Criteria
- All fixtures pass; CLI works for every function; no third-party imports.

## Risk Assessment
- Book typos (2 known) → documented in test comments. Multi-unit BM needs a clean shear integration
  (loads as uniform over width b) — verify against 8221.5.
- Fx/Fy/Fz require CSS Annex 13 tables not in source → functions take them as inputs; say so in docstrings.

## Security Considerations
- CLI evaluates JSON only (no eval). No file/network access.

## Next Steps
- Phase 04.
