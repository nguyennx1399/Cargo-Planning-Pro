"""Regression tests for code-review findings: invalid inputs must raise, never return a false "OK"."""
import os
import subprocess
import sys
import unittest

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, SCRIPTS)

import bedding_calcs  # noqa: E402
import lifting_calcs  # noqa: E402
import securing_balance_calcs  # noqa: E402
import securing_equipment_calcs  # noqa: E402
import stability_calcs  # noqa: E402


class TestReviewRegressions(unittest.TestCase):
    def test_crossing_secondary_slings_raise_instead_of_stable(self):
        # gamma -29.8 made v*tan(phi) + s*tan(gamma) ~ 0 and returned r = -423 m, "stable".
        for gamma in (-29.8, -35):
            with self.assertRaises(ValueError):
                lifting_calcs.virtual_cog_rise(4.3, 14.9, 4.7, 63, gamma, 40, 164)

    def test_zero_primary_angle_raises(self):
        with self.assertRaises(ValueError):
            lifting_calcs.virtual_cog_rise(4.3, 14.9, 4.7, 0, -6, 40, 164)

    def test_cog_outside_lifting_points_raises(self):
        with self.assertRaises(ValueError):
            lifting_calcs.hanging_forces_3pt(981, -1, 2.9, 3.5, 3)
        with self.assertRaises(ValueError):
            lifting_calcs.hanging_forces_4pt(1177.2, -4.7, 7.9, 0.8, 5.3, 2.6)

    def test_condition_b_load_beyond_support_raises(self):
        with self.assertRaises(ValueError):
            bedding_calcs.beams_required(40, 6.2, 0.6, "steel", 20, condition="B", offset_m=2.95)

    def test_untabulated_beam_length_is_flagged(self):
        result = bedding_calcs.beams_required(100, 9.0, 3.6, "steel", 20)
        self.assertIsInstance(result["length_check"], str)

    def test_non_positive_section_or_stress_raises(self):
        with self.assertRaises(ValueError):
            bedding_calcs.beams_required(40, 6.2, 0.6, "steel", wx_cm3=-570)
        with self.assertRaises(ValueError):
            bedding_calcs.beams_required(40, 6.2, 0.6, "steel", 20, stress_kn_cm2=0)

    def test_tipping_rejects_negative_fz_moment_and_bad_method(self):
        base = dict(force_kn=799, lever_a_m=15, lever_b_m=11.8, mass_t=130, sum_cs_c_knm=13320,
                    direction="longitudinal")
        with self.assertRaises(ValueError):
            securing_balance_calcs.tipping_balance(**base, fz_kn=-790)
        with self.assertRaises(ValueError):
            securing_balance_calcs.tipping_balance(**base, fz_kn=790, additional_moment_knm=-6871)
        with self.assertRaises(ValueError):
            securing_balance_calcs.tipping_balance(**base, fz_kn=790, method="Alternative")

    def test_negative_hoisting_angle_is_symmetric(self):
        neg = stability_calcs.hoisting_angle_critical_load_pct(-2)["critical_load_pct"]
        pos = stability_calcs.hoisting_angle_critical_load_pct(2)["critical_load_pct"]
        self.assertEqual(neg, pos)

    def test_ballast_rounded_up(self):
        s = stability_calcs.anti_heeling_ballast(474, 26, 64.1, 10.1, 6.3, 18.2)["S_t"]
        self.assertGreaterEqual(s, (474 + 26 + 64.1) * 16.4 / 18.2)

    def test_nan_and_unknown_load_rejected(self):
        with self.assertRaises(ValueError):
            securing_equipment_calcs.fillet_seam_msl(float("nan"))
        with self.assertRaises(ValueError):
            securing_equipment_calcs.fillet_seam_msl(20, load="bending")

    def test_flatrack_accepts_numeric_size(self):
        self.assertAlmostEqual(bedding_calcs.flatrack_factor(20.0, 3)["factor"], 0.667, places=3)

    def test_cli_arithmetic_error_is_json_not_traceback(self):
        out = subprocess.run([sys.executable, os.path.join(SCRIPTS, "cli.py"), "polar_radius", '{"shape":"x"}'],
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 1)
        self.assertIn('"error"', out.stderr)
        self.assertNotIn("Traceback", out.stderr)

    def test_cli_bare_help_exits_0(self):
        out = subprocess.run([sys.executable, os.path.join(SCRIPTS, "cli.py"), "help"],
                             capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)


if __name__ == "__main__":
    unittest.main()
