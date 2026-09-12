# Code Review — Phase 03: Component Library, Livery Paint, Render Perf

## Scope
- Files: `engine/mesh-data.ts`, `engine/vessel-components/{primitive-mesh,merge-mesh-data,superstructure-geometry,funnel-geometry,deck-fittings-geometry,crane-geometry,hatch-and-lashing-geometry,merge-static-components,hull-livery-material}.ts`, `features/viewer3d/Hull.tsx`, `data/demo-horizon-geometry.ts`
- LOC: 488 total across new engine files, Hull.tsx 122 (all <200, no modularization needed)
- Focus: static review per user's checklist (1-6), no browser/visual check (accepted per plan deviations), `npm run typecheck` clean
- Deviations (aHullZ, no VesselModel/CraneModel/FunnelLogoDecal, static crane, no LOD, no water toggle) reviewed as accepted decisions per phase-03 plan file, not re-litigated

## Overall Assessment
Solid. Hand-traced `boxMeshData`/`cylinderMeshData` against `shipToScene` and the math is correct (verified with concrete numbers: box lengthM/widthM/heightM map 1:1 onto scene X/Z/Y with no rotation needed since `shipToScene` only permutes+translates, never scales — matches the code comments). The local-Y-as-ship-z livery approach is not just "probably fine" — I checked three.js's actual `meshphysical.glsl.js`/`begin_vertex.glsl.js` source: `position` is the raw vertex attribute, untouched by morph/skin/batching (which only mutate the separate `transformed` variable), so reading `position.y` right after `<begin_vertex>` is robust even if MeshStandardMaterial's shader template later adds morph/skin/batching chunks this app doesn't use. Good engineering judgment, correctly self-verified in the file's own comment.

## Critical Issues
None.

## High Priority
None.

## Medium Priority

1. **`hull-livery-material.ts` `customProgramCacheKey` varies by the wrong thing.** The generated GLSL string is *structurally identical* for every livery/depth (only uniform values change — nothing is baked into the shader text as a `#define` or literal). Three.js shares one compiled `WebGLProgram` across materials with the same cache key and rebinds uniforms per-draw, so program sharing across different livery colors/depths is not a bug — it's exactly how three.js is designed to work. Templating the key with `${depthM}:${boot_top_low_z_m}:${boot_top_high_z_m}` means every vessel with a different depth or livery threshold forces its own distinct shader compile, which is pure waste (shader-compile stalls) with zero correctness benefit. The *real* reason to set `customProgramCacheKey` here is legitimate — three's default cache key doesn't account for "has this onBeforeCompile patch or not," so without it a hull-livery material could theoretically get its compiled program silently reused from/by an unrelated `MeshStandardMaterial` that happens to match on the default key fields, dropping the paint patch entirely. Fix: use a **constant** key (e.g. `"hull-livery-material"`), not one interpolated with per-vessel values.
   - Currently low real-world impact (`grep` shows `<Hull>` only mounted once per scene today, in `VesselScene.tsx`), but this is exactly the kind of thing that bites later in a port-overview/multi-vessel scene, which is a plausible next use of this component library.
   - File: `frontend/src/engine/vessel-components/hull-livery-material.ts:25`

2. **`materialGroupFor`'s `default:` case silently absorbs unknown-to-it future `ComponentSpec` kinds into "deck-fittings"**, unlike `buildComponentMesh`'s switch (verified: TS raises `TS2366` — checked independently by tsc against a minimal repro — if a case is missing there, since the function's return type doesn't include `undefined`; this is *not* gated behind `noImplicitReturns`, which isn't enabled in this repo's `tsconfig.json`). `materialGroupFor` returns `string`, so its `default` never triggers a compile error, meaning a newly-added `ComponentSpec` kind (e.g. a future "gangway") would compile fine and silently land in "deck-fittings" without anyone deciding that's correct. Low risk today (5 kinds, all deliberately covered) but worth an explicit case list (drop the catch-all default, list `funnel`/`mast`/`lifeboat` individually returning `"deck-fittings"`) so adding a kind forces a decision, matching the exhaustiveness the sibling switch already gets for free.
   - File: `frontend/src/engine/vessel-components/merge-static-components.ts:54-63`

## Low Priority

- `mergeMeshData` reuses the `posCursor` variable to index into `normals.set(...)` too (`merge-mesh-data.ts:22`). Correct today only because positions/normals arrays are always the same length per part — true by construction, but the variable name makes the reader re-derive that invariant rather than see it. A `vertexFloatCursor` name (or a shared local) would make the invariant obvious without changing behavior.
- `buildComponentMesh` unconditionally adds every component's mesh to its group, even if it would be degenerate (e.g. a hypothetical `tiers: 0` superstructure spec produces an empty `mergeMeshData([])` that still gets merged in) — contrast with `buildHatchCoversMesh`/`buildLashingBridgesMesh`, which are explicitly guarded (`index.length > 0` / `return null`) before being added in `merge-static-components.ts:29-32`. Not a crash risk (an empty `BufferGeometry` just renders 0 triangles), and no current data hits it, but the asymmetry is worth a one-line comment or guard if this ever becomes user-editable data rather than fixed demo/onboarding data.
- No test pins the exact lashing-bridge count for the 10-bay demo vessel (`hatch-and-lashing-geometry.test.ts` only asserts `> 0` for `buildLashingBridgesMesh`). Manually confirmed the `i % 3 === 1` filter over 10 bays (indices 0-9) yields exactly 3 bridges (i=1,4,7) — a reasonable spread, not the 0-or-1 degenerate case the task asked me to check for — but a `toBe(3)` assertion would catch a future off-by-one in `LASHING_BRIDGE_EVERY_N_BAYS` that `> 0` cannot.

