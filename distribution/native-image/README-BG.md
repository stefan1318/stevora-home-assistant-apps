# [STE-00] STEVORA OS Native Developer Preview 0.1 — действителен image build

**Важно:** Това е първата тестова версия на **собствен OS installation image**, а не STEVORA Panel/PWA. Image е базиран на конкретен upstream HA OS commit; включва модифициран Buildroot rootfs, собствен OS branding, native systemd услуга и собствен STEVORA начален frontend на **http://VM-IP/** (порт 80).

## Граница на първия тест

- **Включено:** собствен native boot image, UEFI/OVA, STEVORA boot identity, отличимо лого, отделен systemd HTTP server на OS host, собствен статичен STEVORA интерфейс на основния URL.
- **Не е включено още:** авторизиран frontend, HA login през STEVORA, Home/Rooms/Devices реално управление, Integrations setup, Apps/Add-ons, Supervisor bridge, automation editor, system operations, backup, updates и native Pi4/Pi5 образи.
- **Не трябва да се приема за пълна STEVORA OS 1.0**: това е boot & branding gate. HA Core/Supervisor все още се управляват чрез upstream image на технически адрес. Не сливай с продукционна система.
- **Безопасност:** интерфейсът на порт 80 е публичен, но съдържа само статични файлове; не показва лични данни, не приема пароли и не изпълнява команди. Не отваряй порт 80 към публичния интернет. 
- **Идентичност:** `HAOS_ID` е запазен като `haos` поради Supervisor/RAUC съвместимост. Променено е OS име и са добавени отделни STEVORA файлове. Пълният STEVORA release/update identity ще се разработи при OTA/RAUC milestone.
- **Актуализации:** upstream HAOS update може да замени този developer image със stock HAOS. Не изпълнявай OS update в DP01 до тестване на собствен OTA канал.
- **Hostnames:** първият тест се прави по **IP адрес на виртуалната машина**, не чрез `homeassistant.local` или `stevora.local`, защото DNS/mDNS е отделен етап.

## Възпроизводим build

Pinned upstream HAOS SHA:

```text
home-assistant/operating-system
495bedb8d70a92ad189efb64829ece34b165d3bd
```

При Buildroot build updater scripts реалната дистрибуция се компилира и събира по официалната схема. Сценарият е:

1. Чиста checkout на STEVORA development branch.
2. Checkout на upstream HAOS **точния SHA**, с неговия Buildroot submodule.
3. `distribution/native-image/scripts/prepare-haos.sh haos` patch-ва само копието за компилация.
4. `cd haos && scripts/enter.sh make O=output_ova ova` изпълнява действителна Buildroot сборка.
5. `qemu-smoke.sh` стартира генерирания UEFI QCOW2 и по TCP/80 проверява STEVORA страницата и native build JSON.
6. Само при QEMU boot success се създава GitHub artifact с образите и SHA256 checksums.

**Никакво `ha core check` върху старата VM, никакви ZIP файлове за custom_components/stevora_os и никакъв ръчен PWA shortcut не заменят тези image тестове.**

## Linux local build — само за разработчици

Нужни са Linux с Docker и sudo/privileged containers, много свободен диск и достатъчно ресурси. Buildroot може да отнеме значителни ресурси; стандартен малък GitHub runner може да не е достатъчен.

```sh
git clone https://github.com/stefan1318/stevora-home-assistant-apps.git
cd stevora-home-assistant-apps
git checkout feature/stevora-os-native-dp01-ova-20261120

git clone --filter=blob:none https://github.com/home-assistant/operating-system.git haos
git -C haos checkout 495bedb8d70a92ad189efb64829ece34b165d3bd
git -C haos submodule update --init --depth 1
bash distribution/native-image/scripts/prepare-haos.sh haos

cd haos
scripts/enter.sh make O=output_ova ova
```

Проверявай само успешен boot на генерирания образ, не само успешна компилация.

## Инсталиране за VM тест — **само след CI build+QEMU PASS**

- Изтегли `stevora-native-dp01` GitHub Actions artifact за точния successful build SHA.
- Провери checksums от `SHA256SUMS.txt`.
- За QEMU: разархивирай `stevora-native-dp01-ova.qcow2.xz` до QCOW2 и създай **нова отделна UEFI VM** с поне 3 GB RAM и 2 vCPU.
- За VirtualBox: използвай издадения `*.vdi.zip` образ, ако CI го е включил, и настрой EFI, 3 GB RAM, 2 vCPU и Bridged Adapter. При проблем с disk import използвай "Use existing virtual hard disk".
- За Hyper-V: използвай `*.vhdx.zip` и Generation 2 UEFI VM, като Secure Boot настройките могат да изискват изключване за неподписан developer image.
- Не замествай съществуващата alpha.2 тестова VM. **Не разархивирай върху VM disk или Raspberry Pi SD**.
- След boot намери новия IP от DHCP/конзолата и отвори `http://<VM-IP>/` (порт 80). Трябва да се види самостоятелният STEVORA Native DP01 интерфейс и logo.
- `http://<VM-IP>:8123/` може да покаже upstream HA initial setup; това **не** е финалният STEVORA интерфейс. В този DP01 се тества само native host integration.
- Изключи VM след тестовете и запази snapshot. Не ъпдейтвай OS image през Supervisor; не използвай реални smart home credentials за този boot-only тест.

## Приемателни критерии

- [ ] Реалният build е преминал Buildroot без грешка за OVA.
- [ ] Реалният получен QCOW2 стартира в QEMU с UEFI.
- [ ] От основния URL `http://<VM-IP>/` се показва STEVORA OS, не HA custom panel.
- [ ] Логото е STEVORA; CSS и статичните ресурси не са 404.
- [ ] `http://<VM-IP>/build.json` съдържа release native-developer-preview-0.1 и flags false за управление.
- [ ] Няма нови грешки в native service `stevora-native-web.service`.
- [ ] Фоновият HA Supervisor може да стартира и да изтегли Core — това е *отделен* приемателен тест с интернет.
- [ ] UI няма управление на устройства/Pods/подсветки и не приема пароли в DP01.
- [ ] Работещата стара STEVORA VM и Dunav остават непокътнати.

## Кога започва реалният full system frontend

След успешен boot/native HTTP gate се изграждат Authenticated STEVORA Shell, backend bridge, users/auth, full Apps/Add-ons, Integrations и System Settings **в рамките на същата image дистрибуция**. Отделното preview UI на порт 80 ще премине към реалния основен системен frontend, включително auth, а не ще остане празна обвивка.

Няма текущ Stable 1.0, няма подписан OTA release и няма Raspberry Pi 4/5 build в DP01.
