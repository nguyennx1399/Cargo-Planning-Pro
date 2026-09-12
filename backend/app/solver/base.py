from __future__ import annotations

from typing import Protocol

from ..domain.models import Container, PortCall, StowagePlan, Vessel


class StowageSolver(Protocol):
    name: str

    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
              voyage: str) -> StowagePlan: ...
