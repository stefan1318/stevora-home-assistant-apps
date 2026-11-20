# STEVORA Ecosystem — STEVORA OS + Android + iOS

**Общ продуктов договор:** [STEVORA_ECOSYSTEM_POLICY.md](STEVORA_ECOSYSTEM_POLICY.md).

STEVORA OS е централният продукт. Core, Universal Integration, Home Panel
7.1.1 Premium, Home Hub, Frontend, People & Presence и Manifest са вградени
OS подсистеми, не отделни продукти или клиентски инсталации.

STEVORA Android и iOS са нативни клиенти на STEVORA OS и извличат
потребителските настройки, стаи, устройства, capabilities, роли и наличните
voice/AI функции от единния системен договор. **Hey Stevora** е вградена
функция в трите интерфейса, която използва реално инсталирани и активирани
асистенти, клиентски предпочитания и придобити пакети.

**STEVORA Memory & Sync** е незадължителен личен OS модул само за
домовете на собственика; не е публично bundled или включен по подразбиране.

## Исторически код и текущо състояние

Хранилището съдържа legacy Home Assistant custom integration, Panel, Hub,
STEVORA OS frontend прототипи и Native DP01 image source. Те са техническа
основа за миграция и тестове — **не доказателство**, че пълната OS 1.0 е готова.

Native architecture: [distribution/ARCHITECTURE-BG.md](distribution/ARCHITECTURE-BG.md).
OS image tests: [distribution/native-image/README-BG.md](distribution/native-image/README-BG.md).

## Сигурност

Използвай само проверени независими тестови VM инсталации. Source-contract
CI не доказва успешен OS boot. Dunav не се променя без отделно одобрение,
backup, проверки на правата и rollback.

Личният legacy stevora_memory_mcp предоставя read-only MCP и порт 8765
не е публичен. Тази техническа реализация не влиза в базовия публичен OS образ.
