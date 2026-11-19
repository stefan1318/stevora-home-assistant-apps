"""Standalone assistant manager policy tests with stubbed HA Assist API."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/assistant_manager.py"


class AssistantManagerTests(unittest.TestCase):
    def setUp(self):
        pipeline_module = types.ModuleType("homeassistant.components.assist_pipeline")
        pipeline_module.async_get_pipelines = lambda hass: hass.pipelines
        components = types.ModuleType("homeassistant.components")
        components.assist_pipeline = pipeline_module
        self.patch = patch.dict(sys.modules, {
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.components": components,
            "homeassistant.components.assist_pipeline": pipeline_module,
        })
        self.patch.start()
        spec = importlib.util.spec_from_file_location("stevora_assistant_policy_test", SOURCE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def tearDown(self):
        self.patch.stop()

    def test_real_pipeline_inventory(self):
        hass = types.SimpleNamespace(pipelines=[
            types.SimpleNamespace(id="local", name="Local"),
            types.SimpleNamespace(id="ai", name="AI"),
        ])
        self.assertEqual(self.module.available_pipelines(hass), [
            {"id": "local", "name": "Local"},
            {"id": "ai", "name": "AI"},
        ])

    def test_rejects_nonexistent_pipeline_and_user(self):
        valid = {"local", "ai"}
        users = {"user1"}
        validate = self.module.validate_assistant_settings
        self.assertIsNotNone(validate(
            {"default_pipeline": "unknown", "user_pipelines": {}}, valid, users
        ))
        self.assertIsNotNone(validate(
            {"default_pipeline": "local", "user_pipelines": {"fake": "ai"}}, valid, users
        ))
        self.assertIsNotNone(validate(
            {"default_pipeline": "local", "user_pipelines": {"user1": "deleted"}}, valid, users
        ))
        self.assertIsNone(validate(
            {"default_pipeline": "local", "user_pipelines": {"user1": "ai"}}, valid, users
        ))

    def test_per_user_override_and_safe_fallback(self):
        settings = {"default_pipeline": "local", "user_pipelines": {"user1": "ai"}}
        resolve = self.module.resolve_pipeline
        self.assertEqual(resolve(settings, "user1", {"local", "ai"}), "ai")
        self.assertEqual(resolve(settings, "user2", {"local", "ai"}), "local")
        self.assertEqual(resolve(settings, "user1", {"local"}), "local")
        self.assertIsNone(resolve(settings, "user1", set()))


if __name__ == "__main__":
    unittest.main()
