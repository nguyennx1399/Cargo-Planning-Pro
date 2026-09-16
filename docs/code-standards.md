# Code Standards & Conventions

## Overview

This document captures conventions *as observed in the codebase*, not prescriptive rules. Standards align with language ecosystems and existing code patterns.

## Backend (Python)

### Structure & Organization

**File naming:** `snake_case.py` per Python convention.

```python
# backend/app/domain/models.py (121 LOC)
# Single source of truth for domain models; Pydantic BaseModel subclasses

# backend/app/solver/base.py (12 LOC)
# Interface definitions; Protocol classes

# backend/app/validation/rules.py (104 LOC)
# Pure rule functions: context → violations[]
```

### Pydantic Models

**Pattern:** Subclass `BaseModel`; use type hints; add validators where needed.

```python
from pydantic import BaseModel, Field
from enum import Enum

class ContainerSize(str, Enum):
    FT20 = "20"
    FT40 = "40"
    FT45 = "45"

class Container(BaseModel):
    id: str                       # ISO 6346
    size: ContainerSize
    type: ContainerType = ContainerType.DRY
    high_cube: bool = False
    weight_t: float
    pol: str                      # UN/LOCODE
    pod: str
    imdg_class: str | None = None
    oog: bool = False
```

**Conventions:**
- Field names: `snake_case`
- Enum values: UPPERCASE (string-backed to match BAPLIE/ISO)
- Optional fields: `Type | None` (Python 3.10+ union syntax)
- Defaults: simple types inline; complex defaults via `Field(default_factory=...)`
- Comments: brief, explain domain meaning (not type)

### Protocol-Based Solvers

**Interface definition:**

```python
# backend/app/solver/base.py
from typing import Protocol

class StowageSolver(Protocol):
    name: str
    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
              voyage: str) -> StowagePlan: ...
```

**Implementation pattern:**

```python
# backend/app/solver/greedy.py
class GreedySolver:
    name = "greedy-v0"
    def solve(self, vessel, cargo, ports, voyage):
        # implementation
        return StowagePlan(...)
```

**Registry pattern:**

```python
# backend/app/solver/registry.py
SOLVERS: dict[str, StowageSolver] = {
    GreedySolver.name: GreedySolver(),
    CpSatSolver.name: CpSatSolver(),
}
```

### Validation Rules

**Pattern:** Pure functions, no side effects, immutable context.

```python
# backend/app/validation/rules.py

Rule = Callable[[ValidationContext], list[Violation]]

def slot_exists(ctx: ValidationContext) -> list[Violation]:
    """Check that all placed containers are in valid slots."""
    out = []
    for (bay, row, deck), items in ctx.columns.items():
        stack = ctx.stacks.get((bay, row, deck))
        for tier, cid in items:
            if stack is None or tier not in stack.tiers:
                out.append(Violation(
                    rule="slot_exists",
                    severity=Severity.ERROR,
                    message=f"{cid}: slot does not exist on vessel",
                    container_ids=[cid],
                    slots=[f"{bay:02d}{row:02d}{tier:02d}"]
                ))
    return out

ALL_RULES: list[Rule] = [slot_exists, size_fits_bay, stack_weight, ...]
```

**To add a rule:**
1. Write a function `def my_rule(ctx: ValidationContext) -> list[Violation]:`
2. Append to `ALL_RULES` list
3. Write a test in `backend/tests/test_validation.py`

### Comments & Docstrings

**Docstring style:** Module-level and class-level only; keep brief.

```python
"""Constraint rules. Each rule is a small pure function: context -> violations.

Add a rule = write a function + append it to ALL_RULES. Keep one test per rule.
"""

def slot_exists(ctx: ValidationContext) -> list[Violation]:
    """Check that all placed containers are in valid slots."""
```

**Inline comments:** Rare; only for non-obvious logic.

```python
# free slots bottom-up: under deck first, then on deck
for deck in (DeckLevel.UNDER, DeckLevel.ON):
    ...
```

### Type Hints

**Required:** All function signatures and variables in domain/models, solver, validation modules.

```python
def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
          voyage: str) -> StowagePlan:
```

**Optional but recommended:** Config modules, temporary utility functions.

### Testing

**Framework:** pytest

**Pattern:**
- One test file per module: `test_module_name.py`
- One test per rule or function: `test_rule_name`
- Arrange-Act-Assert structure

