"""Module selection and honest capability reporting for independent homes.

Only the STEVORA Core and the initial Home Panel are bundled. Describing a
planned module never installs it, starts a service, or enables device control.
"""
from .const import DOMAIN

CONF_PANEL_ENABLED = "panel_enabled"


def panel_requested(entry) -> bool:
    """Keep existing experimental installs' default panel behavior."""
    settings = {**entry.data, **entry.options}
    return bool(settings.get(CONF_PANEL_ENABLED, True))


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

    return {
        "core": {"bundled": True, "enabled": True, "status": "active"},
        "home_panel": {
            "bundled": True,
            "enabled": requested,
            "status": panel_status,
        },
        "home_hub": {"bundled": False, "enabled": False, "status": "not_included"},
        "hey_stevora": {"bundled": False, "enabled": False, "status": "not_included"},
        "memory_sync": {"bundled": False, "enabled": False, "status": "not_included"},
    }
