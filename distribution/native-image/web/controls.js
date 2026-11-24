function consumerState(value,tr) {
  const labels={on:["Включено","On"],off:["Изключено","Off"],home:["Вкъщи","Home"],not_home:["Навън","Away"],unavailable:["Недостъпно","Unavailable"],unknown:["Няма данни","Unknown"],cool:["Охлаждане","Cooling"],heat:["Отопление","Heating"],heat_cool:["Автоматично","Auto"],dry:["Изсушаване","Dry"],fan_only:["Вентилация","Fan only"],standby:["Готовност","Standby"]};
  return labels[value]?tr(...labels[value]):String(value??"").replaceAll("_"," ");
}
function dismissOnBackdrop(dialog) {
  const outside=e=>{const b=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);};
  let started=false;
  dialog.addEventListener("pointerdown",e=>{started=outside(e);});
  dialog.addEventListener("click",e=>{if(started&&outside(e))dialog.close();started=false;});
}
"use strict";

function openStevoraDevice({id, entity, profile, canControl, call, tr, name}) {
  const current = entity();
  if (!current || !profile()) throw new Error(tr("Устройството вече не е достъпно", "Device no longer available"));
  const domain = id.split(".")[0];
  const dialog = document.createElement("dialog");
  dialog.className = "details-dialog flow-dialog";
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
    toggle: [tr("Вкл. / Изкл.","Toggle"), "toggle"],
    brightness: [tr("Яркост (%)","Brightness (%)"),"turn_on","brightness_pct",number(0,100,Math.round((attrs.brightness||0)*100/255))],
    color: [tr("Цвят","Color"),"turn_on","rgb_color",{type:"color", value:"#"+(attrs.rgb_color||[255,255,255]).map(n=>Number(n).toString(16).padStart(2,"0")).join("")}],
    color_temp: [tr("Цветна температура (K)","Color temperature (K)"),"turn_on","color_temp_kelvin",number(attrs.min_color_temp_kelvin||2000,attrs.max_color_temp_kelvin||6500,attrs.color_temp_kelvin)],
    effect: [tr("Ефект","Effect"),"turn_on","effect",choice(attrs.effect_list,attrs.effect)],
    percentage: [tr("Скорост (%)","Speed (%)"),"set_percentage","percentage",number(0,100,attrs.percentage)],
    preset_mode: [tr("Профил","Preset"),"set_preset_mode","preset_mode",choice(attrs.preset_modes,attrs.preset_mode)],
    oscillate: [tr("Осцилация","Oscillation"),"oscillate","oscillating",choice(["on","off"],attrs.oscillating?"on":"off")],
    direction: [tr("Посока","Direction"),"set_direction","direction",choice(["forward","reverse"],attrs.direction)],
    temperature: [tr("Задание (°)","Target (°)"),"set_temperature","temperature",number(attrs.min_temp,attrs.max_temp,attrs.temperature)],
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
    const form = document.createElement("form");
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
      input.required=true;
      if(spec.value!=null) input.value=spec.value;
      caption.append(input); form.append(caption);
    }
    const button = document.createElement("button");
    button.textContent = field?tr("Задай","Apply"):label;
    form.append(button); fields.append(form);
    form.onsubmit = async event => {
      event.preventDefault(); button.disabled=true; error.textContent="";
      try {
        let value=input?.value;
        if (spec?.type==="number") value=input.valueAsNumber;
        if (key==="volume") value/=100;
        if (key==="color") value=value.slice(1).match(/../g).map(v=>parseInt(v,16));
        if (key==="oscillate") value=value==="on";
        await apply(key,service,field?{[field]:value}:{});
      } catch(e) { error.textContent=e.message||String(e); }
      finally {button.disabled=false;}
    };
  }
  dismissOnBackdrop(dialog);
  const close=document.createElement("button");
  close.textContent=tr("Затвори","Close"); close.onclick=()=>dialog.close();
  dialog.append(heading,status,fields,error,close);
  const refresh = () => {
    const next=entity();
    if (!next || !profile()) {dialog.close();return;}
    status.textContent=[consumerState(next.state,tr),next.attributes?.unit_of_measurement].filter(Boolean).join(" · ");
  };
  document.addEventListener("stevora-device-update",refresh);
  dialog.onclose=()=>{document.removeEventListener("stevora-device-update",refresh);dialog.remove();};
  document.body.append(dialog);dialog.showModal();refresh();
}
