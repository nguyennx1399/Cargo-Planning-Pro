# Cargo Planner 3D — v2 Roadmap

- **Source of truth:** [reference-v2-product-plan.md](reference-v2-product-plan.md) (user doc, do not edit)
- **Status:** Draft — phase files not yet written. Red-team constraints below are binding for every phase file.
- **Red team report:** [../reports/red-team-260911-0945-cargo-planner-v2-roadmap.md](../reports/red-team-260911-0945-cargo-planner-v2-roadmap.md)

## Phases

| Phase | Focus (source §7) | Status | Red-team deltas |
|-------|-------------------|--------|-----------------|
| 0 | Discovery: users, data, market | Pending | Go/no-go gates (RT-1,2,4,6); engine-location decision (RT-8) |
| 1 | Viewer + UX foundation | In planning — frontend-first demo: [sub-plan](../260911-0945-p1-frontend-stowage-demo/plan.md) | Persistence + security baseline (RT-1,3); ROB import (RT-5); perf gate (RT-8); refactor M–L (RT-12) |
| 2 | Manual stow, rule engine, approx stability | Pending | = MVP incl. export (RT-5,9); event store + lease (RT-10); edge guards (RT-7) |
| 3 | Auto-stow v1 | Pending | Async jobs, proposal semantics (RT-3,11) |
| 4 | Optimization + exact stability | Pending | GZ/IS Code; one optimizer per track; numeric KPI (RT-6,7) |
| 5 | Commercial readiness | Pending | Split pilot-ready (→MVP) / scale-ready; connector security (RT-6,14) |
| 6 | Advanced AI | Pending | Deferred; see report "Below cap" |

Sizes: S days · M 1–2 wk · L 3–4 wk (cap; split anything larger).

**Cross-cutting sub-plan — vessel 3D model pipeline:** [../260911-1409-vessel-3d-model-pipeline/plan.md](../260911-1409-vessel-3d-model-pipeline/plan.md)
P0: collect GA + lines plan/offsets of 2 reference vessels · P1: parametric hull (L1), component library, paint/waterline · P2: offsets lofting (L2), GA-tracing onboarding tool · P4: hydrostatics computed from offsets vs booklet · P5: CAD/glTF import (L3), self-serve onboarding.

## Key dependencies
- P0 gates must pass before P1 code beyond refactor prep (data rights, 2 verified vessels, planner design partner, first-customer choice).
- Persistence (P1) before undo/history (P2); job queue (P3) before CP-SAT/metaheuristics (P4).

## Red Team Review

### Session — 2026-09-11
**Findings:** 15 (14 accepted, 1 rejected)
**Severity breakdown:** 5 Critical, 10 High, 0 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Real shipment data before auth/tenancy/data rights | Critical | Accept | P0, P1 |
| 2 | Stability without verified vessel data; assumed tables | Critical | Accept | P0, P1, P2 |
| 3 | No persistence / job queue / object storage tasks | Critical | Accept | P1, P3 |
| 4 | Container + MPP in parallel; first customer unresolved | Critical | Accept | P0, P1–4 |
| 5 | BAPLIE export + ROB import unscheduled; MPP export undefined | Critical | Accept | P1, P2 |
| 6 | No MVP / kill gates / measurable exits / P0 fallbacks | High | Accept | All |
| 7 | Stability formula edge cases (GM≤0, out-of-table, GZ, load-in) | High | Accept | P2, P4 |
| 8 | <300 ms & 60fps@20k unverified; engine location undecided | High | Accept | P0, P1 |
| 9 | Export not gated by validation/approval | High | Accept | P2 |
| 10 | No concurrency control; audit/history split & late | High | Accept | P2 |
| 11 | Solver job lifecycle + validator-reject path | High | Accept | P3 |
| 12 | Refactor sized S, before model confirmed | High | Accept (partial) | P0, P1 |
| 13 | Stale shipment data not detected | High | Accept | P1, P2 |
| 14 | Connector + file-import security | High | Accept | P1, P5 |
| 15 | Free 3D MPP placement vs 2D principle | High | Reject | — |

### Binding constraints for phase files
- **RT-1** P0 gate: written data-use clearance + DB field audit. P1: auth, `tenant_id` on all rows, TLS, encryption at rest, object-level authz. Real data only after baseline; else anonymized "real-shaped" voyage.
- **RT-2** P0 gate: 2 vessels digitized, reproduce ≥3 booklet conditions within tolerance. Vessel data versioned/immutable, plans pinned to version, import sanity checks. No assumed tables outside sandbox; UNVERIFIED watermark + export block.
- **RT-3** P1: tenant-scoped schema, migrations, append-only plan revisions, object storage; P2 exit "plans survive restart". P3: async job queue before non-trivial solver.
- **RT-4** P0 exit: first-customer choice. Each phase split into track A (chosen type) / track B (starts after A pilot). Both types stay in scope.
- **RT-5** P1: BAPLIE import (ROB). P2: BAPLIE + PDF export. MPP output = hold-plan PDF + cargo list; BAPLIE only for container areas. Pin BAPLIE version.
- **RT-6** Define MVP (one type, 2D manual stow, live validation, verified stability, export, pilot-ready auth). Kill/pivot gates after P0 and MVP pilot. Numeric exits (SUS ≥70, ≥80% unaided, time ≤ P0 baseline; P4 ≥X% restow cut; P5 cross-tenant test + restore). P0 baseline timing task. Planner access = High risk, design partner = P0 gate. P5 split pilot/scale. Merge ballast items. Off-the-shelf component lib + theme.
- **RT-7** GM ≤ threshold → critical loll state, no angle; out-of-table = error; KN tables in Vessel; GZ + IS Code 2008 in P4; separate load-in/discharge heavy-lift incl. crane weight.
- **RT-8** P0/P1 decide engine location (shared vs server+deltas); one authoritative engine, version-stamped results, golden parity suite. P1 perf gate 20k mixed + GLTF. P1 "Đã có" = partial (40' only).
- **RT-9** Export only from immutable validated revision; hard violations block or logged override; stamp revision, vessel-data hash, engine version, approver.
- **RT-10** Voyage edit lease + `base_revision`/409. One append-only event store (undo, history, audit) from P2, with actor type + signed approval.
- **RT-11** Job states, time budget, cancel, best-so-far, idempotency, per-tenant quotas; solver output = validated proposal; 1-click accept only at 0 hard violations.
- **RT-12** Refactor M–L, after P0 model sign-off; characterization tests first; OpenAPI-generated TS types; v1 container routes stay compatible.
- **RT-13** CargoUnit source key + hash; re-sync diff screen; invalidate + re-validate; block export on unreviewed diffs.
- **RT-14** Pull-agent/push model, read-only creds in vault, egress allowlist, whitelisted mappings. Untrusted input: safe XML/XLSX, size caps, GLTF→GLB w/ limits, CSV formula escape, per-tenant signed URLs.
