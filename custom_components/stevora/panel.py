"""Register the STEVORA custom panel inside Home Assistant."""
from homeassistant.components import frontend, panel_custom

PANEL_URL = "/stevora"
PANEL_NAME = "stevora-home-panel"
PANEL_MODULE = "/stevora_static/stevora-panel.js?v=7.1.1-rc2"

async def async_register_panel(hass) -> bool:
    """Claim /stevora only if no other panel already owns that route."""
    if frontend.async_panel_exists(hass, PANEL_URL.lstrip("/")):
        return False
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
    return True

async def async_remove_panel(hass):
    frontend.async_remove_panel(hass, frontend_url_path=PANEL_URL.lstrip("/"), warn_if_unknown=False)
