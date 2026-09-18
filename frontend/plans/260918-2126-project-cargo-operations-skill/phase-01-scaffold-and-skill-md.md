# Phase 01 — Scaffold + SKILL.md

## Context Links
- Plan: [plan.md](plan.md)
- Skill rules: `.claude/skills/skill-creator/SKILL.md`, `references/skill-anatomy-and-requirements.md`,
  `references/metadata-quality-criteria.md`, `references/writing-effective-instructions.md`
- Source PDF: see plan.md frontmatter

## Overview
Priority: high · Status: completed · Create the skill folder and a <150-line SKILL.md that routes to references/scripts.

## Key Insights
- Book has 3 pillars: **Lifting**, **Bedding**, **Securing**. SKILL.md = router + hard-limit cheat-sheet;
  detail lives only in references (no duplication).
- Hard limits worth surfacing in SKILL.md (facts, quick recall):
  - Suspension angle γ: prefer ≤30°, never >60°. Virtual c.o.g. ≥1 m below centre of suspension.
  - Hoisting angle δ ≤3° (dual crane); keep δ≈0 while hook carries ≥80% of the unit's weight.
  - Heel ≤±3° without stability pontoons, ≤±1° with them. GM_C* ≈1 m target, never <0.6 m.
  - Lifting gear safety factor: wire 4–5, synthetic fibre 7.1.
  - Timber σp = 1 kN/cm²; mild steel σp = 15 kN/cm²; HT steel ≤65% of yield.
  - Vertical lashing angle α ≤60° for sliding (to 90° for tipping); horizontal β ≤30°.
  - Sliding layout: ~40% capacity to each side, ~10% fore and aft.
  - CS = MSL/1.5 (advanced), MSL/1.35 (alternative). IMO rule of thumb not allowed for units >30 t.
  - Banned: "La Paloma" wire lashing, friction loops, silly loops, down-strapping/compacting for heavy units,
    single-fillet "silly stoppers", welding by crew.
  - Timber shore unsupported length ≤2 m. Anti-sliding mat μ 0.6 (≈0.4 wet), ≤3–4 bar (30–40 t/m²).
  - Wire clip spacing ≥6× wire dia; 3 clips per end (Type A, 16–18 mm).

## Requirements
- Frontmatter: `name: project-cargo-operations`, description <200 chars with triggers
  (heavy lift, project cargo, breakbulk, lashing, sling, spreader, hatch cover load, bedding, MSL, CSS Code).
- Sections: Scope (handles / does NOT handle), When to use, Workflow (numbered), Hard limits, Reference
  index (with grep hints), Scripts usage (exact commands), Codebase links, Security block, Source/disclaimer.
- Disclaimer: guidance only; ship's approved Cargo Securing Manual and master's authority prevail.

## Related Code Files
- Create: `.claude/skills/project-cargo-operations/SKILL.md`
- Create dirs: `references/`, `scripts/`, `scripts/tests/`

## Implementation Steps
1. `python3 .claude/skills/skill-creator/scripts/init_skill.py project-cargo-operations --path .claude/skills`
   (if it fails, fix script or create dirs manually). Delete template placeholders not used (no `assets/`).
2. Write frontmatter + description, e.g.
   `Heavy-lift & project cargo ops: sling/crane forces, lifting stability, hatch-cover bedding, lashing/stopper MSL, CSS securing checks.`
3. Workflow section, numbered: classify question (lift / bed / secure) → load matching reference →
   gather inputs (mass, c.o.g., dims, geometry) → run script → compare with hard limits → state verdict +
   margins + assumptions → remind master/CSM authority.
4. Hard-limits table (above). Reference index table: file → topics → grep keywords.
5. Scripts section: one example CLI call per module (see phase 3 CLI contract).
6. Scope + Security block (skill-creator template).
7. Keep file <150 lines (`wc -l`).

## Todo List
- [x] Scaffold folder
- [x] Frontmatter + description (<200 chars)
- [x] Scope, workflow, hard limits, reference index, scripts usage
- [x] Security + disclaimer
- [x] Line count <150

## Success Criteria
- SKILL.md <150 lines, no text duplicated from references, every reference/script linked.

## Risk Assessment
- Over-long cheat-sheet → keep only numeric limits; explanations go to references.

## Security Considerations
- Security block per skill-creator; no secrets/env needed.

## Next Steps
- Phase 02 fills references; Phase 03 scripts.
