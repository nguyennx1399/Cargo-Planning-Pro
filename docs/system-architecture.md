# System Architecture

## High-Level Components

```
┌────────────────────────── Frontend (React + R3F) ──────────────────────────┐
│                                                                              │
│  ┌─────────────────┐       ┌──────────────────┐       ┌──────────────────┐ │
│  │     Sidebar     │       │   3D Viewer      │       │   2D Bay Plan    │ │
│  │  - Plan info    │       │  - Canvas        │       │   - SVG (stub)   │ │
│  │  - Legend       │       │  - Hull geometry │       │   - Hit test     │ │
│  │  - Violations   │       │  - Containers    │       │   - Selection    │ │
│  │  - Controls     │       │  - Raycast       │       │                  │ │
│  └────────┬────────┘       └────────┬─────────┘       └──────────────────┘ │
│           └─────────────┬──────────┘                                        │
│                         ↓                                                   │
│           ┌─────────────────────────────┐                                   │
│           │   Zustand View State Store  │                                   │
│           │  - colorMode (pod|weight|)  │                                   │
│           │  - selection (hoveredId)    │                                   │
│           │  - filters (bayFilter)      │                                   │
│           │  - showOnDeck/UnderDeck     │                                   │
│           │  - drag/pick gesture        │                                   │
│           └─────────────┬───────────────┘                                   │
│                         ↓                                                   │
│           ┌─────────────────────────────┐                                   │
│           │ Plan Draft Store            │                                   │
│           │ - plan + undo/redo          │                                   │
│           │ - validate-then-mutate      │                                   │
│           └─────────────┬───────────────┘                                   │
│                         ↓                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                          │ REST (JSON)
                          ↓
┌────────────────────── Backend (FastAPI) ────────────────────────────────────┐
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  HTTP Routes     │  │   Validation     │  │   Solver         │         │
│  │  - GET /health   │  │  - engine.py     │  │  - base.py       │         │
│  │  - GET /vessels  │  │  - rules.py      │  │  - greedy.py     │         │
│  │  - POST /plans   │  │  - context.py    │  │  - cpsat.py      │         │
│  │  - POST /validate│  │                  │  │  - registry.py   │         │
│  │  - POST /solve   │  │                  │  │                  │         │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘         │
│           └─────────────┬───────┘                      │                   │
│                         ↓                              ↓                   │
│           ┌────────────────────────────────────────────────────┐           │
│           │          Domain Models (Pydantic)                  │           │
│           │ - Vessel (bays, rows, stacks, capacity)           │           │
│           │ - Container (size, type, weight, pod, imdg)       │           │
│           │ - BreakbulkCargo (category, dims, weight, pod)    │           │
│           │ - BreakbulkPlacement (x, z footprint, rotation)   │           │
│           │ - PortCall (locode, sequence, eta/etd)            │           │
│           │ - StowagePlan (containers + placements, breakbulk)│           │
│           │ - Slot (bay, row, tier) | Validation (violations) │           │
│           └─────────────┬──────────────────────────────────────┘           │
│                         ↓                                                   │
│           ┌────────────────────────────────────────────────────┐           │
│           │    Data Layer (Phase 2: PostgreSQL)                │           │
│           │  - In-memory dict (current)                        │           │
│           │  - Vessel profiles, samples                        │           │
│           │  - Sample voyage + cargo                           │           │
│           └────────────────────────────────────────────────────┘           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## REST API Reference

**Base URL:** `http://localhost:8000/api` (dev) or `API_URL` (env)

### Health Check

```http
GET /health
```

**Response:** `200 OK`
```json
{ "status": "ok" }
```

### Get Vessel

```http
GET /vessels/{vessel_id}
```

**Parameters:**
- `vessel_id` (string, path): Unique vessel identifier (e.g., "feeder-demo")

