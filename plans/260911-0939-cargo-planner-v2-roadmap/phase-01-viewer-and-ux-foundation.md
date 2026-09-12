# Phase 1 — Viewer và nền tảng UX

## Context Links
- Reference: [reference-v2-product-plan.md](./reference-v2-product-plan.md) §3, §4.1–4.2, §5, §6, §7 phase 1, §10
- Trước: [phase-00](./phase-00-discovery-users-data-market.md) (mapping, booklet, top-3 luồng) · Sau: [phase-02](./phase-02-manual-stowage-rules-approx-stability.md)
- Docs: `docs/ARCHITECTURE.md` (solver contract), `docs/DOMAIN.md` (slot coords, 3D axes), `docs/project-roadmap.md` (Known Gaps), `docs/design-guidelines.md`, `docs/code-standards.md`
- Code hiện tại: `backend/app/domain/models.py`, `backend/app/validation/{context,engine,rules}.py`, `backend/app/solver/{base,greedy,cpsat,registry}.py`, `backend/app/api/routes.py`, `backend/app/data/{sample.py,sample_vessel.json}`, `backend/app/stability/calc.py`, `backend/app/io/baplie.py`, `frontend/src/{types/domain.ts,lib/geometry.ts,lib/colors.ts,store/usePlanStore.ts,api/client.ts}`, `frontend/src/features/{viewer3d,panels,bayplan}/*`

## Overview
- Priority: P1
- Status: pending
- Mô tả: tổng quát hóa skeleton sang CargoUnit/StowageSpace (S, làm đầu tiên, chi tiết cấp file), rồi design system, hull + hầm MPP, render break-bulk, mặt nước, bay/hold plan 2D, connector + màn hình hàng chưa xếp/thiếu dữ liệu, kiểm thử khả dụng vòng 1. Cỡ: 1L + 4M + 3S.
- Hoàn thành khi: kéo một chuyến thật từ shipment DB và xem trực quan; planner hiểu màn hình không cần hướng dẫn.

## Key Insights (từ đọc code)
- `models.py` 121 LOC; thêm CargoUnit/StowageSpace/union → >200 → tách package. Python module phải snake_case (import được); guidance kebab-case của hook không áp dụng cho Python.
- Rules đọc `ctx.columns` (key `(bay,row,deck)`) + `ctx.stacks` + `ctx.containers`; greedy đọc `vessel.stacks`. → Giữ `StackSpec` nguyên, chỉ đổi nguồn: `vessel.slot_stacks()` gom từ `spaces[].slot_grid.stacks`. Rules gần như không đổi logic.
- Chỉ có `test_api.py`, `test_slot.py` → chưa có lưới an toàn cho 6 rule + greedy → viết test TRƯỚC refactor.
- Known gap: `/api/stowage/solve` không chạy `validate()`; `/plans/demo` cũng không.
- Frontend chỉ dùng `vessel.bays/rows/length_m/beam_m`, `plan.placements[].slot`, `plan.containers`, `violation.container_ids` → blast radius nhỏ.
- Frontend: `x` dọc (mũi +x), `y` lên, `z` ngang (phải +z), gốc giữa tàu, `y=0` tại mặt boong (`lib/geometry.ts`). Phải chốt hệ tọa độ tàu cho `SpacePlacement` ngay bây giờ.

## Quyết định (đề xuất, có lý do)

