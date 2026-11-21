// The installation's onboarding ledger is authoritative across restarts and browsers.
"use strict";
function createStevoraSetup({screen, language, call, post, authorize, enter, authenticated}) {
  const tr = (bg, en) => language() === "bg" ? bg : en;
  let page = 0;
  function element(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }
  async function steps() {
    const options = {cache:"no-store", signal:AbortSignal.timeout(8000)};
    const response = await fetch("/api/onboarding", options);
    if (response.status === 404 || response.status === 401) {
      // A temporary installation landing page can also return 404.
      const providers = await fetch("/auth/providers", options);
      if (providers.ok) {
        const payload = await providers.json();
        // Home Assistant returns an object with a providers array on current
        // Core versions; older integrations may return an array directly.
        const available = Array.isArray(payload) ? payload :
          (payload && !Array.isArray(payload) && Array.isArray(payload.providers)
            ? payload.providers : null);
        if (available !== null) return [];
      }
    }
    if (!response.ok) throw new Error("Core " + response.status);
    const value = await response.json();
    if (!Array.isArray(value) || !value.length ||
        !value.every(item => typeof item.step === "string" && typeof item.done === "boolean"))
      throw new Error("Core");
    return value.filter(item => !item.done).map(item => item.step);
  }
  function card(title, description) {
    const box = element("section");
    box.className = "setup-card";
    const logo = element("img");
    logo.src = "/stevora-login.png"; logo.alt = "STEVORA"; logo.width = logo.height = 64;
    box.append(logo, element("h1", title), element("p", description));
    screen.replaceChildren(box);
    return box;
  }
  function action(box, label, fn) {
    const button = element("button", label);
    button.type = "button"; button.className = "primary";
    button.onclick = async () => {
      button.disabled = true;
      try { await fn(); } catch (error) { report(box, error); }
      finally { button.disabled = false; }
    };
    box.append(button);
  }
  function report(box, error) {
    box.querySelector("[role=alert]")?.remove();
    const message = element("p", tr("Стъпката не е потвърдена. ", "Step not confirmed. ") +
      String(error.message || error.code || error).slice(0,160));
    message.setAttribute("role","alert");
    box.append(message);
    if (!box.querySelector(".retry")) {
      const retry = element("button", tr("Провери състоянието", "Check status"));
      retry.className = "retry"; retry.type = "button"; retry.onclick = () => location.reload();
      box.append(retry);
    }
  }
  function form(box, label, save) {
    const node = element("form");
    const submit = element("button",label);
    submit.type = "submit"; submit.className = "primary";
    node.append(submit); box.append(node);
    let busy = false;
    node.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      busy = submit.disabled = true;
      try { await save(new FormData(node)); }
      catch (error) { report(box,error); }
      finally { busy = submit.disabled = false; }
    };
    return node;
  }
  function field(form, name, title, options={}) {
    const label = element("label",title);
    const input = element("input");
    Object.assign(input,{name, required:true},options);
    label.append(input); form.insertBefore(label,form.lastElementChild);
    return input;
  }
  function owner() {
    const box = card(tr("Създай собственик","Create the owner account"),
      tr("Този акаунт ще управлява дома.","This account will administer your home."));
    const node = form(box,tr("Създай акаунта","Create account"),async data => {
      if (data.get("password") !== data.get("confirm"))
        throw new Error(tr("Паролите се различават.","Passwords do not match."));
      const response = await fetch("/api/onboarding/users",{method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({
          name:data.get("name").trim(),username:data.get("username").trim(),
          password:data.get("password"),language:language(),client_id:location.origin+"/"
        })});
      if (!response.ok) throw new Error(tr("Създаване на акаунт","Account creation")+" · HTTP "+response.status);
      const result = await response.json();
      node.reset();
      if (!result.auth_code) throw new Error(tr("Влез с новия акаунт.","Sign in with the new account."));
      await authorize(result.auth_code);
    });
    field(node,"name",tr("Име","Display name"),{autocomplete:"name"});
    field(node,"username",tr("Потребителско име","Username"),{autocomplete:"username",autocapitalize:"none"});
    field(node,"password",tr("Парола","Password"),{type:"password",autocomplete:"new-password"});
    field(node,"confirm",tr("Повтори паролата","Confirm password"),{type:"password",autocomplete:"new-password"});
  }
  async function home(generation) {
    const config = await call({type:"get_config"});
    if (generation !== page) return;
    const box = card(tr("Настрой дома","Set up your home"),
      tr("Местоположението и часовата зона се използват за автоматизации.","Your location and time zone are used by automations."));
    const node = form(box,tr("Запази дома","Save home"),async data => {
      await call({type:"config/core/update",location_name:data.get("home").trim(),
        time_zone:data.get("timezone").trim(),latitude:Number(data.get("latitude")),
        longitude:Number(data.get("longitude")),language:language(),unit_system:data.get("units")});
      await post("core_config",{}); await run();
    });
    field(node,"home",tr("Име на дома","Home name"),{value:config.location_name || ""});
    field(node,"timezone",tr("Часова зона","Time zone"),{value:Intl.DateTimeFormat().resolvedOptions().timeZone || config.time_zone});
    field(node,"latitude",tr("Ширина","Latitude"),{type:"number",step:"any",min:-90,max:90,value:config.latitude ?? ""});
    field(node,"longitude",tr("Дължина","Longitude"),{type:"number",step:"any",min:-180,max:180,value:config.longitude ?? ""});
    const label=element("label",tr("Мерни единици","Units"));
    const units=element("select"); units.name="units";
    units.add(new Option(tr("Метрични","Metric"),"metric"));
    units.add(new Option(tr("Американски","US customary"),"us_customary"));
    units.value=config.unit_system?.length==="mi"?"us_customary":"metric";
    label.append(units); node.insertBefore(label,node.lastElementChild);
  }
  async function run() {
    const generation = ++page;
    document.body.classList.add("setup-mode");
    const wait = card(tr("Подготовка на STEVORA OS","Preparing STEVORA OS"),
      tr("Изчакване на инсталирането и стартирането на Core.","Waiting for Core installation and startup."));
    let pending;
    let attempts = 0;
    while (generation === page) {
      try { pending = await steps(); break; }
      catch {
        if (++attempts===3) wait.append(element("p",tr("Провери интернет връзката на системата. Проверката продължава автоматично.","Check the system’s internet connection. Readiness checks continue automatically.")));
        await new Promise(resolve=>setTimeout(resolve,4000));
      }
    }
    if (generation !== page) return;
    try {
      if (!pending.length) {
        if (authenticated() && sessionStorage.getItem("stevora.setup.pending")) {
          const box = card(tr("Подготовка на дома","Preparing your home"),
            tr("Изчакване на манифеста с помещения и устройства.","Waiting for the room and device manifest."));
          for (let attempt=0; attempt<12; attempt++) {
            if (generation !== page) return;
            const manifest = await call({type:"stevora/os/v1/manifest",language:language()}).catch(()=>null);
            if (manifest?.installation_id && Array.isArray(manifest.entities)) {
              sessionStorage.removeItem("stevora.setup.pending");
              await enter(); return;
            }
            await new Promise(resolve=>setTimeout(resolve,2500));
          }
          report(box,new Error(tr("STEVORA интеграцията още не е готова.","The STEVORA integration is still starting.")));
          return;
        }
        await enter(); return;
      }
      sessionStorage.setItem("stevora.setup.pending","1");
      if (pending.includes("user")) { owner(); return; }
      if (!authenticated()) { await enter(); return; }
      if (pending.includes("core_config")) { await home(generation); return; }
      if (pending.includes("analytics")) {
        const box=card(tr("Поверителност","Privacy"),tr("Избери дали да споделяш основна анонимна статистика за инсталацията с Home Assistant.","Choose whether to share basic anonymous installation statistics with Home Assistant."));
        const node=form(box,tr("Продължи","Continue"),async data=>{
          await call({type:"analytics/preferences",preferences:{base:data.has("share")}});
          await post("analytics",{}); await run();
        });
        field(node,"share",tr("Споделяй основна статистика","Share basic statistics"),{type:"checkbox",required:false});
        return;
      }
      if (pending.includes("integration")) {
        const box=card(tr("Завърши настройката","Finish setup"),tr("Отвори помещенията и устройствата на този дом.","Open the rooms and devices in this home."));
        action(box,tr("Влез в дома","Enter home"),async ()=>{
          await post("integration",{client_id:location.origin+"/",redirect_uri:location.origin+"/"});
          await run();
        });
        return;
      }
      throw new Error(tr("Непозната стъпка на Core","Unsupported Core step")+" · "+pending.join(", "));
    } catch(error) { report(screen.firstElementChild,error); }
  }
  return {run};
}
