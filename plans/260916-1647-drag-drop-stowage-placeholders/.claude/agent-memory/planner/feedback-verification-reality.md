---
name: verification-reality-no-dom-tests
description: This repo has no DOM test capability by policy — every plan must classify each change as pure-logic/node-testable, typecheck-only, or human-click-through, and extend the existing acceptance script rather than replace it
metadata:
  type: feedback
---

Every plan for this project must state, per proposed change, which of three buckets it falls in:
(a) node-testable pure logic, (b) verifiable by typecheck/build + reasoning, (c) **only** verifiable
by a human in a browser. Anything in (c) must add a *numbered step* to the existing acceptance script
with an explicit expected observation — the script is **extended, never replaced**.

**Why:** `vitest` runs `environment: 'node'` in `frontend/`; jsdom/testing-library/happy-dom are not
installed and none may be added. So the entire interaction layer (R3F pointer events, cursor,
overlays, React wiring) has no machine-verifiable path. The user's stated goal is that designs
*move work from (c) to (a)* — e.g. extracting "which slot does this point resolve to" into a pure
function so the precision claim becomes a test instead of a click-through observation.

**How to apply:** put decision rules in `frontend/src/lib/*.ts` (pure, no React/store imports) and
leave only the three.js/React plumbing in the component; write the success criteria as two separate
lists — *machine-checked* and *human-observed*; when a plan changes wording or a string the script
asserts, annotate the affected step in place instead of editing the expectation away. Related:
[[stowage-reconciled-baselines]].
