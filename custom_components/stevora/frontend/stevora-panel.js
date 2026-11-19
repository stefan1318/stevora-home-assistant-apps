/* STEVORA Home Panel — no external dependencies, local-first HA panel. */
class StevoraHomePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._manifest = null;
    this._busy = false;
    this._error = "";
    this._mode = "auto";
    this._selectedRoom = "";
    this._language = "bg";
  }

  set hass(value) {
    const old = this._hass;
    this._hass = value;
    if (!old && value) this.refresh();
    else if (value && this.isConnected) this.render();
  }

  connectedCallback() { this.render(); }

  async refresh() {
    if (!this._hass || this._busy) return;
    this._busy = true;
    try {
      this._manifest = await this._hass.callWS({ type: "stevora/manifest" });
      this._language = this._manifest.preferred_language === "en" ? "en" : "bg";
      this._error = "";
      this._mode = "stevora";
    } catch (error) {
      this._manifest = null;
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
    const allowed = new Set((this._manifest?.entities || []).map(x => x.entity_id));
    if (this._mode !== "stevora" || !this._manifest) return [];
    return states.filter(x => {
      const domain = x.entity_id.split(".")[0];
      if (!["climate", "light", "switch", "cover", "sensor", "binary_sensor", "fan", "media_player"].includes(domain)) return false;
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
    const rooms = this._manifest?.rooms || [];
    const controllable = new Set(this._manifest?.controllable_entities || []);
    const audit = this._manifest?.discovery_diagnostics || null;
    const reasons = audit?.counts || {};
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
        button,select{background:#1a2536;color:#eef3fc;border:1px solid #33465f;border-radius:10px;padding:10px 13px;font:inherit}
        button{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #6bb6ff}
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
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
        <header><div><h1>STEVORA</h1><small>HOME PANEL</small></div>
        <div class="tools">
          <select id="language" aria-label="Language"><option value="bg" ${this._language === "bg" ? "selected" : ""}>BG</option><option value="en" ${this._language === "en" ? "selected" : ""}>EN</option></select>
          <select id="room" aria-label="Room"><option value="">${this.t("Всички помещения","All rooms")}</option>${rooms.map(x => `<option value="${this.escape(x.id)}" ${this._selectedRoom === x.id ? "selected" : ""}>${this.escape(x.name)}</option>`).join("")}</select>
          <button id="refresh">${this.t("Обнови","Refresh")}</button>
        </div></header>
        <p class="status">${this._mode === "stevora" ? this.t("STEVORA конфигурацията е заредена","STEVORA configuration loaded") : this.t("STEVORA Manifest е недостъпен — управлението е изключено","STEVORA manifest unavailable — controls disabled")} · ${items.length} ${this.t("устройства","entities")}</p>
        ${auditText}
        <div class="grid">${items.map(item => {
          const domain = item.entity_id.split(".")[0];
          const controls = controllable.has(item.entity_id) && ["light","switch","fan"].includes(domain)
            ? `<div class="actions"><button data-action="toggle" data-id="${this.escape(item.entity_id)}">${this.t("Вкл./Изкл.","Toggle")}</button></div>` : "";
          const climate = controllable.has(item.entity_id) && domain === "climate"
            ? `<div class="actions"><button data-action="temperature-down" data-id="${this.escape(item.entity_id)}">−1°C</button><button data-action="temperature-up" data-id="${this.escape(item.entity_id)}">+1°C</button></div>` : "";
          return `<article><h2>${this.escape(item.attributes?.friendly_name || item.entity_id)}</h2><div class="state">${this.escape(item.state)} ${this.escape(item.attributes?.unit_of_measurement || "")}</div><div class="meta">${this.escape(item.entity_id)}</div>${controls}${climate}</article>`;
        }).join("")}</div>
      </main>`;
    this.shadowRoot.getElementById("refresh").onclick = () => this.refresh();
    this.shadowRoot.getElementById("language").onchange = e => { this._language = e.target.value; this.render(); };
    this.shadowRoot.getElementById("room").onchange = e => { this._selectedRoom = e.target.value; this.render(); };
    this.shadowRoot.querySelectorAll("[data-action]").forEach(button => button.onclick = async () => {
      const entity = button.dataset.id;
      const state = this._hass?.states?.[entity];
      if (!state) return;
      const domain = entity.split(".")[0];
      try {
        if (button.dataset.action === "toggle") {
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
