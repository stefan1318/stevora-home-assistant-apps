"""Isolated tests for read-only, admin-protected integration inventory."""
from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch
import sys

SOURCE = Path(__file__).resolve().parents[1] / "custom_components" / "stevora_os" / "integrations_api.py"


def load_backend():
    root = ModuleType("homeassistant")
    components = ModuleType("homeassistant.components")
    websocket = ModuleType("homeassistant.components.websocket_api")
    def admin_wrapper(fn):
        async def authorized(hass, connection, msg):
            if not connection.user.is_admin:
                connection.send_error(msg["id"], "unauthorized", "Admin rights required")
                return
            await fn(hass, connection, msg)
        return authorized
    websocket.websocket_command = lambda _schema: lambda fn: fn
    websocket.require_admin = admin_wrapper
    websocket.async_response = lambda fn: fn
    websocket.async_register_command = lambda hass, command: None
    components.websocket_api = websocket
    fake_modules = {
        "homeassistant": root,
        "homeassistant.components": components,
        "homeassistant.components.websocket_api": websocket,
    }
    spec = importlib.util.spec_from_file_location("stevora_os_test_integrations_api", SOURCE)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, fake_modules):
        spec.loader.exec_module(module)
    return module


class Connection:
    def __init__(self, admin):
        self.user = SimpleNamespace(is_admin=admin)
        self.result = None
        self.errors = []

    def send_result(self, _id, data):
        self.result = data

    def send_error(self, _id, code, message):
        self.errors.append(code)


def home(entries):
    return SimpleNamespace(
        config_entries=SimpleNamespace(async_entries=lambda: entries)
    )


def entry(entry_id, domain, title, state="loaded", **more):
    return SimpleNamespace(
        entry_id=entry_id, domain=domain, title=title,
        state=SimpleNamespace(value=state),
        source=more.get("source", "user"),
        disabled_by=more.get("disabled_by"),
        data={"access_token": "NEVER_DISCLOSE"},
        options={"password": "NEVER_DISCLOSE"},
        unique_id="PRIVATE",
    )


class IntegrationsTest(IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = load_backend()

    async def test_bounded_statuses_and_private_field_exclusion(self):
        result = self.api.build_inventory(home([
            entry("1", "mqtt", "Broker", "setup_retry"),
            entry("2", "stevora", "STEVORA Universal"),
            entry("3", "light", "Bulb", disabled_by=SimpleNamespace(value="user")),
        ]))
        self.assertEqual(result["schema_version"], "1")
        self.assertEqual(result["count_total"], 3)
        self.assertEqual(result["count_loaded"], 2)
        self.assertEqual(result["count_not_loaded"], 1)
        self.assertEqual(result["entries"][0]["domain"], "light")
        self.assertEqual(result["entries"][0]["disabled_by"], "user")
        self.assertFalse(result["capabilities"]["configure"])
        self.assertFalse(result["capabilities"]["remove"])
        text = str(result)
        for sensitive in ("NEVER_DISCLOSE", "PRIVATE", "access_token", "password"):
            self.assertNotIn(sensitive, text)

    async def test_untrusted_labels_bounded_and_missing_field(self):
        result = self.api.build_inventory(home([
            entry("1", "a"*200, "<script>"+"x"*300),
            entry("2", "", "Empty"),
        ]))
        self.assertEqual(len(result["entries"]), 1)
        self.assertEqual(len(result["entries"][0]["domain"]), 80)
        self.assertEqual(len(result["entries"][0]["title"]), 120)

    async def test_many_entries_truncated_but_count_preserved(self):
        result = self.api.build_inventory(home([
            entry(str(i), "light", f"Entry {i}") for i in range(450)
        ]))
        self.assertEqual(result["count_total"], 450)
        self.assertEqual(len(result["entries"]), 400)
        self.assertTrue(result["truncated"])

    async def test_admin_only_websocket(self):
        hass = home([entry("1", "stevora", "STEVORA Universal")])
        user_conn, admin_conn = Connection(False), Connection(True)
        await self.api.websocket_integrations(hass, user_conn, {"id": 1})
        self.assertIsNone(user_conn.result)
        self.assertEqual(user_conn.errors, ["unauthorized"])
        await self.api.websocket_integrations(hass, admin_conn, {"id": 2})
        self.assertEqual(admin_conn.result["count_total"], 1)
        self.assertFalse(admin_conn.errors)
