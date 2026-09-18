"""Unit tests for securing_balance_calcs module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import securing_balance_calcs
from test_base import CalculatorTestCase


class TestCalculatedStrength(CalculatorTestCase):
    """Tests for calculated_strength."""

    def test_advanced_150(self):
        """Advanced: MSL 150 kN -> CS 100 kN (divide by 1.5)."""
        result = securing_balance_calcs.calculated_strength(msl_kn=150, method="advanced")
        self.assertEqual(result["CS_kN"], 100)

    def test_alternative_150(self):
        """Alternative: MSL 150 kN -> CS 111 kN (divide by 1.35)."""
        result = securing_balance_calcs.calculated_strength(msl_kn=150, method="alternative")
        self.assertAlmostEqual(result["CS_kN"], 111, delta=1)


class TestFAdvanced(CalculatorTestCase):
    """Tests for f_advanced."""

    def test_fixture_0_deg(self):
        """alpha=0 -> f≈1.0."""
        result = securing_balance_calcs.f_advanced(alpha_deg=0)
        self.assertAlmostEqual(result["f"], 1.0, places=2)

    def test_fixture_30_deg(self):
        """alpha=30 -> counts_for_sliding=True."""
        result = securing_balance_calcs.f_advanced(alpha_deg=30)
        self.assertTrue(result["counts_for_sliding"])

    def test_fixture_70_deg(self):
        """alpha=70 (>60) -> counts_for_sliding=False."""
        result = securing_balance_calcs.f_advanced(alpha_deg=70)
        self.assertFalse(result["counts_for_sliding"])


class TestFAlternative(CalculatorTestCase):
    """Tests for f_alternative."""

    def test_fixture_50_30(self):
        """alpha=50, beta=30 -> fy≈0.79, fx≈0.55."""
        result = securing_balance_calcs.f_alternative(alpha_deg=50, beta_deg=30)
        self.assertAlmostEqual(result["fy"], 0.79, delta=0.05)
        self.assertAlmostEqual(result["fx"], 0.55, delta=0.05)

    def test_fixture_30_30(self):
        """alpha=30, beta=30 -> fy/fx≈0.90/0.58."""
        result = securing_balance_calcs.f_alternative(alpha_deg=30, beta_deg=30)
        self.assertAlmostEqual(result["fy"], 0.90, delta=0.05)
        self.assertAlmostEqual(result["fx"], 0.58, delta=0.05)

    def test_fixture_50_60(self):
        """alpha=50, beta=60 -> fy/fx≈0.55/0.79."""
        result = securing_balance_calcs.f_alternative(alpha_deg=50, beta_deg=60)
        self.assertAlmostEqual(result["fy"], 0.55, delta=0.05)
        self.assertAlmostEqual(result["fx"], 0.79, delta=0.05)


class TestSlidingBalance(CalculatorTestCase):
    """Tests for sliding_balance."""

    def test_basic_transverse(self):
        """Transverse sliding: Fy <= mu*m*g + sum(CS*f)."""
        result = securing_balance_calcs.sliding_balance(
            force_kn=130, mass_t=20, sum_cs_f_kn=200, friction=0.3
        )
        self.assertTrue(result["ok"])

    def test_basic_longitudinal(self):
        """Longitudinal with vertical force Fz."""
        result = securing_balance_calcs.sliding_balance(
            force_kn=100, mass_t=20, sum_cs_f_kn=150,
            direction="longitudinal", fz_kn=50, friction=0.3
        )
        self.assertTrue(result["ok"])

    def test_fails_without_lashing(self):
        """Sliding fails without lashing."""
        result = securing_balance_calcs.sliding_balance(
            force_kn=100, mass_t=10, sum_cs_f_kn=0, friction=0.3
        )
        self.assertFalse(result["ok"])


class TestTippingBalance(CalculatorTestCase):
    """Tests for tipping_balance."""

    def test_fixture_rtg_case_1(self):
        """RTG transverse: 1219 kN, lever_a 15 m, lever_b 5.6 m, mass 130 t, sum_cs_c 14400, M_add 1560.
        resisting ≈ 21542, ok."""
        result = securing_balance_calcs.tipping_balance(
            force_kn=1219, lever_a_m=15, lever_b_m=5.6, mass_t=130,
            sum_cs_c_knm=14400, additional_moment_knm=1560
        )
        self.assertAlmostEqual(result["resisting_kNm"], 21542, delta=100)
        self.assertTrue(result["ok"])

    def test_fixture_rtg_longitudinal(self):
        """RTG longitudinal: 799 kN, lever_a 15, lever_b 11.8, mass 130, sum_cs_c 13320, fz 790, M_add 6871.
        resisting ≈ 19047, ok."""
        result = securing_balance_calcs.tipping_balance(
            force_kn=799, lever_a_m=15, lever_b_m=11.8, mass_t=130,
            sum_cs_c_knm=13320, direction="longitudinal", fz_kn=790,
            additional_moment_knm=6871
        )
        self.assertAlmostEqual(result["resisting_kNm"], 19047, delta=100)
        self.assertTrue(result["ok"])


class TestRuleOfThumb(CalculatorTestCase):
    """Tests for rule_of_thumb."""

    def test_applicable_20t(self):
        """20 t unit -> applicable, check if sum(MSL) >= weight."""
        result = securing_balance_calcs.rule_of_thumb(mass_t=20, msl_sum_per_side_kn=200)
        self.assertTrue(result["applicable"])
        self.assertTrue(result["ok"])

    def test_not_applicable_35t(self):
        """35 t unit -> not applicable (>30 t max)."""
        result = securing_balance_calcs.rule_of_thumb(mass_t=35, msl_sum_per_side_kn=300)
        self.assertFalse(result["applicable"])


class TestRollPeriod(CalculatorTestCase):
    """Tests for roll_period."""

    def test_fixture_20_2_1_5(self):
        """Breadth 20.2 m, GM 1.5 m -> T≈12.9 s."""
        result = securing_balance_calcs.roll_period(breadth_m=20.2, gm_m=1.5)
        self.assertAlmostEqual(result["T_s"], 12.9, delta=0.3)


class TestPitchPeriod(CalculatorTestCase):
    """Tests for pitch_period."""

    def test_fixture_113_5(self):
        """Lpp 113.5 m -> T≈5.3 s."""
        result = securing_balance_calcs.pitch_period(lpp_m=113.5)
        self.assertAlmostEqual(result["T_s"], 5.3, delta=0.1)


class TestAngularAcceleration(CalculatorTestCase):
    """Tests for angular_acceleration (via additional_tipping_moment)."""

    def test_from_breadth_gm(self):
        """Transverse, source RTG case: B 20.2 m, GM 1.5 m -> T≈12.9 s, c≈0.12 (source table, ±5%)."""
        result = securing_balance_calcs.additional_tipping_moment(
            mass_t=130, ip_m=10.0, breadth_m=20.2, gm_m=1.5, plane="transverse"
        )
        self.assertAlmostEqual(result["c_per_s2"], 0.12, delta=0.006)
        # Source rounds c to 0.12 -> 1560 kN m; the unrounded c gives ~1625 kN m (+4%).
        self.assertAlmostEqual(result["M_add_kNm"], 1560, delta=0.05 * 1560)

    def test_from_lpp(self):
        """Longitudinal: Lpp 113.5 m -> c≈0.29 (±3%)."""
        result = securing_balance_calcs.additional_tipping_moment(
            mass_t=100, ip_m=5.0, lpp_m=113.5, plane="longitudinal"
        )
        self.assertAlmostEqual(result["c_per_s2"], 0.29, delta=0.009)

    def test_from_lpp_fixture_10_130_13_5(self):
        """M_add from angular_accel_per_s2=0.29 (from Lpp 113.5): 130 t, ip 13.5 -> M_add ≈6871."""
        result = securing_balance_calcs.additional_tipping_moment(
            mass_t=130, ip_m=13.5, angular_accel_per_s2=0.29
        )
        self.assertAlmostEqual(result["M_add_kNm"], 6871, delta=50)


class TestPolarRadius(CalculatorTestCase):
    """Tests for polar_radius."""

    def test_solid_box_12_25(self):
        """solid_box: width 12, height 25 -> ip≈8.0 m."""
        result = securing_balance_calcs.polar_radius("solid_box", width_m=12, height_m=25)
        self.assertAlmostEqual(result["ip_m"], 8.0, delta=0.1)

    def test_hollow_box_12_25(self):
        """hollow_box: width 12, height 25 -> ip≈10.7 m."""
        result = securing_balance_calcs.polar_radius("hollow_box", width_m=12, height_m=25)
        self.assertAlmostEqual(result["ip_m"], 10.7, delta=0.1)

    def test_solid_cylinder_4(self):
        """solid_cylinder: d=4 -> ip≈1.414 m."""
        result = securing_balance_calcs.polar_radius("solid_cylinder", diameter_m=4)
        self.assertAlmostEqual(result["ip_m"], 1.414, delta=0.05)

    def test_hollow_cylinder_4(self):
        """hollow_cylinder: d=4 -> ip=2.0 m."""
        result = securing_balance_calcs.polar_radius("hollow_cylinder", diameter_m=4)
        self.assertEqual(result["ip_m"], 2.0)

    def test_invalid_shape(self):
        """Invalid shape raises ValueError."""
        with self.assertRaises(ValueError):
            securing_balance_calcs.polar_radius("pyramid", width_m=10)


if __name__ == "__main__":
    import unittest
    unittest.main()
