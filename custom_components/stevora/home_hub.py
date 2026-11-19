"""STEVORA Home Hub: installation-scoped, non-invasive event and health coordinator.

This component listens to HA state changes; it never powers on, toggles,
or reconfigures entities. Home Assistant remains the authority for all actions.
Event history is volatile and bounded. Only administrator-selected preferences
are stored in HA's local Store under a per-config-entry key.
"""
from __future__ import annotations

import asyncio
from collections import deque
from copy import deepcopy
from datetime import datetime, timezone
from time import monotonic

from homeassistant.helpers.storage import Store

HUB_VERSION = "1.0.0-beta.1"
STORAGE_VERSION = 1
DEFAULT_DOMAINS = (
    "climate", "light", "switch", "fan", "cover", "lock",
    "media_player", "sensor", "binary_sensor", "scene", "automation",
)
DEFAULT_SETTINGS = {
    "revision": 1,
    "track_events": True,
    "notifications_enabled": True,
    "notify_unavailable": True,
    "notify_recovered": True,
    "tracked_domains": list(DEFAULT_DOMAINS),
}


def normalized_settings(value):
    """Validate a persisted or incoming settings document without executing it."""
    value = value if isinstance(value, dict) else {}
    result = deepcopy(DEFAULT_SETTINGS)
    for key in ("track_events", "notifications_enabled",
                "notify_unavailable", "notify_recovered"):
        if type(value.get(key)) is bool:
            result[key] = value[key]
    domains = value.get("tracked_domains")
    if isinstance(domains, list) and all(isinstance(x, str) for x in domains):
        result["tracked_domains"] = sorted(set(domains) & set(DEFAULT_DOMAINS))
    revision = value.get("revision", 1)
    if isinstance(revision, int) and not isinstance(revision, bool) and revision > 0:
        result["revision"] = revision
    return result


class HomeHub:
    """Coordinator for one HA installation; no global shared user state."""

    def __init__(self, hass, entry):
        self.hass = hass
        self.entry_id = entry.entry_id
        self._store = Store(hass, STORAGE_VERSION, f"stevora.home_hub.{self.entry_id}")
        self._lock = asyncio.Lock()
        self.settings = deepcopy(DEFAULT_SETTINGS)
        self._unsub = None
        self._started = False
        self._started_at = None
        self._events = deque(maxlen=250)
        self._next_seq = 1
        self._last_event = {}

    @property
    def active(self):
        return self._started

    async def async_start(self):
        if self._started:
            return
        saved = await self._store.async_load()
        self.settings = normalized_settings(saved)
        self._unsub = self.hass.bus.async_listen("state_changed", self._on_state_changed)
        self._started = True
        self._started_at = monotonic()

    async def async_stop(self):
        self._started = False
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        self._last_event.clear()
        self._events.clear()

    async def async_configure(self, expected_revision, patch):
        """Compare-and-swap persistent config; never accept client-derived role."""
        async with self._lock:
            if expected_revision != self.settings["revision"]:
                return None
            merged = {**self.settings, **patch, "revision": expected_revision + 1}
            updated = normalized_settings(merged)
            await self._store.async_save(updated)
            self.settings = updated
            return deepcopy(updated)

    def _on_state_changed(self, event):
        if not self._started or not self.settings["track_events"]:
            return
        data = event.data
        entity_id = data.get("entity_id")
        if not isinstance(entity_id, str) or "." not in entity_id:
            return
        if entity_id.split(".", 1)[0] not in self.settings["tracked_domains"]:
            return
        old = data.get("old_state")
        new = data.get("new_state")
        if new is None:
            return  # Removal is not a confirmed outage.
        old_value = getattr(old, "state", None)
        new_value = getattr(new, "state", None)
        if new_value is None or old_value == new_value:
            return
        if new_value in ("unavailable", "unknown") and old_value is not None:
            kind, severity = "unavailable", "warning"
        elif old_value in ("unavailable", "unknown"):
            kind, severity = "recovered", "info"
        else:
            kind, severity = "changed", "info"
        if kind == "unavailable" and not self.settings["notify_unavailable"]:
            kind, severity = "changed", "info"
        if kind == "recovered" and not self.settings["notify_recovered"]:
            kind, severity = "changed", "info"
        now = monotonic()
        key = (entity_id, kind, new_value)
        if now - self._last_event.get(key, -1e10) < 3:
            return
        self._last_event[key] = now
        # Keep dedup map bounded too; no unbounded memory growth.
        if len(self._last_event) > 500:
            self._last_event.clear()
        fired = getattr(event, "time_fired", None)
        timestamp = fired.isoformat() if fired else datetime.now(timezone.utc).isoformat()
        self._events.append({
            "seq": self._next_seq,
            "at": timestamp,
            "entity_id": entity_id,
            "kind": kind,
            "severity": severity,
            "state": str(new_value)[:80],
        })
        self._next_seq += 1

    def events_for(self, visible_entity_ids, limit=40, since=0):
        allowed = set(visible_entity_ids)
        return [
            deepcopy(item) for item in self._events
            if item["seq"] > since and item["entity_id"] in allowed
        ][-limit:]

    def notifications_for(self, visible_entity_ids, limit=20):
        if not self.settings["notifications_enabled"]:
            return []
        return [
            item for item in self.events_for(visible_entity_ids, limit=250)
            if item["kind"] in ("unavailable", "recovered")
        ][-limit:]

    def uptime_seconds(self):
        return int(max(0, monotonic() - self._started_at)) if self._started_at is not None and self._started else 0
