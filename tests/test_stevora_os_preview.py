"""Static safety and packaging tests for the opt-in STEVORA OS preview.

No Home Assistant instance is required for these checks. Runtime acceptance
requires a separate, independent HA OS VM with a valid STEVORA integration.
"""
from __future__ import annotations

import ast
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "custom_components" / "stevora_os"
CODE = MODULE / "frontend" / "stevora-os.js"
STYLE = MODULE / "frontend" / "stevora-os.css"


class TestStevoraOSPreview(unittest.TestCase):
    def test_manifest(self):
        manifest = json.loads((MODULE / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["domain"], "stevora_os")
        self.assertEqual(manifest["version"], "1.0.0-alpha.1")
        self.assertIn("panel_custom", manifest["dependencies"])
        self.assertIn("websocket_api", manifest["dependencies"])
        self.assertNotIn("stevora", manifest["dependencies"])

    def test_python_is_valid(self):
        source = (MODULE / "__init__.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertIn('PANEL_PATH = "stevora-os"', source)
        self.assertIn("frontend.async_panel_exists", source)
        self.assertIn("require_admin=False", source)
        self.assertNotIn("async_remove_panel", source)
        self.assertIn("register_system_status(hass)", source)

    def test_frontend_uses_scoped_device_controls(self):
        script = CODE.read_text(encoding="utf-8")
        self.assertIn('type: "stevora/manifest"', script)
        self.assertIn('type: "stevora_os/system/status"', script)
        self.assertIn("this._system = null", script)
        self.assertIn("this._manifest?.entities", script)
        self.assertIn("this._hass.callService(domain, service", script)
        self.assertIn("this._can(card", script)
        self.assertIn("this._manifest?.controllable_entities", script)
        self.assertIn("this._backlight(entityId)", script)
        self.assertIn("stevora/panel/generate", script)
        self.assertNotIn("localStorage", script)
        self.assertNotIn("sessionStorage", script)
        self.assertNotIn("eval(", script)
        self.assertNotIn("innerHTML = this._error", script)

    def test_markup_is_escaped_and_isolated_on_user_change(self):
        script = CODE.read_text(encoding="utf-8")
        self.assertIn("escapeHTML", script)
        self.assertIn("this._manifest = null", script)
        self.assertIn("token !== this._request", script)
        self.assertIn("connection !== this._hass?.connection", script)
        self.assertIn("user !== this._hass?.user?.id", script)

    def test_translations_have_matching_keys(self):
        script = CODE.read_text(encoding="utf-8")
        bg = script.split("bg: {", 1)[1].split("\n    },\n    en: {", 1)[0]
        en = script.split("en: {", 1)[1].split("\n    }\n  };", 1)[0]
        keys = lambda s: set(re.findall(r"^\s*([a-zA-Z]\w*):\s", s, re.M))
        self.assertTrue(keys(bg))
        self.assertEqual(keys(bg), keys(en))

    def test_admin_only_read_only_system_api(self):
        source = (MODULE / "system_api.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertIn("@websocket_api.require_admin", source)
        self.assertIn('STATUS_SCHEMA = "1"', source)
        self.assertIn('PREVIEW_VERSION = "1.0.0-alpha.1"', source)
        self.assertIn('hass.states.get(entity_id)', source)
        self.assertIn('status": "not_detected"', source)
        self.assertNotIn("async_call(", source)
        self.assertNotIn("call_service(", source)
        self.assertNotIn("async_update(", source)
        self.assertNotIn("async_restart(", source)

    def test_unified_navigation_and_native_features(self):
        script = CODE.read_text(encoding="utf-8")
        for feature in ("lighting", "climate", "scenes", "automation", "assist", "setup",
                        "stevora/admin/translations/update", "conversation/process",
                        "stevora/hub/scenes", "stevora/hub/events"):
            self.assertIn(feature, script)
        self.assertNotIn("Supervisor API token", script)
        self.assertNotIn("document.cookie", script)

    def test_responsive_css(self):
        css = STYLE.read_text(encoding="utf-8")
        self.assertIn("@media(max-width:760px)", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("focus-visible", css)
        self.assertIn(".os-system-grid", css)


if __name__ == "__main__":
    unittest.main()
