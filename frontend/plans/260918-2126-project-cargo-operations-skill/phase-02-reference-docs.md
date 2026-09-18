# Phase 02 — Reference docs

## Context Links
- Plan: [plan.md](plan.md) (source map table)
- Source PDF chapters 1–3 + glossary

## Overview
Priority: high · Status: completed · Write 7 paraphrased, practical reference files (<150 lines each).

## Key Insights
- Extract text for working copy only: `python3 -c "import fitz; ..."` (PyMuPDF is installed in system
  python; pypdf is not) → write to session scratchpad, NOT the repo. Formulas are garbled in text
  extraction — render formula regions to PNG (`page.get_pixmap(dpi=110, clip=...)`) and read them.
- Write rules as "do / check / limit" bullets + formula + variable legend. No copied sentences.
- Do NOT include: figures, the H-beam stopper MSL tables (p49–50), the 20'/40' flatrack factor tables
  (derive from formula instead — see below), the CSS form sheets verbatim (describe fields instead).

## Requirements — content per file

1. `lifting-gear-and-suspension.md` (§1.1–1.2)
   - Gear types + parameters (WLL, WL, shackle A/E/D), safety factor = BL/WLL.
   - Suspension types: single crane ± spreaders, dual crane ± connecting beam; when each is needed; instability notes.
   - Net sling length = √(x²+y²+z²) − (E + D/2).
   - Suspension stability: primary vs secondary suspension, virtual c.o.g. rise
     `r = c·s − v·mT/mC − c·z·s·tanγ/(v·tanφ + s·tanγ)`, `c = cos²γ − (1+mT/mC)·sinγ·cosγ/tanφ`;
     γ=0 → r ≈ s. Rules: long v, short s, avoid negative γ, ≥1 m margin.
   - Hanging forces: 2-point inverse proportionality; 3-point exact; 4-point approximation (x1,x2,e,y1,y2).
   - Effective force `F = H·√(tan²α + tan²β + 1)`, conservative `F = H/(cosα·cosβ)`; γ ≤30° pref, ≤60° max.
   - Compression spreader support wire `F_S = (H·(1−cosγ) + W_S/2)/cosγ`.
2. `ship-stability-during-lifting.md` (§1.3)
   - Parameter legend (B, q, r, sy, Q, e, e1, f, mb, P, R, S, a, p, sz, d); Q = mb·e1/e.
   - SWL vs working radius, linear interpolation between SWL steps.
   - `S = (P+R+Q)·(B/2 + a)/sy`; `KG*_C = KG_C + [P·(p−KG_C) + Q·(p−q) + R·(p−r) + S·sz]/(Δ+P)`
     (verified vs book example → 8.21 m); GM* = KM*(at Δ+P) − KG*; target ≈1 m, min 0.6 m.
   - Stability pontoons: ±3° design range, heel ≤1° in operation, collapse risk.
3. `lifting-procedure-checklist.md` (§1.4) — three angles (heel φ, luffing α, hoisting δ), critical-load
   table (δ 1°/2°/3° → 95/90/85% at μ=0.3), preparation checklist, personnel roles, loading & unloading
   sequences (ballast/luffing hand-in-hand, cranes turned one after the other, 2–5 t touch-down ease).
4. `bedding-and-load-spreading.md` (§2)
   - PAL concept; example capacities are vessel-specific (Asia-type) → label as example only.
   - Beam theory: shear → BM integration, τ ≈ SF/A, σ = BM/Wx.
   - Key principle: on covers/pontoons transfer load to primary girders; compare BM vs BM_lim, not pressure vs PAL.
   - `BM_lim = PAL·w·t·g·w/8`; with container sockets `BM_lim = n·m_s·g·w/8`.
   - Single unit: contact `BM = m·g/8·(2t−s)·(1−4e²/t²)`; bridging `BM = m·g/8·(2t−2s−4e/t·(2e−s))`;
     supports `F1,2 = m·g/2·(1 ± 2e/t)`. Multiple units: F2 = g·Σ(mi·ai)/w, shear-curve area to zero crossing.
   - Tank top: spread across double-bottom main girders.
   - Beams: timber section table (nominal vs actual dims, Wx) is general engineering data — include compact;
     HEB Wx table — include compact (standard steel data, not book-specific). Required beams:
     A: `n = m·g·(r−s)·100/(8·σp·Wx)`; B: `(2r−s)`; B with offset × `(1 − 4e²/r²)`; r_max rule `min(1.2s+k1, s+k2)`.
   - Steel plates (local denting only; defer to planning dept), flatracks:
     `factor = r/((2r−s)·(1−4e²/r²))` (r = 6 m for 20', 12 m for 40' — reproduces book tables), bridging
     `P = P0·r/(2r−2s)`; ~2.5 cm built-in hog on 40' racks; negative deflection = overload.
