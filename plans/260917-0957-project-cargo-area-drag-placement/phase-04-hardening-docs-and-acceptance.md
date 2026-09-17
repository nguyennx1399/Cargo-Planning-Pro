# Phase 04 — Badges, hints, docs, acceptance

## Context Links

- D4 (generic areas droppable with a badge): `plan.md` decisions
- Manual script to extend: `plans/reports/manual-click-through-260916-phase-c.md`
- Docs to sync: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/project-changelog.md`, `docs/development-roadmap.md`
- Confluence spec page (status update owed): see `plans/reports/confluence-260916-1647-…-feature-plan.md`

## Overview

- **Priority:** P2 · **Status:** planned · **Effort:** ~0.5 d
- Everything that makes the feature honest about what it does and does not know, plus the acceptance run this repo cannot automate.

## Key Insights

- **MV Demo Horizon's weather deck is `source: "generic"`** — a 15 %/85 % LOA guess with no keep-outs. Dropping there is allowed (D4) but must be visibly labelled, or a planner will read a guess as a GA.
- BBC's areas carry **provenance/confidence** in the spec JSON (`A`–`D` per field). Surfacing "measured from GA, confidence B" is cheap and is the difference between a demo and a tool someone trusts.
- The repo has **no DOM/browser test capability** (node-env vitest, no jsdom, no Playwright — a standing decision). Interaction acceptance is a written manual script, as in Phase C.
- The standing warning in `README.md` (decision-support only, verify on a certified loading computer) applies doubly to free-positioned heavy lift.

## Requirements

**Functional**
1. Generic/approximate areas render a badge ("approximate — no GA layout") and every drop there records a warning-severity reason.
2. Sidebar hint while an item is in hand: "fits in: weather deck, Hold 2 tank top" / "nothing fits" (from `freeRegionsFor`).
3. Area label shows rating and clear height: `"Hold 2 tank top · 20 t/m² · clear 14.6 m"`.
4. Manual click-through script for Phase D appended to the Phase C report family.
5. Docs updated: architecture (the new drop path), codebase summary (new modules), changelog, roadmap status.

**Non-functional**
- No new dependency. No test toolchain change.

## Related Code Files

**Modify:** `features/viewer3d/AreaPlaceholders.tsx` (badge + label), `features/panels/Sidebar.tsx` (hint), `docs/*.md`
**Create:** `plans/reports/manual-click-through-260917-phase-d.md`
**Delete:** none

## Implementation Steps

1. Badge + richer label in `AreaPlaceholders`.
2. Sidebar "fits in" hint, memoised per gesture (not per pointer move).
3. Write the manual script: place on deck; place in each hold; refuse outside the rect; refuse on a crane pedestal; refuse overlapping a container stack; amber on the 20 m band; rotate a 30 m item to 90° on a 19.7 m beam area (must refuse — verified in the prototype); move a placed item; undo; redo; Esc mid-gesture; release off-canvas; keyboard-only place via pick.
4. Run it in a browser on BBC SAO PAULO and MV Demo Horizon; record results in the report.
5. Delegate docs sync to `docs-manager`; update the Confluence page status to "Phase D implemented".
6. Final `npm run typecheck && npm run build && npm test`.

## Todo List

- [ ] generic-area badge + provenance-aware label
- [ ] sidebar "fits in" hint
- [ ] manual click-through script written
- [ ] manual run recorded (both vessels)
- [ ] docs updated (architecture, summary, changelog, roadmap)
- [ ] Confluence status updated
- [ ] typecheck / build / tests green

## Success Criteria

- A planner can tell, without reading code, whether an area is a real GA layout or an approximation.
- The manual script covers every D1 refusal path and both accept paths, and its run is recorded with dates.
- Docs describe the area drop path accurately enough to onboard a new vessel without asking anyone.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Badge implies the rest of the data is exact | Wording names the source and confidence, not a quality score |
| Manual script rots | It lives beside the Phase C one and is re-run whenever the drop path changes |
| Docs drift from code (again) | `docs-manager` runs in the same session as the code change |

## Security Considerations

None. Reconfirm no vessel spec, credential or `.env` content enters `plans/` or `docs/`.

## Next Steps

Phase E (unchanged, unplanned): hatch-opening check, adjustable tweendeck levels, mixed stacking + lashing clearances, magnet snapping, multi-select/nudge, Playwright, and deleting the `breakbulk-deck-area.ts` shim.
