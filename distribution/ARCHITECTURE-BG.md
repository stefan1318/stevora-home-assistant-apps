# [STE-00] STEVORA OS — Native Image Distribution (архитектурна корекция)

**Решение:** STEVORA OS 1.0 е **самостоятелна инсталационна дистрибуция**, а не custom panel, dashboard, PWA shortcut или add-on, отварян на `/stevora-os`. Работещите прототипи 0.1.0–1.0.0-alpha.3 са източник на бизнес логика и тестове, **не** готовият продукт.

**Текущ статус:** архитектурно пренасочване / DEV. Няма генериран и проверен STEVORA OS bootable image. Не инсталирай нищо от тази папка на Dunav.

## 1. Задължителен резултат

Потребител инсталира STEVORA OS образ на празен x86-64 VM/мини компютър или Raspberry Pi 4/5, свързва устройството към мрежата и отваря началния адрес на устройството. Получава STEVORA logo, STEVORA account/onboarding flow и **собствен STEVORA интерфейс на корена `/`**. Не вижда HA стандартния shell, Lovelace menu, HA sidebar или `/stevora-os`. Функциите за Settings, Devices, Rooms, Integrations, Apps (Add-ons), Automations, Voice, Users, Backups, Updates, System, Logs са част от STEVORA интерфейса.

HA Core, Supervisor и HA OS базовите компоненти се използват като технологична основа, но са невидими за обикновения потребител. **HA OS е операционен хост, не backend API**: Core е backend за устройства/автоматизации, Supervisor — за Apps/backup/OS lifecycle. Oфициален recovery интерфейс може да се запази като скрит, отделен локален аварийно-административен вход; не е ежедневната среда.

Образът се разпространява под STEVORA име: VM image (`ova` / qcow2/VDI според наличните artifacts) и Pi4/Pi5 (`rpi4_64`, `rpi5_64`, .img.xz); собствен release/version канал, инструкции за flash/boot и възстановяване. Успешното build-ване на **stock** HAOS image НЕ се брои за STEVORA OS image.

## 2. Реална системна архитектура

```text
[Boot firmware/UEFI]
       │
[STEVORA OS image: adapted HA OS / Linux Buildroot, systemd, Docker, RAUC]
       │
       ├── [Supervisor — Core, Apps/Add-ons, OS/host/backup lifecycle]
       ├── [HA Core — users/auth, integrations, entity registries, automations]
       ├── [STEVORA system bridge — protected server-side Supervisor API]
       ├── [STEVORA Universal Integration + Home Hub / Hey Stevora]
       └── [STEVORA Frontend (root /) — standalone full system UI]
                    └── home, rooms, devices, integrations, Apps,
                        settings, network, automations, users,
                        diagnostics, updates, backups, security
```

### Компонент A — собствен frontend като root application

- Отделен fork/собствен build на `home-assistant/frontend` с **нов основен STEVORA application shell**, не `panel_custom`.
- Стартира на `/` (основен URL); `/stevora-os` **няма продуктова роля**.
- Запазва съществуващите реализирани механизми на HA auth/login, HA Core WebSocket API, permissions и deep-link routing.
- Всички екрани са STEVORA-branded. За да постигнем пълна функционалност без опасно пренаписване от нулата, може да се използват проверени вътрешни компоненти от fork-а на HA frontend (например auth, integrations config flows, Apps, automation editor), адаптирани към STEVORA shell/дизайн и допълвани от собствени компоненти.
- Забрана за hardcoded Dunav entities, фалшиви статуси, backlight controls.
- Няма пренасочване на клиента към stock HA GUI за нормални Settings/Apps/Integrations workflows.

### Компонент B — Core/Supervisor backend

- `home-assistant/core` остава отговорен за auth/permissions/entities/automation. Официалните API/WS са първи избор.
- `home-assistant/supervisor` предоставя управление на Apps, Store, backups, update jobs, host/OS/network.
- STEVORA System Bridge — **отделен защитен service-side слой**; не изпраща `SUPERVISOR_TOKEN` или `manager` role credential към browser; получава admin контекст през валидирана HA session, въвежда audit trail, explicit confirmations и least privilege.
- Чувствителни операции: install/uninstall Apps, update, restore backup, reboot, modify network/users. Не се активират до отделен auth/recovery/security integration test.
- Съвместимост с бъдещи официални Core/Supervisor API версиите чрез compatibility matrix и контрактни тестове.

### Компонент C — собствен bootable image

- Изходна основа: `home-assistant/operating-system` (Buildroot/RAUC), форкната и версията е pinned.
- STEVORA OEM build overlay трябва реално да включва STEVORA root frontend, поддържан Core/Frontend runtime, System Bridge, onboarding/config, собствени boot assets и release identity.
- Ако frontend е отделен fork на HA frontend, production build трябва да бъде доставен от собствена `hass_frontend`/Core runtime комбинация, а не ръчен `configuration.yaml` hack.
- Отделни image targets: първо `ova` за Windows VM, после `rpi4_64` и `rpi5_64`.
- Образът трябва да има автоматични boot checks, уникални версии и SHA256/подпис; GitHub Actions публикува .img/.qcow2 artifacts **само когато image е действително STEVORA-branded и boot-tested**.
- Апдейт канал: собствен release и OTA signing/RAUC стратегия. Официална HA OS/Core актуализация може да презапише нашия runtime; затова не твърдим, че upstream updates могат да се прилагат директно без STEVORA packaging/QA. Upstream security patches ще се интегрират след test/pin.

