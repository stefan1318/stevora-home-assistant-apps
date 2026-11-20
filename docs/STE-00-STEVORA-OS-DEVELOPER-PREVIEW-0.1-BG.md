# [STE-00] STEVORA OS Developer Preview 0.1.0 (Windows HA OS VM)

**Статус: DEVELOPMENT / NOT RELEASED.** Използвай само независимата тестова HA OS VM. Не инсталирай в Dunav, не заменяй Home Assistant Core/OS и не смесвай с производствени интеграции.

## Обхват

- Изолирана Home Assistant custom integration `stevora_os`, активирана чрез `stevora_os:` в `configuration.yaml`.
- Custom panel на `/stevora-os` с премиум shell, Home / Rooms / System / About и BG/EN.
- Чете само `stevora/manifest` от вече конфигурираната STEVORA Universal Integration и текущи live state стойности **само за включените в този scoped manifest entities**.
- System е само информативен. Административният линк води към оригиналните HA Settings и се показва само на HA администратор.
- Няма управление на устройства, системни обновления, backup или рестарт, няма собствен login и няма модификации по HA OS. Hey Stevora не се представя за включен модул.
- Оригиналният `/stevora` остава непроменен; `/stevora-os` е отделен път. Възстановяването остава през нормалния Home Assistant UI.

## Предварителни условия

1. Направен HA backup и snapshot на виртуалната машина (от Windows/hypervisor).
2. Работеща независима HA OS VM и инсталирана STEVORA Universal Integration с `stevora/manifest` (препоръка: провереният кандидат 0.3.0-beta.5 от съответния тестов клон).
3. Home Assistant Terminal & SSH с достъп до `/config`, работещи `curl` и `ha`.
4. GitHub CI за този preview клон е **успешен**. Не инсталирай, ако проверките са червени.
5. Няма друга инсталация, използваща пътя `/stevora-os`.

## Инсталация — само в независимата VM

След успешен GitHub CI, в Terminal & SSH изпълни:

```sh
set -eu
REPO="https://raw.githubusercontent.com/stefan1318/stevora-home-assistant-apps"
BRANCH="feature/stevora-os-developer-preview-0-1-20261120"
BASE="$REPO/$BRANCH/custom_components/stevora_os"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="/config/custom_components/.stevora-os-stage-$STAMP"
TARGET="/config/custom_components/stevora_os"
CONFIG="/config/configuration.yaml"

test -f "$CONFIG"
command -v curl
mkdir -p "$STAGE/frontend"
for f in manifest.json __init__.py frontend/stevora-os.js frontend/stevora-os.css; do
  curl -fLsS --retry 3 "$BASE/$f" -o "$STAGE/$f"
done
grep -q '"version": "0.1.0"' "$STAGE/manifest.json"
grep -q 'stevora-os-preview' "$STAGE/frontend/stevora-os.js"

# Existing install is retained for rollback; no other app or /stevora is touched.
cp -a "$CONFIG" "/config/configuration.yaml.before-stevora-os-$STAMP"
if [ -e "$TARGET" ]; then
  mv "$TARGET" "/config/stevora-os-backup-$STAMP"
fi
mv "$STAGE" "$TARGET"

# Do not append a duplicate YAML key.
if ! grep -Eq '^[[:space:]]*stevora_os[[:space:]]*:' "$CONFIG"; then
  printf '\nstevora_os:\n' >> "$CONFIG"
fi
ha core check
```

Ако последната команда приключи успешно, стартирай:

```sh
ha core restart
```

Отвори `http://<VM-IP>:8123/stevora-os` или използвай същата HTTPS основа, с която вече отваряш тестовата си HA VM. При нормален режим не са необходими допълнителни портове и външно публикуване.

Ако `ha core check` отчете грешка, **не рестартирай**, възстанови `configuration.yaml` от създаденото копие и върни предишния каталог `stevora_os` (ако е имало такъв).

## Тестове за приемане

- [ ] HA OS се стартира нормално след рестарт; оригиналният Home Assistant UI е достъпен.
- [ ] `/stevora` продължава да работи без промяна.
- [ ] `/stevora-os` отваря STEVORA OS preview и показва BG/EN.
- [ ] Броят помещения и устройства съвпада с видимите за същия HA потребител в manifest.
- [ ] Read-only профил вижда само разрешените му помещения и устройства; няма административен линк.
- [ ] При смяна на потребител/сървър стари данни от предишния дом не се визуализират.
- [ ] При недостъпна Universal Integration има ясно съобщение вместо фиктивни устройства.
- [ ] Desktop Chrome, Android и iPhone показват работеща responsive навигация.
- [ ] При 2 минути HA state updates не се губят активен екран, фокус и скрол.
- [ ] Home Hub статусът се показва честно; липсваща услуга не се обозначава като работеща.
- [ ] Backup/snapshot възстановяването е проверено.

## Премахване / rollback

1. В `/config/configuration.yaml` премахни **само** добавения ред `stevora_os:` или възстанови копието `configuration.yaml.before-stevora-os-<STAMP>`, ако междувременно не са правени други настройки.
2. Изпълни `ha core check`, после `ha core restart`.
3. След рестарта премахни `/config/custom_components/stevora_os` или върни архивния каталог `/config/stevora-os-backup-<STAMP>`. Ако върнеш стария модул, възстанови и предишния му YAML запис, ако е нужен.
4. При проблем с Home Assistant използвай VM snapshot / HA backup.
5. Не изтривай `custom_components/stevora` — това е отделен, работещ проект.

## Граници на теста

Windows VM използва **x86-64** HA OS. Не доказва ARM64 boot, Bluetooth/GPIO, PCIe/NVMe, термична стабилност или производителност на Raspberry Pi 4/5. Те изискват реален хардуер. CI/static tests не заместват реалния браузърен или HA приемателен тест.

Версия 0.1.0 е първи функционален OS shell, а не завършена фирмена операционна система.