```python
# backend/tests/test_slot.py
import pytest
from app.domain.slot import parse_slot, Slot

def test_parse_slot_valid():
    slot = parse_slot("140682")
    assert slot.bay == 14
    assert slot.row == 6
    assert slot.tier == 82

def test_parse_slot_invalid_length():
    with pytest.raises(ValueError):
        parse_slot("1406")
```

**Naming:** `test_<function>_<scenario>`

### TODO Comments (Phase Tracking)

**Format:** `TODO(phase-N): description`

```python
# backend/app/solver/greedy.py
def solve(self, vessel, cargo, ports, voyage):
    # TODO(phase-3): Check stack weight / reefer / size per slot before placing (reuse validation rules)
    # TODO(phase-3): Spread weight across bays for trim (simple longitudinal balancing)
    # TODO(phase-3): Report KPIs through validation.engine
```

**Phases:**
- 0 = domain setup
- 1 = viewer
- 2 = manual editor + DB
- 3 = greedy solver
- 4 = optimization + stability
- 5 = AI

## Frontend (TypeScript)

### File Organization

**Structure:**
```
frontend/src/
├── types/        # Type definitions (domain.ts mirrors backend models)
├── api/          # HTTP client
├── store/        # Zustand stores (usePlanStore = view state, usePlanDraftStore = plan)
├── engine/       # Pure domain logic: stowage model, placement checks, validation rules
├── lib/          # Utilities (geometry, colors, drop verdicts)
├── components/   # Shared UI primitives
├── features/     # Feature folders (viewer3d, bayplan, panels)
└── styles.css    # Global styles
```

**Component naming:** `PascalCase.tsx` (existing convention; tension with CLAUDE.md kebab-case preference)

### Type Definitions

**Single source of truth:** Mirror backend Pydantic models in TypeScript.

```typescript
// frontend/src/types/domain.ts
// Mirrors backend/app/domain/models.py

export interface Vessel {
  id: string;
  name: string;
  imo: string | null;
  length_m: number;
  beam_m: number;
  bays: number[];         // bow → stern
  rows: number[];         // port → starboard
  stacks: StackSpec[];
}

export interface Container {
  id: string;
  size: ContainerSize;
  type: ContainerType;
  high_cube: boolean;
  weight_t: number;
  pol: string;            // UN/LOCODE
  pod: string;
  imdg_class: string | null;
  oog: boolean;
}

export type ContainerSize = "20" | "40" | "45";
export type ContainerType = "DRY" | "REEFER" | "OPEN_TOP" | "FLAT_RACK" | "TANK";
```

**Convention:**
- Interfaces for objects: `PascalCase`
- Union types: `snake_case | `preferred but `PascalCase` accepted
- Field names: match backend exactly (so `imdg_class`, not `imdgClass`)

**Future (Phase 2):** Auto-generate via `openapi-typescript` to guarantee sync.

### React Components

**Pattern:** Functional components with hooks.

```typescript
// frontend/src/App.tsx
import { useEffect, useMemo } from "react";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { usePlanDraftStore } from "@/store/usePlanDraftStore";

export default function App() {
  const { vessel, containers } = useMemo(() => getVesselCatalogEntry(vesselId), [vesselId]);
  const draftPlan = usePlanDraftStore((s) => s.plan);
  const loadPlan = usePlanDraftStore((s) => s.loadPlan);

  // Demo plan built once per (vessel, toggles), then LOADED into the draft store.
  useEffect(() => {
    loadPlan(vessel, buildDemoPlan(vessel, containers, { cargoLoaded, projectCargoLoaded }));
  }, [vessel, containers, cargoLoaded, projectCargoLoaded, loadPlan]);

  const plan = draftPlan ?? LOADING_PLAN; // one-frame stand-in while a vessel switch loads
  return <div className="layout">{/* content */}</div>;
}
```

**Ownership:** the editable plan lives in `usePlanDraftStore`; every view (scene, sidebar, bay plan, validation) reads the draft. There is no `useMemo`-derived plan and no React Query query for plan data.

**Naming:**
- Component names: `PascalCase` (matches file name)
- Props interfaces: `{ComponentName}Props`
- Event handlers: `on{Event}` (e.g., `onPointerMissed`)
- State setters: `set{Property}` (Zustand patterns)

### Zustand Stores

**Pattern:** Two stores with distinct ownership — view state in `usePlanStore`, the editable plan in `usePlanDraftStore`. Plan data is NOT in the React Query cache.

**`usePlanStore` — view state only** (`colorMode`, `paletteMode`, `showHull`, deck toggles, `bayFilter`, `hoveredId`, `selectedId`, playback, plus the gesture state `hoveredSlot`/`draggingContainerId`/`pickedId`). Subscribed narrowly to avoid re-render storms.