| Chủ đề | Quyết định | Lý do |
|---|---|---|
| Hệ tọa độ backend | Naval ship frame: `x` từ AP về mũi (m), `y` ngang +mạn phải, `z` từ baseline lên | Khớp booklet (LCG/TCG/KG), stability dùng thẳng. Frontend đổi 1 chỗ: `sceneX = x − L/2`, `sceneY = z − depth_m`, `sceneZ = y` |
| Điểm neo SpacePlacement | Tâm đáy footprint (x,y = tâm footprint, z = mặt đáy hàng) | Tiện cho tải sàn, bắt dính sàn, chồng hàng |
| Xoay | `yaw_deg ∈ {0, 90, 180, 270}` + `CargoUnit.allowed_rotations` | Đủ cho hộp/trụ; va chạm vẫn là AABB. Lật nghiêng để sau |
| Container vessel → spaces | Feeder: 2 `slot_area` (under-deck, on-deck), mỗi cái 1 `SlotGrid` chứa `StackSpec` hiện có | Đơn giản nhất; rules chỉ cần `slot_stacks()` phẳng nên độ mịn spaces không ảnh hưởng |
| Placement | Pydantic v2 discriminated union `kind: "slot" \| "space"` | Một list placements, validator tách theo kind; OpenAPI sinh `oneOf` + discriminator |
| Tên trường | `container_id` → `cargo_id`, `plan.containers` → `plan.cargo`, `Violation.container_ids` → `cargo_ids` | Nhất quán; chưa có client ngoài nên breaking OK |
| `models.py` | Xóa, thay bằng module + `domain/__init__.py` re-export | Một cách import duy nhất (DRY); chỉ ~9 file import |
| TS types | `openapi-typescript` NGAY phase 1 | Model đổi liên tục ở phase 1–4; union + nested optional mirror tay dễ lệch; FastAPI đã có OpenAPI; chỉ devDependency. Có test drift ở backend |
| OpenAPI schema | `FastAPI(separate_input_output_schemas=False)` | Tránh tên `StowagePlan-Input/-Output` làm rối types |
| Solver contract | Hàm chung `solve_and_validate()` dùng cho `/solve` và `/plans/demo` | Fix Known Gap 1, DRY |
| Persistence | Phase 1 vẫn in-memory + file JSON/CSV. PostgreSQL vào WP đầu phase 2 | Phase 1 chỉ đọc/xem; phiên bản/undo cần DB ở phase 2 (YAGNI) |
| tenant_id | Có `tenant_id NOT NULL` từ migration đầu (phase 2), seed 1 tenant mặc định | Thương mại đã chốt; thêm sau = migration mọi bảng + sửa mọi query + rủi ro rò dữ liệu; chi phí bây giờ ~1 cột + 1 dependency |
| Connector | `CargoSourceConnector` protocol + `CsvFixtureConnector`; `ShipmentDbConnector` sau mapping phase 0 | Tách lõi khỏi nguồn (§4.1) |
| Frontend naming | Không đổi tên file PascalCase hiện có; file mới: component theo PascalCase hiện hữu, non-component `.ts` dùng kebab-case | Nhất quán cục bộ; xung đột với CLAUDE.md để câu hỏi mở |

## Requirements
Functional:
- F1 Domain model v2: `CargoUnit` (kind container/breakbulk/project), `ContainerDetails`, `StowageSpace` (slot_area/hold/tweendeck/deck), `SlotGrid`, `SlotPlacement | SpacePlacement`, `Vessel.spaces`.
- F2 6 rule hiện có giữ nguyên hành vi; thêm 2 rule nhỏ bảo vệ model mới (`slot_cargo_is_container`, `space_exists`).
- F3 Greedy chạy trên model mới, output giống golden snapshot; hàng không phải container → `unplaced`.
- F4 `/api/stowage/solve` trả `{plan, report}` đã validate.
- F5 Sample: feeder synthetic + MPP synthetic (1 hold + 1 tweendeck + vài break-bulk) gắn `data_status="synthetic"`.
- F6 3D: hull cải tiến, hầm/tweendeck/miệng hầm, container 20/40/45, break-bulk hộp/trụ/GLTF, mặt nước + thước mớn nước.
- F7 2D: bay plan (container), hold plan (MPP: top view + mặt cắt), đồng bộ hover/select với 3D.
- F8 Connector + danh sách chuyến, màn hình hàng chưa xếp, màn hình hàng thiếu dữ liệu.
- F9 Design system + layout chuẩn.

Non-functional:
- 60fps với 20.000 container (§9); hold plan mượt với ≤500 kiện MPP.
- File code < 200 LOC; `pytest` + `npm run typecheck` xanh sau mỗi bước.
- Không đoán ngầm dữ liệu thiếu (§4.2).

## Architecture

### Domain package (backend)
```
backend/app/domain/
├── __init__.py            # re-export public names
├── ship_geometry.py       # Vec3, Box (ship frame), Rect2D (hatch opening)
├── cargo.py               # CargoKind, CargoShape, ContainerSize/Type, ContainerDetails, CargoUnit, container_unit()
├── vessel.py              # DeckLevel, StackSpec, SlotGrid, SpaceType, StowageSpace, Vessel(+slot_stacks())
├── plan.py                # PortCall, Slot, SlotPlacement, SpacePlacement, Placement, StowagePlan
├── validation_report.py   # Severity, Violation, ValidationReport
├── cargo_data_quality.py  # missing_fields(unit) (WP 1.K)
└── slot.py                # giữ nguyên (import Slot từ .plan)
```

