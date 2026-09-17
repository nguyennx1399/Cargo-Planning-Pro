---
name: vite-node-differential-audit
description: How to differentially audit a frontend/src refactor here without touching the repo — run a scratch script from frontend/ with npx vite-node; @/ alias resolves
metadata:
  type: reference
---

To prove a behaviour-preserving refactor in `frontend/src` actually preserves behaviour, run a scratch differential script from outside the repo:

```
cd <repo>/frontend && npx vite-node /tmp/<dir>/audit.ts
```

`vite-node` (already in `node_modules/.bin`, no install) loads `vite.config.ts` from cwd, so the `@` → `src` alias works even though the script lives in `/tmp`. Nothing in the repo is created or modified, which keeps the review read-only.

What made it decisive on the Phase A `breakbulk-deck-area.ts` shim review (2026-09):
- `git show HEAD:<path>` to copy the pre-refactor implementation verbatim into the scratch script, then compare every export over several vessels × area ids (`undefined`, `""`, real, unknown). 135 comparisons, 0 diffs = proof, not argument.
- Reproduce the *old* call-site configuration (e.g. old positional args) alongside the new one and diff the outputs, to isolate exactly what a phase changed.
- Assert on x_m/z_m centres rather than whole objects, to separate intended loosening from coordinate regressions.

`scripts/`-style one-off node scripts can't do this — the TS path aliases and `@/types/domain` imports only resolve under vite. Related: [[shadcn-base-ui-vendored-component-gotchas]] (same repo, same "verify the claim yourself" habit).
