"""Dependency-free contract checks. Not a Home Assistant integration test."""
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]

class ContractTests(unittest.TestCase):
    def test_manifest(self):
        m = json.loads((ROOT / "custom_components/stevora/manifest.json").read_text())
        self.assertEqual(m["domain"], "stevora")
        self.assertTrue(m["config_flow"])

    def test_translations(self):
        for language in ("bg", "en"):
            content = json.loads((ROOT / f"custom_components/stevora/translations/{language}.json").read_text())
            self.assertIn("config", content)
            self.assertIn("options", content)

    def test_sample_has_no_secrets(self):
        sample = json.loads((ROOT / "docs/STEVORA_CAPABILITY_MANIFEST_EXAMPLE.json").read_text())
        self.assertEqual(sample["schema_version"], "1.0")
        self.assertNotIn("access_token", sample)
        self.assertNotIn("password", sample)

if __name__ == "__main__":
    unittest.main()
