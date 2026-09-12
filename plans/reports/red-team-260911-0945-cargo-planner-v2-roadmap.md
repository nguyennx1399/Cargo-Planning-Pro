# Red Team Report — Cargo Planner v2 Roadmap

- **Target:** `plans/260911-0939-cargo-planner-v2-roadmap/reference-v2-product-plan.md` (source doc; not edited)
- **Date:** 2026-09-11
- **Reviewers (4):** Security Adversary, Assumption Destroyer, Failure Mode Analyst, Scope & Complexity Critic
- **Raw findings:** 39 → deduped/capped to 15 (1 rejected)
- **Code claims verified:** routes.py:13 in-memory TODO; routes.py:55-57 sync solve; models.py:37 no hydrostatics; calc.py:31 GM/trim/list = None; baplie.py:15,19 NotImplementedError; perf 20k@60fps unchecked (PLAN.md:30, project-roadmap.md:38) yet claimed in README.md:49; ContainerInstances.tsx:61 all units 40'.

## Summary

| # | Finding | Sev | Disposition | Target (future phase files) |
|---|---------|-----|-------------|------------------------------|
| 1 | Real shipment data used Phase 0–3; auth/tenancy/encryption/data rights only Phase 5 (optional) | Critical | Accept | P0 gate, P1 baseline |
| 2 | Stability has no vessel data; "bảng giả định" allowed; no booklet verification/versioning | Critical | Accept | P0 gate, P1/P2 |
| 3 | No persistence / job queue / object storage task in any phase | Critical | Accept | P1, P3 |
| 4 | Container + MPP built in parallel every phase; first-customer question unresolved | Critical | Accept | P0 gate, P1–4 |
| 5 | BAPLIE export unscheduled, ROB (BAPLIE import) missing, MPP export undefined | Critical | Accept | P1/P2 |
| 6 | No MVP, no kill/pivot gates, unmeasurable exit criteria, no Phase 0 fallbacks | High | Accept | All phases |
| 7 | Stability formulas break at edges (GM≤0, out-of-table, no GZ/IS Code, load-in heavy-lift) | High | Accept | P2, P4 |
| 8 | <300 ms + 60fps@20k unverified; engine location (client/server) undecided; parity undefined | High | Accept | P0/P1 decision, P1 perf gate |
| 9 | Export not gated by validation/approval; no revision/hash stamping | High | Accept | Export phase |
| 10 | No concurrency control (last-write-wins); version history & audit split, audit late | High | Accept | P2 |
| 11 | Solver job lifecycle + validator-reject path undefined; no quotas | High | Accept | P3 |
| 12 | CargoUnit/StowageSpace refactor sized S, sequenced before model is confirmed | High | Accept | P0→P1 |
| 13 | Shipment data changes after planning (VGM, cancel, POD) not detected | High | Accept | P1/P2 |
| 14 | Connector + file-import security (creds, SSRF, SQLi, XLSX/GLTF/CSV injection) | High | Accept | P1, P5 |
| 15 | Free 3D MPP placement contradicts "2D để làm, 3D để hiểu" | High | **Reject** | — |

## Findings

### 1. Real data before security & data rights — Critical
**Reviewers:** Security, Assumption, Scope. **Location:** P1 exit, P3 benchmark, §4.3, P5.
**Flaw:** P1 exit requires "kéo một chuyến thật", P3 benchmarks "dữ liệu shipment thật", while §4.3 rights unresolved and auth/tenant/encryption are P5 ("có thể chạy song song" = optional). Skeleton API has zero auth.
**Scenario:** Demo/usability build exposes real DG manifests & bookings; data owner never consented → legal breach pre-launch.
**Disposition:** Accept. **Fix:** P0 gate = written data-use clearance + DB field audit. P1 baseline = auth, `tenant_id` on every row, TLS, encryption at rest, object-level authz (no IDOR), locked env. Exits use anonymized "real-shaped" voyage until baseline exists.

### 2. Stability without data; assumed tables — Critical
**Reviewers:** Assumption, Failure, Security. **Location:** P0, P2 "Tính ổn định xấp xỉ", §4, §11 row 1, P5 onboarding.
**Flaw:** Every §8 formula needs hydrostatics (KM, LCB, MTC, LCF); no task imports them before P5; `Vessel` has none (models.py:37). Booklets are PDFs; hull/hold geometry needs lines/GA plan. Mitigation "bảng giả định" contradicts "không đoán ngầm". No versioning, provenance, or booklet cross-check task.
**Scenario:** P2 shows a fabricated GM; chief officer trusts it; or unit/sign error (LCG from AP vs midship) shifts trim by metres silently.
**Disposition:** Accept. **Fix:** P0 go/no-go: 2 vessels digitized (size L) and reproduce ≥3 booklet loading conditions within tolerance. Vessel data = versioned, immutable, approval to activate; plans pinned to vessel-data version; import sanity checks (units, monotonic, sign convention). Ban assumed tables outside sandbox; "UNVERIFIED" watermark + export block.

