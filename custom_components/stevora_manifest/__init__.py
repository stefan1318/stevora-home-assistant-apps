"""STEVORA manifest v1: optional authenticated discovery for mobile clients.

Install with `stevora_manifest:` in configuration.yaml.
This integration is read-only and never changes device configuration.
"""
from __future__ import annotations

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry, entity_registry

DOMAIN = "stevora_manifest"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the read-only, admin-scoped discovery command."""
    websocket_api.async_register_command(hass, websocket_manifest)
    return True


@websocket_api.websocket_command({"type": "stevora/manifest"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_manifest(hass: HomeAssistant, connection, msg: dict) -> None:
    """Return areas and entities from this HA installation only."""
    areas = area_registry.async_get(hass)
    entities = entity_registry.async_get(hass)
    rooms = [
        {"id": area.id, "name": area.name}
        for area in sorted(areas.async_list_areas(), key=lambda area: area.name)
    ]
    mappings: dict[str, list[str]] = {room["id"]: [] for room in rooms}
    for entry in entities.entities.values():
        if entry.disabled_by is None and entry.area_id in mappings:
            mappings[entry.area_id].append(entry.entity_id)
    for entity_ids in mappings.values():
        entity_ids.sort()

    # Installation identity must not be derived from the location name.
    # Use Home Assistant's internal instance UUID when available.
    from homeassistant.helpers import instance_id
    installation_id = await instance_id.async_get(hass)
    connection.send_result(msg["id"], {
        "schema_version": "1.0",
        "installation_id": installation_id,
        "revision": 1,
        "preferred_language": hass.config.language or "en",
        "rooms": rooms,
        "mappings": mappings,
    })
