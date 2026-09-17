# Cargo Planner Pro

**Interactive 3D maritime cargo stowage planning tool** for container vessels. Plan container placements, validate against vessel constraints, and auto-generate optimized stowage plans in real time.

## What Is This?

Cargo Planner Pro is a decision-support application for stowage planners at shipping lines and freight forwarders. It lets you:
- View ship hull and cargo in interactive 3D + 2D bay plan
- Manually place, move and retrieve containers with live constraint validation
- Run the greedy solver and validation engine from the backend API
- Compute indicative stability metrics (demo data only)
- Import/export plans via BAPLIE (EDIFACT standard — not implemented yet)

**Warning:** This is a decision-support tool only. All plans must be verified on an official loading computer certified per IACS UR L5 before cargo operations.

## Quick Start

### Prerequisites
- **Frontend:** Node.js 20+, npm
- **Backend:** Python 3.11+, pip
- **Docker (optional):** Docker and Docker Compose for containerized dev

### Local Development

> **The two halves run independently today.** The frontend builds its demo vessel, cargo and plan
> entirely in the browser (`src/data/build-demo-plan.ts`) and validates locally
> (`src/engine/validate-plan.ts`). It makes no calls to the backend: `frontend/src/api/client.ts` has
> no importers, and the Vite `/api` proxy below is configured but unused. Start the backend only if
> you are working on the API itself.

**Backend (Terminal 1):**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API runs at `http://localhost:8000`; docs at `/docs`.

**Frontend (Terminal 2):**
```bash
cd frontend
npm install
npm run dev
```
App runs at `http://localhost:5173`; Vite proxies `/api/*` to `API_URL` (default `http://localhost:8000`) — configured, but nothing calls it.

**Available npm scripts:**
- `npm run dev` — Start dev server with HMR
- `npm run build` — Production build (tsc + vite)
- `npm run typecheck` — Type check without emitting
- `npm run preview` — Preview production build
- `npm run test` — Run the unit suite (vitest, node environment)

No eslint or prettier config exists in the repo, and there is no CI — the typecheck, build and test
commands above are run manually.

### Docker Compose
```bash
docker compose up --build
```
Services: api (:8000), web (:5173, running the Vite dev server). Mounts for hot reload both services.

## Architecture Overview

```
┌─ Frontend (React 19 + TypeScript + React Three Fiber) ─┐
│  3D viewer (one InstancedMesh), 2D bay plan, sidebar      │
│                                                           │
├─ Zustand, two stores:                                     │
│    usePlanStore      — view state (color mode + palette,  │
│                        selection, filters, in-hand gesture)│
│    usePlanDraftStore — the editable plan + undo/redo      │
├─ React Query provider mounted in main.tsx — no queries run│
└─────────────────────────────────────────────────────────┘
              ✗ no runtime calls (api/client.ts is unused)
┌─ Backend (Python FastAPI + Pydantic) — standalone ──────┐
│  Validation engine (6 rules), greedy solver, model types │
│  Stability calcs (GM, trim, SF/BM), BAPLIE I/O (phase 2) │
└─────────────────────────────────────────────────────────┘
```

Styling is Tailwind 4 (via `@tailwindcss/vite`) plus shadcn components; app-level layout rules live in
`frontend/src/styles.css`.

For detailed architecture, see [docs/system-architecture.md](./docs/system-architecture.md).

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/domain/models.py` | Pydantic models (Vessel, Container, Plan, etc.); single source of truth |
| `backend/app/validation/rules.py` | Constraint rules (slot_exists, size_fits_bay, stack_weight, etc.) |
| `backend/app/solver/greedy.py` | Greedy heuristic solver v1 |
| `frontend/src/engine/stowage-model/` | Single source of truth for stowage areas + container slots |
| `frontend/src/engine/placement/` | `canPlaceContainer` / `canPlaceBreakbulk` — the one predicate per cargo kind |
| `frontend/src/store/usePlanDraftStore.ts` | The editable plan: place/move/unplace, undo/redo, validate-then-mutate |
| `frontend/src/store/commit-placement.ts` | The one commit resolver behind both drag release and click-to-pick |
| `frontend/src/lib/drop-verdict.ts` | Three-state drop verdict + tint for one slot |
| `frontend/src/lib/unplaced-query.ts` | Pure search / filter / sort / group query behind the Unplaced list |
| `frontend/src/features/viewer3d/ContainerInstances.tsx` | 3D rendering (one InstancedMesh, per-instance length) |
| `frontend/src/types/domain.ts` | TypeScript mirrors of backend models |
| `frontend/src/lib/geometry.ts` | Slot-to-position coordinate transforms |

See [docs/codebase-summary.md](./docs/codebase-summary.md) for complete module listing.

## Development Commands

```bash
# Frontend unit tests (currently 75 files / 586 tests)
cd frontend && npm test