Model phác thảo (Pydantic v2):
```python
# cargo.py
class CargoKind(str, Enum): CONTAINER="container"; BREAKBULK="breakbulk"; PROJECT="project"
class CargoShape(str, Enum): BOX="box"; CYLINDER="cylinder"
class ContainerDetails(BaseModel):
    iso_code: str | None = None          # ISO 6346 size-type, e.g. "45G1"
    size: ContainerSize; type: ContainerType = ContainerType.DRY
    high_cube: bool = False; oog: bool = False
class CargoUnit(BaseModel):
    id: str                               # container number (ISO 6346) or shipment item ref
    kind: CargoKind
    description: str | None = None
    length_m: float | None = None; width_m: float | None = None; height_m: float | None = None
    weight_t: float | None = None         # None = thiếu dữ liệu, không đoán
    cog_offset_m: Vec3 | None = None      # từ tâm hình học; None = giả định tâm (ghi missing)
    shape: CargoShape = CargoShape.BOX
    stackable: bool | None = None; max_stack_load_t: float | None = None
    lifting_points: list[Vec3] = []
    allowed_yaw_deg: list[int] = [0, 90, 180, 270]
    imdg_class: str | None = None
    pol: str; pod: str
    model_uri: str | None = None          # GLTF (project cargo)
    container: ContainerDetails | None = None
    @model_validator(mode="after")        # kind==container <=> container is not None
def container_unit(id, size, weight_t, pol, pod, type=DRY, high_cube=False, imdg_class=None) -> CargoUnit
    # điền L×W×H từ ISO_DIMS; dùng ở sample + tests + connector

# vessel.py
class SlotGrid(BaseModel): stacks: list[StackSpec]
class SpaceType(str, Enum): SLOT_AREA="slot_area"; HOLD="hold"; TWEENDECK="tweendeck"; DECK="deck"
class StowageSpace(BaseModel):
    id: str; name: str; type: SpaceType
    boxes: list[Box] = []                 # ship frame; rỗng được cho slot_area synthetic
    floor_load_t_m2: float | None = None; clear_height_m: float | None = None
    hatch_opening: Rect2D | None = None
    slot_grid: SlotGrid | None = None     # bắt buộc khi type == slot_area
class Vessel(BaseModel):
    id; name; imo | None; length_m; beam_m; depth_m: float | None = None
    design_draft_m: float | None = None   # phase 1: vị trí mặt nước tĩnh; phase 2 thay bằng stability
    bays: list[int]; rows: list[int]      # giữ cho bay plan / geometry.ts
    spaces: list[StowageSpace]
    data_status: Literal["synthetic", "assumed", "verified"] = "synthetic"
    def slot_stacks(self) -> list[StackSpec]   # phẳng từ mọi slot_grid (không serialize)

# plan.py
class SlotPlacement(BaseModel): kind: Literal["slot"] = "slot"; cargo_id: str; slot: Slot
class SpacePlacement(BaseModel):
    kind: Literal["space"] = "space"; cargo_id: str; space_id: str
    x_m: float; y_m: float; z_m: float    # tâm đáy footprint, ship frame
    yaw_deg: Literal[0, 90, 180, 270] = 0
Placement = Annotated[SlotPlacement | SpacePlacement, Field(discriminator="kind")]
class StowagePlan(BaseModel):
    id; vessel_id; voyage; ports: list[PortCall]; cargo: list[CargoUnit]
    placements: list[Placement]; unplaced: list[str] = []
    def slot_placements(self) -> list[SlotPlacement]; def space_placements(self) -> list[SpacePlacement]
```

### Validation
- `validation/context.py`: `cargo: dict[str, CargoUnit]`, `stacks` từ `vessel.slot_stacks()`, `columns` chỉ từ `plan.slot_placements()`, `spaces: dict[str, StowageSpace]`.
- `validation/slot_rules.py`: 6 rule hiện có (dời nguyên văn, đổi `ctx.containers[cid]` → `ctx.cargo[cid]`, `c.type` → `c.container.type`, `c.size` → `c.container.size`) + `slot_cargo_is_container`.
- `validation/space_rules.py`: `space_exists` (phase 1); phase 2 thêm va chạm/tải sàn...
- `validation/rules.py`: chỉ registry `ALL_RULES = SLOT_RULES + SPACE_RULES`.

### Solver/API
```
solver/base.py              StowageSolver.solve(vessel, cargo: list[CargoUnit], ports, voyage) -> StowagePlan
solver/solve_and_validate.py  solve_and_validate(solver_name, vessel, cargo, ports, voyage) -> SolveResult(plan, report)
api/routes.py               router gốc, include sub-routers
api/vessel_routes.py        GET /api/vessels, GET /api/vessels/{id}
api/plan_routes.py          GET /api/plans/demo?vessel_id=, POST /api/validate, POST /api/stowage/solve
api/voyage_routes.py        GET /api/voyages, GET /api/voyages/{ref}  (WP 1.K)
data/vessel_catalog.py      load & cache feeder + mpp (thay _VESSELS trong routes)
```

### Types pipeline
```
backend/scripts/export_openapi.py  --> frontend/src/types/openapi.json (commit)
npm run gen:types  --> frontend/src/types/api-schema.gen.ts (openapi-typescript, commit)
frontend/src/types/domain.ts  = aliases: export type CargoUnit = components["schemas"]["CargoUnit"] ... + type guards isSlotPlacement/isSpacePlacement
backend/tests/test_openapi_snapshot.py: committed openapi.json == app.openapi()  (drift guard)
```

