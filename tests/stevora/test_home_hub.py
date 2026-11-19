"""Home Hub event, lifecycle, revision and notification acceptance tests."""
import asyncio
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/home_hub.py"


class Store:
    data = {}
    def __init__(self, hass, version, key):
        self.key = key
    async def async_load(self):
        return self.data.get(self.key)
    async def async_save(self, data):
        self.data[self.key] = data.copy()


class Bus:
    def __init__(self):
        self.handlers = []
    def async_listen(self, name, fn):
        self.handlers.append((name, fn))
        def unsub():
            self.handlers.remove((name, fn))
        return unsub
    def send(self, entity_id, old_state, new_state):
        event = types.SimpleNamespace(data={
            "entity_id": entity_id,
            "old_state": types.SimpleNamespace(state=old_state) if old_state is not None else None,
            "new_state": types.SimpleNamespace(state=new_state) if new_state is not None else None,
        }, time_fired=datetime.now(timezone.utc))
        for _, fn in list(self.handlers):
            fn(event)


class HomeHubRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        storage = types.ModuleType("homeassistant.helpers.storage")
        storage.Store = Store
        with patch.dict(sys.modules, {
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.helpers": types.ModuleType("homeassistant.helpers"),
            "homeassistant.helpers.storage": storage,
        }):
            spec = importlib.util.spec_from_file_location("hub_testing", SOURCE)
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
        cls.Hub = module.HomeHub
        cls.normalize = staticmethod(module.normalized_settings)

    def setUp(self):
        Store.data.clear()
        self.bus = Bus()
        self.hass = types.SimpleNamespace(bus=self.bus)
        self.entry = types.SimpleNamespace(entry_id="isolated-home")

    def test_module_start_listen_stop_and_persistent_configuration(self):
        hub = self.Hub(self.hass, self.entry)
        asyncio.run(hub.async_start())
        self.assertTrue(hub.active)
        self.assertEqual(len(self.bus.handlers), 1)
        self.assertEqual(hub.settings["revision"], 1)
        new = asyncio.run(hub.async_configure(1, {"notifications_enabled": False}))
        self.assertEqual(new["revision"], 2)
        self.assertFalse(hub.settings["notifications_enabled"])
        self.assertIsNone(asyncio.run(hub.async_configure(1, {"notifications_enabled": True})))
        asyncio.run(hub.async_stop())
        self.assertFalse(hub.active)
        self.assertEqual(self.bus.handlers, [])
        another = self.Hub(self.hass, self.entry)
        asyncio.run(another.async_start())
        self.assertEqual(another.settings["revision"], 2)
        self.assertFalse(another.settings["notifications_enabled"])
        asyncio.run(another.async_stop())

    def test_per_installation_preferences_are_separate(self):
        first = self.Hub(self.hass, self.entry)
        second = self.Hub(self.hass, types.SimpleNamespace(entry_id="other-home"))
        asyncio.run(first.async_start())
        asyncio.run(second.async_start())
        asyncio.run(first.async_configure(1, {"track_events": False}))
        self.assertTrue(second.settings["track_events"])
        self.assertNotEqual(first._store.key, second._store.key)
        asyncio.run(first.async_stop())
        asyncio.run(second.async_stop())

    def test_offline_recovery_permissions_and_non_control_behavior(self):
        hub = self.Hub(self.hass, self.entry)
        asyncio.run(hub.async_start())
        self.bus.send("light.hall", "on", "unavailable")
        self.bus.send("light.hall", "unavailable", "on")
        self.bus.send("fan.bath", "off", "on")
        self.bus.send("device_tracker.person", "home", "not_home")
        self.bus.send("light.hall", "on", "on")
        self.bus.send("light.hall", "on", None)
        events = hub.events_for({"light.hall"})
        self.assertEqual([event["kind"] for event in events], ["unavailable", "recovered"])
        self.assertEqual(hub.events_for({"light.unreadable"}), [])
        self.assertEqual(len(hub.notifications_for({"light.hall"})), 2)
        self.assertEqual(len(hub.events_for({"light.hall"}, limit=1)), 1)
        self.assertTrue(all("attributes" not in event for event in events))
        self.assertGreaterEqual(hub.uptime_seconds(), 0)
        asyncio.run(hub.async_stop())
        self.assertEqual(hub.events_for({"light.hall"}), [])

    def test_disable_notifications_and_strict_normalization(self):
        settings = self.normalize({"revision": True, "track_events": "yes",
            "tracked_domains": ["light", "light", "invalid"], "notifications_enabled": False})
        self.assertEqual(settings["revision"], 1)
        self.assertTrue(settings["track_events"])
        self.assertEqual(settings["tracked_domains"], ["light"])
        hub = self.Hub(self.hass, self.entry)
        asyncio.run(hub.async_start())
        asyncio.run(hub.async_configure(1, {"notifications_enabled": False,
            "tracked_domains": ["fan"]}))
        self.bus.send("light.hall", "on", "unavailable")
        self.bus.send("fan.bath", "on", "unavailable")
        self.assertEqual(hub.events_for({"light.hall"}), [])
        self.assertEqual(len(hub.events_for({"fan.bath"})), 1)
        self.assertEqual(hub.notifications_for({"fan.bath"}), [])
        asyncio.run(hub.async_stop())

    def test_bounded_history_and_repeat_deduplication(self):
        hub = self.Hub(self.hass, self.entry)
        asyncio.run(hub.async_start())
        self.bus.send("light.living", "on", "unavailable")
        self.bus.send("light.living", "on", "unavailable")
        self.assertEqual(len(hub.events_for({"light.living"})), 1)
        for index in range(300):
            self.bus.send(f"light.item_{index}", "off", "on")
        all_ids = {f"light.item_{index}" for index in range(300)} | {"light.living"}
        self.assertEqual(len(hub.events_for(all_ids, limit=1000)), 250)
        asyncio.run(hub.async_stop())


if __name__ == "__main__":
    unittest.main()
