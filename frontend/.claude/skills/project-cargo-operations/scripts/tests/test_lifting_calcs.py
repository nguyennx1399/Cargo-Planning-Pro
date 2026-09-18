"""Unit tests for lifting_calcs module."""
import sys
import os
import math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import lifting_calcs
from test_base import CalculatorTestCase


class TestNetSlingLength(CalculatorTestCase):
    """Tests for net_sling_length."""

    def test_fixture_4_7_5_3_8_2(self):
        """§1.2.5: x=4.7, y=5.3, z=8.2, E=0.33, D=0.085 -> net 10.47 m."""
        result = lifting_calcs.net_sling_length(x=4.7, y=5.3, z=8.2, shackle_e=0.33, shackle_d=0.085)
        self.assertAlmostEqual(result["net_length_m"], 10.47, delta=0.02)

    def test_fixture_7_9_5_3_8_2(self):
        """x=7.9, y=5.3, z=8.2 -> 12.19 m."""
        result = lifting_calcs.net_sling_length(x=7.9, y=5.3, z=8.2, shackle_e=0.33, shackle_d=0.085)
        self.assertAlmostEqual(result["net_length_m"], 12.19, delta=0.05)

    def test_fixture_4_7_2_6_8_2(self):
        """x=4.7, y=2.6, z=8.2 -> 9.43 m."""
        result = lifting_calcs.net_sling_length(x=4.7, y=2.6, z=8.2, shackle_e=0.33, shackle_d=0.085)
        self.assertAlmostEqual(result["net_length_m"], 9.43, delta=0.05)

    def test_fixture_7_9_2_6_8_2(self):
        """x=7.9, y=2.6, z=8.2 -> 11.31 m."""
        result = lifting_calcs.net_sling_length(x=7.9, y=2.6, z=8.2, shackle_e=0.33, shackle_d=0.085)
        self.assertAlmostEqual(result["net_length_m"], 11.31, delta=0.05)

    def test_zero_z_raises(self):
        """Zero z must raise ValueError."""
        with self.assertRaises(ValueError):
            lifting_calcs.net_sling_length(x=1.0, y=1.0, z=0.0, shackle_e=0.33, shackle_d=0.085)


class TestVirtualCogRise(CalculatorTestCase):
    """Tests for virtual_cog_rise."""

    def test_fixture_main(self):
        """v=4.3, s=14.9, z=4.7, phi=63, gamma=-6, mT=40, mC=164: c≈1.06, r≈15.87, stable False."""
        result = lifting_calcs.virtual_cog_rise(
            v=4.3, s=14.9, z=4.7, phi_deg=63, gamma_deg=-6, spreader_mass_t=40, cargo_mass_t=164
        )
        self.assertRelEqual(1.06, result["c"], tol_pct=1.0)
        self.assertRelEqual(15.87, result["r_m"], tol_pct=1.0)
        self.assertFalse(result["stable"])

    def test_gamma_zero_mass_t_zero(self):
        """gamma=0, mT=0 -> r == s."""
        result = lifting_calcs.virtual_cog_rise(
            v=10.0, s=14.9, z=5.0, phi_deg=45, gamma_deg=0, spreader_mass_t=0, cargo_mass_t=100
        )
        self.assertAlmostEqual(result["r_m"], 14.9, delta=0.1)

    def test_gamma_90_raises(self):
        """gamma >= 90 must raise ValueError."""
        with self.assertRaises(ValueError):
            lifting_calcs.virtual_cog_rise(
                v=4.3, s=14.9, z=4.7, phi_deg=63, gamma_deg=90, spreader_mass_t=40, cargo_mass_t=164
            )


class TestHangingForces2pt(CalculatorTestCase):
    """Tests for hanging_forces_2pt."""

    def test_fixture_1226_3_8_4_5_2(self):
        """1226.3 kN, e1=8.4, e2=5.2 -> H1≈468.9, H2≈757.4."""
        result = lifting_calcs.hanging_forces_2pt(weight_kn=1226.3, e1=8.4, e2=5.2)
        self.assertAlmostEqual(result["H1_kN"], 468.9, delta=1.0)
        self.assertAlmostEqual(result["H2_kN"], 757.4, delta=1.0)

    def test_zero_span_raises(self):
        """e1 + e2 = 0 must raise ValueError."""
        with self.assertRaises(ValueError):
            lifting_calcs.hanging_forces_2pt(weight_kn=1000, e1=0, e2=0)


