"""STEVORA OS Developer Preview: opt-in presentation shell for HA OS.

Does not replace HA OS, Core, authentication, update providers or /stevora.
Enable only on an independent test instance using 'stevora_os:' in YAML.
"""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from .system_api import register as register_system_status
from .preferences import Preferences, register as register_preferences

_LOGGER = logging.getLogger(__name__)
DOMAIN = "stevora_os"
PANEL_PATH = "stevora-os"
PANEL_COMPONENT = "stevora-os-preview"
PANEL_MODULE = "/stevora_os_static/stevora-os.js?v=1.0.0-alpha.1"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register a completely separate STEVORA OS preview panel."""
    state = hass.data.setdefault(DOMAIN, {})
    preferences = Preferences(hass)
    await preferences.async_load()
    state["preferences"] = preferences
    register_system_status(hass)
    register_preferences(hass)
    if not state.get("static_registered"):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    "/stevora_os_static",
                    str(Path(__file__).parent / "frontend"),
                    False,
                )
            ]
        )
        state["static_registered"] = True

    # Never remove or overwrite someone else's route.
    if frontend.async_panel_exists(hass, PANEL_PATH):
        _LOGGER.warning("STEVORA OS preview route /%s is already used", PANEL_PATH)
        state["status"] = "conflict"
        return True

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_COMPONENT,
        frontend_url_path=PANEL_PATH,
        module_url=PANEL_MODULE,
        sidebar_title="STEVORA OS",
        sidebar_icon="mdi:monitor-dashboard",
        require_admin=False,
        config={"preview_version": "1.0.0-alpha.1"},
    )
    state["status"] = "active"
    return True
