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


if __name__ == "__main__":
    unittest.main()
