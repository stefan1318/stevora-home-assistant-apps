"""Read-only HA discovery with admin-only exclusion diagnostics.

All device actions remain protected by Home Assistant, not this manifest.
"""
import json
import zlib
from homeassistant.helpers import area_registry, device_registry, entity_registry
from .const import SCHEMA_VERSION, CONF_LANGUAGE, DEFAULT_LANGUAGE
from .modules import describe_modules, panel_requested
from .device_customization import permitted_controls

SUPPORTED_DOMAINS = {
    "climate": "climate", "light": "lighting", "switch": "switches",
    "cover": "covers", "media_player": "media", "sensor": "sensors",
    "binary_sensor": "binary_sensors", "fan": "fans", "lock": "locks",
}
UNASSIGNED_ROOM = "__stevora_unassigned__"


def build_manifest(hass, entry):
    """Build an installation-scoped snapshot from HA area/entity/device registries."""
    areas = area_registry.async_get(hass)
    entities = entity_registry.async_get(hass)
    devices = device_registry.async_get(hass)
    settings = {**entry.data, **entry.options}
    admin_manager = hass.data.get("stevora", {}).get("_admin_managers")
    visibility = admin_manager.data.get("visibility", {}) if admin_manager else {}
    room_aliases = admin_manager.data.get("room_aliases", {}) if admin_manager else {}
    room_order = admin_manager.data.get("room_order", []) if admin_manager else []
    entity_aliases = admin_manager.data.get("entity_aliases", {}) if admin_manager else {}
    device_profiles = admin_manager.data.get("device_profiles", {}) if admin_manager else {}
    selected_areas = set(settings.get("room_filter") or [])
    rooms = [
        {"id": a.id, "name": room_aliases.get(a.id, a.name)}
        for a in areas.async_list_areas()
        if not selected_areas or a.id in selected_areas
    ]
    include_unassigned = bool(settings.get("include_unassigned", False)) and not selected_areas
    if include_unassigned:
        language = settings.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)
        rooms.append({
            "id": UNASSIGNED_ROOM,
            "name": "Без стая" if language == "bg" else "Unassigned",
        })
    mappings = {room["id"]: [] for room in rooms}
    domain_mappings = {name: [] for name in SUPPORTED_DOMAINS.values()}
    inventory = []
    device_by_id = {device.id: device for device in devices.devices}

    counts = {
        "included": 0,
        "disabled": 0,
        "hidden": 0,
        "unsupported_domain": 0,
        "unassigned": 0,
        "outside_selected_rooms": 0,
        "categorized": 0,
        "explicitly_excluded": 0,
    }
    excluded = []

    def skip(entity, reason):
        counts[reason] += 1
        if len(excluded) < 100:
            excluded.append({"entity_id": entity.entity_id, "reason": reason})

    for entity in entities.entities.values():
        if entity.disabled_by is not None or entity.hidden_by is not None:
            skip(entity, "disabled" if entity.disabled_by is not None else "hidden")
            continue
        if visibility.get(entity.entity_id) == "exclude":
            skip(entity, "explicitly_excluded")
            continue
        domain = entity.entity_id.split(".", 1)[0]
        if domain not in SUPPORTED_DOMAINS:
            skip(entity, "unsupported_domain")
            continue
        device = device_by_id.get(entity.device_id) if entity.device_id else None
        area_id = entity.area_id or (device.area_id if device else None)
        if area_id is None:
            if include_unassigned:
                area_id = UNASSIGNED_ROOM
            else:
                skip(entity, "unassigned")
                continue
        if area_id not in mappings:
            skip(entity, "outside_selected_rooms")
            continue
        if getattr(entity, "entity_category", None) is not None:
            counts["categorized"] += 1
        profile = device_profiles.get(entity.entity_id, {})
        if profile.get("area_id") in mappings:
            area_id = profile["area_id"]
        mappings[area_id].append(entity.entity_id)
        domain_mappings[SUPPORTED_DOMAINS[domain]].append(entity.entity_id)
        inventory.append({
            "entity_id": entity.entity_id,
            "domain": domain,
            "area_id": area_id,
            "device_id": entity.device_id,
            "name": profile.get("name") or entity_aliases.get(entity.entity_id) or entity.name or entity.original_name or entity.entity_id,
            "icon": profile.get("icon", ""),
            "layout": profile.get("layout", "compact"),
            "controls": [item for item in profile.get("controls", []) if item in permitted_controls(entity.entity_id)],
            "available_controls": permitted_controls(entity.entity_id),
            "user_ids": profile.get("user_ids", []),
        })
        counts["included"] += 1

    # Explicit climate/light selections take precedence over automatic discovery.
    for option, group in (("climate_entities", "climate"), ("lighting_entities", "lighting")):
        chosen = settings.get(option) or []
        if chosen:
            available = set(domain_mappings[group])
            domain_mappings[group] = sorted(item for item in chosen if item in available)
    modules = describe_modules(hass, entry)
    revision_payload = json.dumps({
        "rooms": rooms, "mappings": mappings,
        "domain_mappings": domain_mappings, "settings": settings, "modules": modules,
        "diagnostic_counts": counts, "visibility": visibility,
        "room_aliases": room_aliases, "room_order": room_order, "entity_aliases": entity_aliases,
        "device_profiles": device_profiles,
    }, sort_keys=True, default=str)
    revision = zlib.crc32(revision_payload.encode("utf-8"))
    return {
        "schema_version": SCHEMA_VERSION,
        "installation_id": entry.entry_id,
        "preferred_language": entry.options.get(
            CONF_LANGUAGE, entry.data.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)
        ),
        "capabilities": {
            **{key: bool(value) for key, value in domain_mappings.items()},
            "voice": modules["hey_stevora"]["status"] == "active",
        },
        "rooms": sorted(rooms, key=lambda room: (room_order.index(room["id"]) if room["id"] in room_order else len(room_order), room["name"].casefold())),
        "mappings": {key: sorted(value) for key, value in mappings.items()},
        "domain_mappings": {key: sorted(value) for key, value in domain_mappings.items()},
        "entities": sorted(inventory, key=lambda item: item["entity_id"]),
        "revision": revision,
        "modules": modules,
        # Only administrators receive this field. permissions.py strips it
        # before sending the manifest to a non-administrator.
        "discovery_diagnostics": {"counts": counts, "excluded_sample": excluded},
        "configuration": {
            "auto_discovery": bool(settings.get("auto_discovery", True)),
            "panel_enabled": panel_requested(entry),
            "include_unassigned": include_unassigned,
        },
    }
