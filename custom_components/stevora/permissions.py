"""Project STEVORA capabilities to the invoking Home Assistant user's permissions.

The server manifest is discovery data, never authorization for device actions.
"""
import json
import zlib

from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ


def project_manifest_for_user(manifest: dict, user) -> dict:
    """Return a fresh, permission-scoped manifest without mutating the source."""
    is_admin = bool(user.is_admin)
    visible = {
        item["entity_id"]
        for item in manifest["entities"]
        if is_admin or user.permissions.check_entity(item["entity_id"], POLICY_READ)
    }
    controllable = sorted(
        entity_id
        for entity_id in visible
        if is_admin or user.permissions.check_entity(entity_id, POLICY_CONTROL)
    )

    entities = [item for item in manifest["entities"] if item["entity_id"] in visible]
    visible_areas = {item["area_id"] for item in entities}
    rooms = [
        room
        for room in manifest["rooms"]
        if is_admin or room["id"] in visible_areas
    ]
    mappings = {
        room["id"]: sorted(
            entity_id for entity_id in manifest["mappings"].get(room["id"], [])
            if entity_id in visible
        )
        for room in rooms
    }
    domain_mappings = {
        domain: sorted(entity_id for entity_id in values if entity_id in visible)
        for domain, values in manifest["domain_mappings"].items()
    }
    capabilities = {
        **{domain: bool(values) for domain, values in domain_mappings.items()},
        "voice": bool(manifest["capabilities"].get("voice", False)),
    }
    projected = {
        **manifest,
        "rooms": rooms,
        "mappings": mappings,
        "domain_mappings": domain_mappings,
        "entities": entities,
        "capabilities": capabilities,
        "controllable_entities": controllable,
    }
    # Prevent clients from conflating different users' manifest revisions.
    scope = {
        "source_revision": manifest["revision"],
        "rooms": rooms,
        "mappings": mappings,
        "domain_mappings": domain_mappings,
        "controllable_entities": controllable,
    }
    projected["revision"] = zlib.crc32(
        json.dumps(scope, sort_keys=True).encode("utf-8")
    )
    return projected