```typescript
// frontend/src/store/usePlanStore.ts
import { create } from "zustand";

export const usePlanStore = create<ViewState>((set) => ({
  colorMode: "pod",
  showOnDeck: true,
  // ...
  setColorMode: (colorMode) => set({ colorMode }),
  toggleOnDeck: () => set((s) => ({ showOnDeck: !s.showOnDeck })),
  // A drag start also pauses playback and ends any pick (one item in hand at a time)
  setDraggingContainer: (id) => set(id === null ? { draggingContainerId: null } : { draggingContainerId: id, pickedId: null, hoveredSlot: null, playbackPlaying: false }),
}));
```

**`usePlanDraftStore` — the only place a plan is mutated from the UI.** Invariants that make it safe to select from directly:

- **validate-then-mutate:** every action runs the same predicate the validator uses (`canPlaceContainer`/`canPlaceBreakbulk`) *before* touching state; a rejected action returns its `reasons` and changes nothing (no new plan object, no history entry).
- **never mutate in place:** each action builds a new `StowagePlan`, which keeps every undo entry valid and lets the engine memoise by plan identity.
- **derived `unplaced`:** recomputed as `containers − placements` on every mutation, never stored separately.
- **a move is validated as unplace + place:** the item's own placement is stripped first, so a re-place cannot append a duplicate.
- **undo/redo:** plain `past`/`future` arrays capped at 100 entries (`HISTORY_CAP`); no history library.

```typescript
const placeContainer = usePlanDraftStore((s) => s.placeContainer); // returns a PlacementResult
const undo = usePlanDraftStore((s) => s.undo);
```

**Selectors:** Use when accessing to avoid re-renders.

```typescript
const colorMode = usePlanStore((s) => s.colorMode);
const setSelected = usePlanStore((s) => s.setSelected);
```

### Placement Checks (engine/placement)

**Pattern:** **One predicate per cargo kind**, shared by the drop UI, the drop preview and the full-plan validation. This is the frontend form of the repo's "validator before optimizer" principle — the UI can never offer a slot the validator would flag.

| Module | Role |
|---|---|
| `can-place-container.ts` / `can-place-breakbulk.ts` | The predicates: one candidate (item + slot/pose) → `PlacementResult` |
| `reason.ts` | Rule-id vocabulary + the `RULE_SEVERITY` table (D1) and `PlacementResult` shape |
| `placement-reason-builders.ts` | Shared message builders; messages stay byte-identical to the plan-wide rules |
| `placeholders.ts` | `validSlotsFor` / `blockedSlots` / `blockedReasonFor` / `verdictOf` |

**Rule ids are the same ids** `engine/validation-rules.ts` and `engine/breakbulk-validation-rules.ts` emit, and `breakbulk-validation-rules.ts` now loops over `canPlaceBreakbulk` — so a tooltip and the violations list name the same thing with the same words.

**Performance:** `validSlotsFor` is a per-gesture sweep (≈1.05 ms for 447 slots) — memoise it at the call site. The hover path must use `blockedReasonFor` (one slot, one predicate call), never `blockedSlots`.

### HTTP Client

**Pattern:** Typed methods, centralized in one module.

```typescript
// frontend/src/api/client.ts
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  vessel: (id: string) => http<Vessel>(`/api/vessels/${id}`),
  demoPlan: (n = 150, seed = 42) => http<StowagePlan>(`/api/plans/demo?n=${n}&seed=${seed}`),
  validate: (plan: StowagePlan) =>
    http<ValidationReport>("/api/validate", { 
      method: "POST", 
      body: JSON.stringify(plan) 
    }),
};
```

### 3D Rendering (React Three Fiber)

**Pattern:** Declarative components; one InstancedMesh per container size.

```typescript
// frontend/src/features/viewer3d/ContainerInstances.tsx
export function ContainerInstances({ vessel, plan }: Props) {
  // Group placements by container size
  // Render InstancedMesh per size group
  // Implement raycast selection via instanceId
}
```

**Convention:** Use `@react-three/drei` utilities (OrbitControls, Gizmo).

### Utilities (Geometry, Colors)

**lib/geometry.ts:** Pure functions, constants.