### Frontend 3D/2D
```
lib/ship-frame.ts             shipToScene(vessel, x,y,z), yawToQuaternion
lib/geometry.ts               slotToPosition (giữ), cargoDims(unit)
features/viewer3d/
  VesselScene.tsx             + WaterSurface, HoldSpaces, BreakbulkInstances
  ContainerInstances.tsx      1 InstancedMesh / size (20/40/45)
  BreakbulkInstances.tsx      InstancedMesh box + cylinder; GltfCargo cho model_uri
  HoldSpaces.tsx              wireframe hầm, tấm tweendeck, viền miệng hầm
  WaterSurface.tsx, DraftMarks.tsx
features/bayplan/BayPlanView.tsx   SVG grid 1 bay + overview strip
features/holdplan/HoldPlanView.tsx top view + section (SVG)
features/cargo/UnplacedCargoPanel.tsx, MissingDataPanel.tsx
features/voyage/VoyagePicker.tsx
```

## Related Code Files

Create (backend):
- `backend/app/domain/{ship_geometry,cargo,vessel,plan,validation_report,cargo_data_quality}.py`
- `backend/app/validation/{slot_rules,space_rules}.py`
- `backend/app/solver/solve_and_validate.py`
- `backend/app/api/{vessel_routes,plan_routes,voyage_routes}.py`
- `backend/app/data/{vessel_catalog,sample_mpp}.py`, `backend/app/data/{sample_mpp_vessel,sample_mpp_cargo}.json`
- `backend/app/data/fixtures/voyage-demo-001.csv` (synthetic/ẩn danh)
- `backend/app/connectors/{__init__,base,csv_fixture_connector,shipment_db_connector}.py`
- `backend/scripts/export_openapi.py`
- `backend/tests/{factories,test_slot_rules,test_engine,test_greedy_golden,test_domain_models,test_space_rules,test_solve_and_validate,test_openapi_snapshot,test_csv_fixture_connector,test_cargo_data_quality}.py`
- `backend/tests/fixtures/greedy_demo_n150_seed42.json`

Create (frontend):
- `frontend/src/types/{openapi.json,api-schema.gen.ts}`
- `frontend/src/lib/ship-frame.ts`
- `frontend/src/styles/{tokens.css,base.css,layout.css}`
- `frontend/src/components/ui/{Button,Panel,Tabs,DataTable,Badge,Toolbar,EmptyState}.tsx`
- `frontend/src/features/viewer3d/{BreakbulkInstances,GltfCargo,HoldSpaces,WaterSurface,DraftMarks}.tsx`
- `frontend/src/features/holdplan/{HoldPlanView,HoldTopView,HoldSectionView}.tsx`
- `frontend/src/features/bayplan/{BayGrid,BayOverviewStrip}.tsx`
- `frontend/src/features/cargo/{UnplacedCargoPanel,MissingDataPanel}.tsx`
- `frontend/src/features/voyage/VoyagePicker.tsx`

Modify:
- `backend/app/domain/slot.py` (import `Slot` từ `.plan`), `backend/app/domain/__init__.py`
- `backend/app/validation/{context,engine,rules}.py`
- `backend/app/solver/{base,greedy,cpsat,registry}.py`
- `backend/app/api/routes.py`, `backend/app/main.py` (`separate_input_output_schemas=False`, include routers)
- `backend/app/data/{sample.py,sample_vessel.json}` (thêm `depth_m`, `data_status`)
- `backend/app/stability/calc.py`, `backend/app/io/baplie.py` (đổi import/tên trường)
- `backend/tests/test_api.py`
- `frontend/package.json` (devDep `openapi-typescript`, script `gen:types`)
- `frontend/src/types/domain.ts`, `frontend/src/api/client.ts`, `frontend/src/lib/{geometry,colors}.ts`, `frontend/src/store/usePlanStore.ts`
- `frontend/src/features/viewer3d/{VesselScene,ContainerInstances,Hull}.tsx`, `frontend/src/features/panels/Sidebar.tsx`, `frontend/src/features/bayplan/BayPlanView.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css` (tách sang `styles/`)
- Docs: `docs/PLAN.md`, `docs/project-roadmap.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/design-guidelines.md`, `README.md` (index)

Delete:
- `backend/app/domain/models.py` (sau khi mọi import chuyển xong)

## Implementation Steps

### Refactor CargoUnit/StowageSpace (S) — làm đầu tiên, theo thứ tự

**1.A Lưới an toàn (trên code HIỆN TẠI, chưa đổi model)**
1. `backend/tests/factories.py`: `make_vessel(stacks)`, `make_stack(bay,row,deck,tiers,max_w,reefer_tiers)`, `make_container(id,size="40",weight=10,type="DRY",pod="SGSIN")`, `place(cid, "BBRRTT")`, `make_plan(vessel, cargo, placements, ports=SAMPLE_PORTS)`. Test chỉ gọi factories → khi refactor chỉ sửa file này.
2. `backend/tests/test_slot_rules.py` — mỗi rule ≥1 case vi phạm + ≥1 case sạch, assert `rule`, `severity`, `container_ids`:
   - `slot_exists`: tier không có trong stack; stack không tồn tại.
   - `size_fits_bay`: 40' ở bay lẻ (03) → ERROR; 40' bay chẵn → sạch.
   - `stack_weight`: tổng > `max_weight_t` → ERROR liệt kê mọi id trong stack.
   - `no_floating`: tier 04 khi 02 trống → ERROR; 02+04 → sạch.
   - `reefer_plug`: reefer ở 84 khi plug chỉ 82 → ERROR.
   - `overstow`: POD sau nằm trên POD trước → WARNING; `report.ok` vẫn True.
