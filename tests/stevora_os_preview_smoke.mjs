/* STEVORA OS 1.0 alpha — runtime, permissions and session isolation checks. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class Element {
  attachShadow() {
    this.shadowRoot = {
      html:"",
      addEventListener:()=>{},
      querySelector:()=>null,
      querySelectorAll:()=>[],
      set innerHTML(value){this.html=value;},
      get innerHTML(){return this.html;},
    };
    return this.shadowRoot;
  }
}
const elements=new Map();
globalThis.HTMLElement=Element;
globalThis.customElements={
  get:(name)=>elements.get(name),
  define:(name,cls)=>elements.set(name,cls),
};
vm.runInThisContext(fs.readFileSync("custom_components/stevora_os/frontend/stevora-os.js","utf8"),{filename:"stevora-os.js"});
const Klass=elements.get("stevora-os-preview");
assert.ok(Klass,"STEVORA OS element must be registered");
const tick=()=>new Promise(setImmediate);
const wait=async()=>{for(let i=0;i<8;i++)await tick();};
const manifest=(room,privileged=true)=>({
  installation_id:privileged?"home-A":"home-B",
  revision:55,
  rooms:[{id:"living",name:room}],
  entities:[
    {entity_id:"light.allowed",area_id:"living",name:"Main light",original_name:"Main light"},
    {entity_id:"switch.backlight",area_id:"living",name:"Backlight"},
    {entity_id:"climate.living",area_id:"living",name:"Climate"},
  ].filter((e)=>privileged||e.entity_id==="light.allowed"),
  controllable_entities:privileged?["light.allowed","climate.living"]:[],
  modules:{
    core:{status:"active"},home_panel:{status:"active"},home_hub:{status:"active"},
    hey_stevora:{status:"not_included"},memory_sync:{status:"not_included"}
  },
});
const panelModel=(privileged)=>({
  installation_id:privileged?"home-A":"home-B",
  revision:55,
  sections:[{
    id:"living",name:"Living Room",
    cards:[
      {entity_id:"light.allowed",name:"Main light",domain:"light",display_category:"lighting",layout:"expanded",
        controls:privileged?["toggle","brightness","color"]:[]},
      {entity_id:"switch.backlight",name:"Backlight",domain:"switch",display_category:"lighting",layout:"expanded",
        controls:["toggle"]},
      {entity_id:"climate.living",name:"Climate",domain:"climate",display_category:"climate",layout:"expanded",
        controls:["temperature"]},
    ].filter((e)=>privileged||e.entity_id==="light.allowed"),
  }],
});
const serviceCalls=[];
const mock=(privileged,room)=>({
  connection:{},
  user:{id:privileged?"admin-A":"viewer-B",is_admin:privileged},
  config:{version:"2026.11.1"},
  states:privileged?{
    "light.allowed":{state:"off",attributes:{brightness:110,rgb_color:[255,0,0]}},
    "switch.backlight":{state:"on",attributes:{}},
    "climate.living":{state:"cool",attributes:{temperature:24,min_temp:16,max_temp:30,current_temperature:25}},
  }:{"light.allowed":{state:"off",attributes:{}}},
  callService:async(domain,service,data)=>{serviceCalls.push({domain,service,data});},
  callWS:async(request)=>{
    if(request.type==="stevora/manifest")return manifest(room,privileged);
    if(request.type==="stevora/panel/generate")return panelModel(privileged);
    if(request.type==="stevora/hub/scenes")return {
      installation_id:privileged?"home-A":"home-B",
      items:[{entity_id:"scene.evening",name:"Evening",domain:"scene",state:"scening",action_allowed:privileged}]};
    if(request.type==="stevora/hub/events")return {installation_id:privileged?"home-A":"home-B",events:[]};
    if(request.type==="stevora/admin/rooms/get"){
      if(!privileged)throw Error("unauthorized");
      return {revision:1,translations:{rooms:{},entities:{}},rooms:[{id:"living",name:room}]};
    }
    if(request.type==="stevora_os/system/status"){
      if(!privileged)throw Error("unauthorized");
      return {
        schema_version:"1",preview_version:"1.0.0-alpha.1",core_version:"2026.11.1",
        ha_state:"running",registered_entities:3,updates_available:1,updates_unknown:1,
        official_updates:{
          core:{status:"available",installed_version:"2026.11.1",latest_version:"<img src=x onerror=bad()>"},
          os:{status:"up_to_date",installed_version:"18.4",latest_version:"18.4"},
          supervisor:{status:"not_detected"},
        },
      };
    }
    throw Error("unexpected WS "+request.type);
  }
});

const panel=new Klass();
panel.hass=mock(true,"<script>bad()</script>");
panel.connectedCallback();
await wait();
assert.equal(panel._status,"ready");
assert.ok(panel._model?.sections?.length);
assert.ok(panel._system);
assert.ok(!panel._cards("all").some(c=>c.entity_id==="switch.backlight"),
  "Backlight entity must be filtered even if the source model erroneously includes it");
assert.equal(panel._cards("lighting").length,1);
panel._view="devices";
panel.render();
assert.match(panel.shadowRoot.html,/data-device-action="toggle"/);
assert.match(panel.shadowRoot.html,/data-device-input="color"/);
await panel._deviceAction("light.allowed","toggle");
await wait();
assert.deepEqual(serviceCalls[0],{domain:"light",service:"toggle",data:{entity_id:"light.allowed"}});
await panel._deviceAction("switch.backlight","toggle");
assert.equal(serviceCalls.length,1,"Never call a backlight control");
await panel._deviceAction("climate.living","temp-up");
await wait();
assert.deepEqual(serviceCalls[1],{
  domain:"climate",service:"set_temperature",data:{entity_id:"climate.living",temperature:25}
});
panel._view="rooms";
panel.render();
assert.ok(panel.shadowRoot.html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
assert.ok(!panel.shadowRoot.html.includes("<script>bad()"));
panel._view="system";
panel.render();
assert.ok(panel.shadowRoot.html.includes("&lt;img src=x onerror=bad()&gt;"));
assert.ok(!panel.shadowRoot.html.includes("<img src=x onerror=bad()>"));
panel._view="scenes";
panel.render();
assert.ok(panel.shadowRoot.html.includes("scene.evening"));
await panel._runScene("scene.evening");
await wait();
assert.equal(serviceCalls.at(-1).domain,"scene");
panel._language="en";
await panel.refresh();
await wait();
assert.ok(panel.shadowRoot.html.includes("Scenes")||panel.shadowRoot.html.includes("STEVORA"));

let release;
const pending=new Promise(resolve=>{release=resolve;});
const viewer=mock(false,"Bedroom");
viewer.callWS=async(req)=>{
  if(req.type==="stevora/manifest")return pending;
  if(req.type==="stevora/panel/generate")return panelModel(false);
  if(req.type==="stevora/hub/scenes")return {installation_id:"home-B",items:[]};
  if(req.type==="stevora/hub/events")return {installation_id:"home-B",events:[]};
  throw Error("permission denied");
};
panel.hass=viewer;
assert.equal(panel._manifest,null,"Old manifest cleared immediately on HA session switch");
assert.equal(panel._system,null,"Admin diagnostics cleared on HA session switch");
assert.equal(panel._model,null,"Old control model must be cleared");
assert.ok(!panel.shadowRoot.html.includes("&lt;img src=x onerror=bad()&gt;"));
release(manifest("Bedroom",false));
await wait();
assert.equal(panel._status,"ready");
assert.equal(panel._cards().length,1);
panel._view="devices";
panel.render();
assert.ok(panel.shadowRoot.html.includes("Bedroom")===false || panel._manifest.rooms[0].name==="Bedroom");
const before=serviceCalls.length;
await panel._deviceAction("light.allowed","toggle");
assert.equal(serviceCalls.length,before,"Viewer cannot perform action without scoped controls");
panel._view="system";
panel.render();
assert.ok(!panel.shadowRoot.html.includes('href="/config"'));
assert.ok(!panel.shadowRoot.html.includes("updates_available"));
panel.disconnectedCallback();
assert.equal(panel._manifest,null);
assert.equal(panel._model,null);
console.log("STEVORA OS 1.0 alpha runtime, actions, isolation and backlight safety PASS");
