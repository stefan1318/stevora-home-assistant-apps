"""Dependency-free checks; full HA runtime tests remain mandatory."""
import ast
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
COMP = ROOT / "custom_components/stevora"

class ContractTests(unittest.TestCase):
    def test_manifest(self):
        m = json.loads((COMP / "manifest.json").read_text())
        self.assertEqual(m["domain"], "stevora")
        self.assertTrue(m["config_flow"])

    def test_translations(self):
        for language in ("bg", "en"):
            content = json.loads((COMP / f"translations/{language}.json").read_text())
            self.assertIn("config", content)
            self.assertIn("options", content)

    def test_python_syntax(self):
        for file in COMP.glob("*.py"):
            ast.parse(file.read_text(), filename=str(file))

    def test_websocket_filters_by_user_permissions(self):
        code = (COMP / "__init__.py").read_text()
        permissions = (COMP / "permissions.py").read_text()
        self.assertIn("project_manifest_for_user(manifest, connection.user)", code)
        self.assertIn("stevora/manifest", code)
        self.assertIn("POLICY_READ", permissions)
        self.assertIn("POLICY_CONTROL", permissions)

    def test_universal_manifest_room_mapping_contract(self):
        code = (COMP / "discovery.py").read_text()
        self.assertIn('mappings = {room["id"]: [] for room in rooms}', code)
        self.assertIn('mappings[area_id].append(entity.entity_id)', code)
        self.assertIn('"domain_mappings":', code)
        self.assertIn('"entities":', code)
        self.assertIn('if entity.disabled_by is not None or entity.hidden_by is not None:', code)

    def test_panel_fails_closed_and_excludes_backlights(self):
        code = (COMP / "frontend/stevora-panel.js").read_text()
        self.assertIn('if (this._mode !== "stevora" || !this._manifest) return [];', code)
        self.assertIn('if (!allowed.has(x.entity_id)) return false;', code)
        self.assertIn('/backlight/i.test(x.entity_id)', code)
        self.assertIn('this._hass.callService(', code)
        self.assertIn('controllable.has(card.entity_id)', code)
        self.assertIn('stevora/panel/generate', code)

    def test_sample_has_no_secrets(self):
        sample = json.loads((ROOT / "docs/STEVORA_CAPABILITY_MANIFEST_EXAMPLE.json").read_text())
        self.assertEqual(sample["schema_version"], "1.0")
        self.assertNotIn("access_token", sample)
        self.assertNotIn("password", sample)

if __name__ == "__main__":
    unittest.main()
