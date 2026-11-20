# [STE-00] STEVORA OS 1.0.0-alpha.2 — Primary Frontend & Onboarding

STATUS: DEVELOPMENT / VM TEST ONLY. Не инсталирай в Dunav, не променяй официална HA OS.

## Приета предишна версия
Собственикът съобщава 12/12 успешни реални функционални теста за alpha.1 (Windows, iPhone, Android). Това не е проверка на rollback, мрежов отказ или Raspberry Pi хардуер.

## Ново в alpha.2
1. Собствен първоначален onboarding: откриване на помещения и устройства от текущия STEVORA manifest, Home Hub статус, BG/EN, начална страница и compact навигация.
2. Настройките се записват в Home Assistant private storage, разделени по текущия HA user ID. WebSocket API: stevora_os/preferences/get и stevora_os/preferences/update.
3. Въвеждането на настройките използва оптимистична ревизия за предотвратяване на тихо презаписване при едновременни редакции.
4. След рестарт личният начален екран и езикът се зареждат автоматично. Първият вход показва wizard; приключилите виждат предпочетената страница.
5. Opt-in fullscreen/focus на браузъри с requestFullscreen. При неподдържан браузър показва обяснение, не симулира успех.
6. Settings: лично меню за предпочитанията и повторно изпълнение на wizard.
7. Климатичният live update показва температура плюс HVAC статус, без ненужно презареждане на целия DOM.
8. Запазва alpha.1: Rooms, Devices, Lighting, Climate, Scenes, Automations (информационно), Assist, System Center, права и backlight exclusion.

## Ясни ограничения
- Оригиналният Home Assistant frontend остава за логин, поддръжка и аварийно възстановяване. Не е премахнат и не е patch-ван.
- Fullscreen не е native самостоятелна iOS/Android апликация. Няма публикуван отделен STEVORA PWA manifest, Service Worker, STEVORA app икони или push в тази версия.
- Automation editor, пълни onboarding на HA integratons, пълни административни настройки, Supervisor updates, backup/restore actions, мрежа и storage предстоят.
- Съществуващото HA удостоверяване и permissions са единствени. Няма HA/Supervisor tokens в browser storage. Данните от различни акаунти/домове не се смесват.
- Няма Raspberry Pi 4/5 ARM64 приемателни тестове.

## Инсталация върху независимата VM
Преди актуализация направи VM snapshot и архив на /config/custom_components/stevora_os.
Използвай само exact commit SHA с успешна GitHub Actions проверка. Копирай новите файлове manifest.json, __init__.py, system_api.py, preferences.py и frontend/stevora-os.js / stevora-os.css в отделен временен каталог под /config/custom_components.
Провери версията 1.0.0-alpha.2 в manifest.json, премести текущия каталог stevera_os в архив с timestamp, смени с новия, изпълни ha core check, после ha core restart.
Не променяй /config/custom_components/stevora (Universal Integration) и не добавяй втори YAML ключ stevora_os.
При неуспешна проверка възстанови каталог alpha.1 преди какъвто и да е рестарт.

## Приемателни критерии
- [ ] Home Assistant стартира; /stevora продължава да работи.
- [ ] При първия вход onboarding показва реалните помещения, устройства и Home Hub.
- [ ] BG/EN, предпочетена стартова страница и компактен режим се запазват след рестарт.
- [ ] Отделните потребители имат отделни preferences и нямат достъп до чужди настройки.
- [ ] Профил със стандартни права няма достъп до admin API и защитена системна информация.
- [ ] Превключване на HA user/server изчиства кешираните данни, prefs и chat history.
- [ ] Конфликт при двойна редакция на prefs не губи или презаписва данните.
- [ ] Fullscreen е реален, ако се поддържа; съобщава ограничението при iOS.
- [ ] Климатичните стойности се обновяват, запазвайки текущата температура.
- [ ] Lighting/RGB, scenes, climate, Assist, backlight exclusion работят без регресии.
- [ ] UI работи на Chrome Windows, iPhone Safari, Android и PWA shortcut по съществуващия URL.
- [ ] Потвърден rollback до alpha.1 чрез запазения каталог и HA snapshot.

## Възстановяване
Използвай действителния път на архивирания каталог. Спри Home Assistant при тежка грешка и възстанови VM snapshot; при работещ терминал върни архива в /config/custom_components/stevora_os, изпълни ha core check и ha core restart. Alpha.1 не чете новия файл в .storage със STEVORA OS preferences.

Няма официален Stable Release и няма deployment на Dunav.