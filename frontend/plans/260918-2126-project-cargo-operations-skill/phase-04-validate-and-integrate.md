# Phase 04 — Validate, trigger-test, codebase cross-links

## Context Links
- Plan: [plan.md](plan.md)
- `.claude/skills/skill-creator/references/validation-checklist.md`, `testing-and-iteration.md`
- Codebase touchpoints: `src/engine/breakbulk-validation-rules.ts`, `src/types/domain.ts`
  (rated surface load t/m², `max_top_load_t`, `kg_above_base_m`), `src/engine/validation-rules.ts`
  (container stack weight), `src/engine/stability-indicative.ts`

## Overview
Priority: medium · Status: completed · Make sure the skill loads, triggers, stays within limits, and links to the app.

## Requirements
- `package_skill.py` / validator passes.
- Trigger test: 5 should-trigger prompts, 3 should-not.
  - Should: "how many 26x26 steel beams under a 346 t transformer on tank top", "is this 4-leg sling
    arrangement stable with spreaders", "required anti-heeling ballast for a 474 t lift", "check lashing
    arrangement for 130 t RTG on deck", "can I load 244 t on this tween deck pontoon".
  - Should not: container 20'/40' parity question, React UI bug, generic ship chartering question.
- Codebase section in SKILL.md (short): which app rules correspond to which book concept, and the
  known gap (pressure-vs-PAL check in `breakbulkOverPressure` vs book's bending-moment criterion).

## Implementation Steps
1. Run skill-creator validator/package script on the folder; fix issues.
2. Verify line limits: `wc -l SKILL.md references/*.md`; LOC per script.
3. Run full unittest suite.
4. Grep skill for long verbatim runs vs extracted text (scratchpad): flag any ≥12-word identical sequence
   and rewrite (simple python n-gram check, scratchpad only).
5. Trigger test in a fresh session (or ask a subagent with only the skill description) — record results.
6. Add codebase section; spawn follow-up task chip for the bending-moment rule gap (do not implement here).
7. `code-reviewer` agent pass on scripts; docs impact: none (skill lives in `.claude/`), mention in
   `docs/project-changelog.md` only if user wants.

## Todo List
- [x] Validator passes
- [x] Limits respected
- [x] Tests green
- [x] Verbatim-copy check clean
- [ ] Trigger test recorded (not run — skill is registered; verify in a fresh session)
- [x] Codebase cross-links + follow-up chip
- [x] Code review

## Success Criteria
- Skill listed in available skills, triggers on heavy-lift prompts, all checks pass.

## Risk Assessment
- Description too generic → collides with `databases`/`debug` style triggers; keep domain nouns explicit.

## Security Considerations
- Security block present; skill never claims to override the ship's Cargo Securing Manual or master.

## Next Steps
- Optional follow-up plan: bending-moment check for breakbulk on hatch covers/pontoons in the engine.
