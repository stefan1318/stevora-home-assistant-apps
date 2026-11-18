"""Focused regression tests for STEVORA registry projection.

Run with pytest in a Python environment with Home Assistant installed.
"""
from types import SimpleNamespace

from custom_components.stevora_manifest import project_registry


def area(id, name):
    return SimpleNamespace(id=id, name=name)


def entity(entity_id, area_id, disabled_by=None):
    return SimpleNamespace(entity_id=entity_id, area_id=area_id, disabled_by=disabled_by)


def test_sorted_rooms_and_enabled_entities_only():
    rooms, mappings = project_registry(
        [area("kitchen", "Kitchen"), area("bed", "Bedroom")],
        [
            entity("light.kitchen", "kitchen"),
            entity("climate.bed", "bed"),
            entity("light.disabled", "kitchen", "user"),
            entity("switch.unassigned", None),
            entity("sensor.other_home", "unknown"),
        ],
    )
    assert rooms == [{"id": "bed", "name": "Bedroom"}, {"id": "kitchen", "name": "Kitchen"}]
    assert mappings == {"bed": ["climate.bed"], "kitchen": ["light.kitchen"]}


def test_empty_installation():
    assert project_registry([], []) == ([], {})


def test_stable_output_across_registry_order():
    rooms = [area("a", "Living"), area("b", "Kitchen")]
    entries = [entity("light.z", "a"), entity("light.a", "a")]
    assert project_registry(rooms, entries) == project_registry(
        list(reversed(rooms)), list(reversed(entries))
    )
