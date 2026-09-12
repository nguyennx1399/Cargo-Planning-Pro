"""Precomputed lookups shared by all rules (built once per validation run)."""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.models import Container, DeckLevel, StackSpec, StowagePlan, Vessel
from ..domain.slot import is_on_deck


@dataclass
class ValidationContext:
    vessel: Vessel
    plan: StowagePlan
    containers: dict[str, Container] = field(init=False)
    stacks: dict[tuple[int, int, DeckLevel], StackSpec] = field(init=False)
    pod_sequence: dict[str, int] = field(init=False)
    # (bay, row, deck) -> [(tier, container_id)] sorted bottom -> top
    columns: dict[tuple[int, int, DeckLevel], list[tuple[int, str]]] = field(init=False)

    def __post_init__(self) -> None:
        self.containers = {c.id: c for c in self.plan.containers}
        self.stacks = {(s.bay, s.row, s.deck): s for s in self.vessel.stacks}
        self.pod_sequence = {p.locode: p.sequence for p in self.plan.ports}
        cols: dict[tuple[int, int, DeckLevel], list[tuple[int, str]]] = {}
        for p in self.plan.placements:
            deck = DeckLevel.ON if is_on_deck(p.slot.tier) else DeckLevel.UNDER
            cols.setdefault((p.slot.bay, p.slot.row, deck), []).append((p.slot.tier, p.container_id))
        for v in cols.values():
            v.sort()
        self.columns = cols
