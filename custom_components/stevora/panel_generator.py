"""STEVORA Home Panel v7.1.1: per-home declarative panel generator.

The panel model is built exclusively from an already permission-projected
STEVORA manifest. It never writes Home Assistant dashboards or registries.
"""
from __future__ import annotations

import re
from .device_capabilities import display_category

PANEL_VERSION = "7.1.1"
BACKLIGHT_MARKERS = ("backlight", "back light", "подсвет")
DEFAULT_LAYOUT = "compact"
DOMAIN_ICONS = {
    "light": "mdi:lightbulb", "switch": "mdi:toggle-switch",
    "climate": "mdi:thermostat", "fan": "mdi:fan",
    "cover": "mdi:window-shutter", "media_player": "mdi:play-circle",
    "sensor": "mdi:gauge", "binary_sensor": "mdi:checkbox-marked-circle-outline",
    "lock": "mdi:lock",
}
DOMAIN_CONTROLS = {
    "light": ("toggle", "brightness", "color", "color_temp", "effect"),
    "switch": ("toggle",), "fan": ("toggle", "percentage", "preset_mode", "oscillate", "direction"),
    "climate": ("temperature", "hvac_mode", "fan_mode", "preset_mode", "swing_mode"),
    "cover": ("open", "close", "stop", "position", "tilt"),
    "media_player": ("play_pause", "volume", "source"),
    "lock": ("lock", "unlock"),
    "sensor": (), "binary_sensor": (),
}


def _is_backlight(entity: dict) -> bool:
    value = " ".join(
        str(entity.get(key, "")) for key in
        ("entity_id", "name", "source_name", "original_name")
    ).casefold()
    normalized = re.sub(r"[\\s_-]+", " ", value)
    return any(marker in normalized for marker in BACKLIGHT_MARKERS)


def generate_panel(manifest: dict) -> dict:
    """Generate a safe, deterministic, home-specific panel description.

    Input MUST be project_manifest_for_user(...) output, not the raw manifest.
    """
    permitted = set(manifest.get("controllable_entities", []))
    rooms = list(manifest.get("rooms", []))
    areas = {room["id"] for room in rooms}
    sections = {room["id"]: {
        "id": room["id"], "name": room["name"], "cards": [],
    } for room in rooms}
    for entity in manifest.get("entities", []):
        entity_id = entity.get("entity_id", "")
        domain = entity_id.partition(".")[0]
        area = entity.get("area_id")
        if area not in areas or domain not in DOMAIN_ICONS or _is_backlight(entity):
            continue
        supported = DOMAIN_CONTROLS[domain]
        available = entity.get("available_controls")
        if isinstance(available, list):
            supported = tuple(x for x in supported if x in available)
        # A customized empty controls list intentionally means info-only.
        chosen = entity.get("controls")
        if chosen is None:
            chosen = supported
        controls = [
            control for control in chosen
            if control in supported and entity_id in permitted
        ]
        layout = entity.get("layout", DEFAULT_LAYOUT)
        if layout not in ("info", "compact", "expanded"):
            layout = DEFAULT_LAYOUT
        if layout == "info":
            controls = []
        icon = entity.get("icon") or DOMAIN_ICONS[domain]
        if not isinstance(icon, str) or not icon.startswith("mdi:"):
            icon = DOMAIN_ICONS[domain]
        sections[area]["cards"].append({
            "entity_id": entity_id,
            "name": entity.get("name") or entity_id,
            "domain": domain,
            "display_category": display_category(entity_id, entity.get("display_category", "auto")),
            "icon": icon,
            "layout": layout,
            "controls": controls,
            "available_controls": list(supported),
        })
    for section in sections.values():
        section["cards"].sort(key=lambda item: (item["name"].casefold(), item["entity_id"]))
    return {
        "panel_version": PANEL_VERSION,
        "installation_id": manifest.get("installation_id"),
        "revision": manifest.get("revision"),
        "language": manifest.get("preferred_language", "en"),
        "theme": "stevora-dark",
        "generated": True,
        "sections": list(sections.values()),
        "total_cards": sum(len(section["cards"]) for section in sections.values()),
    }