## 3. Реална продуктова функционалност (Definition of Done)

| Модул | Готово когато ... | Статус сега |
|---|---|---|
| Първи boot/setup | image boot → STEVORA URL / → auth, language, discovery, rooms | Не |
| Full frontend | няма видим HA shell, 100% STEVORA navigation, desktop/mobile | Не |
| Home/Rooms/Devices | пренесени alpha controllers, HA scoped permissions, BG/EN | Прототип |
| Climate/Lights/Scenes | capability-aware actions, няма backlight actions | Прототип |
| Integrations | setup/configure/reload/remove native authorized UI | Read-only прототип |
| Apps/Add-ons | store, install/update/uninstall, options, logs, ingress | Не |
| Automations | full create/edit/trigger/schedules | Не |
| User & Security | HA identity/roles/permission enforcement в STEVORA | Частично (auth) |
| System Center | network/storage/health/jobs/updates/logs | Частично |
| Backup/Restore | safe guided backup, secure restore, tested rollback | Не |
| Updates | signed OS updates, Core compatibility and recovery | Не |
| Pi 4/5 | physical boot, drivers, radio, SSD, memory, OTA rollback | Не |

**Никой модул не се приема за „готов“ само защото линк сочи към стандартен HA екран**. Reused underlying functional component within branded STEVORA shell е допустим, ако действително поддържа оригиналните операции, права и екрани и е изцяло визуално интегриран.

## 4. Разделяне на репозиторий и releases

Предложена структура (може да се раздели в отделни GitHub repositories):

- `stevora-os`: fork на Home Assistant Operating System, Buildroot/boot/OTA/image.
- `stevora-frontend`: fork на Home Assistant frontend + STEVORA app shell / pages / translations.
- `stevora-system-bridge`: Supervisor service + permissions, audit, admin endpoints.
- `stevora-home-assistant-apps`: Universal Integration, Home Hub и досегашните прототипи. Този repo остава източник на съществуващите работещи функции и миграционни тестове.

Няма възможност да се създаде repo/fork с текущата GitHub връзка, затова тази архитектура първо е документирана в изолиран development branch на съществуващия repo. **Не представяй този branch като самостоятелен OS fork.**

## 5. Ред за реализация

1. **OS contract / upstream pinning.** Избор на точни версии на HA OS/Core/Supervisor/Frontend и лицензи, release scheme. Проверка кои собственически assets са разрешени.
2. **Full root frontend.** STEVORA app shell като `/` и пълни основни HA features (включително Integrations, Apps и Settings), стъпил върху fork на frontend. Браузърна auth, API, permission и regression матрица.
3. **System Bridge.** Server-side Supervisor access, admin-only permission mapping, start/restart/install/update/backup workflows с confirm + audit + safe failure. Без browser tokens.
4. **OEM image pipeline.** Форк на HA OS, инжектиране на реалния frontend/runtime при first boot и собствено image build. Първо `ova`; smoke в напълно чиста Windows VM, после Pi4/Pi5 images.
5. **Update & recovery.** Собствен OTA feed/signature, backup import/restore (миграция от съществуващ HA), dual slot/RAUC и crash/rollback тестове.
6. **Release Candidate.** Единна STEVORA install UX и реално покритие на всички системни екрани; x86-64/RPi 4/5 integration и compliance checks; само тогава Stable 1.0.

## 6. Миграция / отказоустойчивост

- За тестовата VM: запази работещата alpha.2/alpha.3 като **отделна референтна VM**. Не я „преправяй“ с ръчни файлове в /config за собствен OS image.
- Изгражда се **нова чиста VM** от STEVORA image; възстановяването на системните данни става с HA backup import, когато го поддържа STEVORA onboarding и е тестван.
- Dunav остава непокътнат, докато няма функционален native image с доказан rollback.
- Recovery path трябва да работи дори при счупен STEVORA frontend и да е ограничен до local admin/auth.

## 7. Сигурност, лиценз и бранд

- Home Assistant има open-source компоненти, но trademark/licensing/attribution и лицензи на отделните зависимости трябва да се запазят/прегледат, особено при redistribution.
- STEVORA не трябва да се представя за официална HA OS или да използва чужди защитени марки без разрешение; обозначаване „powered by open-source Home Assistant“ при правилно attribution.
- Няма вградени пароли, токени, Dunav идентификатори или лични мрежови адреси в образите.
- Високорисковите системни функции са отказани по подразбиране до security gates.
- Няма bootable image, image signature, system bridge и пълен STEVORA frontend към датата на този документ. Това е **нов продуктово-технически договор**.