```typescript
export const DIM = {
  len20: 6.058,
  len40: 12.192,
  width: 2.438,
  height: 2.591,
  heightHC: 2.896,
} as const;

export const LAYOUT = {
  bayGap: 1.2,
  rowGap: 0.06,
  tierPitch: 2.65,
  bowMargin: 22,
  hatchHeight: 0.6,
  holdTiers: 4,
};

export function bayCenterX(vessel: Vessel, bay: number): number {
  const i = vessel.bays.indexOf(bay);
  const pitch = DIM.len40 + LAYOUT.bayGap;
  return vessel.length_m / 2 - LAYOUT.bowMargin - (i + 0.5) * pitch;
}

export function slotToPosition(vessel: Vessel, slot: Slot): [number, number, number] {
  return [bayCenterX(vessel, slot.bay), tierCenterY(slot.tier), rowCenterZ(vessel, slot.row)];
}
```

### Styles

**Pattern:** CSS Grid layout, CSS variables for colors (future).

```css
/* frontend/src/styles.css */
.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
}

.stage {
  display: grid;
  grid-template-rows: 1fr 200px;
}

.viewport {
  flex: 1;
  overflow: hidden;
}

.bayplan {
  border-top: 1px solid #e0e0e0;
  overflow-y: auto;
}
```

### Comments

**Docstring style:** JSDoc for exported functions (optional but helpful).

```typescript
/**
 * Transform slot coordinates to 3D position.
 * @param vessel - Vessel dimensions and layout
 * @param slot - Bay, row, tier
 * @returns [x, y, z] in world space
 */
export function slotToPosition(vessel: Vessel, slot: Slot): [number, number, number] {
  ...
}
```

**Inline comments:** Rare; non-obvious logic only.

```typescript
// groupBy size to minimize InstancedMesh count (perf optimization)
const groups = groupBy(plan.placements, p => containerSize(p.container_id));
```

### TODO Comments (Phase Tracking)

Same format as backend: `TODO(phase-N): description`

```typescript
// frontend/src/api/client.ts
// TODO(phase-3): solve(req) -> POST /api/stowage/solve
// TODO(phase-2): importBaplie(file), exportBaplie(planId)
```

## Naming Conventions Summary

| Scope | Convention | Example |
|-------|-----------|---------|
| **Python files** | snake_case | models.py, validation_rules.py |
| **Python functions** | snake_case | parse_slot, validate_plan |
| **Python classes** | PascalCase (models); PascalCase (Protocol) | Container, StowageSolver |
| **Python enums** | PascalCase | ContainerSize, DeckLevel |
| **TypeScript files** | PascalCase (components) | VesselScene.tsx; domain.ts |
| **TypeScript functions** | camelCase | demoPlan, slotToPosition |
| **TypeScript types** | PascalCase | Vessel, ColorMode |
| **TypeScript variables** | camelCase | plan, vessel, colorMode |
| **TypeScript constants** | UPPER_CASE | DIM, LAYOUT, SAMPLE_PORTS |
| **CSS classes** | kebab-case | .stage, .viewport, .bayplan |
| **Git branches** | kebab-case | feature/3d-renderer, fix/validation-bug |

## Design Tension: Component File Naming

**Current:** Components use `PascalCase.tsx` (e.g., `VesselScene.tsx`, `Sidebar.tsx`)

**CLAUDE.md preference:** `kebab-case` for all new files (e.g., `vessel-scene.tsx`, `sidebar.tsx`)

**Resolution:** To be decided. Document both conventions; migrate gradually if decided.

## Breaking Changes & Versioning

**API contract:** `backend/app/domain/models.py` is source of truth. Any model changes must be reflected in:
1. Python Pydantic models
2. TypeScript interfaces (manually until phase 2 auto-gen)
3. API endpoint signatures
4. Database schema (phase 2+)

**Frontend types:** Ensure `frontend/src/types/domain.ts` matches backend models exactly.

**Solver interface:** `StowageSolver.solve()` signature change requires all solver implementations updated.

## IDE Setup (Optional)

**Backend (VSCode):**
- Install `Python` and `Pylance` extensions
- `.venv` auto-detected for linting/autocomplete
- Format: black (configured in `pyproject.toml` future)

**Frontend (VSCode):**
- Install `TypeScript Vue Plugin`, `Volar` extensions
- `@` alias configured in `vite.config.ts` and `tsconfig.json`
- Format: Prettier (configured in `.prettierrc` future)

## Open Questions & Decisions

1. **Auto-generate TS types?** (Phase 2: use `openapi-typescript`)
2. **Component file naming:** Keep PascalCase or migrate to kebab-case?
3. **Linting:** Configure ESLint + Prettier (frontend), black + isort (backend)?
4. **Pre-commit hooks:** Run tsc + pytest before commit?
5. **API versioning:** Support `/api/v1/` routes? Defer to phase 4.
