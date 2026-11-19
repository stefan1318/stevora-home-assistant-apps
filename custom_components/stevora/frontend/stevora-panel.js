/* STEVORA Home Panel — no external dependencies, local-first HA panel. */
class StevoraHomePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._manifest = null;
    this._panelModel = null;
    this._hub = null;
    this._hubError = "";
    this._hubLastUpdated = "";
    this._hubRefreshing = false;
    this._stateSignature = null;
    this._busy = false;
    this._error = "";
    this._mode = "auto";
    this._selectedRoom = "";
    this._language = "bg";
    this._languageOverride = null;
    this._admin = null;
    this._adminError = "";
    this._refreshQueued = false;
    this._view = "home";
    this._wall = false;
    this._renderedView = null;
    this._renderedInstallation = null;
    this._renderedUser = null;
    this._resetEditorValues = false;
    this._chatMessages = [];
    this._chatConversationId = null;
    this._chatBusy = false;
    this._chatError = "";
  }

  set hass(value) {
    const old = this._hass;
    this._hass = value;
    const sessionChanged = !!(old && value && (
      (old.connection && value.connection && old.connection !== value.connection) ||
      (old.user?.id && value.user?.id && old.user.id !== value.user.id)
    ));
    if (sessionChanged) {
      // Never render a previous home's manifest against the new home's states.
      this._manifest = null;
      this._panelModel = null;
      this._hub = null;
      this._hubError = "";
      this._hubLastUpdated = "";
      this._hubRefreshing = false;
      this._chatMessages = [];
      this._chatConversationId = null;
      this._chatBusy = false;
      this._chatError = "";
      this._admin = null;
      this._selectedRoom = "";
      this._stateSignature = null;
      this._mode = "native";
      if (this._busy) this._refreshQueued = true;
      else void this.refresh();
      this.render();
      return;
    }
    if (!old && value) void this.refresh();
    else if (value && this.isConnected) {
      const signature = Object.keys(value.states || {}).sort().join("|");
      const inventoryChanged = this._stateSignature !== null &&
        signature !== this._stateSignature;
      this._stateSignature = signature;
      // HA publishes state updates frequently. Settings and chat are workspaces:
      // never destroy open editors, unsaved choices, chat input or scroll.
      if (this._view === "settings" && this._mode === "stevora") {
        if (inventoryChanged) void this.refresh();
        return;
      }
      if (this._view === "ai" && this._mode === "stevora") return;
      if (inventoryChanged) void this.refresh();
      else this.render();
    }
  }

  connectedCallback() { this.render(); }

  async refresh() {
    if (!this._hass || this._busy) return;
    this._busy = true;
    const connection = this._hass.connection;
    const userId = this._hass.user?.id;
    const sessionChanged = () => (
      this._hass?.connection !== connection || this._hass?.user?.id !== userId
    );
    try {
      const locale = this._languageOverride || (this._hass?.language?.startsWith("bg") ? "bg" : "en");
      const manifest = await this._hass.callWS({ type: "stevora/manifest", language: locale });
      if (sessionChanged()) { this._refreshQueued = true; return; }
      const model = await this._hass.callWS({ type: "stevora/panel/generate", language: locale });
      if (sessionChanged()) { this._refreshQueued = true; return; }
      if (model?.installation_id !== manifest?.installation_id ||
          model?.revision !== manifest?.revision) {
        throw new Error("Panel manifest changed during refresh");
      }
      this._manifest = manifest;
      this._panelModel = model;
      this._language = manifest.preferred_language === "en" ? "en" : "bg";
      this._error = "";
      this._mode = "stevora";
      try {
        const [rooms, assistants] = await Promise.all([
          this._hass.callWS({type:"stevora/admin/rooms/get"}),
          this._hass.callWS({type:"stevora/admin/assistants/get"})
        ]);
        if (sessionChanged()) { this._refreshQueued = true; return; }
        this._admin = {rooms, assistants};
        this._adminError = "";
      } catch (error) {
        this._admin = null;
        const message = String(error?.message || error);
        this._adminError = /unauthorized|administrator permission/i.test(message) ? "" : message;
      }
      // Home Hub is optional; failing to load it never re-enables old controls.
      // Always verify this request still belongs to the same HA session.
      this._hub = null;
      this._hubError = "";
      if (manifest.modules?.home_hub?.status === "active") {
        try {
          const [status, history, scenes] = await Promise.all([
            this._hass.callWS({type:"stevora/hub/status"}),
            this._hass.callWS({type:"stevora/hub/events",limit:50}),
            this._hass.callWS({type:"stevora/hub/scenes"}),
          ]);
          if (sessionChanged()) { this._refreshQueued = true; return; }
          if ([status, history, scenes].some(item => item.installation_id !== manifest.installation_id))
            throw new Error("Home Hub belongs to another installation");
          let settings = null;
          if (this._admin) {
            settings = await this._hass.callWS({type:"stevora/hub/config/get"});
            if (sessionChanged()) { this._refreshQueued = true; return; }
          }
          this._hub = {status, history, scenes, settings};
          this._hubLastUpdated = new Date().toLocaleTimeString(this._language === "bg" ? "bg-BG" : "en-GB");
        } catch (error) {
          this._hubError = String(error?.message || error);
          this._hubLastUpdated = "";
        }
      }
    } catch (error) {
      this._manifest = null;
      this._panelModel = null;
      this._hub = null;
      this._admin = null;
      this._mode = "native";
      this._error = String(error?.message || "");
    } finally {
      this._busy = false;
      const queued = this._refreshQueued;
      this._refreshQueued = false;
      this.render();
      if (queued) void this.refresh();
    }
  }

  t(bg, en) { return this._language === "bg" ? bg : en; }
  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  // Preserve expanded accordions, user form edits and scroll across explicit
  // refreshes; keep this state in RAM only and never restore across HA sessions.
  captureUiState() {
    const root = this.shadowRoot;
    const identity = this._manifest?.installation_id || null;
    const user = this._hass?.user?.id || null;
    if (this._renderedView !== this._view ||
        this._renderedInstallation !== identity ||
        this._renderedUser !== user) return null;
    const opened = [...root.querySelectorAll("details[data-editor-key][open]")]
      .map(x => x.getAttribute("data-editor-key"));
    const fields = [...root.querySelectorAll(".v7-manager input, .v7-manager select, .v7-manager textarea")]
      .map(x => ({value: x.value, checked: !!x.checked, tag: x.tagName, type: x.type}));
    const panels = [...root.querySelectorAll(".v7-manager .auditlist")]
      .map(x => x.scrollTop || 0);
    return {opened, fields, panels};
  }

  restoreUiState(saved) {
    if (!saved) return;
    const opened = new Set(saved.opened);
    this.shadowRoot.querySelectorAll("details[data-editor-key]").forEach(x => {
      if (opened.has(x.getAttribute("data-editor-key"))) x.open = true;
    });
    if (!this._resetEditorValues) {
      const controls = [...this.shadowRoot.querySelectorAll(".v7-manager input, .v7-manager select, .v7-manager textarea")];
      if (controls.length === saved.fields.length)
        controls.forEach((x, index) => {
          const old = saved.fields[index];
          if (old.tag !== x.tagName || old.type !== x.type) return;
          if (x.type === "checkbox" || x.type === "radio") x.checked = old.checked;
          else x.value = old.value;
        });
    }
    this.shadowRoot.querySelectorAll(".v7-manager .auditlist").forEach((x, index) => {
      x.scrollTop = saved.panels[index] || 0;
    });
  }

  inventory() {
    const states = Object.values(this._hass?.states || {});
    const allowed = new Set((this._panelModel?.sections || []).flatMap(s => s.cards.map(x => x.entity_id)));
    if (this._mode !== "stevora" || !this._manifest) return [];
    return states.filter(x => {
      const domain = x.entity_id.split(".")[0];
      if (!["climate", "light", "switch", "cover", "sensor", "binary_sensor", "fan", "media_player", "lock"].includes(domain)) return false;
      if (!allowed.has(x.entity_id)) return false;
      // Backlights are intentionally never controlled by STEVORA.
      if (/back[ _-]?light|подсвет/i.test(x.entity_id) || /back[ _-]?light|подсвет/i.test(x.attributes?.friendly_name || "")) return false;
      // Room selection is a view filter, never a global inventory filter.
      // Summary, climate, lighting and system pages must represent the whole home.
      return true;
    });
  }

  render() {
    if (!this.shadowRoot) return;
    const uiSnapshot = this.captureUiState();
    const items = this.inventory();
    const rooms = (this._panelModel?.sections || []).map(({id, name}) => ({id, name}));
    const controllable = new Set(this._manifest?.controllable_entities || []);
    const audit = this._manifest?.discovery_diagnostics || null;
    const reasons = audit?.counts || {};
    const admin = this._admin;
    const adminPanel = admin ? `<details class="audit" data-editor-key="manager"><summary>${this.t("STEVORA администраторски мениджъри", "STEVORA administrator managers")}</summary>
      <h3>${this.t("Основен асистент", "Default assistant")}</h3>
      <select id="admin-assistant"><option value="">${this.t("Без избор", "No selection")}</option>${(admin.assistants.pipelines || []).map(p => `<option value="${this.escape(p.id)}" ${admin.assistants.settings?.default_pipeline === p.id ? "selected" : ""}>${this.escape(p.name)}</option>`).join("")}</select>
      <button id="save-assistant">${this.t("Запази", "Save")}</button>
      <h3>${this.t("Двуезични имена BG/EN", "Bilingual BG/EN names")}</h3>
      <div class="auditlist">${admin.rooms.rooms.map(room => `<div><strong>${this.escape(room.name)}</strong><input data-translation-room-bg="${this.escape(room.id)}" placeholder="Български" value="${this.escape(admin.rooms.translations?.rooms?.[room.id]?.bg || "")}"/><input data-translation-room-en="${this.escape(room.id)}" placeholder="English" value="${this.escape(admin.rooms.translations?.rooms?.[room.id]?.en || "")}"/><button data-translation-save-room="${this.escape(room.id)}">Save BG/EN</button></div>`).join("")}</div>
      <h3>${this.t("Персонализация на устройствата", "Device customization")}</h3>
      <div class="auditlist" style="max-height:380px">${(admin.rooms.entities || []).map(e => { const p = admin.rooms.device_profiles?.[e.entity_id] || {}; return `<details data-editor-key="device:${this.escape(e.entity_id)}"><summary>${this.escape(e.name)} (${this.escape(e.entity_id)})</summary>
        <input data-translation-entity-bg="${this.escape(e.entity_id)}" placeholder="Име на български" value="${this.escape(admin.rooms.translations?.entities?.[e.entity_id]?.bg || "")}"/>
        <input data-translation-entity-en="${this.escape(e.entity_id)}" placeholder="Name in English" value="${this.escape(admin.rooms.translations?.entities?.[e.entity_id]?.en || "")}"/>
        <button data-translation-save-entity="${this.escape(e.entity_id)}">Save BG/EN</button>
        <input data-profile-name="${this.escape(e.entity_id)}" placeholder="Display name" value="${this.escape(p.name || "")}"/>
        <input data-profile-icon="${this.escape(e.entity_id)}" placeholder="mdi:lightbulb" value="${this.escape(p.icon || "")}"/>
        <select data-profile-layout="${this.escape(e.entity_id)}">${["info","compact","expanded"].map(v => `<option value="${v}" ${p.layout === v ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select data-profile-area="${this.escape(e.entity_id)}"><option value="">${this.t("Автоматична стая", "Automatic room")}</option>${admin.rooms.rooms.map(room => `<option value="${this.escape(room.id)}" ${p.area_id === room.id ? "selected" : ""}>${this.escape(room.name)}</option>`).join("")}</select>
        <input data-profile-users="${this.escape(e.entity_id)}" placeholder="HA user IDs (comma separated)" value="${this.escape((p.user_ids || []).join(","))}"/>
        <input data-profile-controls="${this.escape(e.entity_id)}" placeholder="Controls (comma separated)" value="${this.escape((p.controls || []).join(","))}"/>
        <button data-profile-save="${this.escape(e.entity_id)}">${this.t("Запази устройството", "Save device")}</button></details>`; }).join("")}</div>
      <h3>${this.t("Видимост на устройствата", "Device visibility")}</h3>
      <div class="auditlist" style="max-height:330px">${(admin.rooms.entities || []).map(e => `<div style="padding:6px 0"><span>${this.escape(e.name)} — ${this.escape(e.entity_id)} · ${this.escape(e.reason || (e.included ? "included" : "unknown"))} ${e.area_id ? "· " + this.escape(e.area_id) : ""}</span>
        <select data-visibility="${this.escape(e.entity_id)}" ${e.disabled || e.hidden ? "disabled" : ""}>
        ${["default","include","exclude"].map(v => `<option value="${v}" ${(admin.rooms.visibility?.[e.entity_id] || "default") === v ? "selected" : ""}>${this.escape(v)}</option>`).join("")}</select></div>`).join("")}</div>
      <p class="muted">${this.t("Include показва активни неназначени устройства във виртуална стая. За постоянна стая използвайте Device customization. Деактивираните и скритите устройства остават изключени.", "Include displays active unassigned entities in a virtual room. For a permanent room use Device customization. Disabled and hidden entities remain excluded.")}</p>
      </details>` : "";
    const auditText = audit
      ? `<details class="audit"><summary>${this.t("Диагностика на откриването", "Discovery diagnostics")}</summary>
          <p>${this.t("Разпознати", "Included")}: ${Number(reasons.included || 0)} ·
          ${this.t("Без стая", "Unassigned")}: ${Number(reasons.unassigned || 0)} ·
          ${this.t("Неподдържан тип", "Unsupported domain")}: ${Number(reasons.unsupported_domain || 0)} ·
          ${this.t("Скрити", "Hidden")}: ${Number(reasons.hidden || 0)} ·
          ${this.t("Изключени", "Disabled")}: ${Number(reasons.disabled || 0)} ·
          ${this.t("Извън избраните стаи", "Outside chosen rooms")}: ${Number(reasons.outside_selected_rooms || 0)}</p>
          <div class="auditlist">${(audit.excluded_sample || []).slice(0, 50).map(x =>
              `<div>${this.escape(x.entity_id)} — ${this.escape(x.reason)}</div>`
            ).join("")}</div>
        </details>`
      : "";
    if (this._selectedRoom && !rooms.some(x => x.id === this._selectedRoom)) this._selectedRoom = "";

    // v7.1.1 premium shell: every tile is generated from the permission-scoped
    // model and active HA state. Historical Dunav entity IDs are never used.
    const visible = new Map(items.map(x => [x.entity_id, x]));
    const sections = (this._panelModel?.sections || []).map(room => ({
      ...room, cards: room.cards.filter(card => visible.has(card.entity_id))
    }));
    const allCards = sections.flatMap(room => room.cards.map(card => ({
      ...card, roomId: room.id, roomName: room.name
    })));
    const byDomain = domain => allCards.filter(card => card.domain === domain);
    const lightCards = byDomain("light");
    const climates = byDomain("climate");
    const statusCards = allCards.filter(card => ["sensor","binary_sensor"].includes(card.domain));
    const lightOn = lightCards.filter(card => this._hass?.states?.[card.entity_id]?.state === "on").length;
    const offline = allCards.filter(card =>
      ["unavailable","unknown"].includes(this._hass?.states?.[card.entity_id]?.state)
    ).length;
    const isAdmin = !!admin;
    const nav = [
      ["home", "Начало", "Home", "⌂"],
      ["rooms", "Помещения", "Rooms", "▦"],
      ["climate", "Климат", "Climate", "◉"],
      ["lighting", "Осветление", "Lighting", "✧"],
      ["devices", "Устройства", "Devices", "◫"],
      ["scenes", "Сцени", "Scenes", "▷"],
      ["insights", "Статистика", "Insights", "⌁"],
      ["ai", "AI център", "AI center", "✦"],
      ["system", "Система", "System", "▥"],
      ["hub", "Home Hub", "Home Hub", "◇"],
      ["memory", "Памет", "Memory", "◇"],
      ["settings", "Настройки", "Settings", "⚙"],
    ];
    if (!nav.some(n => n[0] === this._view)) this._view = "home";
    const page = nav.find(n => n[0] === this._view);
    const can = (card, key) => {
      const state = this._hass?.states?.[card.entity_id];
      return !!state && !["unknown", "unavailable"].includes(state.state) &&
        controllable.has(card.entity_id) && (card.controls || []).includes(key);
    };
    const ent = card => this._hass?.states?.[card.entity_id];
    const online = card => !!ent(card) && !["unavailable","unknown"].includes(ent(card).state);
    const friendlyState = card => {
      const state = ent(card);
      if (!state || state.state === "unavailable" || state.state === "unknown") return "—";
      const unit = state.attributes?.unit_of_measurement || "";
      return this.escape(state.state + (unit ? " " + unit : ""));
    };
    const metric = (label, value, foot) => `<div class="v7-card"><div class="v7-stat-label">${this.escape(label)}</div><div class="v7-stat-val">${this.escape(value)}</div><div class="v7-stat-foot">${this.escape(foot)}</div></div>`;
    const sectionTitle = (name, sub = "") => `<div class="v7-section-head"><h2>${this.escape(name)}</h2><span>${this.escape(sub)}</span></div>`;
    const oneCard = card => {
      const state = ent(card);
      if (!state) return "";
      const icons = {light:"✧",switch:"⏼",fan:"◈",climate:"◉",sensor:"◫",
        binary_sensor:"◫",lock:"⌑",media_player:"▷",cover:"▤"};
      const allowed = online(card) && controllable.has(card.entity_id) ? card.controls || [] : [];
      const actions = [];
      if (allowed.includes("toggle") && ["light","switch","fan"].includes(card.domain))
        actions.push(`<button class="v7-action" data-action="toggle" data-id="${this.escape(card.entity_id)}">${this.t("Включи / изключи", "Toggle")}</button>`);
      if (allowed.includes("temperature") && card.domain === "climate")
        actions.push(`<button class="v7-action" data-action="temperature-down" data-id="${this.escape(card.entity_id)}">−1°C</button><button class="v7-action" data-action="temperature-up" data-id="${this.escape(card.entity_id)}">+1°C</button>`);
      if (allowed.some(x => !["toggle","temperature"].includes(x)))
        actions.push(`<button class="v7-action subtle" data-action="details" data-id="${this.escape(card.entity_id)}">${this.t("Контроли", "Controls")}</button>`);
      return `<article class="v7-card v7-entity ${card.layout === "info" ? "info" : ""}">
        <div class="v7-entity-icon">${icons[card.domain] || "◫"}</div>
        <h3>${this.escape(card.name)}</h3>
        <div class="v7-entity-value">${friendlyState(card)}</div>
        <div class="v7-entity-identifier">${this.escape(card.entity_id)}</div>
        ${actions.length ? `<div class="v7-actions">${actions.join("")}</div>` : ""}
      </article>`;
    };
    const cardGrid = (cards, emptyLabel) => cards.length
      ? `<div class="v7-grid">${cards.map(oneCard).join("")}</div>`
      : `<div class="v7-empty">${this.escape(emptyLabel)}</div>`;
    const roomCards = () => `<div class="v7-room-grid">${sections.map(room =>
      `<button class="v7-room ${this._selectedRoom === room.id ? "active" : ""}" data-room="${this.escape(room.id)}" data-room-go="${this.escape(room.id)}">
        <span class="v7-room-icon">⌂</span><span class="v7-room-name">${this.escape(room.name)}</span>
        <span class="v7-room-count">${room.cards.length} ${this.t("устройства", "entities")}</span>
      </button>`
    ).join("")}</div>`;
    const climateWidget = (card, summaryOnly = false) => {
      if (!card) return `<div class="v7-card v7-climate"><div class="v7-card-title">◉ ${this.t("Климат", "Climate")}</div><div class="v7-empty">${this.t("Няма климатично устройство", "No climate device")}</div></div>`;
      const state = ent(card);
      const attrs = state?.attributes || {};
      const target = Number(attrs.temperature);
      const current = Number(attrs.current_temperature);
      const showTarget = attrs.temperature !== undefined && attrs.temperature !== null && Number.isFinite(target);
      const showCurrent = attrs.current_temperature !== undefined && attrs.current_temperature !== null && Number.isFinite(current);
      return `<section class="v7-card v7-climate ${summaryOnly ? "v7-climate-summary" : ""}">
        <div class="v7-card-title">◉ ${this.escape(card.name)}</div>
        <div class="v7-climate-value">${showCurrent ? this.escape(current.toFixed(1)) : (showTarget ? this.escape(target.toFixed(0)) : "—")}<span class="v7-value-suffix">°C</span></div>
        <div class="v7-climate-meta">${this.t("Зададена температура", "Target temperature")}: ${showTarget ? this.escape(target.toFixed(0)) + "°C" : "—"} · ${this.escape(state?.state || "unavailable")}</div>
        <div class="v7-actions">
          ${!summaryOnly && can(card, "temperature") ? `<button class="v7-action" data-action="temperature-down" data-id="${this.escape(card.entity_id)}">−1°C</button>
          <button class="v7-action" data-action="temperature-up" data-id="${this.escape(card.entity_id)}">+1°C</button>` : ""}
          ${!summaryOnly && online(card) && controllable.has(card.entity_id) && (card.controls || []).length
            ? `<button class="v7-action subtle" data-action="details" data-id="${this.escape(card.entity_id)}">${this.t("Разширен контрол", "Advanced controls")}</button>`
            : ""}
          ${summaryOnly ? `<button class="v7-action subtle" data-view="climate">${this.t("Отвори климатичния център", "Open climate center")}</button>` : ""}
        </div>
      </section>`;
    };
    const quickLights = () => `<section class="v7-card">
      <div class="v7-card-title">✧ ${this.t("Бързо осветление", "Quick lighting")}</div>
      ${lightCards.length ? lightCards.filter(card => {
        const modes = ent(card)?.attributes?.supported_color_modes || [];
        return !modes.some(mode => ["rgb","rgbw","rgbww","hs","xy"].includes(mode));
      }).slice(0,6).map(card => {
        const on = ent(card)?.state === "on";
        return `<div class="v7-light-tile"><div><span class="v7-state-dot ${on ? "on" : ""}"></span><span class="v7-light-name">${this.escape(card.name)}</span></div>
          ${can(card,"toggle") ? `<button class="v7-action subtle" data-action="toggle" data-id="${this.escape(card.entity_id)}">${on ? this.t("Изключи","Off") : this.t("Включи","On")}</button>` : `<span class="v7-muted">${on ? "ON" : "OFF"}</span>`}
        </div>`;
      }).join("") : `<div class="v7-empty">${this.t("Няма осветление", "No lighting")}</div>`}
      <div class="v7-actions"><button class="v7-action subtle" data-view="lighting">${this.t("Всички светлини", "All lighting")}</button></div>
    </section>`;
    const lightingWidget = card => {
      const state = ent(card);
      const rgb = state?.attributes?.rgb_color;
      const rgbValid = Array.isArray(rgb) && rgb.length === 3 && rgb.every(v => Number.isInteger(v) && v>=0 && v<=255);
      const hex = rgbValid ? "#" + rgb.map(v=>v.toString(16).padStart(2,"0")).join("") : "#8fc4ff";
      const brightness = Number(state?.attributes?.brightness);
      const pct = Number.isFinite(brightness) ? Math.round(brightness * 100 / 255) : 0;
      const on = state?.state === "on";
      const modes = state?.attributes?.supported_color_modes || [];
      const rgbSupported = modes.some(m=>["rgb","rgbw","rgbww","hs","xy"].includes(m));
      return `<section class="v7-card">
        <div class="v7-card-title">✧ ${this.escape(card.name)}</div>
        <div class="v7-rgb"><span class="v7-color-dot" style="background:${hex}"></span><div><strong>${this.escape(on ? this.t("Включена","On") : this.t("Изключена","Off"))}</strong><div class="v7-muted">${this.escape(card.entity_id)}</div></div></div>
        <div class="v7-actions">
          ${can(card,"toggle") ? `<button class="v7-action" data-action="toggle" data-id="${this.escape(card.entity_id)}">${this.t("Включи / изключи","Toggle")}</button>` : ""}
          ${online(card) && controllable.has(card.entity_id) && (card.controls||[]).length ? `<button class="v7-action subtle" data-action="details" data-id="${this.escape(card.entity_id)}">${this.t("Повече","More")}</button>` : ""}
        </div>
        ${can(card,"brightness") && "brightness" in (state?.attributes||{}) ? `<div class="v7-control-item"><label>${this.t("Яркост","Brightness")}: ${pct}%</label><input class="v7-slider" type="range" min="1" max="100" value="${pct}" data-lightbrightness="${this.escape(card.entity_id)}" aria-label="${this.t("Яркост","Brightness")}"></div>` : ""}
        ${can(card,"color") && rgbSupported ? `<div class="v7-control-item"><label>${this.t("RGB цвят","RGB color")}</label><input class="v7-color-input" type="color" value="${hex}" data-lightcolor="${this.escape(card.entity_id)}" aria-label="${this.t("Цвят","Color")}"></div>` : ""}
      </section>`;
    };
    const runSections = roomsToDisplay => roomsToDisplay.map(room =>
      `${sectionTitle(room.name, room.cards.length + " " + this.t("устройства","entities"))}${cardGrid(room.cards,this.t("Няма устройства в стаята","No entities in room"))}`
    ).join("");
    const navButton = n => `<button type="button" data-view="${n[0]}" class="v7-navbtn ${this._view === n[0] ? "active" : ""}" ${this._view === n[0] ? 'aria-current="page"' : ""}><span class="v7-ico">${n[3]}</span><span class="v7-nav-text">${this.t(n[1],n[2])}</span></button>`;
    const statusText = this._mode === "stevora"
      ? this.t("Синхронизацията с Home Assistant е активна", "Home Assistant synchronization active")
      : this.t("Manifest не е достъпен — управлението е изключено", "Manifest unavailable — controls disabled");
    const stats = `<div class="v7-stats">
      ${metric(this.t("Помещения","Rooms"),String(rooms.length),this.t("Автоматично открити","Auto-discovered"))}
      ${metric(this.t("Устройства","Entities"),String(allCards.length),this.t("Видими за акаунта","Visible to this account"))}
      ${metric(this.t("Включени светлини","Lights on"),String(lightOn),lightCards.length+" "+this.t("общо","total"))}
      ${metric(this.t("Недостъпни","Unavailable"),String(offline),this.t("Текущо състояние","Current state"))}
    </div>`;

    const hubStatus = this._hub?.status;
    const hubActive = hubStatus?.status === "active";
    const hubMetrics = hubStatus?.metrics || {};
    const hubHistory = this._hub?.history?.events || [];
    const hubAlerts = this._hub?.history?.notifications || [];
    const hubScenes = this._hub?.scenes?.items || [];
    const hubConfig = this._hub?.settings;
    const hubEventList = hubHistory.length
      ? '<div class="v7-hub-events">' + hubHistory.slice(-30).reverse().map(event =>
          '<div class="v7-mini-pair"><span class="v7-muted">' + this.escape(event.kind) +
          '</span><strong>' + this.escape(event.entity_id) +
          '</strong><span class="v7-muted">' + this.escape(event.at) + '</span></div>').join("") + '</div>'
      : '<div class="v7-empty">' + this.t("Няма регистрирани събития","No events recorded") + '</div>';
    const hubAlertList = hubAlerts.length
      ? '<div class="v7-hub-events">' + hubAlerts.slice(-6).reverse().map(event =>
          '<div class="v7-mini-pair"><span class="v7-muted">' + this.escape(event.kind) +
          '</span><strong>' + this.escape(event.entity_id) + '</strong></div>').join("") + '</div>'
      : '<p class="v7-muted">' + this.t("Няма локални предупреждения","No local alerts") + '</p>';
    const hubCard = '<section class="v7-card"><div class="v7-card-title">◇ STEVORA HOME HUB</div>' +
      '<div class="v7-mini-pair"><span>Status</span><strong>' +
      this.escape(hubStatus?.status || this._manifest?.modules?.home_hub?.status || "unavailable") + '</strong></div>' +
      '<div class="v7-mini-pair"><span>Version</span><strong>' + this.escape(hubStatus?.hub_version || "—") + '</strong></div>' +
      '<div class="v7-mini-pair"><span>Entities</span><strong>' + this.escape(hubMetrics.visible_entities ?? "—") + '</strong></div>' +
      '<div class="v7-mini-pair"><span>Unavailable</span><strong>' + this.escape(hubMetrics.unavailable_entities ?? "—") + '</strong></div>' +
      '<div class="v7-mini-pair"><span>Alerts</span><strong>' + this.escape(hubMetrics.notifications ?? "—") + '</strong></div>' +
      '<div class="v7-mini-pair"><span>' + this.t("Обновено","Last updated") +
      '</span><strong>' + this.escape(this._hubLastUpdated || "—") + '</strong></div>' +
      '<div class="v7-actions">' +
      (this._view === "hub"
        ? '<button type="button" class="v7-action subtle" data-hub-refresh="1" ' +
          (this._hubRefreshing ? 'disabled' : '') + '>' +
          (this._hubRefreshing
            ? this.t("Обновяване…","Refreshing…")
            : this.t("Обнови данните","Refresh Hub data")) + '</button>'
        : '<button type="button" class="v7-action subtle" data-view="hub">' +
          this.t("Отвори Home Hub","Open Home Hub") + '</button>') +
      '</div>' +
      (this._hubError ? '<div class="v7-banner">' + this.escape(this._hubError) + '</div>' : '') + '</section>';
    const hubOptions = isAdmin && hubConfig
      ? '<section class="v7-card"><div class="v7-card-title">⚙ Home Hub settings</div>' +
        [["hub-track","track_events","Track events"],["hub-notify","notifications_enabled","Local alerts"],
         ["hub-unavailable","notify_unavailable","Unavailable alerts"],["hub-recovered","notify_recovered","Recovered alerts"]]
          .map(([id,key,label]) => '<label class="v7-hub-option"><input type="checkbox" id="' + id + '" ' +
            (hubConfig[key] ? "checked" : "") + '/> ' + label + '</label>').join("") +
        '<div class="v7-actions"><button data-hub-save="1" class="v7-action">' +
        this.t("Запази","Save") + '</button></div></section>'
      : '';
    const hubSceneList = hubScenes.filter(item => item.domain === "scene").map(item =>
        '<div class="v7-mini-pair"><span>' + this.escape(item.name) + '</span>' +
        (item.action_allowed && !["unavailable","unknown"].includes(item.state)
          ? '<button class="v7-action subtle" data-hub-scene="' + this.escape(item.entity_id) + '">' +
            this.t("Активирай","Activate") + '</button>' : '') + '</div>').join("");
    const hubAutomationList = hubScenes.filter(item => item.domain !== "scene").map(item =>
        '<div class="v7-mini-pair"><span>' + this.escape(item.name) +
        '</span><strong>' + this.escape(item.state) + '</strong></div>').join("");
    let content = "";
    if (this._view === "home") {
      content = `<section class="v7-hero">
        <div><span class="v7-chip">STEVORA · HOME PANEL 7.1.1</span><h2>${this.t("Твоят интелигентен дом","Your intelligent home")}</h2>
          <p>${this.escape(statusText)}</p><div class="v7-actions"><button class="v7-action" data-view="rooms">${this.t("Към помещенията","Explore rooms")}</button>
          <button class="v7-action subtle" data-view="system">${this.t("Състояние на системата","System status")}</button></div></div>
        <div class="v7-hero-right"><div class="v7-hero-small">${this.t("Активни устройства","Available devices")}</div><div class="v7-hero-big">${Math.max(0,allCards.length-offline)} / ${allCards.length}</div>
          <div class="v7-hero-small">${this.t("Свързани с този дом","Connected to this home")}</div></div>
      </section>${stats}
      ${sectionTitle(this.t("Контролен център","Command center"),this.t("Реални Home Assistant устройства","Real Home Assistant entities"))}
      <div class="v7-two">${climateWidget(climates[0],true)}${quickLights()}</div>
      ${sectionTitle(this.t("Помещения","Rooms"))}${roomCards()}
      ${sectionTitle(this.t("Информация от сензорите","Sensor insights"))}${cardGrid(statusCards.slice(0,4),this.t("Няма налични сензори","No sensors"))}`;
    } else if (this._view === "rooms") {
      content = `${sectionTitle(this.t("Твоите помещения","Your rooms"))}${roomCards()}
        ${sectionTitle(this._selectedRoom ? this.t("Избрана стая","Selected room") : this.t("Всички помещения","All rooms"))}
        ${runSections(sections.filter(r=>!this._selectedRoom||r.id===this._selectedRoom))}`;
    } else if (this._view === "climate") {
      content = `${sectionTitle(this.t("Климатичен център","Climate center"),climates.length+" "+this.t("системи","systems"))}
        ${climates.length ? `<div class="v7-grid">${climates.map(climateWidget).join("")}</div>` : `<div class="v7-empty">${this.t("Няма открити климатични устройства","No climate entities discovered")}</div>`}`;
    } else if (this._view === "lighting") {
      content = `${sectionTitle(this.t("Осветление и RGB","Lighting and RGB"),lightOn+" / "+lightCards.length+" ON")}
        ${lightCards.length ? `<div class="v7-grid">${lightCards.map(lightingWidget).join("")}</div>` : `<div class="v7-empty">${this.t("Няма светлини","No lights")}</div>`}`;
    } else if (this._view === "devices") {
      content = `${sectionTitle(this.t("Всички устройства","All devices"),allCards.length+" "+this.t("устройства","entities"))}
        ${cardGrid(allCards,this.t("Няма открити устройства","No entities discovered"))}`;
    } else if (this._view === "scenes") {
      content = sectionTitle(this.t("Сцени и автоматизации","Scenes and automations")) +
        '<div class="v7-two"><section class="v7-card"><div class="v7-card-title">▷ ' +
        this.t("Сцени","Scenes") + '</div>' +
        (hubActive ? (hubSceneList || '<p class="v7-muted">' +
          this.t("Няма достъпни сцени","No accessible scenes") + '</p>') :
          '<div class="v7-banner">' + this.t("Home Hub не е активен","Home Hub not active") + '</div>') +
        '</section><section class="v7-card"><div class="v7-card-title">⚙ ' +
        this.t("Автоматизации и скриптове","Automations and scripts") + '</div>' +
        (hubAutomationList || '<p class="v7-muted">' +
          this.t("Няма достъпни автоматизации","No accessible automations") + '</p>') +
        '<p class="v7-muted">' +
        this.t("Промените се правят през Home Assistant с оригиналните права.","Use Home Assistant to edit with original permissions.") +
        '</p>' +
        (isAdmin ? '<a class="v7-action" href="/config/automation/dashboard">' +
          this.t("Отвори редактора","Open editor") + '</a>' : '') +
        '</section></div>';
    } else if (this._view === "insights") {
      content = `${sectionTitle(this.t("Информация и статистика","Insights and statistics"),this.t("Данни в реално време","Live data"))}
        ${stats}${sectionTitle(this.t("Сензорни показатели","Sensor readings"))}
        ${cardGrid(statusCards, this.t("Няма видими сензори","No visible sensors"))}
        ${hubActive ? sectionTitle(this.t("Последни събития","Recent events")) + hubEventList : ""}
        <div class="v7-banner ok">${this.t("Историческите графики изискват отделно Recorder разрешение; тук не се показват измислени измервания.","Historical charts require verified Recorder access; no synthetic measurements are shown.")}</div>`;
    } else if (this._view === "hub") {
      content = sectionTitle(this.t("STEVORA Home Hub","STEVORA Home Hub"),"1.0.0 beta") +
        '<div class="v7-two">' + hubCard +
        '<section class="v7-card"><div class="v7-card-title">⚠ ' +
        this.t("Локални известия","Local alerts") + '</div>' + hubAlertList + '</section></div>' +
        sectionTitle(this.t("Журнал на събитията","Recent event history")) +
        (hubActive ? hubEventList : '<div class="v7-banner">' +
          this.t("Home Hub е изключен или недостъпен","Home Hub is disabled or unavailable") + '</div>') +
        hubOptions + '<div class="v7-banner ok">' +
        this.t("Данните и известията са локални. Push известия и автоматично управление не се инсталират.",
          "Data and alerts are local. No push notifications or automatic device actions are installed.") + '</div>';
    } else if (this._view === "memory") {
      const module = this._manifest?.modules?.memory_sync;
      content = `${sectionTitle(this.t("STEVORA Memory Manager","STEVORA Memory Manager"))}
        <section class="v7-card"><div class="v7-card-title">◇ MEMORY SYNC</div>
        <div class="v7-banner">${this.escape(module?.status || "not_included")}</div>
        <p class="v7-muted">${this.t("Паметта е отделен продукт; интеграцията показва статус, без да има достъп до чужди разговори или токени.","Memory is a separate product. This panel shows its status without accessing private conversations or tokens.")}</p>
        </section>`;
    } else if (this._view === "ai") {
      const module = this._manifest?.modules?.hey_stevora;
      const pipeline = admin?.assistants?.pipelines?.find(p=>p.id===admin?.assistants?.settings?.default_pipeline)?.name;
      content = `${sectionTitle(this.t("AI и асистенти","AI and assistants"))}<div class="v7-two">
        <section class="v7-card"><div class="v7-card-title">✦ HEY STEVORA</div>
          <div class="v7-banner">${module?.bundled
            ? this.t("Гласовият модул е включен","Voice module is included")
            : this.t("Гласовият модул не е част от тази интеграция. Използвай отделната инсталация на Hey Stevora.","Voice module is not bundled with this integration; use the separate Hey Stevora app.")}</div></section>
        <section class="v7-card"><div class="v7-card-title">◉ HOME ASSISTANT ASSIST</div>
          <div class="v7-entity-value">${this.escape(pipeline || this.t("Стандартен асистент","Default assistant"))}</div>
          <div class="v7-muted">${this.t("Изборът за администратори е в Настройки","Admin setup is in Settings")}</div></section>
      </div>`;
    } else if (this._view === "system") {
      const modules = Object.entries(this._manifest?.modules || {});
      content = `${sectionTitle(this.t("Здраве на системата","System health"))}${stats}
        <div class="v7-two"><section class="v7-card"><div class="v7-card-title">▥ STEVORA CORE</div>
          <div class="v7-mini-pair"><span>Manifest</span><strong>${this.escape(this._manifest?.schema_version || "—")}</strong></div>
          <div class="v7-mini-pair"><span>Panel</span><strong>7.1.1</strong></div>
          <div class="v7-mini-pair"><span>Revision</span><strong>${this.escape(this._manifest?.revision ?? "—")}</strong></div>
          <div class="v7-mini-pair"><span>Installation</span><strong>${this.escape(this._manifest?.installation_id || "—")}</strong></div>
        </section><section class="v7-card"><div class="v7-card-title">▦ ${this.t("Модули","Modules")}</div>
          ${modules.length ? modules.map(([key,val]) => `<div class="v7-mini-pair"><span>${this.escape(key.replaceAll("_"," "))}</span><strong>${this.escape(val.status||"unknown")}</strong></div>`).join("") : `<p class="v7-muted">${this.t("Няма данни за модулите","No module data")}</p>`}
        </section></div><div class="v7-two">${hubCard}<section class="v7-card"><div class="v7-card-title">⚠ ${this.t("Системни известия","System alerts")}</div>${hubAlertList}</section></div>${isAdmin ? auditText : ""}`;
    } else {
      content = `${sectionTitle(this.t("Настройки и мениджъри","Settings and managers"))}
        <div class="v7-filter">
          <button data-view="scenes">${this.t("Сцени","Scenes")}</button>
          <button data-view="insights">${this.t("Статистика","Insights")}</button>
          <button data-view="memory">${this.t("Памет","Memory")}</button>
           <button data-view="hub">HOME HUB</button>
          <button data-view="ai">AI Center</button>
        </div>
        <section class="v7-card"><div class="v7-card-title">⚙ ${this.t("Предпочитания","Preferences")}</div>
          <div class="v7-mini-pair"><span>${this.t("Режим за стенен панел","Wall panel mode")}</span>
            <button class="v7-action" data-wall-toggle="1">${this._wall ? this.t("Изключи","Disable") : this.t("Включи","Enable")}</button></div>
          <div class="v7-mini-pair"><span>${this.t("Език","Language")}</span><span>BG / EN</span></div>
          <div class="v7-mini-pair"><span>${this.t("Заредена версия","Loaded version")}</span><strong>7.1.1</strong></div>
        </section><div class="v7-manager">${isAdmin ? adminPanel : `<div class="v7-banner">${this.t("Мениджърите са достъпни само за администратори","Managers are available to administrators only")}</div>`}</div>`;
    }
    const bottomNav = nav.filter(n=>["home","rooms","climate","lighting","settings"].includes(n[0]));
    this.shadowRoot.innerHTML = `
      <style>@import url("/stevora_static/stevora-premium.css?v=711-hub2");</style>
      <div class="v7-shell ${this._wall ? "v7-wall" : ""}">
        <aside class="v7-side"><div class="v7-brand"><div class="v7-brand-mark"><svg viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true"><path d="M24 7H12c-4 0-6 2.5-6 5s2 4 6 4h7c5 0 7 2 7 5s-2.5 5-6.5 5H7" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="M23 7h4 M5 26h4" stroke="white" stroke-width="3" stroke-linecap="round"/></svg></div>
          <div class="v7-brand-copy"><div class="v7-wordmark">STEVORA</div><div class="v7-brand-sub">HOME SYSTEM</div></div></div>
          <div class="v7-eyebrow">NAVIGATION</div>
          <nav class="v7-nav">${nav.map(navButton).join("")}</nav>
          <div class="v7-side-foot"><span class="v7-live-dot ${this._mode==="stevora"?"":"off"}"></span>${this.escape(statusText)}<p>STEVORA · v7.1.1</p></div>
        </aside>
        <main class="v7-main"><div class="v7-content">
          <header class="v7-header"><div><div class="v7-eyebrow" style="margin:0">STEVORA ECOSYSTEM</div>
            <h1 class="v7-head-title">${this.t(page[1],page[2])}</h1><div class="v7-subtitle">${this.escape(statusText)}</div></div>
            <div class="v7-tools"><span class="v7-chip">${this._mode==="stevora" ? "● LIVE" : "● OFFLINE"}</span>
              <select id="language" aria-label="Language"><option value="bg" ${this._language==="bg"?"selected":""}>BG</option><option value="en" ${this._language==="en"?"selected":""}>EN</option></select>
              <select id="room" aria-label="Room"><option value="">${this.t("Всички помещения","All rooms")}</option>${rooms.map(r=>`<option value="${this.escape(r.id)}" ${this._selectedRoom===r.id?"selected":""}>${this.escape(r.name)}</option>`).join("")}</select>
              <button id="refresh">${this.t("Обнови","Refresh")}</button></div>
          </header>
          ${this._mode === "stevora" ? "" : `<div class="v7-banner">${this.t("Manifest не е зареден — управлението е блокирано","Manifest not loaded — device controls are disabled")}</div>`}
          ${this._error ? `<div class="v7-banner">${this.escape(this._error)}</div>` : ""}
          ${this._adminError ? `<div class="v7-banner">${this.escape(this._adminError)}</div>` : ""}
          ${content}
          <footer class="v7-footer"><span>STEVORA HOME PANEL · 7.1.1</span><span>${this.t("Работи с текущия Home Assistant","Powered by this Home Assistant")}</span></footer>
        </div></main>
        <nav class="v7-bottom" aria-label="STEVORA navigation">${bottomNav.map(n=>`<button data-view="${n[0]}" class="${this._view === n[0] ? "active" : ""}"><span>${n[3]}</span><span>${this.t(n[1],n[2])}</span></button>`).join("")}</nav>
      </div>`;
    this.restoreUiState(uiSnapshot);
    this._renderedView = this._view;
    this._renderedInstallation = this._manifest?.installation_id || null;
    this._renderedUser = this._hass?.user?.id || null;
    this._resetEditorValues = false;
    this.shadowRoot.getElementById("refresh").onclick = () => this.refresh();
    const assistantSave = this.shadowRoot.getElementById("save-assistant");
    if (assistantSave) assistantSave.onclick = async () => {
      try {
        await this._hass.callWS({type:"stevora/admin/assistants/update",
          expected_revision:this._admin.assistants.revision,
          default_pipeline:this.shadowRoot.getElementById("admin-assistant").value || null,
          user_pipelines:this._admin.assistants.settings?.user_pipelines || {}});
        await this.refresh();
      } catch(error) { this._adminError = String(error?.message || error); this.render(); }
    };
    for (const kind of ["room", "entity"]) {
      this.shadowRoot.querySelectorAll("[data-translation-save-" + kind + "]").forEach(button => button.onclick = async () => {
        const id = button.dataset[kind === "room" ? "translationSaveRoom" : "translationSaveEntity"];
        const read = locale => this.shadowRoot.querySelector('[data-translation-' + kind + '-' + locale + '="' + CSS.escape(id) + '"]')?.value || "";
        try {
          await this._hass.callWS({type:"stevora/admin/translations/update",
            expected_revision:this._admin.rooms.revision,
            rooms:kind === "room" ? {[id]:{bg:read("bg"),en:read("en")}} : {},
            entities:kind === "entity" ? {[id]:{bg:read("bg"),en:read("en")}} : {}});
          await this.refresh();
        } catch(error) {this._adminError=String(error?.message || error);this.render();}
      });
    }
    this.shadowRoot.querySelectorAll("[data-profile-save]").forEach(button => button.onclick = async () => {
      const id = button.dataset.profileSave;
      const field = key => this.shadowRoot.querySelector('[data-profile-' + key + '="' + CSS.escape(id) + '"]')?.value || "";
      const profile = {
        name:field("name"), icon:field("icon"), layout:field("layout") || "compact",
        area_id:field("area") || null,
        user_ids:field("users").split(",").map(x=>x.trim()).filter(Boolean),
      };
      const controls = field("controls").split(",").map(x=>x.trim()).filter(Boolean);
      // Blank controls means native defaults; use Info layout for info-only.
      if (controls.length) profile.controls = controls;
      try {
        await this._hass.callWS({type:"stevora/admin/devices/update",
          expected_revision:this._admin.rooms.revision,profiles:{[id]:profile}});
        await this.refresh();
      } catch(error) { this._adminError = String(error?.message || error); this.render(); }
    });
    this.shadowRoot.querySelectorAll("[data-visibility]").forEach(select => select.onchange = async () => {
      try {
        await this._hass.callWS({type:"stevora/admin/rooms/update",
          expected_revision:this._admin.rooms.revision,
          entities:[{entity_id:select.dataset.visibility, visibility:select.value}]});
        await this.refresh();
      } catch(error) { this._adminError = String(error?.message || error); this.render(); }
    });
    this.shadowRoot.getElementById("language").onchange = e => { this._languageOverride = e.target.value; this._language = e.target.value; this.refresh(); };
    this.shadowRoot.getElementById("room").onchange = e => { this._selectedRoom = e.target.value; this._view = "rooms"; this.render(); };
    this.shadowRoot.querySelectorAll("[data-view]").forEach(button => button.onclick = () => {
      const view = button.dataset.view;
      if (["home","rooms","climate","lighting","devices","scenes","insights","ai","system","hub","memory","settings"].includes(view)) {
        this._view = view;
        this.render();
      }
    });
    this.shadowRoot.querySelectorAll("[data-room-go]").forEach(button => button.onclick = () => {
      const room = button.dataset.roomGo;
      if ((this._panelModel?.sections || []).some(section => section.id === room)) {
        this._selectedRoom = room;
        this._view = "rooms";
        this.render();
      }
    });
    this.shadowRoot.querySelectorAll("[data-wall-toggle]").forEach(button => button.onclick = () => {
      this._wall = !this._wall;
      this.render();
    });
    this.shadowRoot.querySelectorAll("[data-hub-refresh]").forEach(button => button.onclick = async () => {
      if (this._busy || this._hubRefreshing) return;
      this._hubRefreshing = true;
      this.render();
      try {
        await this.refresh();
      } finally {
        this._hubRefreshing = false;
        this.render();
      }
    });
    const hubSave = this.shadowRoot.querySelector("[data-hub-save]");
    if (hubSave) hubSave.onclick = async () => {
      if (!this._admin || !this._hub?.settings) return;
      const checkbox = id => !!this.shadowRoot.getElementById(id)?.checked;
      const settings = this._hub.settings;
      try {
        await this._hass.callWS({
          type:"stevora/hub/config/update",
          expected_revision:settings.revision,
          track_events:checkbox("hub-track"),
          notifications_enabled:checkbox("hub-notify"),
          notify_unavailable:checkbox("hub-unavailable"),
          notify_recovered:checkbox("hub-recovered"),
        });
        await this.refresh();
      } catch(error) {
        this._hubError = String(error?.message || error);
        this.render();
      }
    };
    // Hub exposes no privileged device-control proxy. Scene activations
    // are exclusively sent through the native HA service API and permissions.
    this.shadowRoot.querySelectorAll("[data-hub-scene]").forEach(button => button.onclick = async () => {
      const entity = button.dataset.hubScene;
      const scene = this._hub?.scenes?.items?.find(x => x.entity_id === entity);
      if (!scene || scene.domain !== "scene" || !scene.action_allowed ||
          !this._hass?.states?.[entity] ||
          ["unavailable","unknown"].includes(this._hass.states[entity].state)) return;
      try {
        await this._hass.callService("scene", "turn_on", {entity_id:entity});
        this._error = "";
      } catch(error) {
        this._error = String(error?.message || error);
        this.render();
      }
    });
    const canModifyLight = (id, control) => (
      this._mode === "stevora" &&
      this._manifest?.controllable_entities?.includes(id) &&
      (this._panelModel?.sections || []).some(section =>
        section.cards.some(card =>
          card.entity_id === id && card.domain === "light" && (card.controls || []).includes(control)
        )
      ) && !!this._hass?.states?.[id] &&
      !["unavailable","unknown"].includes(this._hass.states[id].state) &&
      !/back[ _-]?light|подсвет/i.test(id)
    );
    this.shadowRoot.querySelectorAll("[data-lightbrightness]").forEach(input => input.onchange = async () => {
      const id = input.dataset.lightbrightness;
      const percent = Number(input.value);
      if (!canModifyLight(id, "brightness") || !Number.isInteger(percent) || percent < 1 || percent > 100) return;
      try {
        await this._hass.callService("light", "turn_on", {entity_id:id, brightness_pct:percent});
        this._error = "";
      } catch (error) { this._error = String(error?.message || error); this.render(); }
    });
    this.shadowRoot.querySelectorAll("[data-lightcolor]").forEach(input => input.onchange = async () => {
      const id = input.dataset.lightcolor;
      const hex = String(input.value || "");
      if (!canModifyLight(id, "color") || !/^#[0-9a-f]{6}$/i.test(hex)) return;
      const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2), 16));
      try {
        await this._hass.callService("light", "turn_on", {entity_id:id, rgb_color:rgb});
        this._error = "";
      } catch (error) { this._error = String(error?.message || error); this.render(); }
    });
    this.shadowRoot.querySelectorAll("[data-action]").forEach(button => button.onclick = async () => {
      const entity = button.dataset.id;
      const state = this._hass?.states?.[entity];
      if (!state) return;
      const domain = entity.split(".")[0];
      try {
        if (button.dataset.action === "details") {
          this.dispatchEvent(new CustomEvent("hass-more-info", {detail:{entityId:entity}, bubbles:true, composed:true}));
        } else if (button.dataset.action === "toggle") {
          await this._hass.callService(domain, "toggle", { entity_id: entity });
        } else if (domain === "climate") {
          const current = Number(state.attributes.temperature);
          if (!Number.isFinite(current)) return;
          const offset = button.dataset.action === "temperature-up" ? 1 : -1;
          const next = current + offset;
          const min = Number(state.attributes?.min_temp);
          const max = Number(state.attributes?.max_temp);
          if (Number.isFinite(min) && state.attributes?.min_temp != null && next < min) return;
          if (Number.isFinite(max) && state.attributes?.max_temp != null && next > max) return;
          await this._hass.callService("climate", "set_temperature", { entity_id: entity, temperature: next });
        }
      } catch (error) {
        this._error = String(error?.message || error);
        this.render();
      }
    });
  }
}
if (!customElements.get("stevora-home-panel")) customElements.define("stevora-home-panel", StevoraHomePanel);
