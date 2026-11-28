function consumerState(value,tr) {
  const labels={on:["Включено","On"],off:["Изключено","Off"],home:["Вкъщи","Home"],not_home:["Навън","Away"],unavailable:["Недостъпно","Unavailable"],unknown:["Няма данни","Unknown"],cool:["Охлаждане","Cooling"],heat:["Отопление","Heating"],auto:["Авто","Auto"],heat_cool:["Отопление / охлаждане","Heat / cool"],dry:["Изсушаване","Dry"],fan_only:["Вентилация","Fan only"],standby:["Готовност","Standby"]};
  return labels[value]?tr(...labels[value]):String(value??"").replaceAll("_"," ");
}
function dismissOnBackdrop(dialog) {
  const outside=e=>{const b=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);};
  let started=false;
  dialog.addEventListener("pointerdown",e=>{started=outside(e);});
  dialog.addEventListener("click",e=>{if(started&&outside(e))dialog.close();started=false;});
}
"use strict";

function climateRange(attrs, temperatureUnit) {
  const min=attrs.min_temp, max=attrs.max_temp;
  const step=Number.isFinite(attrs.target_temp_step) && attrs.target_temp_step>0 ? attrs.target_temp_step : 1;
  if(!Number.isFinite(min) || !Number.isFinite(max) || max<=min)return null;
  // Some cooling integrations expose a Celsius minimum and an unconverted Fahrenheit maximum.
  const mixed=temperatureUnit==="°C" && attrs.hvac_modes?.includes("cool")
    && min>=5 && min<=25 && max>=60 && max<=100
    && Number.isFinite(attrs.temperature) && attrs.temperature>=min && attrs.temperature<=40;
  const upper=mixed ? min+Math.floor(((max-32)*5/9-min)/step)*step : max;
  return upper>min ? {min,max:upper,step} : null;
}
function climatePanel({entity, allowed, apply, tr, error, temperatureUnit}) {
  const panel = document.createElement("section");
  panel.className = "climate-panel";
  let pending = false;
  function render() {
    const current = entity();
    if (!current) return;
    const attrs = current.attributes || {};
    const value = attrs.temperature;
    const focus = panel.contains(document.activeElement) && document.activeElement.dataset.control;
    panel.replaceChildren();
    function caption(text) {
      const p = document.createElement("p");
      p.textContent = text;
      panel.append(p);
    }
    function button(parent, label, id, disabled, action) {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.control = id;
      b.disabled = pending || disabled;
      b.onclick = async () => {
        if (pending) return;
        pending = true;
        error.textContent = "";
        render();
        try { await action(); }
        catch (e) { error.textContent = e.message; }
        finally { pending = false; render(); }
      };
      parent.append(b);
      return b;
    }
    if (Number.isFinite(value)) {
      caption(tr("Зададена температура","Target temperature"));
      const row = document.createElement("div");
      row.className = "setpoint";
      const output = document.createElement("strong");
      const unit=temperatureUnit || "°";
      output.textContent = value + unit;
      const range=climateRange(attrs,temperatureUnit);
      function adjust(label, delta) {
        const next = range && Number((value + delta*range.step).toFixed(4));
        button(row,label,label,!range || !allowed("temperature") || next < range.min || next > range.max,
          () => apply("temperature","set_temperature",{temperature:next}));
      }
      adjust("−",-1); row.append(output); adjust("+",1);
      panel.append(row);
      if(range && allowed("temperature"))caption(tr("Стъпка ","Step ") + range.step + unit +
        " · " + range.min + "–" + range.max + unit);
    }
    if (attrs.hvac_modes?.length && allowed("hvac_mode")) {
      caption(tr("Режим на работа","Operating mode"));
      const grid = document.createElement("div");
      grid.className = "hvac-modes";
      for (const mode of attrs.hvac_modes) {
        button(grid,consumerState(mode,tr),mode,!allowed("hvac_mode"),
          () => apply("hvac_mode","set_hvac_mode",{hvac_mode:mode}))
          .setAttribute("aria-pressed",String(current.state === mode));
      }
      panel.append(grid);
    }
    if (focus) Array.from(panel.querySelectorAll("button")).find(b=>b.dataset.control===focus)?.focus();
  }
  return {panel,render};
}
function openStevoraDevice({id, entity, profile, canControl, call, tr, name, temperatureUnit, observations}) {
  const current = entity();
  if (!current || !profile()) throw new Error(tr("Устройството вече не е достъпно", "Device no longer available"));
  const domain = id.split(".")[0];
  const dialog = document.createElement("dialog");
  dialog.className = "details-dialog flow-dialog device-sheet";
  const heading = document.createElement("h2");
  heading.textContent = name;
  const status = document.createElement("p");
  const fields = document.createElement("section");
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  function allowed(key) {
    const p = profile();
    return canControl() && (p?.controls ?? p?.available_controls ?? []).includes(key);
  }
  async function apply(key, command, data) {
    if (!allowed(key)) throw new Error(tr("Действието вече не е разрешено", "Control no longer available"));
    await call({type:"call_service", domain, service:command, target:{entity_id:id}, service_data:data});
  }
  const attrs = current.attributes || {};
  const number = (min,max,value,step=1) => ({type:"number",min,max,value,step});
  const choice = (options,value) => ({options:options || [],value});
  const controls = {
    brightness: [tr("Яркост (%)","Brightness (%)"),"turn_on","brightness_pct",number(0,100,Math.round((attrs.brightness||0)*100/255))],
    color: [tr("Цвят","Color"),"turn_on","rgb_color",{type:"color", value:"#"+(attrs.rgb_color||[255,255,255]).map(n=>Number(n).toString(16).padStart(2,"0")).join("")}],
    color_temp: [tr("Цветна температура (K)","Color temperature (K)"),"turn_on","color_temp_kelvin",number(attrs.min_color_temp_kelvin||2000,attrs.max_color_temp_kelvin||6500,attrs.color_temp_kelvin)],
    effect: [tr("Ефект","Effect"),"turn_on","effect",choice(attrs.effect_list,attrs.effect)],
    percentage: [tr("Скорост (%)","Speed (%)"),"set_percentage","percentage",number(0,100,attrs.percentage)],
    preset_mode: [tr("Профил","Preset"),"set_preset_mode","preset_mode",choice(attrs.preset_modes,attrs.preset_mode)],
    oscillate: [tr("Осцилация","Oscillation"),"oscillate","oscillating",choice(["on","off"],attrs.oscillating?"on":"off")],
    direction: [tr("Посока","Direction"),"set_direction","direction",choice(["forward","reverse"],attrs.direction)],
    hvac_mode: [tr("Режим","Mode"),"set_hvac_mode","hvac_mode",choice(attrs.hvac_modes,current.state)],
    fan_mode: [tr("Вентилатор","Fan mode"),"set_fan_mode","fan_mode",choice(attrs.fan_modes,attrs.fan_mode)],
    swing_mode: [tr("Жалузи","Swing"),"set_swing_mode","swing_mode",choice(attrs.swing_modes,attrs.swing_mode)],
    open: [tr("Отвори","Open"),"open_cover"], close:[tr("Затвори щората","Close cover"),"close_cover"], stop:[tr("Стоп","Stop"),"stop_cover"],
    position: [tr("Позиция (%)","Position (%)"),"set_cover_position","position",number(0,100,attrs.current_position)],
    tilt: [tr("Наклон (%)","Tilt (%)"),"set_cover_tilt_position","tilt_position",number(0,100,attrs.current_tilt_position)],
    play_pause: [tr("Пускане / пауза","Play / pause"),"media_play_pause"],
    volume: [tr("Сила на звука (%)","Volume (%)"),"volume_set","volume_level",number(0,100,Math.round((attrs.volume_level||0)*100))],
    source: [tr("Източник","Source"),"select_source","source",choice(attrs.source_list,attrs.source)]
  };
  for (const [key,[label,service,field,spec]] of Object.entries(controls)) {
    if (!allowed(key) || (spec?.options && !spec.options.length)) continue;
    if (domain==="climate" && (key==="hvac_mode" || key==="temperature" && Number.isFinite(attrs.temperature))) continue;
    const form = document.createElement("form");
    form.dataset.control=key;
    let input;
    if (field) {
      const caption = document.createElement("label");
      caption.textContent = label;
      input = document.createElement(spec.options?"select":"input");
      if (spec.options) {
        for (const v of spec.options) input.add(new Option(consumerState(v,tr),v));
      } else {
        input.type = spec.type;
        for (const prop of ["min","max","step"]) if (spec[prop]!=null) input[prop]=spec[prop];
      }
      if(spec.type==="number" && key!=="temperature" && spec.min!=null && spec.max!=null){
        input.type="range";
        const output=document.createElement("output");
        input.addEventListener("input",()=>{output.textContent=input.value;});
        output.textContent=String(spec.value??Math.round((spec.min+spec.max)/2));
        caption.append(output);
      }
      input.required=true;
      if(spec.value!=null) input.value=spec.value;
      caption.append(input); form.append(caption);
    }
    const button = document.createElement("button");
    button.textContent = field?tr("Задай","Apply"):label;
    if(field){input.addEventListener("change",()=>form.requestSubmit());}else form.append(button);
    fields.append(form);
    form.onsubmit = async event => {
      event.preventDefault(); if(button.disabled)return;button.disabled=true;if(input)input.disabled=true; error.textContent="";
      try {
        let value=input?.value;
        if (spec?.type==="number") value=input.valueAsNumber;
        if (key==="volume") value/=100;
        if (key==="color") value=value.slice(1).match(/../g).map(v=>parseInt(v,16));
        if (key==="oscillate") value=value==="on";
        await apply(key,service,field?{[field]:value}:{});
      } catch(e) { error.textContent=e.message||String(e); }
      finally {button.disabled=!allowed(key);if(input)input.disabled=button.disabled;}
    };
  }
  const power=document.createElement("button");
  power.onclick=async()=>{
    if(power.disabled)return;
    power.disabled=true;
    error.textContent="";
    try{await apply("toggle",entity().state==="on"?"turn_off":"turn_on",{});}
    catch(e){error.textContent=e.message;}
    finally{refresh();}
  };
  const readings=document.createElement("dl");
  readings.className="adaptive-measurements";
  dismissOnBackdrop(dialog);
  const close=document.createElement("button");
  close.textContent=tr("Затвори","Close"); close.onclick=()=>dialog.close();
  close.className="sheet-close";
  close.setAttribute("aria-label",close.textContent); close.textContent="×";
  const caption=document.createElement("small");
  caption.textContent=domain==="climate"?tr("Климатизация","Climate"):tr("Устройство","Device");
  dialog.append(caption,heading,close);
  let climate;
  if(domain==="climate"){
    climate=climatePanel({entity,allowed,apply,tr,error,temperatureUnit});
    dialog.append(climate.panel,status);
    if(fields.childElementCount){
      const details=document.createElement("details"),summary=document.createElement("summary");
      summary.textContent=tr("Допълнителни контроли","Additional controls");
      details.append(summary,fields);dialog.append(details);
    }
  }else dialog.append(status,power,fields);
  dialog.append(readings,error);
  const refresh = () => {
    const next=entity();
    if (!next || !profile()) {dialog.close();return;}
    climate?.render();
    power.hidden=!allowed("toggle") || !["on","off"].includes(next.state);
    power.disabled=power.hidden;
    power.textContent=next.state==="on"?tr("Изключи","Turn off"):tr("Включи","Turn on");
    readings.replaceChildren();
    for(const key of observations || ["current_temperature"]){
      const value=next.attributes?.[key];
      if(key==="state" || key==="temperature" && climate || !["number","string"].includes(typeof value))continue;
      const row=document.createElement("div"), label=document.createElement("dt"), result=document.createElement("dd");
      label.textContent=typeof StevoraAdaptive!=="undefined" ? StevoraAdaptive.label(key,tr("bg","en")) :
        tr("Текуща температура","Current temperature");
      result.textContent=consumerState(value,tr)+(key==="current_temperature"?(temperatureUnit||"°"):"");
      row.append(label,result);readings.append(row);
    }
    for(const input of fields.querySelectorAll("input,select,button"))
      input.disabled=!allowed(input.closest("form").dataset.control);
    status.textContent=(climate?tr("Текущ режим: ","Current mode: "):"")+[consumerState(next.state,tr),next.attributes?.unit_of_measurement].filter(Boolean).join(" · ");
  };
  document.addEventListener("stevora-device-update",refresh);
  dialog.onclose=()=>{document.removeEventListener("stevora-device-update",refresh);dialog.remove();};
  document.body.append(dialog);dialog.showModal();refresh();
}