5. `securing-equipment-and-welded-fittings.md` (§3.1–3.2)
   - Force sources, 100/60% combination rule, Annex 13 warnings (roll >30°, slamming, following seas).
   - Direct securing only for project cargo. Friction: timber/plywood between steel; forward stowage loses friction.
   - MSL % of BL table (CSS Annex 13 — public IMO data): shackles/rings/turnbuckles 50%, fibre rope 33%,
     web 50%, wire single-use 80%, wire reusable 30%, steel band 70%, HT chain 50%, timber 0.3 kN/cm².
   - Wire lashing types A/B/C (C ≈1.4× dia), La Paloma banned, residual strength after bends (b/d table is
     short, include), sharp-corner 25%, weakest-link rule. Chain 13 mm: BL 200 kN, MSL 100 kN; lever 45°..80°.
     Web: MSL 25/50 kN, LC in daN, don't mix with wire/chain.
   - Welds (S235, safety class Normal): fillet A≥6 mm → 5 kN/cm shear, 6 kN/cm tension; butt 8.7 / 12 kN/cm².
     Stoppers: plate `5·(2L+t)`, clip `MSLz = min(10.4·h·t, 6·2(L+t)·L/(L+5e))`, low H-beam `5·6·b` / `5·2·L`,
     high H-beam: H ≤ L, angle plate, bound `5·2·(L+b)` (table values: "see source §3.2.3"), angle stopper `5·2·L`,
     lashing plate `5·2·(L+t)`, D-ring MSL = 0.5·BL with full-penetration butt weld. Weld fault list.
   - Timber shores (stand-alone structure, ≤2 m unsupported), anti-sliding mats.
6. `securing-arrangement-assessment.md` (§3.3–3.4)
   - Layout rules (angles, homogeneity/elasticity, half loops & head loops OK, friction/silly loops banned).
   - 14-point visual inspection checklist (paraphrased).
   - Rule of thumb (and its >30 t prohibition), advanced method (CS = MSL/1.5, `f = μ·sinα + cosα`),
     alternative method (CS = MSL/1.35, `fy = μ·sinα + cosα·cosβ`, `fx = μ·sinα + cosα·sinβ`, tipping ×0.9).
   - Balances: transverse sliding `Fy ≤ μ·m·g + ΣCS·f`; longitudinal `Fx ≤ μ·(m·g − Fz) + ΣCS·f`;
     transverse tipping `Fy·a ≤ b·m·g + ΣCS·c`; longitudinal tipping `Fx·a ≤ b·(m·g − Fz) + ΣCS·c`.
   - Additional tipping moment `M_add = c·m·ip²`; roll `c = φ·(2π/Tφ)²`, `Tφ = 0.78·B/√GM`;
     pitch `Tψ = 0.5·√Lpp`, amplitudes 30° / 12°; ip formulas (solid/hollow box, solid/hollow cylinder).
   - LashCon limitations (bullets). Worked example summary (RTG 130 t) in own words, numbers OK.
7. `glossary.md` — term → one-line own-words definition (+ which reference covers it).

## Related Code Files
- Create: the 7 files under `.claude/skills/project-cargo-operations/references/`

## Implementation Steps
1. Extract text + render formula pages to scratchpad.
2. Write each file from the requirements above, own wording, <150 lines (`wc -l`).
3. Cross-check each formula against the rendered page image.
4. Add "Source: BBC Guideline v1.0 (2009) §x.y" line at top of each file.

## Todo List
- [x] lifting-gear-and-suspension.md
- [x] ship-stability-during-lifting.md
- [x] lifting-procedure-checklist.md
- [x] bedding-and-load-spreading.md
- [x] securing-equipment-and-welded-fittings.md
- [x] securing-arrangement-assessment.md
- [x] glossary.md
- [x] All <150 lines, formulas cross-checked

## Success Criteria
- Every threshold in SKILL.md cheat-sheet traceable to a reference; no verbatim paragraphs from the book.

## Risk Assessment
- Garbled extracted formulas → mitigated by image check. Vessel-specific numbers (Asia-type PAL, stack
  loads) mistaken as universal → label "example vessel" explicitly.

## Security Considerations
- Don't store the PDF/extracted text in repo; skill cites source only.

## Next Steps
- Phase 04 validation reads these.
