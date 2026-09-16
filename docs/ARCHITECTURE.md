# Architecture

```
┌────────────────────────── Frontend (React + R3F) ──────────────────────────┐
│  Sidebar (plan, legend, violations)   3D Viewer (InstancedMesh)   2D Bay Plan │
│              ▲  Zustand stores: view state + plan draft (undo/redo)          │
└──────────────┬──────────┴───────────────────────────────────────────────────┘
               │ REST (JSON)            WebSocket (solver progress, phase 4)
┌──────────────▼──────────────────── Backend (FastAPI) ───────────────────────┐
│  api/        vessels · plans · validate · stowage/jobs                       │
│  domain/     Pydantic models, slot helpers (single source of truth)          │
│  io/         BAPLIE parse/write                                              │
│  validation/ Rule engine  ◄──────────── used by BOTH manual edits & solver   │
│  stability/  hydrostatics, GM/trim, SF/BM                                    │
│  solver/     StowageSolver interface → GreedySolver, CpSatSolver             │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │
          PostgreSQL (phase 2+)        Job queue (RQ/Celery, phase 4)
```

## Key decisions

| Topic | Choice | Why |
|---|---|---|
| 3D | React Three Fiber + drei | Declarative Three.js in React; fits existing React/TS skills |
| Rendering | One `InstancedMesh` per container size | 10k–20k boxes at 60fps; one draw call each |
| 2D bay plan | CSS grid (React) | Planners work in bay view; DOM cells give easy hit-testing and click-to-place |
| Placement checks | One predicate per cargo kind (`engine/placement/`) | Drop preview, placeholders and validation share it, so the UI cannot promise a slot the validator refuses |
| State | Zustand | Small, no boilerplate, selectors avoid re-rendering the canvas |
| Backend | Python + FastAPI | OR-Tools, NumPy, ML ecosystem in one language |
| Optimizer | OR-Tools CP-SAT | Free, strong on scheduling/assignment with hard constraints |
| Interchange | BAPLIE (EDIFACT) | Industry standard for bay plans |

## Solver contract

```python
class StowageSolver(Protocol):
    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall]) -> StowagePlan
```

Every solver output goes through `validation.engine.validate(plan)` before returning.