## Edge Cases Found by Scout
(Static trace done directly rather than via a separate scout subagent, since the task specified static review only — findings folded into Medium/Low above.)
- Verified `Uint16Array → Uint32Array` coercion in `primitive-mesh.ts:50` is a correct widen-copy (`Uint32Array.from`), not a truncation risk — `BoxGeometry`/`CylinderGeometry` at these vertex counts always produce `Uint16Array` indices by default, and all values fit trivially in `Uint32`.
- Verified `hatch-and-lashing-geometry.ts`'s `bayXShipFrame` (`bayCenterX(vessel, bay) + lbp_m/2`) is a correct round-trip: `bayCenterX` (called without a `geometry` arg, so it always takes the scene-space LAYOUT-fallback path, never the calibrated `bay_lcg_m` path) returns scene x; adding `lbp_m/2` converts it to ship-frame x (matches `sceneToShip`'s x formula exactly); it's then fed back through `shipToScene` inside `boxMeshData`, which subtracts `lbp_m/2` again — nets out to the original scene x. Correct, if a little indirect; matches the plan's documented intent of reusing scene-space `bayCenterX` without needing real `bay_lcg_m` data yet.
- **Phase-01 follow-up (beam/Y-bound component check) is now fixed.** `validate-vessel-geometry.ts`'s `checkComponents` now has `componentYExtents`/`halfBeam` checks (not present as of phase-02's review) and is exercised by `validate-vessel-geometry.test.ts`'s beam-violation tests. Not run directly against `buildDemoHorizonGeometry()` in a test, but the demo's own component Y-extents (superstructure ±11m vs. halfBeam ~13.7m+tolerance; mast/lifeboats at ±12m) stay inside bounds by hand-check, consistent with the phase-03 success criteria claim of "no validator errors." Updating memory to close this out.
- **Phase-01 follow-up 2 (`frames[0].from_frame` anchor)** remains open but still not hit — `demo-horizon-geometry.ts`'s `frames` still starts at `from_frame: 0`. Re-flag whenever a geometry with non-zero first frame lands.
- **Phase-02 follow-ups** (aft double-zero-station blade, `checkSlotsInsideHull` single-z check) are hull-loft-mesher concerns, untouched by this phase's component-library work — not re-checked here, still open per phase-02 memory.

## Positive Observations
- `primitive-mesh.ts`/`hull-livery-material.ts` comments show real self-verification work (the "why local Y works" reasoning, the "why no rotation needed" reasoning) rather than assertions — and both check out under independent tracing against three.js's actual source and hand-computed coordinates.
- Test suite for this phase is genuinely useful, not just coverage-padding: `component-builders.test.ts`'s `bbox()` helper asserts real dimensional correctness (length/width/height mapped to the right scene axis) per builder, not just "doesn't throw."
- Draw-call/triangle budget documented with real numbers in the plan file (3 draw calls vs 12 budget, 4556 triangles), and the code backs it up structurally (component groups genuinely merge to ≤3 buffers for the demo).
- Appropriately scoped YAGNI: crane articulation, LOD, funnel logo, water toggle all correctly deferred with clear reasoning tied to missing upstream infra (`ShipGroup`/`Water`) rather than deferred-and-forgotten.

## Recommended Actions
1. (Medium) Change `hull-livery-material.ts`'s `customProgramCacheKey` to a constant string instead of interpolating `depthM`/livery thresholds.
2. (Medium) Make `materialGroupFor` exhaustive (explicit cases, no catch-all `default`) so a future `ComponentSpec` kind forces a material-group decision at compile time.
3. (Low) Rename the reused `posCursor` in `mergeMeshData`'s normals `.set()` call, or add a one-line comment noting positions/normals share vertex count by construction.
4. (Low) Pin the lashing-bridge count (`toBe(3)`) for the demo vessel instead of `> 0`.

## Metrics
- Type Coverage: `npm run typecheck` clean (0 errors)
- Test Coverage: 5 new test files under `engine/vessel-components/__tests__/` (component-builders, hatch-and-lashing-geometry, hull-livery-material, merge-mesh-data, merge-static-components); not re-run here per instructions (tester agent running in parallel)
- Linting Issues: not run separately (typecheck clean; no lint-specific issues spotted in review)

## Unresolved Questions
- None blocking. Visual/browser verification of the livery boundary moving correctly under sinkage/list (flagged in the plan's own Deviations section) is still open — not something static review can close.
