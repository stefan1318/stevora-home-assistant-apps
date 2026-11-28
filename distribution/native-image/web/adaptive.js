"use strict";
const StevoraAdaptive = (() => {
  const API = "stevora/os/v1/capabilities";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, key =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[key]);
  const labels = {
    turn_on:["Turn on","Включи"], turn_off:["Turn off","Изключи"],
    open_cover:["Open","Отвори"], close_cover:["Close","Затвори"], stop_cover:["Stop","Спри"],
    position:["Position","Позиция"], brightness:["Brightness","Яркост"], effect:["Effect","Ефект"],
    temperature:["Setpoint","Зададена температура"], hvac_mode:["Mode","Режим"],
    fan_mode:["Fan mode","Режим на вентилатора"], swing_mode:["Swing mode","Посока на въздуха"],
    preset_mode:["Preset","Предварителна настройка"], percentage:["Speed","Скорост"],
    volume:["Volume","Сила на звука"], source:["Source","Източник"],
    current_temperature:["Temperature","Температура"], current_humidity:["Humidity","Влажност"],
    target_temp_high:["Upper setpoint","Горна граница"], target_temp_low:["Lower setpoint","Долна граница"],
    hvac_action:["Activity","Активност"], current_position:["Position","Позиция"],
    current_tilt_position:["Tilt","Наклон"], color_temp_kelvin:["Color temperature","Цветна температура"],
    volume_level:["Volume","Сила на звука"],
    unavailable:["Unavailable","Недостъпно"], unknown:["Unknown","Неизвестно"],
    missing:["No connection","Няма връзка"],
  };
  const label = (key, locale) => labels[key]?.[locale === "bg" ? 1 : 0] ?? key;
  const name = (item, locale) => item.names?.[locale] ?? item.entity_id;

  function valid(catalog, installationId) {
    return catalog?.schema_version === 1 && typeof catalog.installation_id === "string"
      && catalog.installation_id.length > 0
      && (installationId == null || catalog.installation_id === installationId)
      && ["rooms","devices","systems","capabilities"].every(key => Array.isArray(catalog[key]));
  }

  function categories(catalog) {
    const result = new Map();
    for (const system of catalog?.systems ?? []) {
      if (system.category !== "general" && system.capability_ids.length) result.set(system.category, system.labels);
    }
    return result;
  }

  function rows(catalog, category, area, query, locale) {
    const selected = category ? new Set(catalog.systems.filter(system => system.category === category)
      .flatMap(system => system.capability_ids)) : null;
    const needle = query.trim().toLocaleLowerCase(locale);
    return catalog.capabilities.filter(item => (!selected || selected.has(item.id))
      && (!area || item.area_id === area)
      && (!needle || name(item,locale).toLocaleLowerCase(locale).includes(needle)));
  }

  function reading(item, snapshot, key, locale, stateLabel) {
    if (!snapshot || ["unavailable","unknown"].includes(snapshot.state)) {
      return label(snapshot?.state || (item.availability === "available" ? "missing" : item.availability), locale);
    }
    if (key === "state") return stateLabel(snapshot.state) + (item.unit ? " " + item.unit : "");
    const value = snapshot.attributes?.[key];
    return ["number","string","boolean"].includes(typeof value) ? String(value) : "—";
  }

  const icons = {
    general:"▣", climate:"❄", lighting:"☼", fans:"🌀", covers:"▤",
    media:"♫", energy:"⚡", water:"💧", security:"🛡", heat_pump:"♨",
    irrigation:"🚿", switches:"◉", sensors:"◈", binary_sensors:"◐", locks:"🔒",
  };
  const icon = category => icons[category] || icons.general;

  function render(items, states, locale, stateLabel, customIcon=()=>null) {
    return '<div class="cards">'+items.map(item => {
      const state = reading(item,states.get(item.entity_id),"state",locale,stateLabel);
      const glyph = customIcon(item.icon) || icon(item.classification?.category);
      return '<button type="button" class="device-card adaptive-device" data-detail="'
        +esc(item.entity_id)+'" data-capability-card="'+esc(item.id)+'"><span class="tile-icon" aria-hidden="true">'
        +esc(glyph)+'</span><span><strong>'+esc(name(item,locale))
        +'</strong><small data-observation="state">'+esc(state)+'</small></span></button>';
    }).join("")+'</div>';
  }

  return {API, valid, categories, rows, reading, render, icon, label};
})();
