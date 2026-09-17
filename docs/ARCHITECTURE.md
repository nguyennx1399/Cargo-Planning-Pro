# Architecture

```
┌────────────────────────── Frontend (React + R3F) ──────────────────────────┐
│  Sidebar (sectioned: Cargo · ProjectCargo · LoadingSeq · ColorMode ·        │
│           ViewOptions · Stability · Inspector · Unplaced · Checks)          │
│  3D Viewer (InstancedMesh)                        2D Bay Plan (CSS grid)    │
│              ▲  Zustand stores: view state + plan draft (undo/redo)         │
│              ▲  lib/ + engine/ — the UI's OWN copies of the rules           │
└──────────────┬──────────────────────────────────────────────────────────────┘
               ┊ REST (JSON) — contract only, NOT WIRED (no module calls it)
┌──────────────┴──────────────────── Backend (FastAPI) ───────────────────────┐
│  api/        health · vessels/{id} · plans/demo · validate · stowage/solve   │
│  domain/     Pydantic models, slot helpers — mirrored BY HAND in             │
│              frontend/src/types/domain.ts, not shared at runtime             │
│  io/         BAPLIE parse/write                    — STUB (NotImplemented)   │
│  validation/ Rule engine — 6 live rules; used by /api/validate only,         │
│              NOT by the solver and NOT by the UI                            │
│  stability/  hydrostatics, GM/trim, SF/BM          — STUB (weight sum only)  │
│  solver/     StowageSolver interface → GreedySolver (real), CpSat (stub)     │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │
          PostgreSQL (phase 2+)        Job queue (RQ/Celery, phase 4)
```

**The two halves do not talk at runtime.** The frontend builds its demo plan client-side and validates it with its own TypeScript engine; the backend is a runnable but standalone service. See `docs/system-architecture.md` → "Frontend / Backend Wiring".

## Key decisions

| Topic | Choice | Why |
|---|---|---|
| 3D | React Three Fiber + drei | Declarative Three.js in React; fits existing React/TS skills |
| Rendering | ONE `InstancedMesh` for **all** container sizes | Per-instance matrix scale (`LENGTH_BY_SIZE`) renders 20'/40'/45' correctly while every box shares one draw call |
| 2D bay plan | CSS grid (React) | Planners work in bay view; DOM cells give easy hit-testing and click-to-place |
| Placement checks | One predicate per cargo kind (`engine/placement/`) | Drop preview, placeholders and validation share it, so the UI cannot promise a slot the validator refuses |
| Drop wording | One function per sentence (`lib/drop-feedback.ts`) | Ghost tint, cursor, at-cursor chip and the Sidebar readout read the same strings, so no two surfaces can disagree |
| Slot resolution | Nearest slot **centre** to the cursor ray's tier-plane crossing (`lib/nearest-slot.ts`) | Deterministic and restricted to the candidate set — no dependence on three.js hit order or camera side |
| UI primitives | Tailwind 4 (`@tailwindcss/vite`) + shadcn in `components/ui/` | No Tailwind config file: v4 is configured through `@theme inline` in `styles.css` |
| State | Zustand | Small, no boilerplate, selectors avoid re-rendering the canvas |
| Backend | Python + FastAPI | OR-Tools, NumPy, ML ecosystem in one language |
| Optimizer | OR-Tools CP-SAT | Free, strong on scheduling/assignment with hard constraints |
| Interchange | BAPLIE (EDIFACT) | Industry standard for bay plans |

## Solver contract

```python
class StowageSolver(Protocol):
    name: str
    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
              voyage: str) -> StowagePlan: ...
```

**Target, not current behaviour:** every solver output *should* go through `validation.engine.validate(vessel, plan)` before returning. It does not. `GreedySolver.solve()` returns its plan directly and checks only the reefer-plug condition on the placement path, so its output can fail the very rules `/api/validate` applies — it applies no stack-weight limit, no size-per-bay check, no reefer-below support rule and no floating check. This is the roadmap's Known Gap #1; treat a green `/api/stowage/solve` response as unvalidated.
