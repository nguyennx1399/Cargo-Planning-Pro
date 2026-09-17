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

> **There are no backend tests.** `backend/tests/` does not exist and has never existed, even though `pytest` and `httpx` are declared in `backend/requirements.txt`. The pattern below is the *intended* convention to follow when the directory is created — do not read it as a description of something that runs today.

**Framework:** pytest

**Pattern:**
- One test file per module: `test_module_name.py`
- One test per rule or function: `test_rule_name`
- Arrange-Act-Assert structure

```python
# backend/tests/test_slot.py   (directory to be created)
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
├── api/          # HTTP client — client.ts exists but has ZERO importers (see "HTTP Client")
├── data/         # Client-side demo plan builder + vessel catalog
├── store/        # Zustand stores (usePlanStore = view state, usePlanDraftStore = plan)
├── engine/       # Pure domain logic: stowage model, placement checks, validation rules
│   ├── stowage-model/   # build-stowage-model, coords, occupancy, slot-enumeration, types, index
│   ├── placement/       # can-place-container, can-place-breakbulk, placeholders, reason
│   ├── placement-checks.ts  # shared primitives (isTwenty, teuOf, sizeFitsBay, tierBelow, plugOk)
│   └── validate-plan.ts     # the client-side plan-wide validation entry point
├── lib/          # Utilities (geometry, colors, drop verdicts, drop feedback, slot picking, list query)
├── components/   # ui/ = shadcn primitives; severity-alert-list.tsx
├── features/     # Feature folders (viewer3d, bayplan, panels, vessel-onboarding)
└── styles.css    # Tailwind 4 entry + global styles
```

**`lib/` is not one thing.** It holds both low-level plumbing and the app's shared decision logic:

| Module | Role |
|---|---|
| `geometry.ts` | Slot ↔ 3D position maths (`DIM`, `LAYOUT`, `bayCenterX`, `slotToPosition`) |
| `colors.ts` | `containerColor`, `podColorMap`, `HIGHLIGHT` |
| `drop-verdict.ts` | `DROP_TINT`, `verdictForSlot` (one-entry hover memo), `verdictsForSlots`, `DropVerdict` |
| `drop-feedback.ts` | **The single wording layer** — see below |
| `nearest-slot.ts` | `cursorOnTierPlane`, `nearestSlotIndex` — how a cursor ray resolves to a slot |
| `unplaced-query.ts` | Pure list logic: filter / sort / group / roving focus for the Unplaced list |
| `ship-frame.ts`, `ship-attitude-transform.ts`, `use-indicative-stability.ts` | Ship-frame conversion and DEMO stability |

**`lib/drop-feedback.ts` is to wording what `engine/placement/` is to rules:** one function per sentence (`dropVerdictText`, `dropOutcomeText`, `dropCursorClass`, `quotedReason`, `dropOutcomeOf`) so that the ghost, the chip, the cursor and the Sidebar readout **cannot disagree**. Change a sentence here, not at a call site.

**Component naming:** `PascalCase.tsx` (existing convention; tension with CLAUDE.md kebab-case preference)

### Type Definitions

**Hand-maintained mirror.** `frontend/src/types/domain.ts` copies the shapes from `backend/app/domain/models.py`. There is no code generation and no runtime sharing — the two halves are separate programs, and `api/client.ts` (the only thing that would have coupled them) has no importers. Change one side, change the other; nothing will fail loudly if you forget.

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

**`usePlanStore` — view state only** (`colorMode` + `paletteMode`, `showHull`, deck toggles, `bayFilter`, `hoveredId`, `selectedId`, playback, plus the gesture state `hoveredSlot` / `draggingContainerId` / `pickedId` / `dropOutcome` and `resetForVesselChange`). Subscribed narrowly to avoid re-render storms.

```typescript
// frontend/src/store/usePlanStore.ts
import { create } from "zustand";

export const usePlanStore = create<ViewState>((set) => ({
  colorMode: "pod",
  paletteMode: "default",
  showOnDeck: true,
  hoveredSlot: null,
  draggingContainerId: null,
  pickedId: null,
  dropOutcome: null,
  // ...
  setColorMode: (colorMode) => set({ colorMode }),
  toggleOnDeck: () => set((s) => ({ showOnDeck: !s.showOnDeck })),
  // A drag start also pauses playback and ends any pick (one item in hand at a time), and retires
  // the previous drop outcome — that outcome belongs to the gesture that just ended.
  setDraggingContainer: (id) => set(id === null ? { draggingContainerId: null } : { draggingContainerId: id, pickedId: null, hoveredSlot: null, dropOutcome: null, playbackPlaying: false }),
}));
```

