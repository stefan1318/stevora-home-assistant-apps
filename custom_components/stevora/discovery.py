"""Read-only HA discovery with admin-only exclusion diagnostics.

All device actions remain protected by Home Assistant, not this manifest.
"""
import json
import zlib
from types import SimpleNamespace
from homeassistant.helpers import area_registry, device_registry, entity_registry
from .const import SCHEMA_VERSION, CONF_LANGUAGE, DEFAULT_LANGUAGE
from .modules import describe_modules, panel_requested
from .device_customization import permitted_controls, is_backlight_entity
from .device_capabilities import available_controls, display_category

SUPPORTED_DOMAINS = {
    "climate": "climate", "light": "lighting", "switch": "switches",
    "cover": "covers", "media_player": "media", "sensor": "sensors",
    "binary_sensor": "binary_sensors", "fan": "fans", "lock": "locks",
}
UNASSIGNED_ROOM = "__stevora_unassigned__"


def build_manifest(hass, entry, *, adaptive=False):
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
    translations = admin_manager.data.get("translations", {}) if admin_manager else {}
    selected_areas = set(settings.get("room_filter") or [])
    rooms = [
        {"id": a.id, "name": room_aliases.get(a.id, a.name), "source_name": room_aliases.get(a.id, a.name), "translations": translations.get("rooms", {}).get(a.id, {})}
        for a in areas.async_list_areas()
        if not selected_areas or a.id in selected_areas
    ]
    include_unassigned = (adaptive or bool(settings.get("include_unassigned", False))) and not selected_areas
    if include_unassigned:
        language = settings.get(CONF_LANGUAGE, DEFAULT_LANGUAGE)
        rooms.append({
            "id": UNASSIGNED_ROOM,
            "name": "Без стая" if language == "bg" else "Unassigned",
            "source_name": "Unassigned",
            "translations": {"bg": "Без стая", "en": "Unassigned"},
        })
    mappings = {room["id"]: [] for room in rooms}
    domain_mappings = {name: [] for name in SUPPORTED_DOMAINS.values()}
    inventory = []
    auto_discovery = bool(settings.get("auto_discovery", True))
    explicit_entities = set(settings.get("climate_entities") or []) | set(
        settings.get("lighting_entities") or []
    )
    device_by_id = {device.id: device for device in devices.devices}

    counts = {
        "included": 0,
        "disabled": 0,
        "hidden": 0,
        "unsupported_domain": 0,
        "unassigned": 0,
        "outside_selected_rooms": 0,
        "categorized": 0,
        "auto_discovery_disabled": 0,
        "backlight": 0,
        "explicitly_excluded": 0,
    }
    excluded = []
    diagnostics = []

    def skip(entity, reason):
        counts[reason] += 1
        diagnostics.append({"entity_id": entity.entity_id, "reason": reason})
        if len(excluded) < 100:
            excluded.append({"entity_id": entity.entity_id, "reason": reason})

    registry_entities = list(entities.entities.values())
    if adaptive:
        registry_entities.extend(
            SimpleNamespace(entity_id=state.entity_id, device_id=None, area_id=None,
                            name=state.name, original_name=None, disabled_by=None, hidden_by=None)
            for state in hass.states.async_all()
            if state.entity_id not in entities.entities
        )

    for entity in registry_entities:
        if entity.disabled_by is not None or entity.hidden_by is not None:
            skip(entity, "disabled" if entity.disabled_by is not None else "hidden")
            continue
        if visibility.get(entity.entity_id) == "exclude":
            skip(entity, "explicitly_excluded")
            continue
        domain = entity.entity_id.split(".", 1)[0]
        if not adaptive and domain not in SUPPORTED_DOMAINS:
            skip(entity, "unsupported_domain")
            continue
        device = device_by_id.get(entity.device_id) if entity.device_id else None
        profile = device_profiles.get(entity.entity_id, {})
        original_name = entity.original_name or entity.name or entity.entity_id
        live = getattr(getattr(hass, "states", None), "get", lambda _id: None)(entity.entity_id)
        live_name = getattr(live, "name", None) if adaptive else None
        if is_backlight_entity(entity.entity_id, entity.name, entity.original_name, live_name):
            skip(entity, "backlight")
            continue
        manually_selected = (
            visibility.get(entity.entity_id) == "include"
            or entity.entity_id in explicit_entities
            or entity.entity_id in device_profiles
        )
        if not auto_discovery and not manually_selected:
            skip(entity, "auto_discovery_disabled")
            continue
        # HA configuration/diagnostic entities are opt-in.
        entity_category = getattr(entity, "entity_category", None)
        if entity_category is not None and not (adaptive or manually_selected):
            skip(entity, "categorized")
            continue
        area_id = profile.get("area_id") or entity.area_id or (device.area_id if device else None)
        if area_id is None:
            # A deliberately classified device is an explicit inclusion
            # request. Never lose it merely because HA has no assigned room.
            # Do not bypass a configured room_filter: the manager will show
            # the precise exclusion reason and ask for an allowed room.
            explicit_category = profile.get("display_category", "auto") != "auto"
            if (visibility.get(entity.entity_id) == "include" or explicit_category) and not selected_areas:
                area_id = UNASSIGNED_ROOM
                if UNASSIGNED_ROOM not in mappings:
                    mappings[UNASSIGNED_ROOM] = []
                    rooms.append({
                        "id": UNASSIGNED_ROOM, "name": "Unassigned",
                        "source_name": "Unassigned",
                        "translations": {"bg": "Без стая", "en": "Unassigned"},
                    })
            elif include_unassigned:
                area_id = UNASSIGNED_ROOM
            else:
                skip(entity, "unassigned")
                continue
        if area_id not in mappings:
            skip(entity, "outside_selected_rooms")
            continue
        mappings[area_id].append(entity.entity_id)
        category = display_category(entity.entity_id, profile.get("display_category", "auto"))
        if not adaptive or domain in SUPPORTED_DOMAINS:
            domain_mappings[category].append(entity.entity_id)
        capabilities = available_controls(entity.entity_id, live, original_name)
        inventory.append({
            "entity_id": entity.entity_id,
            "domain": domain,
            "area_id": area_id,
            "device_id": entity.device_id,
            "name": profile.get("name") or entity_aliases.get(entity.entity_id) or entity.name or entity.original_name or entity.entity_id,
            "source_name": profile.get("name") or entity_aliases.get(entity.entity_id) or entity.name or entity.original_name or entity.entity_id,
            "original_name": original_name,
            "translations": translations.get("entities", {}).get(entity.entity_id, {}),
            "icon": profile.get("icon", ""),
            "layout": profile.get("layout", "compact"),
            "display_category": category,
            "controls": [item for item in profile["controls"] if item in capabilities] if "controls" in profile else None,
            "available_controls": capabilities,
            "user_ids": profile.get("user_ids", []),
            **({
                "registry_id": getattr(entity, "id", None),
                "device_class": getattr(entity, "device_class", None)
                                or getattr(entity, "original_device_class", None),
                "entity_category": entity_category,
                "profile_category": profile.get("display_category", "auto"),
            } if adaptive else {}),
        })
        counts["included"] += 1
        diagnostics.append({"entity_id": entity.entity_id, "reason": "included", "area_id": area_id})

    # Explicit climate/light selections take precedence over automatic discovery.
    for option, group in (("climate_entities", "climate"), ("lighting_entities", "lighting")):
        chosen = settings.get(option) or []
        if chosen:
            available = set(domain_mappings[group])
            explicit_overrides = {
                item["entity_id"] for item in inventory
                if item["display_category"] == group
                and device_profiles.get(item["entity_id"], {}).get("display_category") == group
            }
            domain_mappings[group] = sorted(
                ({item for item in chosen if item in available} | explicit_overrides)
            )
    modules = describe_modules(hass, entry)
    revision_payload = json.dumps({
        "rooms": rooms, "mappings": mappings, "inventory": inventory,
        "domain_mappings": domain_mappings, "settings": settings, "modules": modules,
        "diagnostic_counts": counts, "visibility": visibility,
        "room_aliases": room_aliases, "room_order": room_order, "entity_aliases": entity_aliases,
        "device_profiles": device_profiles, "translations": translations,
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
        "discovery_diagnostics": {"counts": counts, "excluded_sample": excluded, "entities": sorted(diagnostics, key=lambda item: item["entity_id"])},
        "configuration": {
            "auto_discovery": bool(settings.get("auto_discovery", True)),
            "panel_enabled": panel_requested(entry),
            "include_unassigned": include_unassigned,
        },
    }
