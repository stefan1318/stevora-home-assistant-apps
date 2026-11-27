"""Versioned, authenticated websocket access to the adaptive capability catalog."""
from __future__ import annotations

import logging
import re

from homeassistant.components import websocket_api
from homeassistant.core import Context, callback
from homeassistant.exceptions import HomeAssistantError
import voluptuous as vol

from .adaptive_catalog import LABELS, VERSION, build_catalog, metadata_signature, valid_parameters
from .admin_managers import require_admin
from .const import DOMAIN
from .discovery import build_manifest
from .localization import localized_manifest
from .permissions import project_manifest_for_user

_LOGGER = logging.getLogger(__name__)
API = "stevora/os/v1/capabilities"
INVALIDATION_EVENTS = (
    "stevora_manifest_changed", "entity_registry_updated", "device_registry_updated",
    "area_registry_updated", "service_registered", "service_removed",
)


def _prepare(hass, connection, msg):
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return None
    if msg.get("schema_version", VERSION) != VERSION:
        connection.send_error(msg["id"], "unsupported_version", "Supported capability schema: 1")
        return None
    return entries[0]


def _catalog(hass, entry, user, language=None):
    scoped = project_manifest_for_user(build_manifest(hass, entry, adaptive=True), user)
    language = language or scoped["preferred_language"]
    manager = hass.data[DOMAIN]["_admin_managers"]
    overrides = manager.data.get("capability_overrides", {}).get(entry.entry_id, {})
    return build_catalog(localized_manifest(scoped, language), hass.states.get,
                         hass.services.has_service, overrides, language,
                         configuration_revision=manager.data["revision"] if user.is_admin else None)


@websocket_api.websocket_command({
    "type": API,
    vol.Optional("schema_version"): vol.All(int, vol.Range(min=1)),
    vol.Optional("language"): vol.In(("bg", "en")),
})
@callback
def snapshot(hass, connection, msg):
    entry = _prepare(hass, connection, msg)
    if entry is not None:
        connection.send_result(msg["id"], _catalog(hass, entry, connection.user, msg.get("language")))


@websocket_api.websocket_command({
    "type": API + "/subscribe",
    vol.Optional("schema_version"): vol.All(int, vol.Range(min=1)),
    vol.Optional("language"): vol.In(("bg", "en")),
})
@callback
def subscribe(hass, connection, msg):
    entry = _prepare(hass, connection, msg)
    if entry is None:
        return
    language = msg.get("language")
    initial = _catalog(hass, entry, connection.user, language)
    revision = initial["revision"]
    timer = None

    @callback
    def publish():
        nonlocal revision, timer
        timer = None
        if entry not in hass.config_entries.async_entries(DOMAIN):
            return
        current = _catalog(hass, entry, connection.user, language)
        if current["revision"] != revision:
            revision = current["revision"]
            connection.send_event(msg["id"], {"revision": revision})

    @callback
    def invalidate(_event):
        nonlocal timer
        if timer is None:
            timer = hass.loop.call_later(0.25, publish)

    @callback
    def changed(event):
        if metadata_signature(event.data.get("old_state")) != metadata_signature(event.data.get("new_state")):
            invalidate(event)

    removers = [hass.bus.async_listen(event, invalidate) for event in INVALIDATION_EVENTS]
    removers.append(hass.bus.async_listen("state_changed", changed))

    @callback
    def unsubscribe():
        if timer is not None:
            timer.cancel()
        for remove in removers:
            remove()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"], {"revision": revision})


@websocket_api.websocket_command({
    "type": API + "/action",
    vol.Required("capability_id"): str,
    vol.Required("action_id"): str,
    vol.Optional("parameters", default=dict): dict,
    vol.Optional("confirmed", default=False): bool,
})
@websocket_api.async_response
async def execute(hass, connection, msg):
    entry = _prepare(hass, connection, msg)
    if entry is None:
        return
    catalog = _catalog(hass, entry, connection.user)
    capability = next((item for item in catalog["capabilities"] if item["id"] == msg["capability_id"]), None)
    action = next((item for item in capability["actions"] if item["id"] == msg["action_id"]), None) if capability else None
    if action is None:
        connection.send_error(msg["id"], "action_unavailable", "Action is unavailable or forbidden")
        return
    if not valid_parameters(msg["parameters"], action["parameters"]):
        connection.send_error(msg["id"], "invalid_parameters", "Parameters do not match this capability")
        return
    if action["confirmation_required"] and not msg["confirmed"]:
        connection.send_error(msg["id"], "confirmation_required", "Explicit confirmation is required")
        return
    domain, service = action["service"].split(".", 1)
    entity_id = capability["entity_id"]
    try:
        await hass.services.async_call(
            domain, service, {**msg["parameters"], "entity_id": entity_id},
            blocking=True, context=Context(user_id=connection.user.id),
        )
    except (HomeAssistantError, vol.Invalid):
        _LOGGER.warning("STEVORA action failed: user=%s entity=%s service=%s", connection.user.id, entity_id, action["service"])
        connection.send_error(msg["id"], "action_failed", "Home Assistant rejected or failed to complete the action")
        return
    _LOGGER.info("STEVORA action accepted: user=%s entity=%s service=%s", connection.user.id, entity_id, action["service"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command({
    "type": API + "/override",
    vol.Required("device_id"): str,
    vol.Required("expected_revision"): int,
    vol.Optional("category"): vol.In(tuple(LABELS)),
    vol.Optional("group"): vol.All(str, vol.Match(re.compile(r"[a-z0-9][a-z0-9_-]{0,63}\Z"))),
})
@websocket_api.async_response
async def override(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    entry = _prepare(hass, connection, msg)
    if entry is None:
        return
    manager = hass.data[DOMAIN]["_admin_managers"]
    device_id = msg["device_id"]
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        scoped = _catalog(hass, entry, connection.user)
        saved = manager.data.get("capability_overrides", {})
        devices = dict(saved.get(entry.entry_id, {}))
        values = {key: msg[key] for key in ("category", "group") if key in msg}
        exists = any(item["id"] == device_id for item in scoped["devices"])
        if not exists and (values or device_id not in devices):
            connection.send_error(msg["id"], "unknown_device", "Device is absent from the capability catalog")
            return
        if values:
            devices[device_id] = values
        else:
            devices.pop(device_id, None)
        await manager.save_state({**manager.data, "revision": manager.data["revision"] + 1,
                                  "capability_overrides": {**saved, entry.entry_id: devices}})
    connection.send_result(msg["id"])


def register(hass):
    for command in (snapshot, subscribe, execute, override):
        websocket_api.async_register_command(hass, command)
