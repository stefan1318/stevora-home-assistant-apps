"""Admin-only STEVORA room layout and assistant pipeline configuration APIs."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers import entity_registry, area_registry

from .admin_managers import require_admin
from .assistant_manager import available_pipelines, validate_assistant_settings, resolve_pipeline
from .discovery import build_manifest
from .device_customization import validate_profile, normalize_profile


def _manager(hass):
    return hass.data["stevora"]["_admin_managers"]


def _entry(hass):
    entries = hass.config_entries.async_entries("stevora")
    return entries[0] if entries else None


@websocket_api.websocket_command({"type": "stevora/admin/capabilities"})
@websocket_api.async_response
async def capabilities(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    connection.send_result(msg["id"], {
        "room_manager": True,
        "assistant_manager": True,
        "schema_version": "1.1",
        "device_customization": True,
    })


@websocket_api.websocket_command({"type": "stevora/admin/rooms/get"})
@websocket_api.async_response
async def rooms_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    entry = _entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manager = _manager(hass)
    manifest = build_manifest(hass, entry)
    registry = entity_registry.async_get(hass)
    included = {item["entity_id"] for item in manifest["entities"]}
    inventory = []
    for entity in registry.entities.values():
        if entity.entity_id.split(".", 1)[0] not in ("climate", "light", "switch", "cover", "media_player", "sensor", "binary_sensor", "fan", "lock"):
            continue
        inventory.append({
            "entity_id": entity.entity_id,
            "name": entity.name or entity.original_name or entity.entity_id,
            "included": entity.entity_id in included,
            "disabled": entity.disabled_by is not None,
            "hidden": entity.hidden_by is not None,
        })
    connection.send_result(msg["id"], {
        "revision": manager.data["revision"],
        "rooms": manifest["rooms"],
        "entities": sorted(inventory, key=lambda item: item["entity_id"]),
        "visibility": manager.data["visibility"],
        "room_aliases": manager.data.get("room_aliases", {}),
        "room_order": manager.data.get("room_order", []),
        "entity_aliases": manager.data.get("entity_aliases", {}),
        "device_profiles": manager.data.get("device_profiles", {}),
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/rooms/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("entities"): [
        {
            vol.Required("entity_id"): str,
            vol.Required("visibility"): vol.In(("default", "include", "exclude")),
        }
    ],
})
@websocket_api.async_response
async def rooms_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    if msg["expected_revision"] != manager.data["revision"]:
        connection.send_error(msg["id"], "conflict", "Configuration revision changed")
        return
    registry = entity_registry.async_get(hass)
    available = set(registry.entities)
    patches = msg["entities"]
    if len(patches) > 500 or any(item["entity_id"] not in available for item in patches):
        connection.send_error(msg["id"], "invalid_entity", "Entity is unknown or request is too large")
        return
    # A disabled/hidden HA entity cannot be made visible through STEVORA.
    if any(item["visibility"] == "include" and (registry.entities[item["entity_id"]].disabled_by is not None or registry.entities[item["entity_id"]].hidden_by is not None) for item in patches):
        connection.send_error(msg["id"], "invalid_entity", "Cannot expose disabled or hidden HA entities")
        return
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        updates = dict(manager.data["visibility"])
        for item in patches:
            entity_id, mode = item["entity_id"], item["visibility"]
            if mode == "default":
                updates.pop(entity_id, None)
            else:
                updates[entity_id] = mode
        new_state = dict(manager.data)
        new_state["visibility"] = updates
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({
    "type": "stevora/admin/rooms/aliases/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("room_aliases"): {str: str},
    vol.Optional("room_order"): [str],
    vol.Required("entity_aliases"): {str: str},
})
@websocket_api.async_response
async def room_aliases_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    room_aliases = msg["room_aliases"]
    room_order = msg.get("room_order")
    entity_aliases = msg["entity_aliases"]
    if len(room_aliases) > 200 or len(entity_aliases) > 1000 or (room_order is not None and len(room_order) > 200):
        connection.send_error(msg["id"], "invalid_alias", "Too many aliases")
        return
    area_ids = {area.id for area in area_registry.async_get(hass).async_list_areas()}
    entity_ids = set(entity_registry.async_get(hass).entities)
    if room_order is not None and (len(room_order) != len(set(room_order)) or any(key not in area_ids for key in room_order)):
        connection.send_error(msg["id"], "invalid_order", "Unknown or duplicate room in ordering")
        return
    if any(key not in area_ids or len(value.strip()) > 80 for key, value in room_aliases.items()) or any(
        key not in entity_ids or len(value.strip()) > 80 for key, value in entity_aliases.items()
    ):
        connection.send_error(msg["id"], "invalid_alias", "Unknown room/entity or alias too long")
        return
    manager = _manager(hass)
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        new_state = dict(manager.data)
        if room_order is not None:
            new_state["room_order"] = list(room_order)
        new_state["room_aliases"] = {key: value.strip() for key, value in room_aliases.items() if value.strip()}
        new_state["entity_aliases"] = {key: value.strip() for key, value in entity_aliases.items() if value.strip()}
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({
    "type": "stevora/admin/devices/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("profiles"): {str: vol.Any(dict, None)},
})
@websocket_api.async_response
async def devices_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    patches = msg["profiles"]
    if len(patches) > 500:
        connection.send_error(msg["id"], "invalid_profile", "Too many device profiles")
        return
    registry = entity_registry.async_get(hass)
    valid_areas = {area.id for area in area_registry.async_get(hass).async_list_areas()}
    users = await hass.auth.async_get_users()
    user_ids = {user.id for user in users if user.is_active}
    for entity_id, profile in patches.items():
        if entity_id not in registry.entities:
            connection.send_error(msg["id"], "invalid_entity", "Unknown device entity")
            return
        if profile is None:
            continue
        error = validate_profile(entity_id, profile, valid_areas)
        if error or any(user not in user_ids for user in profile.get("user_ids", [])):
            connection.send_error(msg["id"], "invalid_profile", error or "Unknown user")
            return
    manager = _manager(hass)
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        profiles = dict(manager.data.get("device_profiles", {}))
        for entity_id, profile in patches.items():
            if profile is None:
                profiles.pop(entity_id, None)
            else:
                profiles[entity_id] = normalize_profile(profile)
        new_state = dict(manager.data)
        new_state["device_profiles"] = profiles
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({"type": "stevora/admin/assistants/get"})
@websocket_api.async_response
async def assistants_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    pipelines = available_pipelines(hass)
    users = await hass.auth.async_get_users()
    connection.send_result(msg["id"], {
        "users": sorted([{"id": user.id, "name": user.name or user.id} for user in users if user.is_active], key=lambda item: item["name"].casefold()),
        "revision": manager.data["revision"],
        "settings": manager.data["assistants"],
        "pipelines": pipelines,
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/assistants/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("default_pipeline"): vol.Any(str, None),
    vol.Required("user_pipelines"): {str: str},
})
@websocket_api.async_response
async def assistants_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    settings = {
        "default_pipeline": msg["default_pipeline"],
        "user_pipelines": msg["user_pipelines"],
    }
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        pipeline_ids = {item["id"] for item in available_pipelines(hass)}
        users = await hass.auth.async_get_users()
        user_ids = {user.id for user in users if user.is_active}
        error = validate_assistant_settings(settings, pipeline_ids, user_ids)
        if error:
            connection.send_error(msg["id"], "invalid_assistant", error)
            return
        new_state = dict(manager.data)
        new_state["assistants"] = settings
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({"type": "stevora/assistants/resolve"})
@websocket_api.async_response
async def assistants_resolve(hass, connection, msg):
    """Resolve only the invoking user's preference, never expose other users."""
    if _entry(hass) is None:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manager = _manager(hass)
    pipelines = available_pipelines(hass)
    selected = resolve_pipeline(
        manager.data["assistants"], connection.user.id,
        {item["id"] for item in pipelines},
    )
    connection.send_result(msg["id"], {
        "pipeline_id": selected,
        "source": "stevora" if selected else "home_assistant_default",
    })


def register(hass):
    for command in (capabilities, rooms_get, rooms_update, room_aliases_update, devices_update, assistants_get, assistants_update, assistants_resolve):
        websocket_api.async_register_command(hass, command)
