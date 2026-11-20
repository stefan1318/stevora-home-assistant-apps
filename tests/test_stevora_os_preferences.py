"""STEVORA OS per-user preferences: storage and permission isolation tests.

Runs without a Home Assistant installation; models the HA Store contract.
"""
from __future__ import annotations

import asyncio
import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "custom_components" / "stevora_os" / "preferences.py"


class FakeStore:
    initial = None
    last_instance = None

    def __init__(self, hass, version, key):
        assert version == 1 and key == "stevora_os_user_preferences"
        self.payload = FakeStore.initial
        self.saved = []
        FakeStore.last_instance = self

    async def async_load(self):
        return self.payload

    async def async_save(self, data):
        self.saved.append(data)
        self.payload = data


def load_backend():
    root = ModuleType("homeassistant")
    components = ModuleType("homeassistant.components")
    websocket = ModuleType("homeassistant.components.websocket_api")
    helpers = ModuleType("homeassistant.helpers")
    storage = ModuleType("homeassistant.helpers.storage")
    voluptuous = ModuleType("voluptuous")
    voluptuous.Required = lambda key: key
    voluptuous.Optional = lambda key: key
    voluptuous.In = lambda values: lambda x: x
    voluptuous.Range = lambda **kwargs: lambda x: x
    voluptuous.Coerce = lambda typ: lambda x: x
    voluptuous.All = lambda *args: lambda x: x
    websocket.websocket_command = lambda schema: lambda f: f
    websocket.async_response = lambda f: f
    websocket.async_register_command = lambda _hass, _command: None
    storage.Store = FakeStore
    helpers.storage = storage
    components.websocket_api = websocket
    modules = {
        "homeassistant": root,
        "homeassistant.components": components,
        "homeassistant.components.websocket_api": websocket,
        "homeassistant.helpers": helpers,
        "homeassistant.helpers.storage": storage,
        "voluptuous": voluptuous,
    }
    spec = importlib.util.spec_from_file_location("stevora_os_prefs_test", SOURCE)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module


class CaptureConnection:
    def __init__(self, user_id):
        self.user = SimpleNamespace(id=user_id, is_admin=False)
        self.result = None
        self.errors = []

    def send_result(self, msgid, data):
        self.result = data

    def send_error(self, msgid, code, description):
        self.errors.append(code)


class PreferencesTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        FakeStore.initial = None
        self.module = load_backend()
        self.manager = self.module.Preferences(object())
        await self.manager.async_load()

    async def test_default_state_and_persistent_update(self):
        self.assertEqual(self.manager.for_user("a")["revision"], 0)
        self.assertFalse(self.manager.for_user("a")["preferences"]["onboarding_complete"])
        status, result = await self.manager.async_update("a", 0, {
            "language": "en", "onboarding_complete": True, "default_view": "rooms",
        })
        self.assertEqual(status, "ok")
        self.assertEqual(result["revision"], 1)
        self.assertEqual(result["preferences"]["language"], "en")
        self.assertTrue(result["preferences"]["onboarding_complete"])
        self.assertEqual(FakeStore.last_instance.saved[-1]["a"]["revision"], 1)

    async def test_no_cross_user_preferences(self):
        await self.manager.async_update("alice", 0, {"language": "en"})
        self.assertEqual(self.manager.for_user("bob")["preferences"]["language"], "bg")
        self.assertEqual(self.manager.for_user("bob")["revision"], 0)

    async def test_revision_conflict_no_mutation(self):
        await self.manager.async_update("a", 0, {"language": "en"})
        status, latest = await self.manager.async_update("a", 0, {"language": "bg"})
        self.assertEqual(status, "conflict")
        self.assertEqual(latest["preferences"]["language"], "en")
        self.assertEqual(len(FakeStore.last_instance.saved), 1)

    async def test_concurrent_updates_one_winner(self):
        result = await asyncio.gather(
            self.manager.async_update("a", 0, {"default_view": "rooms"}),
            self.manager.async_update("a", 0, {"default_view": "climate"}),
        )
        self.assertEqual(sorted(x[0] for x in result), ["conflict", "ok"])
        self.assertEqual(self.manager.for_user("a")["revision"], 1)

    async def test_allowlisted_validation_and_corrupt_record(self):
        cleaned = self.module.valid_preferences({
            "language": "xx", "default_view": "invalid", "compact_nav": 1,
            "onboarding_complete": "yes", "token": "must-not-be-persisted",
        })
        self.assertEqual(cleaned, self.module.DEFAULTS)
        FakeStore.initial = {"alice": {"revision": -7, "preferences": {
            "language": "en", "token": "secret",
        }}}
        self.manager = self.module.Preferences(object())
        await self.manager.async_load()
        self.assertEqual(self.manager.for_user("alice")["revision"], 0)
        self.assertNotIn("token", self.manager.for_user("alice")["preferences"])

    async def test_user_ws_uses_authenticated_connection_identity(self):
        hass = SimpleNamespace(data={"stevora_os": {"preferences": self.manager}})
        alice = CaptureConnection("alice")
        await self.module.websocket_preferences_update(hass, alice, {
            "id": 1, "expected_revision": 0, "language": "en",
        })
        self.assertEqual(alice.result["revision"], 1)
        bob = CaptureConnection("bob")
        await self.module.websocket_preferences_get(hass, bob, {"id": 2})
        self.assertEqual(bob.result["preferences"]["language"], "bg")
        await self.module.websocket_preferences_update(hass, bob, {
            "id": 3, "expected_revision": 0, "default_view": "devices",
        })
        self.assertEqual(bob.result["preferences"]["default_view"], "devices")
        self.assertEqual(self.manager.for_user("alice")["preferences"]["default_view"], "home")

    async def test_empty_patch_rejected(self):
        hass = SimpleNamespace(data={"stevora_os": {"preferences": self.manager}})
        conn = CaptureConnection("alice")
        await self.module.websocket_preferences_update(hass, conn, {"id": 1, "expected_revision": 0})
        self.assertEqual(conn.errors, ["empty_update"])

if __name__ == "__main__":
    unittest.main()
