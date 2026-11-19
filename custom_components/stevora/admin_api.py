"""Admin-only STEVORA room layout and assistant pipeline configuration APIs."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers import entity_registry

from .admin_managers import require_admin
from .discovery import build_manifest


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
        "assistant_manager": False,
        "schema_version": "1.0",
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
    updates = dict(manager.data["visibility"])
    for item in patches:
        entity_id, mode = item["entity_id"], item["visibility"]
        if mode == "default":
            updates.pop(entity_id, None)
        else:
            updates[entity_id] = mode
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        new_state = dict(manager.data)
        new_state["visibility"] = updates
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({"type": "stevora/admin/assistants/get"})
@websocket_api.async_response
async def assistants_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    # Pipeline inventory is obtained from HA's native Assist pipeline API by the client.
    connection.send_result(msg["id"], {
        "revision": manager.data["revision"],
        "settings": manager.data["assistants"],
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/assistants/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Optional("default_pipeline", default=None): vol.Any(str, None),
    vol.Optional("user_pipelines", default={}): {str: str},
})
@websocket_api.async_response
async def assistants_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    # Fail closed until server validates real HA Assist pipelines and applies
    # these preferences to effective conversation routing.
    connection.send_error(
        msg["id"], "not_implemented", "Assistant routing validation is not yet available"
    )


def register(hass):
    for command in (capabilities, rooms_get, rooms_update, assistants_get, assistants_update):
        websocket_api.async_register_command(hass, command)
