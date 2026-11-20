"""Admin-only, strictly read-only STEVORA OS integration inventory.

We read Home Assistant's public config-entry registry and disclose no
credentials, entry.options, user tokens or integration private data.
All configuration mutations remain in the official HA Core flow until tested.
"""
from __future__ import annotations

from collections import Counter

from homeassistant.components import websocket_api

SCHEMA_VERSION = "1"
MAX_ENTRIES = 400
MAX_LABEL = 120


def _safe_label(value: object, max_length: int = MAX_LABEL) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_length]


def _enum_value(value: object, default: str = "unknown") -> str:
    if value is None:
        return default
    label = getattr(value, "value", value)
    return _safe_label(label, 40) or default


def build_inventory(hass) -> dict:
    """Generate a bounded snapshot of *admin-visible* HA config entries."""
    all_entries = hass.config_entries.async_entries()
    prepared = []
    for entry in all_entries:
        domain = _safe_label(getattr(entry, "domain", ""), 80)
        if not domain:
            continue
        state = _enum_value(getattr(entry, "state", None))
        disabled_by = _enum_value(getattr(entry, "disabled_by", None), "")
        prepared.append({
            "entry_id": _safe_label(getattr(entry, "entry_id", ""), 100),
            "domain": domain,
            "title": _safe_label(getattr(entry, "title", "")) or domain,
            "state": state,
            "disabled_by": disabled_by or None,
            "source": _safe_label(getattr(entry, "source", ""), 30) or None,
        })
    prepared.sort(key=lambda e: (
        e["domain"].casefold(), e["title"].casefold(), e["entry_id"]
    ))
    counts = Counter(item["state"] for item in prepared)
    return {
        "schema_version": SCHEMA_VERSION,
        "count_total": len(prepared),
        "count_loaded": counts.get("loaded", 0),
        "count_not_loaded": len(prepared) - counts.get("loaded", 0),
        "truncated": len(prepared) > MAX_ENTRIES,
        "entries": prepared[:MAX_ENTRIES],
        "capabilities": {
            "read_only": True,
            "configure": False,
            "remove": False,
            "reload": False,
        },
    }


@websocket_api.websocket_command({"type": "stevora_os/system/integrations"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_integrations(hass, connection, msg):
    """Home Assistant itself enforces admin permission, never just the UI."""
    connection.send_result(msg["id"], build_inventory(hass))


def register(hass):
    websocket_api.async_register_command(hass, websocket_integrations)
