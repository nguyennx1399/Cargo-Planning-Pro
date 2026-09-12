from __future__ import annotations

from .base import StowageSolver
from .cpsat import CpSatSolver
from .greedy import GreedySolver

SOLVERS: dict[str, StowageSolver] = {
    GreedySolver.name: GreedySolver(),
    CpSatSolver.name: CpSatSolver(),
}
