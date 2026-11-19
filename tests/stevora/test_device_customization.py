"""Standalone validation tests for portable STEVORA device profiles."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2] / "custom_components/stevora/device_customization.py"
spec = importlib.util.spec_from_file_location("stevora_device_customization_test", ROOT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DeviceCustomizationTests(unittest.TestCase):
    def test_valid_light_profile(self):
        profile = {"name": "Main light", "icon": "mdi:lightbulb", "layout": "compact",
                   "controls": ["toggle", "brightness"], "area_id": "living", "user_ids": []}
        self.assertIsNone(module.validate_profile("light.main", profile, {"living"}))
        self.assertEqual(module.normalize_profile(profile)["name"], "Main light")

    def test_forbid_backlights(self):
        self.assertEqual(module.permitted_controls("light.bedroom_backlight"), [])
        self.assertIsNotNone(module.validate_profile(
            "light.bedroom_backlight", {"controls": ["toggle"]}, {"living"}))

    def test_forbid_unrecognized_capabilities(self):
        self.assertIsNotNone(module.validate_profile(
            "sensor.temperature", {"controls": ["toggle"]}, {"living"}))

    def test_reject_invalid_room(self):
        self.assertIsNotNone(module.validate_profile(
            "light.main", {"area_id": "unknown"}, {"living"}))

    def test_reject_duplicate_controls(self):
        self.assertIsNotNone(module.validate_profile(
            "light.main", {"controls": ["toggle", "toggle"]}, {"living"}))

    def test_reject_unexpected_fields(self):
        self.assertIsNotNone(module.validate_profile(
            "light.main", {"admin": True}, {"living"}))


if __name__ == "__main__":
    unittest.main()
