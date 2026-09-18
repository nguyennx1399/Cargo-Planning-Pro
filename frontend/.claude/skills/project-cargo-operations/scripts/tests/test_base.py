"""Shared test utilities for calculator test suite."""
import unittest
import math


def rel_tol(expected, actual, tol_pct=0.5):
    """Assert actual is within relative tolerance of expected. tol_pct = 0.5 means ±0.5%."""
    if expected == 0:
        return abs(actual) < 1e-9
    rel_error = abs(actual - expected) / abs(expected)
    return rel_error <= tol_pct / 100.0


def assert_rel_equal(test_case, expected, actual, tol_pct=0.5, msg=None):
    """Assertion helper for relative tolerance checks."""
    if not rel_tol(expected, actual, tol_pct):
        if msg is None:
            msg = f"expected {expected}, got {actual} (rel tol {tol_pct}%)"
        test_case.fail(msg)


class CalculatorTestCase(unittest.TestCase):
    """Base class for calculator tests with tolerance helper."""

    def assertRelEqual(self, expected, actual, tol_pct=0.5, msg=None):
        """Assert actual within tol_pct% of expected."""
        assert_rel_equal(self, expected, actual, tol_pct, msg)

    def assertRelClose(self, expected, actual, tol_pct=0.5):
        """Quick check: True if within tolerance, False otherwise."""
        return rel_tol(expected, actual, tol_pct)
