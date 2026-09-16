# Find real hydrostatic data for BBC SAO PAULO

## Status: OPEN — blocked on external data, not on code

## Why
`frontend/src/data/bbc-sao-paulo-geometry.ts` has NO `hull.offsets` (mesh-sourced hull only) —
`use-indicative-stability.ts`'s `!geometry?.hull.offsets` check makes the stability panel go
inert for this vessel. There is no lines plan or hydrostatic booklet on file for BBC SAO PAULO.

**Attempted 2026-09-16**: wired a SAMPLE/PLACEHOLDER `hull.offsets` grid (generic parametric
hullform via `generateParametricOffsets`, fitted only to this ship's LOA/LBP/beam/depth + an
assumed Cb=0.75) so the stability panel would have something to compute against. **Reverted**
same day — user reported it changed the vessel's UI/visual appearance unexpectedly. Root cause
not yet investigated (candidates: something downstream reads `hull.offsets` presence to switch
rendering path away from the mesh, e.g. treating the vessel as offsets-sourced for some view; or
`GhostContainerPreview`/`Hull.tsx`/`WaterlineReference.tsx` branch on it). Do NOT re-add sample
offsets without first tracing every consumer of `geometry.hull.offsets` (grep it) to confirm
none of them affect the mesh rendering path.

## Todo List
- [ ] Find/obtain the real lines plan or numeric offsets table for BBC SAO PAULO (IMO 9934266,
      design BBC-13K-500A / LakerMax) — shipyard/designer GA drawings, or a sister-hull lines
      plan for the same design.
- [ ] Alternatively, obtain the vessel's real hydrostatic/stability booklet (draft/displacement/
      KM/LCF/TPC/MTC tables) — can be imported directly via `hydrostatic-csv-io.ts` without
      needing offsets at all.
- [ ] Once obtained, replace `SAMPLE_HULL_PARAMS`/`SAMPLE_OFFSETS` in
      `bbc-sao-paulo-geometry.ts` with the real `HullOffsets` (or wire the imported hydrostatic
      table directly), remove the placeholder caveats in that file's header/provenance, and bump
      `data_status` from `"assumed"` toward `"computed"`/`"verified"` as appropriate.
- [ ] Update/relax `bbc-sao-paulo-vessel.test.ts`'s offsets assertion if the shape of the data
      changes (currently just checks offsets are present and non-empty).

## Research keywords (see chat for full list)
- `BBC Sao Paulo IMO 9934266 hydrostatic particulars`
- `"BBC-13K-500A" lines plan OR offsets table`
- `Briese Schifffahrt BBC-13K-500A newbuilding specification`
- Sister-hull search via equasis.org / vesselfinder.com / marinetraffic.com on IMO 9934266
- Failing that: contact BBC Chartering / the builder directly for the stability booklet.