**Response:** `200 OK`
```json
{
  "id": "feeder-demo",
  "name": "MSC Demo Feeder",
  "imo": "IMO1234567",
  "length_m": 190.0,
  "beam_m": 32.2,
  "bays": [2, 4, 6, 8, 10, 12, 14],
  "rows": [0, 1, 2, 3, 4, 5, 6],
  "stacks": [
    {
      "bay": 2,
      "row": 0,
      "deck": "under",
      "tiers": [2, 4, 6, 8],
      "max_weight_t": 450.0,
      "max_height_m": null,
      "reefer_tiers": [2]
    },
    ...
  ]
}
```

**Error:** `404 Not Found` if vessel not found.

### Demo Plan (Load + Solve)

```http
GET /plans/demo?n=150&seed=42
```

**Parameters:**
- `n` (int, query): Number of containers to generate (default: 150)
- `seed` (int, query): Random seed for reproducibility (default: 42)

**Response:** `200 OK` — returns `StowagePlan` with 150 containers placed by greedy solver.

```json
{
  "id": "uuid-string",
  "vessel_id": "feeder-demo",
  "voyage": "DEMO001",
  "ports": [
    {"locode": "VNSGN", "name": "Ho Chi Minh", "sequence": 0, "eta": null, "etd": null},
    {"locode": "SGSIN", "name": "Singapore", "sequence": 1, "eta": null, "etd": null},
    ...
  ],
  "containers": [
    {
      "id": "DEMU000000X",
      "size": "40",
      "type": "DRY",
      "high_cube": false,
      "weight_t": 15.3,
      "pol": "VNSGN",
      "pod": "SGSIN",
      "imdg_class": null,
      "oog": false
    },
    ...
  ],
  "placements": [
    {"container_id": "DEMU000000X", "slot": {"bay": 2, "row": 0, "tier": 2}},
    ...
  ],
  "unplaced": ["DEMU000150X", "DEMU000152X"]
}
```

### Validate Plan

```http
POST /validate
Content-Type: application/json

{
  "id": "plan-uuid",
  "vessel_id": "feeder-demo",
  "voyage": "DEMO001",
  "ports": [...],
  "containers": [...],
  "placements": [...],
  "unplaced": [...]
}
```

**Request body:** Full `StowagePlan` object (or subset with vessel_id, placements, containers).

**Response:** `200 OK`
```json
{
  "ok": false,
  "violations": [
    {
      "rule": "slot_exists",
      "severity": "error",
      "message": "DEMU000150X: slot does not exist on vessel",
      "container_ids": ["DEMU000150X"],
      "slots": ["020082"]
    },
    {
      "rule": "stack_weight",
      "severity": "error",
      "message": "Stack bay 02 row 00 (under deck): 2450.0t > limit 2400.0t",
      "container_ids": ["DEMU000001X", "DEMU000002X", ...],
      "slots": []
    },
    {
      "rule": "overstow",
      "severity": "warning",
      "message": "5 containers will be restowed at next port",
      "container_ids": [...],
      "slots": []
    }
  ],
  "kpis": {
    "placed": 148.0,
    "unplaced": 2.0,
    "overstows": 5.0,
    "errors": 2.0
  }
}
```

**Error:** `422 Unprocessable Entity` if plan body invalid.

### Solve (Auto-Stow)

```http
POST /stowage/solve
Content-Type: application/json

{
  "vessel_id": "feeder-demo",
  "solver": "greedy-v0",
  "voyage": "DEMO001",
  "plan": {
    "id": "temp-plan-uuid",
    "vessel_id": "feeder-demo",
    "voyage": "DEMO001",
    "ports": [...],
    "containers": [...],
    "placements": [],
    "unplaced": []
  }
}
```

**Parameters (JSON body):**
- `vessel_id` (string): Target vessel
- `solver` (string): Solver key from registry (default: "greedy-v0"; "cpsat" future)
- `voyage` (string): Voyage identifier
- `plan` (object): Contains cargo (containers + ports); placements ignored

**Response:** `200 OK` — returns solved `StowagePlan`.

