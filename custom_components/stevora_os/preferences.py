"""Private per-HA-user STEVORA OS setup preferences.

Only the invoking authenticated HA user can access or edit their own settings.
This module never manages HA identities, tokens, frontend resources or devices.
"""
from __future__ import annotations

from asyncio import Lock
import logging

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers.storage import Store

DOMAIN = "stevora_os"
STORAGE_VERSION = 1
STORAGE_KEY = "stevora_os_user_preferences"
MAX_USERS = 500

LANGUAGES = ("bg", "en")
VIEWS = (
    "home", "rooms", "devices", "lighting", "climate", "scenes",
    "automation", "assist", "system", "setup", "about",
)
DEFAULTS = {
    "language": "bg",
    "default_view": "home",
    "compact_nav": False,
    "onboarding_complete": False,
}
LOGGER = logging.getLogger(__name__)


def valid_preferences(raw: object) -> dict:
    """Accept only the fixed presentation schema, never arbitrary user input."""
    data = raw if isinstance(raw, dict) else {}
    return {
        "language": data.get("language") if data.get("language") in LANGUAGES else "bg",
        "default_view": data.get("default_view") if data.get("default_view") in VIEWS else "home",
        "compact_nav": data.get("compact_nav") if type(data.get("compact_nav")) is bool else False,
        "onboarding_complete": (
            data.get("onboarding_complete")
            if type(data.get("onboarding_complete")) is bool else False
        ),
    }


class Preferences:
    """Persist minimal per-user view preferences in HA's private .storage area."""

    def __init__(self, hass):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, dict] = {}
        self._lock = Lock()

    async def async_load(self):
        stored = await self._store.async_load()
        if not isinstance(stored, dict):
            return
        for user_id, record in stored.items():
            if not isinstance(user_id, str) or not user_id or len(user_id) > 128:
                continue
            if not isinstance(record, dict):
                continue
            revision = record.get("revision")
            if type(revision) is not int or revision < 0:
                revision = 0
            self._data[user_id] = {
                "revision": revision,
                "preferences": valid_preferences(record.get("preferences")),
            }

    def for_user(self, user_id: str) -> dict:
        record = self._data.get(user_id)
        if record is None:
            return {"revision": 0, "preferences": dict(DEFAULTS)}
        return {
            "revision": record["revision"],
            "preferences": dict(record["preferences"]),
        }

    async def async_update(self, user_id: str, expected_revision: int, changes: dict):
        """Atomic optimistic update; persist before acknowledging."""
        async with self._lock:
            current = self.for_user(user_id)
            if current["revision"] != expected_revision:
                return "conflict", current
            if user_id not in self._data and len(self._data) >= MAX_USERS:
                return "limit", current
            updated = {
                "revision": expected_revision + 1,
                "preferences": valid_preferences({
                    **current["preferences"],
                    **changes,
                }),
            }
            next_data = {**self._data, user_id: updated}
            await self._store.async_save(next_data)
            self._data = next_data
            return "ok", self.for_user(user_id)


def _get_manager(hass) -> Preferences:
    return hass.data[DOMAIN]["preferences"]


@websocket_api.websocket_command({"type": "stevora_os/preferences/get"})
@websocket_api.async_response
async def websocket_preferences_get(hass, connection, msg):
    """Read only this logged-in HA user's presentation preferences."""
    data = _get_manager(hass).for_user(connection.user.id)
    connection.send_result(msg["id"], {"schema_version": "1", **data})


@websocket_api.websocket_command({
    "type": "stevora_os/preferences/update",
    vol.Required("expected_revision"): vol.All(vol.Coerce(int), vol.Range(min=0)),
    vol.Optional("language"): vol.In(LANGUAGES),
    vol.Optional("default_view"): vol.In(VIEWS),
    vol.Optional("compact_nav"): bool,
    vol.Optional("onboarding_complete"): bool,
})
@websocket_api.async_response
async def websocket_preferences_update(hass, connection, msg):
    """Update only the caller's allowlisted fields; never accept user IDs."""
    fields = tuple(DEFAULTS)
    changes = {key: msg[key] for key in fields if key in msg}
    if not changes:
        connection.send_error(msg["id"], "empty_update", "No preference changes supplied")
        return
    manager = _get_manager(hass)
    try:
        status, response = await manager.async_update(
            connection.user.id,
            msg["expected_revision"],
            changes,
        )
    except Exception:
        LOGGER.exception("Could not persist STEVORA OS preferences")
        connection.send_error(msg["id"], "save_failed", "Preferences were not persisted")
        return
    if status != "ok":
        connection.send_error(msg["id"], status, "Preferences changed or limit reached")
        return
    connection.send_result(msg["id"], {"schema_version": "1", **response})


def register(hass):
    """Called once during STEVORA OS async_setup."""
    websocket_api.async_register_command(hass, websocket_preferences_get)
    websocket_api.async_register_command(hass, websocket_preferences_update)
