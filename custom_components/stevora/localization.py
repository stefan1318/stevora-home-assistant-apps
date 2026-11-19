"""BG/EN presentation localization for STEVORA entities and rooms.

Explicit per-language labels win. A conservative phrase dictionary handles
common HA labels; unknown/proper names are retained rather than mistranslated.
"""
from __future__ import annotations

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
    # Translate multiword labels only if *every* phrase is recognized.
    # Longest-match preserves combined terms such as "Ceiling Light".
    lexicon = {**(WORDS if locale == "bg" else BACK_WORDS), **dictionary}
    tokens = name.strip().split()
    translated = []
    index = 0
    while index < len(tokens):
        match = None
        for size in range(min(4, len(tokens) - index), 0, -1):
            phrase = " ".join(tokens[index:index + size]).casefold()
            if phrase in lexicon:
                match = (size, lexicon[phrase])
                break
        if match is None:
            return name  # Unknown proper names remain unchanged.
        translated.append(match[1])
        index += match[0]
    return " ".join(translated)


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
