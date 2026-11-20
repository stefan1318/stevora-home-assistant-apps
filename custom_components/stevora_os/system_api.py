"""Read-only STEVORA OS System Center diagnostics.

This endpoint never controls Home Assistant, Supervisor, backups, updates
or hardware. Information about host/update entities is admin-only.
"""
from __future__ import annotations

from homeassistant.components import websocket_api
from homeassistant.const import __version__ as HA_VERSION

STATUS_SCHEMA = "1"
PREVIEW_VERSION = "1.0.0-alpha.2"

# Official HA OS deployments commonly expose these update entities.
# An absent entity means 'not_detected', NOT 'up_to_date'.
UPDATE_COMPONENTS = {
    "core": "update.home_assistant_core_update",
    "os": "update.home_assistant_operating_system_update",
    "supervisor": "update.home_assistant_supervisor_update",
}


def _safe_version(value) -> str | None:
    """Return a bounded version label, excluding arbitrary entity attributes."""
    if not isinstance(value, (int, float, str)):
        return None
    result = str(value).strip()
    return result[:80] if result else None


def _update_status(hass, entity_id: str) -> dict:
    state = hass.states.get(entity_id)
    if state is None:
        return {"status": "not_detected", "entity_id": entity_id}
    raw = state.state
    status = (
        "available" if raw == "on" else
        "up_to_date" if raw == "off" else
        "unknown"
    )
    attributes = state.attributes or {}
    return {
        "status": status,
        "entity_id": entity_id,
        "installed_version": _safe_version(attributes.get("installed_version")),
        "latest_version": _safe_version(attributes.get("latest_version")),
    }


def build_status(hass) -> dict:
    """Assemble a bounded read-only admin snapshot with honest unknowns."""
    entries = hass.config_entries.async_entries("stevora")
    ste_state = hass.data.get("stevora", {})
    entry = entries[0] if entries else None
    hub_state = ste_state.get(entry.entry_id, {}) if entry else {}
    hub = hub_state.get("hub") if isinstance(hub_state, dict) else None
    hub_active = bool(hub is not None and getattr(hub, "active", False))
    if not entry:
        hub_status = "not_configured"
    elif hub_active:
        hub_status = "active"
    else:
        hub_status = (
            hub_state.get("hub_status", "unknown")
            if isinstance(hub_state, dict) else "unknown"
        )
    current_state = getattr(hass, "state", None)
    if current_state is not None:
        current_state = getattr(current_state, "value", str(current_state))
    start = getattr(hass, "start_time", None)
    started_at = start.isoformat() if hasattr(start, "isoformat") else None
    updates = {
        kind: _update_status(hass, entity_id)
        for kind, entity_id in UPDATE_COMPONENTS.items()
    }
    available = sum(item["status"] == "available" for item in updates.values())
    unknown = sum(item["status"] in ("unknown", "not_detected") for item in updates.values())
    return {
        "schema_version": STATUS_SCHEMA,
        "preview_version": PREVIEW_VERSION,
        "core_version": HA_VERSION,
        "ha_state": current_state or "unknown",
        "started_at": started_at,
        "registered_entities": len(hass.states.async_all()),
        "stevora_integration": "configured" if entry else "not_configured",
        "home_hub": hub_status,
        "stevora_os": "active",
        "official_updates": updates,
        "updates_available": available,
        "updates_unknown": unknown,
        "capabilities": {
            "read_only": True,
            "updates_execute": False,
            "backups_execute": False,
            "restart_execute": False,
        },
    }


@websocket_api.websocket_command({"type": "stevora_os/system/status"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_system_status(hass, connection, msg):
    """Expose system diagnostics only after HA websocket admin validation."""
    connection.send_result(msg["id"], build_status(hass))


def register(hass):
    """Register once at Core async_setup, not on entry reload."""
    websocket_api.async_register_command(hass, websocket_system_status)
