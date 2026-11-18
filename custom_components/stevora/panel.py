"""Register the STEVORA custom panel inside Home Assistant."""
from homeassistant.components import frontend, panel_custom

PANEL_URL = "/stevora"
PANEL_NAME = "stevora-home-panel"
PANEL_MODULE = "/stevora_static/stevora-panel.js"

async def async_register_panel(hass):
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_NAME,
        frontend_url_path=PANEL_URL.lstrip("/"),
        module_url=PANEL_MODULE,
        sidebar_title="STEVORA",
        sidebar_icon="mdi:home-automation",
        require_admin=False,
        config={},
    )

async def async_remove_panel(hass):
    frontend.async_remove_panel(hass, frontend_url_path=PANEL_URL.lstrip("/"), warn_if_unknown=False)
