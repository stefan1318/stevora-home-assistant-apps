"""Read-only capability discovery using native Home Assistant registries."""
from homeassistant.helpers import area_registry, device_registry, entity_registry
from .const import SCHEMA_VERSION, CONF_LANGUAGE, DEFAULT_LANGUAGE

SUPPORTED_DOMAINS = {"climate": "climate", "light": "lighting", "switch": "switches", "cover": "covers", "media_player": "media", "sensor": "sensors"}

def build_manifest(hass, entry):
    areas = area_registry.async_get(hass)
    entities = entity_registry.async_get(hass)
    devices = device_registry.async_get(hass)
    rooms = [{"id": a.id, "name": a.name} for a in areas.async_list_areas()]
    mappings = {name: [] for name in SUPPORTED_DOMAINS.values()}
    for entity in entities.entities.values():
        if entity.disabled_by is not None or entity.hidden_by is not None:
            continue
        domain = entity.entity_id.split(".", 1)[0]
        if domain in SUPPORTED_DOMAINS:
            mappings[SUPPORTED_DOMAINS[domain]].append(entity.entity_id)
    return {
        "schema_version": SCHEMA_VERSION,
        "installation_id": entry.entry_id,
        "preferred_language": entry.options.get(CONF_LANGUAGE, entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)),
        "capabilities": {key: bool(value) for key, value in mappings.items()},
        "rooms": sorted(rooms, key=lambda room: room["name"]),
        "mappings": {key: sorted(value) for key, value in mappings.items()},
        "revision": 1,
    }
