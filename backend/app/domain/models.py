"""Core domain models. Single source of truth — frontend/src/types mirrors these."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ---------- Vessel ----------

class DeckLevel(str, Enum):
    UNDER = "under"
    ON = "on"


class StackSpec(BaseModel):
    """One vertical stack of slots: a (bay, row, deck level) column."""
    bay: int                      # even bay for 40' stacks (e.g. 2, 6, 10)
    row: int
    deck: DeckLevel
    tiers: list[int]              # e.g. [2, 4, 6, 8] or [82, 84, 86]
    max_weight_t: float           # stack weight limit (tonnes)
    max_height_m: float | None = None
    reefer_tiers: list[int] = Field(default_factory=list)


class Vessel(BaseModel):
    id: str
    name: str
    imo: str | None = None
    length_m: float
    beam_m: float
    bays: list[int]               # bays present, bow -> stern
    rows: list[int]               # rows present, port -> starboard
    stacks: list[StackSpec]
    # TODO(phase-4): hydrostatic tables, lightship weight/LCG/VCG, tanks, SF/BM limits


# ---------- Cargo ----------

class ContainerSize(str, Enum):
    FT20 = "20"
    FT40 = "40"
    FT45 = "45"


class ContainerType(str, Enum):
    DRY = "DRY"
    REEFER = "REEFER"
    OPEN_TOP = "OPEN_TOP"
    FLAT_RACK = "FLAT_RACK"
    TANK = "TANK"


class Container(BaseModel):
    id: str                       # ISO 6346, e.g. MSCU1234565
    size: ContainerSize
    type: ContainerType = ContainerType.DRY
    high_cube: bool = False
    weight_t: float               # VGM in tonnes
    pol: str                      # UN/LOCODE
    pod: str
    imdg_class: str | None = None
    oog: bool = False


class PortCall(BaseModel):
    locode: str
    name: str
    sequence: int                 # rotation order: 0 = current/loading port
    eta: datetime | None = None
    etd: datetime | None = None


# ---------- Plan ----------

class Slot(BaseModel):
    bay: int
    row: int
    tier: int

    @property
    def code(self) -> str:
        return f"{self.bay:02d}{self.row:02d}{self.tier:02d}"


class Placement(BaseModel):
    container_id: str
    slot: Slot


class StowagePlan(BaseModel):
    id: str
    vessel_id: str
    voyage: str
    ports: list[PortCall]
    containers: list[Container]
    placements: list[Placement]
    unplaced: list[str] = Field(default_factory=list)   # ids the solver could not place


# ---------- Validation ----------

class Severity(str, Enum):
    ERROR = "error"      # hard constraint broken
    WARNING = "warning"  # soft objective (e.g. overstow)


class Violation(BaseModel):
    rule: str
    severity: Severity
    message: str
    container_ids: list[str] = Field(default_factory=list)
    slots: list[str] = Field(default_factory=list)


class ValidationReport(BaseModel):
    ok: bool
    violations: list[Violation]
    kpis: dict[str, float] = Field(default_factory=dict)
