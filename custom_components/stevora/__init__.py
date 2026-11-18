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
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = True
    await hass.http.async_register_static_paths([StaticPathConfig("/stevora_static", str(Path(__file__).parent / "frontend"), False)])
    await async_register_panel(hass)
    entry.async_on_unload(entry.add_update_listener(async_update_options))
    return True

async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await async_remove_panel(hass)
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return True