3. `backend/tests/test_engine.py`: kpis keys `placed/unplaced/overstows/errors`; `ok=False` khi có ERROR.
4. Golden greedy: chạy 1 lần script ngắn (không commit script) dump `{container_id: slot_code}` + `unplaced` + đếm violation theo rule cho `random_cargo(150, 42)` → `backend/tests/fixtures/greedy_demo_n150_seed42.json`. `backend/tests/test_greedy_golden.py` so khớp.
5. `cd backend && pytest` xanh trên code hiện tại. **Không qua bước sau nếu đỏ.**

**1.B Domain package**
1. Tạo `ship_geometry.py`, `cargo.py`, `vessel.py`, `plan.py`, `validation_report.py` theo phác thảo. `ISO_DIMS` (m): 20' 6.058, 40' 12.192, 45' 13.716; W 2.438; H 2.591 / HC 2.896 (khớp `DOMAIN.md`, `lib/geometry.ts`).
2. `domain/__init__.py` re-export; `slot.py` import `Slot` từ `.plan`.
3. `backend/tests/test_domain_models.py`: validator kind↔container; union parse JSON `{"kind":"slot"...}` và `{"kind":"space"...}`; `container_unit()` điền đúng dims; `Vessel.slot_stacks()` phẳng đúng.
4. Chưa xóa `models.py` (bước 1.C xóa).

**1.C Chuyển consumers sang model mới**
1. `validation/context.py`: dựng từ `vessel.slot_stacks()`, `plan.slot_placements()`, `cargo` dict, `spaces` dict.
2. `validation/slot_rules.py`: dời 6 rule từ `rules.py`, sửa truy cập trường; `size_fits_bay`/`reefer_plug` bỏ qua cargo không phải container (đã bị `slot_cargo_is_container` bắt). Thêm `slot_cargo_is_container` (ERROR khi `kind != container` trong SlotPlacement).
3. `validation/space_rules.py`: `space_exists` (ERROR khi `space_id` không có trên tàu). `SPACE_RULES = [space_exists]`.
4. `validation/rules.py` → registry `ALL_RULES`; `engine.py`: đổi import, KPI giữ nguyên key (`placed` = tổng placements).
5. `solver/base.py`, `cpsat.py`: đổi chữ ký `cargo: list[CargoUnit]`.
6. `solver/greedy.py`: `containers = [c for c in cargo if c.kind == CONTAINER]`, còn lại → `unplaced`; duyệt `vessel.slot_stacks()`; tạo `SlotPlacement`; logic sắp xếp/duyệt slot GIỮ NGUYÊN (golden phải khớp).
7. `solver/solve_and_validate.py`: `SolveResult(plan, report)`; raise `KeyError` solver lạ → route map 400; `NotImplementedError` → 501.
8. `data/sample.py`: `load_sample_vessel()` dựng 2 space `feeder-under-deck-slots`, `feeder-on-deck-slots` (type slot_area) từ `stacks_template`; `random_cargo()` dùng `container_unit()`. `sample_vessel.json` thêm `depth_m` (≈ `holdDepth()` hiện tại + 1.5 → giá trị hằng, ghi chú synthetic), `data_status: "synthetic"`.
9. `data/vessel_catalog.py`: `get_vessel(id)`, `list_vessels()` (cache dict; thay `_VESSELS` ở routes).
10. `stability/calc.py`, `io/baplie.py`: đổi import + `plan.cargo`/`cargo_id`.
11. Tách routes: `api/vessel_routes.py`, `api/plan_routes.py` (demo + validate + solve dùng `solve_and_validate`), `api/routes.py` gộp. `SolveResponse = SolveResult`. `main.py`: `FastAPI(..., separate_input_output_schemas=False)`.
12. Cập nhật `tests/factories.py` sang model mới (tests khác không đổi); golden: map `container_id`→`cargo_id`, so sánh y hệt.
13. Thêm `backend/tests/test_solve_and_validate.py`: `/api/stowage/solve` trả `report`; solver lạ → 400; `cpsat` → 501.
14. Xóa `domain/models.py`; `grep -rn "domain.models" backend` = rỗng. `cd backend && pytest` xanh.

