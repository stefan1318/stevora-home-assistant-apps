"""Per-home module catalog tests: future products must never appear installed."""
import importlib
from pathlib import Path
import sys
import types
import unittest

COMP = Path(__file__).resolve().parents[2] / "custom_components/stevora"


class ModuleCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pkg = types.ModuleType("stevora_modules_testpkg")
        pkg.__path__ = [str(COMP)]
        sys.modules[pkg.__name__] = pkg
        cls.modules = importlib.import_module(f"{pkg.__name__}.modules")

    def make_entry(self, home="home-a", **options):
        return types.SimpleNamespace(entry_id=home, data={}, options=options)

    def test_clean_install_contains_only_core_and_optional_panel(self):
        hass = types.SimpleNamespace(data={"stevora": {
            "home-a": {"panel_registered": True, "panel_conflict": False}
        }})
        catalog = self.modules.describe_modules(hass, self.make_entry())
        self.assertEqual(catalog["core"]["status"], "active")
        self.assertEqual(catalog["home_panel"]["status"], "active")
        self.assertTrue(catalog["home_hub"]["bundled"])
        self.assertTrue(catalog["home_hub"]["enabled"])
        self.assertEqual(catalog["home_hub"]["status"], "pending")
        for product in ("hey_stevora", "memory_sync"):
            self.assertFalse(catalog[product]["bundled"])
            self.assertFalse(catalog[product]["enabled"])
            self.assertEqual(catalog[product]["status"], "not_included")

    def test_hub_can_be_disabled_or_running(self):
        home = self.make_entry(home_hub_enabled=False)
        hass = types.SimpleNamespace(data={"stevora": {"home-a": {"panel_registered": True}}})
        inactive = self.modules.describe_modules(hass, home)
        self.assertEqual(inactive["home_hub"]["status"], "disabled")
        self.assertFalse(inactive["home_hub"]["enabled"])
        hass.data["stevora"]["home-a"]["hub"] = types.SimpleNamespace(active=True)
        active = self.modules.describe_modules(hass, self.make_entry())
        self.assertEqual(active["home_hub"]["status"], "active")
        self.assertTrue(active["home_hub"]["bundled"])

    def test_panel_opt_out(self):
        hass = types.SimpleNamespace(data={"stevora": {"home-a": {
            "panel_registered": False, "panel_conflict": False
        }}})
        catalog = self.modules.describe_modules(hass, self.make_entry(panel_enabled=False))
        self.assertFalse(catalog["home_panel"]["enabled"])
        self.assertEqual(catalog["home_panel"]["status"], "disabled")

    def test_foreign_panel_collision_is_visible_to_admin(self):
        hass = types.SimpleNamespace(data={"stevora": {"home-a": {
            "panel_registered": False, "panel_conflict": True
        }}})
        catalog = self.modules.describe_modules(hass, self.make_entry())
        self.assertEqual(catalog["home_panel"]["status"], "conflict")

    def test_distinct_homes_are_isolated(self):
        hass = types.SimpleNamespace(data={"stevora": {
            "home-a": {"panel_registered": True},
            "home-b": {"panel_registered": False, "panel_conflict": True},
        }})
        a = self.modules.describe_modules(hass, self.make_entry("home-a"))
        b = self.modules.describe_modules(hass, self.make_entry("home-b"))
        self.assertEqual(a["home_panel"]["status"], "active")
        self.assertEqual(b["home_panel"]["status"], "conflict")
        self.assertNotEqual(a, b)


if __name__ == "__main__":
    unittest.main()
