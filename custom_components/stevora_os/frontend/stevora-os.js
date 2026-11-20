/* STEVORA OS 1.0.0-alpha.3 branded PWA + integration inventory
 * Read-only shell backed by the existing permission-scoped STEVORA manifest.
 * No direct device control, no privileges, no external dependencies/CDNs.
 */
(() => {
  "use strict";

  const COPY = {
    bg: {
      home: "Начало", rooms: "Помещения", system: "Система", about: "За STEVORA",
      eyebrow: "STEVORA OS · DEVELOPER PREVIEW", welcome: "Твоят дом. Твоята система.",
      intro: "Новият облик на STEVORA, изграден върху официалната Home Assistant OS.",
      environment: "Тестова среда", preview: "Предварителна версия · само за тестове",
      discovered: "Открити помещения", devices: "Устройства", available: "Налични",
      hub: "Home Hub", missing: "Не е активен", unavailable: "Няма данни",
      yourRooms: "Твоите помещения", noRooms: "Няма достъпни помещения в манифеста.",
      connections: "Свързани системи", server: "Home Assistant backend",
      integration: "Universal Integration", oslayer: "STEVORA OS интерфейс",
      loaded: "Зареден", unavailableStatus: "Недостъпен", refresh: "Обнови",
      homepanel: "Отвори Home Panel", haSettings: "Администриране в HA",
      settingsNote: "Официалният HA интерфейс остава достъпен за администриране и възстановяване.",
      readOnly: "Този системен екран е само информативен. Обновления и архиви не се изпълняват от STEVORA OS 0.1.",
      version: "Версия", access: "Достъп", administrator: "Администратор",
      user: "Потребител", backend: "Системна основа", aboutTitle: "STEVORA OS Experience",
      aboutText: "Самостоятелна визуална среда върху официална Home Assistant OS. Не променя системния образ, входа, системните актуализации или оригиналния Home Assistant.",
      required: "За синхронизация е необходима активна STEVORA Universal Integration.",
      loading: "Зареждане на данни от дома…", error: "Проблем при зареждане",
      noDeviceControls: "В тази версия няма управление на устройства.",
      lang: "Език", state: "Състояние", local: "Локална система",
      emptyHub: "Не е наличен", online: "Активен", inactive: "Неактивен",
      backToHome: "Към началото", homeLink: "STEVORA Home Panel",
      systemCenter: "STEVORA System Center", officialUpdates: "Официални актуализации",
      managedByHA: "Управлява се от Home Assistant", confirmed: "потвърдени", unknownCount: "неизвестни",
      checkStatus: "Провери системата", adminOnly: "Подробната диагностика е достъпна само за администратори.",
      waitingStatus: "Зареждане на системната диагностика…", noSystemStatus: "Системната диагностика не е налична.",
      haCore: "Home Assistant Core", haState: "Състояние на Core", entityCount: "HA entities",
      updateNotDetected: "Не е открито", updateUnknown: "Неизвестно", updateAvailable: "Налична актуализация",
      updateCurrent: "Няма налична актуализация", currentVersion: "Инсталирана", newVersion: "Предлагана",
      componentCore: "Core", componentOS: "Операционна система", componentSupervisor: "Supervisor",
      systemReadOnly: "Информацията е само за преглед. Обновленията, архивите и рестартирането остават в официалния Home Assistant.",
      devicesTitle: "Устройства",
      lighting: "Осветление",
      climate: "Климат",
      scenes: "Сцени",
      automation: "Автоматизации",
      assist: "Assist",
      setup: "Настройки",
      roomAll: "Всички помещения",
      search: "Търси устройство…",
      noDevices: "Няма устройства за показване",
      noScenes: "Home Hub не е активен или няма сцени",
      noAutomations: "Няма налични автоматизации",
      unavailableDevice: "Недостъпно",
      readonly: "Само информация",
      on: "Включено",
      off: "Изключено",
      turnOn: "Включи",
      turnOff: "Изключи",
      plus: "Увеличи с 1°",
      minus: "Намали с 1°",
      open: "Отвори",
      close: "Затвори",
      activate: "Активирай",
      details: "Подробности",
      currentTemp: "Текуща",
      targetTemp: "Зададена",
      brightness: "Яркост",
      speed: "Скорост",
      color: "Цвят",
      room: "Помещение",
      hubEvents: "Събития на Home Hub",
      noEvents: "Няма събития",
      assistTitle: "Home Assistant Assist",
      assistNote: "Използва се стандартният Home Assistant Assist. Hey Stevora е отделен модул.",
      assistPrompt: "Напиши команда или въпрос…",
      send: "Изпрати",
      msgFailed: "Асистентът не отговори.",
      settingsTitle: "Настройки на STEVORA",
      editRooms: "Преводи на помещения",
      translationsHint: "Промените се запазват в Universal Integration и са само за този дом.",
      save: "Запази",
      saved: "Запазено",
      needsAdmin: "Само за администратори.",
      adminConfigMissing: "Няма настройки на Universal Integration.",
      serviceError: "Операцията не успя. Проверете разрешенията или устройството.",
      operationDone: "Командата е изпратена",
      modulesTitle: "STEVORA модули",
      moduleMissing: "Не е включен",
      recovery: "Аварийни HA настройки",
      onboarding: "Първоначална конфигурация",
      onboardingInfo: "Universal Integration трябва да бъде инсталирана. STEVORA използва оригиналната HA автентикация.",
      integrationSettings: "Настройки на интеграциите",
      noControls: "Няма разрешени управления",
      onboardTitle: "Първоначална настройка на STEVORA",
      onboardSub: "Твоята STEVORA среда, персонализирана за този HA акаунт.",
      onboardStep1: "1 · Свързана система",
      onboardStep2: "2 · Изглед и език",
      onboardStep3: "3 · Завършване",
      onboardConnected: "Свързано към този Home Assistant сървър",
      onboardConnectedNote: "Използва се твоят текущ HA вход. Не създаваме отделна парола за STEVORA.",
      onboardManifestReady: "Стаите и устройствата се откриват автоматично през Universal Integration.",
      onboardManifestMissing: "Universal Integration още не предоставя манифест. Завърши нейната настройка в HA.",
      preferredHome: "Начален екран",
      compactNav: "Компактна навигация",
      enterFullscreen: "Цял екран",
      exitFullscreen: "Изход от цял екран",
      fullscreenUnavailable: "Този браузър не позволява режим „Цял екран“. На iPhone използвай Add to Home Screen за по-самостоятелен изглед.",
      chooseStart: "Избери началния екран",
      savePreferences: "Запази предпочитанията",
      finishOnboarding: "Завърши началната настройка",
      onboardingDone: "Първоначалната настройка е завършена",
      reopenWizard: "Повтори настройката",
      preferencesUnavailable: "Не могат да се заредят персоналните настройки.",
      preferencesSaveFailed: "Неуспешно запазване на потребителските настройки. Опитай отново.",
      savedPreferences: "Предпочитанията са запазени",
      viewMode: "Режим на изгледа",
      installationInfo: "Инсталиране на телефона",
      installationHelp: "Отвори /stevora-os в Safari/Chrome и използвай „Добави към начален екран“ или „Инсталирай приложение“, ако браузърът предлага опцията. Оригиналният HA интерфейс остава за администриране.",
      setupOptional: "Настройката на изгледа не променя устройството или системата.",
      primaryFrontend: "Основна STEVORA среда",
      accountSettings: "Лични настройки",
      recoveryLink: "Аварийно администриране в HA",
      setupUnavailable: "Без достъп до настройките, продължи да използваш системата в стандартен режим.",
      roomCount: "Помещения",
      deviceCount: "Устройства",
      complete: "Завършено",
      notComplete: "Не е завършено",
      integrations: "Интеграции",
      integrationsTitle: "Интеграции в STEVORA",
      integrationsNote: "Данни за инсталираните интеграции от Home Assistant. Само преглед; конфигурирането остава в официалния HA интерфейс.",
      integrationsLoaded: "Заредени",
      integrationsIssues: "Други състояния",
      integrationsTotal: "Общо",
      integrationsSearch: "Търси интеграция…",
      integrationsNotReady: "Неуспешно зареждане на интеграциите.",
      integrationsNoItems: "Няма интеграции за показване.",
      integrationsAdmin: "Тази системна справка изисква администраторски права.",
      integrationsRefresh: "Обнови списъка",
      integrationsOfficial: "Отвори HA интеграции",
      integrationsTruncated: "Показани са първите 400 интеграции от пълния списък.",
      integrationsDisabled: "Изключена",
      integrationsReadOnly: "За конфигуриране и премахване използвай официалния Home Assistant.",
      pwaHelp: "STEVORA може да се добави към началния екран. Инсталацията на PWA зависи от браузъра и HTTPS достъпа.",
      pwaSecure: "За надеждна инсталация на Android/desktop използвай HTTPS. STEVORA не кешира токени и данни офлайн.",
      systemOpen: "Отвори HA настройки", systemUnavailable: "Неизвестно / няма данни",
      integrationReady: "Конфигурирана", systemRefreshError: "Неуспешно зареждане на системните данни.",
    },
    en: {
      home: "Home", rooms: "Rooms", system: "System", about: "About",
      eyebrow: "STEVORA OS · DEVELOPER PREVIEW", welcome: "Your home. Your system.",
      intro: "A new STEVORA experience, built on the official Home Assistant OS.",
      environment: "Development environment", preview: "Preview build · testing only",
      discovered: "Discovered rooms", devices: "Devices", available: "Available",
      hub: "Home Hub", missing: "Not active", unavailable: "No data",
      yourRooms: "Your rooms", noRooms: "No accessible rooms in the manifest.",
      connections: "Connected systems", server: "Home Assistant backend",
      integration: "Universal Integration", oslayer: "STEVORA OS interface",
      loaded: "Loaded", unavailableStatus: "Unavailable", refresh: "Refresh",
      homepanel: "Open Home Panel", haSettings: "Manage in HA",
      settingsNote: "The official HA interface remains available for administration and recovery.",
      readOnly: "This system screen is informational only. Updates and backups cannot be executed from STEVORA OS 0.1.",
      version: "Version", access: "Access", administrator: "Administrator",
      user: "User", backend: "System foundation", aboutTitle: "STEVORA OS Experience",
      aboutText: "An independent visual experience over official Home Assistant OS. It does not alter the system image, login, system updates, or original Home Assistant.",
      required: "An active STEVORA Universal Integration is required for synchronization.",
      loading: "Loading home data…", error: "Unable to load",
      noDeviceControls: "Device controls are not included in this preview.",
      lang: "Language", state: "Status", local: "Local system",
      emptyHub: "Not available", online: "Active", inactive: "Inactive",
      backToHome: "Back home", homeLink: "STEVORA Home Panel",
      systemCenter: "STEVORA System Center", officialUpdates: "Official updates",
      managedByHA: "Managed by Home Assistant", confirmed: "confirmed", unknownCount: "unknown",
      checkStatus: "Check system", adminOnly: "Detailed system diagnostics are available to administrators only.",
      waitingStatus: "Loading system diagnostics…", noSystemStatus: "System diagnostics unavailable.",
      haCore: "Home Assistant Core", haState: "Core state", entityCount: "HA entities",
      updateNotDetected: "Not detected", updateUnknown: "Unknown", updateAvailable: "Update available",
      updateCurrent: "No update available", currentVersion: "Installed", newVersion: "Offered",
      componentCore: "Core", componentOS: "Operating system", componentSupervisor: "Supervisor",
      systemReadOnly: "Read-only information. Updates, backups and restarts remain in the official Home Assistant interface.",
      devicesTitle: "Devices",
      lighting: "Lighting",
      climate: "Climate",
      scenes: "Scenes",
      automation: "Automations",
      assist: "Assist",
      setup: "Settings",
      roomAll: "All rooms",
      search: "Search devices…",
      noDevices: "No devices to display",
      noScenes: "Home Hub inactive or no scenes",
      noAutomations: "No automations available",
      unavailableDevice: "Unavailable",
      readonly: "Information only",
      on: "On",
      off: "Off",
      turnOn: "Turn on",
      turnOff: "Turn off",
      plus: "Increase 1°",
      minus: "Decrease 1°",
      open: "Open",
      close: "Close",
      activate: "Activate",
      details: "Details",
      currentTemp: "Current",
      targetTemp: "Target",
      brightness: "Brightness",
      speed: "Speed",
      color: "Color",
      room: "Room",
      hubEvents: "Home Hub events",
      noEvents: "No events",
      assistTitle: "Home Assistant Assist",
      assistNote: "Uses built-in Home Assistant Assist. Hey Stevora is a separate module.",
      assistPrompt: "Enter a command or question…",
      send: "Send",
      msgFailed: "Assistant did not respond.",
      settingsTitle: "STEVORA Settings",
      editRooms: "Room translations",
      translationsHint: "Saved to Universal Integration for this home only.",
      save: "Save",
      saved: "Saved",
      needsAdmin: "Administrators only.",
      adminConfigMissing: "Universal Integration settings unavailable.",
      serviceError: "Operation failed. Check permissions or device state.",
      operationDone: "Command sent",
      modulesTitle: "STEVORA modules",
      moduleMissing: "Not included",
      recovery: "Emergency HA settings",
      onboarding: "First-run setup",
      onboardingInfo: "Universal Integration must be installed. STEVORA uses native HA authentication.",
      integrationSettings: "Integration settings",
      noControls: "No authorized controls",
      onboardTitle: "Welcome to STEVORA",
      onboardSub: "Your STEVORA experience, customized for this HA account.",
      onboardStep1: "1 · Connected home",
      onboardStep2: "2 · Appearance and language",
      onboardStep3: "3 · Finish",
      onboardConnected: "Connected to this Home Assistant server",
      onboardConnectedNote: "Uses your existing HA login. STEVORA does not create another password.",
      onboardManifestReady: "Rooms and devices are discovered automatically through Universal Integration.",
      onboardManifestMissing: "Universal Integration has not provided a manifest. Complete its setup in HA.",
      preferredHome: "Start page",
      compactNav: "Compact navigation",
      enterFullscreen: "Full screen",
      exitFullscreen: "Exit full screen",
      fullscreenUnavailable: "Full screen is not supported by this browser. On iPhone, use Add to Home Screen for a more standalone view.",
      chooseStart: "Select start page",
      savePreferences: "Save preferences",
      finishOnboarding: "Complete setup",
      onboardingDone: "First-run setup completed",
      reopenWizard: "Run setup again",
      preferencesUnavailable: "Could not load personal preferences.",
      preferencesSaveFailed: "Could not save user preferences. Try again.",
      savedPreferences: "Preferences saved",
      viewMode: "View mode",
      installationInfo: "Install on your phone",
      installationHelp: "Open /stevora-os in Safari/Chrome and use Add to Home Screen or Install App if available. The original HA interface remains available for administration.",
      setupOptional: "View preferences do not change devices or system settings.",
      primaryFrontend: "Primary STEVORA experience",
      accountSettings: "Personal settings",
      recoveryLink: "Emergency HA administration",
      setupUnavailable: "If preferences are unavailable, continue with the default layout.",
      roomCount: "Rooms",
      deviceCount: "Devices",
      complete: "Completed",
      notComplete: "Not completed",
      integrations: "Integrations",
      integrationsTitle: "STEVORA integrations",
      integrationsNote: "Installed integrations from Home Assistant. Read-only; configuration still uses the official HA interface.",
      integrationsLoaded: "Loaded",
      integrationsIssues: "Other states",
      integrationsTotal: "Total",
      integrationsSearch: "Search integrations…",
      integrationsNotReady: "Could not load integrations.",
      integrationsNoItems: "No integrations to show.",
      integrationsAdmin: "This system inventory requires administrator access.",
      integrationsRefresh: "Refresh integrations",
      integrationsOfficial: "Open HA integrations",
      integrationsTruncated: "Showing the first 400 integrations from the full inventory.",
      integrationsDisabled: "Disabled",
      integrationsReadOnly: "Use official Home Assistant to configure or remove integrations.",
      pwaHelp: "STEVORA can be added to the home screen. PWA installation depends on browser capabilities and HTTPS access.",
      pwaSecure: "Use HTTPS for reliable Android/desktop installation. STEVORA does not cache tokens or home data offline.",
      systemOpen: "Open HA settings", systemUnavailable: "Unknown / no data",
      integrationReady: "Configured", systemRefreshError: "Unable to load system diagnostics.",
    }
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]
  );

  class StevoraOSPreview extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._connection = null;
      this._user = null;
      this._manifest = null;
      this._language = "bg";
      this._view = "home";
      this._busy = false;
      this._error = "";
      this._status = "idle";
      this._system = null;
      this._model = null;
      this._hubDirectory = null;
      this._hubEvents = null;
      this._admin = null;
      this._chat = [];
      this._chatBusy = false;
      this._conversationId = null;
      this._selectedRoom = "";
      this._busyEntities = new Set();
      this._systemBusy = false;
      this._systemError = "";
      this._systemRequest = 0;
      this._request = 0;
      this._connected = false;
      this._preferences = null;
      this._prefsError = "";
      this._prefsBusy = false;
      this._prefsRequest = 0;
      this._integrations = null;
      this._integrationsBusy = false;
      this._integrationsError = "";
      this._integrationsRequest = 0;
      this._brandNodes = [];
      this._brandTitle = null;
      this._visitedView = false;
      this._fullscreenChange = () => this._patchFullscreen();
      this.shadowRoot.addEventListener("click", (event) => this._onClick(event));
      this.shadowRoot.addEventListener("change", (event) => this._onChange(event));
      this.shadowRoot.addEventListener("input", (event) => this._onInput(event));
      this.shadowRoot.addEventListener("submit", (event) => { event.preventDefault(); void this._onSubmit(event); });
    }

    set hass(value) {
      if (!value) return;
      const connection = value.connection || null;
      const user = value.user?.id || null;
      const changed = this._hass && (connection !== this._connection || user !== this._user);
      this._hass = value;
      if (changed) {
        // Critical security rule: never show another user's or home's manifest.
        this._request += 1;
        this._busy = false;
        this._connection = connection;
        this._user = user;
        this._manifest = null;
        this._systemRequest += 1;
        this._system = null;
        this._model = null;
        this._hubDirectory = null;
        this._hubEvents = null;
        this._admin = null;
        this._chat = [];
        this._conversationId = null;
        this._selectedRoom = "";
        this._visitedView = false;
        this._prefsRequest += 1;
        this._integrationsRequest += 1;
        this._integrations = null;
        this._integrationsBusy = false;
        this._integrationsError = "";
        this._preferences = null;
        this._prefsBusy = false;
        this._prefsError = "";
        this._busyEntities.clear();
        this._systemBusy = false;
        this._systemError = "";
        this._error = "";
        this._status = "loading";
        this._view = "home";
        this.render();
        void this.refresh();
        void this._loadPreferences();
      } else if (!this._connection) {
        this._connection = connection;
        this._user = user;
        if (this._connected) {
          void this.refresh();
          void this._loadPreferences();
        }
      } else {
        // State ticks only patch text nodes; preserve focus/navigation.
        this._patchLive();
      }
    }

    get hass() { return this._hass; }

    connectedCallback() {
      this._connected = true;
      this._mountBrandMetadata();
      if (typeof document !== "undefined")
        document.addEventListener("fullscreenchange", this._fullscreenChange);
      this.render();
      if (this._hass && !this._preferences && !this._prefsBusy)
        void this._loadPreferences();
      if (this._hass && !this._manifest && !this._busy) void this.refresh();
    }

    disconnectedCallback() {
      this._connected = false;
      this._unmountBrandMetadata();
      this._integrationsRequest += 1;
      this._integrations = null;
      this._integrationsBusy = false;
      this._integrationsError = "";
      if (typeof document !== "undefined")
        document.removeEventListener("fullscreenchange", this._fullscreenChange);
      this._request += 1;
      this._prefsRequest += 1;
      this._systemRequest += 1;
      this._busy = false;
      this._systemBusy = false;
      this._manifest = null;
      this._system = null;
      this._model = null;
      this._hubDirectory = null;
      this._hubEvents = null;
      this._admin = null;
      this._chat = [];
      this._conversationId = null;
      this._preferences = null;
      this._prefsBusy = false;
      this._prefsError = "";
    }

    _mountBrandMetadata() {
      // Use the STEVORA web manifest only while the STEVORA panel is mounted.
      // Do not rewrite or remove Home Assistant's own manifest/icon metadata.
      if (typeof document === "undefined" || !document.head ||
          typeof document.createElement !== "function" || this._brandNodes.length) return;
      const entries = [
        ["link", {rel:"manifest",href:"/stevora_os_static/manifest.webmanifest?v=1.0.0-alpha.3"}],
        ["link", {rel:"apple-touch-icon",sizes:"192x192",
          href:"/stevora_os_static/icons/stevora-192.png"}],
        ["link", {rel:"icon",type:"image/png",sizes:"192x192",
          href:"/stevora_os_static/icons/stevora-192.png"}],
        ["meta", {name:"apple-mobile-web-app-capable",content:"yes"}],
        ["meta", {name:"apple-mobile-web-app-title",content:"STEVORA"}],
        ["meta", {name:"theme-color",content:"#06152a"}],
      ];
      // Prepend in reverse order so our manifest is the first rel=manifest.
      for (const [tag,attrs] of entries.slice().reverse()) {
        const node=document.createElement(tag);
        for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
        node.setAttribute("data-stevora-os-brand","1");
        document.head.prepend(node);
        this._brandNodes.push(node);
      }
      this._brandTitle=document.title;
      document.title="STEVORA OS";
    }

    _unmountBrandMetadata() {
      if (typeof document === "undefined") return;
      for (const node of this._brandNodes) {
        if (typeof node.remove === "function") node.remove();
      }
      this._brandNodes=[];
      if (this._brandTitle !== null && document.title === "STEVORA OS")
        document.title=this._brandTitle;
      this._brandTitle=null;
    }

    async _refreshIntegrations() {
      if (!this._hass?.user?.is_admin || !this._hass?.callWS) return;
      const token=++this._integrationsRequest;
      const connection=this._hass.connection, user=this._hass.user?.id;
      this._integrationsBusy=true;
      this._integrationsError="";
      try {
        const result=await this._hass.callWS({type:"stevora_os/system/integrations"});
        if (token!==this._integrationsRequest || connection!==this._hass?.connection ||
            user!==this._hass?.user?.id || !this._hass?.user?.is_admin) return;
        if (!result || result.schema_version!=="1" || !Array.isArray(result.entries))
          throw new Error("Invalid integration inventory");
        this._integrations=result;
      } catch (_) {
        if (token!==this._integrationsRequest || connection!==this._hass?.connection ||
            user!==this._hass?.user?.id) return;
        this._integrationsError=COPY[this._language].integrationsNotReady;
      } finally {
        if(token===this._integrationsRequest) {
          this._integrationsBusy=false;
          this.render();
        }
      }
    }

    async _loadPreferences() {
      if (!this._hass?.callWS) return;
      const token = ++this._prefsRequest;
      const connection = this._hass.connection, user = this._hass.user?.id;
      this._prefsBusy = true;
      this._prefsError = "";
      try {
        const result = await this._hass.callWS({type:"stevora_os/preferences/get"});
        if (token !== this._prefsRequest || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        if (!result || result.schema_version !== "1" || !result.preferences ||
            !Number.isInteger(result.revision) || result.revision < 0)
          throw new Error("Bad preference response");
        const pref = result.preferences;
        if (!["bg","en"].includes(pref.language) ||
            !["home","rooms","devices","lighting","climate","scenes","automation",
              "assist","system","setup","integrations","about"].includes(pref.default_view))
          throw new Error("Unsupported preferences");
        this._preferences = result;
        const relocalize = this._language !== pref.language;
        this._language = pref.language;
        if (!this._visitedView && this._view === "home") {
          this._view = pref.onboarding_complete ? pref.default_view : "onboarding";
        }
        this.render();
        if (relocalize) void this.refresh();
      } catch (_) {
        if (token !== this._prefsRequest || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        this._prefsError = COPY[this._language].preferencesUnavailable;
        this.render();
      } finally {
        if (token === this._prefsRequest) this._prefsBusy = false;
      }
    }

    async _updatePreferences(changes) {
      if (!this._hass?.callWS || !this._preferences || this._prefsBusy) return false;
      const token = ++this._prefsRequest;
      const connection = this._hass.connection, user = this._hass.user?.id;
      this._prefsBusy = true;
      try {
        const result = await this._hass.callWS({
          type:"stevora_os/preferences/update",
          expected_revision:this._preferences.revision,
          ...changes
        });
        if (token !== this._prefsRequest || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return false;
        if (!result || result.schema_version !== "1" || !result.preferences)
          throw new Error("Unexpected preference update");
        this._preferences = result;
        this._prefsError = "";
        return true;
      } catch (_) {
        if (token === this._prefsRequest && connection === this._hass?.connection &&
            user === this._hass?.user?.id)
          this._prefsError = COPY[this._language].preferencesSaveFailed;
        return false;
      } finally {
        if (token === this._prefsRequest) {
          this._prefsBusy = false;
          this.render();
        }
      }
    }

    _patchFullscreen() {
      const button = this.shadowRoot?.querySelector?.("[data-fullscreen]");
      if (button && typeof document !== "undefined")
        button.textContent = document.fullscreenElement === this
          ? COPY[this._language].exitFullscreen
          : COPY[this._language].enterFullscreen;
    }

    _toggleFullscreen() {
      if (typeof document === "undefined") return;
      if (document.fullscreenElement === this) {
        if (document.exitFullscreen) void document.exitFullscreen();
      } else if (typeof this.requestFullscreen === "function") {
        const action = this.requestFullscreen();
        if (action?.catch) action.catch(() => {
          this._actionNotice = COPY[this._language].fullscreenUnavailable;
          this.render();
        });
      } else {
        this._actionNotice = COPY[this._language].fullscreenUnavailable;
        this.render();
      }
    }

    async refresh() {
      if (!this._hass || !this._hass.callWS) return;
      const token = ++this._request;
      const connection = this._hass.connection;
      const user = this._hass.user?.id;
      const lang = this._language;
      this._busy = true;
      this._status = "loading";
      this._error = "";
      this.render();
      try {
        const result = await this._hass.callWS({ type: "stevora/manifest", language: lang });
        if (token !== this._request || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        if (!result || !Array.isArray(result.rooms) || !Array.isArray(result.entities))
          throw new Error("Invalid STEVORA manifest");
        const model = await this._hass.callWS({ type: "stevora/panel/generate", language: lang });
        if (token !== this._request || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        if (!model || model.installation_id !== result.installation_id ||
            model.revision !== result.revision || !Array.isArray(model.sections))
          throw new Error("Panel model/manifest mismatch");
        this._manifest = result;
        this._model = model;
        this._status = "ready";
        this._hubDirectory = null;
        this._hubEvents = null;
        const optional = [
          this._hass.callWS({type:"stevora/hub/scenes"}),
          this._hass.callWS({type:"stevora/hub/events",limit:25}),
          this._hass.user?.is_admin ? this._hass.callWS({type:"stevora/admin/rooms/get"}) : Promise.resolve(null)
        ];
        const results = await Promise.allSettled(optional);
        if (token !== this._request || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        if (results[0].status === "fulfilled" && results[0].value?.installation_id === result.installation_id)
          this._hubDirectory = results[0].value;
        if (results[1].status === "fulfilled" && results[1].value?.installation_id === result.installation_id)
          this._hubEvents = results[1].value;
        if (results[2].status === "fulfilled" && this._hass.user?.is_admin)
          this._admin = results[2].value;
        if (this._hass.user?.is_admin) void this._refreshSystem();
      } catch (_error) {
        if (token !== this._request || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        this._manifest = null;
        this._status = "error";
        this._error = COPY[lang].required;
      } finally {
        if (token === this._request) {
          this._busy = false;
          this.render();
        }
      }
    }

    async _refreshSystem() {
      if (!this._hass?.user?.is_admin || !this._hass.callWS) return;
      const token = ++this._systemRequest;
      const connection = this._hass.connection;
      const user = this._hass.user?.id;
      this._systemBusy = true;
      this._systemError = "";
      // Keep previously validated status visible during manual refresh.
      this.render();
      try {
        const result = await this._hass.callWS({ type: "stevora_os/system/status" });
        if (token !== this._systemRequest || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id || !this._hass?.user?.is_admin) return;
        if (!result || result.schema_version !== "1" || result.preview_version !== "1.0.0-alpha.3")
          throw new Error("Unsupported system snapshot schema");
        this._system = result;
      } catch (_error) {
        if (token !== this._systemRequest || connection !== this._hass?.connection ||
            user !== this._hass?.user?.id) return;
        this._systemError = COPY[this._language].systemRefreshError;
      } finally {
        if (token === this._systemRequest) {
          this._systemBusy = false;
          this.render();
        }
      }
    }

    _counts() {
      const entities = this._manifest?.entities || [];
      const states = this._hass?.states || {};
      const available = entities.filter((ent) => {
        const state = states[ent.entity_id]?.state;
        return state !== undefined && !["unavailable", "unknown"].includes(state);
      }).length;
      return { rooms: (this._manifest?.rooms || []).length, devices: entities.length, available };
    }

    _onClick(event) {
      const target = event.target?.closest?.(
        "[data-view], [data-refresh], [data-system-refresh], [data-integrations-refresh], [data-room], [data-device-action], [data-scene-run], [data-fullscreen], [data-onboarding]"
      );
      if (!target) return;
      if (target.hasAttribute("data-refresh")) { void this.refresh(); return; }
      if (target.hasAttribute("data-fullscreen")) { this._toggleFullscreen(); return; }
      if (target.hasAttribute("data-onboarding")) {
        this._visitedView = true;
        this._view = "onboarding";
        this.render();
        return;
      }
      if (target.hasAttribute("data-system-refresh")) { void this._refreshSystem(); return; }
      if (target.hasAttribute("data-integrations-refresh")) { void this._refreshIntegrations(); return; }
      if (target.hasAttribute("data-room")) {
        const room = target.getAttribute("data-room");
        if (!(this._manifest?.rooms || []).some((r) => r.id === room)) return;
        this._selectedRoom = room;
        this._view = "devices";
        this.render();
        return;
      }
      if (target.hasAttribute("data-device-action")) {
        void this._deviceAction(target.getAttribute("data-entity"), target.getAttribute("data-device-action"));
        return;
      }
      if (target.hasAttribute("data-scene-run")) {
        void this._runScene(target.getAttribute("data-scene-run"));
        return;
      }
      const view = target.getAttribute("data-view");
      if (!["home", "rooms", "devices", "lighting", "climate", "scenes",
            "automation", "assist", "system", "setup", "integrations", "about"].includes(view)) return;
      this._visitedView = true;
      this._view = view;
      if (view !== "devices") this._selectedRoom = "";
      this.render();
      if (view === "system" && this._hass?.user?.is_admin && !this._system && !this._systemBusy)
        void this._refreshSystem();
      if (view === "integrations" && this._hass?.user?.is_admin &&
          !this._integrations && !this._integrationsBusy)
        void this._refreshIntegrations();
    }

    _onChange(event) {
      const input = event.target;
      if (input?.id === "stevora-os-language") {
        const lang = input.value;
        if (!["bg", "en"].includes(lang) || lang === this._language) return;
        this._language = lang;
        if (this._preferences) void this._updatePreferences({language: lang});
        this._model = null;
        this._manifest = null;
        this._hubDirectory = null;
        this._hubEvents = null;
        this._admin = null;
        void this.refresh();
        return;
      }
      if (input?.hasAttribute("data-room-select")) {
        const room = input.value;
        if (room && !(this._manifest?.rooms || []).some((r) => r.id === room)) return;
        this._selectedRoom = room;
        this.render();
        return;
      }
      if (input?.hasAttribute("data-device-input")) {
        void this._deviceInput(input);
      }
    }

    _onInput(event) {
      const input = event.target;
      if (input?.hasAttribute("data-integrations-search")) {
        const needle=String(input.value||"").trim().toLowerCase();
        this.shadowRoot?.querySelectorAll?.("[data-integration-row]")?.forEach((row)=>{
          row.hidden=!String(row.getAttribute("data-search")||"").includes(needle);
        });
        return;
      }
      if (!input?.hasAttribute("data-device-search")) return;
      const needle = String(input.value || "").trim().toLowerCase();
      this.shadowRoot?.querySelectorAll?.("[data-device-card]")?.forEach((card) => {
        card.hidden = !String(card.getAttribute("data-search") || "").includes(needle);
      });
    }

    async _onSubmit(event) {
      const form = event.target;
      if (form?.hasAttribute("data-onboarding-form")) {
        await this._saveOnboarding(form);
      } else if (form?.hasAttribute("data-personal-form")) {
        await this._savePersonalSettings(form);
      } else if (form?.hasAttribute("data-translate-form")) {
        await this._saveTranslation(form);
      } else if (form?.hasAttribute("data-assist-form")) {
        await this._sendAssist(form);
      }
    }

    async _saveOnboarding(form) {
      const lang = form?.querySelector?.('select[name="language"]')?.value;
      const page = form?.querySelector?.('select[name="default_view"]')?.value;
      const compact = Boolean(form?.querySelector?.('input[name="compact_nav"]')?.checked);
      if (!["bg","en"].includes(lang) ||
          !["home","rooms","devices","lighting","climate","scenes","automation",
            "assist","system","setup","integrations","about"].includes(page)) return;
      const saved = await this._updatePreferences({
        language:lang, default_view:page, compact_nav:compact, onboarding_complete:true
      });
      if (!saved) return;
      this._language = lang;
      this._visitedView = false;
      this._view = page;
      this._actionNotice = COPY[lang].onboardingDone;
      this._model = null;
      this._manifest = null;
      void this.refresh();
    }

    async _savePersonalSettings(form) {
      const lang = form?.querySelector?.('select[name="language"]')?.value;
      const page = form?.querySelector?.('select[name="default_view"]')?.value;
      const compact = Boolean(form?.querySelector?.('input[name="compact_nav"]')?.checked);
      if (!["bg","en"].includes(lang) ||
          !["home","rooms","devices","lighting","climate","scenes","automation",
            "assist","system","setup","integrations","about"].includes(page)) return;
      const saved = await this._updatePreferences({
        language:lang, default_view:page, compact_nav:compact
      });
      if (!saved) return;
      this._actionNotice = COPY[lang].savedPreferences;
      if (lang !== this._language) {
        this._language = lang;
        this._manifest = null;
        this._model = null;
        void this.refresh();
      } else this.render();
    }

    _findCard(entityId) {
      return this._cards("all").find((card) => card.entity_id === entityId) || null;
    }

    async _runService(entityId, domain, service, data) {
      const key = String(entityId);
      if (this._busyEntities.has(key) || !this._hass?.callService) return;
      const connection = this._hass.connection, user = this._hass.user?.id;
      this._busyEntities.add(key);
      try {
        await this._hass.callService(domain, service, {entity_id: entityId, ...data});
        if (connection !== this._hass?.connection || user !== this._hass?.user?.id) return;
        this._actionNotice = "";
      } catch (_) {
        if (connection !== this._hass?.connection || user !== this._hass?.user?.id) return;
        this._actionNotice = COPY[this._language].serviceError;
      } finally {
        this._busyEntities.delete(key);
        this.render();
      }
    }

    async _deviceAction(entityId, action) {
      const card = this._findCard(entityId);
      if (!card || this._backlight(entityId)) return;
      const domain = card.domain;
      if (action === "details") {
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId }, bubbles: true, composed: true,
        }));
        return;
      }
      if (!this._state(entityId) || ["unavailable","unknown"].includes(this._state(entityId).state)) return;
      if (action === "toggle" && this._can(card,"toggle") && ["light","switch","fan"].includes(domain))
        return void this._runService(entityId,domain,"toggle",{});
      if (["temp-up","temp-down"].includes(action) && domain === "climate" && this._can(card,"temperature")) {
        const state = this._state(entityId), temp = Number(state?.attributes?.temperature);
        if (!Number.isFinite(temp) || temp <= 0) return;
        const min = Number(state.attributes.min_temp), max = Number(state.attributes.max_temp);
        const lower = Number.isFinite(min) ? min : 5, upper = Number.isFinite(max) ? max : 35;
        const target = temp + (action === "temp-up" ? 1 : -1);
        if (target < lower || target > upper) return;
        return void this._runService(entityId,"climate","set_temperature",{temperature:target});
      }
      if (action === "open" && domain === "cover" && this._can(card,"open"))
        return void this._runService(entityId,"cover","open_cover",{});
      if (action === "close" && domain === "cover" && this._can(card,"close"))
        return void this._runService(entityId,"cover","close_cover",{});
      if (action === "play_pause" && domain === "media_player" && this._can(card,"play_pause"))
        return void this._runService(entityId,"media_player","media_play_pause",{});
    }

    async _deviceInput(input) {
      const entityId = input?.getAttribute("data-entity");
      const control = input?.getAttribute("data-device-input");
      const card = this._findCard(entityId);
      if (!this._can(card, control)) return;
      if (!this._state(entityId) || ["unavailable","unknown"].includes(this._state(entityId).state)) return;
      if (control === "brightness" && card.domain === "light") {
        const value = Number(input.value);
        if (Number.isInteger(value) && value>=1 && value<=100)
          await this._runService(entityId,"light","turn_on",{brightness_pct:value});
      } else if (control === "color" && card.domain === "light") {
        const color = String(input.value || "");
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
        const rgb = [1,3,5].map((n)=>parseInt(color.substring(n,n+2),16));
        await this._runService(entityId,"light","turn_on",{rgb_color:rgb});
      } else if (control === "percentage" && card.domain === "fan") {
        const value = Number(input.value);
        if (Number.isInteger(value) && value>=0 && value<=100)
          await this._runService(entityId,"fan","set_percentage",{percentage:value});
      }
    }

    async _runScene(id) {
      const item = (this._hubDirectory?.items || []).find((value)=>value.entity_id === id);
      if (!item || item.domain !== "scene" || item.action_allowed !== true || this._backlight(id)) return;
      if (!/^scene\.[a-z0-9_]+$/.test(id)) return;
      await this._runService(id,"scene","turn_on",{});
    }

    async _saveTranslation(form) {
      if (!this._hass?.user?.is_admin || !this._admin || !this._manifest) return;
      const roomId = form.getAttribute("data-room-id");
      if (!(this._manifest.rooms || []).some((r)=>r.id===roomId)) return;
      const bg = String(form.querySelector('input[name="bg"]')?.value || "").trim();
      const en = String(form.querySelector('input[name="en"]')?.value || "").trim();
      if (bg.length>80 || en.length>80) return;
      const connection=this._hass.connection, user=this._hass.user?.id;
      try {
        await this._hass.callWS({
          type:"stevora/admin/translations/update",
          expected_revision:this._admin.revision,
          rooms:{[roomId]:{bg,en}}, entities:{}
        });
        if (connection!==this._hass?.connection || user!==this._hass?.user?.id) return;
        this._actionNotice=COPY[this._language].saved;
        await this.refresh();
      } catch (_) {
        if (connection!==this._hass?.connection || user!==this._hass?.user?.id) return;
        this._actionNotice=COPY[this._language].serviceError;
        this.render();
      }
    }

    async _sendAssist(form) {
      if (this._chatBusy || !this._hass?.callWS) return;
      const field=form.querySelector('input[name="message"]');
      const message=String(field?.value || "").trim().slice(0,500);
      if (!message) return;
      const connection=this._hass.connection, user=this._hass.user?.id;
      this._chatBusy=true;
      this._chat.push({role:"user",text:message});
      this._chat=this._chat.slice(-24);
      this.render();
      try {
        const result=await this._hass.callWS({
          type:"conversation/process",text:message,
          language:this._language,
          ...(this._conversationId ? {conversation_id:this._conversationId}:{})
        });
        if (connection!==this._hass?.connection || user!==this._hass?.user?.id) return;
        if (typeof result?.conversation_id==="string") this._conversationId=result.conversation_id;
        const speech=result?.response?.speech?.plain?.speech;
        this._chat.push({role:"assistant",text:typeof speech==="string"?speech:COPY[this._language].msgFailed});
      } catch (_) {
        if (connection!==this._hass?.connection || user!==this._hass?.user?.id) return;
        this._chat.push({role:"assistant",text:COPY[this._language].msgFailed});
      } finally {
        this._chatBusy=false;
        this._chat=this._chat.slice(-24);
        this.render();
      }
    }

    _rooms(t) {
      const rooms = this._manifest?.rooms || [];
      if (!rooms.length) return `<div class="empty">${escapeHTML(t.noRooms)}</div>`;
      const entities = this._manifest?.entities || [];
      return `<div class="rooms">${rooms.map((room) => {
        const count = entities.filter((ent) => ent.area_id === room.id).length;
        return `<button type="button" data-room="${escapeHTML(room.id)}" class="room"><div class="room-icon" aria-hidden="true">⌂</div>
          <h3>${escapeHTML(room.name || room.id)}</h3>
          <p>${count} ${escapeHTML(t.devices.toLowerCase())}</p></button>`;
      }).join("")}</div>`;
    }

    _stat(label, value, id) {
      return `<div class="stat"><div class="stat-label">${escapeHTML(label)}</div>
        <div class="stat-number" data-stat="${id}">${escapeHTML(value)}</div></div>`;
    }

    _systemContent(t, ready, hub) {
      const admin = Boolean(this._hass?.user?.is_admin);
      const sys = admin ? this._system : null;
      const updates = sys?.official_updates || {};
      const stateLabel = (item) => ({
        "available": t.updateAvailable, "up_to_date": t.updateCurrent,
        "not_detected": t.updateNotDetected, "unknown": t.updateUnknown
      })[item?.status] || t.systemUnavailable;
      const status = this._systemBusy
        ? `<div class="notice" role="status">${escapeHTML(t.waitingStatus)}</div>`
        : this._systemError ? `<div class="notice error" role="alert">${escapeHTML(this._systemError)}</div>` : "";
      const rows = [["core", t.componentCore], ["os", t.componentOS], ["supervisor", t.componentSupervisor]]
        .map(([key, label]) => {
          const item = updates[key] || { status: "not_detected" };
          const kind = ["available", "up_to_date"].includes(item.status) ? item.status : "unknown";
          return `<div class="os-update-row">
            <div><strong>${escapeHTML(label)}</strong>
              <div class="os-version">${escapeHTML(t.currentVersion)}: ${escapeHTML(item.installed_version || "—")}
              · ${escapeHTML(t.newVersion)}: ${escapeHTML(item.latest_version || "—")}</div></div>
            <span class="os-status ${kind}">${escapeHTML(stateLabel(item))}</span></div>`;
        }).join("");
      const summary = sys
        ? `${Number(sys.updates_available) || 0} ${escapeHTML(t.confirmed)} ·
            ${Number(sys.updates_unknown) || 0} ${escapeHTML(t.unknownCount)}`
        : t.systemUnavailable;
      return `<header class="section-heading"><h1>${escapeHTML(t.systemCenter)}</h1>
          <span>${escapeHTML(t.managedByHA)}</span></header>
        <section class="metrics">
          ${this._stat(t.haCore, sys?.core_version || this._hass?.config?.version || t.unavailable, "version")}
          ${this._stat(t.integration, ready ? t.integrationReady : t.unavailableStatus, "integration")}
          ${this._stat(t.hub, ready ? hub : t.emptyHub, "hub")}
          ${this._stat(t.access, admin ? t.administrator : t.user, "access")}
        </section>
        ${status}
        ${admin ? `<section class="os-system-grid">
          <article class="card"><h2>${escapeHTML(t.state)}</h2>
            <div class="kv"><span>${escapeHTML(t.haState)}</span>
              <strong>${escapeHTML(sys?.ha_state || "—")}</strong></div>
            <div class="kv"><span>${escapeHTML(t.entityCount)}</span>
              <strong>${sys && Number.isFinite(sys.registered_entities) ? sys.registered_entities : "—"}</strong></div>
            <div class="kv"><span>${escapeHTML(t.oslayer)}</span>
              <strong>1.0.0-alpha.1 Developer Preview</strong></div>
            <button class="button secondary" data-system-refresh type="button">${escapeHTML(t.checkStatus)}</button>
          </article>
          <article class="card"><h2>${escapeHTML(t.officialUpdates)}</h2>
            <p class="os-summary">${summary}</p>
            <div class="os-updates">${rows}</div>
            <p>${escapeHTML(t.systemReadOnly)}</p>
            <a class="button secondary" href="/config">${escapeHTML(t.systemOpen)}</a>
          </article></section>` :
          `<article class="card"><h2>${escapeHTML(t.access)}</h2><p>${escapeHTML(t.adminOnly)}</p>
            <p>${escapeHTML(t.systemReadOnly)}</p></article>`}
      `;
    }

    _cards(group = "all", area = "") {
      const sections = this._model?.sections || [];
      const allowed = new Set((this._manifest?.entities || []).map((item) => item.entity_id));
      return sections.flatMap((section) => section.cards || [])
        .filter((card) => allowed.has(card.entity_id))
        .filter((card) => !area || this._entity(card.entity_id)?.area_id === area)
        .filter((card) => group === "all" || card.display_category === group)
        .filter((card) => !this._backlight(card.entity_id));
    }

    _entity(id) {
      return (this._manifest?.entities || []).find((item) => item.entity_id === id) || null;
    }

    _backlight(id) {
      const original = this._entity(id);
      const label = [id, original?.name, original?.original_name, original?.source_name]
        .join(" ").toLowerCase();
      return /back[ _-]?light|подсвет/.test(label);
    }

    _can(card, control) {
      if (!card || !card.entity_id || this._backlight(card.entity_id)) return false;
      if (!this._entity(card.entity_id)) return false;
      if (!(this._manifest?.controllable_entities || []).includes(card.entity_id)) return false;
      if (card.layout === "info") return false;
      if (!Array.isArray(card.controls) || !card.controls.includes(control)) return false;
      if (this._hass?.states?.[card.entity_id]?.state === "unavailable") return false;
      return true;
    }

    _state(id) {
      return this._hass?.states?.[id] || null;
    }

    _deviceCard(card, t) {
      const id = card.entity_id;
      const idAttr = escapeHTML(id);
      const state = this._state(id);
      const category = card.display_category;
      const domain = card.domain;
      const isOff = state?.state === "off";
      const unavailable = !state || ["unavailable", "unknown"].includes(state.state);
      const stateLabel = unavailable ? t.unavailableDevice : (isOff ? t.off : state?.state || "—");
      const icon = {light:"☼",switch:"◉",climate:"◈",fan:"✺",cover:"▥",
        media_player:"▷",sensor:"◷",binary_sensor:"◌",lock:"♙"}[domain] || "▣";
      const buttons = [];
      if (this._can(card, "toggle") && ["light", "switch", "fan"].includes(domain)) {
        buttons.push('<button class="action" type="button" data-device-action="toggle" data-entity="'+idAttr+'">'+
          escapeHTML(isOff ? t.turnOn : t.turnOff)+'</button>');
      }
      if (this._can(card,"temperature") && domain === "climate") {
        const temp = Number(state?.attributes?.temperature);
        const min = Number(state?.attributes?.min_temp);
        const max = Number(state?.attributes?.max_temp);
        const valid = Number.isFinite(temp) && temp > 0;
        const minT = Number.isFinite(min) ? min : 5, maxT = Number.isFinite(max) ? max : 35;
        buttons.push('<div class="temp-controls"><button type="button" data-device-action="temp-down" data-entity="'+idAttr+
          '" '+(!valid || temp-1 < minT ? "disabled" : "")+' aria-label="'+escapeHTML(t.minus)+'">−</button>'+
          '<strong>'+escapeHTML(valid ? String(temp)+"°" : "—")+'</strong>'+
          '<button type="button" data-device-action="temp-up" data-entity="'+idAttr+'" '+
          (!valid || temp+1 > maxT ? "disabled" : "")+' aria-label="'+escapeHTML(t.plus)+'">+</button></div>');
      }
      if (this._can(card,"open") && domain === "cover")
        buttons.push('<button type="button" class="action" data-device-action="open" data-entity="'+idAttr+'">'+escapeHTML(t.open)+'</button>');
      if (this._can(card,"close") && domain === "cover")
        buttons.push('<button type="button" class="action" data-device-action="close" data-entity="'+idAttr+'">'+escapeHTML(t.close)+'</button>');
      if (this._can(card,"play_pause") && domain === "media_player")
        buttons.push('<button type="button" class="action" data-device-action="play_pause" data-entity="'+idAttr+'">⏯</button>');
      if (this._can(card,"brightness") && domain === "light") {
        const brightness = Number(state?.attributes?.brightness);
        const pct = Number.isFinite(brightness) ? Math.round(brightness * 100 / 255) : 100;
        buttons.push('<label class="device-slider">'+escapeHTML(t.brightness)+
          '<input type="range" min="1" max="100" step="1" value="'+pct+
          '" data-device-input="brightness" data-entity="'+idAttr+'"></label>');
      }
      if (this._can(card,"percentage") && domain === "fan") {
        const p = Number(state?.attributes?.percentage);
        const pct = Number.isFinite(p) ? Math.max(0,Math.min(100,p)) : 0;
        buttons.push('<label class="device-slider">'+escapeHTML(t.speed)+
          '<input type="range" min="0" max="100" step="1" value="'+pct+
          '" data-device-input="percentage" data-entity="'+idAttr+'"></label>');
      }
      if (this._can(card,"color") && domain === "light") {
        const rgb = state?.attributes?.rgb_color;
        const color = Array.isArray(rgb) && rgb.length === 3 ? "#"+rgb.map((v)=>
          Math.max(0,Math.min(255,Math.round(Number(v)||0))).toString(16).padStart(2,"0")).join("") : "#ffffff";
        buttons.push('<label class="color-control">'+escapeHTML(t.color)+
          '<input type="color" value="'+color+'" data-device-input="color" data-entity="'+idAttr+'"></label>');
      }
      const stateText = domain === "climate" && state && !unavailable
        ? (Number.isFinite(Number(state.attributes?.current_temperature))
          ? String(state.attributes.current_temperature)+"° · " : "") + state.state : stateLabel;
      return '<article class="entity-card'+(unavailable ? " unavailable" : "")+'" data-device-card data-search="'+
        escapeHTML((card.name || id).toLowerCase()+" "+id.toLowerCase())+'">'+
        '<div class="entity-head"><span class="entity-icon" aria-hidden="true">'+icon+'</span>'+
        '<div><strong>'+escapeHTML(card.name || id)+'</strong><small>'+escapeHTML(id)+'</small></div></div>'+
        '<div class="entity-state" data-live-entity="'+idAttr+'">'+escapeHTML(stateText)+'</div>'+
        '<div class="entity-actions">'+buttons.join("")+
        '<button class="action subtle" type="button" data-device-action="details" data-entity="'+idAttr+'">'+
          escapeHTML(t.details)+'</button></div></article>';
    }

    _deviceView(t, group) {
      const title = group === "lighting" ? t.lighting : group === "climate" ? t.climate : t.devicesTitle;
      const rooms = this._manifest?.rooms || [];
      const roomOptions = [['',t.roomAll], ...rooms.map((room)=>[room.id,room.name])].map(([id,name])=>
        '<option value="'+escapeHTML(id)+'" '+(id===this._selectedRoom ? "selected" : "")+'>'+
          escapeHTML(name)+'</option>').join("");
      const cards = this._cards(group,this._selectedRoom);
      return '<header class="section-heading"><h1>'+escapeHTML(title)+'</h1>'+
        '<span>'+cards.length+' · '+escapeHTML(t.local)+'</span></header>'+
        '<section class="device-toolbar"><label>'+escapeHTML(t.room)+
        '<select data-room-select>'+roomOptions+'</select></label>'+
        '<label>'+escapeHTML(t.search)+
        '<input type="search" data-device-search placeholder="'+escapeHTML(t.search)+'"></label></section>'+
        (cards.length ? '<div class="device-grid">'+cards.map((c)=>this._deviceCard(c,t)).join("")+'</div>'
          : '<div class="empty">'+escapeHTML(t.noDevices)+'</div>');
    }

    _sceneView(t) {
      const automation = this._view === "automation";
      const title = automation ? t.automation : t.scenes;
      const items = (this._hubDirectory?.items || []).filter((item)=>
        automation ? item.domain === "automation" : ["scene", "script"].includes(item.domain));
      return '<header class="section-heading"><h1>'+escapeHTML(title)+'</h1>'+
        '<span>Home Hub</span></header>'+
        '<div class="device-grid">'+(items.length ? items.map((item) => {
          const able = item.domain === "scene" && item.action_allowed === true &&
            !this._backlight(item.entity_id);
          return '<article class="entity-card"><div class="entity-head"><span class="entity-icon">✦</span>'+
            '<div><strong>'+escapeHTML(item.name || item.entity_id)+'</strong><small>'+
              escapeHTML(item.entity_id)+'</small></div></div>'+
            '<div class="entity-state">'+escapeHTML(item.state || "—")+'</div>'+
            (able ? '<button type="button" class="action" data-scene-run="'+escapeHTML(item.entity_id)+'">'+
              escapeHTML(t.activate)+'</button>' : '<span class="read-only">'+escapeHTML(t.readonly)+'</span>')+
            '</article>';
        }).join("") : '<div class="empty">'+escapeHTML(automation?t.noAutomations:t.noScenes)+'</div>')+'</div>';
    }

    _assistView(t) {
      // Chat history is memory-only and cleared on HA session/server changes.
      const messages = this._chat.map((message) =>
        '<div class="chat-msg '+(message.role==="user"?"is-user":"is-assistant")+'">'+
          escapeHTML(message.text)+'</div>').join("");
      return '<header class="section-heading"><h1>'+escapeHTML(t.assistTitle)+'</h1></header>'+
        '<div class="card chat-card"><p>'+escapeHTML(t.assistNote)+'</p>'+
        '<div class="chat-history" role="log" aria-live="polite">'+messages+'</div>'+
        '<form data-assist-form><input name="message" type="text" maxlength="500" required '+
          'placeholder="'+escapeHTML(t.assistPrompt)+'" autocomplete="off">'+
          '<button class="button primary" type="submit" '+(this._chatBusy?"disabled":"")+'>'+
          escapeHTML(t.send)+'</button></form></div>';
    }

    _preferenceForm(t, wizard = false) {
      const preferences = this._preferences?.preferences || {
        language: this._language, default_view: "home",
        compact_nav: false, onboarding_complete: false,
      };
      const allowed = [
        ["home", t.home], ["rooms", t.rooms], ["devices", t.devicesTitle],
        ["lighting", t.lighting], ["climate", t.climate],
        ["scenes", t.scenes], ["automation", t.automation],
        ["assist", t.assist], ["system", t.system], ["integrations", t.integrations]
      ];
      const pageOptions = allowed.map(([id, name]) =>
        '<option value="'+id+'" '+(preferences.default_view===id?'selected':'')+'>'+
          escapeHTML(name)+'</option>').join("");
      return '<form class="stevora-preferences" '+(wizard?'data-onboarding-form':'data-personal-form')+'>'+
        '<label>'+escapeHTML(t.lang)+'<select name="language">'+
        '<option value="bg" '+(preferences.language==="bg"?"selected":"")+'>BG</option>'+
        '<option value="en" '+(preferences.language==="en"?"selected":"")+'>EN</option></select></label>'+
        '<label>'+escapeHTML(t.preferredHome)+'<select name="default_view">'+pageOptions+'</select></label>'+
        '<label class="check-row"><input type="checkbox" name="compact_nav" '+
          (preferences.compact_nav?"checked":"")+'>'+
          escapeHTML(t.compactNav)+'</label>'+
        '<button class="button primary" type="submit" '+
          (!this._preferences || this._prefsBusy?"disabled":"")+'>'+
          escapeHTML(wizard?t.finishOnboarding:t.savePreferences)+'</button>'+
        (this._prefsError?'<p class="note-error" role="alert">'+escapeHTML(this._prefsError)+'</p>':'')+
        '</form>';
    }

    _onboardingView(t) {
      const ready = this._status === "ready";
      const modules = this._manifest?.modules || {};
      const hubStatus = modules.home_hub?.status || "not_included";
      const count = this._counts();
      return '<header class="section-heading"><h1>'+escapeHTML(t.onboardTitle)+
        '</h1><span>STEVORA OS 1.0</span></header>'+
        '<p class="section-intro">'+escapeHTML(t.onboardSub)+'</p>'+
        '<div class="setup-steps">'+
        '<section class="card"><h2>'+escapeHTML(t.onboardStep1)+'</h2>'+
        '<p>'+escapeHTML(t.onboardConnected)+'</p>'+
        '<p>'+escapeHTML(t.onboardConnectedNote)+'</p>'+
        '<div class="kv"><span>'+escapeHTML(t.roomCount)+'</span><strong>'+
          (ready?count.rooms:"—")+'</strong></div>'+
        '<div class="kv"><span>'+escapeHTML(t.deviceCount)+'</span><strong>'+
          (ready?count.devices:"—")+'</strong></div>'+
        '<div class="kv"><span>Home Hub</span><strong>'+escapeHTML(hubStatus)+'</strong></div>'+
        '<p>'+escapeHTML(ready?t.onboardManifestReady:t.onboardManifestMissing)+'</p></section>'+
        '<section class="card"><h2>'+escapeHTML(t.onboardStep2)+'</h2>'+
        this._preferenceForm(t,true)+'</section>'+
        '<section class="card"><h2>'+escapeHTML(t.onboardStep3)+'</h2>'+
        '<p>'+escapeHTML(t.setupOptional)+'</p>'+
        '<p>'+escapeHTML(t.installationHelp)+'</p>'+
        '<button type="button" class="button secondary" data-fullscreen>'+
          escapeHTML(t.enterFullscreen)+'</button>'+
        (this._hass?.user?.is_admin ? '<a href="/config" class="button secondary">'+
           escapeHTML(t.recoveryLink)+'</a>' : '')+
        '</section></div>';
    }

    _setupView(t) {
      const modules = this._manifest?.modules || {};
      const labels = {core:"STEVORA Core",home_panel:"Home Panel 7.1.1",
        home_hub:"Home Hub",hey_stevora:"Hey Stevora",memory_sync:"Memory Sync"};
      const moduleRows = Object.entries(labels).map(([key,label])=>{
        const info = modules[key] || {};
        const status = info.status || "not_included";
        return '<div class="kv"><span>'+escapeHTML(label)+'</span><strong>'+
          escapeHTML(status)+'</strong></div>';
      }).join("");
      let editing = '<p>'+escapeHTML(t.needsAdmin)+'</p>';
      if (this._hass?.user?.is_admin && this._admin && this._manifest) {
        editing = '<p>'+escapeHTML(t.translationsHint)+'</p><div class="room-editor">'+
          (this._manifest.rooms || []).filter((room)=>room.id!=="__stevora_unassigned__").map((room)=>{
            const tr = this._admin.translations?.rooms?.[room.id] || {};
            return '<form data-translate-form data-room-id="'+escapeHTML(room.id)+'">'+
              '<strong>'+escapeHTML(room.name)+'</strong>'+
              '<label>BG<input name="bg" maxlength="80" value="'+escapeHTML(tr.bg||"")+'"></label>'+
              '<label>EN<input name="en" maxlength="80" value="'+escapeHTML(tr.en||"")+'"></label>'+
              '<button type="submit" class="button secondary">'+escapeHTML(t.save)+'</button></form>';
          }).join("")+'</div>';
      } else if (this._hass?.user?.is_admin) editing='<p>'+escapeHTML(t.adminConfigMissing)+'</p>';
      return '<header class="section-heading"><h1>'+escapeHTML(t.settingsTitle)+'</h1></header>'+
        '<section class="card os-personal-settings"><h2>'+escapeHTML(t.accountSettings)+'</h2>'+
          this._preferenceForm(t,false)+
          '<p>'+escapeHTML(t.installationHelp)+'</p>'+
          '<button class="button secondary" type="button" data-onboarding>'+
            escapeHTML(t.reopenWizard)+'</button></section>'+
        '<div class="os-system-grid"><div class="card"><h2>'+escapeHTML(t.editRooms)+'</h2>'+
          editing+'</div><div class="card"><h2>'+escapeHTML(t.modulesTitle)+'</h2>'+
          moduleRows+'<h2>'+escapeHTML(t.onboarding)+'</h2>'+
          '<p>'+escapeHTML(t.onboardingInfo)+'</p>'+
          (this._hass?.user?.is_admin?'<a href="/config/integrations" class="button secondary">'+
            escapeHTML(t.integrationSettings)+'</a>':'')+'</div></div>';
    }

    _homeHighlights(t) {
      const climates = this._cards("climate").slice(0,3);
      const climateRows = climates.map((card) => {
        const state = this._state(card.entity_id);
        const current = state?.attributes?.current_temperature;
        const target = state?.attributes?.temperature;
        return '<div class="kv"><span>'+escapeHTML(card.name)+'</span><strong>'+
          escapeHTML(current == null ? "—" : String(current)+"°")+
          ' · '+escapeHTML(target == null ? "—" : String(target)+"°")+'</strong></div>';
      }).join("");
      const visible = new Set((this._manifest?.entities || []).map((entity)=>entity.entity_id));
      const events = (this._hubEvents?.events || []).filter((event)=>
        visible.has(event.entity_id) && !this._backlight(event.entity_id)).slice(-6).reverse();
      const eventRows = events.map((event) =>
        '<div class="kv"><span>'+escapeHTML(event.entity_id)+'</span><strong>'+
          escapeHTML(event.kind || event.state || "—")+'</strong></div>').join("");
      return '<section class="home-detail"><article class="card"><h2>'+
        escapeHTML(t.climate)+'</h2>'+(climateRows || '<p>'+escapeHTML(t.noDevices)+'</p>')+
        '</article><article class="card"><h2>'+escapeHTML(t.hubEvents)+'</h2>'+
        (eventRows || '<p>'+escapeHTML(t.noEvents)+'</p>')+'</article></section>';
    }

    _integrationView(t) {
      if (!this._hass?.user?.is_admin)
        return '<section class="card"><h1>'+escapeHTML(t.integrationsTitle)+
          '</h1><p>'+escapeHTML(t.integrationsAdmin)+'</p></section>';
      const data=this._integrations;
      const entries=data?.entries||[];
      const rows=entries.map((entry)=>{
        const disabled=Boolean(entry.disabled_by);
        const state=disabled ? t.integrationsDisabled : String(entry.state||"unknown");
        const ready=!disabled && entry.state==="loaded";
        return '<div class="integration-row" data-integration-row data-search="'+
          escapeHTML((entry.domain+" "+entry.title+" "+state).toLowerCase())+'">'+
          '<div class="integration-icon">◈</div><div class="integration-text"><strong>'+
          escapeHTML(entry.title)+'</strong><small>'+escapeHTML(entry.domain)+
          '</small></div><span class="os-status '+(ready?"up_to_date":"unknown")+'">'+
          escapeHTML(state)+'</span></div>';
      }).join("");
      const error=this._integrationsError
        ? '<div class="notice error" role="alert">'+escapeHTML(this._integrationsError)+'</div>' : "";
      return '<header class="section-heading"><h1>'+escapeHTML(t.integrationsTitle)+
        '</h1><span>'+escapeHTML(t.managedByHA)+'</span></header>'+
        '<p class="section-intro">'+escapeHTML(t.integrationsNote)+'</p>'+
        '<section class="metrics">'+
          this._stat(t.integrationsTotal,data?data.count_total:"—","integrations-total")+
          this._stat(t.integrationsLoaded,data?data.count_loaded:"—","integrations-loaded")+
          this._stat(t.integrationsIssues,data?data.count_not_loaded:"—","integrations-unloaded")+
        '</section>'+error+
        '<div class="card integrations-card">'+
          '<div class="integrations-header"><label>'+escapeHTML(t.integrationsSearch)+
            '<input type="search" data-integrations-search placeholder="'+
            escapeHTML(t.integrationsSearch)+'"></label>'+
            '<button type="button" data-integrations-refresh class="button secondary" '+
            (this._integrationsBusy?"disabled":"")+'>'+
            escapeHTML(t.integrationsRefresh)+'</button></div>'+
          (data?.truncated?'<p>'+escapeHTML(t.integrationsTruncated)+'</p>':'')+
          '<div class="integration-list">'+
            (rows||'<div class="empty">'+escapeHTML(t.integrationsNoItems)+'</div>')+
          '</div><p>'+escapeHTML(t.integrationsReadOnly)+'</p>'+
          '<a class="button secondary" href="/config/integrations">'+
            escapeHTML(t.integrationsOfficial)+'</a>'+
        '</div>';
    }

    _content(t) {
      const ready = this._status === "ready";
      const count = this._counts();
      const hubStatus = this._manifest?.modules?.home_hub?.status || "not_included";
      const hub = hubStatus === "active" ? t.online : hubStatus === "disabled" ? t.inactive : t.emptyHub;
      if (this._view === "devices") return this._deviceView(t, "all");
      if (this._view === "lighting") return this._deviceView(t, "lighting");
      if (this._view === "climate") return this._deviceView(t, "climate");
      if (this._view === "scenes" || this._view === "automation") return this._sceneView(t);
      if (this._view === "assist") return this._assistView(t);
      if (this._view === "onboarding") return this._onboardingView(t);
      if (this._view === "setup") return this._setupView(t);
      if (this._view === "integrations") return this._integrationView(t);
      if (this._view === "home") return `
        <section class="hero">
          <div><span class="eyebrow">${escapeHTML(t.eyebrow)}</span>
          <h1>${escapeHTML(t.welcome)}</h1><p>${escapeHTML(t.intro)}</p>
          <div class="hero-actions"><button type="button" class="button primary" data-view="devices">${escapeHTML(t.devicesTitle)}</button>
          <button data-refresh type="button" class="button secondary">${escapeHTML(t.refresh)}</button></div></div>
          <div class="hero-graphic" aria-hidden="true"><div class="orbit one"></div><div class="orbit two"></div>
            <div class="orbit-core">S</div></div>
        </section>
        <section class="metrics">
          ${this._stat(t.discovered, ready ? count.rooms : "—", "rooms")}
          ${this._stat(t.devices, ready ? count.devices : "—", "devices")}
          ${this._stat(t.available, ready ? count.available : "—", "available")}
          ${this._stat(t.hub, ready ? hub : "—", "hub")}
        </section>
        <div class="section-heading"><h2>${escapeHTML(t.yourRooms)}</h2><span>${escapeHTML(t.local)}</span></div>
        ${this._rooms(t)}
        ${this._homeHighlights(t)}
      `;
      if (this._view === "rooms") return `
        <header class="section-heading"><h1>${escapeHTML(t.yourRooms)}</h1>
          <span>${escapeHTML(t.noDeviceControls)}</span></header>${this._rooms(t)}`;
      if (this._view === "system") return this._systemContent(t, ready, hub);
      return `<section class="card about"><span class="eyebrow">${escapeHTML(t.eyebrow)}</span>
        <h1>${escapeHTML(t.aboutTitle)}</h1><p>${escapeHTML(t.aboutText)}</p>
        <div class="kv"><span>${escapeHTML(t.version)}</span><strong>1.0.0-alpha.3 Developer Preview</strong></div>
        <div class="kv"><span>${escapeHTML(t.backend)}</span><strong>Home Assistant OS</strong></div></section>`;
    }

    _patchLive() {
      if (!this.shadowRoot || !this._manifest) return;
      const node = this.shadowRoot.querySelector('[data-stat="available"]');
      if (node) node.textContent = String(this._counts().available);
      this.shadowRoot.querySelectorAll?.("[data-live-entity]")?.forEach((el)=>{
        const id=el.getAttribute("data-live-entity");
        const state=this._state(id);
        if (!id || !state) return;
        let value=state.state;
        if (["unavailable","unknown"].includes(state.state)) {
          value=COPY[this._language].unavailableDevice;
        } else if (id.startsWith("climate.")) {
          const current=state.attributes?.current_temperature;
          value=(current == null ? "" : String(current)+"° · ")+state.state;
        }
        if (el.textContent !== value) el.textContent=value;
      });
    }

    render() {
      if (!this.shadowRoot) return;
      const t = COPY[this._language];
      const menu = [
        ["home","⌂",t.home],["rooms","▦",t.rooms],["devices","▤",t.devicesTitle],
        ["lighting","☼",t.lighting],["climate","◈",t.climate],
        ["scenes","✦",t.scenes],["automation","◇",t.automation],
        ["assist","◉",t.assist],["system","⚙",t.system],
        ["setup","≡",t.setup],["integrations","▦",t.integrations],["about","ⓘ",t.about]
      ];
      const nav = menu.map(([id, icon, name]) => `
        <button type="button" data-view="${id}" class="nav-item ${this._view === id ? "selected" : ""}"
                aria-current="${this._view === id ? "page" : "false"}">
          <span class="nav-icon" aria-hidden="true">${icon}</span><span>${escapeHTML(name)}</span>
        </button>`).join("");
      const note = this._actionNotice ? `<div class="notice" role="status">${escapeHTML(this._actionNotice)}</div>` : "";
      const loadNote = this._status === "error"
        ? `<div class="notice error" role="alert">${escapeHTML(t.error)} · ${escapeHTML(this._error)}</div>`
        : this._status === "loading" ? `<div class="notice" role="status">${escapeHTML(t.loading)}</div>` : "";
      this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="/stevora_os_static/stevora-os.css?v=1.0.0-alpha.3">
        <div class="shell ${this._preferences?.preferences?.compact_nav ? "shell-compact" : ""}">
          <aside class="side">
            <div class="brand"><span class="brand-mark" aria-hidden="true">S</span>
              <div><strong>STEVORA</strong><small>OS EXPERIENCE</small></div></div>
            <div class="sidebar-label">${escapeHTML(t.environment)}</div>
            <nav aria-label="STEVORA OS">${nav}</nav>
            <div class="side-footer"><span class="pulse"></span>${escapeHTML(t.preview)}
              <a href="/stevora">${escapeHTML(t.homeLink)}</a></div>
          </aside>
          <main class="main">
            <header class="toolbar"><div class="mobile-brand">STEVORA <span>OS</span></div>
              <div class="toolbar-actions">
                <button type="button" class="button secondary shell-focus" data-fullscreen>
                  ${escapeHTML(t.enterFullscreen)}</button>
                <label for="stevora-os-language">${escapeHTML(t.lang)}</label>
                <select id="stevora-os-language" aria-label="${escapeHTML(t.lang)}">
                  <option value="bg" ${this._language === "bg" ? "selected" : ""}>BG</option>
                  <option value="en" ${this._language === "en" ? "selected" : ""}>EN</option></select>
                <span class="preview-pill">1.0 α2</span></div></header>
            ${loadNote}${note}
            ${this._prefsError && this._view !== "onboarding"
                ? '<div class="notice error" role="alert">'+escapeHTML(this._prefsError)+'</div>' : ''}
            <div class="content">${this._content(t)}</div>
            <footer>STEVORA OS Experience · Powered by Home Assistant · <strong>Developer Preview</strong></footer>
          </main>
          <nav class="mobile-nav" aria-label="STEVORA OS mobile">${nav}</nav>
        </div>`;
      this._patchLive();
      this._patchFullscreen();
    }
  }
  if (!customElements.get("stevora-os-preview"))
    customElements.define("stevora-os-preview", StevoraOSPreview);
})();
