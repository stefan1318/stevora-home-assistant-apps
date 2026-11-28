const deviceIcons = [
  ["lightbulb","💡","Лампа","Light"],["led-strip","🌈","LED лента","LED strip"],
  ["air-conditioner","❄","Климатик","Air conditioner"],["fan","🌀","Вентилатор","Fan"],
  ["radiator","♨","Радиатор","Radiator"],["power-plug","🔌","Контакт","Outlet"],
  ["thermometer","🌡","Термометър","Thermometer"],["water-percent","💧","Влажност","Humidity"],
  ["lock","🔒","Ключалка","Lock"],["speaker","🔊","Тонколона","Speaker"],
  ["television","📺","Телевизор","Television"],["window-shutter","▤","Щора","Shutter"]
];
function profileGlyph(icon) {
  return deviceIcons.find(([id])=>"mdi:"+id===icon)?.[1];
}
"use strict";

// Core and Supervisor authorize every operation using the active user's connection.
function createStevoraManagement({call, supervisor, rest, tr, refresh, setLanguage, currentLanguage, currentCatalog}) {
  const l = tr;
  const pick = (key,label,options,value) => ({key,label,options,value});
  const field = (key,label,value="",type="text",extra={}) => ({key,label,value,type,...extra});
  const entries = (items,id="id") => items.map(x=>[x[id],x.name||x[id]]);
  const inherit = () => ["",l("Автоматично","Automatic")];
  const strings = list => list.map(x=>[x,x]);
  const dialogs = new Set();
  function closeAll(){for(const d of dialogs) d.close();}
  function editor(title,fields,save,submitLabel=l("Запази","Save")) {
    const d=document.createElement("dialog"),form=document.createElement("form");
    const h=document.createElement("h2"),error=document.createElement("p");
    d.className="details-dialog flow-dialog";h.textContent=title;error.setAttribute("role","alert");
    const readers=[];
    for (const spec of fields) {
      if (spec.type==="icon") {
        const group=document.createElement("fieldset"),legend=document.createElement("legend");
        legend.textContent=spec.label;group.className="icon-picker";group.append(legend);
        const choices=[["","◌",l("Автоматично","Automatic")],
          ...deviceIcons.map(([id,glyph,bg,en])=>["mdi:"+id,glyph,l(bg,en)])];
        if(spec.value && !profileGlyph(spec.value))choices.push([spec.value,"◆",l("Текуща икона","Current icon")]);
        for(const [id,glyph,title] of choices){
          const label=document.createElement("label"),radio=document.createElement("input");
          radio.type="radio";radio.name=spec.key;radio.value=id;radio.checked=id===(spec.value||"");
          label.append(radio,document.createTextNode(glyph+" "+title));group.append(label);
        }
        form.append(group);readers.push(data=>{data[spec.key]=form.elements[spec.key].value;});continue;
      }
      const label=document.createElement("label");label.textContent=spec.label;
      const input=document.createElement(spec.options?"select":"input");
      if (spec.options) for (const [id,name] of spec.options) input.add(new Option(name,id));
      else input.type=spec.type||"text";
      for (const k of ["min","max","step","required","maxLength","autocomplete","pattern"]) if (spec[k]!==undefined) input[k]=spec[k];
      if(input.type==="checkbox") input.checked=Boolean(spec.value);else input.value=spec.value??"";
      label.append(input);form.append(label);
      readers.push(data=>{data[spec.key]=input.type==="checkbox"?input.checked:input.type==="number"?input.valueAsNumber:input.value;});
    }
    const submit=document.createElement("button"),cancel=document.createElement("button");
    submit.textContent=submitLabel;cancel.textContent=l("Затвори","Close");cancel.type="button";cancel.onclick=()=>d.close();
    form.append(error,submit,cancel);d.append(h,form);dialogs.add(d);
    d.onclose=()=>{form.reset();d.remove();dialogs.delete(d);};
    form.onsubmit=async e=>{
      e.preventDefault();submit.disabled=true;error.textContent="";
      try {
        const data={};readers.forEach(read=>read(data));await save(data);
        if(d.open)d.close();
      } catch(err){error.textContent=err?.code==="conflict"?l("Друг клиент запази промени. Затвори и отвори редактора отново.","Another client saved changes. Reopen the editor to use that revision."):err?.message||String(err);}
      finally{submit.disabled=false;}
    };
    document.body.append(d);d.showModal();
  }
  async function rooms(){
    const s=await call({type:"stevora/admin/rooms/get"});
    const areas=await call({type:"config/area_registry/list"});
    editor(l("Управление на помещения","Rooms Manager"),[
      pick("id",l("Помещение","Room"),[["",l("Ново помещение","New room")],...entries(areas,"area_id")],"")
    ],({id})=>{
      if(!id) return editor(l("Ново помещение","New room"),[field("name",l("Име","Name"),"","text",{required:true})],
        async({name})=>{await call({type:"config/area_registry/create",name});await refresh();});
      const labels=s.translations.rooms[id]||{};
      editor(l("Имена на помещението","Room names"),[
        field("alias",l("Име в STEVORA","STEVORA name"),s.room_aliases[id],"text",{maxLength:80}),
        field("bg","Български",labels.bg,"text",{maxLength:80}),field("en","English",labels.en,"text",{maxLength:80}),
        field("order",l("Позиция","Position"),Math.max(1,s.rooms.findIndex(x=>x.id===id)+1),"number",{required:true,min:1,max:areas.length,step:1})
      ],async({alias,bg,en,order})=>{
        // One revision-checked write also covers ordering and translated names.
        const ordered=s.rooms.map(x=>x.id).filter(x=>x!==id&&areas.some(a=>a.area_id===x));
        ordered.splice(order-1,0,id);
        await call({type:"stevora/admin/rooms/aliases/update",expected_revision:s.revision,
          entity_aliases:s.entity_aliases,room_aliases:{...s.room_aliases,[id]:alias},room_order:ordered,
          room_labels:{[id]:{bg,en}}}); await refresh();
      });
    },l("Продължи","Continue"));
  }
  async function devices(){
    const s=await call({type:"stevora/admin/rooms/get"});
    editor(l("Управление на устройства","Device Manager"),[pick("id",l("Устройство","Device"),s.entities.map(x=>[x.entity_id,x.name+" · "+x.entity_id]),s.entities[0]?.entity_id)],({id})=>{
      const e=s.entities.find(x=>x.entity_id===id);if(!e)throw Error(l("Няма устройства","No devices"));
      const p=s.device_profiles[id]||{}, available=e.available_controls||[];
      editor(e.name,[
        field("name",l("Име в STEVORA","STEVORA name"),p.name,"text",{maxLength:80}),
        pick("area_id",l("Помещение","Room"),[inherit(),...entries(s.rooms.filter(x=>x.id!=="__stevora_unassigned__"))],p.area_id||""),
        field("icon",l("Икона","Icon"),p.icon,"icon"),
        pick("layout",l("Изглед","Layout"),strings(["compact","expanded","info"]),p.layout||"compact"),
        pick("display_category",l("Категория","Category"),strings(["auto","lighting","switches","climate","fans","covers","media","sensors","binary_sensors","locks"]),p.display_category||"auto"),
        field("automatic",l("Автоматичен избор на контроли","Use all supported controls"),!Array.isArray(p.controls),"checkbox"),
        ...available.map(k=>field(k,k,(p.controls??available).includes(k),"checkbox"))
      ],async v=>{
        const profile={...p,icon:v.icon,name:v.name,area_id:v.area_id||null,layout:v.layout,display_category:v.display_category};
        if(v.automatic)delete profile.controls;else profile.controls=available.filter(k=>v[k]);
        await call({type:"stevora/admin/devices/update",expected_revision:s.revision,profiles:{[id]:profile}});await refresh();
      });
    },l("Редактирай","Edit"));
  }
  async function localizedDevices(){
    const config=await call({type:"stevora/admin/rooms/get"});
    const choices=config.entities.map(e=>[e.entity_id,e.name+" · "+e.entity_id]);
    editor(l("Имена на устройства BG/EN","Device names BG/EN"),[
      pick("id",l("Устройство","Device"),choices,choices[0]?.[0])
    ],({id})=>{
      if(!choices.some(([key])=>key===id))throw Error(l("Няма устройства","No devices"));
      const saved=config.translations?.entities?.[id]||{};
      editor(choices.find(([key])=>key===id)[1],[
        field("bg","Български",saved.bg,"text",{maxLength:80}),
        field("en","English",saved.en,"text",{maxLength:80})
      ],async({bg,en})=>{
        await call({type:"stevora/admin/translations/update",expected_revision:config.revision,
          rooms:{},entities:{[id]:{bg,en}}});
        await refresh();
      });
    },l("Редактирай","Edit"));
  }
  async function capabilityGroups(){
    const catalog=currentCatalog();
    const settings=catalog?.management;
    if(!settings)return;
    const locale=currentLanguage();
    const names=new Map(catalog.capabilities.map(item=>[item.id,item.names?.[locale]||item.entity_id]));
    const choices=catalog.devices.map(d=>[d.id,d.capability_ids.map(id=>names.get(id)).filter(Boolean).join(", ")||d.id]);
    editor(l("Категории и групи","Categories and groups"),[
      pick("id",l("Устройство","Device"),choices,choices[0]?.[0])
    ],({id})=>{
      const device=catalog.devices.find(d=>d.id===id);
      if(!device)throw Error(l("Няма устройства","No devices"));
      const saved=device.override||{};
      const categories=Object.entries(settings.categories).map(([key,labels])=>[key,labels[locale]||key]);
      editor(choices.find(([key])=>key===id)[1],[
        pick("category",l("Категория","Category"),[inherit(),...categories],saved.category||""),
        field("group",l("Идентификатор на група","Group ID"),saved.group,"text",{maxLength:64,pattern:"[a-z0-9][a-z0-9_\\-]{0,63}"})
      ],async({category,group})=>{
        await call({type:"stevora/os/v1/capabilities/override",device_id:id,
          expected_revision:settings.configuration_revision,...(category?{category}:{}),...(group?{group}:{})});
        await refresh();
      });
    },l("Редактирай","Edit"));
  }
  async function visibility(){
    const s=await call({type:"stevora/admin/rooms/get"});
    editor(l("Видимост на устройство","Device visibility"),[pick("id",l("Устройство","Device"),s.entities.map(x=>[x.entity_id,x.name+" · "+(s.visibility[x.entity_id]||"default")]),s.entities[0]?.entity_id),
      pick("mode",l("В манифеста","Manifest visibility"),[inherit(),["include",l("Включи","Include")],["exclude",l("Изключи","Exclude")]],"")],async({id,mode})=>{
      await call({type:"stevora/admin/rooms/update",expected_revision:s.revision,entities:[{entity_id:id,visibility:mode||"default"}]});await refresh();
    });
  }
  async function assist(){
    const s=await call({type:"stevora/admin/assistants/get"});
    const options=[inherit(),...entries(s.pipelines)];
    editor("STEVORA Assist",[
      pick("default",l("Асистент за дома","Home assistant"),options,s.settings.default_pipeline||""),
      ...s.users.map(u=>pick(u.id,u.name,options,s.settings.user_pipelines[u.id]||""))
    ],async v=>{
      const user_pipelines=Object.fromEntries(s.users.filter(u=>v[u.id]).map(u=>[u.id,v[u.id]]));
      await call({type:"stevora/admin/assistants/update",expected_revision:s.revision,default_pipeline:v.default||null,user_pipelines});await refresh();
    });
  }
  async function general(){
    const c=await call({type:"get_config"});
    const specs=[
      field("location_name",l("Име на дома","Home name"),c.location_name),
      field("latitude",l("Ширина","Latitude"),c.latitude,"number",{min:-90,max:90,step:"any"}),
      field("longitude",l("Дължина","Longitude"),c.longitude,"number",{min:-180,max:180,step:"any"}),
      field("elevation",l("Надморска височина","Elevation"),c.elevation,"number",{step:"any"}),
      field("time_zone",l("Часова зона","Time zone"),c.time_zone),
      pick("unit_system",l("Мерни единици","Units"),strings(["metric","us_customary"]),c.unit_system?.length==="km"?"metric":"us_customary"),
      field("currency",l("Валута","Currency"),c.currency),field("country",l("Държава (код)","Country code"),c.country),
      field("internal_url",l("Вътрешен адрес","Internal URL"),c.internal_url,"url"),field("external_url",l("Външен адрес","External URL"),c.external_url,"url")
    ];
    editor(l("Настройки на дома","Home settings"),specs,async v=>{
      const changed=Object.fromEntries(specs.filter(s=>String(s.value??"")!==String(v[s.key])).map(s=>[s.key,v[s.key]===""?null:v[s.key]]));
      if(Object.keys(changed).length)await call({type:"config/core/update",...changed});await refresh();
    });
  }
  async function network(){
    const {interfaces}=await supervisor("/network/info");
    editor(l("Мрежови интерфейси","Network interfaces"),[pick("id",l("Интерфейс","Interface"),interfaces.map(i=>[i.interface,i.interface+" · "+i.type]),interfaces[0]?.interface)],({id})=>{
      const info=interfaces.find(i=>i.interface===id);if(!info)throw Error("Unknown interface");
      const ip=info.ipv4||{};
      editor(id,[pick("method","IPv4",strings(["auto","static","disabled"]),ip.method||"auto"),
        field("address",l("Адреси с префикс, разделени със запетая","CIDR addresses, comma separated"),(ip.address||[]).join(", ")),
        field("gateway",l("Шлюз","Gateway"),ip.gateway),
        field("dns","DNS",(ip.nameservers||[]).join(", "))],async v=>{
          if(!confirm(l("Промяната може да прекъсне връзката. Приложи?","Applying this network change can disconnect you. Continue?")))return;
          const list=x=>x.split(",").map(s=>s.trim()).filter(Boolean);
          const ipv4={method:v.method};if(v.method==="static"){ipv4.address=list(v.address);ipv4.gateway=v.gateway||null;ipv4.nameservers=list(v.dns);}
          await supervisor("/network/interface/"+encodeURIComponent(id)+"/update","POST",{ipv4});await refresh();
        });
    },l("Редактирай","Edit"));
  }
  async function profile(){
    const user=await call({type:"auth/current_user"});
    editor(user.name||l("Моят профил","My profile"),[pick("language",l("Език на STEVORA","STEVORA language"),[["bg","Български"],["en","English"]],currentLanguage())],async v=>{
      await call({type:"frontend/set_user_data",key:"stevora_profile",value:{language:v.language}});
      setLanguage(v.language);await refresh();
    });
  }
  function password(){
    editor(l("Смяна на паролата","Change password"),[
      field("current_password",l("Текуща парола","Current password"),"","password",{required:true,autocomplete:"current-password"}),
      field("new_password",l("Нова парола","New password"),"","password",{required:true,autocomplete:"new-password"})],
      v=>call({type:"config/auth_provider/homeassistant/change_password",...v}));
  }
  function issueToken(){
    editor(l("Нов дълготраен токен","Create long-lived access token"),[
      field("client_name",l("Име на приложението","Application name"),"","text",{required:true,maxLength:100}),
      field("lifespan",l("Валидност в дни","Lifetime in days"),365,"number",{min:1,max:3650,required:true,step:1})],async v=>{
        const token=await call({type:"auth/long_lived_access_token",...v});
        if(typeof token!=="string"||!token)throw Error("Invalid token response");
        const d=document.createElement("dialog"),h=document.createElement("h2"),value=document.createElement("textarea"),close=document.createElement("button");
        d.className="details-dialog";h.textContent=l("Копирай токена сега","Copy your token now");
        value.readOnly=true;value.value=token;value.setAttribute("aria-label","Access token");value.spellcheck=false;
        close.textContent=l("Готово","Done");close.onclick=()=>d.close();
        d.append(h,value,close);dialogs.add(d);d.onclose=()=>{value.value="";dialogs.delete(d);d.remove();};
        document.body.append(d);d.showModal();value.select();
      },l("Генерирай","Generate"));
  }
  async function revokeToken(){
    const response=await call({type:"auth/refresh_tokens"});
    const tokens=(Array.isArray(response)?response:response.tokens||[]).filter(x=>x.type==="long_lived_access_token");
    if(!tokens.length)throw Error(l("Няма създадени токени","No long-lived tokens"));
    editor(l("Отмяна на токен","Revoke token"),[pick("id",l("Токен","Token"),tokens.map(x=>[x.id,x.client_name]),tokens[0].id)],async({id})=>{
      if(confirm(l("Отмени достъпа с този токен?","Revoke access with this token?")))await call({type:"auth/delete_refresh_token",refresh_token_id:id});
    },l("Отмени достъпа","Revoke access"));
  }
  async function accounts(){
    const users=(await call({type:"config/auth/list"})).filter(u=>!u.system_generated);
    editor(l("Потребители","Users"),[pick("id",l("Акаунт","Account"),entries(users),users[0]?.id)],({id})=>{
      const u=users.find(x=>x.id===id);if(!u)throw Error("Unknown user");
      const specs=[field("name",l("Име","Name"),u.name,"text",{required:true})];
      if(!u.is_owner)specs.push(field("is_active",l("Активен","Active"),u.is_active,"checkbox"),field("local_only",l("Само локален вход","Local sign-in only"),u.local_only,"checkbox"),
        pick("group",l("Роля","Role"),strings(["system-users","system-admin","system-read-only"]),u.group_ids[0]));
      editor(u.name,specs,async v=>{
        const changed={};
        for(const s of specs)if(v[s.key]!==s.value){if(s.key==="group")changed.group_ids=[v.group];else changed[s.key]=v[s.key];}
        if(Object.keys(changed).length&&confirm(l("Запази промените по акаунта?","Save account changes?")))await call({type:"config/auth/update",user_id:id,...changed});await refresh();
      });
    },l("Редактирай","Edit"));
  }
  async function host(action){
    const endpoints={reboot:"/host/reboot",shutdown:"/host/shutdown",coreRestart:"/core/restart",coreUpdate:"/core/update",supervisorUpdate:"/supervisor/update"};
    if(!confirm(l("Изпълни избраното системно действие?","Run the selected system operation?")))return;
    await supervisor(endpoints[action],"POST",{});
  }
  const actions={rooms,devices,localizedDevices,capabilityGroups,visibility,assist,general,network,profile,password,issueToken,revokeToken,accounts,
    check:async()=>{const s=await rest("/api/config/core/check_config","POST");alert([s.result,s.errors,s.warnings].filter(Boolean).join("\n"));}};
  return {closeAll,run:action=>actions[action]?actions[action]():host(action)};
}
