"""HA-native capability inference for STEVORA profile selectors and controls.

Display category is visual only. Always execute services using actual HA domain.
The supported feature values follow HA EntityFeature flags; an explicit
supported_features=0 means no optional feature, not a missing declaration.
"""
from __future__ import annotations

from collections.abc import Mapping
from .device_customization import ALLOWED_CONTROLS, is_backlight_entity

DISPLAY_CATEGORIES = frozenset({
    "auto", "lighting", "switches", "climate", "fans", "covers",
    "media", "sensors", "binary_sensors", "locks",
})
DOMAIN_CATEGORIES = {
    "light": "lighting", "switch": "switches", "climate": "climate",
    "fan": "fans", "cover": "covers", "media_player": "media",
    "sensor": "sensors", "binary_sensor": "binary_sensors", "lock": "locks",
}
COLOR_MODES = frozenset({"hs", "rgb", "rgbw", "rgbww", "xy"})
BRIGHT_MODES = frozenset({"brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"})


def display_category(entity_id, preference="auto"):
    actual = entity_id.partition(".")[0]
    return (preference if preference in DISPLAY_CATEGORIES and preference != "auto"
            else DOMAIN_CATEGORIES.get(actual, "switches"))


def available_controls(entity_id, state=None, source_name=None):
    """Controls actually advertised by an HA state, never fabricated RGB/actions."""
    if is_backlight_entity(entity_id, source_name):
        return []
    domain = entity_id.partition(".")[0]
    if domain not in ALLOWED_CONTROLS:
        return []
    if domain in ("sensor", "binary_sensor"):
        return []
    attrs = getattr(state, "attributes", None)
    if not isinstance(attrs, Mapping):
        attrs = {}
    flags = attrs.get("supported_features")
    # None is distinct from 0; the latter is explicit no-feature support.
    features = flags if isinstance(flags, int) and not isinstance(flags, bool) else None
    has = lambda mask: features is not None and bool(features & mask)
    seq = lambda name: isinstance(attrs.get(name), (list, tuple)) and bool(attrs[name])
    present = lambda name: attrs.get(name) is not None
    controls = set()

    if domain in ("light", "switch"):
        controls.add("toggle")
    if domain == "light":
        modes = set(attrs.get("supported_color_modes") or [])
        if modes & BRIGHT_MODES or (not modes and present("brightness")):
            controls.add("brightness")
        if modes & COLOR_MODES:
            controls.add("color")
        if "color_temp" in modes or present("min_color_temp_kelvin"):
            controls.add("color_temp")
        if has(4) and seq("effect_list"):
            controls.add("effect")
    elif domain == "fan":
        controls.add("toggle")
        if has(1) or (features is None and present("percentage")):
            controls.add("percentage")
        if has(8) and seq("preset_modes"):
            controls.add("preset_mode")
        if has(2):
            controls.add("oscillate")
        if has(4):
            controls.add("direction")
    elif domain == "climate":
        if seq("hvac_modes"):
            controls.add("hvac_mode")
        if has(1) or (features is None and present("temperature")):
            controls.add("temperature")
        if has(8) and seq("fan_modes"):
            controls.add("fan_mode")
        if has(16) and seq("preset_modes"):
            controls.add("preset_mode")
        if has(32) and seq("swing_modes"):
            controls.add("swing_mode")
    elif domain == "cover":
        for key, flag in (("open", 1), ("close", 2), ("stop", 8),
                          ("position", 4), ("tilt", 128)):
            if has(flag):
                controls.add(key)
    elif domain == "media_player":
        if has(1) or has(16384):
            controls.add("play_pause")
        if has(4):
            controls.add("volume")
        if has(2048) and seq("source_list"):
            controls.add("source")
    elif domain == "lock":
        # Lock/unlock are restricted to the native HA more-info dialog.
        controls = set()

    return sorted(controls & ALLOWED_CONTROLS[domain])
