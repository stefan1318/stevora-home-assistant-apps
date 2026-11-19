"""Authenticated Home Hub API. Never bypass Home Assistant entity permissions."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ
from homeassistant.components import websocket_api

from .admin_managers import require_admin
from .const import DOMAIN
from .discovery import build_manifest
from .home_hub import DEFAULT_DOMAINS, HUB_VERSION
from .modules import describe_modules
from .permissions import project_manifest_for_user


def _resolve(hass, connection, msg):
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "STEVORA integration is not configured")
        return None, None
    entry = entries[0]
    state = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    hub = state.get("hub") if isinstance(state, dict) else None
    if hub is None or not hub.active:
        connection.send_error(msg["id"], "hub_not_active", "STEVORA Home Hub is disabled or unavailable")
        return None, None
    return entry, hub


def _visible(hass, entry, user):
    manifest = project_manifest_for_user(build_manifest(hass, entry), user)
    return manifest, {entity["entity_id"] for entity in manifest["entities"]}


@websocket_api.websocket_command({"type": "stevora/hub/status"})
@websocket_api.async_response
async def hub_status(hass, connection, msg):
    entry, hub = _resolve(hass, connection, msg)
    if hub is None:
        return
    manifest, ids = _visible(hass, entry, connection.user)
    current = {item.entity_id: item for item in hass.states.async_all() if item.entity_id in ids}
    unavailable = sum(1 for state in current.values() if state.state in ("unavailable", "unknown"))
    connection.send_result(msg["id"], {
        "installation_id": entry.entry_id,
        "hub_version": HUB_VERSION,
        "status": "active",
        "uptime_seconds": hub.uptime_seconds(),
        "settings_revision": hub.settings["revision"],
        "modules": describe_modules(hass, entry),
        "metrics": {
            "visible_entities": len(ids),
            "unavailable_entities": unavailable,
            "visible_rooms": len(manifest["rooms"]),
            "notifications": len(hub.notifications_for(ids)),
        },
        "capabilities": {
            "event_history": True,
            "local_notifications": True,
            "scene_directory": True,
            "automation_directory": True,
            "module_status": True,
            "settings": bool(connection.user.is_admin),
            "push_notifications": False,
            "remote_module_install": False,
        },
    })


@websocket_api.websocket_command({
    "type": "stevora/hub/events",
    vol.Optional("since", default=0): vol.All(vol.Coerce(int), vol.Range(min=0)),
    vol.Optional("limit", default=40): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
})
@websocket_api.async_response
async def hub_events(hass, connection, msg):
    entry, hub = _resolve(hass, connection, msg)
    if hub is None:
        return
    _, ids = _visible(hass, entry, connection.user)
    events = hub.events_for(ids, limit=msg.get("limit", 40), since=msg.get("since", 0))
    connection.send_result(msg["id"], {
        "installation_id": entry.entry_id,
        "events": events,
        "notifications": hub.notifications_for(ids),
    })


@websocket_api.websocket_command({"type": "stevora/hub/scenes"})
@websocket_api.async_response
async def hub_scenes(hass, connection, msg):
    entry, hub = _resolve(hass, connection, msg)
    if hub is None:
        return
    user = connection.user
    result = []
    for entity in hass.states.async_all():
        domain = entity.entity_id.split(".", 1)[0]
        if domain not in ("scene", "script", "automation"):
            continue
        if not user.is_admin and not user.permissions.check_entity(entity.entity_id, POLICY_READ):
            continue
        allowed = bool(user.is_admin or user.permissions.check_entity(entity.entity_id, POLICY_CONTROL))
        result.append({
            "entity_id": entity.entity_id,
            "name": str(entity.attributes.get("friendly_name", entity.entity_id))[:120],
            "domain": domain,
            "state": str(entity.state)[:40],
            "action_allowed": allowed and domain == "scene",
        })
    connection.send_result(msg["id"], {
        "installation_id": entry.entry_id,
        "items": sorted(result, key=lambda item: item["name"].casefold())[:300],
        # HA frontend callService is the only activation path; Hub is never
        # a privileged service proxy for authenticated non-admin users.
        "execution": "home_assistant_service",
    })


@websocket_api.websocket_command({"type": "stevora/hub/config/get"})
@websocket_api.async_response
async def hub_config_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    _, hub = _resolve(hass, connection, msg)
    if hub is None:
        return
    connection.send_result(msg["id"], dict(hub.settings))


@websocket_api.websocket_command({
    "type": "stevora/hub/config/update",
    vol.Required("expected_revision"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    vol.Optional("track_events"): bool,
    vol.Optional("notifications_enabled"): bool,
    vol.Optional("notify_unavailable"): bool,
    vol.Optional("notify_recovered"): bool,
    vol.Optional("tracked_domains"): [vol.In(DEFAULT_DOMAINS)],
})
@websocket_api.async_response
async def hub_config_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    _, hub = _resolve(hass, connection, msg)
    if hub is None:
        return
    allowed_keys = ("track_events", "notifications_enabled", "notify_unavailable",
                    "notify_recovered", "tracked_domains")
    patch = {key: msg[key] for key in allowed_keys if key in msg}
    if not patch:
        connection.send_error(msg["id"], "empty_update", "No configuration changes supplied")
        return
    settings = await hub.async_configure(msg["expected_revision"], patch)
    if settings is None:
        connection.send_error(msg["id"], "conflict", "Hub settings revision changed")
        return
    connection.send_result(msg["id"], {"revision": settings["revision"], "settings": settings})


def register(hass):
    for command in (hub_status, hub_events, hub_scenes, hub_config_get, hub_config_update):
        websocket_api.async_register_command(hass, command)
