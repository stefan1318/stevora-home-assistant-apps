"""Home Hub WebSocket security and user-scoped endpoint tests."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/hub_api.py"


class Permissions:
    def __init__(self, read=(), control=()):
        self.read = set(read)
        self.control = set(control)
    def check_entity(self, name, policy):
        return name in (self.read if policy == "read" else self.control)


class User:
    def __init__(self, admin=False, read=(), control=(), user_id="test-user"):
        self.id = user_id
        self.is_admin = admin
        self.permissions = Permissions(read, control)


class Hub:
    active = True
    settings = {"revision": 1, "notifications_enabled": True}
    def uptime_seconds(self):
        return 20
    def events_for(self, allowed, limit=40, since=0):
        events = [
            {"seq": 1, "entity_id": "light.public", "kind": "unavailable"},
            {"seq": 2, "entity_id": "light.secret", "kind": "unavailable"},
        ]
        return [x for x in events if x["seq"] > since and x["entity_id"] in allowed][-limit:]
    def notifications_for(self, allowed, limit=20):
        return self.events_for(allowed, limit)
    async def async_configure(self, expected_revision, patch):
        if expected_revision != self.settings["revision"]:
            return None
        self.settings = {**self.settings, **patch, "revision": expected_revision + 1}
        return self.settings


class HubApiTests(unittest.TestCase):
    def setUp(self):
        self.errors = []
        self.results = []
        package = types.ModuleType("stevora_hub_api_pkg")
        package.__path__ = [str(SOURCE.parent)]

        def mod(name, **attrs):
            item = types.ModuleType(name)
            for k, v in attrs.items():
                setattr(item, k, v)
            return item
        def require_admin(connection, msg):
            if not connection.user.is_admin:
                connection.send_error(msg["id"], "unauthorized", "Administrator permission required")
                return False
            return True
        decorators = mod("homeassistant.components.websocket_api",
            websocket_command=lambda schema: lambda fn: fn,
            async_response=lambda fn: fn,
            async_register_command=lambda hass, fn: self.commands.append(fn))
        auth_consts = mod("homeassistant.auth.permissions.const",
            POLICY_READ="read", POLICY_CONTROL="control")
        modules = {
            package.__name__: package,
            "stevora_hub_api_pkg.admin_managers": mod("stevora_hub_api_pkg.admin_managers", require_admin=require_admin),
            "stevora_hub_api_pkg.const": mod("stevora_hub_api_pkg.const", DOMAIN="stevora"),
            "stevora_hub_api_pkg.discovery": mod("stevora_hub_api_pkg.discovery",
                build_manifest=lambda hass, entry: {"entities": [
                    {"entity_id": "light.public"}, {"entity_id": "light.secret"}], "rooms": [{"id": "test"}]}),
            "stevora_hub_api_pkg.home_hub": mod("stevora_hub_api_pkg.home_hub",
                DEFAULT_DOMAINS=("light", "fan"), HUB_VERSION="1.0.0-beta.1"),
            "stevora_hub_api_pkg.modules": mod("stevora_hub_api_pkg.modules",
                describe_modules=lambda hass, entry: {"home_hub": {"status": "active"}}),
            "stevora_hub_api_pkg.permissions": mod("stevora_hub_api_pkg.permissions",
                project_manifest_for_user=lambda manifest, user: {
                    **manifest, "entities": [x for x in manifest["entities"]
                        if user.is_admin or user.permissions.check_entity(x["entity_id"], "read")]}),
            "homeassistant": mod("homeassistant"),
            "homeassistant.auth": mod("homeassistant.auth"),
            "homeassistant.auth.permissions": mod("homeassistant.auth.permissions"),
            "homeassistant.auth.permissions.const": auth_consts,
            "homeassistant.components": mod("homeassistant.components", websocket_api=decorators),
            "homeassistant.components.websocket_api": decorators,
        }
        self.patcher = patch.dict(sys.modules, modules)
        self.patcher.start()
        spec = importlib.util.spec_from_file_location(package.__name__ + ".hub_api", SOURCE)
        self.api = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.api
        spec.loader.exec_module(self.api)
        self.entry = types.SimpleNamespace(entry_id="independent-home")
        self.hub = Hub()
        self.hass = types.SimpleNamespace(
            data={"stevora": {"independent-home": {"hub": self.hub}}},
            states=types.SimpleNamespace(async_all=lambda: [
                types.SimpleNamespace(entity_id="light.public", state="on", attributes={}),
                types.SimpleNamespace(entity_id="light.secret", state="unavailable", attributes={}),
                types.SimpleNamespace(entity_id="scene.public", state="scening",
                    attributes={"friendly_name": "Welcome"}),
                types.SimpleNamespace(entity_id="scene.secret", state="scening", attributes={}),
            ]),
            config_entries=types.SimpleNamespace(async_entries=lambda d: [self.entry]),
        )
        self.commands = []
        self.connection = types.SimpleNamespace(
            user=User(read={"light.public", "scene.public"}, control={"scene.public"}),
            send_error=lambda *args: self.errors.append(args),
            send_result=lambda *args: self.results.append(args),
        )

    def tearDown(self):
        self.patcher.stop()
        sys.modules.pop("stevora_hub_api_pkg.hub_api", None)

    def call(self, handler, **kwargs):
        self.errors.clear()
        self.results.clear()
        asyncio.run(handler(self.hass, self.connection, {"id": 7, **kwargs}))
        return self.results[0][1] if self.results else None

    def test_read_only_status_filters_counts(self):
        data = self.call(self.api.hub_status)
        self.assertEqual(data["metrics"]["visible_entities"], 1)
        self.assertEqual(data["metrics"]["unavailable_entities"], 0)
        self.assertEqual(data["metrics"]["notifications"], 1)
        self.assertFalse(data["capabilities"]["settings"])
        self.assertFalse(data["capabilities"]["push_notifications"])

    def test_events_and_notifications_do_not_leak_secret_entity(self):
        data = self.call(self.api.hub_events)
        self.assertEqual([x["entity_id"] for x in data["events"]], ["light.public"])
        self.assertEqual([x["entity_id"] for x in data["notifications"]], ["light.public"])

    def test_scenes_respect_ha_read_and_control_permissions(self):
        data = self.call(self.api.hub_scenes)
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["entity_id"], "scene.public")
        self.assertTrue(data["items"][0]["action_allowed"])
        self.connection.user = User(read={"scene.public"})
        data = self.call(self.api.hub_scenes)
        self.assertFalse(data["items"][0]["action_allowed"])

    def test_admin_settings_denied_and_revision_guarded(self):
        self.assertIsNone(self.call(self.api.hub_config_get))
        self.assertEqual(self.errors[0][1], "unauthorized")
        self.assertIsNone(self.call(self.api.hub_config_update,
            expected_revision=1, track_events=False))
        self.assertEqual(self.errors[0][1], "unauthorized")
        self.connection.user = User(admin=True)
        settings = self.call(self.api.hub_config_get)
        self.assertEqual(settings["revision"], 1)
        saved = self.call(self.api.hub_config_update, expected_revision=1,
            notifications_enabled=False)
        self.assertEqual(saved["revision"], 2)
        self.assertIsNone(self.call(self.api.hub_config_update, expected_revision=1,
            notifications_enabled=True))
        self.assertEqual(self.errors[0][1], "conflict")

    def test_missing_or_disabled_hub_fails_closed(self):
        self.hass.data["stevora"]["independent-home"]["hub"] = None
        self.assertIsNone(self.call(self.api.hub_status))
        self.assertEqual(self.errors[0][1], "hub_not_active")
        self.hass.config_entries.async_entries = lambda d: []
        self.assertIsNone(self.call(self.api.hub_events))
        self.assertEqual(self.errors[0][1], "not_configured")

    def test_registers_five_commands(self):
        self.api.register(self.hass)
        self.assertEqual(len(self.commands), 5)


if __name__ == "__main__":
    unittest.main()
