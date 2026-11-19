"""STEVORA v7.1.1 panel generator contract tests (no HA dependency)."""
import importlib.util
from pathlib import Path
import unittest

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/panel_generator.py"
spec = importlib.util.spec_from_file_location("stevora_panel_generator_test", SOURCE)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def manifest(rooms, entities, controllable):
    return {
        "installation_id": "new-independent-home",
        "revision": 7, "preferred_language": "bg",
        "rooms": rooms, "entities": entities,
        "controllable_entities": controllable,
    }


class GeneratorTests(unittest.TestCase):
    def test_generates_arbitrary_rooms_and_preserves_order(self):
        rooms = [{"id": "garage", "name": "Garage"}, {"id": "loft", "name": "Loft"}]
        entities = [
            {"entity_id": "light.loft", "area_id": "loft", "name": "Reading",
             "layout": "expanded", "controls": ["toggle"], "icon": "mdi:book"},
            {"entity_id": "sensor.garage", "area_id": "garage", "name": "Air"},
        ]
        result = generator.generate_panel(manifest(rooms, entities, ["light.loft"]))
        self.assertEqual(result["panel_version"], "7.1.1")
        self.assertEqual([section["id"] for section in result["sections"]], ["garage", "loft"])
        self.assertEqual(result["total_cards"], 2)
        self.assertEqual(result["sections"][1]["cards"][0]["icon"], "mdi:book")

    def test_unprivileged_devices_are_information_only(self):
        result = generator.generate_panel(manifest(
            [{"id": "a", "name": "Room"}],
            [{"entity_id": "light.x", "area_id": "a", "controls": ["toggle"]}], []))
        self.assertEqual(result["sections"][0]["cards"][0]["controls"], [])

    def test_backlight_never_appears(self):
        result = generator.generate_panel(manifest(
            [{"id": "a", "name": "Room"}],
            [{"entity_id": "light.bedroom_backlight", "area_id": "a", "name": "Backlight"}],
            ["light.bedroom_backlight"]))
        self.assertEqual(result["total_cards"], 0)

    def test_profile_info_only_and_unsupported_control(self):
        result = generator.generate_panel(manifest(
            [{"id": "a", "name": "Room"}],
            [{"entity_id": "sensor.temp", "area_id": "a", "layout": "info", "controls": ["toggle"]},
             {"entity_id": "fan.room", "area_id": "a", "controls": ["toggle", "unlock"]}],
            ["sensor.temp", "fan.room"]))
        cards = result["sections"][0]["cards"]
        self.assertEqual(next(x for x in cards if x["entity_id"] == "sensor.temp")["controls"], [])
        self.assertEqual(next(x for x in cards if x["entity_id"] == "fan.room")["controls"], ["toggle"])


    def test_backlight_source_name_cannot_be_hidden_by_alias(self):
        result = generator.generate_panel(manifest(
            [{"id": "bath", "name": "Bathroom"}],
            [{"entity_id": "light.ambient", "area_id": "bath",
              "name": "Mirror", "original_name": "Mirror back-light"}],
            ["light.ambient"],
        ))
        self.assertEqual(result["total_cards"], 0)


if __name__ == "__main__":
    unittest.main()
