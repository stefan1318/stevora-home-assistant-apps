"""STEVORA manifest v1 builder for Home Assistant registry snapshots.

Pure Python, no credentials or location data. Integration must expose this
through an authenticated HA WebSocket command with permission checks.
"""
from __future__ import annotations

from collections.abc import Iterable, Mapping
import re

ENTITY_ID = re.compile(r"^[a-z][a-z0-9_]*\.[a-z0-9_]+$")
MAX_ENTITIES = 2000
MAX_ROOMS = 250


def build_manifest(
    installation_id: str,
    revision: int,
    areas: Iterable[Mapping[str, object]],
    entities: Iterable[Mapping[str, object]],
    preferred_language: str = "en",
) -> dict:
    """Return a validated, deterministic *read-only* UI discovery manifest.

    The caller must filter inaccessible/disabled/hidden entities using the
    authenticated user's permissions before calling this function.
    """
    if not installation_id or len(installation_id) > 128:
        raise ValueError("invalid installation id")
    if not isinstance(revision, int) or revision < 0:
        raise ValueError("invalid revision")
    area_rows = list(areas)
    entity_rows = list(entities)
    if len(area_rows) > MAX_ROOMS or len(entity_rows) > MAX_ENTITIES:
        raise ValueError("manifest exceeds limits")

    rooms = []
    known_areas = set()
    for area in area_rows:
        area_id = area.get("area_id")
        if not isinstance(area_id, str) or not area_id or area_id in known_areas:
            continue
        known_areas.add(area_id)
        name = area.get("name")
        rooms.append({"id": area_id, "name": name if isinstance(name, str) and name else area_id})

    mappings: dict[str, list[str]] = {room["id"]: [] for room in rooms}
    for entity in entity_rows:
        entity_id = entity.get("entity_id")
        area_id = entity.get("area_id")
        if (
            isinstance(entity_id, str)
            and ENTITY_ID.fullmatch(entity_id)
            and isinstance(area_id, str)
            and area_id in mappings
            and entity_id not in mappings[area_id]
        ):
            mappings[area_id].append(entity_id)

    return {
        "schema_version": "1.0",
        "installation_id": installation_id,
        "revision": revision,
        "preferred_language": preferred_language if preferred_language in ("bg", "en") else "en",
        "rooms": sorted(rooms, key=lambda room: room["id"]),
        "mappings": {key: sorted(value) for key, value in sorted(mappings.items())},
    }