**`dropOutcome` has exactly ONE writer:** `store/commit-placement.ts` (`view.setDropOutcome(dropOutcomeOf(result, target, origin))`). Its lifetime is deliberate — a new gesture clears it, hovering a **different** slot clears it, hovering the outcome's own slot or leaving the canvas does **not** (clearing would flicker a message the planner has not read yet). `dropOutcome` replaces the local `releaseNotice` state the Sidebar used to own.

**`activeContainerId(s) = s.draggingContainerId ?? s.pickedId`** is exported from the same module and is the single answer to "what is being placed right now" — the placeholder set, the ghost and the cursor all subscribe to it rather than re-deriving it.

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
| `placeholders.ts` | `validSlotsFor` (live), `verdictOf` (live), plus `blockedSlots` / `blockedReasonFor` (now test-only, see below) |

**The legacy `engine/placement-checks.ts` sits one level up and is still live.** It holds the shared primitives `isTwenty`, `teuOf`, `sizeFitsBay`, `tierBelow`, `plugOk` and is imported by **both** the predicates above and the new `lib/unplaced-query.ts`. That shared import is what keeps the size/parity notion identical between the drop gate and the Unplaced list's "Fits bay" filter — do not fork a second copy of `sizeFitsBay`.

**Rule ids are the same ids** `engine/validation-rules.ts` and `engine/breakbulk-validation-rules.ts` emit, and `breakbulk-validation-rules.ts` now loops over `canPlaceBreakbulk` — so a tooltip and the violations list name the same thing with the same words.

**Performance:** `validSlotsFor` is a per-gesture sweep (≈1.05 ms for 447 slots) — memoise it at the call site, once per gesture start, never per pointer move.

**The hover path is `verdictForSlot`, not `blockedReasonFor`** (P1 review M4 superseded the earlier guidance here): `lib/drop-verdict.ts` runs a single `canPlaceContainer` call per hovered slot behind a **one-entry memo**, so the ghost, the chip, the cursor and the Sidebar readout collapse into ONE predicate call per pointer move. `blockedSlots` / `blockedReasonFor` still exist in `placeholders.ts` but now have **no production call sites** — only the `placeholders.test.ts` suite calls them.

### HTTP Client

> **This module is currently unused.** `api/client.ts` has **zero importers** and is the only file in `frontend/src` containing `fetch` or an `/api/` path. Everything the UI shows is built client-side (`data/build-demo-plan.ts` → `engine/validate-plan.ts`). Treat the code below as the wire format the backend already implements, ready to be adopted — not as a live integration.

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

**Pattern:** Declarative components; ONE `instancedMesh` for every container size (per-instance matrix scale sets the length).

