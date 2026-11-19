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


    def test_simultaneous_admin_edits_use_revision_compare_and_swap(self):
        self.connection.user.is_admin = True
        self.api.area_registry.async_get = lambda hass: types.SimpleNamespace(
            async_list_areas=lambda: [],
        )
        self.api.entity_registry.async_get = lambda hass: types.SimpleNamespace(
            entities={},
        )
        manager = self.hass.data["stevora"]["_admin_managers"]
        manager.data.update({"room_aliases": {}, "entity_aliases": {}})
        manager.lock = asyncio.Lock()

        async def save_state(state):
            manager.data = state

        manager.save_state = save_state

        async def simultaneous():
            await asyncio.gather(
                self.api.room_aliases_update(self.hass, self.connection, {
                    "id": 51, "expected_revision": 1,
                    "room_aliases": {}, "entity_aliases": {},
                }),
                self.api.room_aliases_update(self.hass, self.connection, {
                    "id": 52, "expected_revision": 1,
                    "room_aliases": {}, "entity_aliases": {},
                }),
            )

        asyncio.run(simultaneous())
        self.assertEqual(manager.data["revision"], 2)
        self.assertEqual(len(self.results), 1)
        self.assertEqual(len(self.errors), 1)
        self.assertEqual(self.errors[0][1], "conflict")


if __name__ == "__main__":
    unittest.main()
