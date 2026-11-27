"""Normalize permission-scoped Home Assistant evidence for all STEVORA clients."""
from __future__ import annotations

from collections import defaultdict
from hashlib import sha256
import json
import math

from .localization import localize_name

VERSION = 1
LABELS = {
    "climate": ("Climate", "Климатизация"), "energy": ("Energy", "Енергия"),
    "water": ("Water", "Вода"), "security": ("Security", "Сигурност"),
    "lighting": ("Lighting", "Осветление"), "fans": ("Fans", "Вентилатори"),
    "covers": ("Covers", "Щори"), "media": ("Media", "Мултимедия"),
    "heat_pump": ("Heat pumps", "Термопомпи"), "irrigation": ("Irrigation", "Напояване"),
    "general": ("Devices", "Устройства"),
}
DOMAIN_CATEGORIES = {
    "climate": "climate", "water_heater": "climate", "light": "lighting",
    "fan": "fans", "cover": "covers", "media_player": "media", "valve": "water",
    "alarm_control_panel": "security", "camera": "security", "lock": "security",
    "siren": "security",
}
CLASS_CATEGORIES = {
    "sensor": {
        "energy": "energy", "energy_storage": "energy", "power": "energy",
        "water": "water",
    },
    "binary_sensor": {
        "moisture": "water", "door": "security", "garage_door": "security",
        "window": "security", "motion": "security", "smoke": "security",
        "gas": "security", "carbon_monoxide": "security", "tamper": "security",
    },
}
NO_PARAMETER = {
    "light": {"toggle": ("turn_on", "turn_off")},
    "switch": {"toggle": ("turn_on", "turn_off")},
    "fan": {"toggle": ("turn_on", "turn_off")},
    "cover": {"open": ("open_cover",), "close": ("close_cover",), "stop": ("stop_cover",)},
}
OPTIONS = {
    "climate": {"hvac_mode": ("set_hvac_mode", "hvac_modes"),
                "fan_mode": ("set_fan_mode", "fan_modes"),
                "swing_mode": ("set_swing_mode", "swing_modes"),
                "preset_mode": ("set_preset_mode", "preset_modes")},
    "fan": {"preset_mode": ("set_preset_mode", "preset_modes")},
    "light": {"effect": ("turn_on", "effect_list")},
    "media_player": {"source": ("select_source", "source_list")},
}
NUMERIC = {
    "light": {"brightness": ("turn_on", "brightness_pct", 100)},
    "fan": {"percentage": ("set_percentage", "percentage", 100)},
    "cover": {"position": ("set_cover_position", "position", 100)},
    "media_player": {"volume": ("volume_set", "volume_level", 1)},
}
MEASUREMENTS = {
    "climate": ("current_temperature", "current_humidity", "temperature",
                "target_temp_high", "target_temp_low", "hvac_action"),
    "water_heater": ("current_temperature", "temperature"),
    "cover": ("current_position", "current_tilt_position"),
    "fan": ("percentage",), "light": ("brightness", "color_temp_kelvin"),
    "media_player": ("volume_level",),
}
METADATA_ATTRIBUTES = frozenset({
    "device_class", "state_class", "unit_of_measurement", "supported_features",
    "supported_color_modes", "min_temp", "max_temp", "target_temp_step",
    "min_color_temp_kelvin",
    *(attribute for controls in OPTIONS.values() for _, attribute in controls.values()),
})


def number(value):
    return type(value) is int or (type(value) is float and math.isfinite(value))


def availability(state):
    if state is None:
        return "missing"
    return state.state if state.state in {"unknown", "unavailable"} else "available"


def metadata_signature(state):
    """Ignore ordinary telemetry ticks, which arrive through the scoped HA stream."""
    attrs = state.attributes if state is not None else {}
    domain = state.entity_id.partition(".")[0] if state is not None else ""
    return (availability(state), tuple((key, attrs.get(key)) for key in sorted(METADATA_ATTRIBUTES)),
            tuple(key for key in MEASUREMENTS.get(domain, ()) if attrs.get(key) is not None))


