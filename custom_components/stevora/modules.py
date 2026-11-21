"""Module selection and honest capability reporting for independent homes.

STEVORA Core, Home Panel, and local Home Hub are bundled. Describing a
planned module never installs it, starts a service, or enables device control.
"""
from .const import DOMAIN

CONF_PANEL_ENABLED = "panel_enabled"
CONF_HOME_HUB_ENABLED = "home_hub_enabled"


def panel_requested(entry) -> bool:
    """Keep existing experimental installs' default panel behavior."""
    settings = {**entry.data, **entry.options}
    return bool(settings.get(CONF_PANEL_ENABLED, True))


def home_hub_requested(entry) -> bool:
    """A modular installation ships Home Hub but can opt out explicitly."""
    settings = {**entry.data, **entry.options}
    return bool(settings.get(CONF_HOME_HUB_ENABLED, True))


def describe_modules(hass, entry) -> dict:
    """Return per-installation module status, never a shared global profile."""
    running = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    if not isinstance(running, dict):
        running = {}
    requested = panel_requested(entry)
    if not requested:
        panel_status = "disabled"
    elif running.get("panel_registered"):
        panel_status = "active"
    elif running.get("panel_conflict"):
        panel_status = "conflict"
    else:
        panel_status = "pending"

    hub_enabled = home_hub_requested(entry)
    hub = running.get("hub")
    hub_status = ("disabled" if not hub_enabled else
                  "active" if hub is not None and getattr(hub, "active", False) else
                  running.get("hub_status", "pending"))

    voice = {"bundled": False, "enabled": False, "status": "not_included"}
    if entry.data.get("native_bootstrap"):
        from .assistant_manager import available_pipelines
        enabled = bool(available_pipelines(hass))
        voice = {"bundled": True, "enabled": enabled, "status": "active" if enabled else "unavailable"}

    return {
        "core": {"bundled": True, "enabled": True, "status": "active"},
        "home_panel": {
            "bundled": True,
            "enabled": requested,
            "status": panel_status,
        },
        "home_hub": {"bundled": True, "enabled": hub_enabled, "status": hub_status},
        "hey_stevora": voice,
        "memory_sync": {"bundled": False, "enabled": False, "status": "not_included"},
    }
