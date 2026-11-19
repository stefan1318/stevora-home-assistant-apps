"""BG/EN presentation localization for STEVORA entities and rooms.

Explicit per-language labels win. A conservative phrase dictionary handles
common HA labels; unknown/proper names are retained rather than mistranslated.
"""
from __future__ import annotations
import re

PHRASES = {
    "living room": "Всекидневна", "lounge": "Всекидневна", "bathroom": "Баня",
    "kitchen": "Кухня", "bedroom": "Спалня", "hall": "Коридор",
    "hallway": "Коридор", "terrace": "Тераса", "balcony": "Балкон",
    "garage": "Гараж", "office": "Кабинет", "garden": "Градина",
    "dining room": "Трапезария", "children's room": "Детска стая",
    "guest room": "Гостна стая", "utility room": "Мокро помещение",
    "ceiling light": "Таванно осветление", "light": "Лампа",
    "lamp": "Лампа", "fan": "Вентилатор", "climate": "Климатик",
    "air conditioner": "Климатик", "temperature": "Температура",
    "humidity": "Влажност", "motion": "Движение", "door": "Врата",
    "window": "Прозорец", "switch": "Ключ", "brightness": "Яркост",
    "floor lamp": "Подова лампа", "led strip": "LED лента",
}
REVERSE = {v.casefold(): k.title() for k, v in PHRASES.items()}
REVERSE.update({"всекидневна": "Living Room", "дневна": "Living Room",
                "хол": "Living Room", "баня": "Bathroom", "кухня": "Kitchen",
                "спалня": "Bedroom", "коридор": "Hall", "тераса": "Terrace",
                "гараж": "Garage", "климатик": "Air Conditioner",
                "лампа": "Light", "вентилатор": "Fan",
                "таванно осветление": "Ceiling Light", "лед лента": "LED Strip"})
WORDS = {"main": "Основна", "ceiling": "Таванна", "wall": "Стенна",
         "bedside": "Нощна", "smart": "Умна", "light": "Лампа",
         "lamp": "Лампа", "fan": "Вентилатор", "sensor": "Сензор",
         "temperature": "Температура", "humidity": "Влажност",
         "motion": "Движение"}
BACK_WORDS = {v.casefold(): k.title() for k, v in WORDS.items()}
BACK_WORDS.update({"основна": "Main", "таванна": "Ceiling", "стенна": "Wall",
                   "нощна": "Bedside", "умна": "Smart", "сензор": "Sensor"})


def localize_name(name: str, locale: str, overrides=None) -> str:
    """Return a translated display name, never modifying the HA registry."""
    if locale not in ("bg", "en"):
        locale = "en"
    if isinstance(overrides, dict):
        value = overrides.get(locale)
        if isinstance(value, str) and value.strip():
            return value.strip()
    name = str(name or "")
    key = name.strip().casefold()
    if not key:
        return name
    dictionary = PHRASES if locale == "bg" else REVERSE
    exact = dictionary.get(key)
    if exact:
        return exact
    # Only translate fully recognized multi-word expressions.
    tokens = re.split(r"(\s+)", name.strip())
    word_map = WORDS if locale == "bg" else BACK_WORDS
    meaningful = [token for token in tokens if not token.isspace()]
    if meaningful and all(token.casefold() in word_map for token in meaningful):
        return " ".join(word_map[token.casefold()] for token in meaningful)
    return name


def localized_manifest(manifest: dict, locale: str) -> dict:
    """Create a locale-specific copy of a permission-projected manifest."""
    if locale not in ("bg", "en"):
        locale = "en"
    result = dict(manifest)
    result["preferred_language"] = locale
    result["rooms"] = [
        {**room, "name": localize_name(room.get("source_name", room["name"]), locale,
                                       room.get("translations"))}
        for room in manifest.get("rooms", [])
    ]
    result["entities"] = [
        {**entity, "name": localize_name(entity.get("source_name", entity["name"]), locale,
                                         entity.get("translations"))}
        for entity in manifest.get("entities", [])
    ]
    return result