def action_specs(domain, controls, attrs, has_service):
    actions = []

    def add(action_id, service, parameters=None):
        if has_service(domain, service):
            actions.append({
                "id": action_id, "service": f"{domain}.{service}",
                "parameters": parameters or {},
                "confirmation_required": domain in {"switch", "cover", "climate"},
            })

    for control, services in NO_PARAMETER.get(domain, {}).items():
        if control in controls:
            for service in services:
                add(service, service)
    for control, (service, attribute) in OPTIONS.get(domain, {}).items():
        choices = attrs.get(attribute)
        if control in controls and isinstance(choices, (tuple, list)):
            choices = list(dict.fromkeys(value for value in choices if isinstance(value, str)))
            if choices:
                add(control, service, {control: {"type": "enum", "options": choices}})
    for control, (service, field, upper) in NUMERIC.get(domain, {}).items():
        if control in controls:
            add(control, service, {field: {"type": "number" if upper == 1 else "integer",
                                           "min": 0, "max": upper}})
    if domain == "climate" and "temperature" in controls:
        lower, upper = attrs.get("min_temp"), attrs.get("max_temp")
        if number(lower) and number(upper) and lower <= upper:
            parameter = {"type": "number", "min": lower, "max": upper}
            step = attrs.get("target_temp_step")
            if number(step) and step > 0:
                parameter["step"] = step
            add("temperature", "set_temperature", {"temperature": parameter})
    return actions


def valid_parameters(parameters, schema):
    if parameters.keys() != schema.keys():
        return False
    for key, field in schema.items():
        value = parameters[key]
        if field["type"] == "enum":
            if not isinstance(value, str) or value not in field["options"]:
                return False
        elif (not number(value) or not field["min"] <= value <= field["max"]
              or (field["type"] == "integer" and type(value) is not int)):
            return False
    return True


def group_availability(members):
    statuses = {member["availability"] for member in members}
    if len(statuses) == 1:
        return next(iter(statuses))
    return "degraded" if "available" in statuses else "unavailable"


def build_catalog(scoped, states, has_service, overrides, language):
    """Derive every device, system and action from the caller's visible entities."""
    controllable = set(scoped["controllable_entities"])
    capabilities, grouped = [], defaultdict(list)
    for item in scoped["entities"]:
        entity_id, domain = item["entity_id"], item["domain"]
        state = states(entity_id)
        attrs = state.attributes if state is not None else {}
        stable_id = "registry:" + item["registry_id"] if item["registry_id"] else "entity:" + entity_id
        device_id = "device:" + item["device_id"] if item["device_id"] else stable_id
        device_class = item["device_class"] or attrs.get("device_class")
        category = DOMAIN_CATEGORIES.get(domain) or CLASS_CATEGORIES.get(domain, {}).get(device_class)
        source = "ha_domain" if domain in DOMAIN_CATEGORIES else "ha_device_class" if category else "fallback"
        manual = overrides.get(device_id, {}).get("category") or item["profile_category"]
        if manual in LABELS:
            category, source = manual, "admin"
        controls = item["controls"] if item["controls"] is not None else item["available_controls"]
        actions = []
        if (entity_id in controllable and availability(state) == "available"
                and item["entity_category"] is None and item["layout"] != "info"):
            actions = action_specs(domain, controls, attrs, has_service)
        capability = {
            "id": stable_id, "entity_id": entity_id, "device_id": device_id,
            "area_id": item["area_id"], "semantic_type": domain,
            "device_class": device_class, "state_class": attrs.get("state_class"),
            "unit": attrs.get("unit_of_measurement"),
            "diagnostic": item["entity_category"] == "diagnostic",
            "availability": availability(state), "read_only": not actions,
            "measurements": ["state", *[key for key in MEASUREMENTS.get(domain, ()) if attrs.get(key) is not None]],
            "names": {locale: localize_name(item["source_name"], locale, item["translations"])
                      for locale in ("bg", "en")},
            "icon": item["icon"], "layout": item["layout"], "actions": actions,
            "classification": {"category": category or "general", "source": source,
                               "confidence": "confirmed" if source == "admin" else
                               "high" if category else "unknown"},
        }
        capabilities.append(capability)
        grouped[device_id].append(capability)

    devices, systems = [], defaultdict(list)
    for device_id, members in sorted(grouped.items()):
        devices.append({
            "id": device_id, "area_ids": sorted({item["area_id"] for item in members}),
            "capability_ids": [item["id"] for item in members],
            "availability": group_availability(members),
        })
        group = overrides.get(device_id, {}).get("group")
        for item in members:
            grouping_key = f"group:{group}" if group else device_id
            systems[(item["classification"]["category"], grouping_key)].append(item)

    payload = {
        "schema_version": VERSION, "installation_id": scoped["installation_id"],
        "language": language, "rooms": scoped["rooms"], "devices": devices,
        "capabilities": capabilities,
        "systems": [{
            "id": f"{category}:{group}", "category": category,
            "labels": dict(zip(("en", "bg"), LABELS[category])),
            "device_ids": sorted({item["device_id"] for item in members}),
            "area_ids": sorted({item["area_id"] for item in members}),
            "capability_ids": [item["id"] for item in members],
            "availability": group_availability(members),
        } for (category, group), members in sorted(systems.items())],
    }
    payload["revision"] = sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return payload
