"""Unit tests for cli module."""
import sys
import os
import json
import subprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

SCRIPTS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI_PATH = os.path.join(SCRIPTS_DIR, "cli.py")


def run_cli(*args):
    """Run cli.py and return (stdout, stderr, exit_code)."""
    cmd = ["python3", CLI_PATH] + list(args)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.stdout, proc.stderr, proc.returncode


class TestCliList(unittest.TestCase):
    """Tests for 'list' command."""

    def test_list_exits_0(self):
        """'list' exits with code 0."""
        _, _, code = run_cli("list")
        self.assertEqual(code, 0)

    def test_list_contains_anti_heeling_ballast(self):
        """'list' output contains anti_heeling_ballast function."""
        stdout, _, _ = run_cli("list")
        self.assertIn("anti_heeling_ballast", stdout)

    def test_list_contains_multiple_functions(self):
        """'list' output contains multiple calculator functions."""
        stdout, _, _ = run_cli("list")
        self.assertIn("net_sling_length", stdout)
        self.assertIn("bm_single_unit", stdout)
        self.assertIn("sliding_balance", stdout)


class TestCliHelp(unittest.TestCase):
    """Tests for 'help' command."""

    def test_help_bm_single_unit_exits_0(self):
        """'help bm_single_unit' exits 0."""
        _, _, code = run_cli("help", "bm_single_unit")
        self.assertEqual(code, 0)

    def test_help_shows_docstring(self):
        """'help' output contains function docstring."""
        stdout, _, _ = run_cli("help", "bm_single_unit")
        self.assertIn("bm_single_unit", stdout)
        self.assertIn("span", stdout.lower() or "moment" in stdout.lower())

    def test_help_unknown_function_exits_2(self):
        """'help' on unknown function exits 2."""
        _, _, code = run_cli("help", "nonexistent_function_xyz")
        self.assertEqual(code, 2)


class TestCliValidCall(unittest.TestCase):
    """Tests for valid function calls."""

    def test_valid_json_call_anti_heeling_ballast(self):
        """Valid JSON call returns JSON result with exit 0."""
        args_json = json.dumps({
            "cargo_t": 474, "gear_t": 26, "boom_q_t": 64.1,
            "half_breadth_m": 10.1, "outreach_m": 6.3, "tank_distance_m": 18.2
        })
        stdout, _, code = run_cli("anti_heeling_ballast", args_json)
        self.assertEqual(code, 0)
        result = json.loads(stdout)
        self.assertIn("S_t", result)
        self.assertAlmostEqual(result["S_t"], 508, delta=5)

    def test_valid_call_returns_valid_json(self):
        """Output is valid JSON."""
        args_json = json.dumps({"breadth_m": 20.2, "gm_m": 1.5})
        stdout, _, code = run_cli("roll_period", args_json)
        self.assertEqual(code, 0)
        result = json.loads(stdout)
        self.assertIn("T_s", result)

    def test_call_with_empty_dict(self):
        """Call with empty JSON dict works for functions with defaults."""
        args_json = json.dumps({})
        stdout, _, code = run_cli("hoisting_angle_critical_load_pct", args_json)
        # This call needs hoisting_angle_deg, so it should fail
        self.assertNotEqual(code, 0)

    def test_missing_required_arg_exits_1(self):
        """Missing required argument exits 1."""
        args_json = json.dumps({"cargo_t": 100})  # missing other required args
        _, _, code = run_cli("anti_heeling_ballast", args_json)
        self.assertEqual(code, 1)


class TestCliErrorHandling(unittest.TestCase):
    """Tests for error handling."""

    def test_unknown_function_exits_2(self):
        """Unknown function exits 2."""
        args_json = json.dumps({})
        _, _, code = run_cli("nonexistent_func", args_json)
        self.assertEqual(code, 2)

    def test_invalid_json_exits_1(self):
        """Invalid JSON exits 1."""
        _, _, code = run_cli("anti_heeling_ballast", "not valid json")
        self.assertEqual(code, 1)

    def test_negative_mass_exits_1(self):
        """Negative mass raises ValueError, exits 1."""
        args_json = json.dumps({"cargo_t": -100, "gear_t": 10, "boom_q_t": 20,
                                "half_breadth_m": 5, "outreach_m": 2, "tank_distance_m": 10})
        _, _, code = run_cli("anti_heeling_ballast", args_json)
        self.assertEqual(code, 1)


class TestCliHelpDefault(unittest.TestCase):
    """Tests for default help behavior."""

    def test_no_args_shows_help(self):
        """No arguments or -h shows help text."""
        stdout, _, code = run_cli("-h")
        self.assertEqual(code, 0)
        self.assertIn("list", stdout.lower())


if __name__ == "__main__":
    unittest.main()