**1.D MPP synthetic sample**
1. `data/sample_mpp_vessel.json` (data_status `synthetic`, ghi chú "dữ liệu giả định"): tàu ~120 m × 20 m × 11 m; space `h1-lower` (hold, box x 70–95, y −8.5–8.5, z 1.2–7.5, floor 15 t/m²), `h1-tweendeck` (tweendeck, z 7.5–11, floor 3.5 t/m², hatch 20×14 m), tùy chọn `h1-hatch-cover` (deck).
2. `data/sample_mpp_cargo.json`: 5–8 kiện: cuộn thép (cylinder), kiện máy (box, có `cog_offset_m`), 1 project cargo (`model_uri` null hoặc GLTF mẫu nhỏ), 1 kiện cố tình thiếu `height_m`/`cog` (demo màn hình thiếu dữ liệu) + `SpacePlacement` cố định hợp lệ.
3. `data/sample_mpp.py`: loader; `vessel_catalog` đăng ký `mpp-demo`; `/api/plans/demo?vessel_id=mpp-demo` trả plan cố định (chưa có SpaceSolver). Test: plan MPP validate không ERROR (`space_exists` sạch).

**1.E TS types qua OpenAPI**
1. `backend/scripts/export_openapi.py` → ghi `frontend/src/types/openapi.json` (json sort_keys, indent 2).
2. `frontend/package.json`: devDep `openapi-typescript`, script `"gen:types": "openapi-typescript src/types/openapi.json -o src/types/api-schema.gen.ts"`.
3. `frontend/src/types/domain.ts`: aliases từ `components["schemas"]` + `isSlotPlacement/isSpacePlacement`, `ColorMode` giữ ở store.
4. `backend/tests/test_openapi_snapshot.py`: fail nếu schema lệch → nhắc chạy export + gen:types.
5. Sửa consumers: `api/client.ts` (`solve()` trả `SolveResult`), `lib/colors.ts` (`cargoColor(unit, mode, pods)`; break-bulk màu trung tính theo POD/weight, type mode dùng kind), `ContainerInstances.tsx` (lọc `isSlotPlacement`, map `cargo`), `Sidebar.tsx` (`cargo_ids`, hiển thị kind/dims), `BayPlanView.tsx` (slot placements), `App.tsx`.
6. `cd frontend && npm run typecheck` xanh; smoke: `npm run dev` + backend, feeder hiển thị như trước.

→ Kết thúc refactor (S). Checkpoint: pytest + typecheck xanh, demo feeder không đổi hình ảnh.

### 1.F Design system (M)
- Trước code: Figma wireframe 3 luồng từ phase 0 + layout chuẩn: trái = chuyến/hàng (unplaced, missing), giữa = stage (3D trên / 2D dưới, chia được), phải = inspector (hàng/slot đang chọn), dưới = status bar (placeholder ổn định, số vi phạm).
- `styles/tokens.css`: CSS variables — neutral scale, accent 1 màu, `--color-error`/`--color-warning` CHỈ cho vi phạm (§3.3), POD palette (dời từ `colors.ts`), typography scale (UI 13–14px, số tabular-nums), spacing 4px grid, density compact.
- `components/ui/*`: Button, Panel, Tabs, DataTable (dense, sort, keyboard ↑↓), Badge (severity), Toolbar, EmptyState. Không thêm UI lib nặng (YAGNI); đánh giá lại nếu cần.
- Tách `styles.css` → `styles/{tokens,base,layout}.css`. Cập nhật `docs/design-guidelines.md`.
- Chấp nhận: mọi panel dùng token; không màu đỏ/vàng ngoài vi phạm; phím tắt cơ bản (1/2/3 đổi color mode, `[`/`]` đổi bay, `Esc` bỏ chọn).

### 1.G Hull thật + hầm MPP trong 3D (M)
> Hull, frames, linh kiện, sơn: thực hiện theo [vessel 3D model pipeline](../260911-1409-vessel-3d-model-pipeline/plan.md) phase 01–03 (hull tham số L1 sinh offsets → loft mesher chung). Mục `hull_stations` bên dưới được thay bằng `VesselGeometry.hull` (offsets). `HoldSpaces` giữ ở đây.
- `lib/ship-frame.ts`: `shipToScene`, `boxToScene`; unit test nhỏ (nếu chưa có test runner FE → kiểm tra bằng typecheck + so sánh thủ công; câu hỏi mở: thêm vitest?).
- `Hull.tsx`: nếu `vessel.hull_stations` (optional, half-breadth theo station từ booklet, thêm field khi phase 0 có dữ liệu) → extrude; không có → hull tham số (thân song song + mũi/lái thon theo L,B,depth). Không đổi `Vessel` schema cho tới khi có dữ liệu thật (YAGNI) — tham số trước.
- `HoldSpaces.tsx`: vẽ `StowageSpace.boxes` (Edges mảnh), tweendeck = tấm mờ, `hatch_opening` = viền; toggle hiện/ẩn theo space; click space → inspector (floor load, clear height).