class TestHangingForces3pt(CalculatorTestCase):
    """Tests for hanging_forces_3pt."""

    def test_fixture_981(self):
        """981 kN, e_a=5.7, e_b=2.9, e_c=3.5, e_bc=2.2 -> 273.2/387.1/320.7."""
        result = lifting_calcs.hanging_forces_3pt(
            weight_kn=981, e_a=5.7, e_b=2.9, e_c=3.5, e_bc=2.2
        )
        self.assertAlmostEqual(result["HA_kN"], 273.2, delta=1.0)
        self.assertAlmostEqual(result["HB_kN"], 387.1, delta=1.0)
        self.assertAlmostEqual(result["HC_kN"], 320.7, delta=1.0)


class TestHangingForces4pt(CalculatorTestCase):
    """Tests for hanging_forces_4pt."""

    def test_fixture_1177_2(self):
        """1177.2 kN, x1=4.7, x2=7.9, e=0.8, y1=5.3, y2=2.6 -> 240.0/489.2/300.6/147.4."""
        result = lifting_calcs.hanging_forces_4pt(
            weight_kn=1177.2, x1=4.7, x2=7.9, e=0.8, y1=5.3, y2=2.6
        )
        self.assertAlmostEqual(result["H1_kN"], 240.0, delta=1.0)
        self.assertAlmostEqual(result["H2_kN"], 489.2, delta=1.0)
        self.assertAlmostEqual(result["H3_kN"], 300.6, delta=1.0)
        self.assertAlmostEqual(result["H4_kN"], 147.4, delta=1.0)
        self.assertAlmostEqual(result["sum_kN"], 1177.2, delta=0.5)


class TestEffectiveSlingForce(CalculatorTestCase):
    """Tests for effective_sling_force."""

    def test_exact_240_29_8_32_9(self):
        """exact: 240 kN, alpha=29.8, beta=32.9 -> 317.2 kN."""
        result = lifting_calcs.effective_sling_force(
            hanging_kn=240, alpha_deg=29.8, beta_deg=32.9, method="exact"
        )
        self.assertAlmostEqual(result["force_kN"], 317.2, delta=1.0)

    def test_approx_240_29_8_32_9(self):
        """approx: 240 kN, alpha=29.8, beta=32.9 -> 329.4 kN."""
        result = lifting_calcs.effective_sling_force(
            hanging_kn=240, alpha_deg=29.8, beta_deg=32.9, method="approx"
        )
        self.assertAlmostEqual(result["force_kN"], 329.4, delta=1.0)

    def test_approx_greater_or_equal_exact(self):
        """approx method is always >= exact."""
        exact = lifting_calcs.effective_sling_force(
            hanging_kn=240, alpha_deg=29.8, beta_deg=32.9, method="exact"
        )["force_kN"]
        approx = lifting_calcs.effective_sling_force(
            hanging_kn=240, alpha_deg=29.8, beta_deg=32.9, method="approx"
        )["force_kN"]
        self.assertGreaterEqual(approx, exact)


class TestSpreaderSupportWireForce(CalculatorTestCase):
    """Tests for spreader_support_wire_force."""

    def test_fixture_598_4_40_2(self):
        """598.4 kN, gamma=40, spreader=2 t -> 195.5 kN.
        Note: source example says 192.8 (~1.5% discrepancy), but printed formula gives 195.5."""
        result = lifting_calcs.spreader_support_wire_force(
            hanging_kn=598.4, gamma_deg=40, spreader_mass_t=2
        )
        self.assertAlmostEqual(result["force_kN"], 195.5, delta=1.0)


class TestSafetyFactor(CalculatorTestCase):
    """Tests for safety_factor."""

    def test_wire_ratio(self):
        """Wire rope typical: BL/WLL ≈ 4-5."""
        result = lifting_calcs.safety_factor(breaking_load=100, wll=20)
        self.assertEqual(result["safety_factor"], 5.0)

    def test_synthetic_ratio(self):
        """Synthetic fibre typical: BL/WLL ≈ 7.1."""
        result = lifting_calcs.safety_factor(breaking_load=71, wll=10)
        self.assertAlmostEqual(result["safety_factor"], 7.1, places=1)


if __name__ == "__main__":
    import unittest
    unittest.main()
