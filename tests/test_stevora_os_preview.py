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
        self.assertEqual(manifest["version"], "1.0.0-alpha.3")
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
        self.assertIn("register_preferences(hass)", source)
        self.assertIn("register_integrations(hass)", source)
        self.assertIn("await preferences.async_load()", source)

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
        self.assertIn('PREVIEW_VERSION = "1.0.0-alpha.3"', source)
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

    def test_onboarding_is_user_scoped_and_non_privileged(self):
        source = (MODULE / "preferences.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertIn("connection.user.id", source)
        self.assertIn("expected_revision", source)
        self.assertIn("Store(hass, STORAGE_VERSION, STORAGE_KEY)", source)
        self.assertNotIn("connection.user.is_admin", source)
        script = CODE.read_text(encoding="utf-8")
        for feature in ("stevora_os/preferences/get",
                        "stevora_os/preferences/update",
                        "_onboardingView(t)", "_preferenceForm(t",
                        "onboarding_complete:true", "requestFullscreen"):
            self.assertIn(feature, script)
        self.assertNotIn("sessionStorage", script)
        self.assertNotIn("localStorage", script)

    def test_branded_pwa_assets_and_safe_metadata(self):
        pwa = MODULE / "frontend" / "manifest.webmanifest"
        manifest = json.loads(pwa.read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "STEVORA OS")
        self.assertEqual(manifest["start_url"], "/stevora-os")
        self.assertEqual(manifest["scope"], "/stevora-os")
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(len(manifest["icons"]), 3)
        for icon in manifest["icons"]:
            self.assertTrue(icon["src"].startswith("/stevora_os_static/"))
            filepath = MODULE / "frontend" / icon["src"].split("/stevora_os_static/",1)[1]
            self.assertTrue(filepath.is_file(), icon["src"])
        iconfile = MODULE / "frontend" / "icons" / "stevora-192.png"
        data = iconfile.read_bytes()
        self.assertEqual(data[:8], b"\\x89PNG\\r\\n\\x1a\\n")
        self.assertEqual(int.from_bytes(data[16:20], "big"), 192)
        self.assertEqual(int.from_bytes(data[20:24], "big"), 192)
        for filename in ("stevora-512.svg", "stevora-maskable-512.svg"):
            svg = (MODULE / "frontend" / "icons" / filename).read_text(encoding="utf-8")
            self.assertIn('width="512"', svg)
            self.assertIn("data:image/png;base64,", svg)
        script = CODE.read_text(encoding="utf-8")
        self.assertIn("_mountBrandMetadata()", script)
        self.assertIn("_unmountBrandMetadata()", script)
        self.assertIn("document.head.prepend", script)
        self.assertNotIn("navigator.serviceWorker.register(", script)

    def test_integrations_inventory_read_only_admin(self):
        source = (MODULE / "integrations_api.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertIn("@websocket_api.require_admin", source)
        self.assertIn('stevora_os/system/integrations', source)
        self.assertIn("MAX_ENTRIES = 400", source)
        self.assertIn("configure", source)
        self.assertNotIn("async_remove", source)
        self.assertNotIn("async_reload", source)
        script = CODE.read_text(encoding="utf-8")
        self.assertIn("stevora_os/system/integrations", script)
        self.assertIn("_integrationView(t)", script)

    def test_responsive_css(self):
        css = STYLE.read_text(encoding="utf-8")
        self.assertIn("@media(max-width:760px)", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("focus-visible", css)
        self.assertIn(".os-system-grid", css)
        self.assertIn(".setup-steps", css)
        self.assertIn(".stevora-preferences", css)


if __name__ == "__main__":
    unittest.main()
