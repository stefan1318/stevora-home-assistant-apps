/* STEVORA OS native root UI — real HA Core auth and permission-scoped system APIs.
 * This is a developer preview: no fake availability, no Supervisor token, no
 * controls for backlight entities and no silent high-impact system actions.
 */
"use strict";
(() => {
  const q = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const langDefault = navigator.language?.startsWith("bg") ? "bg" : "en";
  const LS = {
    bg: {
      home:"Начало",rooms:"Помещения",devices:"Устройства",lighting:"Осветление",climate:"Климат",
      scenes:"Сцени",automations:"Автоматизации",integrations:"Интеграции",apps:"Приложения",
      system:"Система",backups:"Архиви",users:"Потребители",assist:"Hey Stevora",
      login:"Вход в STEVORA OS",loginDesc:"Влез с акаунта за този дом.",
      loginButton:"Вход в STEVORA",noData:"Няма достъпни данни",unknown:"Недостъпно",reload:"Обнови",
      roomAll:"Всички помещения",total:"Общо",online:"Достъпни",unavailable:"Недостъпни",
      awaiting:"Очаква се Home Assistant Core да стартира",connecting:"Свързване към системата",
      connected:"Свързан",notAdmin:"Функцията изисква HA администраторски достъп.",
      noModules:"Няма инсталирани модули",installed:"Инсталирани",available:"Налични",
      error:"Грешка",tryAgain:"Опитай отново",turnOn:"Включи",turnOff:"Изключи",
      current:"Текуща",target:"Зададена",activate:"Активирай",trigger:"Изпълни",
      managed:"Управлява се от Home Assistant Core / Supervisor",start:"Старт",stop:"Стоп",
      restart:"Рестарт",update:"Обнови",install:"Инсталирай",remove:"Премахни",
      details:"Детайли",logs:"Логове",save:"Запази",confirm:"Потвърждение",
      backupCreate:"Създай пълен архив",backupRestore:"Възстанови",backupCaution:"Възстановяването и OS обновленията са заключени до проверка на подписите и възстановяване.",
      updateCaution:"Инсталирай подписани пакети за STEVORA от „Обновявания“.",
      systemReadOnly:"Системните данни са реални. Промените в мрежа, диск, OS и потребителски роли са заключени в тази версия.",
      noAudio:"Гласовото управление е достъпно само при реално конфигуриран pipeline. Тук Assist предлага текстов чат.",
      send:"Изпрати",prompt:"Команда или въпрос",automationNote:"Показват се действителните автоматизации. Изпълнението и редактирането зависят от HA права.",
      integrationsNote:"Реални HA config entries. Добавянето използва поддържания HA config-flow API.",
      badOptions:"Промяна на опции: невалиден JSON.",noPermission:"Нямаш необходимите права за това действие.",
      authError:"Неуспешна автентикация. Проверете HA Core и HTTPS сертификата.",
      dangerous:"Операцията може да промени или изтрие системни данни. Потвърди изрично.",
      noActions:"Няма разрешени действия",notSupported:"Тази операция не е внедрена или проверена.",
      stillStarting:"Home Assistant Core още стартира",search:"Търси…",
    },
    en: {
      home:"Home",rooms:"Rooms",devices:"Devices",lighting:"Lighting",climate:"Climate",
      scenes:"Scenes",automations:"Automations",integrations:"Integrations",apps:"Apps",
      system:"System",backups:"Backups",users:"Users",assist:"Hey Stevora",
      login:"Sign in to STEVORA OS",loginDesc:"Use your account for this home.",
      loginButton:"Sign in to STEVORA",noData:"No accessible data",unknown:"Unavailable",reload:"Refresh",
      roomAll:"All rooms",total:"Total",online:"Available",unavailable:"Unavailable",
      awaiting:"Waiting for Home Assistant Core",connecting:"Connecting to the system",
      connected:"Connected",notAdmin:"Home Assistant admin rights required.",
      noModules:"No modules installed",installed:"Installed",available:"Available",
      error:"Error",tryAgain:"Retry",turnOn:"Turn on",turnOff:"Turn off",
      current:"Current",target:"Target",activate:"Activate",trigger:"Trigger",
      managed:"Managed by Home Assistant Core / Supervisor",start:"Start",stop:"Stop",
      restart:"Restart",update:"Update",install:"Install",remove:"Remove",
      details:"Details",logs:"Logs",save:"Save",confirm:"Confirm",
      backupCreate:"Create full backup",backupRestore:"Restore",backupCaution:"Restore and OS updates are locked until signed update and recovery validation.",
      updateCaution:"Install signed STEVORA packages in Update Center.",
      systemReadOnly:"These are real system values. Network, disk, OS and role changes remain locked in this preview.",
      noAudio:"Voice functions require a configured backend voice pipeline. This Assist panel supports text chat.",
      send:"Send",prompt:"Command or question",automationNote:"Real automations are listed. Execution and editing are subject to HA permissions.",
      integrationsNote:"Real HA config entries. Adding integrations uses the supported HA config-flow API.",
      badOptions:"Options must be valid JSON.",noPermission:"You do not have sufficient permissions.",
      authError:"Authentication failed. Check HA Core and the HTTPS certificate.",
      dangerous:"This operation can change or delete system data. Confirm explicitly.",
      noActions:"No permitted actions",notSupported:"This action has not been implemented or validated.",
      stillStarting:"Home Assistant Core is still booting",search:"Search…",
    }
  };
  let locale = ["bg","en"].includes(sessionStorage.getItem("stevora.lang")) ? sessionStorage.getItem("stevora.lang") : langDefault;
  const t = k => LS[locale][k] || k;
  const state = {
    view:"home",login:false,token:null,refresh:null,expires:0,
    ws:null,connected:false,authorized:false,admin:false,id:1,pending:new Map(),
    entities:[],areas:[],registry:[],deviceRegistry:[],configEntries:[],apps:[],
    store:[],backups:[],system:{},userList:[],messages:[],installations:{},
    room:"",filter:"",busy:false,error:"",lastError:"",selectedApp:"",stevoraManifest:null,
  };
  const backlight = e => /back[ _-]?light|подсвет/i.test([e.entity_id,e.name,e.attributes?.friendly_name,e.original_name].join(" "));
  const isAllowed = e => !!e && !backlight(e) &&
    !["unavailable","unknown"].includes(e.state) &&
    !!state.stevoraManifest?.entities?.some(item=>item.entity_id===e.entity_id);
  const controllable = e => isAllowed(e) &&
    (state.stevoraManifest?.controllable_entities||[]).includes(e.entity_id);
  const validId = (id) => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(id||"");
  const slug = s => /^[a-z0-9_]+$/.test(s||"");
  const count = () => state.entities.filter(e=>isAllowed(e)).length;
  const authKey="stevora.os.auth.v1";
  const safeJSON = (str)=>{try{return JSON.parse(str)}catch{return null}};
  const sleep = ms => new Promise(done=>setTimeout(done,ms));

  function notice(message,bad=false) {
    const el=q("#notice");el.hidden=!message;
    el.className=bad?"error":"success";el.textContent=String(message||"");
  }
  function formatError(error){return (error?.message || error?.code || String(error)).slice(0,300)}
  function resetSession() {
    document.cookie="ingress_session=;Path=/api/hassio_ingress/;Max-Age=0;SameSite=Strict;Secure";
    try {sessionStorage.removeItem(authKey);sessionStorage.removeItem("stevora.oauth.state")}catch{}
    state.token=null;state.refresh=null;state.expires=0;state.connected=false;
    if(state.ws){try{state.ws.close()}catch{}}
    state.ws=null;
    for(const pending of state.pending.values())pending.reject(new Error("Session ended"));
    state.pending.clear();
    state.people=[];state.agent=null;state.entities=[];state.areas=[];state.registry=[];state.deviceRegistry=[];state.stevoraManifest=null;
    state.configEntries=[];state.apps=[];state.store=[];state.backups=[];state.system={};
    state.messages=[];state.userList=[];state.admin=false;state.authorized=false;
  }
  function saveAuth(record) {
    const expiry=Date.now()+Math.max(30,Number(record.expires_in||1800)-40)*1000;
    state.token=record.access_token;state.refresh=record.refresh_token||state.refresh;
    state.expires=expiry;
    sessionStorage.setItem(authKey,JSON.stringify({access:state.token,refresh:state.refresh,expiry}));
  }
  async function exchange(data) {
    const form=new URLSearchParams(data);
    const response=await fetch("/auth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),cache:"no-store"});
    if(!response.ok)throw new Error("OAuth token exchange failed ("+response.status+")");
    const body=await response.json();
    if(!body.access_token)throw new Error("Missing OAuth access token");
    saveAuth(body);
  }
  async function initAuth() {
    const params=new URLSearchParams(location.search);
    if(params.has("code")) {
      const stateParam=sessionStorage.getItem("stevora.oauth.state");
      if(!stateParam || params.get("state")!==stateParam)throw new Error("Invalid OAuth state");
      await exchange({grant_type:"authorization_code",code:params.get("code"),client_id:location.origin+"/"});
      sessionStorage.removeItem("stevora.oauth.state");
      history.replaceState({},"",location.pathname);
    } else if(params.has("error")){
      history.replaceState({},"",location.pathname);
      throw new Error("OAuth denied: "+params.get("error"));
    } else {
      const auth=safeJSON(sessionStorage.getItem(authKey)||"");
      if(auth && typeof auth==="object"){
        state.token=auth.access;state.refresh=auth.refresh;state.expires=auth.expiry;
      }
    }
    if(state.refresh && (!state.token || Date.now()>state.expires)){
      await exchange({grant_type:"refresh_token",refresh_token:state.refresh,client_id:location.origin+"/"});
    }
    if(!state.token)showLogin();
    else await connect();
  }
  let loginMessage = "";
  const setup = createStevoraSetup({
    screen:q("#screen"), language:()=>locale, call,
    authenticated:()=>state.connected && Boolean(state.token),
    post:(step,data)=>coreREST("/api/onboarding/"+step,"POST",data),
    authorize:async code=>{
      await exchange({grant_type:"authorization_code",code,client_id:location.origin+"/"});
      // The established session resumes at Core's first unfinished step.
      await connect();
    },
    enter:async ()=>{
      if (state.connected) {
        document.body.classList.remove("setup-mode");
        state.login=false;
        await loadData();
        return;
      }
      q("#screen").innerHTML='<section class="setup-card"><img alt="STEVORA" src="/stevora-login.png" width="64" height="64"><h1>'+esc(t("login"))+'</h1><p>'+esc(t("loginDesc"))+'</p><button class="primary" id="begin-auth">'+esc(t("loginButton"))+'</button></section>';
      if(loginMessage)notice(loginMessage,true);
      q("#connection-label").textContent=t("login");
    }
  });
  function showLogin(message=""){
    resetSession();state.login=true;loginMessage=message;
    nav();
    q("#connection-label").textContent=t("awaiting");
    void setup.run();
  }
  function startAuth(){
    const nonce=crypto.randomUUID();
    sessionStorage.setItem("stevora.oauth.state",nonce);
    const target=new URL("/auth/authorize",location.origin);
    target.searchParams.set("client_id",location.origin+"/");
    target.searchParams.set("redirect_uri",location.origin+"/");
    target.searchParams.set("state",nonce);
    target.searchParams.set("stevora_lang",locale);
    location.assign(target.toString());
  }
  async function refreshIfNeeded(){
    if(!state.refresh)return;
    if(Date.now() > state.expires-60000)await exchange({grant_type:"refresh_token",refresh_token:state.refresh,client_id:location.origin+"/"});
  }
  async function connect() {
    await refreshIfNeeded();
    if(!state.token)return showLogin();
    const proto=location.protocol==="https:"?"wss:":"ws:";
    const ws=new WebSocket(proto+"//"+location.host+"/api/websocket");
    state.ws=ws;state.connected=false;state.authorized=false;
    ws.addEventListener("message",async event=>{
      if(ws!==state.ws)return;
      let msg=safeJSON(event.data);
      if(!msg)return;
      if(msg.type==="auth_required"){ws.send(JSON.stringify({type:"auth",access_token:state.token}));return}
      if(msg.type==="auth_invalid"){showLogin(t("authError"));return}
      if(msg.type==="auth_ok"){
        loginMessage="";notice("");
        state.connected=true;state.login=false;
        q("#conn-indicator").textContent="ONLINE";
        q("#conn-indicator").className="status online";
        q("#connection-label").textContent="Home Assistant Core "+esc(msg.ha_version||"");
        await setup.run();
        return;
      }
      if(msg.type==="result"){
        const task=state.pending.get(msg.id);
        if(task){clearTimeout(task.timer);state.pending.delete(msg.id);msg.success?task.resolve(msg.result):task.reject(msg.error||new Error("HA WS command failed"))}
        return;
      }
      if(msg.type==="event" && msg.event?.event_type==="state_changed"){
        const e=msg.event.data?.new_state;
        if(msg.event.data?.entity_id?.startsWith("person.")){
          state.people=state.people.filter(person=>person.entity_id!==msg.event.data.entity_id);
          if(e)state.people.push(e);
          if(state.view==="people")renderContent();
        }
        if(e?.entity_id && state.stevoraManifest?.entities?.some(item=>item.entity_id===e.entity_id)){
          const i=state.entities.findIndex(v=>v.entity_id===e.entity_id);
          if(i>=0)state.entities[i]=e;else state.entities.push(e);
          if(["home","rooms","devices","lighting","climate","scenes","automations"].includes(state.view))renderContent();
        }
      }
    });
    ws.addEventListener("close",()=>{if(ws!==state.ws)return;state.connected=false;q("#conn-indicator").textContent="OFFLINE";q("#conn-indicator").className="status";rejectPending();if(document.body.classList.contains("setup-mode"))notice(t("stillStarting")+" · "+t("reload"),true);});
  }
  function rejectPending() {
    for(const task of state.pending.values()){clearTimeout(task.timer);task.reject(new Error("Connection closed"))}
    state.pending.clear();
  }
  function call(payload,timeout=20000) {
    if(state.ws?.readyState!==WebSocket.OPEN || !state.connected)return Promise.reject(new Error("Core WebSocket disconnected"));
    const id=state.id++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{state.pending.delete(id);reject(new Error("HA WS timeout"))},timeout);
      state.pending.set(id,{resolve,reject,timer});
      state.ws.send(JSON.stringify({id,...payload}));
    });
  }
  async function tryCall(payload,def) {try{return await call(payload)}catch{return def}}
  async function coreREST(path,method="GET",body=null){
    if(!state.token || !path.startsWith("/api/"))throw new Error("Core auth required");
    const response=await fetch(path,{
      method,headers:{
        "Authorization":"Bearer "+state.token,
        ...(path.startsWith("/api/config/config_entries/")?{"HA-Frontend-Base":location.origin}:{}),
        ...(body!==null?{"Content-Type":"application/json"}:{})
      },
      body:body!==null?JSON.stringify(body):undefined,
      cache:"no-store",
    });
    if(!response.ok)throw new Error("Core "+method+" "+path+" failed ("+response.status+")");
    const kind=response.headers.get("content-type")||"";
    return kind.includes("json")?response.json():response.text();
  }
  async function supervisor(endpoint,method="GET",data) {
    if(!state.admin)throw new Error(t("notAdmin"));
    if(!/^\/[a-z0-9_./-]+$/.test(endpoint)||endpoint.includes(".."))throw new Error("Invalid endpoint");
    const response=await call({type:"supervisor/api",endpoint,method:method.toLowerCase(),...(data?{data}:{})},120000);
    if(response?.result==="error")throw new Error(response.message||"Supervisor error");
    return response?.result==="ok"?response.data:response;
  }
  async function loadData() {
    try {
      // Get_states is projected by Core to the current user's permissions.
      const [entities,areas,registry,devices]=await Promise.all([
        call({type:"get_states"}),
        tryCall({type:"config/area_registry/list"},[]),
        tryCall({type:"config/entity_registry/list"},[]),
        tryCall({type:"config/device_registry/list"},[]),
      ]);
      state.people=(entities||[]).filter(e=>e.entity_id.startsWith("person."));
      const assistants=await tryCall({type:"conversation/agent/list"}, {agents:[]});
      const agents=assistants.agents || [];
      const preferred=await tryCall({type:"stevora/assistants/resolve"}, {});
      const pipelines=await tryCall({type:"assist_pipeline/pipeline/list"}, {});
      const pipeline=pipelines.pipelines?.find(item=>item.id===(preferred.pipeline_id || pipelines.preferred_pipeline));
      state.agent=agents.find(agent=>agent.id===pipeline?.conversation_engine)?.id ||
        (!preferred.pipeline_id && agents.find(agent=>agent.id==="conversation.home_assistant")?.id) || null;
      const manifest=await tryCall({type:"stevora/os/v1/manifest",language:locale},null);
      state.stevoraManifest=manifest?.installation_id && Array.isArray(manifest.entities)?manifest:null;
      const readable=new Set((state.stevoraManifest?.entities||[]).map(e=>e.entity_id));
      state.entities=(Array.isArray(entities)?entities:[])
        .filter(e=>readable.has(e.entity_id)&&!backlight(e));
      state.areas=Array.isArray(areas)?areas:[];
      state.registry=Array.isArray(registry)?registry:[];
      state.deviceRegistry=Array.isArray(devices)?devices:[];
      state.connected=true;
      // HA enforces admin server-side on this command. Never infer from a UI role.
      try {await call({type:"config/auth/list"});state.admin=true}
      catch {state.admin=false}
      if(state.admin)await loadAdmin(state.view);
      renderContent();
      void call({type:"subscribe_events",event_type:"state_changed"}).catch(()=>{});
    } catch(err){notice(formatError(err),true);renderContent()}
  }
  async function loadAdmin(view) {
    if(!state.admin)return;
    if(view==="integrations"){
      state.configEntries=await tryCall({type:"config_entries/get"},[]);
      state.handlers=await coreREST("/api/config/config_entries/flow_handlers?type=integration").catch(()=>[]);
    }
    if(view==="apps"){
      const [installed,store]=await Promise.all([
        supervisor("/addons").catch(()=>({})),supervisor("/store").catch(()=>({}))
      ]);
      state.apps=installed.addons||[];state.store=store.addons||[];
    }
    if(view==="updates")state.updateInfo=await updateRequest().then(r=>r.json()).catch(()=>null);
    if(view==="system" || view==="updates"){
      const names=["/supervisor/info","/os/info","/host/info","/core/info","/network/info","/jobs/info"];
      const results=await Promise.all(names.map(n=>supervisor(n).catch(e=>({error:formatError(e)}))));
      state.system=Object.fromEntries(names.map((n,i)=>[n,results[i]]));
    }
    if(view==="backups"){const a=await supervisor("/backups").catch(()=>({}));state.backups=a.backups||[]}
    if(view==="users")state.userList=await tryCall({type:"config/auth/list"},[]);
  }
  const areaName=id=>(state.stevoraManifest?.rooms||[]).find(r=>r.id===id)?.name ||
    state.areas.find(a=>a.area_id===id)?.name||id||t("roomAll");
  function entityArea(e){
    const r=state.registry.find(x=>x.entity_id===e.entity_id);
    let areaId=r?.area_id;
    if(!areaId && r?.device_id)areaId=state.deviceRegistry.find(d=>d.id===r.device_id)?.area_id;
    return areaId||"";
  }
  function visibleEntities(domain){
    return state.entities.filter(e=>(!domain||domain==="all"||e.entity_id.startsWith(domain+"."))&&isAllowed(e)&&(!state.room||entityArea(e)===state.room));
  }
  function nav(){
    const map={updates:locale==="bg"?"Обновявания":"Update Center",people:locale==="bg"?"Хора и присъствие":"People & Presence",home:t("home"),rooms:t("rooms"),devices:t("devices"),lighting:t("lighting"),climate:t("climate"),scenes:t("scenes"),automations:t("automations"),integrations:t("integrations"),apps:t("apps"),system:t("system"),backups:t("backups"),users:t("users"),assist:t("assist")};
    q("#navigation").querySelectorAll("[data-view]").forEach(btn=>{
      const view=btn.getAttribute("data-view");
      btn.classList.toggle("selected",view===state.view);
      const label=btn.querySelector("span");if(label)label.textContent=map[view]||view;
    });
    q("#current-title").textContent="STEVORA · "+map[state.view];
    q("#lang-toggle").textContent=locale.toUpperCase();
  }
  function stat(title,value){return '<article class="metric"><small>'+esc(title)+'</small><strong>'+esc(value)+'</strong></article>'}
  function hdr(title,subtitle=""){return '<div class="section-head"><h1>'+esc(title)+'</h1><small>'+esc(subtitle)+'</small></div>'}
  function empty(message=t("noData")){return '<p class="empty">'+esc(message)+'</p>'}
  function toolbar(type){
    const options=[["",t("roomAll")],...(state.stevoraManifest?.rooms||state.areas).map(a=>[a.area_id||a.id,a.name])];
    return '<div class="filters"><select data-room>'+options.map(([id,name])=>'<option value="'+esc(id)+'" '+(state.room===id?"selected":"")+'>'+esc(name)+'</option>').join("")+'</select><input data-search type="search" placeholder="'+esc(t("search"))+'" value="'+esc(state.filter)+'"></div>'
  }
  function matches(name){return !state.filter || String(name).toLocaleLowerCase().includes(state.filter.toLocaleLowerCase())}
  function info(e){let n=state.registry.find(x=>x.entity_id===e.entity_id);return n?.name||e.attributes?.friendly_name||e.entity_id}
  function card(e){
    const id=e.entity_id,domain=id.split(".")[0],name=info(e);
    if(!matches(name+" "+id))return "";
    const action=(s,label,disabled=false)=>'<button data-entity="'+esc(id)+'" data-service="'+s+'" '+(disabled?"disabled":"")+'>'+esc(label)+'</button>';
    let buttons="";
    if(["light","switch","fan"].includes(domain) && controllable(e))buttons+=action("toggle",e.state==="off"?t("turnOn"):t("turnOff"));
    if(domain==="climate"){
      const v=Number(e.attributes?.temperature),lo=Number(e.attributes?.min_temp??5),hi=Number(e.attributes?.max_temp??35);
      buttons+='<span class="temp-readout">'+esc(t("target"))+': '+(Number.isFinite(v)?v+"°":"—")+'</span>';
      if(controllable(e)&&Number.isFinite(v)&&v>=lo&&v<=hi){
        buttons+=action("climate-down","−1°",v-1<lo)+action("climate-up","+1°",v+1>hi);
      }
    }
    if(domain==="scene" && controllable(e))buttons+=action("turn_on",t("activate"));
    if(domain==="automation" && controllable(e))buttons+=action("trigger",t("trigger"));
    if(domain==="automation" && state.admin)
      buttons+='<button data-automation-edit="'+esc(id)+'">'+esc(t("details"))+'</button>';
    const stateLabel=e.state==="off"?t("turnOff"):e.state;
    const current=domain==="climate"&&e.attributes?.current_temperature!=null?e.attributes.current_temperature+"° · ":"";
    return '<article class="device-card"><div class="entity-head"><span class="tile-icon">'+({light:"☼",climate:"◈",fan:"✺",switch:"◉",scene:"✦",automation:"◇"}[domain]||"▣")+'</span><div><strong>'+esc(name)+'</strong><small>'+esc(id)+'</small></div></div><div class="state-value">'+esc(current+stateLabel)+'</div><div class="actions">'+buttons+'</div></article>';
  }
  function home(){
    const available=count();
    const climates=state.entities.filter(e=>e.entity_id.startsWith("climate.")&&isAllowed(e));
    const rooms=state.stevoraManifest?.rooms||state.areas;
    return hdr("STEVORA "+t("home"),t("managed"))+
    '<div class="metrics">'+stat(t("total"),state.entities.length)+stat(t("online"),available)+stat(t("rooms"),rooms.length)+stat(t("climate"),climates.length)+'</div>'+
    '<section class="panel"><h2>'+esc(t("rooms"))+'</h2><div class="room-grid">'+(rooms.map(a=>'<button class="room-tile" data-select-room="'+esc(a.area_id||a.id)+'"><strong>'+esc(a.name)+'</strong><small>'+state.entities.filter(e=>entityArea(e)===(a.area_id||a.id)).length+' '+esc(t("devices"))+'</small></button>').join("")||empty())+'</div></section>'+
    '<section class="panel"><h2>'+esc(t("climate"))+'</h2><div class="cards">'+(climates.slice(0,4).map(card).join("")||empty())+'</div></section>';
  }
  function entityScreen(view){
    const domain={lighting:"light",climate:"climate",scenes:"scene",automations:"automation"}[view]||"all";
    const name=t(view)||t("devices");
    const list=visibleEntities(domain);
    return hdr(name,list.length+" "+t("devices"))+
      (view==="automations"&&state.admin?
        '<div class="actions"><button data-automation-new="1">'+esc(t("install"))+' automation</button></div>':"")+
      toolbar()+'<div class="cards">'+(list.map(card).join("")||empty())+'</div>';
  }
  function roomsView(){
    const rooms=state.areas;
    return hdr(t("rooms"))+'<div class="room-grid">'+(rooms.map(a=>'<button class="room-tile" data-select-room="'+esc(a.area_id||a.id)+'"><strong>'+esc(a.name)+'</strong><small>'+state.entities.filter(e=>entityArea(e)===(a.area_id||a.id)).length+' '+esc(t("devices"))+'</small></button>').join("")||empty())+'</div>';
  }
  function integrationView(){
    if(!state.admin)return hdr(t("integrations"))+empty(t("notAdmin"));
    const entries=Array.isArray(state.configEntries)?state.configEntries:[];
    return hdr(t("integrations"),t("integrationsNote"))+'<div class="metrics">'+stat(t("installed"),entries.length)+'</div><div class="filters"><input data-search type="search" placeholder="'+esc(t("search"))+'" value="'+esc(state.filter)+'"></div><div class="cards">'+
    (entries.filter(e=>matches(e.title+" "+e.domain)).map(e=>'<article class="device-card"><strong>'+esc(e.title||e.domain)+'</strong><small>'+esc(e.domain||"")+'</small><p>'+esc(e.state||"")+'</p><div class="actions"><button data-entry="'+esc(e.entry_id)+'" data-entry-action="details">'+esc(t("details"))+'</button>'+(e.supports_options?'<button data-options="'+esc(e.entry_id)+'">'+esc(tr("Настройки","Configure"))+'</button>':'')+'</div></article>').join("")||empty())+'</div>'+
    '<section class="panel"><h2>'+esc(t("install"))+' '+esc(t("integrations"))+'</h2><form data-form="add-integration"><input name="domain" list="integration-domains" required pattern="[a-z0-9_]+" maxlength="64" placeholder="Tuya, MQTT…"><datalist id="integration-domains">'+(state.handlers||[]).map(id=>'<option value="'+esc(id)+'"></option>').join("")+'</datalist><button type="submit">'+esc(t("install"))+'</button></form><div id="flow-output"></div></section>';
  }
  function appsView(){
    if(!state.admin)return hdr(t("apps"))+empty(t("notAdmin"));
    const installed=Array.isArray(state.apps)?state.apps:[];
    const catalog=Array.isArray(state.store)?state.store:[];
    const installedIds=new Set(installed.map(a=>a.slug));
    const appCard=(a,stored=false)=>{
      const id=a.slug;
      if(!slug(id)||!matches(a.name+" "+id))return "";
      const current=installedIds.has(id);
      let buttons=stored&&!current?
        '<button data-addon="'+esc(id)+'" data-addon-action="install">'+esc(t("install"))+'</button>':
        '<button data-addon="'+esc(id)+'" data-addon-action="'+(a.state==="started"?"stop":"start")+'">'+esc(a.state==="started"?t("stop"):t("start"))+'</button>'+
        '<button data-addon="'+esc(id)+'" data-addon-action="restart">'+esc(t("restart"))+'</button>'+
        '<button data-addon="'+esc(id)+'" data-addon-action="logs">'+esc(t("logs"))+'</button>'+
        '<button data-addon="'+esc(id)+'" data-addon-action="options">'+esc(t("details"))+'</button>'+
        '<button data-addon="'+esc(id)+'" data-addon-action="uninstall" class="danger">'+esc(t("remove"))+'</button>';
      if(current && a.state==="started" && a.ingress!==false)buttons+='<button data-addon="'+esc(id)+'" data-addon-action="open">'+esc(tr("Отвори","Open"))+'</button>';
      if(current && a.update_available)buttons+='<button data-addon="'+esc(id)+'" data-addon-action="update">'+esc(t("update"))+'</button>';
      return '<article class="device-card"><strong>'+esc(a.name||id)+'</strong><small>'+esc(id)+'</small><p>'+esc(a.description||"")+'</p><small>'+esc((a.state||"not installed")+" · "+(a.version||""))+'</small><div class="actions">'+buttons+'</div></article>';
    };
    return hdr(t("apps"),t("managed"))+stat(t("installed"),installed.length)+
      '<section class="panel"><h2>'+esc(t("installed"))+'</h2><div class="filters"><input data-search type="search" placeholder="'+esc(t("search"))+'" value="'+esc(state.filter)+'"></div><div class="cards">'+(installed.map(a=>appCard(a)).join("")||empty())+'</div></section>'+
      '<section class="panel"><h2>'+esc(t("available"))+'</h2><div class="cards">'+(catalog.filter(a=>!installedIds.has(a.slug)).map(a=>appCard(a,true)).join("")||empty())+'</div></section>';
  }
  async function updateRequest(file){
    const response=await fetch("/stevora-update",{method:file?"POST":"GET",
      headers:{Authorization:"Bearer "+state.token,...(file?{"Content-Type":"application/octet-stream"}:{})},
      body:file||undefined,cache:"no-store"});
    if(!response.ok)throw new Error((await response.text()).slice(0,160));return response;
  }
  function osUpload(){
    const info=state.updateInfo;
    const status=info?.publisher_configured?(info.status||"idle"):tr("Необходим е доверен сертификат на издателя.","A trusted publisher certificate is required.");
    return '<section class="panel"><h2>STEVORA OS Update</h2><p>'+esc(status)+'</p><form class="update-upload" data-form="os-update"><input type="file" name="bundle" accept=".raucb" required><button '+(!info?.publisher_configured?'disabled':'')+'>'+esc(tr("Инсталирай подписан пакет","Install signed bundle"))+'</button></form></section>';
  }
  function systemView(){
    if(!state.admin)return hdr(t("system"))+empty(t("notAdmin"));
    const cards=Object.entries(state.system).map(([k,data])=>
      '<article class="system-card"><h2>'+esc(k.replace("/","").replace("/"," · "))+'</h2><dl>'+
      Object.entries(data||{}).filter(([key,val])=>["version","version_latest","update_available","state","healthy","supported","operating_system","hostname","arch","disk_total","disk_used","memory_total","memory_usage","boot","channel","supervisor","status"].includes(key)).map(([key,val])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(typeof val==="object"?JSON.stringify(val):val)+'</dd></div>').join("")+'</dl></article>').join("");
    return hdr(t("system"),t("systemReadOnly"))+
       '<div class="alert">'+esc(t("updateCaution"))+'</div><div class="system-grid">'+(cards||empty())+'</div>';
  }
  function backupView(){
    if(!state.admin)return hdr(t("backups"))+empty(t("notAdmin"));
    const records=Array.isArray(state.backups)?state.backups:[];
    return hdr(t("backups"),t("managed"))+
    '<div class="alert">'+esc(t("backupCaution"))+'</div>'+
    '<section class="panel"><div class="section-head"><h2>'+esc(t("backups"))+'</h2><button data-safe-action="backup-full">'+esc(t("backupCreate"))+'</button></div>'+
    '<div class="cards">'+(records.map(a=>'<article class="device-card"><strong>'+esc(a.name||a.slug)+'</strong><small>'+esc(a.date||"")+'</small><p>'+esc(a.type||"")+'</p><small>'+esc(a.slug||"")+'</small></article>').join("")||empty())+'</div></section>';
  }
  function usersView(){
    if(!state.admin)return hdr(t("users"))+empty(t("notAdmin"));
    const u=Array.isArray(state.userList)?state.userList:state.userList?.users||[];
    return hdr(t("users"),t("systemReadOnly"))+
    '<div class="cards">'+(u.map(x=>'<article class="device-card"><strong>'+esc(x.name||"")+'</strong><small>'+esc(x.id||"")+'</small><p>'+esc(x.is_admin?"Administrator":"User")+'</p></article>').join("")||empty())+'</div>';
  }
  function assistView(){
    if(!state.agent)return hdr(t("assist"))+empty(t("unknown"));
    return hdr(t("assist"),t("noAudio"))+
    '<section class="panel"><div id="chat-messages" class="chat">'+(state.messages.map(m=>'<p class="'+(m.role==="user"?"mine":"theirs")+'">'+esc(m.text)+'</p>').join(""))+'</div>'+
    '<form data-form="assist"><input name="message" maxlength="500" required autocomplete="off" placeholder="'+esc(t("prompt"))+'"><button type="submit">'+esc(t("send"))+'</button></form></section>';
  }
  function renderContent(){
    if(state.login || document.body.classList.contains("setup-mode"))return;
    nav();
    let result;
    switch(state.view){
      case "home":result=home();break;
      case "people":result=hdr(locale==="bg"?"Хора и присъствие":"People & Presence")+
        '<div class="cards">'+((state.people||[]).map(person=>stat(person.attributes?.friendly_name||person.entity_id,person.state)).join("")||empty())+'</div>';break;
      case "rooms":result=roomsView();break;
      case "devices":case "lighting":case "climate":case "scenes":case "automations":result=entityScreen(state.view);break;
      case "integrations":result=integrationView();break;
      case "apps":result=appsView();break;
      case "updates":result=state.admin ? hdr(locale==="bg"?"Обновявания":"Update Center",tr("Версии на системата","System versions"))+osUpload()+
        '<div class="cards">'+["/os/info","/core/info","/supervisor/info"].map(path=>{
          const item=state.system[path]||{};
          return stat(path.split("/")[1],(item.version||t("unknown"))+" → "+(item.version_latest||t("unknown")));
        }).join("")+'</div>' : empty(t("notAdmin"));break;
      case "system":result=systemView();break;
      case "backups":result=backupView();break;
      case "users":result=usersView();break;
      case "assist":result=assistView();break;
      default:result=empty();
    }
    q("#screen").innerHTML=result;
  }
  function setView(view){
    const allowed=["updates","people","home","rooms","devices","lighting","climate","scenes","automations","integrations","apps","system","backups","users","assist"];
    if(!allowed.includes(view))return;
    state.view=view;state.filter="";state.room="";
    q("#sidebar").classList.remove("mobile-open");
    renderContent();
    if(["integrations","apps","system","updates","backups","users"].includes(view)&&state.admin){
      notice(t("connecting"));
      loadAdmin(view).then(()=>{notice("");renderContent()}).catch(e=>notice(formatError(e),true));
    }
  }
  async function service(id,action){
    if(!validId(id))throw new Error("Invalid entity id");
    const e=state.entities.find(x=>x.entity_id===id);
    if(!controllable(e))throw new Error("Forbidden by STEVORA Manifest or unavailable entity");
    const domain=id.split(".")[0];
    const p={type:"call_service",domain,service:action,target:{entity_id:id}};
    if(action==="climate-up"||action==="climate-down"){
      if(domain!=="climate")throw new Error("Invalid climate action");
      const v=Number(e.attributes?.temperature),lo=Number(e.attributes?.min_temp??5),hi=Number(e.attributes?.max_temp??35);
      const next=v+(action==="climate-up"?1:-1);
      if(!Number.isFinite(next)||next<lo||next>hi)throw new Error("Out of range");
      p.service="set_temperature";p.service_data={temperature:next};
    }else if(action==="toggle"&&!["light","switch","fan"].includes(domain))throw new Error("Invalid toggle");
    else if(action==="trigger"&&domain!=="automation")throw new Error("Invalid trigger");
    else if(action==="turn_on"&&domain!=="scene")throw new Error("Invalid activation");
    await call(p);
    const entities=await call({type:"get_states"});state.entities=(entities||[]).filter(x=>!backlight(x));renderContent();
  }
  async function addonAction(slugId,action){
    if(!state.admin||!slug(slugId))throw new Error(t("notAdmin"));
    const allowed=["install","start","stop","restart","update","uninstall","logs","options","open"];
    if(!allowed.includes(action))throw new Error("Unknown action");
    if(action==="open"){
      const data=await call({type:"supervisor/ingress/info",slug:slugId});
      if(!data.ingress_url)throw new Error(tr("Добавката няма уеб интерфейс през Ingress.","This app has no Ingress interface."));
      const url=new URL(data.ingress_url,location.origin);
      if(url.origin!==location.origin || !url.pathname.startsWith("/api/hassio_ingress/"))throw new Error("Invalid ingress URL");
      const result=await call({type:"supervisor/ingress/session",slug:slugId});
      if(typeof result.session!=="string" || !/^[a-zA-Z0-9_.=-]+$/.test(result.session))throw new Error("Invalid ingress session");
      document.cookie="ingress_session="+result.session+";Path=/api/hassio_ingress/;SameSite=Strict;Secure";
      location.assign(url.href);return;
    }
    if(action==="logs"){
      const data=await coreREST("/api/hassio/addons/"+slugId+"/logs");
      showTextModal("Logs: "+slugId,String(data).slice(-15000));return;
    }
    if(action==="options"){
      const data=await supervisor("/addons/"+slugId+"/info");
      showOptionsModal(slugId,data);return;
    }
    const kind=action==="update"?"/store/addons/"+slugId+"/update":
       action==="install"?"/addons/"+slugId+"/install":
       "/addons/"+slugId+"/"+action;
    const destructive=action==="uninstall"||action==="update"||action==="stop";
    if(destructive){
      const typed=prompt(t("dangerous")+"\n"+slugId+"\nType: "+slugId);
      if(typed!==slugId)return;
    }else if(!confirm(t("confirm")+": "+action+" "+slugId+"?"))return;
    await supervisor(kind,"POST",action==="uninstall"?{remove_config:false}:{});
    await loadAdmin("apps");renderContent();
  }
  function showTextModal(title,text){
    const dialog=document.createElement("dialog");
    dialog.className="details-dialog";
    const heading=document.createElement("h2");heading.textContent=title;
    const pre=document.createElement("pre");pre.textContent=text;
    const close=document.createElement("button");close.textContent="Close";close.addEventListener("click",()=>dialog.close());
    dialog.append(heading,pre,close);
    dialog.addEventListener("close",()=>dialog.remove());
    document.body.append(dialog);dialog.showModal();
  }
  function showOptionsModal(slugId,data) {
    const original=data.options||{};
    const dialog=document.createElement("dialog");dialog.className="details-dialog flow-dialog";
    const title=document.createElement("h2");title.textContent=(data.name||slugId)+" · "+t("details");
    const form=document.createElement("form");
    const readers=[];
    const schema=Array.isArray(data.schema)?data.schema:Object.entries(data.schema||{}).map(([name,type])=>({name,type}));
    const definitions=new Map(schema.map(field=>[field.name,field]));
    for(const name of new Set([...Object.keys(original),...definitions.keys()])){
      if(!name)continue;
      const value=original[name],spec=definitions.get(name)||{};
      const kind=String(spec.type||"");
      const bool=typeof value==="boolean"||kind==="boolean"||kind==="bool";
      const numeric=typeof value==="number"||["integer","float","int","port"].includes(kind);
      const structured=(value!=null&&typeof value==="object")||["list","schema","dict"].includes(kind);
      const label=document.createElement("label");label.textContent=name+(structured?" (JSON)":"");
      const field=document.createElement(structured?"textarea":"input");
      if(!structured)field.type=bool?"checkbox":numeric?"number":/password|secret|token|key/i.test(name+kind)?"password":"text";
      if(numeric)field.step="any";
      if(bool)field.checked=Boolean(value);
      else field.value=value==null?"":structured?JSON.stringify(value,null,2):String(value);
      let changed=false;field.oninput=()=>{changed=true;};
      readers.push(options=>{
        if(!changed)return;
        options[name]=bool?field.checked:numeric?field.valueAsNumber:structured?JSON.parse(field.value):field.value;
        if(numeric&&!Number.isFinite(options[name]))throw new Error(name);
      });
      label.append(field);form.append(label);
    }
    const error=document.createElement("p");error.setAttribute("role","alert");
    const save=document.createElement("button");save.textContent=t("save");
    const close=document.createElement("button");close.type="button";close.textContent=tr("Затвори","Close");close.onclick=()=>dialog.close();
    form.onsubmit=async event=>{
      event.preventDefault();save.disabled=true;
      try{
        const options={...original};readers.forEach(read=>read(options));
        const validation=await supervisor("/addons/"+slugId+"/options/validate","POST",{options});
        if(validation?.valid===false)throw new Error(validation.message||"Invalid options");
        await supervisor("/addons/"+slugId+"/options","POST",{options});
        dialog.close();await loadAdmin("apps");renderContent();
      }catch(e){error.textContent=formatError(e);}finally{save.disabled=false;}
    };
    form.append(save,close);dialog.append(title,form,error);
    dialog.addEventListener("close",()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }
  async function addIntegration(form){
    if(!state.admin)throw new Error(t("notAdmin"));
    const domain=form.querySelector('input[name="domain"]')?.value.trim();
    if(!/^[a-z0-9_]+$/.test(domain||""))throw new Error("Invalid integration domain");
    await openFlow(domain);
  }
  const tr=(bg,en)=>locale==="bg"?bg:en;
  async function openFlow(handler,options=false){
    if(!state.admin)throw new Error(t("notAdmin"));
    const base="/api/config/config_entries/"+(options?"options/flow":"flow");
    const initial=await coreREST(base,"POST",{handler});
    await stevoraFlow({base,initial,title:options?t("details"):handler,request:coreREST,translate:tr,
      finished:async result=>{
        notice(result.type==="abort"?String(result.reason):t("save"),result.type==="abort");
        await loadAdmin("integrations");renderContent();
      }});
  }
  async function editAutomation(entityId){
    if(!state.admin)throw new Error(t("notAdmin"));
    let conf,uuid;
    if(entityId){
      if(!validId(entityId)||!entityId.startsWith("automation."))throw new Error("Bad automation");
      conf=await call({type:"automation/config",entity_id:entityId});
      uuid=String(conf?.id||"");
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(uuid))throw new Error("Automation has no editable YAML id");
    }else{
      uuid=crypto.randomUUID().replaceAll("-","");
      conf={id:uuid,alias:"New STEVORA automation",description:"",
        triggers:[],conditions:[],actions:[],mode:"single"};
    }
    const dialog=document.createElement("dialog");dialog.className="details-dialog";
    const title=document.createElement("h2");title.textContent="STEVORA Automation Editor";
    const text=document.createElement("textarea");text.rows=20;text.value=JSON.stringify(conf,null,2);
    const hint=document.createElement("p");
    hint.textContent="Advanced JSON editor using Home Assistant's validated automation config endpoint.";
    const save=document.createElement("button");save.textContent=t("save");
    save.addEventListener("click",async()=>{
      try{
        const cfg=JSON.parse(text.value);
        if(!cfg||typeof cfg!=="object"||Array.isArray(cfg))throw new Error("Invalid JSON");
        if(!confirm(t("confirm")+" automation "+uuid+"?"))return;
        await coreREST("/api/config/automation/config/"+encodeURIComponent(uuid),"POST",cfg);
        dialog.close();
        const entities=await call({type:"get_states"});
        const readable=new Set((state.stevoraManifest?.entities||[]).map(e=>e.entity_id));
        state.entities=(entities||[]).filter(e=>readable.has(e.entity_id)&&!backlight(e));
        renderContent();
        notice("Automation saved");
      }catch(e){notice(formatError(e),true)}
    });
    const close=document.createElement("button");close.textContent="Close";close.onclick=()=>dialog.close();
    dialog.append(title,hint,text,save,close);
    dialog.addEventListener("close",()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  }
  async function createBackup(){
    if(!state.admin)throw new Error(t("notAdmin"));
    if(!confirm(t("confirm")+": "+t("backupCreate")+"?"))return;
    // Non-destructive backup creation is enabled, but restore is not.
    await supervisor("/backups/new/full","POST",{name:"STEVORA OS test backup"});
    await loadAdmin("backups");renderContent();
  }
  async function chat(message){
    const s=String(message||"").trim().slice(0,500);if(!s)return;
    state.messages.push({role:"user",text:s});
    renderContent();
    let answer;
    try{
      const response=await call({type:"conversation/process",agent_id:state.agent,text:s,language:locale});
      answer=response?.response?.speech?.plain?.speech||t("notSupported");
    }catch(e){answer=formatError(e)}
    state.messages.push({role:"assistant",text:answer});
    state.messages=state.messages.slice(-24);renderContent();
  }
  document.addEventListener("click",async ev=>{
    const btn=ev.target.closest("button");if(!btn)return;
    if(btn.id==="begin-auth"){startAuth();return}
    if(btn.id==="logout"){resetSession();showLogin();return}
    if(btn.id==="lang-toggle"){
      locale=locale==="bg"?"en":"bg";sessionStorage.setItem("stevora.lang",locale);
      if(document.body.classList.contains("setup-mode")){nav();await setup.run();}else renderContent();return;
    }
    if(btn.id==="menu-toggle"){q("#sidebar").classList.toggle("mobile-open");return}
    if(btn.id==="refresh"){if(state.connected)await loadData();return}
    const view=btn.getAttribute("data-view");
    if(view){setView(view);return}
    const area=btn.getAttribute("data-select-room");
    if(area){setView("devices");state.room=area;renderContent();return}
    const entity=btn.getAttribute("data-entity");
    if(entity){
      btn.disabled=true;
      try{await service(entity,btn.getAttribute("data-service"))}
      catch(e){notice(formatError(e),true)}
      finally{btn.disabled=false}
      return;
    }
    const addon=btn.getAttribute("data-addon");
    if(addon){
      btn.disabled=true;
      try{await addonAction(addon,btn.getAttribute("data-addon-action"))}
      catch(e){notice(formatError(e),true)}
      finally{btn.disabled=false}
      return;
    }
    if(btn.hasAttribute("data-automation-new")){
      try{await editAutomation(null)}catch(e){notice(formatError(e),true)}
      return;
    }
    if(btn.hasAttribute("data-automation-edit")){
      try{await editAutomation(btn.getAttribute("data-automation-edit"))}
      catch(e){notice(formatError(e),true)}
      return;
    }
    if(btn.dataset.options){try{await openFlow(btn.dataset.options,true)}catch(e){notice(formatError(e),true)}return;}
    const entry=btn.getAttribute("data-entry");
    if(entry){
      const value=state.configEntries.find(x=>x.entry_id===entry);
      if(value)showTextModal(value.title,JSON.stringify(value,null,2));
      return;
    }
    if(btn.getAttribute("data-safe-action")==="backup-full"){
      try{await createBackup()}catch(e){notice(formatError(e),true)}
    }
  });
  document.addEventListener("change",ev=>{
    if(ev.target.matches("[data-room]")){
      state.room=ev.target.value;renderContent();
    }
  });
  document.addEventListener("input",ev=>{
    if(ev.target.matches("[data-search]")){
      const focus=ev.target;
      const pos=focus.selectionStart;
      state.filter=focus.value;renderContent();
      const next=q("[data-search]");if(next){next.focus();next.setSelectionRange(pos,pos)}
    }
  });
  document.addEventListener("submit",async ev=>{
    const form=ev.target.closest("form[data-form]");if(!form)return;
    ev.preventDefault();
    try{
      if(form.dataset.form==="os-update"){
        const file=form.elements.bundle.files[0];if(!state.admin||!file||!confirm(tr("Инсталиране в неактивния системен дял?","Install to the inactive OS slot?")))return;
        const submit=form.querySelector("button");submit.disabled=true;
        try{await updateRequest(file);await loadAdmin("updates");renderContent();notice(tr("Пакетът е инсталиран. Рестартирай за активиране.","Package installed. Restart to activate."));}finally{submit.disabled=false;}
      }
      if(form.dataset.form==="assist"){const message=form.querySelector('input[name="message"]').value;await chat(message)}
      if(form.dataset.form==="add-integration")await addIntegration(form);
    }catch(e){notice(formatError(e),true)}
  });
  window.addEventListener("unhandledrejection",event=>{notice(formatError(event.reason),true)});
  nav();initAuth().catch(e=>showLogin(formatError(e)));
})();
