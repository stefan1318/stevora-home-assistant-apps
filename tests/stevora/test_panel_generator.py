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

    def test_display_category_is_independent_of_service_domain(self):
        result = generator.generate_panel(manifest(
            [{"id": "k", "name": "Kitchen"}],
            [{
                "entity_id": "switch.lamp", "area_id": "k",
                "name": "Pendant", "display_category": "lighting",
                "available_controls": ["toggle"],
                "controls": ["toggle", "brightness"],
            }],
            ["switch.lamp"],
        ))
        card = result["sections"][0]["cards"][0]
        self.assertEqual(card["domain"], "switch")
        self.assertEqual(card["display_category"], "lighting")
        self.assertEqual(card["icon"], "mdi:lightbulb")
        self.assertEqual(card["controls"], ["toggle"])
        self.assertEqual(card["available_controls"], ["toggle"])

    def test_capabilities_block_unsupported_manual_actions(self):
        result = generator.generate_panel(manifest(
            [{"id": "k", "name": "Kitchen"}],
            [{
                "entity_id": "light.simple", "area_id": "k",
                "available_controls": ["toggle"],
                "controls": ["toggle", "color","brightness"],
            }],
            ["light.simple"],
        ))
        self.assertEqual(result["sections"][0]["cards"][0]["controls"], ["toggle"])

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


    def test_extended_native_controls_survive_scoped_model(self):
        result = generator.generate_panel(manifest(
            [{"id": "r", "name": "Room"}],
            [
                {"entity_id": "fan.bath", "area_id": "r",
                 "controls": ["oscillate", "direction"]},
                {"entity_id": "climate.room", "area_id": "r",
                 "controls": ["swing_mode"]},
                {"entity_id": "cover.window", "area_id": "r",
                 "controls": ["tilt"]},
            ],
            ["fan.bath", "climate.room", "cover.window"],
        ))
        by_id = {x["entity_id"]: x for x in result["sections"][0]["cards"]}
        self.assertEqual(by_id["fan.bath"]["controls"], ["oscillate", "direction"])
        self.assertEqual(by_id["climate.room"]["controls"], ["swing_mode"])
        self.assertEqual(by_id["cover.window"]["controls"], ["tilt"])

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
