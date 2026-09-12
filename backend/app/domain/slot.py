"""Slot coordinate helpers (ISO bay-row-tier). See docs/DOMAIN.md."""
from __future__ import annotations

from .models import Slot


def parse_slot(code: str) -> Slot:
    """'140682' -> Slot(bay=14, row=6, tier=82)."""
    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        raise ValueError(f"Invalid slot code: {code!r}")
    return Slot(bay=int(code[0:2]), row=int(code[2:4]), tier=int(code[4:6]))


def is_forty_bay(bay: int) -> bool:
    return bay % 2 == 0


def twenty_bays_of(forty_bay: int) -> tuple[int, int]:
    """Bay 02 spans 20' bays 01 and 03."""
    if not is_forty_bay(forty_bay):
        raise ValueError("Expected an even (40') bay")
    return forty_bay - 1, forty_bay + 1


def is_on_deck(tier: int) -> bool:
    return tier >= 80


def row_side(row: int) -> str:
    if row == 0:
        return "center"
    return "starboard" if row % 2 == 1 else "port"
