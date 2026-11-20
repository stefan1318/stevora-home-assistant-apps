# [STE-00/05] STEVORA OS 1.0.0-alpha.3 — PWA Identity & Integrations

**Development / draft only.** Не е Stable 1.0. Използвай само независимата Windows VM, не Dunav.

## Приета основа
Потребителят потвърди 8/8 успешни реални VM проверки за alpha.2 (onboarding, BG/EN, начало, compact, fullscreen, персонална изолация, устройства/климат/сцени, Assist, Hub, System Center и logs). Snapshot restore, offline/reconnect и Raspberry Pi не са още потвърдени.

## Добавени функции
1. Собствен STEVORA PWA manifest: id/start_url/scope са /stevora-os, display standalone, име STEVORA OS, фирмени цветове.
2. Истинско потребителски предоставено STEVORA PNG 192x192 лого, плюс SVG 512 и maskable с вграденото оригинално лого. Иконата се използва и в интерфейса.
3. Когато /stevora-os е активен, STEVORA добавя свои document.head PWA metadata и ги премахва при напускане. Съществуващите HA manifest/icon не се редактират или изтриват.
4. Admin-only HA WebSocket endpoint stevora_os/system/integrations: read-only списък на конфигурационните записи, domain/title/state/disabled/source и общи броячи, ограничен до 400 елемента.
5. Собствен екран Integrations със search/status metrics и официална HA fallback връзка. Само администратор има достъп до данните; без изнасяне на credentials, options, tokens.
6. При смяна на HA connection/user се изчистват integration inventory, admin/system state, манифест и лични предпочитания.
7. Всички предишни alpha.2 функции се запазват.

## Стриктни ограничения
- Няма самостоятелна HA OS distribution: официалният HA frontend остава за login, recover и нативни функции.
- PWA Install зависи от браузъра, HTTPS и правилно избрания manifest. На HTTP LAN IP Android/desktop могат да не предложат install.
- SVG 512/maskable се рендерират от оригиналното PNG лого; някои браузъри могат да изискват native PNG 512 за install, това е изричен VM тест.
- Няма service worker, offline data/control, token cache, push, native iOS IPA или Android APK в този alpha етап.
- Интеграциите са само за преглед; native HA config flows, integrations setup/removal, full automation editor, system backup/restore/update actions предстоят.
- Не са правени ARM64 Raspberry Pi приемателни тестове и production merge.

## Обновяване на независимата VM
Първо направи VM snapshot и запази работеща alpha.2. Използвай само точен GitHub commit SHA с успешно CI.

```sh
set -eu
SHA="<VERIFIED_GREEN_CI_SHA>"
BASE="https://raw.githubusercontent.com/stefan1318/stevora-home-assistant-apps/$SHA/custom_components/stevora_os"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="/config/custom_components/stevora_os"
STAGE="/config/custom_components/.stevora-os-alpha3-$STAMP"
BACKUP="/config/stevora-os-backup-alpha2-$STAMP"
test -d "$TARGET"
test -f /config/configuration.yaml
grep -Eq '^[[:space:]]*stevora_os[[:space:]]*:' /config/configuration.yaml
test ! -e "$STAGE"
test ! -e "$BACKUP"
command -v curl
mkdir -p "$STAGE/frontend/icons"
for FILE in manifest.json __init__.py system_api.py preferences.py integrations_api.py \
  frontend/stevora-os.js frontend/stevora-os.css frontend/manifest.webmanifest \
  frontend/icons/stevora-192.png frontend/icons/stevora-512.svg \
  frontend/icons/stevora-maskable-512.svg; do
  curl -fLsS --retry 3 "$BASE/$FILE" -o "$STAGE/$FILE"
done
grep -q '"version": "1.0.0-alpha.3"' "$STAGE/manifest.json"
grep -q "stevora_os/system/integrations" "$STAGE/integrations_api.py"
for FILE in frontend/manifest.webmanifest frontend/icons/stevora-192.png; do test -s "$STAGE/$FILE"; done
mv "$TARGET" "$BACKUP"
mv "$STAGE" "$TARGET"
echo "Rollback: $BACKUP"
if ! ha core check; then
  mv "$TARGET" "/config/stevora-os-failed-alpha3-$STAMP"
  mv "$BACKUP" "$TARGET"
  echo "Restored alpha.2; do not restart"
  exit 1
fi
```

При успешно конфигурационно валидиране изпълни отделно командата ha core restart, после презареди /stevora-os. При нужда направи hard refresh на Chrome.

## VM acceptance
- [ ] HA Core стартира; /stevora и оригиналният HA интерфейс продължават да работят.
- [ ] Няма регресии в Devices/Lighting/Climate/Scenes/Assist/Hub/Onboarding.
- [ ] Оригиналното STEVORA лого се вижда в панела.
- [ ] manifest.webmanifest и трите икони се отварят от /stevora_os_static без 404.
- [ ] Браузърът разпознава STEVORA name/start_url/scope; докладвай дали Install е достъпно и дали HTTPS е активен.
- [ ] При излизане от STEVORA нативният HA manifest/title/icon се възстановява.
- [ ] Integrations показва съответстващи на HA entry names, състояния и общ брой.
- [ ] Non-admin не може да извика admin WebSocket command и не вижда чужди integration данни.
- [ ] При смяна на user/home интеграционните и системните данни се изчистват.
- [ ] Няма backlight controls и нови грешки в HA Logs.
- [ ] VM snapshot и връщане към alpha.2 са практически проверени.

## Rollback
Върни точно архивния каталог, изписан при инсталиране, в /config/custom_components/stevora_os, после ha core check и ha core restart. Не променяй custom_components/stevora. При проблем с HA старта използвай snapshot на VM.

Няма официален Stable Release и няма промени в Dunav.
