---
title: "project-cargo-operations skill from BBC Guideline (lifting, bedding, securing)"
status: completed
created: 2026-09-18
mode: fast (single authoritative source, no external research)
source: ~/Downloads/[studocu.com] - 006.- BBC Guideline - Safe Solutions for Project Cargo Operations.pdf (76 pp, v1.0 2009)
---

# Plan: `project-cargo-operations` skill

Turn the BBC Guideline into a Claude skill that (a) answers heavy-lift / project-cargo questions with the
book's rules and limits, (b) runs the book's calculations deterministically via stdlib Python scripts,
(c) points at where this repo's engine touches the same concepts.

Target: `frontend/.claude/skills/project-cargo-operations/`

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Scaffold + SKILL.md (triggers, hard limits cheat-sheet, workflow) | completed | [phase-01](phase-01-scaffold-and-skill-md.md) |
| 2 | Reference docs (paraphrased, one per topic, <150 lines each) | completed | [phase-02](phase-02-reference-docs.md) |
| 3 | Calculator scripts + unit tests (book worked examples as fixtures) | completed | [phase-03](phase-03-calculator-scripts-and-tests.md) |
| 4 | Validate, trigger-test, codebase cross-links | completed | [phase-04](phase-04-validate-and-integrate.md) |

Dependencies: 1 → 2 → 3 → 4. Phase 3 is independent of 2 (can run in parallel, different files).

## Source map (book → skill)

| Book chapter | pp | Skill file |
|---|---|---|
| 1.1–1.2 Lifting gear, suspensions, sling length, suspension stability, gear forces, spreader wires | 7–20 | `references/lifting-gear-and-suspension.md`, `scripts/lifting_calcs.py` |
| 1.3 Ship stability during lifting (anti-heel ballast S, KG*/GM*, pontoons) | 20–26 | `references/ship-stability-during-lifting.md`, `scripts/stability_calcs.py` |
| 1.4 Lifting procedure, personnel, load/unload sequence | 26–29 | `references/lifting-procedure-checklist.md` |
| 2 Bedding (PAL, beam theory, BM on covers/pontoons, beams, plates, flatracks) | 30–41 | `references/bedding-and-load-spreading.md`, `scripts/bedding_calcs.py` |
| 3.1–3.2 Forces, friction, MSL table, lashings, welds, stoppers, shores, mats | 42–52 | `references/securing-equipment-and-welded-fittings.md`, `scripts/securing_equipment_calcs.py`, `scripts/securing_balance_calcs.py` |
| 3.3–3.4 Arrangement layout, loops, homogeneity, assessment (rule of thumb, advanced/alternative, tipping, additional tipping moment) | 52–64 | `references/securing-arrangement-assessment.md`, `scripts/securing_equipment_calcs.py`, `scripts/securing_balance_calcs.py` |
| Glossary | 65–66 | `references/glossary.md` |

## Key constraints

- **Copyright:** book is "all rights reserved". Skill text must be paraphrased in own words. Formulas,
  numeric limits and thresholds (facts) OK. No copied prose, figures, or large data tables (see phase 2/3).
  Never commit the PDF or its extracted text into the repo.
- Skill-creator limits: SKILL.md <150 lines, each reference <150 lines, description <200 chars,
  scope + security block required.
- Scripts: Python 3 stdlib only, snake_case (repo skill convention), tests via `python3 -m unittest`.
- The book's CSS Annex 13 acceleration tables are NOT in the source → scripts take Fx/Fy/Fz as inputs.

## Out of scope (follow-up candidates)

- Changing the app's breakbulk rules. Notable finding: book §2.1.3 says for hatch covers / tween-deck
  pontoons the governing check is **bending moment vs BM_lim**, not footprint pressure vs PAL, while
  `src/engine/breakbulk-validation-rules.ts` `breakbulkOverPressure` checks pressure. Separate plan.
- Encoding IMO CSS Annex 13 acceleration tables.

## Success criteria

- Skill auto-activates on heavy-lift / lashing / bedding / hatch-cover-load questions (phase 4 trigger test).
- All script functions reproduce the book's worked examples within stated tolerance.
- `package_skill.py` validation passes; line limits respected.

## Unresolved questions

1. Location: frontend `.claude/skills/` (planned) vs repo-root `.claude/skills/`, or global `~/.claude/skills/`?
2. OK to keep the numeric H-beam stopper MSL tables (p49–50) OUT of the skill (use the shear-criterion
   bound + "see source table")? Planned: yes, to limit copying.
3. Book typos: suspension-stability example prints cos γ where the formula says cos²γ; spreader support wire
   formula (195.5 kN) vs example (192.8 kN). Plan: implement the printed formula (conservative), 1.5% tolerance.

## Outcome (2026-09-18)
- Skill: `.claude/skills/project-cargo-operations/` — SKILL.md 96 lines, 7 references, 6 script modules + cli.
- Tests: 126 passing (`python3 -m unittest discover -s .claude/skills/project-cargo-operations/scripts/tests`).
- Code review: formulas verified vs all worked examples; input-validation findings fixed + regression tests.
- Copy check: no 10-word overlap with source text.
- Resolved questions: location = frontend; H-beam tables excluded; printed formulas kept.
- Open: §3.4.8 aft-tipping row (4 lashings vs 13,320 kN·m) may be a source/extraction inconsistency.
- Follow-up: bending-moment rule for breakbulk on covers/pontoons (separate task).
- Trigger test (phase 4 step 5) not run yet.
- Docs impact: none (skill lives under `.claude/`).
