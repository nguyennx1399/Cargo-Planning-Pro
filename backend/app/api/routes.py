from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..data.sample import SAMPLE_PORTS, load_sample_vessel, random_cargo
from ..domain.models import StowagePlan, ValidationReport, Vessel
from ..solver.registry import SOLVERS
from ..validation.engine import validate

router = APIRouter(prefix="/api")

# TODO(phase-2): replace in-memory store with PostgreSQL repositories
_VESSELS: dict[str, Vessel] = {}


def get_vessel(vessel_id: str) -> Vessel:
    if not _VESSELS:
        v = load_sample_vessel()
        _VESSELS[v.id] = v
    if vessel_id not in _VESSELS:
        raise HTTPException(404, f"Vessel {vessel_id} not found")
    return _VESSELS[vessel_id]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/vessels/{vessel_id}", response_model=Vessel)
def read_vessel(vessel_id: str) -> Vessel:
    return get_vessel(vessel_id)


@router.get("/plans/demo", response_model=StowagePlan)
def demo_plan(n: int = 150, seed: int = 42) -> StowagePlan:
    """Random cargo auto-stowed with the greedy solver, so the viewer has something to show."""
    vessel = get_vessel("feeder-demo")
    return SOLVERS["greedy-v0"].solve(vessel, random_cargo(n, seed), SAMPLE_PORTS, voyage="DEMO001")


@router.post("/validate", response_model=ValidationReport)
def validate_plan(plan: StowagePlan) -> ValidationReport:
    return validate(get_vessel(plan.vessel_id), plan)


class SolveRequest(BaseModel):
    vessel_id: str
    solver: str = "greedy-v0"
    voyage: str
    plan: StowagePlan  # containers + ports taken from here; placements ignored


@router.post("/stowage/solve", response_model=StowagePlan)
def solve(req: SolveRequest) -> StowagePlan:
    # TODO(phase-4): run as background job, stream progress over WebSocket
    solver = SOLVERS.get(req.solver)
    if solver is None:
        raise HTTPException(400, f"Unknown solver {req.solver}")
    try:
        return solver.solve(get_vessel(req.vessel_id), req.plan.containers, req.plan.ports, req.voyage)
    except NotImplementedError as e:
        raise HTTPException(501, str(e)) from e
