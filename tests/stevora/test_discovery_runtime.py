"""Execute independent-home discovery with stubbed HA registries."""
import importlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

COMP = Path(__file__).resolve().parents[2] / "custom_components/stevora"


class _AreaRegistry:
    def __init__(self, areas):
        self._areas = areas

    def async_list_areas(self):
        return self._areas


class _Hass:
    def __init__(self, areas, entities, entry_id, panel_registered):
        self.test_areas = [types.SimpleNamespace(id=id, name=name) for id, name in areas]
        self.test_entities = {
            entity_id: types.SimpleNamespace(
                entity_id=entity_id,
                area_id=area_id,
                device_id=None,
                name=entity_id,
                original_name=None,
                disabled_by=None,
                hidden_by=None,
            )
            for entity_id, area_id in entities
        }
        self.data = {"stevora": {
            entry_id: {"panel_registered": panel_registered, "panel_conflict": False}
        }}


class DiscoveryRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        helpers = types.ModuleType("homeassistant.helpers")
        areas = types.ModuleType("homeassistant.helpers.area_registry")
        areas.async_get = lambda hass: _AreaRegistry(hass.test_areas)
        devices = types.ModuleType("homeassistant.helpers.device_registry")
        devices.async_get = lambda hass: types.SimpleNamespace(devices={})
        entities = types.ModuleType("homeassistant.helpers.entity_registry")
        entities.async_get = lambda hass: types.SimpleNamespace(entities=hass.test_entities)
        helpers.area_registry = areas
        helpers.device_registry = devices
        helpers.entity_registry = entities
        package = types.ModuleType("stevora_discovery_testpkg")
        package.__path__ = [str(COMP)]
        cls.patch = patch.dict(sys.modules, {
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.helpers": helpers,
            "homeassistant.helpers.area_registry": areas,
            "homeassistant.helpers.device_registry": devices,
            "homeassistant.helpers.entity_registry": entities,
            package.__name__: package,
        })
        cls.patch.start()
        cls.discovery = importlib.import_module("stevora_discovery_testpkg.discovery")

    @classmethod
    def tearDownClass(cls):
        for name in ("stevora_discovery_testpkg.discovery",
                     "stevora_discovery_testpkg.modules",
                     "stevora_discovery_testpkg.const"):
            sys.modules.pop(name, None)
        cls.patch.stop()

    def test_two_independent_homes_do_not_share_entities(self):
        home_a = _Hass(
            [("living", "Living Room")],
            [("light.living", "living"), ("climate.living", "living")],
            "a", True,
        )
        home_b = _Hass(
            [("kitchen", "Kitchen")],
            [("fan.kitchen", "kitchen")],
            "b", False,
        )
        entry_a = types.SimpleNamespace(entry_id="a", data={
            "language": "bg", "auto_discovery": True, "panel_enabled": True
        }, options={})
        entry_b = types.SimpleNamespace(entry_id="b", data={
            "language": "en", "auto_discovery": True, "panel_enabled": False,
            "voice_enabled": True,
        }, options={})
        manifest_a = self.discovery.build_manifest(home_a, entry_a)
        manifest_b = self.discovery.build_manifest(home_b, entry_b)
        self.assertEqual(manifest_a["installation_id"], "a")
        self.assertEqual(manifest_b["installation_id"], "b")
        self.assertEqual(manifest_a["mappings"], {
            "living": ["climate.living", "light.living"]
        })
        self.assertEqual(manifest_b["mappings"], {"kitchen": ["fan.kitchen"]})
        self.assertEqual(manifest_a["modules"]["home_panel"]["status"], "active")
        self.assertEqual(manifest_b["modules"]["home_panel"]["status"], "disabled")
        self.assertEqual(manifest_b["preferred_language"], "en")
        self.assertFalse(manifest_b["capabilities"]["voice"])
        self.assertEqual(manifest_b["modules"]["hey_stevora"]["status"], "not_included")
        self.assertNotEqual(manifest_a["revision"], manifest_b["revision"])

    def test_room_filter_is_installation_specific(self):
        hass = _Hass(
            [("living", "Living Room"), ("kitchen", "Kitchen")],
            [("light.living", "living"), ("light.kitchen", "kitchen")],
            "only", True,
        )
        entry = types.SimpleNamespace(entry_id="only", data={"panel_enabled": True},
                                          options={"room_filter": ["kitchen"]})
        result = self.discovery.build_manifest(hass, entry)
        self.assertEqual(result["rooms"], [{"id": "kitchen", "name": "Kitchen", "source_name": "Kitchen", "translations": {}}])
        self.assertEqual([x["entity_id"] for x in result["entities"]], ["light.kitchen"])

    def test_unassigned_report_and_opt_in(self):
        hass = _Hass(
            [("living", "Living")],
            [("light.no_area", None), ("light.living", "living")],
            "room-test", True,
        )
        off = types.SimpleNamespace(
            entry_id="room-test", data={"include_unassigned": False}, options={},
        )
        omitted = self.discovery.build_manifest(hass, off)
        self.assertEqual(omitted["discovery_diagnostics"]["counts"]["unassigned"], 1)
        self.assertEqual(len(omitted["entities"]), 1)
        on = types.SimpleNamespace(
            entry_id="room-test", data={"include_unassigned": True}, options={},
        )
        included = self.discovery.build_manifest(hass, on)
        self.assertIn("__stevora_unassigned__", included["mappings"])
        self.assertEqual(
            included["mappings"]["__stevora_unassigned__"], ["light.no_area"],
        )
        self.assertEqual(included["discovery_diagnostics"]["counts"]["unassigned"], 0)



if __name__ == "__main__":
    unittest.main()
