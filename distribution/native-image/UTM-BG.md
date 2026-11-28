# STEVORA OS Dev4 в UTM на Apple Silicon

1. В GitHub Actions отвори успешния UTM ARM64 UEFI run и изтегли
   `STEVORA-OS-Adaptive-Phase1-2-UTM-ARM64-QEMU-PASS` за общия Adaptive образ.
   Разархивирай ZIP файла и изпълни
   следните команди в получената папка.

   ```sh
   shasum -a 256 -c SHA256SUMS.txt
   xz -dk stevora-native-dev4-utm-arm64.qcow2.xz
   ```

2. Създай нова QEMU VM в UTM. Избери ARM64 (aarch64), ARM Virtual Machine
   (`virt`), 4 vCPU и 8 GB RAM. В настройките QEMU включи **UEFI Boot** и
   **Use Hypervisor**. Използвай QEMU конфигурация с VirtIO устройства.
3. Импортирай разкомпресирания QCOW2 като единствен системен диск с интерфейс
   VirtIO. Премахни празния диск и виртуалния CD/DVD, ако съветникът ги е
   добавил. Дискът е 32 GiB по подразбиране. За 64 GiB увеличи импортираното
   копие в настройките на диска преди първото стартиране.
4. Избери **Shared Network** и мрежов адаптер `virtio-net-pci`. Добави
   вградена Serial Terminal конзола, ако искаш да следиш зареждането. След
   стартиране отвори `http://<IP-на-VM>/` от Mac. IP адресът се вижда в
   конзолата (например с `ha network info`). Изчакай първоначалната
   подготовка на Home Assistant Core. Тя изисква достъп до интернет.
5. За тест с телефон използвай Bridged само в отделна тестова мрежа. За VM
   използвай нови тестови потребители и устройства.

CI проверява истинско ARM64 UEFI зареждане в QEMU, началната страница,
`/healthz`, версията и статичните ресурси. UTM с хардуерно ускорение на
macOS, onboarding, Home Assistant Core и Supervisor, мобилните клиенти,
реалните интеграции и Pi 4 периферията изискват отделни проверки.

Образът е за изолирани тестове. Началната страница е по HTTP на порт 80.
Подписани STEVORA OTA обновявания не са валидирани. Възстановяването на
архиви е изключено.

[Настройки на QEMU в UTM](https://docs.getutm.app/settings-qemu/qemu/)

## Изолиран тест на Adaptive Phase 1 и 2

- След onboarding отвори **Устройства**. При празен дом менюто не показва
  категории без устройства.
- Добави тестови устройства и помещения. Провери, че менюто се обновява,
  устройството остава видимо при временна недостъпност и се премахва при
  действително изтриване. Превключи между BG и EN.
- Провери климатичен режим и температура, както и избор на икона и ръчно
  групиране. Рестартирай VM и провери, че настройките са запазени.
- Влез с ограничен тестов акаунт. Провери, че вижда само разрешените устройства
  и няма достъп до редакция на категории и групи. Подсветките не се управляват.
- Контролите се появяват според наличните действия в каталога. Домейни без
  проверен адаптер за действие се представят само за четене.

## Прекъсване на достъпа след HA Restore

Направи проверките, докато прекъсването още се вижда. Запиши часа
и IP адреса на VM от UTM или от серийната конзола. От Mac провери по IP.

```bash
"/Applications/UTM.app/Contents/MacOS/utmctl" ip-address 'STEVORA OS Dev4'
VM_IP=172.20.10.3 # Замени с текущия IPv4 адрес от UTM.
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 4 "http://$VM_IP/healthz"
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 4 "http://$VM_IP:8123/"
arp -n "$VM_IP"
```

В серийната конзола на VM провери gateway, проксито и Core поотделно.

```bash
date -Iseconds
ip -br addr
ip route
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 4 http://127.0.0.1/healthz
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 4 http://127.0.0.1/auth/providers
curl -sS -o /dev/null -w '%{http_code}\n' --max-time 4 http://127.0.0.1:8123/
systemctl show stevora-native-web haos-supervisor -p Id -p ActiveState -p NRestarts
journalctl -b -u stevora-native-web -u haos-supervisor -u NetworkManager --since '-15 min' --no-pager
docker inspect -f '{{.Name}} {{.State.Status}} {{.State.StartedAt}} restart={{.RestartCount}} oom={{.State.OOMKilled}}' homeassistant hassio_supervisor
ha supervisor info
```

- Ако двата порта работят вътре, а Mac не достига същия IP и ARP е
  `(incomplete)`, провери пътя между Mac и VM. За A/B тест използвай
  **Shared Network** на отделно копие на VM. Вземи новия IP след boot и
  повтори проверката при смяна или повторно свързване към hotspot.
  Пусни копието отделно от оригинала и в изолирана тестова мрежа.
- Ако `/healthz` е 200, а `/auth/providers` през порт 80 връща 503,
  провери Core на 8123 и журнала му с `ha core logs`. При Restore от
  друга инсталация провери дали настройките на Core сочат към наличен
  TLS сертификат и дали протоколът и портът съвпадат с локалния upstream
  на gateway (`http://127.0.0.1:8123`).
- Ако HTTP работи, а Apps показва грешка, сравни списъка от
  `ha supervisor info` с Apps в STEVORA. В браузъра DevTools → Network → WS
  провери `/api/websocket` за отваряне на нова връзка, `auth_ok` и резултата
  от `supervisor/api` за `/addons`. Прегледай локално съобщенията с токени.
- За регресионен тест използвай изолирана VM с тестово копие на архива.
  След Restore отвори Apps, прекъсни мрежата на клиента и я възстанови.
  Провери повторното свързване и зареждането на списъка. Ако Supervisor
  временно върне грешка, последният зареден списък остава видим с
  обяснение. При успешен повторен опит се показва актуалният списък,
  включително ако е празен.
