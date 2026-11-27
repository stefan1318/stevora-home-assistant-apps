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

  function valid(catalog) {
    return catalog?.schema_version === 1 && typeof catalog.installation_id === "string"
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

  function actionForm(item, action, enabled, locale) {
    const title = esc(label(action.id, locale));
    const fields = Object.entries(action.parameters).map(([key, field]) => {
      if (field.type === "enum") {
        return '<select required aria-label="'+title+'" name="'+esc(key)+'"><option value="" selected disabled>—</option>'
          +field.options.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join("")+'</select>';
      }
      if (field.type !== "number" && field.type !== "integer") return null;
      const step = field.type === "integer" ? 1 : "any";
      return '<input required type="number" aria-label="'+title+'" name="'+esc(key)
        +'" min="'+esc(field.min)+'" max="'+esc(field.max)+'" step="'+step+'">';
    });
    if (fields.includes(null)) return "";
    return '<form class="adaptive-action" data-form="adaptive-action" data-capability="'+esc(item.id)
      +'" data-action="'+esc(action.id)+'">'+fields.join("")+'<button type="submit" '
      +(enabled ? "" : "disabled")+'>'+title+'</button></form>';
  }

  function managementForm(device, management, locale, connected) {
    const tr = (en, bg) => locale === "bg" ? bg : en;
    const override = device.override || {};
    const options = Object.entries(management.categories).map(([id, names]) =>
      '<option value="'+esc(id)+'"'+(id === override.category ? ' selected' : '')+'>'
      +esc(names[locale] || id)+'</option>').join("");
    return '<form class="adaptive-profile" data-form="adaptive-profile" data-device="'+esc(device.id)+'">'
      +'<label>'+tr("Category","Категория")+'<select name="category"><option value="">'
      +tr("Automatic","Автоматично")+'</option>'+options+'</select></label>'
      +'<label>'+tr("Group ID","Идентификатор на група")+'<input name="group" maxlength="64" '
      +'pattern="[a-z0-9][a-z0-9_\\-]{0,63}" value="'+esc(override.group||"")+'"></label>'
      +'<button type="submit"'+(connected ? '' : ' disabled')+'>'+tr("Save","Запази")+'</button>'
      +(override.category || override.group ? '<button type="submit" name="reset" value="1" formnovalidate'
        +(connected ? '' : ' disabled')+'>'+tr("Reset","Възстанови")+'</button>' : '')+'</form>';
  }

  function render(items, states, connected, locale, stateLabel, catalog=null) {
    const editable = new Map(catalog?.management ? catalog.devices.map(device=>[device.id,device]) : []);
    return '<div class="cards">'+items.map(item => {
      const snapshot = states.get(item.entity_id);
      const state = reading(item,snapshot,"state",locale,stateLabel);
      const measurements = item.measurements.filter(key => key !== "state").map(key =>
        '<div><dt>'+esc(label(key,locale))+'</dt><dd data-observation="'+esc(key)+'">'
        +esc(reading(item,snapshot,key,locale,stateLabel))+'</dd></div>').join("");
      const enabled = connected && snapshot && !["unavailable","unknown"].includes(snapshot.state);
      const actions = item.availability === "available"
        ? item.actions.map(action=>actionForm(item,action,enabled,locale)).join("") : "";
      const device = editable.get(item.device_id);
      editable.delete(item.device_id);
      return '<details class="device-card adaptive-device" data-capability-card="'+esc(item.id)+'"><summary><strong>'
        +esc(name(item,locale))+'</strong><small data-observation="state">'+esc(state)+'</small></summary>'
        +(measurements ? '<dl class="adaptive-measurements">'+measurements+'</dl>' : "")
        +(actions ? '<div class="adaptive-controls">'+actions+'</div>' : "")
        +(device ? managementForm(device,catalog.management,locale,connected) : "")+'</details>';
    }).join("")+'</div>';
  }

  function command(item, action, read, confirmed) {
    const parameters = Object.fromEntries(Object.entries(action.parameters).map(([key, field]) => {
      const value = read(key);
      return [key, field.type === "enum" ? value : typeof value === "string" && value.trim() ? Number(value) : null];
    }));
    return {type:API+"/action", capability_id:item.id, action_id:action.id, parameters, confirmed};
  }

  return {API, valid, categories, rows, reading, render, command};
})();
