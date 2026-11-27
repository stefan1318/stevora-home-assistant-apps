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

    def test_adaptive_inventory_preserves_legacy_and_backlight_policy(self):
        hass = _Hass([("room", "Room")], [
            ("valve.water", None), ("light.mirror", "room"),
            ("switch.led", "room"), ("sensor.diagnostic", "room"),
        ], "test", True)
        hass.test_entities["light.mirror"].original_name = "Mirror backlight"
        hass.test_entities["sensor.diagnostic"].entity_category = "diagnostic"
        extra = types.SimpleNamespace(entity_id="vacuum.extra", name="Extra")
        indicator = types.SimpleNamespace(name="Switch backlight")
        hass.states = types.SimpleNamespace(async_all=lambda: [extra],
                                            get=lambda key: indicator if key == "switch.led" else None)
        entry = types.SimpleNamespace(entry_id="test", data={}, options={})
        legacy = self.discovery.build_manifest(hass, entry)["entities"]
        self.assertEqual([entity["entity_id"] for entity in legacy], ["switch.led"])
        adaptive = self.discovery.build_manifest(hass, entry, adaptive=True)
        self.assertEqual([entity["entity_id"] for entity in adaptive["entities"]],
                         ["sensor.diagnostic", "vacuum.extra", "valve.water"])

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

    def test_visual_lighting_category_and_real_feature_catalog(self):
        hass = _Hass(
            [("living", "Living Room")],
            [("switch.table_lamp", "living"), ("light.rgb", "living"),
             ("fan.basic", "living")],
            "visual", True,
        )
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {}, "room_aliases": {}, "room_order": [],
            "entity_aliases": {}, "translations": {},
            "device_profiles": {
                "switch.table_lamp": {"display_category": "lighting"},
            },
        })
        live = {
            "switch.table_lamp": types.SimpleNamespace(attributes={"supported_features": 0}),
            "light.rgb": types.SimpleNamespace(attributes={
                "supported_features": 4,
                "supported_color_modes": ["rgb", "color_temp"],
                "effect_list": ["Rainbow"],
            }),
            "fan.basic": types.SimpleNamespace(attributes={"supported_features": 0}),
        }
        hass.states = types.SimpleNamespace(get=lambda entity_id: live.get(entity_id))
        entry = types.SimpleNamespace(entry_id="visual", data={
            "language": "bg", "auto_discovery": True,
        }, options={})
        result = self.discovery.build_manifest(hass, entry)
        self.assertEqual(
            sorted(result["domain_mappings"]["lighting"]),
            ["light.rgb", "switch.table_lamp"],
        )
        entities = {x["entity_id"]:x for x in result["entities"]}
        self.assertEqual(entities["switch.table_lamp"]["domain"], "switch")
        self.assertEqual(entities["switch.table_lamp"]["display_category"], "lighting")
        self.assertEqual(entities["switch.table_lamp"]["available_controls"], ["toggle"])
        self.assertEqual(entities["fan.basic"]["available_controls"], ["toggle"])
        self.assertEqual(
            entities["light.rgb"]["available_controls"],
            ["brightness", "color", "color_temp", "effect", "toggle"],
        )
        result_again = self.discovery.build_manifest(hass, entry)
        self.assertEqual(result["revision"], result_again["revision"])

    def test_native_feature_bits_gate_fan_and_climate(self):
        cap = self.discovery.available_controls
        fan = types.SimpleNamespace(attributes={"supported_features": 1 | 2 | 8,
                "percentage": 50, "preset_modes": ["auto"]})
        climate = types.SimpleNamespace(attributes={"supported_features": 1 | 8 | 32,
                "temperature": 22, "hvac_modes": ["heat","cool","off"],
                "fan_modes": ["auto","high"], "swing_modes": ["on","off"]})
        self.assertEqual(cap("fan.living",fan), ["oscillate","percentage","preset_mode","toggle"])
        self.assertEqual(cap("climate.living",climate),
                         ["fan_mode","hvac_mode","swing_mode","temperature"])
        self.assertEqual(cap("light.ambient",source_name="Mirror back-light"), [])

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

    def test_classified_switch_without_area_is_in_lighting(self):
        home = _Hass([("living", "Living")],
                     [("switch.unassigned_lamp", None)], "classified", True)
        home.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {}, "room_aliases": {}, "room_order": [],
            "entity_aliases": {}, "translations": {},
            "device_profiles": {"switch.unassigned_lamp": {
                "display_category": "lighting", "layout": "compact",
            }},
        })
        entry = types.SimpleNamespace(entry_id="classified", data={
            "auto_discovery": True, "include_unassigned": False,
            "lighting_entities": [],
        }, options={})
        result = self.discovery.build_manifest(home, entry)
        self.assertEqual(result["domain_mappings"]["lighting"],
                         ["switch.unassigned_lamp"])
        self.assertIn("__stevora_unassigned__", result["mappings"])
        self.assertEqual(result["entities"][0]["domain"], "switch")
        self.assertEqual(result["entities"][0]["display_category"], "lighting")

    def test_classified_switch_cannot_bypass_room_filter_or_visibility(self):
        home = _Hass([("living", "Living"), ("kitchen", "Kitchen")],
                     [("switch.lamp", None)], "limited", True)
        home.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {}, "room_aliases": {}, "room_order": [],
            "entity_aliases": {}, "translations": {},
            "device_profiles": {"switch.lamp": {
                "display_category": "lighting",
            }},
        })
        entry = types.SimpleNamespace(entry_id="limited", data={
            "room_filter": ["kitchen"], "include_unassigned": False,
        }, options={})
        filtered = self.discovery.build_manifest(home, entry)
        self.assertEqual(filtered["entities"], [])
        reasons = {item["entity_id"]: item["reason"]
                   for item in filtered["discovery_diagnostics"]["entities"]}
        self.assertEqual(reasons["switch.lamp"], "unassigned")
        home.data["stevora"]["_admin_managers"].data["device_profiles"]["switch.lamp"]["area_id"] = "kitchen"
        allowed = self.discovery.build_manifest(home, entry)
        self.assertEqual(allowed["domain_mappings"]["lighting"], ["switch.lamp"])
        home.data["stevora"]["_admin_managers"].data["visibility"]["switch.lamp"] = "exclude"
        hidden = self.discovery.build_manifest(home, entry)
        self.assertFalse(hidden["entities"])
        reasons = {item["entity_id"]: item["reason"]
                   for item in hidden["discovery_diagnostics"]["entities"]}
        self.assertEqual(reasons["switch.lamp"], "explicitly_excluded")

    def test_explicit_include_unassigned_and_diagnostics(self):
        hass = _Hass(
            [("living", "Living")],
            [("sensor.no_area", None), ("light.living", "living"),
             ("sensor.disabled", None), ("sensor.hidden", None)],
            "include-test", True,
        )
        hass.test_entities["sensor.disabled"].disabled_by = "integration"
        hass.test_entities["sensor.hidden"].hidden_by = "user"
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {"sensor.no_area": "include",
                           "sensor.disabled": "include",
                           "sensor.hidden": "include"},
            "room_aliases": {}, "room_order": [], "entity_aliases": {},
            "device_profiles": {}, "translations": {},
        })
        entry = types.SimpleNamespace(entry_id="include-test",
                                      data={"include_unassigned": False}, options={})
        result = self.discovery.build_manifest(hass, entry)
        self.assertEqual(result["mappings"]["__stevora_unassigned__"], ["sensor.no_area"])
        reasons = {x["entity_id"]: x["reason"]
                   for x in result["discovery_diagnostics"]["entities"]}
        self.assertEqual(reasons["sensor.no_area"], "included")
        self.assertEqual(reasons["sensor.disabled"], "disabled")
        self.assertEqual(reasons["sensor.hidden"], "hidden")
        self.assertEqual(result["discovery_diagnostics"]["counts"]["included"], 2)



    def test_manual_and_selected_devices_when_auto_discovery_disabled(self):
        hass = _Hass(
            [("living", "Living Room")],
            [("light.selected", "living"), ("fan.manual", "living"),
             ("climate.profiled", "living"), ("switch.ignored", "living")],
            "manual", True,
        )
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {"fan.manual": "include"},
            "room_aliases": {}, "room_order": [], "entity_aliases": {},
            "device_profiles": {"climate.profiled": {"name": "Aircon"}},
            "translations": {},
        })
        entry = types.SimpleNamespace(entry_id="manual", data={
            "auto_discovery": False, "lighting_entities": ["light.selected"],
        }, options={})
        manifest = self.discovery.build_manifest(hass, entry)
        self.assertEqual(
            [item["entity_id"] for item in manifest["entities"]],
            ["climate.profiled", "fan.manual", "light.selected"],
        )
        self.assertEqual(
            manifest["discovery_diagnostics"]["counts"]["auto_discovery_disabled"], 1,
        )

    def test_diagnostics_default_excluded_and_explicitly_included(self):
        hass = _Hass([("bath", "Bathroom")], [
            ("sensor.air", "bath"), ("sensor.diagnostic", "bath")
        ], "categories", True)
        hass.test_entities["sensor.diagnostic"].entity_category = "diagnostic"
        entry = types.SimpleNamespace(entry_id="categories", data={}, options={})
        original = self.discovery.build_manifest(hass, entry)
        self.assertEqual([item["entity_id"] for item in original["entities"]], ["sensor.air"])
        self.assertEqual(original["discovery_diagnostics"]["counts"]["categorized"], 1)
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {"sensor.diagnostic": "include"},
            "room_aliases": {}, "room_order": [], "entity_aliases": {},
            "device_profiles": {}, "translations": {},
        })
        overridden = self.discovery.build_manifest(hass, entry)
        self.assertEqual(len(overridden["entities"]), 2)

    def test_backlight_rename_cannot_override_safety(self):
        hass = _Hass([("bath", "Bathroom")], [
            ("light.vanity", "bath"), ("light.mirror", "bath")
        ], "backlight", True)
        hass.test_entities["light.mirror"].original_name = "Mirror Back Light"
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {"light.mirror": "include"},
            "room_aliases": {}, "room_order": [], "entity_aliases": {},
            "device_profiles": {"light.mirror": {"name": "Mirror"}},
            "translations": {},
        })
        entry = types.SimpleNamespace(entry_id="backlight", data={}, options={})
        manifest = self.discovery.build_manifest(hass, entry)
        self.assertEqual([item["entity_id"] for item in manifest["entities"]], ["light.vanity"])
        self.assertEqual(manifest["discovery_diagnostics"]["counts"]["backlight"], 1)

    def test_revision_changes_when_original_ha_name_changes(self):
        hass = _Hass([("bath", "Bathroom")], [("fan.bath", "bath")],
                     "rename", True)
        entry = types.SimpleNamespace(entry_id="rename", data={}, options={})
        before = self.discovery.build_manifest(hass, entry)
        hass.test_entities["fan.bath"].name = "Exhaust Fan"
        after = self.discovery.build_manifest(hass, entry)
        self.assertNotEqual(before["revision"], after["revision"])

    def test_manual_room_override_survives_without_automatic_discovery(self):
        hass = _Hass([("bath", "Bathroom")], [("fan.unassigned", None)],
                     "manual-room", True)
        hass.data["stevora"]["_admin_managers"] = types.SimpleNamespace(data={
            "visibility": {}, "room_aliases": {}, "room_order": [],
            "entity_aliases": {},
            "device_profiles": {"fan.unassigned": {"area_id": "bath", "name": "Vent"}},
            "translations": {},
        })
        entry = types.SimpleNamespace(entry_id="manual-room",
                                      data={"auto_discovery": False}, options={})
        manifest = self.discovery.build_manifest(hass, entry)
        self.assertEqual(manifest["mappings"]["bath"], ["fan.unassigned"])



if __name__ == "__main__":
    unittest.main()
