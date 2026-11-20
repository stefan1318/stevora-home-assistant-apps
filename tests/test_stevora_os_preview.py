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
        self.assertEqual(manifest["version"], "0.1.0")
        self.assertIn("panel_custom", manifest["dependencies"])
        self.assertNotIn("stevora", manifest["dependencies"])

    def test_python_is_valid(self):
        source = (MODULE / "__init__.py").read_text(encoding="utf-8")
        ast.parse(source)
        self.assertIn('PANEL_PATH = "stevora-os"', source)
        self.assertIn("frontend.async_panel_exists", source)
        self.assertIn("require_admin=False", source)
        self.assertNotIn("async_remove_panel", source)

    def test_frontend_does_not_issue_device_commands(self):
        script = CODE.read_text(encoding="utf-8")
        self.assertIn('type: "stevora/manifest"', script)
        self.assertIn("this._manifest?.entities", script)
        self.assertNotIn("callService(", script)
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

    def test_responsive_css(self):
        css = STYLE.read_text(encoding="utf-8")
        self.assertIn("@media(max-width:760px)", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("focus-visible", css)


if __name__ == "__main__":
    unittest.main()