```json
{
  "id": "solved-plan-uuid",
  "vessel_id": "feeder-demo",
  "voyage": "DEMO001",
  "ports": [...],
  "containers": [...],
  "placements": [
    {"container_id": "DEMU000000X", "slot": {"bay": 2, "row": 0, "tier": 2}},
    ...
  ],
  "unplaced": [...]
}
```

**Errors:**
- `400 Bad Request`: Unknown solver name
- `501 Not Implemented`: Solver not ready (e.g., CP-SAT phase 4)

## Data Models

### Vessel

```typescript
interface Vessel {
  id: string;
  name: string;
  imo?: string;
  length_m: number;
  beam_m: number;
  bays: number[];              // e.g., [2, 4, 6, 8, ...] (40' bays)
  rows: number[];              // e.g., [0, 1, 2, 3, ...] (0=center, odd=starboard, even=port)
  stacks: StackSpec[];
}

interface StackSpec {
  bay: number;                 // even (40') or odd (20')
  row: number;
  deck: "under" | "on";
  tiers: number[];             // e.g., [2, 4, 6, 8] under deck; [82, 84, 86] on deck
  max_weight_t: number;        // Stack weight limit in tonnes
  max_height_m?: number;       // Hatch clearance limit (meters)
  reefer_tiers: number[];      // Tiers with reefer plugs
}
```

### Container

```typescript
interface Container {
  id: string;                  // ISO 6346, e.g., "MSCU1234565"
  size: "20" | "40" | "45";   // Container size (feet)
  type: "DRY" | "REEFER" | "OPEN_TOP" | "FLAT_RACK" | "TANK";
  high_cube: boolean;          // 9'6" height (vs. standard 8'6")
  weight_t: number;            // Verified Gross Mass (tonnes)
  pol: string;                 // Port of Loading (UN/LOCODE)
  pod: string;                 // Port of Discharge (UN/LOCODE)
  imdg_class?: string;         // IMDG hazard class (if dangerous goods)
  oog: boolean;                // Out-of-Gauge flag
}
```

### StowagePlan

```typescript
interface StowagePlan {
  id: string;                  // Unique plan ID (UUID)
  vessel_id: string;           // Vessel key
  voyage: string;              // Voyage identifier
  ports: PortCall[];           // Port rotation
  containers: Container[];     // Cargo list
  placements: Placement[];     // Where each container is placed
  unplaced: string[];          // Container IDs the solver could not place
}

interface Placement {
  container_id: string;        // Reference to containers[].id
  slot: Slot;                  // Bay, row, tier coordinates
}

interface Slot {
  bay: number;
  row: number;
  tier: number;

  // Computed property: code = "BBRRTT" format (e.g., "020682")
  code(): string;
}

interface PortCall {
  locode: string;              // UN/LOCODE
  name: string;                // Port name
  sequence: number;            // 0 (loading) → 1, 2, ... (discharge order)
  eta?: string;                // ISO 8601 datetime
  etd?: string;
}
```

### ValidationReport

```typescript
interface ValidationReport {
  ok: boolean;                 // true if no hard constraint violations (errors)
  violations: Violation[];     // List of all violations (errors + warnings)
  kpis: Record<string, number>;// Key performance indicators
}

interface Violation {
  rule: string;                // Rule name (e.g., "slot_exists", "stack_weight")
  severity: "error" | "warning";
  message: string;             // Human-readable explanation
  container_ids: string[];     // Affected container IDs
  slots: string[];             // Affected slot codes (if relevant)
}
```

## Validation Engine

**File:** `backend/app/validation/engine.py`

```python
def validate(vessel: Vessel, plan: StowagePlan) -> ValidationReport:
    """Run all rules against plan; return violations + KPIs."""
    ctx = ValidationContext(vessel=vessel, plan=plan)
    violations = [v for rule in ALL_RULES for v in rule(ctx)]
    kpis = {
        "placed": float(len(plan.placements)),
        "unplaced": float(len(plan.unplaced)),
        "overstows": float(sum(1 for v in violations if v.rule == "overstow")),
        "errors": float(sum(1 for v in violations if v.severity == Severity.ERROR)),
    }
    return ValidationReport(ok=kpis["errors"] == 0, violations=violations, kpis=kpis)
```

