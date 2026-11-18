"""Read-only device discovery. Full manifest is restricted to HA administrators."""
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
    rooms = [{"id": a.id, "name": a.name} for a in areas.async_list_areas()]
    mappings = {name: [] for name in SUPPORTED_DOMAINS.values()}
    inventory = []
    for entity in entities.entities.values():
        if entity.disabled_by is not None or entity.hidden_by is not None:
            continue
        domain = entity.entity_id.split(".", 1)[0]
        if domain not in SUPPORTED_DOMAINS:
            continue
        device = devices.async_get(entity.device_id) if entity.device_id else None
        area_id = entity.area_id or (device.area_id if device else None)
        mappings[SUPPORTED_DOMAINS[domain]].append(entity.entity_id)
        inventory.append({
            "entity_id": entity.entity_id,
            "domain": domain,
            "area_id": area_id,
            "device_id": entity.device_id,
            "name": entity.name or entity.original_name or entity.entity_id,
        })
    return {
        "schema_version": SCHEMA_VERSION,
        "installation_id": entry.entry_id,
        "preferred_language": entry.options.get(CONF_LANGUAGE, entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)),
        "capabilities": {key: bool(value) for key, value in mappings.items()},
        "rooms": sorted(rooms, key=lambda room: room["name"].casefold()),
        "mappings": {key: sorted(value) for key, value in mappings.items()},
        "entities": sorted(inventory, key=lambda item: item["entity_id"]),
        "revision": 1,
    }
