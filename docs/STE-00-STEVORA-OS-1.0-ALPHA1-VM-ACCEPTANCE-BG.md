# [STE-00] STEVORA OS 1.0.0-alpha.1 — Unified Frontend / Windows VM

**Development build. Do not install on Dunav. Not a final 1.0 release.**
User reported the preceding 0.2.0 version works in their independent VM. Detailed 0.2.0 security/restore acceptance evidence is not provided, so test 1.0 in the independent VM only.

## Реално внедрено в alpha.1

- Единен /stevora-os интерфейс с Home, Rooms, Devices, Lighting, Climate, Scenes, Automations, Assist, System, Settings, About.
- BG/EN етикети, responsive desktop/iPhone/Android и отделна mobile scroll navigation.
- Реални помещения/устройства от permission-projected STEVORA manifest **и** панелния model, със съвпадащи installation_id/revision; без Dunav IDs.
- Управление от STEVORA UI чрез оригиналните HA сервизи — само за устройства и controls, позволени едновременно от scoped manifest + generated panel model. Поддържа toggle (light/switch/fan), light brightness/RGB, fan percentage, climate target ±1 unit с граници, cover open/close, media pause/play.
- Подсветки са забранени в новия UI както в сървърния STEVORA manifest. Допълнителна JS проверка пази от неправилно подаден entity.
- Home Hub: permission-scoped сцени, автоматизации и налични събития; сцените могат да се активират само когато Home Hub допуска действие. Script и automation се показват информационно; създаване/редактиране още не са реализирани.
- Assist чат през съществуващата HA conversation/process API, не Hey Stevora; история само в паметта на текущата сесия.
- BG/EN room translation editor чрез администраторския `stevora/admin/translations/update` API, с optimistic revision проверка. Не променя директно HA регистрите.
- System Center 0.2 функционалност се запазва, под нова версия.
- Модулите се показват с реалните им status-и, непоставените не се представят за активни.
- При промяна на HA user/connection се изчистват манифест, модел, system info, admin/Hub metadata и чат.
- Официалните HA OS/Core/Supervisor остават непроменени, с автентикация/ъпдейти от HA. Stock HA интерфейс остава recovery fallback.

## Ограничения (задължително честно)

- **Не е извършена физическа замяна на stock HA frontend** в HA Core. /stevora-os е основният STEVORA панел. Официалният HA UI се запазва за възстановяване. Пълноскрийн PWA/standalone app routing е следващ етап.
- Още няма STEVORA-native управление на backup/restore, системни update/restart, Wi-Fi/Storage, пълно добавяне на HA integrations, users/security, multi-stage onboarding, automation editor и Hey Stevora.
- Общите HA права за извикване на services се контролират от HA backend. Показването на control в UI само по себе си не доказва server-level permissions — това е отделен тест.
- Няма доказана готовност за Raspberry Pi 4/5 от Windows VM тест.
- CI проверките ползват stubs, не заменят реални HA тестове.

## Обновяване само на независимата VM

**Препоръка:** направи нов VM snapshot въпреки наличния HA backup.

В Terminal & SSH:

```sh
set -eu
SHA="<replace-with-exact-green-CI-SHA>"
BASE="https://raw.githubusercontent.com/stefan1318/stevora-home-assistant-apps/$SHA/custom_components/stevora_os"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="/config/custom_components/stevora_os"
STAGE="/config/custom_components/.stevora-os-1-alpha-$STAMP"
BACKUP="/config/stevora-os-backup-0.2-$STAMP"

test -d "$TARGET"
test -f /config/configuration.yaml
grep -Eq '^[[:space:]]*stevora_os[[:space:]]*:' /config/configuration.yaml
test ! -e "$STAGE"
test ! -e "$BACKUP"
command -v curl
mkdir -p "$STAGE/frontend"
for FILE in manifest.json __init__.py system_api.py frontend/stevora-os.js frontend/stevora-os.css; do
  curl -fLsS --retry 3 "$BASE/$FILE" -o "$STAGE/$FILE"
done
grep -q '"version": "1.0.0-alpha.1"' "$STAGE/manifest.json"
grep -q 'stevora/panel/generate' "$STAGE/frontend/stevora-os.js"

mv "$TARGET" "$BACKUP"
mv "$STAGE" "$TARGET"
echo "Rollback path: $BACKUP"
if ! ha core check; then
  mv "$TARGET" "/config/stevora-os-failed-$STAMP"
  mv "$BACKUP" "$TARGET"
  echo "Restored previous version. Do not restart."
  exit 1
fi
```

Only if command succeeds:

```sh
ha core restart
```

Then open `https://your-existing-HA-host/stevora-os` or your VM's local http://IP:8123/stevora-os, using the same protocol as your working test server.

## Приемане на 1.0 alpha.1

- [ ] HA OS starts and original `/stevora` remains functional.
- [ ] 11 navigation views render on desktop and mobile; scrolling mobile navigation reaches all views.
- [ ] Home, Rooms, Devices use same rooms/entities as permission-scoped manifest; no hardcoded Dunav entities.
- [ ] Lighting: light/switch toggles and RGB/brightness work only on supported and permitted HA entities.
- [ ] Climate: ±1 degree, correct device bounds and room-specific controls; unsupported controls absent.
- [ ] Hidden, disabled and backlight entities have no direct controls even if manually categorized.
- [ ] Home Hub scenes can execute for authorized user; scripts/automations are correctly information-only.
- [ ] BG/EN room translations save and persist after HA restart, not leaking into another HA instance.
- [ ] Assist message works with configured HA conversation agent; no false Hey Stevora status.
- [ ] System Center still shows real read-only HA diagnostics.
- [ ] A non-admin user cannot call admin API, view admin settings or control excluded entities.
- [ ] Switching HA account / server clears cached personal and privileged data.
- [ ] No full DOM rebuild when ordinary HA state ticks occur; search/inputs stay focused.
- [ ] No regression on iPhone/Android responsive layout; /stevora-os uses same LAN bridge as before.
- [ ] Snapshot/rollback to 0.2.0 succeeds and removes new UI without damaging HA or /stevora.

## Rollback

If validation fails, do not touch `custom_components/stevora`. Stop further changes, then:

```sh
# Replace BACKUP with the exact printed backup directory!
BACKUP="/config/stevora-os-backup-0.2-<STAMP>"
STAMP="$(date +%Y%m%d-%H%M%S)"
test -d "$BACKUP"
mv /config/custom_components/stevora_os "/config/stevora-os-1-failed-$STAMP"
mv "$BACKUP" /config/custom_components/stevora_os
ha core check
ha core restart
```

Do not paste `<STAMP>` literally. Copy the real path from installation output.
