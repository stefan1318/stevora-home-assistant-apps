"""Run locally with: python -m unittest discover -s tests -v"""
import unittest

from stevora_manifest_v1 import build_manifest


class ManifestV1Tests(unittest.TestCase):
    def test_two_distinct_homes_have_independent_entities(self):
        a = build_manifest(
            "home-a", 1,
            [{"area_id": "living", "name": "Living Room"}],
            [{"area_id": "living", "entity_id": "climate.air_conditioner"}],
            "bg",
        )
        b = build_manifest(
            "home-b", 7,
            [{"area_id": "kitchen", "name": "Kitchen"}],
            [{"area_id": "kitchen", "entity_id": "light.ceiling"}],
        )
        self.assertEqual(a["mappings"], {"living": ["climate.air_conditioner"]})
        self.assertEqual(b["mappings"], {"kitchen": ["light.ceiling"]})
        self.assertNotEqual(a["installation_id"], b["installation_id"])

    def test_invalid_entity_and_unknown_area_are_skipped(self):
        data = build_manifest(
            "home-a", 0, [{"area_id": "a", "name": "A"}],
            [
                {"area_id": "a", "entity_id": "light.valid"},
                {"area_id": "a", "entity_id": "not_an_entity"},
                {"area_id": "other", "entity_id": "light.unknown"},
                {"area_id": "a", "entity_id": "light.valid"},
            ],
        )
        self.assertEqual(data["mappings"]["a"], ["light.valid"])

    def test_unsupported_language_falls_back(self):
        data = build_manifest("home-a", 1, [], [], "xx")
        self.assertEqual(data["preferred_language"], "en")

    def test_rejects_negative_revision(self):
        with self.assertRaises(ValueError):
            build_manifest("home-a", -1, [], [])


if __name__ == "__main__":
    unittest.main()
