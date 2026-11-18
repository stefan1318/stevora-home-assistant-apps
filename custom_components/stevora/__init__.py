"""STEVORA integration with authenticated read-only capability discovery."""
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from pathlib import Path
from .panel import async_register_panel, async_remove_panel
from .const import DOMAIN
from .discovery import build_manifest
from .permissions import project_manifest_for_user
from .modules import panel_requested

@websocket_api.websocket_command({"type": "stevora/manifest"})
@websocket_api.async_response
async def websocket_manifest(hass, connection, msg):
    """Return only entities this authenticated HA user may read/control."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manifest = build_manifest(hass, entries[0])
    connection.send_result(msg["id"], project_manifest_for_user(manifest, connection.user))

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    websocket_api.async_register_command(hass, websocket_manifest)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.setdefault(DOMAIN, {})
    # Static HTTP routes outlive config-entry reloads; avoid duplicate routes.
    if not data.get("_static_registered"):
        await hass.http.async_register_static_paths([
            StaticPathConfig("/stevora_static", str(Path(__file__).parent / "frontend"), False)
        ])
        data["_static_registered"] = True
    state = {"panel_registered": False, "panel_conflict": False}
    if panel_requested(entry):
        state["panel_registered"] = await async_register_panel(hass)
        state["panel_conflict"] = not state["panel_registered"]
    data[entry.entry_id] = state
    entry.async_on_unload(entry.add_update_listener(async_update_options))
    return True

async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    state = hass.data.get(DOMAIN, {}).pop(entry.entry_id, {})
    # A foreign /stevora panel must never be removed by STEVORA unload.
    if isinstance(state, dict) and state.get("panel_registered"):
        await async_remove_panel(hass)
    return True
