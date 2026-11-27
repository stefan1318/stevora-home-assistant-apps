"""STEVORA integration: capability discovery, premium panel and local Home Hub."""
import logging
from homeassistant.core import HomeAssistant, callback
from homeassistant.config_entries import ConfigEntry, SOURCE_IMPORT
from homeassistant.components import websocket_api
from homeassistant.components.http import StaticPathConfig
from pathlib import Path
import voluptuous as vol
from .panel import async_register_panel, async_remove_panel
from .const import DOMAIN
from .discovery import build_manifest
from .adaptive_api import register as register_adaptive_commands
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


@websocket_api.websocket_command({"type": "stevora/os/v1/people"})
@websocket_api.async_response
async def websocket_people(hass, connection, msg):
    """Resolve mobile fixes through authenticated registrations or explicit person links."""
    from homeassistant.auth.permissions.const import POLICY_READ
    from homeassistant.helpers import entity_registry as er

    allowed = lambda entity_id: connection.user.permissions.check_entity(entity_id, POLICY_READ)
    registry = er.async_get(hass)
    registrations = {entry.entry_id: entry.data.get("user_id") for entry in hass.config_entries.async_entries("mobile_app")}
    phones = []
    for tracker in hass.states.async_all("device_tracker"):
        entry = registry.async_get(tracker.entity_id)
        attrs = tracker.attributes
        if (not entry or entry.platform != "mobile_app" or not allowed(tracker.entity_id)
                or tracker.state in ("unknown", "unavailable")
                or attrs.get("source_type") != "gps"
                or not all(isinstance(attrs.get(key), (float, int)) for key in ("latitude", "longitude"))):
            continue
        phones.append((registrations.get(entry.config_entry_id), tracker))
    people = []
    linked_users = set()
    for person in hass.states.async_all("person"):
        linked_users.add(person.attributes.get("user_id"))
        if not allowed(person.entity_id):
            continue
        attrs = person.attributes
        linked = set(attrs.get("device_trackers") or ())
        linked.add(attrs.get("source"))
        fixes = [t for owner, t in phones if t.entity_id in linked or (owner and owner == attrs.get("user_id"))]
        data = {"friendly_name": attrs.get("friendly_name") or person.name}
        stamp = person.last_updated
        if fixes:
            fix = max(fixes, key=lambda t: t.last_updated)
            data.update({key: fix.attributes[key] for key in ("latitude", "longitude", "gps_accuracy") if key in fix.attributes})
            stamp = fix.last_updated
        people.append({"entity_id": person.entity_id, "state": person.state, "attributes": data, "last_updated": stamp.isoformat()})
    # Some installations have registered phones before creating person records.
    # Never reconstruct a hidden person's location through this fallback.
    for user in await hass.auth.async_get_users():
        if (user.id in linked_users or not user.is_active or user.system_generated
                or (not connection.user.is_admin and user.id != connection.user.id)):
            continue
        fixes = [t for owner, t in phones if owner == user.id]
        if not fixes:
            continue
        fix = max(fixes, key=lambda t: t.last_updated)
        data = {key: fix.attributes[key] for key in ("latitude", "longitude", "gps_accuracy") if key in fix.attributes}
        data["friendly_name"] = user.name or fix.name
        people.append({"entity_id": fix.entity_id, "state": fix.state, "attributes": data, "last_updated": fix.last_updated.isoformat()})
    connection.send_result(msg["id"], people)


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


@websocket_api.websocket_command({"type": "stevora/os/v1/manifest/subscribe"})
@callback
def subscribe_manifest(hass, connection, msg):
    """An invalidation contains no registry data. Each client refetches its projection."""
    @callback
    def changed(_event):
        connection.send_event(msg["id"], {"manifest_changed": True})

    subscriptions = [
        hass.bus.async_listen(event, changed)
        for event in ("stevora_manifest_changed", "area_registry_updated",
                      "device_registry_updated", "entity_registry_updated",
                      "core_config_updated")
    ]

    @callback
    def unsubscribe():
        for remove in subscriptions:
            remove()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    websocket_api.async_register_command(hass, websocket_manifest)
    websocket_api.async_register_command(hass, websocket_panel_generate)
    websocket_api.async_register_command(hass, websocket_os_manifest)
    websocket_api.async_register_command(hass, websocket_people)
    websocket_api.async_register_command(hass, subscribe_manifest)
    register_admin_commands(hass)
    register_adaptive_commands(hass)
    register_hub_commands(hass)
    manager = AdminManagers(hass)
    await manager.load()
    hass.data.setdefault(DOMAIN, {})["_admin_managers"] = manager
    native = config.get(DOMAIN, {})
    # Image-provided config marker, never automatically applied to an existing
    # HA setup unless an explicitly pinned native image installed it.
    if isinstance(native, dict) and native.get("native_bootstrap") is True:
        from .native_admin import NativeAdminView
        hass.http.register_view(NativeAdminView)
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
    hass.bus.async_fire("stevora_manifest_changed")

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    state = hass.data.get(DOMAIN, {}).pop(entry.entry_id, {})
    hub = state.get("hub") if isinstance(state, dict) else None
    if hub is not None:
        await hub.async_stop()
    # A foreign /stevora panel must never be removed by STEVORA unload.
    if isinstance(state, dict) and state.get("panel_registered"):
        await async_remove_panel(hass)
    return True
