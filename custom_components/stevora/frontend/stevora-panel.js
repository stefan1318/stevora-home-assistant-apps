/* STEVORA Home Panel — no external dependencies, local-first HA panel. */
class StevoraHomePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._manifest = null;
    this._panelModel = null;
    this._stateSignature = null;
    this._busy = false;
    this._error = "";
    this._mode = "auto";
    this._selectedRoom = "";
    this._language = "bg";
    this._languageOverride = null;
    this._admin = null;
    this._adminError = "";
  }

  set hass(value) {
    const old = this._hass;
    this._hass = value;
    if (!old && value) this.refresh();
    else if (value && this.isConnected) {
      const signature = Object.keys(value.states || {}).sort().join("|");
      if (this._stateSignature !== null && signature !== this._stateSignature) this.refresh();
      else this.render();
      this._stateSignature = signature;
    }
  }

  connectedCallback() { this.render(); }

  async refresh() {
    if (!this._hass || this._busy) return;
    this._busy = true;
    try {
      const locale = this._languageOverride || (this._hass?.language?.startsWith("bg") ? "bg" : "en");
      this._manifest = await this._hass.callWS({ type: "stevora/manifest", language: locale });
      this._panelModel = await this._hass.callWS({ type: "stevora/panel/generate", language: locale });
      if (this._panelModel?.installation_id !== this._manifest?.installation_id) throw new Error("Panel installation mismatch");
      this._language = this._manifest.preferred_language === "en" ? "en" : "bg";
      this._error = "";
      this._mode = "stevora";
      try {
        const [rooms, assistants] = await Promise.all([
          this._hass.callWS({type:"stevora/admin/rooms/get"}),
          this._hass.callWS({type:"stevora/admin/assistants/get"})
        ]);
        this._admin = {rooms, assistants};
        this._adminError = "";
      } catch (error) {
        this._admin = null;
        this._adminError = String(error?.message || error);
      }
    } catch (error) {
      this._manifest = null;
      this._panelModel = null;
      this._admin = null;
      this._mode = "native";
      this._error = String(error?.message || "");
    } finally {
      this._busy = false;
      this.render();
    }
  }

  t(bg, en) { return this._language === "bg" ? bg : en; }
  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
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
      if (/backlight/i.test(x.entity_id) || /backlight/i.test(x.attributes?.friendly_name || "")) return false;
      if (this._selectedRoom) {
        return this._manifest.entities.some(y => y.entity_id === x.entity_id && y.area_id === this._selectedRoom);
      }
      return true;
    });
  }

  render() {
    if (!this.shadowRoot) return;
    const items = this.inventory();
    const rooms = (this._panelModel?.sections || []).map(({id, name}) => ({id, name}));
    const controllable = new Set(this._manifest?.controllable_entities || []);
    const audit = this._manifest?.discovery_diagnostics || null;
    const reasons = audit?.counts || {};
    const admin = this._admin;
    const adminPanel = admin ? `<details class="audit"><summary>${this.t("STEVORA администраторски мениджъри", "STEVORA administrator managers")}</summary>
      <h3>${this.t("Основен асистент", "Default assistant")}</h3>
      <select id="admin-assistant"><option value="">${this.t("Без избор", "No selection")}</option>${(admin.assistants.pipelines || []).map(p => `<option value="${this.escape(p.id)}" ${admin.assistants.settings?.default_pipeline === p.id ? "selected" : ""}>${this.escape(p.name)}</option>`).join("")}</select>
      <button id="save-assistant">${this.t("Запази", "Save")}</button>
      <h3>${this.t("Двуезични имена BG/EN", "Bilingual BG/EN names")}</h3>
      <div class="auditlist">${admin.rooms.rooms.map(room => `<div><strong>${this.escape(room.name)}</strong><input data-translation-room-bg="${this.escape(room.id)}" placeholder="Български" value="${this.escape(admin.rooms.translations?.rooms?.[room.id]?.bg || "")}"/><input data-translation-room-en="${this.escape(room.id)}" placeholder="English" value="${this.escape(admin.rooms.translations?.rooms?.[room.id]?.en || "")}"/><button data-translation-save-room="${this.escape(room.id)}">Save BG/EN</button></div>`).join("")}</div>
      <h3>${this.t("Персонализация на устройствата", "Device customization")}</h3>
      <div class="auditlist" style="max-height:380px">${(admin.rooms.entities || []).map(e => { const p = admin.rooms.device_profiles?.[e.entity_id] || {}; return `<details><summary>${this.escape(e.name)} (${this.escape(e.entity_id)})</summary>
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
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;min-height:100%;background:#0c111b;color:#eef3fc;font:15px system-ui,sans-serif}
        *{box-sizing:border-box}main{max-width:1250px;margin:auto;padding:24px}
        header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}
        h1{font-size:26px;letter-spacing:2px;margin:0}small,.muted{color:#a6b3c8}
        .tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        button,select,input{background:#1a2536;color:#eef3fc;border:1px solid #33465f;border-radius:10px;padding:10px 13px;font:inherit}
        button{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #6bb6ff}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
        .room-section{margin:24px 0 30px}.room-title{font-size:18px;font-weight:650;margin:0 0 14px}
        article[data-layout="expanded"]{grid-column:span 2}article[data-layout="info"]{background:#101825}
        .device-icon{font-size:12px;color:#78b8ff;margin-bottom:9px}
        @media(max-width:600px){article[data-layout="expanded"]{grid-column:span 1}}
        article{background:#141d2b;border:1px solid #2b3a50;border-radius:17px;padding:18px;min-width:0}
        article h2{font-size:15px;margin:0 0 12px;overflow-wrap:anywhere}
        .state{font-size:22px;font-weight:650;overflow-wrap:anywhere}
        .meta{font-size:12px;color:#a6b3c8;margin-top:8px}
        .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .actions button{font-size:13px;padding:7px 10px}
        .status{margin:0 0 20px;color:#a6b3c8}
        .audit{background:#111d2c;border:1px solid #2b3a50;border-radius:12px;padding:12px;margin-bottom:18px;color:#9fb2c9}
        .audit summary{cursor:pointer;color:#eef3fc;font-weight:600}
        .audit p{font-size:13px;line-height:1.6}
        .auditlist{max-height:160px;overflow:auto;font-size:11px;overflow-wrap:anywhere}
        @media(max-width:600px){main{padding:14px}h1{font-size:22px}}
      </style>
      <main>
        <header><div><h1>STEVORA</h1><small>HOME PANEL v7.1.1 · AUTO</small></div>
        <div class="tools">
          <select id="language" aria-label="Language"><option value="bg" ${this._language === "bg" ? "selected" : ""}>BG</option><option value="en" ${this._language === "en" ? "selected" : ""}>EN</option></select>
          <select id="room" aria-label="Room"><option value="">${this.t("Всички помещения","All rooms")}</option>${rooms.map(x => `<option value="${this.escape(x.id)}" ${this._selectedRoom === x.id ? "selected" : ""}>${this.escape(x.name)}</option>`).join("")}</select>
          <button id="refresh">${this.t("Обнови","Refresh")}</button>
        </div></header>
        <p class="status">${this._mode === "stevora" ? this.t("STEVORA конфигурацията е заредена","STEVORA configuration loaded") : this.t("STEVORA Manifest е недостъпен — управлението е изключено","STEVORA manifest unavailable — controls disabled")} · ${items.length} ${this.t("устройства","entities")}</p>
        ${auditText}
        ${adminPanel}
        ${this._adminError ? `<p class="status">${this.escape(this._adminError)}</p>` : ""}
        ${(this._panelModel?.sections || []).filter(section => !this._selectedRoom || section.id === this._selectedRoom).map(section => {
          const visibleCards = section.cards.filter(card => items.some(item => item.entity_id === card.entity_id));
          if (!visibleCards.length) return "";
          return `<section class="room-section" data-room="${this.escape(section.id)}"><h2 class="room-title">${this.escape(section.name)}</h2><div class="grid">${visibleCards.map(card => {
            const item = this._hass?.states?.[card.entity_id];
            if (!item) return "";
            const canControl = controllable.has(card.entity_id);
            const allowedControls = canControl ? card.controls || [] : [];
            const buttons = [];
            if (allowedControls.includes("toggle") && ["light","switch","fan"].includes(card.domain)) {
              buttons.push(`<button data-action="toggle" data-id="${this.escape(card.entity_id)}">${this.t("Вкл./Изкл.","Toggle")}</button>`);
            }
            if (allowedControls.includes("temperature") && card.domain === "climate") {
              buttons.push(`<button data-action="temperature-down" data-id="${this.escape(card.entity_id)}">−1°C</button><button data-action="temperature-up" data-id="${this.escape(card.entity_id)}">+1°C</button>`);
            }
            // Other capability-specific actions open the HA more-info control,
            // preserving native supported-feature validation and HA permissions.
            if (allowedControls.some(x => !["toggle","temperature"].includes(x))) {
              buttons.push(`<button data-action="details" data-id="${this.escape(card.entity_id)}">${this.t("Контроли","Controls")}</button>`);
            }
            return `<article data-layout="${this.escape(card.layout)}"><div class="device-icon">${this.escape(card.icon)}</div><h2>${this.escape(card.name)}</h2><div class="state">${this.escape(item.state)} ${this.escape(item.attributes?.unit_of_measurement || "")}</div><div class="meta">${this.escape(card.entity_id)}</div>${buttons.length ? `<div class="actions">${buttons.join("")}</div>` : ""}</article>`;
          }).join("")}</div></section>`;
        }).join("")}
      </main>`;
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
        controls:field("controls").split(",").map(x=>x.trim()).filter(Boolean)
      };
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
    this.shadowRoot.getElementById("room").onchange = e => { this._selectedRoom = e.target.value; this.render(); };
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
          await this._hass.callService("climate", "set_temperature", { entity_id: entity, temperature: current + offset });
        }
      } catch (error) {
        this._error = String(error?.message || error);
      }
    });
  }
}
if (!customElements.get("stevora-home-panel")) customElements.define("stevora-home-panel", StevoraHomePanel);
