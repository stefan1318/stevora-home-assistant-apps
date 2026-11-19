# [STE-00/05/06] STEVORA Home Hub — Universal Integration 0.3.0-beta.2

**Статус:** функционален тестов кандидат в отделен GitHub feature branch / Draft PR #9.
**Предшественик:** Universal Integration 0.2.0-rc.2 и Premium Home Panel 7.1.1.
**Не е потвърдена производствена версия.** Няма автоматична инсталация в Dunav.

## Какво реално е имплементирано

1. Home Hub се стартира и спира с lifecycle на HA конфигурационния запис, може да се изключи през Setup/Options; не променя съществуващи устройства и HA автоматизации.
2. Локална асинхронна подписка към Home Assistant `state_changed`: ограничен журнал от 250 последни записа, без съхранение на токени, attributes, имена или лични съобщения.
3. Локален център за предупреждения при `unavailable` и `recovered`; трисекундна защита от повторения; търсене по позволените entities. **Не изпраща push, SMS или cloud нотификации.**
4. Настройки на Home Hub, съхранявани в `.storage/stevora.home_hub.<entry_id>`, с revision compare-and-swap; конфигурация на разрешени domains, събития и предупреждения. Промените са административни.
5. Нови автентикирани WS API: `stevora/hub/status`, `stevora/hub/events`, `stevora/hub/scenes`, `stevora/hub/config/get`, `stevora/hub/config/update`. `status` и `events` са филтрирани според текущите HA read права и STEVORA manifest, не според клиентска заявка за роля.
6. Scene/script/automation каталог, ограничен по HA права. Само разрешените **scenes** имат бутон за активиране; той извиква директно `scene.turn_on` през HA frontend service API, а не през привилегирован Hub endpoint. Скриптовете и автоматизациите остават информационни, настройват се през нативния HA editor.
7. Home Panel 7.1.1 Premium има Home Hub екран с версия, статус, броячи, предупреждения, журнал и admin preferences. System и Insights използват същите данни. iOS/Android могат да ползват новите API, но тази версия **не променя APK/IPA кода**.
8. Home Hub статусите са `active`, `disabled`, `pending` или `error`, от реалното състояние на Python coordinator. Останалите продукти Hey Stevora/Memory не се представят като инсталирани.

## Граници на тази beta

- Няма cloud sync, достъп до лична памет, Hey Stevora voice engine, отделен Home Hub add-on, push gateway, самостоятелен HA installer wizard, автоматично създаване или промяна на сцени и автоматизации.
- Журналът на събитията е **само в паметта** и се занулява при HA restart/reload. Настройките се запазват на диск.
- Няма фонови устройства, които Home Hub управлява сам. Използва се автентикация и авторизация на HA.
- Python и JS CI тестовете се изпълняват с HA mocks, а не с действително работещ Home Assistant Core.

## Безопасна инсталация на НЕЗАВИСИМ тестов HA

1. В **Settings > System > Backups** направете пълен backup; проверете дали може да се възстанови.
2. Използвайте *последния успешен GitHub Actions run на feature/stevora-home-hub-v1-20261119* с commit SHA, съвпадащ с PR #9. Изтеглете `STEVORA-Universal-Integration-0.3.0-beta.2` от Artifacts.
3. Разархивирайте външния artifact ZIP; проверете вътрешния пакет `stevora-universal-integration-0.3.0-beta.2.zip` срещу `SHA256SUMS.txt`.
4. Спрете при наличие на **legacy `stevora_manifest`**. Двата компонента не трябва да се стартират едновременно, защото регистрират `stevora/manifest`.
5. Запазете копие на текущата папка `/config/custom_components/stevora`, после разархивирайте съдържанието на вътрешния ZIP в `/config/`. Проверете `custom_components/stevora/manifest.json` за `0.3.0-beta.2`.
6. Рестартирайте Home Assistant. От **Settings > Devices & services > STEVORA Ecosystem > Configure** изберете `home_hub_enabled`; при липса на изричен избор beta default е true. Отворете `/stevora` и проверете Home Hub.
7. Принудително обновете кеша на браузъра (`Ctrl+Shift+R`) при стар CSS.

## Корекция във версия 0.3.0-beta.2

- От страницата **System** бутонът **Open Home Hub** отваря Home Hub.
- Когато Home Hub вече е отворен, бутонът е **Refresh Hub data / Обнови данните** и извършва действително извличане на нови стойности чрез WS API.
- В картата се показва **Last updated / Обновено** при успешна синхронизация.
- След инсталация направете твърдо презареждане на браузъра, за да не се използва старият JavaScript.

## Acceptance checklist — физическа система, не само CI

- [ ] H01: При restart `home_hub.status=active`, `hub_version=1.0.0-beta.1`.
- [ ] H02: Изключване на `home_hub_enabled` деактивира слушателя/WS endpoint, без да влияе на Core и Panel; повторно активиране работи.
- [ ] H03: Промяна на светлина/климатик от реалния HA се отразява в `stevora/hub/events`; недостъпност/възстановяване създават локално предупреждение.
- [ ] H04: Неразрешени устройства, backlights и entities на друг HA дом не се виждат в ограничен user API.
- [ ] H05: Non-admin не може да използва `hub/config/get` и `hub/config/update`; read-only не може да активира сцена.
- [ ] H06: Администраторската конфигурация се съхранява след HA restart. Стар `expected_revision` връща `conflict`.
- [ ] H07: Активира се само разрешена сцена чрез оригиналния HA service API; no automated scene execution on setup.
- [ ] H08: Две независими HA инсталации имат различни `installation_id`, настройки и събития.
- [ ] H09: Home Panel 7.1.1 работи на desktop, iPhone и Android; когато Hub е изключен, няма фалшив статус `active`.
- [ ] H10: Локалният интерфейс за нотификации показва само реални събития; не обещава push.
- [ ] H11: Backup + restore rehearsal успешно възстановява 0.2.0-rc.2, без смущения в другите STEVORA интеграции.
- [ ] H12: Проверени `Settings > System > Logs` след инсталация, рестарт и деинсталация.

## Правила за одобрение

Считаме beta за *CI verified* само когато **всички проверки на точния commit са успешни**.
За **release approved** са необходими H01–H12 с реални устройства и backup rehearsal. Android и iOS изпълняват собствени E2E тестове за новите API и native HA OAuth.
Не приемайте PR #9 или родителските PR, нито инсталирайте на Dunav без изрично потвърждение след тези проверки.

## Rollback

Ако след ъпдейта има грешка, спрете Hub в HA Options, възстановете предишната папка `/config/custom_components/stevora` от запазеното копие и рестартирайте HA. При повреда на HA конфигурацията възстановете пълния backup. Старият STEVORA Core не използва данните от `.storage/stevora.home_hub.<entry_id>`; не ги изтривайте без одобрение.
