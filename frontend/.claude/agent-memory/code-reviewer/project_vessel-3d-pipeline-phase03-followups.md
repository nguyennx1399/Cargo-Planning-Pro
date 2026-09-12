---
name: project-vessel-3d-pipeline-phase03-followups
description: Known gaps left open after phase-03 review of vessel-3d-model-pipeline (component library, livery shader, render perf) — check if addressed in phase-04+ reviews
metadata:
  type: project
---

Phase-03 of `plans/260911-1409-vessel-3d-model-pipeline/` (`engine/vessel-components/*` builders +
`hull-livery-material.ts` + `Hull.tsx` composition) shipped with two open items, noted in
`reports/code-reviewer-260911-1655-phase-03-component-library.md`:

1. **`hull-livery-material.ts`'s `customProgramCacheKey`** is templated with per-vessel values
   (`depthM:boot_top_low_z_m:boot_top_high_z_m`) instead of a constant string. The generated GLSL
   is structurally identical across every livery/depth (only uniform values differ, nothing is
   baked into the shader text), so this forces a distinct `WebGLProgram` compile per unique
   vessel depth/livery combo for zero correctness benefit — real purpose of a cache key here
   (avoid accidental program-sharing with an unrelated non-livery `MeshStandardMaterial` that
   matches on three's default key fields) would be equally served by a fixed string. Currently
   harmless (`<Hull>` only mounted once per scene, in `VesselScene.tsx`), but becomes a real
   shader-compile-stall cost the moment multiple vessels render in one scene (e.g. a port-overview
   view) with different depths/liveries.
2. **`materialGroupFor` in `merge-static-components.ts`** uses a catch-all `default:` case
   (funnel/mast/lifeboat → "deck-fittings"), unlike its sibling `buildComponentMesh` switch which
   TypeScript actually enforces exhaustiveness on (confirmed via `TS2366`, independent of
   `noImplicitReturns` which isn't enabled in this repo's `tsconfig.json`). A future new
   `ComponentSpec` kind would silently land in "deck-fittings" via the default rather than forcing
   a deliberate material-group decision at compile time.

**Why:** Item 1 matters once the codebase supports rendering >1 vessel in a scene (plausible next
step — nothing currently blocks it). Item 2 matters whenever a new `ComponentSpec` kind is added
(e.g. phase-05's "palette" placement work, per phase-03's own Next Steps) — worth checking whether
the new kind's material grouping was a deliberate choice or fell through the default silently.

**How to apply:** When reviewing phase-04+ of this pipeline: if a multi-vessel scene is added,
check whether item 1 was fixed (constant cache key). If any new `ComponentSpec` kind was added,
check whether `materialGroupFor` got an explicit case for it (not just absorbed by default) — if
not, re-flag rather than assuming it was addressed silently. Also see
[[project-vessel-3d-pipeline-phase01-followups]] (item 2, `frames[0]` anchor, still open) and
[[project-vessel-3d-pipeline-phase02-followups]] (hull-loft mesher items, untouched by phase-03).
