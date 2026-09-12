# Cargo Planner 3D

3D stowage planning tool for container vessels: view the ship and its cargo in 3D, plan manually with live rule validation, and (later) auto-stow with an optimization engine.

**Status:** Skeleton (phases 0–5). Structure, types, and stubs in place; real logic marked `TODO(phase-N)`.

## Quick Start

### Local Development

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api → :8000)
```

### Docker Compose

```bash
docker compose up --build
```

## Documentation Index

| Doc | Purpose |
|-----|---------|
| **[PLAN.md](docs/PLAN.md)** | Phases 0–5, milestones, checklist |
| **[Project Overview](docs/project-overview-pdr.md)** | Goals, users, requirements, success criteria |
| **[Codebase Summary](docs/codebase-summary.md)** | Architecture, modules, data flow, implementation status |
| **[Code Standards](docs/code-standards.md)** | Coding conventions, patterns, naming rules |
| **[System Architecture](docs/system-architecture.md)** | Components, REST API, 3D pipeline, coordinate system |
| **[Project Roadmap](docs/project-roadmap.md)** | Phase status vs. code, known gaps |
| **[Deployment Guide](docs/deployment-guide.md)** | Local dev, Docker, config, troubleshooting |
| **[Design Guidelines](docs/design-guidelines.md)** | UI layout, colors, typography, responsive design |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Component diagram, tech decisions, solver contract |
| **[DOMAIN.md](docs/DOMAIN.md)** | Slot coordinates, hard constraints, soft objectives, glossary |

## Key Features

- **3D Visualization:** React Three Fiber + InstancedMesh rendering (20k containers @ 60fps)
- **Live Validation:** Real-time rule checking against hard constraints
- **Manual Editing:** Drag/drop containers (phase 2)
- **Auto-Stow:** Greedy heuristic (phase 3) → CP-SAT optimization (phase 4)
- **Stability Calc:** GM, trim, SF/BM (phase 4)
- **BAPLIE I/O:** Import/export (phase 2)

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | React 19 + TypeScript + Vite 6 + React Three Fiber 9 + Zustand 5 + TanStack Query 5 |
| **Backend** | Python 3.11 + FastAPI + Pydantic v2 + uvicorn + pytest |
| **3D Engine** | three.js 0.170 + @react-three/drei 10 |
| **Data** | PostgreSQL (phase 2+); currently in-memory |
| **Deploy** | Docker Compose (dev), cloud-agnostic (prod) |

## Project Structure

```
cargo-planner/
├── docs/
│   ├── PLAN.md                      # Roadmap
│   ├── ARCHITECTURE.md              # Tech decisions
│   ├── DOMAIN.md                    # Domain model
│   ├── project-overview-pdr.md      # Requirements
│   ├── codebase-summary.md          # Architecture overview
│   ├── code-standards.md            # Conventions
│   ├── system-architecture.md       # API, components
│   ├── deployment-guide.md          # Setup, deploy
│   └── design-guidelines.md         # UI specs
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # Entry point
│   │   ├── App.tsx                  # Layout
│   │   ├── types/domain.ts          # Type mirrors
│   │   ├── api/client.ts            # HTTP client
│   │   ├── store/usePlanStore.ts    # Zustand state
│   │   ├── lib/geometry.ts          # 3D math
│   │   ├── features/
│   │   │   ├── viewer3d/            # 3D scene
│   │   │   ├── bayplan/             # 2D view (stub)
│   │   │   └── panels/              # Sidebar
│   │   └── styles.css
│   ├── vite.config.ts
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app
│   │   ├── api/routes.py            # REST routes
│   │   ├── domain/
│   │   │   ├── models.py            # Pydantic models
│   │   │   └── slot.py              # Slot helpers
│   │   ├── validation/
│   │   │   ├── engine.py            # Validator
│   │   │   ├── rules.py             # Constraint rules
│   │   │   └── context.py           # Validation context
│   │   ├── solver/
│   │   │   ├── base.py              # Protocol interface
│   │   │   ├── greedy.py            # Greedy solver
│   │   │   ├── cpsat.py             # CP-SAT (stub)
│   │   │   └── registry.py          # Solver factory
│   │   ├── io/baplie.py             # BAPLIE I/O (stub)
│   │   ├── data/
│   │   │   ├── sample.py
│   │   │   └── sample_vessel.json
│   │   ├── stability/calc.py        # Stability (stub)
│   ├── tests/
│   │   ├── test_api.py
│   │   └── test_slot.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md (this file)
```

## Development Workflow

1. **Read documentation:** Start with [Project Overview](docs/project-overview-pdr.md)
2. **Explore code:** See [Codebase Summary](docs/codebase-summary.md)
3. **Check standards:** Follow [Code Standards](docs/code-standards.md)
4. **Understand architecture:** Review [System Architecture](docs/system-architecture.md)
5. **Run locally:** Follow [Deployment Guide](docs/deployment-guide.md)

## Testing

**Backend:**
```bash
cd backend && pytest
```

**Frontend:**
```bash
cd frontend && npm run typecheck
```

## API Reference

**Base URL:** `http://localhost:8000/api`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/vessels/{id}` | GET | Get vessel profile |
| `/plans/demo` | GET | Load + auto-stow demo plan |
| `/validate` | POST | Validate stowage plan |
| `/stowage/solve` | POST | Run solver (greedy or CP-SAT) |

See [System Architecture](docs/system-architecture.md) → REST API Reference for details.

## Safety Notice

⚠️ **This is decision support only.** All plans must be verified on an **official loading computer** certified per **IACS UR L5** before cargo operations. Never rely on this tool for final stowage approval.

## Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Domain setup | ○ Planning |
| 1 | 3D + 2D viewer | ✓ Skeleton complete |
| 2 | Manual editor + DB | ○ In progress |
| 3 | Greedy auto-stow | ✓ Basic implementation |
| 4 | Optimization + stability | ○ Planned |
| 5 | AI assistant | ○ Research |

See [PLAN.md](docs/PLAN.md) for detailed checklist.

## Contributing

1. Follow [Code Standards](docs/code-standards.md)
2. Ensure tests pass: `pytest` (backend) or `npm run typecheck` (frontend)
3. Mark incomplete work with `TODO(phase-N)` comments
4. Update relevant docs when adding features

## Support

- **Bug reports:** GitHub Issues
- **Questions:** GitHub Discussions
- **Docs:** See [Documentation Index](#documentation-index) above

## License

[To be determined]
