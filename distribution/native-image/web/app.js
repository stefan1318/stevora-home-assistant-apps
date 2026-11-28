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
      system:"Система",backups:"Архиви",users:"Потребители",assist:"STEVORA Assist",
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
      authError:"Неуспешна автентикация. Проверете връзката към Core.",
      dangerous:"Операцията може да промени или изтрие системни данни. Потвърди изрично.",
      noActions:"Няма разрешени действия",notSupported:"Тази операция не е внедрена или проверена.",
      stillStarting:"Home Assistant Core още стартира",search:"Търси…",
    },
    en: {
      home:"Home",rooms:"Rooms",devices:"Devices",lighting:"Lighting",climate:"Climate",
      scenes:"Scenes",automations:"Automations",integrations:"Integrations",apps:"Apps",
      system:"System",backups:"Backups",users:"Users",assist:"STEVORA Assist",
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
      authError:"Authentication failed. Check the connection to Core.",
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
    adaptiveCatalog:null,adaptiveStates:new Map(),adaptiveSubscription:null,
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
  const uniqueID = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b=>b.toString(16).padStart(2,"0")).join("");
  let retryTimer, syncTimer, syncSerial=0, connectDelay=1000;
  function resetSession() {
    clearTimeout(retryTimer);clearTimeout(syncTimer);syncTimer=null;syncSerial++;state.voice?.end();
    management.closeAll(); for(const d of document.querySelectorAll("dialog[open]"))d.close();
    document.cookie="ingress_session=;Path=/api/hassio_ingress/;Max-Age=0;SameSite=Strict"+(location.protocol==="https:"?";Secure":"");
    try {sessionStorage.removeItem(authKey);sessionStorage.removeItem("stevora.oauth.state")}catch{}
    state.token=null;state.refresh=null;state.expires=0;state.connected=false;
    if(state.ws){try{state.ws.close()}catch{}}
    state.ws=null;
    for(const pending of state.pending.values())pending.reject(new Error("Session ended"));
    state.pending.clear();
    state.people=[];mapVisible=false;state.agent=null;state.entities=[];state.areas=[];state.registry=[];state.deviceRegistry=[];state.stevoraManifest=null;
    state.configEntries=[];state.apps=[];state.store=[];state.backups=[];state.system={};
    state.adaptiveCatalog=null;state.adaptiveStates.clear();state.adaptiveSubscription=null;
    state.currentUser=null;state.pipeline=null;state.messages=[];state.userList=[];state.admin=false;state.authorized=false;
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
    const nonce=uniqueID();
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
        loginMessage="";notice("");connectDelay=1000;
        state.connected=true;state.login=false;
        q("#conn-indicator").textContent="ONLINE";
        q("#conn-indicator").className="status online";
        q("#connection-label").textContent=tr("Свързано с дома","Connected to home");
        await Promise.all([
          tryCall({type:"subscribe_events",event_type:"state_changed"},null),
          tryCall({type:"stevora/os/v1/manifest/subscribe"},null),
          subscribeAdaptive(ws),
        ]);
        const saved=await tryCall({type:"frontend/get_user_data",key:"stevora_profile"},null);
        if(ws!==state.ws)return;
        if(["en","bg"].includes(saved?.value?.language))locale=saved.value.language;
        await setup.run();
        return;
      }
      if(msg.type==="result"){
        const task=state.pending.get(msg.id);
        if(task){clearTimeout(task.timer);state.pending.delete(msg.id);msg.success?task.resolve(msg.result):task.reject(msg.error||new Error("HA WS command failed"))}
        return;
      }
      if(msg.type==="event" && (msg.event?.manifest_changed ||
          (msg.id===state.adaptiveSubscription && msg.event?.revision))){
        scheduleSync();return;
      }
      if(msg.type==="event" && state.voice?.id===msg.id){state.voice.event(msg.event);return;}
      if(msg.type==="event" && msg.event?.event_type==="state_changed"){
        const e=msg.event.data?.new_state;
        updateAdaptiveReading(msg.event.data?.entity_id,e);
        if(state.view==="people" && /^(person|device_tracker)\./.test(msg.event.data?.entity_id||""))refreshPeople();
        if(!e && msg.event.data?.entity_id){
          state.entities=state.entities.filter(item=>item.entity_id!==msg.event.data.entity_id);
          document.dispatchEvent(new Event("stevora-device-update"));
        }
        if(e?.entity_id && state.stevoraManifest?.entities?.some(item=>item.entity_id===e.entity_id)){
          const i=state.entities.findIndex(v=>v.entity_id===e.entity_id);
          if(i>=0)state.entities[i]=e;else state.entities.push(e);
          document.dispatchEvent(new Event("stevora-device-update"));
          if(["home","rooms","devices","lighting","climate","scenes","automations"].includes(state.view))renderContent();
        }
      }
    });
    ws.addEventListener("close",()=>{if(ws!==state.ws)return;state.connected=false;state.voice?.end();
      for(const button of q("#screen").querySelectorAll(".adaptive-action button,.adaptive-profile button"))button.disabled=true;
      q("#conn-indicator").textContent="OFFLINE";q("#conn-indicator").className="status";rejectPending();if(document.body.classList.contains("setup-mode"))notice(t("stillStarting")+" · "+t("reload"),true);scheduleReconnect(ws);});
  }
  function scheduleReconnect(ws){
    if(!state.token||state.ws!==ws)return;
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>{if(state.ws===ws&&state.token)connect().catch(e=>{notice(formatError(e),true);scheduleReconnect(state.ws);});},connectDelay);
    connectDelay=Math.min(connectDelay*2,30000);
  }
  async function subscribeAdaptive(ws) {
    const id=state.id;
    const result=await tryCall({type:StevoraAdaptive.API+"/subscribe",schema_version:1},null);
    if(ws===state.ws)state.adaptiveSubscription=result?.revision ? id : null;
  }
  function scheduleSync(){
    if(!state.connected||state.login||document.body.classList.contains("setup-mode")||syncTimer)return;
    syncTimer=setTimeout(()=>{syncTimer=null;void loadData();},150);
  }
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleSync();});
  function deviceProfile(id){
    return state.stevoraManifest?.entities?.find(x=>x.entity_id===id);
  }
  function allows(e,key){
    const p=deviceProfile(e?.entity_id);
    return controllable(e) && (p?.controls??p?.available_controls??[]).includes(key);
  }
  function latestEntity(id){
    return state.entities.find(x=>x.entity_id===id);
  }
  function deviceDetails(id){
    openStevoraDevice({id,entity:()=>latestEntity(id),profile:()=>deviceProfile(id),canControl:()=>controllable(latestEntity(id)),call,tr,name:[info(latestEntity(id)),entityArea(latestEntity(id)) && areaName(entityArea(latestEntity(id)))].filter(Boolean).join(" · ")});
  }
  function managementButton(key,bg,en){
    return '<button data-management="'+key+'">'+esc(tr(bg,en))+'</button>';
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
    const socket=state.ws,request=++syncSerial;
    try {
      // Get_states is projected by Core to the current user's permissions.
      const [entities,areas,registry,devices,adaptive]=await Promise.all([
        call({type:"get_states"}),
        tryCall({type:"config/area_registry/list"},[]),
        tryCall({type:"config/entity_registry/list"},[]),
        tryCall({type:"config/device_registry/list"},[]),
        tryCall({type:StevoraAdaptive.API,schema_version:1,language:locale},null),
      ]);
      const people=await tryCall({type:"stevora/os/v1/people"},[]);
      const assistants=await tryCall({type:"conversation/agent/list"}, {agents:[]});
      const agents=assistants.agents || [];
      const preferred=await tryCall({type:"stevora/assistants/resolve"}, {});
      const pipelines=await tryCall({type:"assist_pipeline/pipeline/list"}, {});
      const pipeline=pipelines.pipelines?.find(item=>item.id===(preferred.pipeline_id || pipelines.preferred_pipeline));
      const agent=agents.find(agent=>agent.id===pipeline?.conversation_engine)?.id ||
        (!preferred.pipeline_id && agents.find(agent=>agent.id==="conversation.home_assistant")?.id) || null;
      const manifest=await tryCall({type:"stevora/os/v1/manifest",language:locale},null);
      if(socket!==state.ws||request!==syncSerial)return;
      state.agent=agent||pipeline?.conversation_engine;state.pipeline=pipeline;state.people=Array.isArray(people)?people:[];
      state.stevoraManifest=manifest?.installation_id && Array.isArray(manifest.entities)?manifest:null;
      state.adaptiveCatalog=StevoraAdaptive.valid(adaptive,state.stevoraManifest?.installation_id)?adaptive:null;
      const ids=new Set((state.adaptiveCatalog?.capabilities||[]).map(item=>item.entity_id));
      state.adaptiveStates=new Map((Array.isArray(entities)?entities:[])
        .filter(entity=>ids.has(entity.entity_id)).map(entity=>[entity.entity_id,entity]));
      const activeCategory=state.view.startsWith("system:")?state.view.slice(7):null;
      if(activeCategory && !StevoraAdaptive.categories(state.adaptiveCatalog).has(activeCategory))state.view="devices";
      const readable=new Set((state.stevoraManifest?.entities||[]).map(e=>e.entity_id));
      state.entities=(Array.isArray(entities)?entities:[])
        .filter(e=>readable.has(e.entity_id)&&!backlight(e));
      state.areas=Array.isArray(areas)?areas:[];
      state.registry=Array.isArray(registry)?registry:[];
      state.deviceRegistry=Array.isArray(devices)?devices:[];
      state.connected=true;
      // HA enforces admin server-side on this command. Never infer from a UI role.
      const user=await tryCall({type:"auth/current_user"},null);
      if(socket!==state.ws||request!==syncSerial)return;
      state.admin=user?.is_admin===true;state.currentUser=user;
      if(state.admin)await loadAdmin(state.view);
      renderContent();
      document.dispatchEvent(new Event("stevora-device-update"));
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
  function nativeRooms(){
    return state.adaptiveCatalog?.rooms||state.stevoraManifest?.rooms||state.areas;
  }
  const roomId=room=>room.area_id||room.id;
  const localizedRoom=room=>room.translations?.[locale]||room.name;
  const areaName=id=>nativeRooms().find(room=>roomId(room)===id)?.translations?.[locale] ||
    nativeRooms().find(room=>roomId(room)===id)?.name ||
    state.areas.find(a=>a.area_id===id)?.name||id||t("roomAll");
  function entityArea(e){
    const r=state.registry.find(x=>x.entity_id===e.entity_id);
    let areaId=deviceProfile(e.entity_id)?.area_id||r?.area_id;
    if(!areaId && r?.device_id)areaId=state.deviceRegistry.find(d=>d.id===r.device_id)?.area_id;
    return areaId||"";
  }
  function visibleEntities(domain){
    return state.entities.filter(e=>(!domain||domain==="all"||e.entity_id.startsWith(domain+"."))&&isAllowed(e)&&(!state.room||entityArea(e)===state.room));
  }
  function nav(){
    const map={updates:locale==="bg"?"Обновявания":"Update Center",people:locale==="bg"?"Хора и присъствие":"People & Presence",home:t("home"),rooms:t("rooms"),devices:t("devices"),lighting:t("lighting"),climate:t("climate"),scenes:t("scenes"),automations:t("automations"),integrations:t("integrations"),apps:t("apps"),system:t("system"),backups:t("backups"),users:t("users"),assist:t("assist")};
    const navigation=q("#navigation");
    const categories=StevoraAdaptive.categories(state.adaptiveCatalog);
    navigation.querySelectorAll("[data-adaptive-navigation]").forEach(btn=>btn.remove());
    for(const [category,labels] of categories){
      if(category==="climate" || category==="lighting")continue;
      const view="system:"+category;
      map[view]=labels[locale]||category;
      const button=document.createElement("button");
      button.dataset.view=view;button.dataset.adaptiveNavigation="";
      button.append(document.createElement("span"));
      navigation.insertBefore(button,navigation.querySelector('[data-view="scenes"]'));
    }
    navigation.querySelectorAll("[data-view]").forEach(btn=>{
      const view=btn.getAttribute("data-view");
      btn.classList.toggle("selected",view===state.view);
      if(view==="lighting"||view==="climate")btn.hidden=state.adaptiveCatalog
        ? !categories.has(view)
        : !state.stevoraManifest?.domain_mappings?.[view]?.length;
      const label=btn.querySelector("span");if(label)label.textContent=map[view]||view;
    });
    q("#current-title").textContent="STEVORA · "+map[state.view];
    q("#lang-toggle").textContent=locale.toUpperCase();
  }
  function stat(title,value){return '<article class="metric"><small>'+esc(title)+'</small><strong>'+esc(value)+'</strong></article>'}
  function hdr(title,subtitle=""){return '<div class="section-head"><h1>'+esc(title)+'</h1><small>'+esc(subtitle)+'</small></div>'}
  function empty(message=t("noData")){return '<p class="empty">'+esc(message)+'</p>'}
  function toolbar(type, rooms=state.stevoraManifest?.rooms||state.areas){
    const options=[["",t("roomAll")],...rooms.map(a=>[a.area_id||a.id,a.name])];
    return '<div class="filters"><select data-room>'+options.map(([id,name])=>'<option value="'+esc(id)+'" '+(state.room===id?"selected":"")+'>'+esc(name)+'</option>').join("")+'</select><input data-search type="search" placeholder="'+esc(t("search"))+'" value="'+esc(state.filter)+'"></div>'
  }
  function matches(name){return !state.filter || String(name).toLocaleLowerCase().includes(state.filter.toLocaleLowerCase())}
  function info(e){
    const id=e.entity_id,reg=state.registry.find(x=>x.entity_id===id);
    return [deviceProfile(id)?.name,reg?.name,e.attributes?.friendly_name].find(n=>n && n!==id)||id.split(".").pop().replaceAll("_"," ");
  }
  function card(e){
    const id=e.entity_id,domain=id.split(".")[0],name=info(e);
    if(!matches(name+" "+id))return "";
    const action=(s,label,disabled=false)=>'<button data-entity="'+esc(id)+'" data-service="'+s+'" '+(disabled?"disabled":"")+'>'+esc(label)+'</button>';
    let buttons="";
    if(["light","switch","fan"].includes(domain) && allows(e,"toggle"))buttons+=action("toggle",e.state==="off"?t("turnOn"):t("turnOff"));
    if(domain==="climate"){
      const v=Number(e.attributes?.temperature),lo=Number(e.attributes?.min_temp??5),hi=Number(e.attributes?.max_temp??35);
      buttons+='<span class="temp-readout">'+esc(t("target"))+': '+(Number.isFinite(v)?v+"°":"—")+'</span>';
      if(allows(e,"temperature")&&Number.isFinite(v)&&v>=lo&&v<=hi){
        buttons+=action("climate-down","−1°",v-1<lo)+action("climate-up","+1°",v+1>hi);
      }
    }
    if(domain==="scene" && controllable(e))buttons+=action("turn_on",t("activate"));
    if(domain==="automation" && controllable(e))buttons+=action("trigger",t("trigger"));
    if(domain==="automation" && state.admin)
      buttons+='<button data-automation-edit="'+esc(id)+'">'+esc(tr("Редактирай","Edit"))+'</button>';
    const stateLabel=consumerState(e.state,tr);
    const current=domain==="climate"&&e.attributes?.current_temperature!=null?e.attributes.current_temperature+"° · ":"";
    return '<article class="device-card" data-detail="'+esc(id)+'"><div class="entity-head"><span class="tile-icon">'+(profileGlyph(deviceProfile(id)?.icon)||{light:"☼",climate:"◈",fan:"✺",switch:"◉",scene:"✦",automation:"◇"}[domain]||"▣")+'</span><div><button class="device-open" data-open-detail="'+esc(id)+'">'+esc(name)+'</button></div></div><div class="state-value">'+esc(current+stateLabel)+'</div><div class="actions">'+buttons+'</div></article>';
  }
  function roomTiles(rooms){
    const devices=state.adaptiveCatalog?.capabilities||state.entities;
    return rooms.map(room=>{
      const id=roomId(room);
      const count=devices.filter(device=>state.adaptiveCatalog?device.area_id===id:
        isAllowed(device)&&entityArea(device)===id).length;
      return '<button class="room-tile" data-select-room="'+esc(id)+'"><strong>'+
        esc(localizedRoom(room))+'</strong><small>'+count+' '+esc(t("devices"))+'</small></button>';
    }).join("")||empty();
  }
  function home(){
    const available=count();
    const climates=state.entities.filter(e=>e.entity_id.startsWith("climate.")&&isAllowed(e));
    const rooms=nativeRooms();
    return hdr("STEVORA "+t("home"))+
    '<div class="metrics">'+stat(t("total"),state.entities.length)+stat(t("online"),available)+stat(t("rooms"),rooms.length)+stat(t("climate"),climates.length)+'</div>'+
    '<section class="panel"><h2>'+esc(t("rooms"))+'</h2><div class="room-grid">'+roomTiles(rooms)+'</div></section>'+
    '<section class="panel"><h2>'+esc(t("climate"))+'</h2><div class="cards">'+(climates.slice(0,4).map(card).join("")||empty())+'</div></section>';
  }
  function entityScreen(view){
    const domain={lighting:"light",climate:"climate",scenes:"scene",automations:"automation"}[view]||"all";
    const name=t(view)||t("devices");
    const list=visibleEntities(domain);
    return hdr(name,list.length+" "+t("devices"))+(view==="devices"&&state.admin?'<div class="actions">'+managementButton("devices","Управление на устройства","Device Manager")+managementButton("visibility","Видимост","Visibility")+'</div>':"")+
      (view==="automations"&&state.admin?
        '<div class="actions"><button data-automation-new="1">'+esc(tr("Нова автоматизация","New automation"))+'</button></div>':"")+
      toolbar()+'<div class="cards">'+(list.map(card).join("")||empty())+'</div>';
  }
  function roomsView(){
    const rooms=nativeRooms();
    return hdr(t("rooms"))+(state.admin?managementButton("rooms","Управление на помещения","Rooms Manager"):"")+'<div class="room-grid">'+roomTiles(rooms)+'</div>';
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
  async function updateRequest(file,release){
    const response=await fetch("/stevora-update"+(release?"?release="+encodeURIComponent(release):""),{method:file||release?"POST":"GET",
      headers:{Authorization:"Bearer "+state.token,...(file||release?{"X-Stevora-Update-Approval":"install"}:{}),...(file?{"Content-Type":"application/octet-stream"}:{})},
      body:file||undefined,cache:"no-store"});
    if(!response.ok)throw new Error((await response.text()).slice(0,160));return response;
  }
  function osUpload(){
    const info=state.updateInfo;
    const status=info?.publisher_configured?(info.status||"idle"):tr("Необходим е доверен сертификат на издателя.","A trusted publisher certificate is required.");
    return '<section class="panel"><h2>STEVORA OS Update</h2><p>'+esc(status)+'</p>'+(info?.downloaded_release?'<form data-form="os-release"><button>'+esc(tr("Инсталирай ","Install ")+info.downloaded_release)+'</button></form>':'')+(info?.manual_upload_allowed!==false?'<form class="update-upload" data-form="os-update"><input type="file" name="bundle" accept=".raucb" required><button '+(!info?.publisher_configured?'disabled':'')+'>'+esc(tr("Инсталирай подписан пакет","Install signed bundle"))+'</button></form>':'')+'</section>';
  }
  function systemView(){
    if(!state.admin)return hdr(t("system"))+empty(t("notAdmin"));
    const cards=Object.entries(state.system).map(([k,data])=>
      '<article class="system-card"><h2>'+esc(k.replace("/","").replace("/"," · "))+'</h2><dl>'+
      Object.entries(data||{}).filter(([key,val])=>["version","version_latest","update_available","state","healthy","supported","operating_system","hostname","arch","disk_total","disk_used","memory_total","memory_usage","boot","channel","supervisor","status"].includes(key)).map(([key,val])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(typeof val==="object"?JSON.stringify(val):val)+'</dd></div>').join("")+'</dl></article>').join("");
    return hdr(t("system"))+'<section class="panel"><div class="actions">'+
       managementButton("general","Дом и регион","Home & region")+managementButton("network","Мрежа","Network")+
       managementButton("check","Провери конфигурацията","Check configuration")+managementButton("coreRestart","Рестартирай Core","Restart Core")+
       managementButton("coreUpdate","Обнови Core","Update Core")+managementButton("supervisorUpdate","Обнови Supervisor","Update Supervisor")+
       managementButton("reboot","Рестарт на хоста","Reboot host")+managementButton("shutdown","Изключи хоста","Shut down host")+
       coreSettings("/config/dashboard","Всички настройки на Core","All Core settings")+'</div></section>'+
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
  function coreSettings(path,bg,en){
    return '<button data-core-settings="'+esc(path)+'">'+esc(tr(bg,en))+'</button>';
  }
  function usersView(){
    const actions=managementButton("profile","Моят профил","My profile")+managementButton("password","Смяна на парола","Change password")+
      managementButton("issueToken","Генерирай дълготраен токен","Generate long-lived access token")+managementButton("revokeToken","Отмени токен","Revoke token")+
      coreSettings("/profile/security","Сигурност и MFA","Security & MFA");
    const profile=hdr(t("users"),state.currentUser?.name||"")+'<section class="panel"><div class="actions">'+actions+'</div></section>';
    if(!state.admin)return profile;
    const u=Array.isArray(state.userList)?state.userList:state.userList?.users||[];
    return profile+managementButton("accounts","Управление на акаунти","Manage accounts")+
    '<div class="cards">'+(u.map(x=>'<article class="device-card"><strong>'+esc(x.name||"")+'</strong><small>'+esc(x.id||"")+'</small><p>'+esc(x.is_owner||x.group_ids?.includes("system-admin")?"Administrator":"User")+'</p></article>').join("")||empty())+'</div>';
  }
  function assistView(){
    const top=hdr("STEVORA Assist")+(state.admin?'<div class="actions">'+managementButton("assist","Настройки на асистентите","Assist Manager")+coreSettings("/config/voice-assistants/assistants","Гласови асистенти","Voice pipelines")+'</div>':"");
    if(!state.agent)return top+empty(tr("Няма достъпен разговорен агент.","No available conversation agent."));
    return top+voiceButton()+
    '<section class="panel"><div id="chat-messages" class="chat">'+(state.messages.map(m=>'<p class="'+(m.role==="user"?"mine":"theirs")+'">'+esc(m.text)+'</p>').join(""))+'</div>'+
    '<form data-form="assist"><input name="message" maxlength="500" required autocomplete="off" placeholder="'+esc(t("prompt"))+'"><button type="submit">'+esc(t("send"))+'</button></form></section>';
  }
  let presenceTimer=0, presenceSerial=0;
  function refreshPeople(){
    const socket=state.ws, serial=++presenceSerial;
    clearTimeout(presenceTimer);
    presenceTimer=setTimeout(async()=>{
      const people=await tryCall({type:"stevora/os/v1/people"},null);
      if(socket===state.ws && serial===presenceSerial && state.view==="people" && Array.isArray(people)){
        const changed=JSON.stringify(state.people||[])!==JSON.stringify(people);
        if(changed){state.people=people;renderContent();}
      }
    },150);
  }
  let mapVisible=false, presenceZoomDelta=0, presencePanX=0, presencePanY=0;
  function presenceView(){
    const people=state.people||[];
    const points=people.filter(p=>Number.isFinite(p.attributes?.latitude)&&Math.abs(p.attributes.latitude)<=85.05&&Number.isFinite(p.attributes?.longitude)&&Math.abs(p.attributes.longitude)<=180);
    const name=p=>p.attributes?.friendly_name||p.entity_id.slice(7).replaceAll("_"," ");
    let html=hdr(tr("Хора и присъствие","People & Presence"),tr("Споделени позиции и актуални статуси","Shared locations and current statuses"));
    if(points.length && !mapVisible)html+='<div class="presence-intro"><p>'+esc(tr("Картата зарежда външни OpenStreetMap плочки само след твое действие.","Map tiles are requested from OpenStreetMap only after you choose to view the map."))+'</p><button class="primary" id="show-presence-map">'+esc(tr("Покажи карта","Show map"))+'</button></div>';
    if(points.length && mapVisible){
      const xs=points.map(p=>(p.attributes.longitude+180)/360),ys=points.map(p=>(1-Math.asinh(Math.tan(p.attributes.latitude*Math.PI/180))/Math.PI)/2);
      const sorted=[...xs].sort((a,b)=>a-b);let cut=sorted[0],gap=1-sorted.at(-1)+cut;
      for(let i=1;i<sorted.length;i++){const delta=sorted[i]-sorted[i-1];if(delta>gap){cut=sorted[i];gap=delta;}}
      xs.forEach((x,i)=>{if(x<cut)xs[i]+=1;});
      const span=Math.max((Math.max(...xs)-Math.min(...xs))/650,(Math.max(...ys)-Math.min(...ys))/290,1/(256*65536));
      const baseZoom=Math.max(1,Math.min(16,Math.floor(Math.log2(1/(256*span)))));
      const zoom=Math.max(1,Math.min(18,baseZoom+presenceZoomDelta)),count=2**zoom,scale=count*256;
      const left=(Math.min(...xs)+Math.max(...xs))*scale/2-400+presencePanX,top=(Math.min(...ys)+Math.max(...ys))*scale/2-190+presencePanY;
      html+='<div class="presence-map-shell"><div class="presence-map-toolbar"><span>'+esc(tr("Карта на присъствието","Presence map"))+'</span><div class="presence-map-actions"><button type="button" data-presence-map="out" aria-label="'+esc(tr("Намали мащаба","Zoom out"))+'">−</button><span class="presence-zoom">z'+zoom+'</span><button type="button" data-presence-map="in" aria-label="'+esc(tr("Увеличи мащаба","Zoom in"))+'">+</button><button type="button" data-presence-map="reset">'+esc(tr("Центрирай","Recenter"))+'</button><button type="button" data-presence-map="hide">'+esc(tr("Скрий","Hide"))+'</button></div></div>';
      html+='<svg class="presence-map" id="presence-map-canvas" viewBox="0 0 800 380" role="img" aria-label="'+esc(tr("Споделени позиции","Shared locations"))+'">';
      for(let x=Math.floor(left/256);x<=(left+800)/256;x++)for(let y=Math.max(0,Math.floor(top/256));y<count&&y<=(top+380)/256;y++){
        html+='<image x="'+(x*256-left)+'" y="'+(y*256-top)+'" width="256" height="256" referrerpolicy="origin" href="https://tile.openstreetmap.org/'+zoom+'/'+((x%count+count)%count)+'/'+y+'.png"/>';
      }
      const clusters=[];
      points.forEach((p,i)=>{
        const x=xs[i]*scale-left,y=ys[i]*scale-top;
        const target=clusters.find(c=>Math.hypot(c.x-x,c.y-y)<27);
        if(target){target.members.push(p);}else{clusters.push({x,y,members:[p]});}
      });
      clusters.forEach(c=>{
        const names=c.members.map(name),title=esc(names.join(", "));
        const multi=c.members.length>1;
        html+='<g class="presence-marker"><title>'+title+'</title><circle cx="'+c.x+'" cy="'+c.y+'" r="'+(multi?16:10)+'" class="'+(multi?'presence-cluster':'presence-dot')+'"/>';
        if(multi)html+='<text class="presence-count" x="'+c.x+'" y="'+(c.y+5)+'" text-anchor="middle">'+c.members.length+'</text>';
        else html+='<text class="presence-label" x="'+(c.x+17)+'" y="'+(c.y-11)+'">'+esc(names[0])+'</text>';
        html+='</g>';
      });
      html+='</svg><div class="presence-map-footer"><span>'+esc(tr("Плъзни картата за преместване · +/− за мащаб","Drag to move · +/− to zoom"))+'</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></div></div>';
    }
    html+='<div class="presence-summary">'+esc(tr("Хора","People"))+': <strong>'+people.length+'</strong> · '+esc(tr("Със споделена позиция","Sharing location"))+': <strong>'+points.length+'</strong></div>';
    return html+'<div class="cards presence-people-cards">'+(people.map(p=>{
      const a=p.attributes||{},stamp=p.last_updated?new Date(p.last_updated).toLocaleString(locale):"";
      const label=name(p),initial=label.trim().slice(0,1).toUpperCase(),located=points.includes(p);
      return '<article class="device-card presence-person"><div class="presence-person-head"><span class="presence-avatar" aria-hidden="true">'+esc(initial)+'</span><div><strong>'+esc(label)+'</strong><span class="presence-state">'+esc(consumerState(p.state,tr))+'</span></div></div><small>'+esc(located?[stamp,Number.isFinite(a.gps_accuracy)?"± "+a.gps_accuracy+" m":""].filter(Boolean).join(" · "):tr("Няма споделена позиция","No shared location"))+'</small></article>';
    }).join("")||empty())+'</div>';
  }
  function adaptiveView(){
    if(!state.adaptiveCatalog)return false;
    if(state.view==="devices" || state.view.startsWith("system:"))return true;
    return ["climate","lighting"].includes(state.view)
      && !state.stevoraManifest?.domain_mappings?.[state.view]?.length;
  }
  function renderAdaptive(){
    const catalog=state.adaptiveCatalog;
    const category=state.view.startsWith("system:")?state.view.slice(7):state.view==="devices"?null:state.view;
    const title=StevoraAdaptive.categories(catalog).get(category)?.[locale]||t("devices");
    const items=StevoraAdaptive.rows(catalog,category,state.room,state.filter,locale);
    const managementActions=state.admin?'<div class="actions">'+
      managementButton("devices","Управление на устройства","Device Manager")+
      managementButton("visibility","Видимост","Visibility")+'</div>':"";
    return hdr(title)+managementActions+toolbar("devices",catalog.rooms)+(items.length
      ? StevoraAdaptive.render(items,state.adaptiveStates,state.connected,locale,value=>consumerState(value,tr),catalog)
      : empty());
  }
  function updateAdaptiveReading(id,snapshot){
    const item=state.adaptiveCatalog?.capabilities.find(row=>row.entity_id===id);
    if(!item)return;
    if(snapshot)state.adaptiveStates.set(id,snapshot);else state.adaptiveStates.delete(id);
    if(!adaptiveView())return;
    const card=[...q("#screen").querySelectorAll("[data-capability-card]")]
      .find(node=>node.dataset.capabilityCard===item.id);
    if(!card)return;
    for(const node of card.querySelectorAll("[data-observation]")){
      node.textContent=StevoraAdaptive.reading(item,snapshot,node.dataset.observation,locale,value=>consumerState(value,tr));
    }
    if(!snapshot || ["unavailable","unknown"].includes(snapshot.state)){
      for(const button of card.querySelectorAll(".adaptive-action button"))button.disabled=true;
    }
  }
  function renderContent(){
    if(state.login || document.body.classList.contains("setup-mode"))return;
    nav();
    let result;
    if(adaptiveView())result=renderAdaptive();
    else switch(state.view){
      case "home":result=home();break;
      case "people":result=presenceView();break;
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
    const expanded=new Set([...q("#screen").querySelectorAll("details[data-capability-card][open]")]
      .map(node=>node.dataset.capabilityCard));
    q("#screen").innerHTML=result;
    for(const node of q("#screen").querySelectorAll("details[data-capability-card]")){
      node.open=expanded.has(node.dataset.capabilityCard);
    }
    const showMap=q("#show-presence-map");if(showMap)showMap.onclick=()=>{mapVisible=true;renderContent();};
    q("#screen").querySelectorAll("[data-presence-map]").forEach(btn=>btn.onclick=()=>{
      const action=btn.dataset.presenceMap;
      if(action==="in")presenceZoomDelta=Math.min(12,presenceZoomDelta+1);
      if(action==="out")presenceZoomDelta=Math.max(-16,presenceZoomDelta-1);
      if(action==="reset"){presenceZoomDelta=0;presencePanX=0;presencePanY=0;}
      if(action==="hide")mapVisible=false;
      renderContent();
    });
    const mapCanvas=q("#presence-map-canvas");
    if(mapCanvas){
      let drag=null;
      mapCanvas.addEventListener("pointerdown",ev=>{
        if(ev.button!==0)return;
        drag={x:ev.clientX,y:ev.clientY};
        mapCanvas.setPointerCapture(ev.pointerId);
      });
      mapCanvas.addEventListener("pointerup",ev=>{
        if(!drag)return;
        const rect=mapCanvas.getBoundingClientRect();
        if(rect.width && rect.height){
          presencePanX-=(ev.clientX-drag.x)*800/rect.width;
          presencePanY-=(ev.clientY-drag.y)*380/rect.height;
        }
        drag=null;renderContent();
      });
      mapCanvas.addEventListener("pointercancel",()=>{drag=null;});
    }
  }
  function setView(view){
    const allowed=["updates","people","home","rooms","devices","lighting","climate","scenes","automations","integrations","apps","system","backups","users","assist"];
    if(!allowed.includes(view) && !(view.startsWith("system:")
        && StevoraAdaptive.categories(state.adaptiveCatalog).has(view.slice(7))))return;
    if(state.view==="assist"&&view!=="assist")state.voice?.end();
    state.view=view;if(view==="people")refreshPeople();state.filter="";state.room="";
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
    if(action==="toggle"&&!allows(e,"toggle") || action.startsWith("climate-")&&!allows(e,"temperature"))throw Error(t("noPermission"));
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
    const entities=await call({type:"get_states"});state.entities=(entities||[]).filter(x=>deviceProfile(x.entity_id)&&!backlight(x));renderContent();
  }
  async function addonAction(slugId,action){
    if(!state.admin||!slug(slugId))throw new Error(t("notAdmin"));
    const allowed=["install","start","stop","restart","update","uninstall","logs","options","open"];
    if(!allowed.includes(action))throw new Error("Unknown action");
    if(action==="open"){
      const data=await call({type:"supervisor/ingress/info",slug:slugId}).catch(error=>{
        if(error?.code!=="unknown_command")throw error;
        return supervisor("/addons/"+slugId+"/info");
      });
      if(!data.ingress_url)throw new Error(tr("Добавката няма уеб интерфейс през Ingress.","This app has no Ingress interface."));
      const url=new URL(data.ingress_url,location.origin);
      if(url.origin!==location.origin || !url.pathname.startsWith("/api/hassio_ingress/"))throw new Error("Invalid ingress URL");
      const result=await call({type:"supervisor/ingress/session",slug:slugId}).catch(error=>{
        if(error?.code!=="unknown_command")throw error;
        return supervisor("/ingress/session","POST",{});
      });
      if(typeof result.session!=="string" || !/^[a-zA-Z0-9_+.=/\-]+$/.test(result.session))throw new Error("Invalid ingress session");
      document.cookie="ingress_session="+result.session+";Path=/api/hassio_ingress/;SameSite=Strict"+(location.protocol==="https:"?";Secure":"");
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
        const validation=await supervisor("/addons/"+slugId+"/options/validate","POST",options);
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
  const management=createStevoraManagement({call,supervisor,rest:coreREST,tr,refresh:loadData,currentLanguage:()=>locale,
    setLanguage:value=>{locale=value;sessionStorage.setItem("stevora.lang",value);}});
  function openCoreSettings(path,label){
    if(!["/config/dashboard","/config/voice-assistants/assistants","/profile/security"].includes(path))return;
    const d=document.createElement("dialog");d.className="settings-frame details-dialog";
    const header=document.createElement("header"),name=document.createElement("strong");
    name.textContent="STEVORA · "+label;
    const direct=document.createElement("a");direct.href=path;direct.target="_blank";direct.rel="noopener";direct.textContent=tr("Нов раздел","Open tab");
    const close=document.createElement("button");close.textContent=tr("Затвори","Close");close.onclick=()=>d.close();
    const frame=document.createElement("iframe");frame.title=label;frame.src=path;header.append(name,direct,close);d.append(header,frame);
    d.onclose=()=>{d.remove();scheduleSync();};document.body.append(d);d.showModal();
  }
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
      const response=await call({type:"automation/config",entity_id:entityId});
      conf=response.config??response;
      uuid=String(conf?.id||"");
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(uuid))throw new Error("Automation has no editable YAML id");
    }else{
      uuid=uniqueID().replaceAll("-","");
      conf={id:uuid,alias:"New STEVORA automation",description:"",
        triggers:[],conditions:[],actions:[],mode:"single"};
    }
    const dialog=document.createElement("dialog"); dialog.className="details-dialog flow-dialog";
    const form=document.createElement("form");
    const field=(caption,input)=>{const label=document.createElement("label");label.textContent=caption; label.append(input); form.append(label);return input;};
    const pick=(caption,options,initial)=>{
      const input=document.createElement("select");
      input.add(new Option(tr("Избери…","Choose…"),""));
      for(const [value,label] of options)input.add(new Option(label,value));
      input.required=true;input.value=initial||"";return field(caption,input);
    };
    const name=field(tr("Име","Name"),document.createElement("input"));name.required=true;name.value=entityId?conf.alias||"":"";
    const devices=state.entities.filter(e=>isAllowed(e)&&!backlight(e));
    const names=list=>list.map(e=>{const area=entityArea(e),room=(state.stevoraManifest?.rooms||state.areas).find(r=>(r.id||r.area_id)===area);return [e.entity_id,[info(e),room?.name].filter(Boolean).join(" · ")];}).sort((a,b)=>a[1].localeCompare(b[1]));
    let source,to,target,action;
    const triggers=conf.triggers??conf.trigger,actions=conf.actions??conf.action;
    const when=triggers?.[0],then=actions?.[0],command=then?.action??then?.service;
    const simple=Array.isArray(triggers)&&triggers.length===1&&Array.isArray(actions)&&actions.length===1&&
      Object.keys(when||{}).every(k=>["platform","trigger","entity_id","to"].includes(k))&&
      (when?.platform??when?.trigger)==="state"&&["on","off"].includes(when.to)&&typeof when.entity_id==="string"&&
      Object.keys(then||{}).every(k=>["action","service","target"].includes(k))&&Object.keys(then?.target||{}).length===1&&
      typeof then.target.entity_id==="string"&&[then.target.entity_id.split(".")[0]+".turn_on",then.target.entity_id.split(".")[0]+".turn_off"].includes(command);
    if(!entityId||simple){
      source=pick(tr("Когато устройството","When this device"),names(devices.filter(e=>["binary_sensor","switch","light","fan","input_boolean"].includes(e.entity_id.split(".")[0]))));
      to=pick(tr("Премине в състояние","Changes to"),[["on",tr("Включено","On")],["off",tr("Изключено","Off")]]);
      target=pick(tr("Управлявай устройство","Control device"),names(devices.filter(e=>allows(e,"toggle"))));
      action=pick(tr("Действие","Action"),[["turn_on",t("turnOn")],["turn_off",t("turnOff")]]);
      if(simple){source.value=when.entity_id;to.value=when.to;target.value=then.target.entity_id;action.value=command.split(".")[1];}
    }
    const save=document.createElement("button");save.textContent=t("save");form.append(save);
    const err=document.createElement("p");err.setAttribute("role","alert");form.append(err);
    form.onsubmit=async event=>{
      event.preventDefault();if(save.disabled)return;save.disabled=true;
      try{
        let cfg={...conf,alias:name.value.trim()}; delete cfg.id;
        if(!cfg.alias)throw Error();
        if(entityId){const latest=await call({type:"automation/config",entity_id:entityId});if(JSON.stringify(latest.config??latest)!==JSON.stringify(conf))throw Error();}
        if(source){
          delete cfg.trigger;delete cfg.action;
          if(!source.value||!allows(latestEntity(target.value),"toggle"))throw Error();
          cfg.triggers=[{trigger:"state",entity_id:source.value,to:to.value}];
          cfg.actions=[{action:target.value.split(".")[0]+"."+action.value,target:{entity_id:target.value}}];
        }
        await coreREST("/api/config/automation/config/"+encodeURIComponent(uuid),"POST",cfg);
        dialog.close();notice(tr("Автоматизацията е записана","Automation saved"));
      }catch{err.textContent=tr("Записът е неуспешен. Провери избора и връзката.","Could not save. Check your choices and connection.");}
      finally{save.disabled=false;}
    };
    const cancel=document.createElement("button");cancel.textContent=tr("Отказ","Cancel");cancel.onclick=()=>dialog.close();
    dialog.append(form,cancel);dismissOnBackdrop(dialog);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
  }
  async function createBackup(){
    if(!state.admin)throw new Error(t("notAdmin"));
    if(!confirm(t("confirm")+": "+t("backupCreate")+"?"))return;
    // Non-destructive backup creation is enabled, but restore is not.
    await supervisor("/backups/new/full","POST",{name:"STEVORA OS test backup"});
    await loadAdmin("backups");renderContent();
  }
  function voiceButton(){
    if(!state.pipeline?.stt_engine)return "";
    if(!navigator.mediaDevices?.getUserMedia)return '<p>'+esc(tr("За микрофон използвай мобилното приложение или HTTPS.","Use the mobile app or HTTPS for microphone access."))+'</p>';
    return '<button data-voice>'+esc(state.voice?tr("Спри записа","Stop recording"):tr("Говори със STEVORA","Speak to STEVORA"))+'</button>';
  }
  async function toggleVoice(){
    if(state.voice){state.voice.stop();return;}
    const ws=state.ws,pipeline=state.pipeline;
    if(!pipeline?.stt_engine||!state.connected)return;
    let stream,context,processor,source,handler,stopped=false,closed=false,timer;
    const stop=()=>{
      stopped=true;
      if(handler!=null&&ws.readyState===WebSocket.OPEN){ws.send(Uint8Array.of(handler));handler=null;}
      if(processor){processor.onaudioprocess=null;processor.disconnect();processor=null;}
      source?.disconnect();source=null;stream?.getTracks().forEach(track=>track.stop());
      if(context && context.state!=="closed")void context.close().catch(()=>{});context=null;
    };
    const end=()=>{closed=true;stop();clearTimeout(timer);if(state.voice===voice){state.voice=null;if(state.view==="assist")renderContent();}};
    const voice={id:null,end,stop,event(ev){
      if(!ev||closed)return;
      const v=ev.data||{};
      if(ev.type==="run-start"){
        handler=v.runner_data?.stt_binary_handler_id;
        if(stopped)stop();
      }
      if(ev.type==="stt-end"){stop();if(v.stt_output?.text)state.messages.push({role:"user",text:v.stt_output.text});}
      if(ev.type==="intent-end"){
        const answer=v.intent_output?.response?.speech?.plain?.speech;
        if(answer)state.messages.push({role:"assistant",text:answer});
      }
      if(ev.type==="tts-end"&&v.tts_output?.url){
        const url=new URL(v.tts_output.url,location.origin);
        if(url.origin===location.origin)new Audio(url.href).play().catch(()=>{});
      }
      if(ev.type==="error"){notice(v.message||v.code||t("error"),true);end();}
      if(ev.type==="run-end")end();
      if(state.view==="assist")renderContent();
    }};
    state.voice=voice;renderContent();
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1}});
      if(closed||stopped||ws!==state.ws||!state.connected){end();return;}
      context=new AudioContext();await context.resume();
      if(closed||stopped){end();return;}
      source=context.createMediaStreamSource(stream);
      processor=context.createScriptProcessor(2048,1,1);
      processor.onaudioprocess=e=>{
        if(handler==null||stopped||ws.readyState!==WebSocket.OPEN)return;
        const samples=e.inputBuffer.getChannelData(0),buf=new ArrayBuffer(1+samples.length*2),view=new DataView(buf);
        view.setUint8(0,handler);
        for(let i=0;i<samples.length;i++)view.setInt16(1+2*i,Math.max(-1,Math.min(1,samples[i]))*(samples[i]<0?32768:32767),true);
        ws.send(buf);
      };
      source.connect(processor);processor.connect(context.destination);
      timer=setTimeout(end,90000);voice.id=state.id;
      await call({type:"assist_pipeline/run",pipeline:pipeline.id,start_stage:"stt",end_stage:pipeline.tts_engine?"tts":"intent",
        input:{sample_rate:context.sampleRate},timeout:60});
    }catch(e){end();throw e;}
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
    const btn=ev.target.closest("button");
    const card=ev.target.closest("[data-detail]");
    if(card&&(!btn||btn.hasAttribute("data-open-detail"))){try{deviceDetails(card.dataset.detail);}catch(e){notice(formatError(e),true);}return;}
    if(!btn)return;
    if(btn.dataset.management){try{await management.run(btn.dataset.management);}catch(e){notice(formatError(e),true);}return;}
    if(btn.dataset.coreSettings){openCoreSettings(btn.dataset.coreSettings,btn.textContent);return;}
    if(btn.hasAttribute("data-voice")){try{await toggleVoice();}catch(e){notice(formatError(e),true);}return;}
    if(btn.id==="begin-auth"){startAuth();return}
    if(btn.id==="logout"){resetSession();showLogin();return}
    if(btn.id==="lang-toggle"){
      locale=locale==="bg"?"en":"bg";sessionStorage.setItem("stevora.lang",locale);
      if(document.body.classList.contains("setup-mode")){nav();await setup.run();}else if(state.connected)await loadData();else renderContent();return;
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
      if(value)showTextModal(value.title,[tr("Интеграция","Integration")+": "+(value.title||""),tr("Състояние","Status")+": "+consumerState(value.state,tr)].join("\n"));
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
      if(form.dataset.form==="adaptive-profile"){
        const management=state.adaptiveCatalog?.management;
        if(!state.admin || !state.connected || !management)return;
        const fields=new FormData(form);
        const reset=ev.submitter?.name==="reset";
        const category=fields.get("category"), group=fields.get("group")?.trim();
        const buttons=[...form.querySelectorAll("button")];
        buttons.forEach(button=>button.disabled=true);
        try{
          await call({type:StevoraAdaptive.API+"/override",device_id:form.dataset.device,
            expected_revision:management.configuration_revision,
            ...(!reset&&category?{category}:{}),...(!reset&&group?{group}:{})});
          await loadData();
          notice(tr("Настройките са записани.","Settings saved."));
        }catch(error){
          if(error.code==="conflict")await loadData();
          throw error;
        }finally{buttons.forEach(button=>button.disabled=!state.connected);}
        return;
      }
      if(form.dataset.form==="adaptive-action"){
        const item=state.adaptiveCatalog?.capabilities.find(row=>row.id===form.dataset.capability);
        const action=item?.actions.find(candidate=>candidate.id===form.dataset.action);
        if(!state.connected || !item || !action)return;
        const confirmed=action.confirmation_required && confirm(tr(
          "Потвърждаваш ли действието за „"+item.names[locale]+"“?",
          'Confirm this action for "'+item.names[locale]+'"?'));
        if(action.confirmation_required && !confirmed)return;
        const submit=form.querySelector("button");submit.disabled=true;
        try{
          const data=new FormData(form);
          await call(StevoraAdaptive.command(item,action,key=>data.get(key),confirmed));
          notice(tr("Командата е приета.","Command accepted."));
        }finally{
          const snapshot=state.adaptiveStates.get(item.entity_id);
          submit.disabled=!state.connected || !snapshot || ["unavailable","unknown"].includes(snapshot.state);
        }
        return;
      }
      if(["os-update","os-release"].includes(form.dataset.form)){
        const release=form.dataset.form==="os-release" && state.updateInfo?.downloaded_release;
        const file=form.elements.bundle?.files[0];if(!state.admin||(!file&&!release)||!confirm(tr("Инсталиране в неактивния системен дял?","Install to the inactive OS slot?")))return;
        const submit=form.querySelector("button");submit.disabled=true;
        try{await updateRequest(file,release);await loadAdmin("updates");renderContent();notice(tr("Пакетът е инсталиран. Рестартирай за активиране.","Package installed. Restart to activate."));}finally{submit.disabled=false;}
      }
      if(form.dataset.form==="assist"){const message=form.querySelector('input[name="message"]').value;await chat(message)}
      if(form.dataset.form==="add-integration")await addIntegration(form);
    }catch(e){notice(formatError(e),true)}
  });
  window.addEventListener("unhandledrejection",event=>{notice(formatError(event.reason),true)});
  nav();initAuth().catch(e=>showLogin(formatError(e)));
})();
