# Codebase Summary

## Repository Structure

```
cargo-planner/
├── docs/                         # Project documentation
│   ├── PLAN.md                   # Phases 0–5, milestones, checklist
│   ├── ARCHITECTURE.md           # Diagram, tech decisions table, solver contract
│   ├── DOMAIN.md                 # Slot coordinates, hard constraints, glossary
│   ├── project-overview-pdr.md   # Requirements, user stories, success criteria
│   ├── codebase-summary.md       # This file
│   ├── code-standards.md         # Coding conventions, patterns
│   ├── system-architecture.md    # Component details, API reference
│   ├── deployment-guide.md       # Local dev, Docker, production setup
│   └── design-guidelines.md      # UI layout, colors, styles
├── frontend/                     # React 19 + TypeScript + Vite 6
│   ├── src/
│   │   ├── main.tsx              # App entry, React Query setup
│   │   ├── App.tsx               # Layout: sidebar, 3D viewer, bay plan
│   │   ├── types/domain.ts       # TypeScript mirrors of backend Pydantic models
│   │   ├── api/client.ts         # HTTP client (health, vessel, plan, validate, solve)
│   │   ├── store/usePlanStore.ts # Zustand store (color mode, selection, filters)
│   │   ├── lib/
│   │   │   ├── colors.ts         # Color palette + schemes (POD, weight, type)
│   │   │   └── geometry.ts       # 3D math: bay/row/tier → position (DIM, LAYOUT)
│   │   ├── features/
│   │   │   ├── viewer3d/         # 3D scene (Canvas, Hull, InstancedMesh containers)
│   │   │   ├── bayplan/          # 2D bay plan SVG view (stub)
│   │   │   └── panels/           # Sidebar: plan info, legend, violations
│   │   └── styles.css            # Layout grid, responsive design
│   └── vite.config.ts            # Vite 6 alias (@→src), proxy /api → API_URL
├── backend/                      # Python 3.11 + FastAPI + Pydantic v2
│   ├── app/
│   │   ├── main.py               # FastAPI app, CORS middleware
│   │   ├── api/routes.py         # REST endpoints (health, vessels, plans, validate, stowage/solve)
│   │   ├── domain/
│   │   │   ├── models.py         # Pydantic models (Vessel, Container, StowagePlan, etc.)
│   │   │   └── slot.py           # Slot coordinate helpers (bay-row-tier)
│   │   ├── io/baplie.py          # BAPLIE import/export (stub)
│   │   ├── data/
│   │   │   ├── sample.py         # load_sample_vessel(), random_cargo()
│   │   │   └── sample_vessel.json # Reference vessel JSON (bays, rows, stacks)
│   │   ├── validation/
│   │   │   ├── engine.py         # validate(vessel, plan) → ValidationReport
│   │   │   ├── context.py        # ValidationContext (columns, containers, stacks)
│   │   │   └── rules.py          # Rule functions (slot_exists, size_fits_bay, stack_weight, etc.)
│   │   ├── solver/
│   │   │   ├── base.py           # StowageSolver Protocol interface
│   │   │   ├── greedy.py         # GreedySolver v1 (sort by POD/weight; basic placement)
│   │   │   ├── cpsat.py          # CpSatSolver (stub; OR-Tools phase 4)
│   │   │   └── registry.py       # SOLVERS dict
│   │   └── stability/calc.py     # Stability calculations (stub; GM, trim, SF/BM)
│   ├── tests/
│   │   ├── test_api.py           # API endpoint tests
│   │   └── test_slot.py          # Slot coordinate parser tests
│   └── requirements.txt           # Dependencies (fastapi, pydantic, httpx, pytest, etc.)
├── docker-compose.yml            # Dev setup: api (:8000) + web (:5173); postgres commented
├── .dockerignore, Dockerfile     # Container images (python:3.11-slim, node:20-alpine)
└── README.md                      # Quick start, layout, run instructions
```

## Per-Module Purpose

### Frontend (`frontend/src/`)

