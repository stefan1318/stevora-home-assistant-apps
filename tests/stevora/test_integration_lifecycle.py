"""Execute setup, unload, reload, and authenticated WS plumbing with HA stubs."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/__init__.py"


class _Entry:
    entry_id = "test-entry"

    def __init__(self):
        self.data = {}
        self.options = {}

    def add_update_listener(self, fn):
        self.listener = fn
        return fn

    def async_on_unload(self, listener):
        self.unload_listener = listener


class _Hass:
    def __init__(self):
        self.data = {}
        self.static_paths = []
        self.entry = _Entry()
        self.config_entries = types.SimpleNamespace(async_entries=lambda domain: [self.entry])
        self.http = types.SimpleNamespace(async_register_static_paths=self.register_static)

    async def register_static(self, paths):
        self.static_paths.extend(paths)


class IntegrationLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.panel_events = []
        self.panel_claim_allowed = True
        self.commands = []
        package = types.ModuleType("stevora_lifecycle_pkg")
        package.__path__ = [str(SOURCE.parent)]
        panel = types.ModuleType("stevora_lifecycle_pkg.panel")

        async def add(hass):
            self.panel_events.append("register")
            return self.panel_claim_allowed

        async def remove(hass):
            self.panel_events.append("remove")

        panel.async_register_panel = add
        panel.async_remove_panel = remove
        hub_api = types.ModuleType("stevora_lifecycle_pkg.hub_api")
        hub_api.register = lambda hass: self.commands.extend(["hub"] * 5)
        home_hub = types.ModuleType("stevora_lifecycle_pkg.home_hub")
        class FakeHub:
            def __init__(self, hass, entry):
                self.active = False
            async def async_start(self):
                self.active = True
            async def async_stop(self):
                self.active = False
        home_hub.HomeHub = FakeHub
        discovery = types.ModuleType("stevora_lifecycle_pkg.discovery")
        discovery.build_manifest = lambda hass, entry: {"installation_id": entry.entry_id}
        permissions = types.ModuleType("stevora_lifecycle_pkg.permissions")
        permissions.project_manifest_for_user = lambda manifest, user: {
            **manifest, "role": "admin" if user.is_admin else "regular"
        }

        storage = types.ModuleType("homeassistant.helpers.storage")
        class FakeStore:
            def __init__(self, hass, version, key):
                self.data = None
            async def async_load(self):
                return self.data
            async def async_save(self, data):
                self.data = data
        storage.Store = FakeStore
        entity_registry = types.ModuleType("homeassistant.helpers.entity_registry")
        helpers = types.ModuleType("homeassistant.helpers")
        helpers.storage = storage
        helpers.entity_registry = entity_registry
        area_registry = types.ModuleType("homeassistant.helpers.area_registry")
        helpers.area_registry = area_registry
        assist_pipeline = types.ModuleType("homeassistant.components.assist_pipeline")
        assist_pipeline.async_get_pipelines = lambda hass: []
        websocket = types.ModuleType("homeassistant.components.websocket_api")
        websocket.websocket_command = lambda schema: lambda fn: fn
        websocket.async_response = lambda fn: fn
        websocket.async_register_command = lambda hass, handler: self.commands.append(handler)
        http = types.ModuleType("homeassistant.components.http")
        http.StaticPathConfig = lambda url, location, cache: (url, location, cache)
        components = types.ModuleType("homeassistant.components")
        components.websocket_api = websocket
        components.assist_pipeline = assist_pipeline

        core = types.ModuleType("homeassistant.core")
        core.callback = lambda fn: fn
        core.HomeAssistant = object
        entries = types.ModuleType("homeassistant.config_entries")
        entries.ConfigEntry = _Entry
        entries.SOURCE_IMPORT = "import"  # Matches Home Assistant config_entries constant

        self.module_patch = patch.dict(sys.modules, {
            package.__name__: package,
            panel.__name__: panel,
            discovery.__name__: discovery,
            hub_api.__name__: hub_api,
            home_hub.__name__: home_hub,
            permissions.__name__: permissions,
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.core": core,
            "homeassistant.config_entries": entries,
            "homeassistant.components": components,
            "homeassistant.components.websocket_api": websocket,
            "homeassistant.components.assist_pipeline": assist_pipeline,
            "homeassistant.components.http": http,
            "homeassistant.helpers": helpers,
            "homeassistant.helpers.storage": storage,
            "homeassistant.helpers.entity_registry": entity_registry,
            "homeassistant.helpers.area_registry": area_registry,
        })
        self.module_patch.start()
        # __init__.py is a package, not a nested module.
        spec = importlib.util.spec_from_file_location(
            "stevora_lifecycle_pkg", SOURCE, submodule_search_locations=[str(SOURCE.parent)]
        )
        self.integration = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = self.integration
        spec.loader.exec_module(self.integration)
        self.hass = _Hass()

    def tearDown(self):
        self.module_patch.stop()

    def test_static_assets_registered_once_across_reload(self):
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        self.assertIn(self.hass.entry.entry_id, self.hass.data["stevora"])
        self.assertEqual(len(self.hass.static_paths), 1)
        self.assertEqual(self.hass.data["stevora"][self.hass.entry.entry_id]["hub_status"], "active")
        self.assertEqual(self.hass.static_paths[0][0], "/stevora_static")
        asyncio.run(self.integration.async_unload_entry(self.hass, self.hass.entry))
        self.assertNotIn(self.hass.entry.entry_id, self.hass.data["stevora"])
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        self.assertEqual(len(self.hass.static_paths), 1)
        self.assertEqual(self.panel_events, ["register", "remove", "register"])

    def test_disabled_panel_does_not_install_or_remove_panel(self):
        self.hass.entry.options["panel_enabled"] = False
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        self.assertEqual(self.panel_events, [])
        self.assertFalse(self.hass.data["stevora"][self.hass.entry.entry_id]["panel_registered"])
        asyncio.run(self.integration.async_unload_entry(self.hass, self.hass.entry))
        self.assertEqual(self.panel_events, [])

    def test_existing_panel_conflict_does_not_remove_foreign_panel(self):
        self.panel_claim_allowed = False
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        state = self.hass.data["stevora"][self.hass.entry.entry_id]
        self.assertTrue(state["panel_conflict"])
        self.assertFalse(state["panel_registered"])
        asyncio.run(self.integration.async_unload_entry(self.hass, self.hass.entry))
        self.assertEqual(self.panel_events, ["register"])

    def test_enabling_panel_after_disabled_options_reload(self):
        self.hass.entry.options["panel_enabled"] = False
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        asyncio.run(self.integration.async_unload_entry(self.hass, self.hass.entry))
        self.hass.entry.options["panel_enabled"] = True
        asyncio.run(self.integration.async_setup_entry(self.hass, self.hass.entry))
        self.assertEqual(self.panel_events, ["register"])
        self.assertEqual(len(self.hass.static_paths), 1)

    def test_websocket_uses_authenticated_user_projection(self):
        asyncio.run(self.integration.async_setup(self.hass, {}))
        self.assertIn(self.integration.subscribe_manifest, self.commands)
        response = {}
        connection = types.SimpleNamespace(
            user=types.SimpleNamespace(is_admin=False),
            send_result=lambda id, payload: response.update({"id": id, "payload": payload}),
            send_error=lambda *args: self.fail("unexpected error"),
        )
        asyncio.run(self.commands[0](self.hass, connection, {"id": 7}))
        self.assertEqual(response["payload"]["installation_id"], "test-entry")
        self.assertEqual(response["payload"]["role"], "regular")
        self.assertEqual(response["payload"]["preferred_language"], "en")

    def test_map_uses_latest_readable_mobile_fix_for_each_person(self):
        from datetime import datetime, timezone
        ns = types.SimpleNamespace
        def record(entity_id, second, **attributes):
            return ns(entity_id=entity_id, attributes=attributes, state="home", name=entity_id,
                      last_updated=datetime.fromtimestamp(second, timezone.utc))
        people = [record("person." + uid, 0, user_id=uid) for uid in ("alice", "bob", "carol", "hidden")]
        phones = [record("device_tracker." + key, i, latitude=i, longitude=i, source_type="gps", gps_accuracy=8)
                  for i, key in enumerate(("old", "recent", "private", "orphan"), 1)]
        registry = {t.entity_id: ns(config_entry_id=key, platform="mobile_app")
                    for t, key in zip(phones, ("alice", "alice", "bob", "other"))}
        sys.modules["homeassistant.helpers.entity_registry"].async_get = lambda hass: ns(async_get=registry.get)
        self.hass.config_entries.async_entries = lambda domain: [ns(entry_id=k, data={"user_id": k}) for k in ("alice", "bob", "other")]
        self.hass.states = ns(async_all=lambda domain: people if domain == "person" else phones)
        async def users():
            return [ns(id=k, name=k, system_generated=False, is_active=True) for k in ("other", "hidden")]
        self.hass.auth = ns(async_get_users=users)
        results = []
        connection = ns(user=ns(id="alice", is_admin=False, permissions=ns(check_entity=lambda key, policy: key not in {"device_tracker.private", "person.hidden"})),
                        send_result=lambda _, rows: results.extend(rows))
        with patch.dict(sys.modules, {"homeassistant.auth.permissions.const": ns(POLICY_READ="read")}):
            asyncio.run(self.integration.websocket_people(self.hass, connection, {"id": 3}))
            connection.user.is_admin = True
            admin_rows = []
            connection.send_result = lambda _, rows: admin_rows.extend(rows)
            asyncio.run(self.integration.websocket_people(self.hass, connection, {"id": 4}))
            self.assertEqual(admin_rows[-1]["attributes"]["friendly_name"], "other")
            self.assertEqual(len(admin_rows), 4)
        self.assertEqual([r["entity_id"] for r in results], ["person.alice", "person.bob", "person.carol"])
        self.assertEqual(results[0]["attributes"]["latitude"], 2)
        self.assertEqual(results[0]["attributes"]["gps_accuracy"], 8)
        self.assertTrue(all("latitude" not in r["attributes"] for r in results[1:]))

    def test_changes_request_fresh_projection_and_unsubscribe(self):
        handlers = {}
        events = []
        def listen(key, callback):
            handlers[key] = callback
            return lambda: handlers.pop(key)
        self.hass.bus = types.SimpleNamespace(async_listen=listen)
        connection = types.SimpleNamespace(subscriptions={}, send_result=lambda _: None,
                                           send_event=lambda *args: events.append(args))
        self.integration.subscribe_manifest(self.hass, connection, {"id": 9})
        for handler in handlers.values():
            handler({"internal_entity": "private"})
        self.assertTrue(events)
        self.assertEqual(set(i for i, _ in events), {9})
        self.assertTrue(all(value == {"manifest_changed": True} for _, value in events))
        connection.subscriptions[9]()
        self.assertFalse(handlers)

    def test_missing_config_entry_rejected(self):
        self.hass.config_entries.async_entries = lambda domain: []
        response = {}
        connection = types.SimpleNamespace(
            user=types.SimpleNamespace(is_admin=True),
            send_result=lambda *args: self.fail("should not return a manifest"),
            send_error=lambda id, code, message: response.update({"id": id, "code": code}),
        )
        asyncio.run(self.integration.websocket_manifest(self.hass, connection, {"id": 3}))
        self.assertEqual(response, {"id": 3, "code": "not_configured"})


if __name__ == "__main__":
    unittest.main()
