"""Pure-Python contract tests for the STEVORA OS 0.2.0 System Center."""
from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
import sys

SOURCE = Path(__file__).resolve().parents[1] / "custom_components" / "stevora_os" / "system_api.py"


def load_system_api():
    """Import the implementation with minimal HA stubs (CI has no HA runtime)."""
    root = ModuleType("homeassistant")
    components = ModuleType("homeassistant.components")
    websocket = ModuleType("homeassistant.components.websocket_api")
    const = ModuleType("homeassistant.const")
    const.__version__ = "2026.11.1"
    websocket.websocket_command = lambda _schema: lambda fn: fn
    websocket.require_admin = lambda fn: fn
    websocket.async_response = lambda fn: fn
    websocket.async_register_command = lambda _hass, _command: None
    components.websocket_api = websocket
    fake_modules = {
        "homeassistant": root,
        "homeassistant.components": components,
        "homeassistant.components.websocket_api": websocket,
        "homeassistant.const": const,
    }
    spec = importlib.util.spec_from_file_location("stevora_os_test_system_api", SOURCE)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, fake_modules):
        spec.loader.exec_module(module)
    return module


class States:
    def __init__(self, states):
        self._states = states

    def get(self, entity_id):
        return self._states.get(entity_id)

    def async_all(self):
        return list(self._states.values())


def entity(state, installed=None, latest=None):
    return SimpleNamespace(
        state=state,
        attributes={"installed_version": installed, "latest_version": latest},
    )


def home(entries=(), states=None, hub=None):
    class ConfigEntries:
        def async_entries(self, domain):
            assert domain == "stevora"
            return list(entries)

    data = {"stevora": {}}
    if entries and hub is not None:
        data["stevora"][entries[0].entry_id] = {"hub": hub, "hub_status": "active"}
    return SimpleNamespace(
        states=States(states or {}),
        config_entries=ConfigEntries(),
        data=data,
        state=SimpleNamespace(value="running"),
        start_time=None,
    )


class SystemAPITest(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = load_system_api()

    def test_update_entities_not_detected_is_unknown_not_current(self):
        result = self.api.build_status(home())
        self.assertEqual(result["schema_version"], "1")
        self.assertEqual(result["core_version"], "2026.11.1")
        self.assertEqual(result["stevora_integration"], "not_configured")
        self.assertEqual(result["home_hub"], "not_configured")
        self.assertEqual(result["updates_available"], 0)
        self.assertEqual(result["updates_unknown"], 3)
        for item in result["official_updates"].values():
            self.assertEqual(item["status"], "not_detected")

    def test_detects_available_and_current_updates(self):
        states = {
            "update.home_assistant_core_update": entity("on", "2026.11.1", "2026.11.2"),
            "update.home_assistant_operating_system_update": entity("off", "18.4", "18.4"),
            "update.home_assistant_supervisor_update": entity("unavailable"),
        }
        entry = SimpleNamespace(entry_id="test")
        result = self.api.build_status(home(entries=[entry], states=states, hub=SimpleNamespace(active=True)))
        self.assertEqual(result["updates_available"], 1)
        self.assertEqual(result["updates_unknown"], 1)
        self.assertEqual(result["official_updates"]["core"]["status"], "available")
        self.assertEqual(result["official_updates"]["os"]["status"], "up_to_date")
        self.assertEqual(result["official_updates"]["supervisor"]["status"], "unknown")
        self.assertEqual(result["home_hub"], "active")
        self.assertEqual(result["registered_entities"], 3)

    def test_versions_are_bounded_and_no_side_effects(self):
        version = "x" * 400
        result = self.api.build_status(home(states={
            "update.home_assistant_core_update": entity("on", version, {"danger": "x"})
        }))
        self.assertEqual(len(result["official_updates"]["core"]["installed_version"]), 80)
        self.assertIsNone(result["official_updates"]["core"]["latest_version"])
        self.assertTrue(result["capabilities"]["read_only"])
        self.assertFalse(result["capabilities"]["updates_execute"])
        self.assertFalse(result["capabilities"]["backups_execute"])
        self.assertFalse(result["capabilities"]["restart_execute"])