| Module | Purpose | Key Exports | Status |
|--------|---------|---|--------|
| `main.tsx` | React entry point; TanStack Query setup | queryClient | ✓ Complete |
| `App.tsx` | Top-level layout; loads plan + vessel; queries validation | App component | ✓ Complete (stub) |
| `types/domain.ts` | TS interfaces mirror Python models | Vessel, Container, BreakbulkCargo, BreakbulkPlacement, StowagePlan, ValidationReport, etc. | ✓ Mirrors backend |
| `api/client.ts` | HTTP client with typed endpoints | api object (vessel, demoPlan, validate, solve stubs) | ✓ Partial |
| `store/usePlanStore.ts` | Zustand view state (colorMode, selection, filters, **playback controls: playbackCount, playbackPlaying, playbackSpeed, exaggerate**) | usePlanStore | ✓ Complete |
| `lib/geometry.ts` | 3D coordinate transforms | slotToPosition, bayCenterX, rowCenterZ, tierCenterY, DIM, LAYOUT | ✓ Complete |
| `lib/colors.ts` | Color schemes by attribute (POD palette, weight ramp, type/IMDG) | podColorMap, containerColor, HIGHLIGHT | ✓ Complete |
| `lib/ship-attitude-transform.ts` | Transform weight distribution (LCG, TCG, KG) to ship sinking/healing angles | shipAttitudeFromWeights, ShipAttitude | ✓ Complete |
| `lib/use-indicative-stability.ts` | Hook: combine stability engine + hydrostatic lookup; **DEMO DATA only** | useIndicativeStability | ✓ Complete |
| `engine/stability-indicative.ts` | Indicative (DEMO DATA) draft/list/trim/GM from weight distribution + hydrostatic table lookup | WeightItem, StabilityResult, calculateStability | ✓ Complete |
| `engine/hydrostatic-table-lookup.ts` | Interpolate ship hydrostatic properties (displacement, LCB, MCT, KM) by draft | interpolateHydrostatics | ✓ Complete |
| `engine/playback-slice.ts` | Zustand store slice for loading sequence playback state management | playbackActions, playbackSlice | ✓ Complete |
| `engine/hull/` | Parametric L1 hull generation (Cb fit, loft mesher, validation) | parametric-hull-generator, hull-loft-mesh-builder, section-integrals, slots-inside-hull-check, etc. (7 files) | ✓ Phase 2 complete |
| `engine/vessel-components/` | Component library builders (superstructure, funnel, mast, lifeboat, hatch covers, lashing bridges) + material merging | superstructure-geometry, funnel-geometry, crane-geometry, deck-fittings-geometry, hatch-and-lashing-geometry, merge-static-components (9 files) | ✓ Phase 3 complete |
| `engine/mesh-data.ts` | Mesh data utilities and livery shader material (`hull-livery-material.ts`: antifouling/boot-top/topside paint via `onBeforeCompile`) | HullLiveryMaterial, customProgramCacheKey | ✓ Phase 3 complete |
| `features/viewer3d/VesselScene.tsx` | R3F Canvas, lighting, orbit controls, ship attitude transform | VesselScene | ✓ Complete |
| `features/viewer3d/Hull.tsx` | Hull rendering (parametric L1, phase 2; GLTF L2 phase 4) | Hull component | ✓ Phase 2 (L1 parametric) |
| `features/viewer3d/ContainerInstances.tsx` | InstancedMesh for all sizes (20'/40'/45'); renders each container at correct length; raycast selection; filtered by playback state | ContainerInstances | ✓ Complete |
| `features/viewer3d/BreakbulkCargoInstances.tsx` | Render break-bulk deck cargo (wind turbine, yacht); positioned by x/z footprint + rotation; filtered by playback state; **DEMO dimensions only** | BreakbulkCargoInstances | ✓ Complete |
| `features/viewer3d/useShipAttitude.ts` | Hook: compute ship attitude (heel/trim/sinking) from visible cargo weight; updates 3D scene | useShipAttitude | ✓ Complete |
| `features/viewer3d/WaterlineReference.tsx` | Visual waterline mesh in 3D scene (responsive to ship attitude) | WaterlineReference | ✓ Complete |
| `features/viewer3d/LoadingSequenceDriver.tsx` | Playback controls (Play/Pause/Reset/Scrub) for reveal-over-time loading animation | LoadingSequenceDriver | ✓ Complete |
| `features/bayplan/BayPlanView.tsx` | 2D SVG bay plan (stub) | BayPlanView | ○ Stub |
| `features/panels/Sidebar.tsx` | Vessel info, plan summary, violations list | Sidebar | ✓ Partial (displays violations) |
| `features/panels/StabilityPanel.tsx` | Display stability metrics: draft, list, trim, GM; **DEMO DATA caveat** | StabilityPanel | ✓ Complete |
| `features/panels/LoadingSequencePanel.tsx` | Playback controls and timeline for loading sequence animation | LoadingSequencePanel | ✓ Complete |
| `styles.css` | Layout grid (sidebar / viewer / bayplan), responsive | — | ✓ Complete |

### Backend (`backend/app/`)

| Module | Purpose | Key Exports | Status |
|--------|---------|---|--------|
| `main.py` | FastAPI app creation, CORS, router include | app | ✓ Complete |
| `api/routes.py` | REST endpoints (health, vessels, plans, validate, solve) | router (APIRouter) | ✓ Partial (solve TODO→async job) |
| `domain/models.py` | Pydantic models (single source of truth) | Vessel, Container, PortCall, Slot, StowagePlan, ValidationReport, Violation | ✓ Complete |
| `domain/slot.py` | Slot code parsing & helpers | parse_slot, is_forty_bay, is_on_deck, row_side | ✓ Complete |
| `data/sample.py` | Demo vessel + cargo generation | load_sample_vessel, random_cargo, SAMPLE_PORTS | ✓ Complete |
| `data/sample_vessel.json` | Reference feeder vessel profile | — | ✓ Complete |
| `validation/engine.py` | Main validation orchestrator | validate(vessel, plan) | ✓ Complete |
| `validation/context.py` | ValidationContext (pre-indexed columns, stacks) | ValidationContext | ✓ Complete |
| `validation/rules.py` | Rule functions executed by engine | slot_exists, size_fits_bay, stack_weight, no_floating, reefer_plug, overstow, ALL_RULES | ✓ Partial (6 rules; IMDG, stack height, OOG, stability, strength TODO) |
| `solver/base.py` | StowageSolver Protocol | StowageSolver (Protocol, name + solve) | ✓ Complete |
| `solver/greedy.py` | Greedy v1 auto-stow | GreedySolver (sorts by POD/weight) | ✓ Partial (no rule checks) |
| `solver/cpsat.py` | OR-Tools CP-SAT solver stub | CpSatSolver | ○ Stub (raises NotImplementedError) |
| `solver/registry.py` | Solver factory | SOLVERS dict | ✓ Complete |
| `stability/calc.py` | Stability calculations (GM, trim, SF/BM) | — | ○ Stub |

## Data Flow

### Load & Display

```
1. Frontend App.tsx loads demo plan (GET /api/plans/demo?n=150)
   └─> Backend: GreedySolver.solve() → StowagePlan (150 placements)
   └─> Zustand store → plan, selected, colorMode
   
2. Sidebar, VesselScene, BayPlanView render from plan + vessel
   └─> ContainerInstances groups containers by size
   └─> InstancedMesh per size (target 60fps @ 20k containers; not yet benchmarked)
   
3. Frontend validates plan (POST /api/validate)
   └─> Backend: engine.validate() runs ALL_RULES
   └─> Returns: violations[], kpis{placed, unplaced, overstows, errors}
   └─> Sidebar displays violations
```

### Manual Edit (Phase 2, Stub)

```
1. User drags container in 2D or 3D
2. Frontend debounces → POST /api/validate with updated plan
3. Backend returns violations immediately
4. Sidebar highlights errors (red) and warnings (yellow)
5. Frontend undo/redo stack (TBD: zundo or custom)
```

### Auto-Stow (Phase 3, Partial)

```
1. User clicks "Solve" → POST /api/stowage/solve {vessel_id, solver: "greedy-v0", plan}
2. Backend: solver.solve(vessel, cargo, ports, voyage)
   └─> GreedySolver sorts by discharge order, weight
   └─> Fills free slots bottom-up, respects reefer only
   └─> NOT validated yet (gap vs ARCHITECTURE.md contract; client can POST /api/validate)
3. Returns: StowagePlan with placements[] + unplaced[]
4. Frontend displays new plan; user can refine
```

## Implemented vs. Stub Status

| Component | Lines | Implemented | Stub / TODO |
|-----------|-------|---|---|
| **Frontend** | 580+ | types, geometry math, store, color schemes, 3D scene, L1 parametric hull | L2 hull (offsets import), bayplan, drag edit |
| **Backend Models** | 121 | Pydantic models, slot helpers | hydrostatics, tanks |
| **Validation** | 151 | engine, context, 6 rules | IMDG, stack height, OOG, stability, strength |
| **Solvers** | 83 | GreedySolver (basic sort) | no rule checks; CP-SAT stub |
| **API** | 64 | health, vessels, plans, demo, validate | async solve jobs, BAPLIE IO |
| **Tests** | 37 | test_api, test_slot | coverage TBD |

### Key Stubs (Marked TODO(phase-N))

- **Phase 1:** L1 parametric hull ✓; 20'/45' instanced meshes; 2D bay plan; performance check
- **Phase 2:** BAPLIE import/export; drag edit; undo/redo; PostgreSQL; plan versioning
- **Phase 3:** Greedy rule checks; KPI benchmark; split/balance optimization
- **Phase 4:** CP-SAT solver; stability calc; async job queue; WebSocket progress
- **Phase 5:** AI assistant; what-if planner; multi-port re-planning; RL research

## Key Files by Purpose

### Type Definitions (Single Source of Truth)
- `backend/app/domain/models.py` (121 LOC)
- `frontend/src/types/domain.ts` (mirrors above)
- **Convention:** Keep in sync via manual sync rule (phase 2: `openapi-typescript` auto-gen)

### Validation Rules
- `backend/app/validation/rules.py` (104 LOC)
- **Pattern:** Pure functions `Rule: ValidationContext → Violation[]`
- **To add a rule:** Write function, append to `ALL_RULES` list, write test

### Solver Interface
- `backend/app/solver/base.py` (12 LOC, Protocol)
- **Pattern:** Implement `StowageSolver` Protocol with `.name` and `.solve()` method
- **Registry:** `solver/registry.py` injects solvers into routes

### 3D Rendering
- `frontend/src/features/viewer3d/ContainerInstances.tsx` (111 LOC)
- **Pattern:** InstancedMesh per container size; instance ID → raycast selection
- **Geometry:** `lib/geometry.ts` transforms slot → [x, y, z] position

## Dependencies & Versions

| Package | Version | Role |
|---------|---------|------|
| **Frontend** | | |
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool (dev server, HMR) |
| @react-three/fiber | 9 | React ↔ Three.js declarative |
| three | 0.170 | 3D rendering |
| @react-three/drei | 10 | R3F utilities (OrbitControls, etc.) |
| zustand | 5 | State management (minimal) |
| @tanstack/react-query | 5 | Server state + caching |
| **Backend** | | |
| FastAPI | 0.115+ | Web framework |
| Pydantic | 2 | Data validation |
| uvicorn | 0.30+ | ASGI server |
| httpx | 0.27+ | HTTP client (tests) |
| pytest | 8+ | Unit/integration tests |
| (ortools) | 9.11+ | OR-Tools (phase 4; commented) |
| (numpy) | 1.24+ | Numerics (phase 4; commented) |

## Database Schema (Phase 2)

> PostgreSQL. Not yet implemented; commented in docker-compose.yml.

```
vessels(id PK, name, imo, length_m, beam_m, ...)
  → has many stacks (bay, row, deck, max_weight_t, reefer_tiers)

plans(id PK, vessel_id FK, voyage, created_at, status)
  ↓ has many plan_versions
  
plan_versions(id PK, plan_id FK, version, created_at, created_by)
  → has many placements (container_id, slot, position)

containers(id PK, voyage_id FK, size, type, weight_t, pol, pod, imdg_class, ...)

port_calls(id PK, voyage_id FK, locode, name, sequence, eta, etd)
```

## Testing Strategy

| Layer | Tool | Coverage | Status |
|-------|------|----------|--------|
| Slot math | pytest | 100% | ✓ test_slot.py |
| Validation rules | pytest + golden files | TBD | ○ Basic tests only |
| API endpoints | pytest + httpx | TBD | ✓ test_api.py (health, vessel) |
| Frontend components | vitest + React Testing Library | TBD | ○ None yet |
| Solver benchmarks | Golden-file harness (BAPLIE round-trip) | TBD | ○ Phase 3 |

**To run:**
```bash
cd backend && pytest
cd frontend && npm run typecheck
```

## Naming Conventions Observed

**Backend (Python):**
- Models, functions, variables: `snake_case`
- Protocol classes: `PascalCase` (e.g., `StowageSolver`)
- Pydantic enums: `PascalCase` (e.g., `DeckLevel`, `ContainerSize`)
- Private functions: `_helper_name`

**Frontend (TypeScript):**
- Components: `PascalCase` (e.g., `VesselScene`, `ContainerInstances`)
- Hooks: `useXxx` (e.g., `usePlanStore`)
- Variables, functions: `camelCase`
- Types, interfaces: `PascalCase` (e.g., `Vessel`, `ColorMode`)
- Constants: `UPPER_CASE` (e.g., `DIM`, `LAYOUT`)
- CSS classes, files: `kebab-case` (e.g., `styles.css`, `.viewport`)

**Note:** Existing frontend uses `PascalCase` for component files. CLAUDE.md prefers `kebab-case` for new files — this is an open design tension.

## Integration Points

| Interface | Method | Status | Notes |
|-----------|--------|--------|-------|
| Frontend ↔ Backend API | REST JSON | ✓ Prod | typed via Pydantic + TS mirrors |
| Frontend ↔ Store | Zustand selectors | ✓ Prod | no re-render on plan change |
| Backend ↔ Validation | Protocol dispatch | ✓ Prod | pure functions; rules added via ALL_RULES list |
| Backend ↔ Solver | Protocol dispatch | ✓ Prod | solver.solve() contract enforced |
| Backend ↔ DB | SQLAlchemy ORM | ○ Phase 2 | currently in-memory store |
| Frontend ↔ 3D Engine | R3F declarative | ✓ Prod | InstancedMesh per size; raycast selection |
| Frontend ↔ Local Storage | JSON (future) | ○ Phase 2 | plan draft auto-save |

## Build & Deploy

**Frontend:**
- `npm run dev` → Vite dev server :5173; proxies /api → API_URL (default: http://localhost:8000)
- `npm run build` → vite build (tsc --noEmit + tree-shake)
- `npm run typecheck` → tsc --noEmit

**Backend:**
- `python -m venv .venv && source .venv/bin/activate`
- `pip install -r requirements.txt`
- `uvicorn app.main:app --reload --port 8000`

**Docker:**
- `docker compose up --build` → api :8000 + web :5173 (hot reload both)
- Future: PostgreSQL, Redis job queue, K8s deployment

## Open Questions

1. **Type Generation:** Generate TS types from OpenAPI schema via `openapi-typescript` (phase 2)?
2. **Component File Naming:** Keep `PascalCase` (existing) or migrate to `kebab-case` (CLAUDE.md)?
3. **IMDG Rules:** Full IACS table or simplified rules first?
4. **Stability Model:** Ballast / fuel simulation in phase 4 or post-MVP?
5. **Multi-Solver Testing:** Benchmark harness with real BAPLIE files ready?
