"""Contract scenarios for the adaptive engine using synthetic HA evidence."""
import importlib
import json
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch


def entity(entity_id, registry_id, device=None, controls=(), device_class=None, **overrides):
    return {
        "entity_id": entity_id, "domain": entity_id.partition(".")[0],
        "registry_id": registry_id, "device_id": device, "area_id": "room",
        "device_class": device_class, "entity_category": None, "profile_category": "auto",
        "controls": None, "available_controls": controls, "layout": "compact", "icon": "",
        "source_name": entity_id, "translations": {"bg": "Устройство", "en": "Device"},
        **overrides,
    }


def state(entity_id, value="on", **attrs):
    return SimpleNamespace(entity_id=entity_id, state=value, attributes=attrs)


class AdaptiveCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pkg = ModuleType("stevora_adaptive_testpkg")
        pkg.__path__ = [str(Path(__file__).resolve().parents[2] / "custom_components/stevora")]
        with patch.dict(sys.modules, {pkg.__name__: pkg}):
            cls.catalog = importlib.import_module(pkg.__name__ + ".adaptive_catalog")

    def build(self, items, states=None, control=(), overrides=None, services=None, revision=None):
        lookup = (states or {}).get
        services = services if services is not None else lambda *_: True
        return self.catalog.build_catalog(
            {"installation_id": "test", "entities": items, "controllable_entities": control, "rooms": []},
            lookup, services, overrides or {}, "bg", configuration_revision=revision,
        )

    def test_empty_home_and_unknown_domain(self):
        self.assertEqual(self.build([])["systems"], [])
        item = entity("unknown.future", "a")
        catalog = self.build([item])
        self.assertEqual(catalog["systems"][0]["category"], "general")
        self.assertEqual(catalog["capabilities"][0]["availability"], "missing")
        self.assertTrue(catalog["capabilities"][0]["read_only"])

    def test_offline_reconnect_and_renamed_entity_keep_stable_identity(self):
        original = entity("climate.old", "stable-id", "unit", ("temperature", "hvac_mode"))
        renamed = entity("climate.new", "stable-id", "unit", ("temperature", "hvac_mode"))
        offline = self.build([original], {"climate.old": state("climate.old", "unavailable")}, ["climate.old"])
        online = self.build([renamed], {"climate.new": state("climate.new", "heat",
                            min_temp=15, max_temp=26, hvac_modes=["heat"])}, ["climate.new"])
        first, second = offline["capabilities"][0], online["capabilities"][0]
        self.assertEqual(first["id"], second["id"])
        self.assertNotEqual(offline["revision"], online["revision"])
        self.assertEqual(first["actions"], [])
        self.assertEqual({action["id"] for action in second["actions"]}, {"temperature", "hvac_mode"})
        self.assertEqual(second["names"]["bg"], "Устройство")

    def test_admin_group_and_scope_do_not_leak_hidden_members(self):
        climate = entity("climate.unit", "a", "a")
        water = entity("water_heater.unit", "b", "b")
        overrides = {key: {"category": "heat_pump", "group": "shared"} for key in ["device:a", "device:b"]}
        full = self.build([climate, water], overrides=overrides)
        limited = self.build([climate], overrides=overrides)
        self.assertEqual(full["systems"][0]["device_ids"], ["device:a", "device:b"])
        self.assertEqual(limited["systems"][0]["device_ids"], ["device:a"])
        self.assertNotIn("water_heater.unit", json.dumps(limited))
        self.assertEqual(limited["capabilities"][0]["classification"]["source"], "admin")
        self.assertNotIn("management", limited)
        self.assertNotIn("override", limited["devices"][0])
        admin = self.build([climate], overrides=overrides, revision=2)
        self.assertEqual(admin["devices"][0]["override"], overrides["device:a"])
        self.assertEqual(admin["management"]["configuration_revision"], 2)

    def test_evidence_and_authorization_each_required_for_actions(self):
        item = entity("switch.relay", "sw", controls=("toggle",))
        states = {"switch.relay": state("switch.relay")}
        self.assertTrue(self.build([item], states)["capabilities"][0]["read_only"])
        permitted = self.build([item], states, ["switch.relay"],
                               services=lambda _domain, service: service == "turn_on")
        self.assertEqual([action["id"] for action in permitted["capabilities"][0]["actions"]], ["turn_on"])
        self.assertTrue(permitted["capabilities"][0]["actions"][0]["confirmation_required"])

    def test_safe_metadata_and_typed_classification(self):
        camera = entity("camera.private", "cam")
        energy = entity("sensor.meter", "meter", device_class="energy")
        result = self.build([camera, energy], {
            "camera.private": state("camera.private", access_token="DO-NOT-EXPOSE"),
            "sensor.meter": state("sensor.meter", "12", unit_of_measurement="kWh"),
        })
        self.assertEqual({item["category"] for item in result["systems"]}, {"energy", "security"})
        self.assertNotIn("DO-NOT-EXPOSE", json.dumps(result))

    def test_telemetry_ticks_do_not_invalidate_catalog_and_payload_is_restricted(self):
        before = state("climate.ac", "heat", current_temperature=20, hvac_modes=["heat"])
        after = state("climate.ac", "heat", current_temperature=21, hvac_modes=["heat"])
        self.assertEqual(self.catalog.metadata_signature(before), self.catalog.metadata_signature(after))
        self.assertNotEqual(self.catalog.metadata_signature(after),
                            self.catalog.metadata_signature(state("climate.ac", "unavailable")))
        schema = {"temperature": {"type": "number", "min": 15, "max": 25}}
        self.assertTrue(self.catalog.valid_parameters({"temperature": 22}, schema))
        for invalid in (float("nan"), float("inf"), True, "22", 14, 10**500):
            self.assertFalse(self.catalog.valid_parameters({"temperature": invalid}, schema))
        self.assertFalse(self.catalog.valid_parameters({"temperature": 22, "entity_id": "foreign"}, schema))