```typescript
// frontend/src/features/viewer3d/ContainerInstances.tsx
export function ContainerInstances({ vessel, plan }: Props) {
  // One instancedMesh for all sizes — do NOT group by size
  // Per-instance matrix scale (LENGTH_BY_SIZE) renders each length correctly
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

**Pattern:** Tailwind 4 via `@tailwindcss/vite` (`@import "tailwindcss"` at the top of `styles.css`), plus shadcn primitives under `components/ui/` (`button`, `select`, `input`, `checkbox`, `slider`, `toggle`, `toggle-group`, `textarea`, `label`, `alert`). Hand-written CSS in `styles.css` still owns the app shell and a set of long-standing class names (`.layout`, `.stage`, `.viewport`, `.bayplan`, `.sidebar`, `.legend`, `.kv`, `.unplaced-*`, `.drop-chip`, `.viewport-armed`).

**Note:** there is **no Tailwind config file and no `tailwind.config.js`** — v4 is configured through the `@theme inline` block inside `styles.css`.

```css
/* frontend/src/styles.css — app shell as it actually is */
.layout  { display: grid; grid-template-columns: 300px 1fr; height: 100%; }
.stage   { display: grid; grid-template-rows: minmax(220px, 65%) minmax(160px, 35%); }
.viewport { position: relative; min-height: 0; background: var(--stage); }
.bayplan  { border-top: 1px solid var(--line); background: #fff; padding: 10px 14px; }
```

**Convention:** two token families live side by side at the top of `styles.css`. The shadcn/`@theme inline` set (`--background`, `--foreground`, `--card`, …) is re-declared under `.dark`, so theme switching works. The older **app tokens** (`--ink`, `--ink-soft`, `--line`, `--panel`, `--stage`, `--signal`, `--error`, `--ok`) are declared once and are **not** re-declared under `.dark`. Prefer the app tokens for handwritten CSS and the theme tokens inside `components/ui/`; do not hard-code hex values in JSX.

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
// Memoised per plan in a WeakMap — collapses every reader to ONE call per pointer move
const verdict = verdictForSlot(vessel, plan, container, slot);
```

### TODO Comments (Phase Tracking)

Same format as backend: `TODO(phase-N): description`

```typescript
// frontend/src/api/client.ts
// TODO(phase-3): solve(req) -> POST /api/stowage/solve
// TODO(phase-2): importBaplie(file), exportBaplie(planId)
```

### Testing (Frontend)

**Framework:** Vitest ^3.2.7, run with `npm test` (`vitest run`) from `frontend/`.

**Current state:** **75 test files, 586 tests, all passing** (~5 s warm). Tests live in `__tests__/` folders next to the module they cover (`src/lib/__tests__/`, `src/engine/__tests__/`, `src/store/__tests__/`, `src/data/__tests__/`, …).

**Environment — read this before writing any test:**

- There is **no vitest config file** and **no setup file**. Vitest therefore runs with its default `environment: "node"`.
- **jsdom and @testing-library are deliberately not installed.** No DOM, no `render()`, no `fireEvent`, no component tests.
- Consequently every test must target a **pure function**: engine rules, placement predicates, the stowage model, the list query, the drop-wording functions, the store reducers. If you need to test interactive behaviour, extract the decision into a pure module first — that is exactly why `lib/nearest-slot.ts`, `lib/drop-feedback.ts` and `lib/unplaced-query.ts` are separate files.

```typescript
// frontend/src/lib/__tests__/nearest-slot.test.ts — the shape every frontend test has
import { describe, expect, it } from "vitest";
import { nearestSlotIndex } from "@/lib/nearest-slot";
// arrange → act → assert, plain values only
```

**Verification gate:** `npm test` plus `npm run build` (which is `tsc --noEmit && vite build`). There is **no CI**, so these are run by hand.

> **Caveat that matters for the docs:** because there is no DOM environment, the drag/drop/pick-and-place UX pass (P1 + P2) is covered **only** at the pure-function level. Interactive behaviour — hover resolution, chip placement, cursor classes, Esc-guard behaviour in the search box — has **never been executed by a test or a human**. Manual click-through steps 22–34 in `plans/reports/manual-click-through-260916-phase-c.md` are outstanding.

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
- `.venv` auto-detected for autocomplete
- Format: none configured today (black would go in a future `pyproject.toml`)

**Frontend (VSCode):**
- Install the `ES7+ React/Redux/React-Native snippets` and `Tailwind CSS IntelliSense` extensions (React project — **Volar/Vue plugins are not relevant**)
- `@` alias configured in `vite.config.ts` and `tsconfig.json`
- Format: none configured today (Prettier would go in a future `.prettierrc`)

## Open Questions & Decisions

1. **Auto-generate TS types?** (Phase 2: use `openapi-typescript`)
2. **Component file naming:** Keep PascalCase or migrate to kebab-case?
3. **Linting:** **Nothing exists today** — no ESLint config, no Prettier config, no black/isort/ruff config anywhere in the repo. Adding one is an open decision, not a description of current state.
4. **Pre-commit hooks / CI:** **No CI exists** (`.github/` is absent) and there are no git hooks. Until one is added, `npm run build` (tsc + vite) and `npm test` are manual gates.
5. **API versioning:** Support `/api/v1/` routes? Defer to phase 4.
6. **Wire the frontend to the backend, or delete `api/client.ts`?** The client, the Vite proxy and the React Query provider are all in place but unused; either finish the integration or remove the scaffolding.
