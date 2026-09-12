"""Demo vessel + random cargo. Replace with DB / BAPLIE import in phase 2."""
from __future__ import annotations

import json
import random
from pathlib import Path

from ..domain.models import (
    Container, ContainerSize, ContainerType, DeckLevel, PortCall, StackSpec, Vessel,
)

_DATA = Path(__file__).parent


def load_sample_vessel() -> Vessel:
    raw = json.loads((_DATA / "sample_vessel.json").read_text())
    stacks: list[StackSpec] = []
    for bay in raw["bays"]:
        for row in raw["rows"]:
            for deck in (DeckLevel.UNDER, DeckLevel.ON):
                t = raw["stacks_template"][deck.value]
                stacks.append(StackSpec(bay=bay, row=row, deck=deck, **t))
    return Vessel(
        id=raw["id"], name=raw["name"], imo=raw["imo"],
        length_m=raw["length_m"], beam_m=raw["beam_m"],
        bays=raw["bays"], rows=raw["rows"], stacks=stacks,
    )


SAMPLE_PORTS = [
    PortCall(locode="VNSGN", name="Ho Chi Minh", sequence=0),
    PortCall(locode="SGSIN", name="Singapore", sequence=1),
    PortCall(locode="MYPKG", name="Port Klang", sequence=2),
    PortCall(locode="LKCMB", name="Colombo", sequence=3),
]


def random_cargo(n: int = 150, seed: int = 42) -> list[Container]:
    rng = random.Random(seed)
    pods = [p.locode for p in SAMPLE_PORTS[1:]]
    out: list[Container] = []
    for i in range(n):
        reefer = rng.random() < 0.08
        out.append(Container(
            id=f"DEMU{i:06d}{rng.randint(0, 9)}",
            size=ContainerSize.FT40,          # TODO(phase-2): mix 20'/40'
            type=ContainerType.REEFER if reefer else ContainerType.DRY,
            high_cube=rng.random() < 0.3,
            weight_t=round(rng.uniform(4, 30), 1),
            pol="VNSGN",
            pod=rng.choice(pods),
        ))
    return out