**Rules in `ALL_RULES` (all implemented):**
- `slot_exists` (ERROR) — placed slot exists on vessel (stack + tier)
- `size_fits_bay` (ERROR, partial) — 40'/45' only in even (40') bays; full 20'/40'/45' mixing rules TODO(phase-2)
- `stack_weight` (ERROR) — stack total weight ≤ `max_weight_t`
- `no_floating` (ERROR) — tier directly below must be occupied
- `reefer_plug` (ERROR) — reefer only on tiers in `reefer_tiers`
- `overstow` (WARNING, soft) — later-POD container above earlier-POD one; hatch-cover overstow TODO(phase-3)

**Not yet implemented:** `imdg_segregation`, `stack_height`/visibility line, `oog_clearance` (phase 2); `stability_limits`, `strength_limits` (phase 4).

**To add a rule:**
1. Write function in `rules.py`: `def my_rule(ctx: ValidationContext) -> list[Violation]:`
2. Append to `ALL_RULES`
3. Write test in `tests/test_validation.py`

## Solver Interface & Registry

**Protocol definition (base.py):**

```python
class StowageSolver(Protocol):
    name: str
    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall], 
              voyage: str) -> StowagePlan: ...
```

**Requirement:** Every solver's output must pass `validate(vessel, plan).ok == True`.

**Registry (solver/registry.py):**

```python
SOLVERS: dict[str, StowageSolver] = {
    "greedy-v0": GreedySolver(),
    "cpsat": CpSatSolver(),
}
```

**Current solvers:**
- `greedy-v0` (phase 3): Sort by discharge order + weight; fill slots bottom-up; no rule checks yet
- `cpsat` (phase 4, stub): OR-Tools CP-SAT optimizer; master bay planning + slot assignment

## Frontend State & Store

**Zustand store (usePlanStore):**

```typescript
interface ViewState {
  colorMode: "pod" | "weight" | "type";  // How to color containers
  showOnDeck: boolean;                    // Show on-deck containers
  showUnderDeck: boolean;                 // Show under-deck containers
  showHull: boolean;                      // Show hull geometry
  bayFilter: number | null;               // Filter to one bay (null = all)
  hoveredId: string | null;               // Hovered container ID
  selectedId: string | null;              // Selected container ID
  
  // Loading sequence playback (DEMO/indicative)
  playbackCount: number | null;           // null = show all; number = reveal containers up to index
  playbackPlaying: boolean;               // Play/pause toggle
  playbackSpeed: number;                  // Containers per second
  exaggerate: number;                     // 1 (real) or 5 (exaggerated ship attitude angles for visibility)
  
  // Setters
  setColorMode(m: ColorMode): void;
  toggleOnDeck(): void;
  toggleUnderDeck(): void;
  toggleHull(): void;
  setBayFilter(bay: number | null): void;
  setHovered(id: string | null): void;
  setSelected(id: string | null): void;
  startOrResumePlayback(): void;
  pausePlayback(): void;
  resetPlayback(): void;
  setPlaybackCount(n: number | null): void;
  setPlaybackSpeed(speed: number): void;
  toggleExaggerate(): void;
}
```

**Two stores, distinct ownership.** `usePlanStore` is view state only (above); the **editable plan** lives in `usePlanDraftStore` — the only place the UI mutates a plan.

```typescript
interface PlanDraftState {
  vessel: Vessel | null;                  // the vessel the plan belongs to (checks need it)
  plan: StowagePlan | null;
  past: StowagePlan[]; future: StowagePlan[];  // undo/redo history, HISTORY_CAP = 100
  loadPlan(vessel, plan): void;           // demo/vessel switch; resets history
  placeContainer(id, slot): PlacementResult;   // = moveContainer (one implementation)
  unplaceContainer(id): void;
  placeBreakbulk(id, pose): PlacementResult;   // = moveBreakbulk
  unplaceBreakbulk(id): void;
  undo(): void; redo(): void;
}
```

Invariants: **validate-then-mutate** (a rejected action returns its reasons and changes nothing — no new plan object, no history entry); plans are **never mutated in place** (each action builds a new `StowagePlan`, which keeps history entries valid and lets the engine memoise by plan identity); `unplaced` is **derived** as `containers − placements` on every mutation; `setPicked`/`setDraggingContainer` are mutually exclusive.

Gesture state (`hoveredSlot`, `draggingContainerId`, `pickedId`) is view state and stays in `usePlanStore`; `commit-placement.ts` is the ONE resolver both drop triggers (drag release, click-to-pick) go through, and `features/panels/use-stowage-keyboard-shortcuts.ts` binds Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z (and Ctrl+Y), Esc.

**Placement checks (`engine/placement/`):** one predicate per cargo kind — `canPlaceContainer` and `canPlaceBreakbulk` — shared by the drop preview, the placeholders and the full-plan validation (the repo's "validator before optimizer" principle). Rule ids and messages are the same ones `engine/validation-rules.ts` / `engine/breakbulk-validation-rules.ts` emit; `breakbulk-validation-rules.ts` now loops over `canPlaceBreakbulk`.

**React Query:** the provider is still mounted in `main.tsx`, but no query loads plan data any more — the demo plan is built in the frontend and loaded into the draft store. `api/client.ts` currently has no importers; `POST /api/validate` / `/api/stowage/solve` remain the backend contract.

## 3D Rendering Pipeline

**Canvas setup (VesselScene.tsx):**
1. Ship attitude transform: Compute sinking/list/trim from visible cargo weight via `useShipAttitude` hook
   - Applies weight-based rotation/translation to entire ship group
   - WaterlineReference mesh updates with attitude
   - **Angles exaggerated 5× for visibility (toggle via `exaggerate` state)**
2. Render hull: Parametric L1 (phase 2: `engine/hull/` modules) or GLTF model (L2, phase 4)
3. Render ContainerInstances (InstancedMesh per size; filtered by `playbackCount` state for loading sequence) — plus, while a container is in hand, `SlotPlaceholders` (valid slots) and `GhostContainerPreview` (the cursor box)
4. Render BreakbulkCargoInstances (custom mesh per cargo; deck-positioned by x/z footprint + rotation; filtered by playback)
5. OrbitControls + GizmoHelper for navigation
6. Raycast on InstancedMesh for selection
7. WaterlineReference visual waterline in fixed position (to show ship movement relative to water)

**Hull generation (engine/hull/):**
- `parametric-hull-generator.ts`: Envelope (Cb fit) + section shapes → offsets
- `catmull-rom-spline.ts`: Smooth interpolation for hull curves
- `section-integrals.ts`: Cross-section area, moments, waterplane properties
- `hull-loft-mesh-builder.ts`: Offsets → BufferGeometry (closed mesh, normals)
- `hull-half-breadth-query.ts`: Point-in-hull queries for validation
- `slots-inside-hull-check.ts`: Detect under-deck stacks piercing hull

**Component library & livery (engine/vessel-components/):**
- Auto-generated ship superstructure (cabin, bridge), funnel, masts, lifeboats from parametric builders
- Auto-generated hatch covers & lashing bridges from vessel bay list (no manual placement)
- Merged static geometries by material type (superstructure, deck fittings, crane pedestal) → 3 merged meshes
- **Hull livery shader** (`hull-livery-material.ts`): Three-band paint (antifouling/boot-top/topside) based on ship-frame z coordinate via `MeshStandardMaterial.onBeforeCompile()` patch; antifouling below `boot_top_low_z`, boot-top in band, topside above
- Perf achieved: hull + components = 3 draw calls total (vs. 12 budget), ≤8800 triangles

**Container rendering:**
- Group placements by container size (20', 40', 45' + high cube)
- Each size rendered at correct length (via instance scale)
- One InstancedMesh per size → 1–2 draw calls total (vs. 10k+)
- Each instance stores: position (bay/row/tier → x/y/z), color (POD/weight/type), selected state

**Drop affordances (Phases A–C):**
- `SlotPlaceholders.tsx`: one InstancedMesh of translucent boxes on every valid slot while a container is dragged or picked, built from `validSlotsFor` (memoised) — a hint layer, `raycast={() => null}`, so it never steals the pick
- `GhostContainerPreview.tsx`: the box that follows the cursor, tinted from `DROP_TINT` (green clean / amber accepted-and-recorded / red refused); the tint and the sidebar reason both come from `lib/drop-verdict.ts`, i.e. from the same `canPlaceContainer` gate the commit runs
- Starting a drag pauses playback (D3) and clears any pick; the two gestures are mutually exclusive

**Breakbulk cargo rendering:**
- Each breakbulk cargo rendered as custom mesh (wind turbine blade/nacelle/tower, yacht, etc.)
- Positioned on deck via x/z footprint (length_m/2-symmetric), rotated by `rotation_deg`
- Instances filtered by playback state for loading sequence animation
- **DEMO reference dimensions only; not operational data**

**Coordinate system (lib/geometry.ts):**
```
x = longitudinal (bow = +x direction)
y = vertical (up)
z = transverse (starboard = +z direction)
Units: meters; 20' = 6.058m, 40' = 12.192m, container width = 2.438m, height = 2.591m
```

**Selection (raycast):**
- Cast ray from camera through click point
- Intersect with all InstancedMesh objects
- Get instanceId → lookup container → update usePlanStore.selectedId
- Sidebar highlights violations for selected container
- An empty slot under the cursor resolves to `hoveredSlot` and (with a container in hand) is the drop target: the same click commits it via `commitPlacement` — the trigger used by the WCAG 2.5.7 click-to-pick path

## Indicative Stability & Ship Attitude (**DEMO DATA ONLY**)

**WARNING:** All stability calculations in this system are indicative/demo-grade for visualization only. Not suitable for operational use. Always verify on an official loading computer per IACS UR L5.

**System flow:**

1. **Weight accumulation** (visible cargo only, based on playback state)
   - For each visible container & breakbulk cargo: LCG (longitudinal), TCG (transverse), KG (vertical) in ship frame
   - Breakbulk uses utility functions (`lib/breakbulk-weight-item.ts`) to convert deck coordinates to weight items
   - Sum total displacement, moments from all cargo types

2. **Stability calculation** (`engine/stability-indicative.ts`)
   - Input: WeightItem[] from visible containers + breakbulk cargo + reference lightship
   - Compute KG (center of gravity in vertical)
   - Lookup hydrostatics via draft interpolation

3. **Hydrostatic lookup** (`engine/hydrostatic-table-lookup.ts`)
   - Interpolate from precomputed hydrostatic table (stored in hull)
   - Returns: displacement, LCB, KB, KM, MCT (moment to change trim 1cm)
   - Safety guard: If outside table range → `status: "out_of_range"` (shown instead of wrong number)

4. **Ship attitude** (`lib/ship-attitude-transform.ts`)
   - Compute trim: (LCG - LCB) × MCT / (Displacement × 100)
   - Compute heel: TCG / (BM/D) (stability lever approximation)
   - Apply **5× angle exaggeration** for visibility (real angles often <1°)

5. **3D scene update** (`features/viewer3d/useShipAttitude.ts`)
   - Transform entire ship group (hull + containers) by attitude
   - Waterline stays fixed (reference plane) → shows relative ship movement
   - Stability metrics displayed in panel (draft, trim, heel, GM)

**Loading sequence playback:**
- `features/panels/LoadingSequencePanel.tsx`: Play/Pause/Reset/Scrub controls
- `features/viewer3d/LoadingSequenceDriver.tsx`: Animation loop (deltaTime-based)
- `engine/playback-slice.ts`: Zustand slice for playback state (count, playing, speed)
- ContainerInstances filters visible by playbackCount → reveals cargo incrementally
- Stability updates live to match current visible cargo
- `playbackSpeed` controls containers-per-second reveal rate

**Stability status indicators:**
- `status: "ok"` → Stability parameters within safe bounds; GM visible
- `status: "warning"` → Stability degrading; GM < 1.0m or lists > 2°
- `status: "critical"` → GM < 0.5m or lists > 5° → Shows "CRITICAL" instead of angle
- `status: "out_of_range"` → Displacement outside hydrostatic table bounds → Shows error message

## Coordinate Systems & Slot Mapping

See `docs/DOMAIN.md` for detailed ISO bay-row-tier coordinate specification.

**Summary:**
- **Bay:** 01, 03, 05… (20' odd bays); 02, 04, 06… (40' even bays = two 20' bays)
- **Row:** 00 (centerline, rare); 01, 03… (starboard, odd); 02, 04… (port, even)
- **Tier:** 02, 04, 06… (under deck, from bottom); 82, 84, 86… (on deck)

**3D Transform:**
```
Slot(bay=02, row=00, tier=82) 
  → x = bayCenterX(02) 
  → y = tierCenterY(82) 
  → z = rowCenterZ(00) 
  → [x, y, z] in meters
```

**Placement footprints (`x_m`):** `BreakbulkPlacement.x_m` is symmetric about `length_m / 2` (0 at the stern end, +bow) and is deliberately NOT the AP-referenced ship frame. The conversion to scene x is a pure translation, owned solely by `frontend/src/engine/stowage-model/coords.ts` (`placementXToSceneX` / `sceneXToPlacementX`); never re-derive the offset in a producer or consumer. Slot footprints likewise come from the stowage model's `SlotDef.rect`, not from a local re-derivation.

## Deployment Architecture (Local & Docker)

### Local Development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Dev proxy (`vite.config.ts`): `/api/*` → `http://localhost:8000/api/*`

### Docker Compose

```bash
docker compose up --build
```

Services:
- **api** (Python FastAPI): port 8000, mounts `backend/app` (hot reload)
- **web** (React/Vite): port 5173, mounts `frontend/src` (HMR)

**Environment:**
- `API_URL=http://api:8000` (inside docker network)

### Production (Future)

- PostgreSQL database
- Redis job queue (async solver jobs)
- Kubernetes or serverless cloud (AWS Lambda, Google Cloud Run, etc.)
- Separate API and UI deployments

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| 3D render | 20k containers @ 60fps | ✓ InstancedMesh per size |
| Validation | <100ms per check | ✓ Linear scan rules |
| Greedy solver | <10s for 2000 containers | ○ Basic implementation |
| CP-SAT solver | <60s per bay group | ○ Phase 4 |
| API latency | <100ms (p95) | ✓ Typical |

## Security Considerations

**Current (skeleton):** No authentication.

**Phase 2+:**
- OAuth2 / JWT tokens (planner, supervisor, admin roles)
- Plan access control per user/voyage
- Audit log of plan changes

**Stability calculations:** Always verified on official loading computer; this app is decision support only.

## Integration & Extension Points

1. **Add a rule:** Write function in `validation/rules.py`, append to `ALL_RULES`
2. **Add a solver:** Subclass `StowageSolver` Protocol, add to `solver/registry.py`
3. **Add a color mode:** Extend `ColorMode` type, implement logic in `features/viewer3d/ContainerInstances.tsx`
4. **Import BAPLIE:** Implement parser in `io/baplie.py` (phase 2)
5. **Export BAPLIE:** Implement writer in `io/baplie.py` (phase 2)
6. **Add stability calc:** Implement in `stability/calc.py` (phase 4)
