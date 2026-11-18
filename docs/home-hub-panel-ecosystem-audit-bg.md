# STEVORA Home Hub / Home Panel — технически одит, 18.11.2026

**Статус:** прочитане и локално тестване; не е променяна работеща HA инсталация.

## Проверени данни

- Home Assistant Dunav: Home Assistant OS, Core 2026.11.2, Python 3.14.10, Supervisor 2026.11.0, OS 18.5 (прочетено 18.11.2026).
- Има заредени Mobile App интеграции за различни телефони и `person`/`device_tracker` entities. Налице са STEVORA Home/Away/Night/Relax сцени.
- Не е открита инсталирана конфигурационна интеграция `stevora_presence`/iCloud. Не активирайте експерименталния iCloud ZIP.
- Наблюдавани проблеми: предупреждения за прекъсвания на WebSocket, невалидни входове от тестов iOS клиент, Tuya отказ при изпълнение на Leave Home, временни unknown показания на HomePod шаблонни сензори, недостъпни Ollama/Wyoming интеграции. Не се коригират чрез произволен рестарт или изпълнение на device actions.

## 7.1.1 Panel — преглед по предоставените архиви

- Източник: предоставени от потребителя v7.1 Memory Manager Update и v7.1.1 Hotfix, а не live /config файлове.
- В текущата имплементация има твърдо зададени entity_id и потребителски домашни предположения; това нарушава общото изискване за универсален STEVORA продукт.
- Старото компактно Presence използва един конкретен Person и телефон. Издаден е отделен read-only compatibility preview за native HA Person/device_tracker.
- Някои ограничения за стенния профил са UI проверки по username, не backend permission model.
- Пълно премахване на hardcoded зависимости и безопасен multi-home onboarding изискват отделна архитектурна миграция и тестове.
- Крайни потребителски GPS координати и чувствителни данни не се публикуват в GitHub или в frontend.

## Безопасна стратегия

1. Не редактирайте настоящия Home Hub през този GitHub PR; няма файлов достъп до /config през конектора.
2. Backup на Home Assistant; сравняване с актуалния /config/www панел чрез хеш проверка; само dry-run на съвместимия пач.
3. Проверка на Person↔mobile tracker за всеки отделен HA потребител и разрешения за локация; тест на заключен екран при native app.
4. Преглед на Leave Home Tuya грешката, template unknown, iOS OAuth/WebSocket PONG и voice connectors като отделни задачи.
5. Едва след integration tests и проверени build номера: release, changelog и migration на унифицираните договори.

Свързан стандарт: [PRODUCT_STANDARDS.md](https://github.com/stefan1318/stevora-memory-sync/blob/main/PRODUCT_STANDARDS.md).