### 1.H Render break-bulk / project cargo (M)
- `ContainerInstances.tsx`: 1 InstancedMesh cho mỗi size (20/40/45) — scale theo dims thay vì cứng `len40`; giữ tách matrix/color effect.
- `BreakbulkInstances.tsx`: InstancedMesh `box` + InstancedMesh `cylinder` (unit geometry, scale theo L×W×H, quaternion theo `yaw_deg`), vị trí qua `shipToScene` (+ H/2 vì neo đáy).
- `GltfCargo.tsx`: `useGLTF(model_uri)` cho số ít project cargo; fallback box nếu load lỗi. Asset: `frontend/public/models/` phase 1; object storage ở phase 5.
- Hàng thiếu dims: không render trong khoang, chỉ hiện ở MissingDataPanel.
- Selection/hover thống nhất theo `cargo_id` (store).
- Perf: đo 20k container (`/api/plans/demo?n=20000` trên tàu synthetic lớn hoặc stress fixture) → 60fps trên máy dev chuẩn; ghi kết quả vào `docs/project-roadmap.md`.

### 1.I Mặt nước + thước mớn nước (S)
- `WaterSurface.tsx`: mặt nước CỐ ĐỊNH; thân tàu (group chứa hull + cargo) dịch theo mớn nước. Phase 1: draft = `vessel.design_draft_m` (optional field) hoặc hằng synthetic; phase 2 nối stability (list/trim).
- `DraftMarks.tsx`: vạch mớn nước mũi/giữa/lái mỗi 0.2 m, số mỗi 1 m (billboard text).

### 1.J Bay plan 2D + hold plan 2D (L)
- Bay plan (container): `BayPlanView` → `BayGrid` (SVG 1 bay: khối on-deck trên đường miệng hầm, under-deck dưới; cột = rows theo quy ước DOMAIN.md, nhãn row/tier), `BayOverviewStrip` (mini-grid mọi bay, click chọn bay). Màu ô = cùng `cargoColor`; hover/select đồng bộ 3D qua `usePlanStore`; ô vi phạm viền đỏ/vàng.
- Hold plan (MPP): `HoldPlanView` → `HoldTopView` (mặt phẳng x–y từng space, footprint kiện theo yaw, lưới 1 m, thước) + `HoldSectionView` (x–z, thấy tweendeck và chiều cao). Pan/zoom SVG, hover/select đồng bộ.
- Kiểm chứng quy ước hiển thị (nhìn từ lái/mũi, mạn phải bên nào) với planner ở kiểm thử vòng 1.
- Chưa có kéo thả (phase 2).

### 1.K Connector shipment + hàng chưa xếp + thiếu dữ liệu (M)
Backend:
```python
# connectors/base.py
class VoyageSummary(BaseModel): ref: str; vessel_id: str | None; ports: list[PortCall]; cargo_count: int
class VoyageCargo(BaseModel): voyage: VoyageSummary; cargo: list[CargoUnit]; source_warnings: list[str]
class CargoSourceConnector(Protocol):
    name: str
    def list_voyages(self) -> list[VoyageSummary]: ...
    def load_voyage(self, ref: str) -> VoyageCargo: ...
```
- `csv_fixture_connector.py`: đọc `data/fixtures/*.csv` (cột = tên trường chuẩn + đơn vị chuẩn); dòng lỗi → `source_warnings`, không crash.
- `shipment_db_connector.py`: CHỈ khi phase 0 xong mapping + quyền dữ liệu. Read-only DSN từ env `SHIPMENT_DB_DSN`; mapping theo `shipment-to-cargo-unit-mapping.csv` (hard-code transform trong module, không DSL — YAGNI); query tham số hóa.
- Chọn connector qua env `CARGO_SOURCE=csv|shipment_db` (mặc định csv).
- `domain/cargo_data_quality.py`: `missing_fields(unit) -> list[str]` — container: `weight_t`, `pod`; breakbulk/project: `length_m,width_m,height_m,weight_t,pod`, + `cog_offset_m`, `stackable` (warning-level "cần xác nhận").
- `api/voyage_routes.py`: `GET /api/voyages`, `GET /api/voyages/{ref}` → `VoyageCargo` + `quality: {cargo_id: missing_fields}`.
- Tests: `test_csv_fixture_connector.py` (parse, đơn vị, dòng lỗi), `test_cargo_data_quality.py`.

Frontend:
- `VoyagePicker` (chọn chuyến + tàu), `UnplacedCargoPanel` (DataTable: id, kind, POD, weight, dims; lọc/sort; tổng t và số kiện), `MissingDataPanel` (danh sách + trường thiếu, sửa tạm trong phiên — override lưu ở Zustand, mất khi reload; lưu DB ở phase 2; banner nói rõ).
- Plan từ chuyến = plan rỗng (mọi hàng unplaced); nút "Auto (greedy demo)" gọi `/stowage/solve` cho container (tùy chọn, ghi rõ bản demo).