### 3. No persistence/infra tasks — Critical
**Reviewers:** Assumption, Failure. **Location:** §5, P2 undo/history, P5.
**Flaw:** PostgreSQL/Job queue/Object storage only in diagram. Store is in-memory (routes.py:13); solve is sync (routes.py:57).
**Scenario:** P2 version history lost on restart during usability test; P5 retrofits `tenant_id`; CP-SAT blocks HTTP workers.
**Disposition:** Accept. **Fix:** P1 task: tenant-scoped schema + migrations + append-only plan revisions + object storage. P3 task: async job queue before non-trivial solver. P2 exit adds "plans survive restart".

### 4. Dual-track container + MPP — Critical
**Reviewers:** Scope (+ Assumption). **Location:** P1–P4, §11, §12.
**Flaw:** Every phase doubles work (2D bay+hold, slot+space rules, 2 solvers, 2 optimizers) though §12 first customer unknown; §11 mitigation "container trước ở mỗi phase" not reflected in tables.
**Scenario:** No phase yields a product usable by one segment; first prospect waits on 3+ L items it never uses.
**Disposition:** Accept (sequencing only — both vessel types stay in scope per locked decision). **Fix:** First-customer = P0 exit gate. Split each phase into track A (chosen type) / track B (deferred). B starts after A reaches pilot.

### 5. Export & ROB import unscheduled — Critical
**Reviewers:** Scope, Assumption, Failure. **Location:** §3.2 step 7, P5.
**Flaw:** BAPLIE export in no phase (stub says phase 2); ROB requires BAPLIE import; BAPLIE is cell-based, cannot express MPP free placement; PDF only P5.
**Scenario:** P2 "complete plan" cannot leave the app; P1 "real voyage" loads onto an empty ship → planners reject.
**Disposition:** Accept. **Fix:** BAPLIE import (ROB) in P1 for container track; BAPLIE + PDF export in P2 (MVP). Define MPP output (hold-plan PDF + cargo list Excel/JSON); BAPLIE only for MPP container areas. Pin BAPLIE version (2.2 vs 3.1).

### 6. No MVP / gates / measurable exits — High
**Reviewers:** Scope, Failure, Assumption. **Location:** Decisions table, §7 all phases, §3.4–3.5, §9, §12.
**Flaw:** "Thời gian chưa quan trọng" + unbounded L; no MVP or kill criteria; exits unfalsifiable ("planner tin", "nhanh hơn" without baseline, "tốt hơn heuristic" any margin); P5 has no exit; P0 deps (rights, booklets, planners) have no fallback; planner access rated only Medium; per-phase SUS rounds + custom design system heavy; P5 mixes pilot needs with scale-only items (pricing page, self-serve onboarding, IMOS); P4 has 2 optimizers + duplicate ballast items.
**Disposition:** Accept. **Fix:** Define MVP (one vessel type, 2D manual stow, live validation, verified stability, BAPLIE/PDF export, pilot-ready auth). Kill/pivot gates after P0 and MVP pilot. Numeric exits (e.g. SUS ≥70, ≥80% unaided completion, time ≤ P0 baseline; P4 ≥X% restow cut, 0 hard violations; P5 cross-tenant test + backup restore). P0 task: baseline timings in incumbent tools. Planner access → High, committed design partner = P0 gate. Split P5 into pilot-ready / scale-ready. Merge ballast items; one optimizer approach per track. Cap L at 4 weeks. Off-the-shelf component library + theme instead of custom design system.

### 7. Stability formula edge cases — High
**Reviewers:** Assumption, Failure. **Location:** §8, P4 heavy-lift.
**Flaw:** tan(list)=TCG/GM undefined/inverted at GM≤0 (loll); no out-of-table rule; no GZ curve/IS Code 2008 criteria/KN tables; heavy-lift covers discharge only, ignores crane self-weight and original TCG; no density correction.
**Disposition:** Accept. **Fix:** GM ≤ threshold → critical "unstable/loll" state, no angle; out-of-table = error, never extrapolate; KN tables in Vessel model; GZ + IS Code checks in P4; separate load-in / discharge heavy-lift cases.

