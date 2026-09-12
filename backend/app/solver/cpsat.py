"""OR-Tools CP-SAT solver (phase 4).

Planned decomposition:
1. Master bay planning — assign container GROUPS (pod, size, weight class, reefer) to bays,
   subject to capacity, reefer plugs, trim/GM approximations; minimize restows + crane imbalance.
2. Slot planning — per bay, assign individual containers to slots (CP-SAT or local search).
3. Validate with validation.engine; iterate if stability fails.
"""
from __future__ import annotations

from ..domain.models import Container, PortCall, StowagePlan, Vessel


class CpSatSolver:
    name = "cpsat"

    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
              voyage: str) -> StowagePlan:
        raise NotImplementedError("CP-SAT solver arrives in phase 4")
