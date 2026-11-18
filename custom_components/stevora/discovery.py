"""Read-only device discovery. Full manifest is restricted to HA administrators."""
import json
import zlib
from homeassistant.helpers import area_registry, device_registry, entity_registry
from .const import SCHEMA_VERSION, CONF_LANGUAGE, DEFAULT_LANGUAGE

SUPPORTED_DOMAINS = {
    "climate": "climate", "light": "lighting", "switch": "switches",
    "cover": "covers", "media_player": "media", "sensor": "sensors",
    "binary_sensor": "binary_sensors", "fan": "fans", "lock": "locks",
}
def build_manifest(hass, entry):
    areas = area_registry.async_get(hass)
    entities = entity_registry.async_get(hass)
    devices = device_registry.async_get(hass)
    settings = {**entry.data, **entry.options}
    selected_areas = set(settings.get("room_filter") or [])
    rooms = [{"id": a.id, "name": a.name} for a in areas.async_list_areas() if not selected_areas or a.id in selected_areas]
    mappings = {room["id"]: [] for room in rooms}
    domain_mappings = {name: [] for name in SUPPORTED_DOMAINS.values()}
    inventory = []
    device_by_id = {device.id: device for device in devices.devices}
    for entity in entities.entities.values():
        if entity.disabled_by is not None or entity.hidden_by is not None:
            continue
        domain = entity.entity_id.split(".", 1)[0]
        if domain not in SUPPORTED_DOMAINS:
            continue
        device = device_by_id.get(entity.device_id) if entity.device_id else None
        area_id = entity.area_id or (device.area_id if device else None)
        if area_id not in mappings:
            continue
        mappings[area_id].append(entity.entity_id)
        domain_mappings[SUPPORTED_DOMAINS[domain]].append(entity.entity_id)
        inventory.append({
            "entity_id": entity.entity_id,
            "domain": domain,
            "area_id": area_id,
            "device_id": entity.device_id,
            "name": entity.name or entity.original_name or entity.entity_id,
        })
    # Explicit user mappings take precedence; empty selection means automatic discovery.
    for option, group in (("climate_entities", "climate"), ("lighting_entities", "lighting")):
        chosen = settings.get(option) or []
        if chosen:
            available = set(domain_mappings[group])
            domain_mappings[group] = sorted(item for item in chosen if item in available)
    revision_payload = json.dumps({"rooms": rooms, "mappings": mappings, "domain_mappings": domain_mappings, "settings": settings}, sort_keys=True, default=str)
    revision = zlib.crc32(revision_payload.encode("utf-8"))
    return {
        "schema_version": SCHEMA_VERSION,
        "installation_id": entry.entry_id,
        "preferred_language": entry.options.get(CONF_LANGUAGE, entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)),
        "capabilities": {**{key: bool(value) for key, value in domain_mappings.items()}, "voice": bool(settings.get("voice_enabled", False))},
        "rooms": sorted(rooms, key=lambda room: room["name"].casefold()),
        "mappings": {key: sorted(value) for key, value in mappings.items()},
        "domain_mappings": {key: sorted(value) for key, value in domain_mappings.items()},
        "entities": sorted(inventory, key=lambda item: item["entity_id"]),
        "revision": revision,
        "configuration": {"auto_discovery": bool(settings.get("auto_discovery", True))},
    }