### 8. Performance targets unverified; engine location undecided — High
**Reviewers:** Assumption, Failure. **Location:** §3.3, §5, §9, P1 "Đã có".
**Flaw:** Validation re-posts full plan each check; no delta/incremental path; <300 ms impossible at 20k over network. 60fps@20k never measured (demo 150 units, 252 slots, all 40'); README claims it. Client preview vs server authoritative will diverge; approx (P2) vs exact (P4) change approved plans.
**Disposition:** Accept. **Fix:** P0/P1 architecture decision: shared engine (client+server) or server session with delta protocol. One authoritative engine; results stamped with engine/model version; golden-case parity suite. P1 perf gate: 20k mixed sizes + N GLTF, pass/fail before P2. Mark P1 "Đã có" as partial.

### 9. Export not gated — High
**Reviewers:** Failure, Security. **Location:** §3.2 step 7.
**Disposition:** Accept. **Fix:** Export only from immutable, validated revision; hard violations block (or logged override w/ reason); stamp revision + vessel-data hash + engine version + approver; keep immutable copy; audited delivery links instead of email.

### 10. Concurrency + audit/versioning — High
**Reviewers:** Failure, Security. **Location:** §2.2, P2 history, P5 audit.
**Flaw:** Real-time collab out of scope ≠ no concurrent access; no lock or revision check; audit log (S) arrives P5, separate from P2 history; no actor type (human/solver/LLM).
**Disposition:** Accept (severity lowered from Critical: pre-planning tool, usually 1 planner/voyage). **Fix:** Voyage edit lease + `base_revision` → 409; one append-only event store backing undo, history and audit from P2 with actor type + signed approval event.

### 11. Solver lifecycle — High
**Reviewers:** Failure, Security. **Location:** P3, P4, §5.
**Disposition:** Accept. **Fix:** Job states (queued/running/cancelled/timeout/failed/done), hard time budget, cancel, best-so-far, idempotency key, per-tenant quotas; solver output = proposal bound to revision, run through same validator, labelled "N violations"; 1-click accept only at 0 hard violations.

### 12. Refactor undersized & mis-sequenced — High
**Reviewers:** Assumption, Failure, Scope. **Location:** P0 "Chốt data model" S, P1 refactor S, §13 item 4.
**Flaw:** Everything keyed by bay/row/tier (context.py, rules.py, greedy.py, frontend mirror); Placement becomes union type; only 2 test files as safety net; §13 starts refactor before P0 findings.
**Disposition:** Accept (partial — rejected Scope's "don't generalize until 2nd vessel type": contradicts locked container+MPP decision; generalization shape instead follows finding 4 gate). **Fix:** Resize M–L; prerequisite = P0 model sign-off after shipment mapping; characterization tests for 6 rules + solver + API first; OpenAPI-generated TS types; keep v1 container routes compatible.

### 13. Stale shipment data — High
**Reviewer:** Failure. **Location:** §4, §4.1.
**Disposition:** Accept. **Fix:** Source key + version/hash on CargoUnit; re-sync diff screen (added/cancelled/re-weighed/POD changed) → invalidate affected placements + re-validate; block export on unreviewed diffs.

### 14. Connector & import security — High
**Reviewer:** Security. **Location:** §4.1, P1 GLTF, P5 connectors/onboarding.
**Disposition:** Accept (lowered from Critical: tenant-configurable connectors are P5). **Fix:** Pull-agent/push-export model, read-only accounts, vault secrets, egress allowlist, whitelisted mappings, timeouts/row caps. Untrusted input rules: defusedxml/safe openpyxl, size + decompression caps, GLTF→GLB server-side w/ poly limits and external URIs stripped, strict BAPLIE schema, CSV formula escaping, per-tenant storage prefixes + signed URLs.

### 15. Free 3D MPP placement vs 2D principle — High (claimed)
**Reviewer:** Scope. **Location:** P2 "Đặt hàng MPP tự do" L.
**Disposition:** **Reject.** §3.3 explicitly says "3D để kiểm tra, trình bày, **và cho hàng MPP**" — no contradiction. Whether planners need 3D manipulation is already a P0 interview question; the sizing concern is covered by finding 6 (L cap) and finding 4 (track sequencing).

## Below cap (noted, not applied)
- Phase 6 LLM: prompt injection via cargo free text, tool calls must bind tenant server-side, LLM vendor data retention; "learn from historical plans" must be per-tenant by default, and §4 has no source for historical stowage plans.
- RBAC role matrix: add tenant admin, vessel-data admin, external recipient, vendor break-glass (partly folded into #1, #2).

## Unresolved questions
1. First customer: container line or MPP owner? Is the shipment DB the user's own company's (a de facto design partner)?
2. Team size / runway — drives MVP cut and whether P5 can run in parallel.
3. Rules/stability engine: client, server-with-deltas, or shared (WASM)?
4. Single-writer lease acceptable, or is multi-planner editing needed?
5. BAPLIE 2.2 or 3.1?
6. Who owns vessel-data digitization and verification: vendor, customer, or class?
7. Legal liability for an export overridden past validation.
