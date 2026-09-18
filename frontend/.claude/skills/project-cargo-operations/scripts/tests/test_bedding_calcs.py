"""Unit tests for bedding_calcs module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bedding_calcs
from test_base import CalculatorTestCase


class TestBmLimPal(CalculatorTestCase):
    """Tests for bm_lim_pal."""

    def test_fixture_3_16_1_6_3(self):
        """3 t/m2, 16.1 m, 6.3 m -> BM_lim 6007 kNm."""
        result = bedding_calcs.bm_lim_pal(pal_t_m2=3, width_m=16.1, length_m=6.3)
        self.assertAlmostEqual(result["BM_lim_kNm"], 6007, delta=10)


class TestBmLimStacks(CalculatorTestCase):
    """Tests for bm_lim_stacks."""

    def test_fixture_7_60_16_1(self):
        """7 stacks, 60 t, 16.1 m -> BM_lim 8292 kNm."""
        result = bedding_calcs.bm_lim_stacks(n_stacks=7, stack_mass_t=60, width_m=16.1)
        self.assertAlmostEqual(result["BM_lim_kNm"], 8292, delta=10)


class TestBmSingleUnit(CalculatorTestCase):
    """Tests for bm_single_unit."""

    def test_fixture_244_16_1_9_6(self):
        """244 t, span 16.1 m, loaded_length 9.6 m -> BM 6762 kNm."""
        result = bedding_calcs.bm_single_unit(mass_t=244, span_m=16.1, loaded_length_m=9.6)
        self.assertAlmostEqual(result["BM_kNm"], 6762, delta=20)

    def test_fixture_with_limit_fails(self):
        """Same unit with bm_lim 6007 kNm -> check ok=False."""
        result = bedding_calcs.bm_single_unit(
            mass_t=244, span_m=16.1, loaded_length_m=9.6, bm_lim_knm=6007
        )
        self.assertFalse(result["check"]["ok"])

    def test_offset_2_8(self):
        """244 t, span 16.1, loaded 9.6, offset 2.8 m -> BM 5944 kNm."""
        result = bedding_calcs.bm_single_unit(
            mass_t=244, span_m=16.1, loaded_length_m=9.6, offset_m=2.8
        )
        self.assertAlmostEqual(result["BM_kNm"], 5944, delta=20)

    def test_bridging_mode(self):
        """Bridging mode: unit rests on ends only."""
        result = bedding_calcs.bm_single_unit(
            mass_t=244, span_m=16.1, loaded_length_m=6.2, mode="bridging"
        )
        self.assertLess(result["BM_kNm"], 6000)


class TestBmMultiUnits(CalculatorTestCase):
    """Tests for bm_multi_units."""

    def test_fixture_16_1_two_units(self):
        """span 16.1 m, 2 units -> F1 2258.4, F2 2018.8, BM≈8221.5 kNm (±1%)."""
        result = bedding_calcs.bm_multi_units(
            span_m=16.1,
            units=[
                {"mass_t": 196, "width_m": 2.8, "centre_m": 2.7},
                {"mass_t": 240, "width_m": 6.0, "centre_m": 11.6}
            ]
        )
        self.assertAlmostEqual(result["F1_kN"], 2258.4, delta=20)
        self.assertAlmostEqual(result["F2_kN"], 2018.8, delta=20)
        self.assertRelEqual(8221.5, result["BM_max_kNm"], tol_pct=1.0)


class TestSectionModulus(CalculatorTestCase):
    """Tests for section_modulus."""

    def test_timber_10(self):
        """Timber 10 cm -> ≈147 cm3."""
        result = bedding_calcs.section_modulus("timber", 10)
        self.assertAlmostEqual(result, 147, delta=3)

    def test_timber_15(self):
        """Timber 15 cm -> ≈519 cm3."""
        result = bedding_calcs.section_modulus("timber", 15)
        self.assertAlmostEqual(result, 519, delta=10)

    def test_timber_20(self):
        """Timber 20 cm -> ≈1236 cm3."""
        result = bedding_calcs.section_modulus("timber", 20)
        self.assertAlmostEqual(result, 1236, delta=20)

    def test_timber_25(self):
        """Timber 25 cm -> ≈2451 cm3."""
        result = bedding_calcs.section_modulus("timber", 25)
        self.assertAlmostEqual(result, 2451, delta=30)

    def test_steel_heb_16(self):
        """Steel HEB 16 -> 311 cm3."""
        result = bedding_calcs.section_modulus("steel", 16)
        self.assertEqual(result, 311)

    def test_steel_heb_26(self):
        """Steel HEB 26 -> 1150 cm3."""
        result = bedding_calcs.section_modulus("steel", 26)
        self.assertEqual(result, 1150)

    def test_invalid_timber_size(self):
        """Invalid timber size raises ValueError."""
        with self.assertRaises(ValueError):
            bedding_calcs.section_modulus("timber", 12)

    def test_invalid_material(self):
        """Invalid material raises ValueError."""
        with self.assertRaises(ValueError):
            bedding_calcs.section_modulus("concrete", 20)


class TestBeamsRequired(CalculatorTestCase):
    """Tests for beams_required."""

    def test_fixture_346_5_0_3_6_steel_26(self):
        """346 t, beam 5.0 m, loaded 3.6 m, steel HEB26 -> n_exact≈3.44, n_required 4."""
        result = bedding_calcs.beams_required(
            mass_t=346, beam_length_m=5.0, loaded_length_m=3.6,
            material="steel", nominal_cm=26
        )
        self.assertRelEqual(3.44, result["n_exact"], tol_pct=1.0)
        self.assertEqual(result["n_required"], 4)

    def test_condition_b_with_offset(self):
        """Condition B, 40 t, 6.2 m, 0.6 m, offset 1.6 m -> n 4.97 -> 5."""
        result = bedding_calcs.beams_required(
            mass_t=40, beam_length_m=6.2, loaded_length_m=0.6,
            material="steel", nominal_cm=20, condition="B", offset_m=1.6
        )
        self.assertAlmostEqual(result["n_exact"], 4.97, delta=0.2)
        self.assertEqual(result["n_required"], 5)


class TestFlaterackFactor(CalculatorTestCase):
    """Tests for flatrack_factor."""

    def test_20ft_s3_e0(self):
        """20' flatrack, s3, e0 -> 0.67."""
        result = bedding_calcs.flatrack_factor(size="20", loaded_length_m=3.0, offset_m=0)
        self.assertAlmostEqual(result["factor"], 0.67, delta=0.05)

    def test_20ft_s1_e2_5(self):
        """20' flatrack, s1, e2.5 -> 1.79."""
        result = bedding_calcs.flatrack_factor(size="20", loaded_length_m=1.0, offset_m=2.5)
        self.assertAlmostEqual(result["factor"], 1.79, delta=0.1)

    def test_40ft_s1_e0(self):
        """40' flatrack, s1, e0 -> 0.52."""
        result = bedding_calcs.flatrack_factor(size="40", loaded_length_m=1.0, offset_m=0)
        self.assertAlmostEqual(result["factor"], 0.52, delta=0.05)

    def test_40ft_s1_e5_5(self):
        """40' flatrack, s1, e5.5 -> 3.27."""
        result = bedding_calcs.flatrack_factor(size="40", loaded_length_m=1.0, offset_m=5.5)
        self.assertAlmostEqual(result["factor"], 3.27, delta=0.15)

    def test_invalid_size(self):
        """Size other than 20/40 raises ValueError."""
        with self.assertRaises(ValueError):
            bedding_calcs.flatrack_factor(size="30", loaded_length_m=1.0)


class TestFlaterackBridgingLoad(CalculatorTestCase):
    """Tests for flatrack_bridging_load."""

    def test_fixture_32_5_85_2_3(self):
        """32 t payload, 5.85 m span, 2.3 m bridged -> P≈26.4 t."""
        result = bedding_calcs.flatrack_bridging_load(
            payload_t=32, castings_span_m=5.85, bridged_length_m=2.3
        )
        self.assertAlmostEqual(result["P_t"], 26.4, delta=0.5)


if __name__ == "__main__":
    import unittest
    unittest.main()
