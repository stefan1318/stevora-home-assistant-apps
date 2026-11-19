"""Isolated smoke tests for setup/options flow. Real HA runtime test is separate."""
import asyncio
import importlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

COMP = Path(__file__).resolve().parents[2] / "custom_components/stevora"


class _Key:
    def __init__(self, name, default=None):
        self.name = name
        self.default = default

    def __hash__(self):
        return hash(self.name)

    def __eq__(self, other):
        return isinstance(other, _Key) and self.name == other.name


class _FlowBase:
    def __init_subclass__(cls, **kwargs):
        kwargs.pop("domain", None)
        super().__init_subclass__(**kwargs)

    async def async_set_unique_id(self, value):
        self.unique_id = value

    def _abort_if_unique_id_configured(self):
        pass

    def async_create_entry(self, **kwargs):
        return {"type": "create_entry", **kwargs}

    def async_show_form(self, **kwargs):
        return {"type": "form", **kwargs}


class ConfigFlowRuntimeTests(unittest.TestCase):
    def setUp(self):
        vol = types.ModuleType("voluptuous")
        vol.Schema = lambda schema: schema
        vol.Required = lambda key, default=None: _Key(key, default)
        vol.Optional = lambda key, default=None: _Key(key, default)
        vol.In = lambda choices: tuple(choices)

        entries = types.ModuleType("homeassistant.config_entries")
        entries.ConfigFlow = type("ConfigFlow", (_FlowBase,), {})
        entries.OptionsFlow = type("OptionsFlow", (_FlowBase,), {})
        selector = types.ModuleType("homeassistant.helpers.selector")
        selector.AreaSelectorConfig = lambda **kwargs: kwargs
        selector.EntitySelectorConfig = lambda **kwargs: kwargs
        selector.AreaSelector = lambda cfg: cfg
        selector.EntitySelector = lambda cfg: cfg
        helpers = types.ModuleType("homeassistant.helpers")
        helpers.selector = selector
        package = types.ModuleType("stevora_configflow_testpkg")
        package.__path__ = [str(COMP)]

        modules = {
            "voluptuous": vol,
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.config_entries": entries,
            "homeassistant.helpers": helpers,
            "homeassistant.helpers.selector": selector,
            package.__name__: package,
        }
        self.module_patch = patch.dict(sys.modules, modules)
        self.module_patch.start()
        self.module = importlib.import_module("stevora_configflow_testpkg.config_flow")

    def tearDown(self):
        sys.modules.pop("stevora_configflow_testpkg.config_flow", None)
        sys.modules.pop("stevora_configflow_testpkg.const", None)
        self.module_patch.stop()

    def test_new_install_form_and_settings(self):
        flow = self.module.StevoraConfigFlow()
        result = asyncio.run(flow.async_step_user())
        self.assertEqual(result["type"], "form")
        self.assertEqual(flow.unique_id, "stevora_home")
        keys = {item.name: item.default for item in result["data_schema"]}
        self.assertEqual(keys["language"], "bg")
        self.assertTrue(keys["auto_discovery"])
        self.assertTrue(keys["panel_enabled"])
        self.assertTrue(keys["home_hub_enabled"])
        self.assertFalse(keys["voice_enabled"])

        values = {"language": "en", "auto_discovery": True, "panel_enabled": False, "voice_enabled": False}
        saved = asyncio.run(flow.async_step_user(values))
        self.assertEqual(saved["type"], "create_entry")
        self.assertEqual(saved["data"], values)

    def test_options_form_and_save(self):
        flow = self.module.StevoraConfigFlow.async_get_options_flow(None)
        flow.config_entry = types.SimpleNamespace(
            data={"language": "bg", "voice_enabled": False, "auto_discovery": True},
            options={"language": "en", "voice_enabled": True, "room_filter": ["kitchen"]},
        )
        result = asyncio.run(flow.async_step_init())
        keys = {item.name: item.default for item in result["data_schema"]}
        self.assertEqual(keys["language"], "en")
        self.assertTrue(keys["voice_enabled"])
        self.assertTrue(keys["panel_enabled"])
        self.assertTrue(keys["home_hub_enabled"])
        self.assertEqual(keys["room_filter"], ["kitchen"])
        self.assertIn("climate_entities", keys)
        self.assertIn("lighting_entities", keys)
        saved = asyncio.run(flow.async_step_init({"language": "bg"}))
        self.assertEqual(saved["data"], {"language": "bg"})


if __name__ == "__main__":
    unittest.main()