# Frontend type checking
cd frontend && npm run typecheck

# Backend: no test suite exists yet. pytest is declared in backend/requirements.txt,
# but there is no backend/tests/ directory — running pytest there collects nothing.
```

## Documentation

- **[Project Overview & Requirements](./docs/project-overview-pdr.md)** — Use cases, features, phases, success criteria
- **[System Architecture](./docs/system-architecture.md)** — API reference, data models, component design
- **[Code Standards & Conventions](./docs/code-standards.md)** — Naming, patterns, type hints, testing style
- **[Codebase Summary](./docs/codebase-summary.md)** — Module-by-module breakdown, data flow, status
- **[Project Roadmap](./docs/project-roadmap.md)** — Phase tracking, milestones, known gaps
- **[Domain & Constraints](./docs/DOMAIN.md)** — Stowage domain terminology, slot coordinates, hard rules
- **[Architecture Decisions](./docs/ARCHITECTURE.md)** — Tech stack, validator-first principle, InstancedMesh strategy
- **[Deployment Guide](./docs/deployment-guide.md)** — Local, Docker, production setup

## Phases & Status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Domain + data | ~10% (synthetic sample; real vessel TBD) |
| 1 | 3D + 2D viewer | ~70% (L1 parametric hull, component library, livery, instancing, 2D bay plan; perf check + LOD open) |
| 2 | Manual editor + validation | ~60% (editor committed: place/move by drag or click-to-pick, undo/redo, live validation; BAPLIE IO, swap and persistence open) |
| 3 | Greedy auto-stow | ~15% (greedy-v0 sort committed; per-slot rule checks and output validation TODO) |
| 4 | Optimization + stability | ~0% (CP-SAT + hydrostatics stub) |
| 5 | AI layer | 0% (research only) |

Phase percentages match [docs/project-roadmap.md](./docs/project-roadmap.md), which is the living
status source.

**Working tree note (2026-09-17):** a drag-drop UX polish pass (plan
`plans/260916-2117-optimize-drag-drop-ux/`) is implemented and unit-tested but **uncommitted and not
browser-verified** — the repo has no DOM test environment, so the interactive behaviour is covered
only by the manual click-through script (`plans/reports/manual-click-through-260916-phase-c.md`,
steps 22–34, outstanding). It is credited in the phase-2 figure above but is not "shipped".

## Key Design Principles

1. **Validator before optimizer:** Every plan (human or solver) passes the same rule engine
2. **One InstancedMesh for all containers:** every size shares one mesh with per-instance length scale — one draw call; 20k @ 60fps is the target, not yet benchmarked
3. **Type safety:** Pydantic + TypeScript; frontend types mirror the backend models (kept in sync by hand — the frontend does not call the API)
4. **Protocol-based solvers:** Easy to swap greedy for CP-SAT; interface enforced at type level
5. **Pluggable rules:** New constraint = new function + test + append to `ALL_RULES`

## Known Gaps & TODOs

- **Frontend/backend not wired:** the demo plan is built and validated client-side; `api/client.ts` has no importers and the `/api` proxy is unused
- **Drag-drop editor not browser-verified:** implemented + unit-tested in the working tree, uncommitted; manual click-through steps 22–34 unrun (no DOM test environment)
- **BAPLIE import/export:** Not yet implemented (phase 2)
- **Solver validation:** `/api/stowage/solve` returns solver output without running its own `validate()` (fix in phase 3)
- **Stack height rules:** Visibility line + OOG clearance TBD (phase 2)
- **IMDG segregation:** Simplified rules first; full table phase 3+
- **Stability for operations:** Current calcs are demo/indicative only; always verify on official loading computer
- **PostgreSQL:** In-memory store only; DB integration phase 2

## Contributing

- Read [Code Standards](./docs/code-standards.md) for naming and patterns
- Fork/branch, test locally, open PR
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- No AI references in commit messages

## Support & Questions

Refer to [CLAUDE.md](./CLAUDE.md) for development workflows and orchestration rules. See issues/discussions for ongoing questions and status.

---

**Version:** 0.1.0 (skeleton) | **Last Updated:** 2026-09-17
