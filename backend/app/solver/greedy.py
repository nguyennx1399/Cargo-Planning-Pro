"""Greedy auto-stow (phase 3 baseline). Current version is a minimal placeholder.

Idea: load containers for the LAST port first so they end up at the bottom,
heavy before light within a port, fill stacks bottom-up, skip slots that break rules.

TODO(phase-3):
- Check stack weight / reefer / size per slot before placing (reuse validation rules)
- Spread weight across bays for trim (simple longitudinal balancing)
- Report KPIs through validation.engine
"""
from __future__ import annotations

import uuid

from ..domain.models import (
    Container, ContainerType, DeckLevel, Placement, PortCall, Slot, StowagePlan, Vessel,
)


class GreedySolver:
    name = "greedy-v0"

    def solve(self, vessel: Vessel, cargo: list[Container], ports: list[PortCall],
              voyage: str) -> StowagePlan:
        seq = {p.locode: p.sequence for p in ports}
        order = sorted(cargo, key=lambda c: (-seq.get(c.pod, 0), -c.weight_t))

        # free slots bottom-up: under deck first, then on deck
        free: list[tuple[int, int, int, bool]] = []  # (tier, bay, row, reefer_ok)
        for deck in (DeckLevel.UNDER, DeckLevel.ON):
            for tier_idx in range(max(len(s.tiers) for s in vessel.stacks)):
                for s in vessel.stacks:
                    if s.deck == deck and tier_idx < len(s.tiers):
                        t = s.tiers[tier_idx]
                        free.append((t, s.bay, s.row, t in s.reefer_tiers))

        placements: list[Placement] = []
        unplaced: list[str] = []
        used: set[int] = set()
        for c in order:
            needs_plug = c.type == ContainerType.REEFER
            idx = next((i for i, f in enumerate(free)
                        if i not in used and (f[3] or not needs_plug)), None)
            if idx is None:
                unplaced.append(c.id)
                continue
            used.add(idx)
            tier, bay, row, _ = free[idx]
            placements.append(Placement(container_id=c.id, slot=Slot(bay=bay, row=row, tier=tier)))

        return StowagePlan(id=str(uuid.uuid4()), vessel_id=vessel.id, voyage=voyage,
                           ports=ports, containers=cargo, placements=placements, unplaced=unplaced)
