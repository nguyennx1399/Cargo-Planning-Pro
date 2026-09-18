"""Unit tests for stability_calcs module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import stability_calcs
from test_base import CalculatorTestCase


class TestCraneBoomHeelingMass(CalculatorTestCase):
    """Tests for crane_boom_heeling_mass."""

    def test_fixture_56_2_16_5_28_2(self):
        """56.2 t, 16.5 m from pivot, 28.2 m effective length -> 32.9 t."""
        result = stability_calcs.crane_boom_heeling_mass(
            boom_mass_t=56.2, boom_cog_from_pivot_m=16.5, boom_effective_length_m=28.2
        )
        self.assertAlmostEqual(result["Q_t"], 32.9, delta=0.5)


class TestAntiHeelingBallast(CalculatorTestCase):
    """Tests for anti_heeling_ballast."""

    def test_fixture_474_26_64_1_10_1_6_3_18_2(self):
        """474 t, 26 t, 64.1 t, 10.1 m, 6.3 m, 18.2 m -> S≈508 t."""
        result = stability_calcs.anti_heeling_ballast(
            cargo_t=474, gear_t=26, boom_q_t=64.1,
            half_breadth_m=10.1, outreach_m=6.3, tank_distance_m=18.2
        )
        self.assertAlmostEqual(result["S_t"], 508, delta=5.0)

    def test_zero_tank_distance_raises(self):
        """Tank distance = 0 must raise ValueError."""
        with self.assertRaises(ValueError):
            stability_calcs.anti_heeling_ballast(
                cargo_t=100, gear_t=10, boom_q_t=20,
                half_breadth_m=5.0, outreach_m=2.0, tank_distance_m=0
            )


class TestLiftingKgGm(CalculatorTestCase):
    """Tests for lifting_kg_gm."""

    def test_fixture_complex(self):
        """KG_C*≈8.21, GM_C*≈0.94, min check ok."""
        result = stability_calcs.lifting_kg_gm(
            displacement_t=8000, kg_c=5.40, km_lift=9.15,
            cargo_t=474, gear_t=26, boom_q_t=64.1,
            boom_top_p=46.9, boom_sea_q=23.2, gear_sea_r=16.0,
            ballast_s_t=508, ballast_sz=3.5
        )
        self.assertAlmostEqual(result["KG_star_m"], 8.21, delta=0.1)
        self.assertAlmostEqual(result["GM_star_m"], 0.94, delta=0.05)
        self.assertTrue(result["min_0_6"]["ok"])

    def test_gm_below_threshold(self):
        """Case where GM* < 0.6 -> ok False."""
        result = stability_calcs.lifting_kg_gm(
            displacement_t=8000, kg_c=8.5, km_lift=9.0,
            cargo_t=100, gear_t=10, boom_q_t=20,
            boom_top_p=30.0, boom_sea_q=15.0, gear_sea_r=10.0,
            ballast_s_t=0, ballast_sz=0
        )
        self.assertFalse(result["min_0_6"]["ok"])


class TestSwlRadiusInterpolate(CalculatorTestCase):
    """Tests for swl_radius_interpolate."""

    def test_fixture_interpolate_175(self):
        """[[26,100],[20,150],[15,200],[12,250]], load 175 t -> max_radius 17.5 m."""
        result = stability_calcs.swl_radius_interpolate(
            swl_table=[[26, 100], [20, 150], [15, 200], [12, 250]],
            load_t=175
        )
        self.assertAlmostEqual(result["max_radius_m"], 17.5, delta=0.1)

    def test_load_above_max_raises(self):
        """Load exceeding max SWL must raise."""
        with self.assertRaises(ValueError):
            stability_calcs.swl_radius_interpolate(
                swl_table=[[26, 100], [20, 150]],
                load_t=200
            )

    def test_at_smallest_swl(self):
        """Load at smallest tabulated point."""
        result = stability_calcs.swl_radius_interpolate(
            swl_table=[[26, 100], [20, 150]],
            load_t=100
        )
        self.assertEqual(result["max_radius_m"], 26)


class TestHoistingAngleCriticalLoadPct(CalculatorTestCase):
    """Tests for hoisting_angle_critical_load_pct."""

    def test_fixture_1_deg(self):
        """1 deg -> ≈95%."""
        result = stability_calcs.hoisting_angle_critical_load_pct(hoisting_angle_deg=1)
        self.assertAlmostEqual(result["critical_load_pct"], 95, delta=1.0)

    def test_fixture_2_deg(self):
        """2 deg -> ≈90%."""
        result = stability_calcs.hoisting_angle_critical_load_pct(hoisting_angle_deg=2)
        self.assertAlmostEqual(result["critical_load_pct"], 90, delta=1.0)

    def test_fixture_3_deg(self):
        """3 deg -> ≈85%."""
        result = stability_calcs.hoisting_angle_critical_load_pct(hoisting_angle_deg=3)
        self.assertAlmostEqual(result["critical_load_pct"], 85, delta=1.0)

    def test_zero_angle(self):
        """0 deg -> 100%."""
        result = stability_calcs.hoisting_angle_critical_load_pct(hoisting_angle_deg=0)
        self.assertEqual(result["critical_load_pct"], 100.0)


if __name__ == "__main__":
    import unittest
    unittest.main()
