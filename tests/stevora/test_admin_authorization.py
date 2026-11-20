"""Security regression tests for the admin-only WebSocket API."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2] / "custom_components/stevora"


class AdminAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.errors = []
        self.results = []
        pkg = types.ModuleType("stevora_security_pkg")
        pkg.__path__ = [str(ROOT)]
        helpers = types.ModuleType("homeassistant.helpers")
        storage = types.ModuleType("homeassistant.helpers.storage")
        storage.Store = lambda *args: None
        helpers.storage = storage
        registry = types.ModuleType("homeassistant.helpers.entity_registry")
        helpers.entity_registry = registry
        area_registry = types.ModuleType("homeassistant.helpers.area_registry")
        helpers.area_registry = area_registry
        components = types.ModuleType("homeassistant.components")
        ws = types.ModuleType("homeassistant.components.websocket_api")
        ws.websocket_command = lambda schema: lambda fn: fn
        ws.async_response = lambda fn: fn
        components.websocket_api = ws
        pipeline = types.ModuleType("homeassistant.components.assist_pipeline")
        pipeline.async_get_pipelines = lambda hass: []
        components.assist_pipeline = pipeline
        discovery = types.ModuleType("stevora_security_pkg.discovery")
        discovery.build_manifest = lambda hass, entry: {"rooms": [], "entities": []}
        voluptuous = __import__("voluptuous")
        self.patcher = patch.dict(sys.modules, {
            "stevora_security_pkg": pkg,
            "stevora_security_pkg.discovery": discovery,
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.helpers": helpers,
            "homeassistant.helpers.storage": storage,
            "homeassistant.helpers.entity_registry": registry,
            "homeassistant.helpers.area_registry": area_registry,
            "homeassistant.components": components,
            "homeassistant.components.websocket_api": ws,
            "homeassistant.components.assist_pipeline": pipeline,
            "voluptuous": voluptuous,
        })
        self.patcher.start()
        spec = importlib.util.spec_from_file_location(
            "stevora_security_pkg.admin_api", ROOT / "admin_api.py"
        )
        self.api = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.api
        spec.loader.exec_module(self.api)
        self.hass = types.SimpleNamespace(
            data={"stevora": {"_admin_managers": types.SimpleNamespace(
                data={"revision": 1, "visibility": {}, "assistants": {}}
            )}},
            config_entries=types.SimpleNamespace(async_entries=lambda domain: [object()]),
        )
        self.connection = types.SimpleNamespace(
            user=types.SimpleNamespace(id="ordinary", is_admin=False),
            send_error=lambda *args: self.errors.append(args),
            send_result=lambda *args: self.results.append(args),
        )

    def tearDown(self):
        self.patcher.stop()

    def test_every_admin_command_rejects_regular_user(self):
        cases = [
            (self.api.capabilities, {}),
            (self.api.rooms_get, {}),
            (self.api.rooms_update, {"expected_revision": 1, "entities": []}),
            (self.api.room_aliases_update, {"expected_revision": 1, "room_aliases": {}, "entity_aliases": {}}),
            (self.api.devices_update, {"expected_revision": 1, "profiles": {}}),
            (self.api.translations_update, {"expected_revision": 1, "rooms": {}, "entities": {}}),
            (self.api.assistants_get, {}),
            (self.api.assistants_update, {
                "expected_revision": 1, "default_pipeline": None,
                "user_pipelines": {},
            }),
        ]
        for handler, extra in cases:
            self.errors.clear()
            self.results.clear()
            asyncio.run(handler(self.hass, self.connection, {"id": 9, **extra}))
            self.assertEqual(self.errors[0][1], "unauthorized")
            self.assertFalse(self.results)


    def test_admin_cannot_explicitly_include_renamed_backlight(self):
        self.connection.user.is_admin = True
        mirror = types.SimpleNamespace(
            entity_id="light.mirror", disabled_by=None, hidden_by=None,
            name="Mirror", original_name="Mirror backlight",
        )
        self.api.entity_registry.async_get = lambda hass: types.SimpleNamespace(
            entities={"light.mirror": mirror}
        )
        asyncio.run(self.api.rooms_update(self.hass, self.connection, {
            "id": 12, "expected_revision": 1,
            "entities": [{"entity_id": "light.mirror", "visibility": "include"}],
        }))
        self.assertEqual(self.errors[0][1], "invalid_entity")
        self.assertFalse(self.results)

    def test_admin_cannot_enable_controls_on_renamed_backlight(self):
        self.connection.user.is_admin = True
        mirror = types.SimpleNamespace(
            entity_id="light.mirror", disabled_by=None, hidden_by=None,
            name="Mirror", original_name="Mirror Back Light",
        )
        self.api.entity_registry.async_get = lambda hass: types.SimpleNamespace(
            entities={"light.mirror": mirror}
        )
        self.api.area_registry.async_get = lambda hass: types.SimpleNamespace(
            async_list_areas=lambda: []
        )
        async def users():
            return []
        self.hass.auth = types.SimpleNamespace(async_get_users=users)
        asyncio.run(self.api.devices_update(self.hass, self.connection, {
            "id": 13, "expected_revision": 1,
            "profiles": {"light.mirror": {"controls": ["toggle"]}},
        }))
        self.assertEqual(self.errors[0][1], "invalid_profile")
        self.assertFalse(self.results)

    def test_admin_device_save_returns_actual_lighting_placement(self):
        self.connection.user.is_admin = True
        device = types.SimpleNamespace(
            entity_id="switch.table_lamp", area_id=None, disabled_by=None,
            hidden_by=None, name="Table lamp", original_name="Table lamp",
        )
        self.api.entity_registry.async_get = lambda hass: types.SimpleNamespace(
            entities={"switch.table_lamp": device})
        self.api.area_registry.async_get = lambda hass: types.SimpleNamespace(
            async_list_areas=lambda: [])
        async def users():
            return []
        self.hass.auth = types.SimpleNamespace(async_get_users=users)
        manager = self.hass.data["stevora"]["_admin_managers"]
        manager.data.update({"device_profiles": {}, "translations": {}, "visibility": {}})
        manager.lock = asyncio.Lock()
        async def save_state(next_state):
            manager.data = next_state
        manager.save_state = save_state
        # This is the post-save manifest, not a client assertion that the
        # device has been included.
        self.api.build_manifest = lambda hass, entry: {
            "entities": [{"entity_id": "switch.table_lamp",
                          "display_category": "lighting",
                          "area_id": "__stevora_unassigned__"}],
            "domain_mappings": {"lighting": ["switch.table_lamp"]},
            "discovery_diagnostics": {"entities": [
                {"entity_id": "switch.table_lamp", "reason": "included",
                 "area_id": "__stevora_unassigned__"}]},
        }
        asyncio.run(self.api.devices_update(self.hass, self.connection, {
            "id": 15, "expected_revision": 1, "profiles": {
                "switch.table_lamp": {"display_category": "lighting"},
            },
        }))
        self.assertFalse(self.errors)
        self.assertEqual(self.results[0][1]["revision"], 2)
        verified = self.results[0][1]["devices"]["switch.table_lamp"]
        self.assertTrue(verified["included"])
        self.assertTrue(verified["in_lighting"])
        self.assertEqual(verified["area_id"], "__stevora_unassigned__")

        # Reporting is truthful if a room filter prevents visibility.
        self.results.clear()
        self.api.build_manifest = lambda hass, entry: {
            "entities": [],
            "domain_mappings": {"lighting": []},
            "discovery_diagnostics": {"entities": [
                {"entity_id": "switch.table_lamp", "reason": "unassigned"}]},
        }
        asyncio.run(self.api.devices_update(self.hass, self.connection, {
            "id": 16, "expected_revision": 2, "profiles": {
                "switch.table_lamp": {"display_category": "lighting"},
            },
        }))
        self.assertFalse(self.errors)
        denied = self.results[0][1]["devices"]["switch.table_lamp"]
        self.assertFalse(denied["included"])
        self.assertFalse(denied["in_lighting"])
        self.assertEqual(denied["reason"], "unassigned")


if __name__ == "__main__":
    unittest.main()
