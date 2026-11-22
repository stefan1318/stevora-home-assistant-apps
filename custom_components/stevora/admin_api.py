"""Admin-only STEVORA room layout and assistant pipeline configuration APIs."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.helpers import entity_registry, area_registry

from .admin_managers import require_admin
from .assistant_manager import available_pipelines, validate_assistant_settings, resolve_pipeline
from .discovery import build_manifest
from .device_customization import validate_profile, normalize_profile, is_backlight_entity
from .device_capabilities import available_controls


def _manager(hass):
    return hass.data["stevora"]["_admin_managers"]


def _entry(hass):
    entries = hass.config_entries.async_entries("stevora")
    return entries[0] if entries else None


@websocket_api.websocket_command({"type": "stevora/admin/capabilities"})
@websocket_api.async_response
async def capabilities(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    connection.send_result(msg["id"], {
        "room_manager": True,
        "assistant_manager": True,
        "schema_version": "1.1",
        "device_customization": True,
    })


@websocket_api.websocket_command({"type": "stevora/admin/rooms/get"})
@websocket_api.async_response
async def rooms_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    entry = _entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manager = _manager(hass)
    manifest = build_manifest(hass, entry)
    registry = entity_registry.async_get(hass)
    included = {item["entity_id"] for item in manifest["entities"]}
    reasons = {item["entity_id"]: item["reason"] for item in manifest["discovery_diagnostics"]["entities"]}
    inventory = []
    for entity in registry.entities.values():
        if entity.entity_id.split(".", 1)[0] not in ("climate", "light", "switch", "cover", "media_player", "sensor", "binary_sensor", "fan", "lock"):
            continue
        inventory.append({
            "entity_id": entity.entity_id,
            "name": entity.name or entity.original_name or entity.entity_id,
            "included": entity.entity_id in included,
            "reason": reasons.get(entity.entity_id, "unknown"),
            "area_id": (manager.data.get("device_profiles", {}).get(entity.entity_id, {}).get("area_id") or entity.area_id),
            "disabled": entity.disabled_by is not None,
            "hidden": entity.hidden_by is not None,
            "available_controls": available_controls(
                entity.entity_id,
                getattr(getattr(hass, "states", None), "get", lambda _id: None)(entity.entity_id),
                entity.original_name or entity.name,
            ),
        })
    connection.send_result(msg["id"], {
        "revision": manager.data["revision"],
        "rooms": manifest["rooms"],
        "entities": sorted(inventory, key=lambda item: item["entity_id"]),
        "visibility": manager.data["visibility"],
        "room_aliases": manager.data.get("room_aliases", {}),
        "room_order": manager.data.get("room_order", []),
        "entity_aliases": manager.data.get("entity_aliases", {}),
        "device_profiles": manager.data.get("device_profiles", {}),
        "translations": manager.data.get("translations", {"rooms": {}, "entities": {}}),
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/rooms/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("entities"): [
        {
            vol.Required("entity_id"): str,
            vol.Required("visibility"): vol.In(("default", "include", "exclude")),
        }
    ],
})
@websocket_api.async_response
async def rooms_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    if msg["expected_revision"] != manager.data["revision"]:
        connection.send_error(msg["id"], "conflict", "Configuration revision changed")
        return
    registry = entity_registry.async_get(hass)
    available = set(registry.entities)
    patches = msg["entities"]
    if len(patches) > 500 or any(item["entity_id"] not in available for item in patches):
        connection.send_error(msg["id"], "invalid_entity", "Entity is unknown or request is too large")
        return
    # A disabled/hidden HA entity cannot be made visible through STEVORA.
    if any(item["visibility"] == "include" and (
        registry.entities[item["entity_id"]].disabled_by is not None
        or registry.entities[item["entity_id"]].hidden_by is not None
        or is_backlight_entity(
            item["entity_id"],
            registry.entities[item["entity_id"]].name,
            registry.entities[item["entity_id"]].original_name,
        )
    ) for item in patches):
        connection.send_error(msg["id"], "invalid_entity", "Cannot expose disabled or hidden HA entities")
        return
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        updates = dict(manager.data["visibility"])
        for item in patches:
            entity_id, mode = item["entity_id"], item["visibility"]
            if mode == "default":
                updates.pop(entity_id, None)
            else:
                updates[entity_id] = mode
        new_state = dict(manager.data)
        new_state["visibility"] = updates
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({
    "type": "stevora/admin/rooms/aliases/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("room_aliases"): {str: str},
    vol.Optional("room_order"): [str],
    vol.Optional("room_labels"): {str: {vol.Required("bg"): str, vol.Required("en"): str}},
    vol.Required("entity_aliases"): {str: str},
})
@websocket_api.async_response
async def room_aliases_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    room_aliases = msg["room_aliases"]
    room_order = msg.get("room_order")
    entity_aliases = msg["entity_aliases"]
    if len(room_aliases) > 200 or len(entity_aliases) > 1000 or (room_order is not None and len(room_order) > 200):
        connection.send_error(msg["id"], "invalid_alias", "Too many aliases")
        return
    area_ids = {area.id for area in area_registry.async_get(hass).async_list_areas()}
    entity_ids = set(entity_registry.async_get(hass).entities)
    labels = msg.get("room_labels", {})
    if len(labels) > 200 or any(key not in area_ids or any(len(v.strip()) > 80 for v in pair.values()) for key, pair in labels.items()):
        connection.send_error(msg["id"], "invalid_translation", "Unknown room or invalid label")
        return
    if room_order is not None and (len(room_order) != len(set(room_order)) or any(key not in area_ids for key in room_order)):
        connection.send_error(msg["id"], "invalid_order", "Unknown or duplicate room in ordering")
        return
    if any(key not in area_ids or len(value.strip()) > 80 for key, value in room_aliases.items()) or any(
        key not in entity_ids or len(value.strip()) > 80 for key, value in entity_aliases.items()
    ):
        connection.send_error(msg["id"], "invalid_alias", "Unknown room/entity or alias too long")
        return
    manager = _manager(hass)
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        new_state = dict(manager.data)
        if labels:
            translations = dict(manager.data.get("translations", {}))
            rooms = dict(translations.get("rooms", {}))
            for key, pair in labels.items():
                rooms[key] = {lang: label.strip() for lang, label in pair.items() if label.strip()}
            new_state["translations"] = {**translations, "rooms": rooms}
        if room_order is not None:
            new_state["room_order"] = list(room_order)
        new_state["room_aliases"] = {key: value.strip() for key, value in room_aliases.items() if value.strip()}
        new_state["entity_aliases"] = {key: value.strip() for key, value in entity_aliases.items() if value.strip()}
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({
    "type": "stevora/admin/devices/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("profiles"): {str: vol.Any(dict, None)},
})
@websocket_api.async_response
async def devices_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    patches = msg["profiles"]
    if len(patches) > 500:
        connection.send_error(msg["id"], "invalid_profile", "Too many device profiles")
        return
    registry = entity_registry.async_get(hass)
    valid_areas = {area.id for area in area_registry.async_get(hass).async_list_areas()}
    users = await hass.auth.async_get_users()
    user_ids = {user.id for user in users if user.is_active}
    for entity_id, profile in patches.items():
        if entity_id not in registry.entities:
            connection.send_error(msg["id"], "invalid_entity", "Unknown device entity")
            return
        if profile is None:
            continue
        error = validate_profile(entity_id, profile, valid_areas)
        original = registry.entities[entity_id]
        if profile.get("controls") and is_backlight_entity(
            entity_id, original.name, original.original_name
        ):
            error = "Cannot enable backlight controls"
        # Reject unsupported selections at the server boundary as well as the UI.
        live = getattr(getattr(hass, "states", None), "get", lambda _id: None)(entity_id)
        current_capabilities = available_controls(
            entity_id, live, original.original_name or original.name
        )
        if live is not None and "controls" in profile and any(
            control not in current_capabilities for control in profile["controls"]
        ):
            error = "Control not supported by the live HA entity"
        if error or any(user not in user_ids for user in profile.get("user_ids", [])):
            connection.send_error(msg["id"], "invalid_profile", error or "Unknown user")
            return
    manager = _manager(hass)
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        profiles = dict(manager.data.get("device_profiles", {}))
        for entity_id, profile in patches.items():
            if profile is None:
                profiles.pop(entity_id, None)
            else:
                profiles[entity_id] = normalize_profile(profile)
        new_state = dict(manager.data)
        new_state["device_profiles"] = profiles
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    # Never acknowledge a visual category as successfully placed unless the
    # post-save manifest actually includes it. Explain the exact filter or
    # room exclusion that prevents a device from showing up in Lighting.
    entry = _entry(hass)
    manifest = build_manifest(hass, entry) if entry is not None else None
    included = {
        item["entity_id"]: item for item in (manifest or {}).get("entities", [])
    }
    reasons = {
        item["entity_id"]: item
        for item in (manifest or {}).get("discovery_diagnostics", {}).get("entities", [])
    }
    category_map = (manifest or {}).get("domain_mappings", {})
    results = {}
    for entity_id in patches:
        item = included.get(entity_id)
        diagnostic = reasons.get(entity_id, {})
        category = item.get("display_category") if item else None
        results[entity_id] = {
            "included": item is not None,
            "reason": "included" if item else diagnostic.get("reason", "not_discovered"),
            "area_id": item.get("area_id") if item else diagnostic.get("area_id"),
            "display_category": category,
            "in_lighting": bool(item and entity_id in category_map.get("lighting", [])),
        }
    connection.send_result(msg["id"], {
        "revision": manager.data["revision"],
        "devices": results,
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/translations/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("rooms"): {str: {vol.Optional("bg"): str, vol.Optional("en"): str}},
    vol.Required("entities"): {str: {vol.Optional("bg"): str, vol.Optional("en"): str}},
})
@websocket_api.async_response
async def translations_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    room_ids = {area.id for area in area_registry.async_get(hass).async_list_areas()}
    entity_ids = set(entity_registry.async_get(hass).entities)
    patches = {"rooms": msg["rooms"], "entities": msg["entities"]}
    if len(patches["rooms"]) > 200 or len(patches["entities"]) > 1000:
        connection.send_error(msg["id"], "invalid_translation", "Too many translations")
        return
    for category, known in (("rooms", room_ids), ("entities", entity_ids)):
        for key, labels in patches[category].items():
            if key not in known or any(
                not isinstance(value, str) or len(value.strip()) > 80
                for value in labels.values()
            ):
                connection.send_error(msg["id"], "invalid_translation", "Invalid localized name")
                return
    manager = _manager(hass)
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        translations = {
            kind: dict(manager.data.get("translations", {}).get(kind, {}))
            for kind in ("rooms", "entities")
        }
        for kind in ("rooms", "entities"):
            for key, labels in patches[kind].items():
                merged = dict(translations[kind].get(key, {}))
                for locale, value in labels.items():
                    if value.strip():
                        merged[locale] = value.strip()
                    else:
                        merged.pop(locale, None)
                if merged:
                    translations[kind][key] = merged
                else:
                    translations[kind].pop(key, None)
        new_state = dict(manager.data)
        new_state["translations"] = translations
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({"type": "stevora/admin/assistants/get"})
@websocket_api.async_response
async def assistants_get(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    pipelines = available_pipelines(hass)
    users = await hass.auth.async_get_users()
    connection.send_result(msg["id"], {
        "users": sorted([{"id": user.id, "name": user.name or user.id} for user in users if user.is_active], key=lambda item: item["name"].casefold()),
        "revision": manager.data["revision"],
        "settings": manager.data["assistants"],
        "pipelines": pipelines,
    })


@websocket_api.websocket_command({
    "type": "stevora/admin/assistants/update",
    vol.Required("expected_revision"): vol.Coerce(int),
    vol.Required("default_pipeline"): vol.Any(str, None),
    vol.Required("user_pipelines"): {str: str},
})
@websocket_api.async_response
async def assistants_update(hass, connection, msg):
    if not require_admin(connection, msg):
        return
    manager = _manager(hass)
    settings = {
        "default_pipeline": msg["default_pipeline"],
        "user_pipelines": msg["user_pipelines"],
    }
    async with manager.lock:
        if msg["expected_revision"] != manager.data["revision"]:
            connection.send_error(msg["id"], "conflict", "Configuration revision changed")
            return
        pipeline_ids = {item["id"] for item in available_pipelines(hass)}
        users = await hass.auth.async_get_users()
        user_ids = {user.id for user in users if user.is_active}
        error = validate_assistant_settings(settings, pipeline_ids, user_ids)
        if error:
            connection.send_error(msg["id"], "invalid_assistant", error)
            return
        new_state = dict(manager.data)
        new_state["assistants"] = settings
        new_state["revision"] = manager.data["revision"] + 1
        await manager.save_state(new_state)
    connection.send_result(msg["id"], {"revision": manager.data["revision"]})


@websocket_api.websocket_command({"type": "stevora/assistants/resolve"})
@websocket_api.async_response
async def assistants_resolve(hass, connection, msg):
    """Resolve only the invoking user's preference, never expose other users."""
    if _entry(hass) is None:
        connection.send_error(msg["id"], "not_configured", "STEVORA is not configured")
        return
    manager = _manager(hass)
    pipelines = available_pipelines(hass)
    selected = resolve_pipeline(
        manager.data["assistants"], connection.user.id,
        {item["id"] for item in pipelines},
    )
    connection.send_result(msg["id"], {
        "pipeline_id": selected,
        "source": "stevora" if selected else "home_assistant_default",
    })


def register(hass):
    for command in (capabilities, rooms_get, rooms_update, room_aliases_update, devices_update, translations_update, assistants_get, assistants_update, assistants_resolve):
        websocket_api.async_register_command(hass, command)
