/* STEVORA OS Developer Preview 0.1.0
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
      this._request = 0;
      this._connected = false;
      this.shadowRoot.addEventListener("click", (event) => this._onClick(event));
      this.shadowRoot.addEventListener("change", (event) => this._onChange(event));
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
        this._error = "";
        this._status = "loading";
        this._view = "home";
        this.render();
        void this.refresh();
      } else if (!this._connection) {
        this._connection = connection;
        this._user = user;
        if (this._connected) void this.refresh();
      } else {
        // State ticks only patch text nodes; preserve focus/navigation.
        this._patchLive();
      }
    }

    get hass() { return this._hass; }

    connectedCallback() {
      this._connected = true;
      this.render();
      if (this._hass && !this._manifest && !this._busy) void this.refresh();
    }

    disconnectedCallback() {
      this._connected = false;
      this._request += 1;
      this._busy = false;
      this._manifest = null;
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
        this._manifest = result;
        this._status = "ready";
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
      const target = event.target?.closest?.("[data-view], [data-refresh]");
      if (!target) return;
      if (target.hasAttribute("data-refresh")) { void this.refresh(); return; }
      const view = target.getAttribute("data-view");
      if (!["home", "rooms", "system", "about"].includes(view)) return;
      this._view = view;
      this.render();
    }

    _onChange(event) {
      if (event.target?.id !== "stevora-os-language") return;
      const lang = event.target.value;
      if (!["bg", "en"].includes(lang) || lang === this._language) return;
      this._language = lang;
      this._manifest = null;
      void this.refresh();
    }

    _rooms(t) {
      const rooms = this._manifest?.rooms || [];
      if (!rooms.length) return `<div class="empty">${escapeHTML(t.noRooms)}</div>`;
      const entities = this._manifest?.entities || [];
      return `<div class="rooms">${rooms.map((room) => {
        const count = entities.filter((ent) => ent.area_id === room.id).length;
        return `<article class="room"><div class="room-icon" aria-hidden="true">⌂</div>
          <h3>${escapeHTML(room.name || room.id)}</h3>
          <p>${count} ${escapeHTML(t.devices.toLowerCase())}</p></article>`;
      }).join("")}</div>`;
    }

    _stat(label, value, id) {
      return `<div class="stat"><div class="stat-label">${escapeHTML(label)}</div>
        <div class="stat-number" data-stat="${id}">${escapeHTML(value)}</div></div>`;
    }

    _content(t) {
      const ready = this._status === "ready";
      const count = this._counts();
      const hubStatus = this._manifest?.modules?.home_hub?.status || "not_included";
      const hub = hubStatus === "active" ? t.online : hubStatus === "disabled" ? t.inactive : t.emptyHub;
      if (this._view === "home") return `
        <section class="hero">
          <div><span class="eyebrow">${escapeHTML(t.eyebrow)}</span>
          <h1>${escapeHTML(t.welcome)}</h1><p>${escapeHTML(t.intro)}</p>
          <div class="hero-actions"><a href="/stevora" class="button primary">${escapeHTML(t.homepanel)}</a>
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
      `;
      if (this._view === "rooms") return `
        <header class="section-heading"><h1>${escapeHTML(t.yourRooms)}</h1>
          <span>${escapeHTML(t.noDeviceControls)}</span></header>${this._rooms(t)}`;
      if (this._view === "system") return `
        <header class="section-heading"><h1>${escapeHTML(t.system)}</h1><span>${escapeHTML(t.backend)}</span></header>
        <section class="metrics">
          ${this._stat(t.server, this._hass?.config?.version || t.unavailable, "version")}
          ${this._stat(t.integration, ready ? t.loaded : t.unavailableStatus, "integration")}
          ${this._stat(t.hub, ready ? hub : "—", "hub")}
          ${this._stat(t.access, this._hass?.user?.is_admin ? t.administrator : t.user, "access")}
        </section>
        <div class="card"><h2>${escapeHTML(t.settingsNote)}</h2>
          <p>${escapeHTML(t.readOnly)}</p>
          ${this._hass?.user?.is_admin ? `<a class="button secondary" href="/config">${escapeHTML(t.haSettings)}</a>` : ""}
        </div>`;
      return `<section class="card about"><span class="eyebrow">${escapeHTML(t.eyebrow)}</span>
        <h1>${escapeHTML(t.aboutTitle)}</h1><p>${escapeHTML(t.aboutText)}</p>
        <div class="kv"><span>${escapeHTML(t.version)}</span><strong>0.1.0 Developer Preview</strong></div>
        <div class="kv"><span>${escapeHTML(t.backend)}</span><strong>Home Assistant OS</strong></div></section>`;
    }

    _patchLive() {
      if (!this.shadowRoot || !this._manifest || this._view !== "home") return;
      const node = this.shadowRoot.querySelector('[data-stat="available"]');
      if (node) node.textContent = String(this._counts().available);
    }

    render() {
      if (!this.shadowRoot) return;
      const t = COPY[this._language];
      const menu = [
        ["home", "⌂", t.home], ["rooms", "▦", t.rooms],
        ["system", "◉", t.system], ["about", "ⓘ", t.about]
      ];
      const nav = menu.map(([id, icon, name]) => `
        <button type="button" data-view="${id}" class="nav-item ${this._view === id ? "selected" : ""}"
                aria-current="${this._view === id ? "page" : "false"}">
          <span class="nav-icon" aria-hidden="true">${icon}</span><span>${escapeHTML(name)}</span>
        </button>`).join("");
      const note = this._status === "error"
        ? `<div class="notice error" role="alert">${escapeHTML(t.error)} · ${escapeHTML(this._error)}</div>`
        : this._status === "loading" ? `<div class="notice" role="status">${escapeHTML(t.loading)}</div>` : "";
      this.shadowRoot.innerHTML = `
        <link rel="stylesheet" href="/stevora_os_static/stevora-os.css?v=0.1.0">
        <div class="shell">
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
              <div class="toolbar-actions"><label for="stevora-os-language">${escapeHTML(t.lang)}</label>
                <select id="stevora-os-language" aria-label="${escapeHTML(t.lang)}">
                  <option value="bg" ${this._language === "bg" ? "selected" : ""}>BG</option>
                  <option value="en" ${this._language === "en" ? "selected" : ""}>EN</option></select>
                <span class="preview-pill">0.1.0 PREVIEW</span></div></header>
            ${note}
            <div class="content">${this._content(t)}</div>
            <footer>STEVORA OS Experience · Powered by Home Assistant · <strong>Developer Preview</strong></footer>
          </main>
          <nav class="mobile-nav" aria-label="STEVORA OS mobile">${nav}</nav>
        </div>`;
      this._patchLive();
    }
  }
  if (!customElements.get("stevora-os-preview"))
    customElements.define("stevora-os-preview", StevoraOSPreview);
})();
