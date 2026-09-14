# Cargo Planner Pro

**Interactive 3D maritime cargo stowage planning tool** for container vessels. Plan container placements, validate against vessel constraints, and auto-generate optimized stowage plans in real time.

## What Is This?

Cargo Planner Pro is a decision-support application for stowage planners at shipping lines and freight forwarders. It lets you:
- View ship hull and cargo in interactive 3D + 2D bay plan
- Manually place containers with live constraint validation
- Auto-generate stowage plans via greedy or optimization solvers
- Compute indicative stability metrics (demo data only)
- Import/export plans via BAPLIE (EDIFACT standard)

**Warning:** This is a decision-support tool only. All plans must be verified on an official loading computer certified per IACS UR L5 before cargo operations.

## Quick Start

### Prerequisites
- **Frontend:** Node.js 20+, npm
- **Backend:** Python 3.11+, pip
- **Docker (optional):** Docker and Docker Compose for containerized dev

### Local Development

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
App runs at `http://localhost:5173`; Vite proxies `/api/*` to backend.

**Available npm scripts:**
- `npm run dev` — Start dev server with HMR
- `npm run build` — Production build (tsc + vite)
- `npm run typecheck` — Type check without emitting
- `npm run preview` — Preview production build
- `npm run test` — Run tests (vitest)

### Docker Compose
```bash
docker compose up --build
```
Services: api (:8000), web (:5173). Mounts for hot reload both services.

## Architecture Overview

```
┌─ Frontend (React 19 + TypeScript + React Three Fiber) ─┐
│  3D viewer (InstancedMesh), 2D bay plan, sidebar panels  │
│                                                           │
├─ Zustand store (color mode, selection, filters)         │
├─ React Query cache (plan, vessel data)                  │
└─────────────────────────────────────────────────────────┘
                     ↓ REST JSON API
┌─ Backend (Python FastAPI + Pydantic) ───────────────────┐
│  Validation engine (6 rules), greedy solver, model types │
│  Stability calcs (GM, trim, SF/BM), BAPLIE I/O (phase 2) │
└─────────────────────────────────────────────────────────┘
```

For detailed architecture, see [docs/system-architecture.md](./docs/system-architecture.md).

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/domain/models.py` | Pydantic models (Vessel, Container, Plan, etc.); single source of truth |
| `backend/app/validation/rules.py` | Constraint rules (slot_exists, size_fits, stack_weight, etc.) |
| `backend/app/solver/greedy.py` | Greedy heuristic solver v1 |
| `frontend/src/features/viewer3d/ContainerInstances.tsx` | 3D rendering (InstancedMesh per size) |
| `frontend/src/types/domain.ts` | TypeScript mirrors of backend models |
| `frontend/src/lib/geometry.ts` | Slot-to-position coordinate transforms |

See [docs/codebase-summary.md](./docs/codebase-summary.md) for complete module listing.

## Development Commands

```bash
# Backend tests
cd backend && pytest

# Frontend type checking
cd frontend && npm run typecheck

# Both (from repo root)
# Run each in separate terminal
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
| 1 | 3D + 2D viewer | ~60% (hull rendering, container instancing, controls) |
| 2 | Manual editor + validation | ~25% (rule engine complete, drag edit TODO) |
| 3 | Greedy auto-stow | ~15% (basic sort; rule checks TODO) |
| 4 | Optimization + stability | ~0% (CP-SAT + hydrostatics stub) |
| 5 | AI layer | 0% (research only) |

## Key Design Principles

1. **Validator before optimizer:** Every plan (human or solver) passes the same rule engine
2. **One InstancedMesh per container size:** 20k containers @ 60fps via grouped rendering
3. **Type safety:** Pydantic + TypeScript; backend models mirror frontend types
4. **Protocol-based solvers:** Easy to swap greedy for CP-SAT; interface enforced at type level
5. **Pluggable rules:** New constraint = new function + test + append to `ALL_RULES`

## Known Gaps & TODOs

- **BAPLIE import/export:** Not yet implemented (phase 2)
- **Solver validation:** Greedy output not validated post-solve (fix in phase 3)
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

**Version:** 0.1.0 (skeleton) | **Last Updated:** 2026-09-14
