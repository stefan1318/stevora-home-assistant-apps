"""Home Assistant Assist pipeline validation and per-user STEVORA routing.

This controls STEVORA client pipeline selection, not native HA authorization.
HA continues to enforce the underlying conversation/device permissions.
"""
from __future__ import annotations

from homeassistant.components.assist_pipeline import async_get_pipelines


def available_pipelines(hass) -> list[dict]:
    """Read live Assist pipelines; do not infer them from account type."""
    try:
        pipelines = async_get_pipelines(hass)
    except (KeyError, RuntimeError):
        return []
    return [
        {"id": pipeline.id, "name": pipeline.name}
        for pipeline in pipelines
    ]


def validate_assistant_settings(settings: dict, pipeline_ids: set[str], user_ids: set[str]) -> str | None:
    """Return validation error or None; reject stale and unknown references."""
    default = settings.get("default_pipeline")
    users = settings.get("user_pipelines", {})
    if default is not None and default not in pipeline_ids:
        return "Unknown default Assist pipeline"
    if len(users) > 200:
        return "Too many user overrides"
    for user_id, pipeline_id in users.items():
        if user_id not in user_ids:
            return "Unknown Home Assistant user"
        if pipeline_id not in pipeline_ids:
            return "Unknown Assist pipeline"
    return None


def resolve_pipeline(settings: dict, user_id: str, pipeline_ids: set[str]) -> str | None:
    """Resolve configured pipeline only if it still exists."""
    chosen = settings.get("user_pipelines", {}).get(user_id)
    if chosen in pipeline_ids:
        return chosen
    default = settings.get("default_pipeline")
    if default in pipeline_ids:
        return default
    return None
