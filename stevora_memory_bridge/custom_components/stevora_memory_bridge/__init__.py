"""STEVORA Memory Bridge for Home Assistant.

Authenticated Home Assistant WebSocket commands, administrator-only.
Reads the SAME canonical files used by the STEVORA Memory MCP add-on.
Install as /config/custom_components/stevora_memory_bridge/.
"""
from __future__ import annotations

import json
from pathlib import Path

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

DOMAIN = "stevora_memory_bridge"
ROOT = Path("/config/stevora/memory")
FILES = {
    "knowledge_base.md", "ideas.json", "decisions.json",
    "implementation.json", "changelog.md", "sync_rules.md",
    "memory_status.json",
}
MAX_FILE = 256_000
MAX_RESULT = 40_000


def _safe_read(filename: str) -> str:
    if filename not in FILES:
        raise ValueError("File not allowed")
    if ROOT.is_symlink() or not ROOT.is_dir():
        raise ValueError("Memory directory unavailable")
    path = ROOT / filename
    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_FILE:
        raise ValueError("Memory file unavailable")
    return path.read_text(encoding="utf-8")


def _proposals(limit: int) -> list[dict]:
    folder = ROOT / "proposals"
    if folder.is_symlink() or not folder.is_dir():
        return []
    result = []
    for path in sorted(folder.glob("*.json"), reverse=True):
        if len(result) >= limit:
            break
        if path.is_symlink() or path.stat().st_size > 16_000:
            continue
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            result.append({
                key: record.get(key)
                for key in ("id", "category", "title", "details", "status", "created_at")
            })
        except (OSError, ValueError, TypeError):
            continue
    return result


@websocket_api.websocket_command({
    vol.Required("type"): "stevora_memory/read",
    vol.Required("filename"): vol.In(FILES),
})
@websocket_api.async_response
async def ws_read(hass: HomeAssistant, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Admin required")
        return
    try:
        value = await hass.async_add_executor_job(_safe_read, msg["filename"])
        connection.send_result(msg["id"], {"filename": msg["filename"], "content": value[:MAX_RESULT], "truncated": len(value) > MAX_RESULT})
    except (OSError, ValueError, UnicodeError) as exc:
        connection.send_error(msg["id"], "memory_unavailable", str(exc))


@websocket_api.websocket_command({
    vol.Required("type"): "stevora_memory/search",
    vol.Required("query"): vol.All(cv.string, vol.Length(min=1, max=200)),
})
@websocket_api.async_response
async def ws_search(hass: HomeAssistant, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Admin required")
        return

    def search():
        query = msg["query"].casefold()
        hits = []
        for filename in sorted(FILES):
            try:
                content = _safe_read(filename)
            except (OSError, ValueError, UnicodeError):
                continue
            for index, line in enumerate(content.splitlines(), 1):
                if query in line.casefold():
                    hits.append({"file": filename, "line": index, "text": line[:500]})
                    if len(hits) >= 50:
                        return hits
        return hits

    connection.send_result(msg["id"], {"results": await hass.async_add_executor_job(search)})


@websocket_api.websocket_command({
    vol.Required("type"): "stevora_memory/proposals",
    vol.Optional("limit", default=20): vol.All(vol.Coerce(int), vol.Range(min=1, max=30)),
})
@websocket_api.async_response
async def ws_proposals(hass: HomeAssistant, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Admin required")
        return
    result = await hass.async_add_executor_job(_proposals, msg["limit"])
    connection.send_result(msg["id"], {"proposals": result})


@websocket_api.websocket_command({
    vol.Required("type"): "stevora_memory/health",
})
@websocket_api.async_response
async def ws_health(hass: HomeAssistant, connection, msg):
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Admin required")
        return

    def check():
        accessible = ROOT.is_dir() and not ROOT.is_symlink()
        files = []
        if accessible:
            for name in sorted(FILES):
                path = ROOT / name
                if path.is_file() and not path.is_symlink() and path.stat().st_size <= MAX_FILE:
                    files.append(name)
        return {"bridge": "ready", "storage_available": accessible, "files": files,
                "read_only": True, "api_version": 1}

    connection.send_result(msg["id"], await hass.async_add_executor_job(check))


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    websocket_api.async_register_command(hass, ws_health)
    websocket_api.async_register_command(hass, ws_read)
    websocket_api.async_register_command(hass, ws_search)
    websocket_api.async_register_command(hass, ws_proposals)
    return True
