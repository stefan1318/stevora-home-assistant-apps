"""Validated presentation-only device customization for portable STEVORA installations.

No profile grants Home Assistant service permissions or writes to HA registries.
Backlight controls are forbidden irrespective of client input.
"""
from __future__ import annotations

import re

ALLOWED_LAYOUTS = frozenset({"info", "compact", "expanded"})
ALLOWED_DISPLAY_CATEGORIES = frozenset({"auto", "lighting", "switches", "climate", "fans", "covers", "media", "sensors", "binary_sensors", "locks"})
ALLOWED_CONTROLS = {
    "light": frozenset({"toggle", "brightness", "color", "color_temp", "effect"}),
    "switch": frozenset({"toggle"}),
    "fan": frozenset({"toggle", "percentage", "preset_mode", "oscillate", "direction"}),
    "climate": frozenset({"temperature", "hvac_mode", "fan_mode", "preset_mode", "swing_mode"}),
    "cover": frozenset({"open", "close", "stop", "position", "tilt"}),
    "media_player": frozenset({"play_pause", "volume", "source"}),
    "lock": frozenset({"lock", "unlock"}),
    "sensor": frozenset(),
    "binary_sensor": frozenset(),
}
# User policy: all lamp backlights remain ON and must never be exposed as controls.
FORBIDDEN_CONTROL_TERMS = ("backlight", "back light", "подсвет")


def is_backlight_entity(*names) -> bool:
    """Identify backlights by original names as well as entity IDs."""
    for name in names:
        normalized = re.sub(r"[\s_-]+", " ", str(name or "").casefold())
        if any(term in normalized for term in FORBIDDEN_CONTROL_TERMS):
            return True
    return False


def permitted_controls(entity_id, supported_features=0, attributes=None, source_name=None):
    """Conservative domain-level options; HA enforces capabilities at action time.

    Features and attributes can further narrow controls in the client; never
    treat this list as authorization to execute a service.
    """
    if is_backlight_entity(entity_id, source_name):
        return []
    domain = entity_id.split(".", 1)[0]
    return sorted(ALLOWED_CONTROLS.get(domain, frozenset()))


def validate_profile(entity_id, profile, valid_areas):
    if not isinstance(profile, dict):
        return "Profile must be an object"
    if set(profile) - {"name", "icon", "layout", "controls", "area_id", "user_ids", "display_category"}:
        return "Unsupported profile field"
    name = profile.get("name", "")
    icon = profile.get("icon", "")
    layout = profile.get("layout", "compact")
    controls = profile.get("controls", [])
    area = profile.get("area_id")
    users = profile.get("user_ids", [])
    if not isinstance(name, str) or len(name.strip()) > 80:
        return "Invalid name"
    if not isinstance(icon, str) or len(icon) > 64 or (icon and not icon.startswith("mdi:")):
        return "Icon must be an mdi: identifier"
    if layout not in ALLOWED_LAYOUTS:
        return "Invalid layout"
    category = profile.get("display_category", "auto")
    if not isinstance(category, str) or category not in ALLOWED_DISPLAY_CATEGORIES:
        return "Invalid display category"
    if not isinstance(controls, list) or len(controls) != len(set(map(str, controls))):
        return "Invalid controls"
    if any(not isinstance(item, str) or item not in permitted_controls(entity_id) for item in controls):
        return "Unsupported or forbidden control"
    if area is not None and area not in valid_areas:
        return "Unknown room"
    if not isinstance(users, list) or any(not isinstance(item, str) for item in users) or len(users) != len(set(users)):
        return "Invalid users"
    return None


def normalize_profile(profile):
    result = {
        "name": profile.get("name", "").strip(),
        "icon": profile.get("icon", "").strip(),
        "layout": profile.get("layout", "compact"),
        "display_category": profile.get("display_category", "auto"),
        "area_id": profile.get("area_id"),
        "user_ids": list(profile.get("user_ids", [])),
    }
    # Absent controls uses defaults; an explicit [] remains information-only.
    if "controls" in profile:
        result["controls"] = list(profile["controls"])
    return result
