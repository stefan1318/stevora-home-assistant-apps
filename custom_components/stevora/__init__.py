"""STEVORA integration: capability discovery, premium panel and local Home Hub."""
import logging
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry, SOURCE_IMPORT
from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from pathlib import Path
import voluptuous as vol
from .panel import async_register_panel, async_remove_panel
from .const import DOMAIN
from .discovery import build_manifest
from .permissions import project_manifest_for_user
from .panel_generator import generate_panel
from .localization import localized_manifest
from .modules import panel_requested, home_hub_requested
from .home_hub import HomeHub
from .hub_api import register as register_hub_commands

_LOGGER = logging.getLogger(__name__)
from .admin_managers import AdminManagers
from .admin_api import register as register_admin_commands

@websocket_api.websocket_command({"type": "stevora/manifest", vol.Optional("language"): vol.In(("bg", "en"))})
@websocket_api.async_response
async def websocket_manifest(hass, connection, msg):
    await send_manifest(hass, connection, msg)


async def send_manifest(hass, connection, msg):
    """Return only entities this authenticated HA user may read/control."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manifest = build_manifest(hass, entries[0])
    scoped = project_manifest_for_user(manifest, connection.user)
    connection.send_result(msg["id"], localized_manifest(scoped, msg.get("language") or scoped.get("preferred_language", "en")))

@websocket_api.websocket_command({"type": "stevora/os/v1/manifest", vol.Optional("language"): vol.In(("bg", "en"))})
@websocket_api.async_response
async def websocket_os_manifest(hass, connection, msg):
    """Versioned OS client API with the same per-user projection as legacy clients."""
    await send_manifest(hass, connection, msg)


@websocket_api.websocket_command({"type": "stevora/panel/generate", vol.Optional("language"): vol.In(("bg", "en"))})
@websocket_api.async_response
async def websocket_panel_generate(hass, connection, msg):
    """Generate a fresh v7.1.1 panel for this user's visible HA entities."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manifest = project_manifest_for_user(build_manifest(hass, entries[0]), connection.user)
    connection.send_result(msg["id"], generate_panel(localized_manifest(manifest, msg.get("language") or manifest.get("preferred_language", "en"))))


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    websocket_api.async_register_command(hass, websocket_manifest)
    websocket_api.async_register_command(hass, websocket_panel_generate)
    websocket_api.async_register_command(hass, websocket_os_manifest)
    register_admin_commands(hass)
    register_hub_commands(hass)
    manager = AdminManagers(hass)
    await manager.load()
    hass.data.setdefault(DOMAIN, {})["_admin_managers"] = manager
    native = config.get(DOMAIN, {})
    # Image-provided config marker, never automatically applied to an existing
    # HA setup unless an explicitly pinned native image installed it.
    if isinstance(native, dict) and native.get("native_bootstrap") is True:
        if not hass.config_entries.async_entries(DOMAIN):
            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": SOURCE_IMPORT},
                    data={},
                ),
                "STEVORA native adapter bootstrap",
            )
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
    if home_hub_requested(entry):
        hub = HomeHub(hass, entry)
        try:
            await hub.async_start()
        except Exception:
            _LOGGER.exception("STEVORA Home Hub startup failed; controls remain in HA")
            state["hub_status"] = "error"
        else:
            state["hub"] = hub
            state["hub_status"] = "active"
    else:
        state["hub_status"] = "disabled"
    entry.async_on_unload(entry.add_update_listener(async_update_options))
    return True

async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    state = hass.data.get(DOMAIN, {}).pop(entry.entry_id, {})
    hub = state.get("hub") if isinstance(state, dict) else None
    if hub is not None:
        await hub.async_stop()
    # A foreign /stevora panel must never be removed by STEVORA unload.
    if isinstance(state, dict) and state.get("panel_registered"):
        await async_remove_panel(hass)
    return True
