# [STE-00/05/06] STEVORA OS Native Integrated Developer Candidate — QA и release gates

**Статус:** реален, самостоятелен OEM image кандидат само за независима x86-64 UEFI VM. Не е STEVORA OS 1.0 Stable/RC. Възможно е функции да не преминат всички тестове. Запази Dunav и старата независима VM.

## Пет етапа — действителен статус

| Етап | Реално разработено | Какво остава до 1.0 |
|---|---|---|
| 1. Upstream/pinning | HAOS pin, Home Assistant Core auth, native gateway, source contract; App API verified | официална лицензна проверка, Core/Supervisor/Frontend update compatibility matrix |
| 2. Full root frontend | Native HTTPS root SPA, HA OAuth, per-user entity scoped Manifest, BG/EN, Rooms, Devices, Lighting, Climate ±1°C, Scenes, Assist, Integrations, Apps, Backup, System, User list, automation JSON editor | complete config flow UI for all selector types; options, diagnostics, HA scripts, voice audio, People & Presence; branded login UX |
| 3. Authorized bridge | HA Core supervisor/api WebSocket proxy (server-side admin enforced), no raw Supervisor token/browser management role | full auditing, role isolation tests, asynchronous jobs, failure recovery, safe system admin policy |
| 4. OEM native image | Buildroot OVA with Go HTTPS gateway + real Stevora adapter/Hub in HA data.img; automated QEMU UEFI boot, TLS smoke; GitHub SHA256 artifact | actual fresh-VM installation with OAuth, Core onboarding, 2 accounts, 2 homes; Pi4/Pi5 images and real hardware tests |
| 5. Updates/recovery | No direct unsafe upstream OS update exposed; backup creation in UI; backup list; VM image artifact SHA; manual VM snapshot rollback | **unimplemented:** STEVORA RAUC signer and trusted key rotation; own OTA server; verified A/B rollback; safe backup import/restore and migration; real restore tests |

**WARNING:** Проектът НЕ е завършил всички пет етапа. Блокираните операции и неизпълнените тестове са задължителни release gates, не козметични задачи.

## HTTPS / автентикация
Gateway слуша HTTP 80 за redirect и HTTPS 443 за собствената STEVORA SPA и Core auth/API reverse-proxy. TLS е самоподписан за първия тест и сертификатът включва локалните IP адреси, които системата има при boot. Това не е публично доверен сертификат; преди реална употреба трябва доверена CA конфигурация, подновяване и тест на мобилни клиенти.
Влизането използва OAuth provider на HA Core; достъпът до интеграции, Supervisor, Apps, архиви и потребители проверява текущия HA admin контекст на сървъра. След logout / смяна на HA акаунт състоянията, устройствата и токените се изчистват от текущата браузърна сесия.
За Development токените са само в sessionStorage (не localStorage), защитени от CSP/HTTPS, но browser-held refresh tokens все пак изискват XSS и MFA penetration checks преди release. Не публикувай gateway към интернет или недоверен LAN.

## Важни функционални ограничения
- Всяко устройство се показва и контролира само ако е позволено от STEVORA Manifest за текущия user/home; backlight controls са забранени.
- Hey Stevora реално включва текстов Home Assistant Assist fallback, без активен wake-word/audio клиент в този image.
- Apps може да се инсталират, стартират, спират, рестартират и актуализират само след explicit confirmation; резултатите зависят от Supervisor API и трябва да се тестват.
- Възможностите за integration config flow са частични: сложните field selectors и multi-step forms подлежат на тест; не твърдим пълен setup support.
- Автоматизациите имат advanced JSON editor по HA Core automation config endpoint; не е пълен визуален drag/drop редактор.
- User Settings, storage/network, security, OS update, backup restore са read-only / disabled до одобряване и реални rollback тестове.
- Не се включва STEVORA Memory & Sync в публичния образ. People & Presence, Home Panel 7.1.1 Premium и voice backend още не са изцяло мигрирани към native root, т.е. продуктовата политика не е изпълнена напълно.