### 1.L Kiểm thử khả dụng vòng 1 (S)
- 3–5 người (planner container + MPP + chief officer). Nhiệm vụ: mở chuyến, tìm hàng chưa xếp, tìm hàng thiếu dữ liệu, tìm container X trên bay plan và 3D, đọc tải sàn hầm 1, tìm kiện nặng nhất trong hầm.
- Đo: tỷ lệ hoàn thành không hướng dẫn, thời gian, lỗi, SUS. Kết quả: `docs/research/v2-usability/round-1.md`; issue → backlog phase 2.

### 1.M Docs sync
- `docs/PLAN.md`: đầu file ghi "Superseded bởi plans/260911-0939-cargo-planner-v2-roadmap/plan.md", giữ nội dung lịch sử.
- `docs/project-roadmap.md`: bảng phase theo v2 (0–6), Known Gap 1 đóng, cập nhật cross-cutting (OpenAPI types done, tests per rule done).
- `docs/ARCHITECTURE.md`: sơ đồ §5 v2, solver contract mới (`cargo: list[CargoUnit]`, `solve_and_validate`).
- `docs/DOMAIN.md`: CargoUnit/StowageSpace, ship frame + mapping sang scene, SpacePlacement neo đáy, thuật ngữ MPP.
- `docs/system-architecture.md`, `docs/codebase-summary.md`: module mới, API mới. `README.md`: index + mô tả container + MPP.

## Todo List
- [ ] 1.A factories + test 6 rule + engine + golden greedy (xanh trên code cũ)
- [ ] 1.B domain package + test_domain_models
- [ ] 1.C consumers (context, slot/space rules, greedy, solve_and_validate, sample, catalog, routes) + xóa models.py
- [ ] 1.D MPP synthetic sample + demo endpoint
- [ ] 1.E OpenAPI → TS types, drift test, sửa frontend
- [ ] 1.F design system + Figma layout
- [ ] 1.G hull tham số + HoldSpaces
- [ ] 1.H InstancedMesh theo size, BreakbulkInstances, GltfCargo, perf 20k
- [ ] 1.I WaterSurface + DraftMarks
- [ ] 1.J BayPlanView/BayGrid/Overview + HoldPlanView (top + section)
- [ ] 1.K connectors (csv, shipment_db sau P0), data quality, voyage routes, panels
- [ ] 1.L kiểm thử khả dụng vòng 1
- [ ] 1.M docs sync

## Success Criteria
- `pytest` xanh gồm test từng rule + golden greedy khớp 100% sau refactor.
- `/api/stowage/solve` luôn có `report`; `grep domain.models` rỗng; mọi file < 200 LOC.
- `npm run typecheck` xanh; drift test OpenAPI xanh.
- Feeder demo hiển thị như trước; MPP demo hiển thị hầm + tweendeck + kiện hộp/trụ.
- 60fps với 20k container (đo, ghi số liệu).
- Kéo 1 chuyến thật (hoặc bản ẩn danh) qua connector, thấy hàng chưa xếp + thiếu dữ liệu.
- Vòng 1: ≥80% nhiệm vụ hoàn thành không hướng dẫn; SUS baseline ghi nhận.

## Risk Assessment
| Rủi ro | Giảm thiểu |
|---|---|
| Refactor phá hành vi rule/greedy | 1.A trước; golden snapshot; factories cô lập thay đổi |
| Pydantic union → OpenAPI → TS lệch | `separate_input_output_schemas=False`; drift test; kiểm tra `oneOf`+discriminator trong `api-schema.gen.ts` |
| Model phải đổi lại sau phase 0 | Trường MPP optional; 0.6 review; đổi = migration nhỏ (chưa có DB) |
| Perf 20k giảm khi tách InstancedMesh theo size | Vẫn ≤3 draw call container; đo trước/sau |
| Connector thật trễ (quyền dữ liệu) | CSV fixture ẩn danh đủ để demo + test UX |
| Hull thật thiếu dữ liệu | Hull tham số; station offsets khi có booklet |

## Security Considerations
- `SHIPMENT_DB_DSN` read-only, chỉ qua env; không log DSN/PII; query tham số hóa.
- Chỉ dữ liệu ẩn danh trong repo/dev; fixture CSV không chứa tên khách hàng.
- GLTF: chỉ load từ origin nội bộ (`/models/`), không URL tùy ý của người dùng.
- Chưa có auth ở phase 1 → không deploy công khai với dữ liệu thật.

## Next Steps
- Phase 2: PostgreSQL + tenant_id, chỉnh sửa plan, space rules, stability xấp xỉ.
- Phản hồi vòng 1 → backlog UX phase 2.

## Unresolved Questions
- Frontend file naming: giữ PascalCase component (hiện hữu) hay theo kebab-case CLAUDE.md? (plan này không đổi tên)
- Thêm test runner frontend (vitest) ở phase 1 cho `ship-frame.ts`/`cargoColor`? Đề xuất có, nhỏ.
- Quy ước hiển thị bay plan (nhìn từ lái hay mũi) theo khách hàng đầu tiên?
- Container trên tàu MPP: slot_area gắn với hold/hatch cover nào — chờ booklet tàu MPP tham chiếu.
