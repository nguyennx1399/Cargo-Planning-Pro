"""Unit tests for securing_equipment_calcs module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import securing_equipment_calcs
from test_base import CalculatorTestCase


class TestMslFromBreakingLoad(CalculatorTestCase):
    """Tests for msl_from_breaking_load."""

    def test_chain_high_tensile_200(self):
        """chain_high_tensile, BL 200 kN -> MSL 100 kN (50%)."""
        result = securing_equipment_calcs.msl_from_breaking_load(
            material="chain_high_tensile", breaking_load_kn=200
        )
        self.assertEqual(result["MSL_kN"], 100)

    def test_timber_100_cm2(self):
        """timber, area 100 cm2 -> MSL 30 kN."""
        result = securing_equipment_calcs.msl_from_breaking_load(
            material="timber", timber_area_cm2=100
        )
        self.assertEqual(result["MSL_kN"], 30)

    def test_wire_rope_single_use(self):
        """wire_rope_single_use, BL 100 kN -> MSL 80 kN (80%)."""
        result = securing_equipment_calcs.msl_from_breaking_load(
            material="wire_rope_single_use", breaking_load_kn=100
        )
        self.assertEqual(result["MSL_kN"], 80)

    def test_fibre_rope(self):
        """fibre_rope, BL 100 kN -> MSL 33 kN (33%)."""
        result = securing_equipment_calcs.msl_from_breaking_load(
            material="fibre_rope", breaking_load_kn=100
        )
        self.assertAlmostEqual(result["MSL_kN"], 33, delta=1)


class TestWireBendResidual(CalculatorTestCase):
    """Tests for wire_bend_residual."""

    def test_bend_2_0_steady(self):
        """Bend ratio 2.0, steady -> 0.77."""
        result = securing_equipment_calcs.wire_bend_residual(bend_ratio=2.0, slipping=False)
        self.assertEqual(result["residual"], 0.77)

    def test_bend_2_0_slipping(self):
        """Bend ratio 2.0, slipping -> 0.65."""
        result = securing_equipment_calcs.wire_bend_residual(bend_ratio=2.0, slipping=True)
        self.assertEqual(result["residual"], 0.65)

    def test_bend_low_clamped(self):
        """Bend ratio 0.3 (below 0.5 table min) -> clamped to 0.50."""
        result = securing_equipment_calcs.wire_bend_residual(bend_ratio=0.3, slipping=False)
        self.assertEqual(result["residual"], 0.50)

    def test_bend_high_clamped(self):
        """Bend ratio 10.0 (above 5.0 table max) -> clamped to 0.99."""
        result = securing_equipment_calcs.wire_bend_residual(bend_ratio=10.0, slipping=False)
        self.assertEqual(result["residual"], 0.99)


class TestWireLashingMsl(CalculatorTestCase):
    """Tests for wire_lashing_msl."""

    def test_fixture_185_parts_2_single_use(self):
        """Wire BL 185 kN, parts=2, bend_residual=0.75, single_use, components [180,157,157,157].
        wire=185*2*0.75*0.8=222 kN; lashing=min(222, 180, 157, 157, 157)=157 kN."""
        result = securing_equipment_calcs.wire_lashing_msl(
            wire_bl_kn=185, parts=2, bend_residual=0.75, single_use=True,
            component_msls_kn=[180, 157, 157, 157]
        )
        self.assertAlmostEqual(result["wire_MSL_kN"], 222, delta=1)
        self.assertEqual(result["lashing_MSL_kN"], 157)
        self.assertEqual(result["governed_by"], "component_2")


class TestFilletSeamMsl(CalculatorTestCase):
    """Tests for fillet_seam_msl."""

    def test_10cm_shear(self):
        """10 cm seam, shear -> 50 kN (5 kN/cm)."""
        result = securing_equipment_calcs.fillet_seam_msl(seam_length_cm=10, load="shear")
        self.assertEqual(result["MSL_kN"], 50)

    def test_10cm_tension(self):
        """10 cm seam, tension -> 60 kN (6 kN/cm)."""
        result = securing_equipment_calcs.fillet_seam_msl(seam_length_cm=10, load="tension")
        self.assertEqual(result["MSL_kN"], 60)


class TestButtSeamMsl(CalculatorTestCase):
    """Tests for butt_seam_msl."""

    def test_10cm_2cm_shear(self):
        """10 cm seam, 2 cm plate, shear -> 174 kN (8.7*10*2)."""
        result = securing_equipment_calcs.butt_seam_msl(
            seam_length_cm=10, plate_thickness_cm=2, load="shear"
        )
        self.assertEqual(result["MSL_kN"], 174)

    def test_10cm_2cm_tension(self):
        """10 cm seam, 2 cm plate, tension -> 240 kN (12*10*2)."""
        result = securing_equipment_calcs.butt_seam_msl(
            seam_length_cm=10, plate_thickness_cm=2, load="tension"
        )
        self.assertEqual(result["MSL_kN"], 240)


class TestPlateStopperMsl(CalculatorTestCase):
    """Tests for plate_stopper_msl."""

    def test_plain_20_2(self):
        """Plain: length 20 cm, thickness 2 cm -> MSLxy 210 kN (5*(2*20+2))."""
        result = securing_equipment_calcs.plate_stopper_msl(length_cm=20, thickness_cm=2)
        self.assertEqual(result["MSLxy_kN"], 210)

    def test_with_clip_18_2_7_8(self):
        """With clip: length 18, thickness 2, clip height 7, lever 8 cm.
        MSLxy = 5*2*(18+2) = 200; MSLz: plate=10.4*7*2=145.6, weld calc -> ≈74 (weld governs)."""
        result = securing_equipment_calcs.plate_stopper_msl(
            length_cm=18, thickness_cm=2, clip_height_cm=7, clip_lever_cm=8
        )
        self.assertEqual(result["MSLxy_kN"], 200)
        self.assertLess(result["MSLz_kN"], 150)


class TestLowHBeamStopperMsl(CalculatorTestCase):
    """Tests for low_h_beam_stopper_msl."""

    def test_upright_14cm(self):
        """Upright with flange 14 cm -> MSL 420 kN (5*6*14)."""
        result = securing_equipment_calcs.low_h_beam_stopper_msl(flange_width_cm=14)
        self.assertEqual(result["MSLxy_kN"], 420)

    def test_flat_50cm(self):
        """Laid flat with length 50 cm -> MSL 500 kN (5*2*50)."""
        result = securing_equipment_calcs.low_h_beam_stopper_msl(flat_length_cm=50)
        self.assertEqual(result["MSLxy_kN"], 500)


class TestHighHBeamStopperMsl(CalculatorTestCase):
    """Tests for high_h_beam_stopper_msl."""

    def test_fixture_308_70_40_20(self):
        """Table 308, base 70, height 40, flange 20.
        Scaled=308*70/40=539; cap=5*2*(70+20)=900; min=539."""
        result = securing_equipment_calcs.high_h_beam_stopper_msl(
            table_msl_kn=308, base_length_cm=70, height_cm=40, flange_width_cm=20
        )
        self.assertEqual(result["MSLxy_kN"], 539)
        self.assertFalse(result["capped"])

    def test_height_exceeds_length_raises(self):
        """Height > base length raises ValueError."""
        with self.assertRaises(ValueError):
            securing_equipment_calcs.high_h_beam_stopper_msl(
                table_msl_kn=300, base_length_cm=50, height_cm=60, flange_width_cm=20
            )


class TestAngleStopperMsl(CalculatorTestCase):
    """Tests for angle_stopper_msl."""

    def test_15cm(self):
        """15 cm angle -> 150 kN (10*15)."""
        result = securing_equipment_calcs.angle_stopper_msl(length_cm=15)
        self.assertEqual(result["MSLxy_kN"], 150)


class TestLashingPlateMsl(CalculatorTestCase):
    """Tests for lashing_plate_msl."""

    def test_15_2(self):
        """Length 15, thickness 2 -> 170 kN (10*(15+2))."""
        result = securing_equipment_calcs.lashing_plate_msl(length_cm=15, thickness_cm=2)
        self.assertEqual(result["MSL_kN"], 170)


if __name__ == "__main__":
    import unittest
    unittest.main()