## Независим VM приемателен план

### A. Boot/image
- [ ] GitHub CI source tests PASS, Go tests PASS, actual Buildroot OVA PASS.
- [ ] QEMU UEFI стартира *генерирания* STEVORA QCOW2, HTTPS 443 показва собствена STEVORA страница на / (не PWA/HA custom panel).
- [ ] Проверка на SHA256SUMS, xz integrity и QEMU disk info; съвпадение на commit SHA/build.json.
- [ ] Windows Hyper-V Gen2 / VirtualBox UEFI (нов VM, 3+ GB RAM, 2 vCPU, Bridged) boot PASS.
- [ ] /healthz отваря STEVORA native gateway. HTTP 80 пренасочва към HTTPS 443. :8123 остава възстановителен интерфейс.

### B. Authentication and permissions
- [ ] Реален first-run Home Assistant onboarding → STEVORA OAuth и MFA login, HTTPS сертификат валиден/ръчно доверен.
- [ ] Незавършил HA setup показва подходящо състояние; няма безкраен OAuth redirect.
- [ ] Non-admin няма API достъп до Supervisor operations, конфигурационните потоци, Users и Backup.
- [ ] Admin вижда правилно Apps, Integrations, System; промяна на user чисти кеш, токени, информация за предишния дом.
- [ ] Сесията се прекратява при Logout, refresh token fail и server switch.

### C. Native Home
- [ ] Автоматично включени STEVORA Universal Adapter и Home Hub; липсва legacy /stevora panel като основен продукт.
- [ ] Реални помещения/устройства, BG/EN, state changes, климат ±1°C, RGB и сцени.
- [ ] Забранени backlight entities нямат контроли; permission-scoped Manifest се спазва за два различни акаунта.
- [ ] Друг HA дом/VM няма фиксирани Dunav entity IDs.

### D. Apps / Settings
- [ ] Apps installed/store, start, stop, restart, logs, options, install, update — с изрично потвърждение и без secret leakage.
- [ ] Integrations list, simple setup/configure flow; сложни selectors се отбелязват unsupported, не се изпращат неверни данни.
- [ ] Automation JSON редактор: create/edit с валидна схема, reload и правилни права.
- [ ] Real System Center: Core/OS/Supervisor/Network/Host/status/jobs; няма опасни неизпитани действия.
- [ ] Backups: list и create, без Restore/OS Update контрол в този кандидат.

### E. Failure / recovery
- [ ] Кратко мрежово прекъсване, повторно свързване, промяна на VM IP, crash на gateway.
- [ ] Restart/reboot с данни; сертификат остава същият при същите интерфейси/адрес.
- [ ] Snapshot на новата VM, restore от snapshot в отделна тестова VM, без загуба на старата VM.
- [ ] Пълна инсталация от нов image без Интернет трябва да показва Core not ready, не фалшиви наличности.
- [ ] RAUC A/B OTA recovery **НЕ Е РЕАЛИЗИРАНА**. Няма публичен release без подписан update, проверен rollback и security audit.
- [ ] Pi4/Pi5 физически boot, радио/драйвери/USB/SSD/мрежа/OTA са pending.

## Инсталационни ограничения
Тествай само със съвсем нова празна UEFI VM и image от един точен успешен GitHub Actions run. Никакви инсталации върху Dunav, текущата HA VM, production, Raspberry Pi SD или данни за истински дом. Включи двата тестови акаунта само след проверка на HTTPS сертификата и собствеността на образа.

## Release blockers
Докато пълните Apps/Integrations и native admin UI, security тестовете, две различни инсталации, backup/restore, подписан STEVORA OTA/RAUC и Pi4/Pi5 acceptance са непотвърдени, **Stable/Release Candidate статусът е забранен**. Използвай само означението Developer Preview.

Крайният продукт остава една STEVORA OS, вътрешни STEVORA Core/Universal/Home Hub/Manifest/Frontend подсистеми и два мобилни OS клиента, според STEVORA_ECOSYSTEM_POLICY.md.
