"""Server-authoritative STEVORA admin configuration persistence.

No account role is accepted from a mobile client. Each command verifies the
authenticated Home Assistant user is currently an administrator.
"""
from __future__ import annotations

import asyncio

from homeassistant.helpers.storage import Store

from .const import DOMAIN

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.admin_managers"


class AdminManagers:
    def __init__(self, hass):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.lock = asyncio.Lock()
        self.data = {"revision": 1, "visibility": {}, "room_aliases": {}, "entity_aliases": {}, "assistants": {"default_pipeline": None, "user_pipelines": {}}}

    async def load(self):
        saved = await self._store.async_load()
        if isinstance(saved, dict):
            self.data.update({
                "revision": saved.get("revision", 1),
                "visibility": saved.get("visibility", {}),
                "room_aliases": saved.get("room_aliases", {}),
                "entity_aliases": saved.get("entity_aliases", {}),
                "assistants": saved.get("assistants", {"default_pipeline": None, "user_pipelines": {}}),
            })

    async def save_state(self, new_state):
        await self._store.async_save(new_state)
        self.data = new_state


def require_admin(connection, msg):
    if not bool(getattr(connection.user, "is_admin", False)):
        connection.send_error(msg["id"], "unauthorized", "Administrator permission required")
        return False
    return True
