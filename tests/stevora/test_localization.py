"""BG/EN localized manifest contract tests."""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[2] / "custom_components/stevora/localization.py"
spec = importlib.util.spec_from_file_location("stevora_localization_test", path)
loc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loc)


class LocalizationTests(unittest.TestCase):
    def test_bidirectional_common_names(self):
        self.assertEqual(loc.localize_name("Living Room", "bg"), "Всекидневна")
        self.assertEqual(loc.localize_name("Баня", "en"), "Bathroom")
        self.assertEqual(loc.localize_name("Ceiling Light", "bg"), "Таванно осветление")

    def test_custom_names_remain_untouched(self):
        self.assertEqual(loc.localize_name("My custom studio", "bg"), "My custom studio")
        self.assertEqual(loc.localize_name("Моята специална лампа", "en"), "Моята специална лампа")

    def test_explicit_bilingual_override(self):
        names = {"bg": "Лампата до дивана", "en": "Sofa lamp"}
        self.assertEqual(loc.localize_name("Whatever", "bg", names), "Лампата до дивана")
        self.assertEqual(loc.localize_name("Whatever", "en", names), "Sofa lamp")

    def test_scoped_manifest_not_mutated(self):
        source = {"preferred_language": "bg", "rooms": [
            {"id": "a", "name": "Kitchen", "source_name": "Kitchen"}],
            "entities": [{"entity_id": "light.a", "name": "Ceiling Light",
                          "source_name": "Ceiling Light"}]}
        localized = loc.localized_manifest(source, "bg")
        self.assertEqual(localized["rooms"][0]["name"], "Кухня")
        self.assertEqual(localized["entities"][0]["name"], "Таванно осветление")
        self.assertEqual(source["rooms"][0]["name"], "Kitchen")


if __name__ == "__main__":
    unittest.main()
