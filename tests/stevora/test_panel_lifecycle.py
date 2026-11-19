"""Exercise panel registration/removal through mocked HA APIs."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/panel.py"


class PanelLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.operations = []
        self.panel_exists = False
        components = types.ModuleType("homeassistant.components")
        frontend = types.ModuleType("homeassistant.components.frontend")
        panel_custom = types.ModuleType("homeassistant.components.panel_custom")

        async def register_panel(hass, **kwargs):
            self.operations.append(("register", kwargs))
        def remove_panel(hass, **kwargs):
            self.operations.append(("remove", kwargs))

        panel_custom.async_register_panel = register_panel
        frontend.async_remove_panel = remove_panel
        frontend.async_panel_exists = lambda hass, route: self.panel_exists
        components.panel_custom = panel_custom
        components.frontend = frontend
        modules = {
            "homeassistant": types.ModuleType("homeassistant"),
            "homeassistant.components": components,
            "homeassistant.components.frontend": frontend,
            "homeassistant.components.panel_custom": panel_custom,
        }
        self.module_patch = patch.dict(sys.modules, modules)
        self.module_patch.start()
        spec = importlib.util.spec_from_file_location("stevora_panel_runtime_test", SOURCE)
        self.panel = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.panel)

    def tearDown(self):
        self.module_patch.stop()

    def test_panel_install_and_unload(self):
        hass = object()
        self.assertTrue(asyncio.run(self.panel.async_register_panel(hass)))
        self.assertEqual(self.operations[0][0], "register")
        params = self.operations[0][1]
        self.assertEqual(params["frontend_url_path"], "stevora")
        self.assertFalse(params["require_admin"])
        self.assertEqual(params["module_url"], "/stevora_static/stevora-panel.js?v=7.1.1-rc2")
        asyncio.run(self.panel.async_remove_panel(hass))
        self.assertEqual(self.operations[1], ("remove", {
            "frontend_url_path": "stevora",
            "warn_if_unknown": False,
        }))

    def test_existing_panel_route_must_never_be_overwritten(self):
        self.panel_exists = True
        result = asyncio.run(self.panel.async_register_panel(object()))
        self.assertFalse(result)
        self.assertEqual(self.operations, [])



if __name__ == "__main__":
    unittest.main()
