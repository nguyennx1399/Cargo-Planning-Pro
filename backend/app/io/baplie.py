"""BAPLIE (UN/EDIFACT bay plan) import/export.

TODO(phase-2):
- Support SMDG BAPLIE 2.2 (D.95B) first, then 3.1.
- Segments of interest: LOC+147 (stowage cell), EQD (container), MEA (VGM),
  LOC+9/LOC+11 (POL/POD), DGS (IMDG), TMP (reefer), DIM (OOG).
- Golden-file round-trip tests in tests/test_baplie.py.
"""
from __future__ import annotations

from ..domain.models import StowagePlan


def parse_baplie(text: str, vessel_id: str) -> StowagePlan:
    raise NotImplementedError("BAPLIE import arrives in phase 2")


def write_baplie(plan: StowagePlan) -> str:
    raise NotImplementedError("BAPLIE export arrives in phase 2")
