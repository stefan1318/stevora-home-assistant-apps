// Browser-free execution of the actual STEVORA frontend class.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("custom_components/stevora/frontend/stevora-panel.js", "utf8");
const registry = new Map();
class FakeElement {
  constructor() { this.isConnected = true; }
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      getElementById() { return {}; },
      querySelectorAll() { return []; },
      querySelector() { return null; },
    };
  }
}
runInNewContext(source, {
  HTMLElement: FakeElement,
  customElements: {
    get: (name) => registry.get(name),
    define: (name, klass) => registry.set(name, klass),
  },
  Set,
  Object,
  Number,
  String,
});
const Panel = registry.get("stevora-home-panel");
assert.ok(Panel);

const panel = new Panel();
panel._hass = {
  states: {
    "light.kitchen": {
      entity_id: "light.kitchen", state: "on", attributes: { friendly_name: "Kitchen" }
    },
    "climate.bedroom": {
      entity_id: "climate.bedroom", state: "heat", attributes: { temperature: 22 }
    },
    "light.kitchen_backlight": {
      entity_id: "light.kitchen_backlight", state: "on", attributes: { friendly_name: "Kitchen backlight" }
    },
  },
};
panel._manifest = {
  preferred_language: "bg",
  rooms: [{ id: "k", name: "Kitchen" }, { id: "b", name: "Bedroom" }],
  entities: [
    { entity_id: "light.kitchen", area_id: "k" },
    { entity_id: "climate.bedroom", area_id: "b" },
    { entity_id: "light.kitchen_backlight", area_id: "k" },
  ],
  controllable_entities: ["light.kitchen"],
};
panel._panelModel = {
  panel_version: "7.1.1",
  sections: [
    { id: "k", name: "Kitchen", cards: [
      {entity_id:"light.kitchen", name:"Kitchen light", icon:"mdi:lightbulb", layout:"compact", domain:"light", controls:["toggle"]}
    ]},
    { id: "b", name: "Bedroom", cards: [
      {entity_id:"climate.bedroom", name:"Bedroom climate", icon:"mdi:thermostat", layout:"info", domain:"climate", controls:[]}
    ]}
  ]
};
panel._mode = "stevora";
assert.deepEqual([...panel.inventory()].map((x) => x.entity_id),
  ["light.kitchen", "climate.bedroom"]);
panel.render();
assert.match(panel.shadowRoot.innerHTML, /data-id="light.kitchen"/);
assert.match(panel.shadowRoot.innerHTML, /data-room="k"/);
assert.match(panel.shadowRoot.innerHTML, /Kitchen light/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-id="climate.bedroom"/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-id="light.kitchen_backlight"/);
panel._selectedRoom = "b";
assert.deepEqual([...panel.inventory()].map((x) => x.entity_id),
  ["light.kitchen", "climate.bedroom"]); // Room selection affects view, not global inventory.

// A missing manifest must fail closed and expose no device controls.
panel._mode = "native";
panel._manifest = null;
panel._panelModel = null;
assert.equal(panel.inventory().length, 0);
panel.render();
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-action="toggle"/);


// Switching HA sessions must clear all old room/entity permissions immediately.
const switched = new Panel();
switched._hass = {connection: {}, user: {id: "home-a-admin"}, states: {}};
switched._manifest = {installation_id: "home-a", controllable_entities: ["light.old"]};
switched._panelModel = {sections: [], installation_id: "home-a"};
switched._hub = {status: {installation_id: "home-a", status: "active"}};
switched._mode = "stevora";
switched.hass = {
  connection: {}, user: {id: "home-b-admin"}, states: {
    "light.old": {entity_id: "light.old", state: "on", attributes: {}}
  },
  callWS: async () => { throw new Error("New home has no integration"); },
};
assert.equal(switched._mode, "native");
assert.equal(switched._manifest, null);
assert.equal(switched._panelModel, null);
assert.equal(switched._hub, null);
assert.equal(switched.inventory().length, 0);
assert.doesNotMatch(switched.shadowRoot.innerHTML, /data-action="toggle"/);


const theme = readFileSync("custom_components/stevora/frontend/stevora-premium.css", "utf8");
assert.match(theme, /\.v7-shell/);
assert.match(theme, /\.v7-bottom/);
assert.match(theme, /\.v7-climate/);
assert.match(theme, /prefers-reduced-motion/);
assert.doesNotMatch(source, /sensor\.realna_temperatura_homepod|light\.living_room_switch_1/);

// Restore the authenticated, permission-scoped session after fail-closed tests.
panel._manifest = {
  installation_id:"home-premium", preferred_language:"bg",
  rooms:[{id:"k",name:"Kitchen"},{id:"b",name:"Bedroom"}],
  entities:[
    {entity_id:"light.kitchen",area_id:"k"},
    {entity_id:"climate.bedroom",area_id:"b"},
  ],
  controllable_entities:["light.kitchen"],
};
panel._panelModel = {
  panel_version:"7.1.1", installation_id:"home-premium",
  sections:[
    {id:"k",name:"Kitchen",cards:[{
      entity_id:"light.kitchen",name:"Kitchen light",
      icon:"mdi:lightbulb",layout:"compact",domain:"light",controls:["toggle"],
    }]},
    {id:"b",name:"Bedroom",cards:[{
      entity_id:"climate.bedroom",name:"Bedroom climate",
      icon:"mdi:thermostat",layout:"info",domain:"climate",controls:[],
    }]},
  ],
};
panel._mode = "stevora";

// v7.1.1 premium visual shell must render dynamic rooms and navigation.
panel._view = "home";
panel._selectedRoom = "";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /STEVORA · HOME PANEL 7\.1\.1/);
assert.match(panel.shadowRoot.innerHTML, /v7-side/);
assert.match(panel.shadowRoot.innerHTML, /v7-bottom/);
assert.match(panel.shadowRoot.innerHTML, /data-view="rooms"/);
assert.match(panel.shadowRoot.innerHTML, /data-room="k"/);

// A dedicated climate center can expose only actions explicitly projected by HA.
panel._manifest.controllable_entities.push("climate.bedroom");
panel._panelModel.sections[1].cards[0].controls = ["temperature"];
panel._panelModel.sections[1].cards[0].layout = "compact";
panel._view = "climate";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /data-action="temperature-up"/);
assert.match(panel.shadowRoot.innerHTML, /data-action="temperature-down"/);

// RGB controls appear only for a controllable light supporting RGB and brightness.
panel._hass.states["light.kitchen"].attributes = {
  rgb_color:[20,40,60], brightness:128, supported_color_modes:["rgb"],
};
panel._panelModel.sections[0].cards[0].controls = ["toggle","color","brightness"];
panel._view = "lighting";
panel.render();
// Compact is intentionally concise, even in Lighting: no advanced sliders.
assert.match(panel.shadowRoot.innerHTML, /is-compact/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-lightbrightness="light.kitchen"/);
panel._panelModel.sections[0].cards[0].layout = "expanded";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /is-expanded/);
assert.match(panel.shadowRoot.innerHTML, /data-lightbrightness="light.kitchen"/);
assert.match(panel.shadowRoot.innerHTML, /data-lightcolor="light.kitchen"/);
panel._manifest.controllable_entities = ["climate.bedroom"];
panel.render();
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-lightbrightness="light.kitchen"/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-lightcolor="light.kitchen"/);

// Tab rendering never changes installation identity or impersonates optional modules.
panel._view = "system";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /STEVORA CORE/);
panel._view = "settings";
panel._wall = true;
panel.render();
assert.match(panel.shadowRoot.innerHTML, /v7-shell v7-wall/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-visibility=/);


// The historical v7 navigation remains accessible without bypassing HA permissions.
for (const view of ["scenes","insights","memory","ai","system","settings"]) {
  panel._view = view;
  panel.render();
  assert.match(panel.shadowRoot.innerHTML, /v7-shell/);
}
panel._view = "memory";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /not_included/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-action="toggle"/);


// Home Hub view renders only the authenticated installation's server projection.
panel._manifest.modules = {home_hub: {bundled:true,enabled:true,status:"active"}};
panel._hub = {
  status:{installation_id:"home-premium",hub_version:"1.0.0-beta.1",status:"active",
    metrics:{visible_entities:2,unavailable_entities:0,notifications:1}},
  history:{events:[{seq:1,entity_id:"climate.bedroom",kind:"recovered",at:"2026-11-19T20:00:00Z"}],
    notifications:[{seq:1,entity_id:"climate.bedroom",kind:"recovered"}]},
  scenes:{installation_id:"home-premium",items:[
    {entity_id:"scene.welcome",name:"Welcome",domain:"scene",action_allowed:true,state:"scening"},
    {entity_id:"scene.blocked",name:"Restricted",domain:"scene",action_allowed:false,state:"scening"},
  ]},
  settings:null,
};
panel._view = "hub";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /HOME HUB/);
assert.match(panel.shadowRoot.innerHTML, /climate.bedroom/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-hub-save=/);
assert.match(panel.shadowRoot.innerHTML, /data-hub-refresh="1"/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /class="v7-action subtle" data-view="hub"/);

// Refresh button must actually fetch fresh Hub data, not re-open the same tab.
const refreshControl = {};
const originalQuery = panel.shadowRoot.querySelectorAll;
panel.shadowRoot.querySelectorAll = selector =>
  selector === "[data-hub-refresh]" ? [refreshControl] : [];
let refreshCount = 0;
panel.refresh = async () => { refreshCount += 1; };
panel.render();
assert.equal(typeof refreshControl.onclick, "function");
await refreshControl.onclick();
assert.equal(refreshCount, 1);
assert.match(panel.shadowRoot.innerHTML, /data-hub-refresh="1"/);
delete panel.refresh;
panel.shadowRoot.querySelectorAll = originalQuery;

panel._view = "system";
panel.render();
assert.match(panel.shadowRoot.innerHTML,
  /class="v7-action subtle" data-view="hub"/);

panel._view = "scenes";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /data-hub-scene="scene.welcome"/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-hub-scene="scene.blocked"/);
panel._hub = null;

// A completely unrelated independent installation must not inherit old room
// names, controls or any historical Dunav hardcoded references.
panel._manifest = {
  installation_id:"home-independent", preferred_language:"en",
  rooms:[{id:"bath",name:"Bathroom"}],
  entities:[{entity_id:"fan.exhaust",area_id:"bath"}],
  controllable_entities:[],
};
panel._hass.states = {
  "fan.exhaust":{entity_id:"fan.exhaust",state:"off",attributes:{}},
};
panel._panelModel = {
  panel_version:"7.1.1",installation_id:"home-independent",
  sections:[{id:"bath",name:"Bathroom",cards:[{
    entity_id:"fan.exhaust",name:"Exhaust fan",domain:"fan",
    icon:"mdi:fan",layout:"compact",controls:[],
  }]}],
};
panel._selectedRoom = "";
panel._view = "home";
panel.render();
assert.match(panel.shadowRoot.innerHTML, /Exhaust fan|Bathroom/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /Kitchen light|Bedroom climate/);
assert.doesNotMatch(panel.shadowRoot.innerHTML, /data-action="toggle"/);


// An unavailable device remains visible but must never expose live controls.
const offlinePanel = new Panel();
offlinePanel._hass = {states: {
  "light.offline": {entity_id:"light.offline", state:"unavailable",
    attributes:{brightness:128, rgb_color:[20,40,60], supported_color_modes:["rgb"]}},
}};
offlinePanel._manifest = {
  installation_id:"offline-home", preferred_language:"en",
  rooms:[{id:"room",name:"Room"}],
  entities:[{entity_id:"light.offline",area_id:"room"}],
  controllable_entities:["light.offline"],
};
offlinePanel._panelModel = {
  panel_version:"7.1.1", installation_id:"offline-home",
  sections:[{id:"room",name:"Room",cards:[{
    entity_id:"light.offline",name:"Offline light",domain:"light",
    icon:"mdi:lightbulb",layout:"compact",controls:["toggle","brightness","color"],
  }]}],
};
offlinePanel._mode = "stevora";
offlinePanel._view = "lighting";
offlinePanel.render();
assert.match(offlinePanel.shadowRoot.innerHTML, /Offline light/);
assert.doesNotMatch(offlinePanel.shadowRoot.innerHTML, /data-action="toggle"/);
assert.doesNotMatch(offlinePanel.shadowRoot.innerHTML, /data-lightbrightness="light.offline"/);
assert.doesNotMatch(offlinePanel.shadowRoot.innerHTML, /data-lightcolor="light.offline"/);



// Premium admin editor must be a no-code icon gallery, not a raw MDI input.
const editor = panel.deviceEditors({
  entities:[{entity_id:"fan.bath",name:"Bathroom fan"}],
  device_profiles:{"fan.bath":{icon:"mdi:fan",layout:"compact",controls:["toggle"]}},
  translations:{entities:{}},rooms:[{id:"bath",name:"Bathroom"}],
});
assert.match(editor, /data-editor-key="device:fan.bath"/);
assert.match(editor, /data-icon-open="fan.bath"/);
assert.match(editor, /data-icon-grid="fan.bath"/);
assert.match(editor, /type="hidden" data-profile-icon="fan.bath"/);
assert.match(editor, /data-profile-control-mode="fan.bath"/);
assert.match(editor, /Включване/);
assert.match(editor, /data-profile-users=/);
assert.match(editor, /v7-editor-advanced/);
assert.ok(panel.iconGallery().length >= 25);

// Form state persists across updates instead of closing open device settings.
const formPanel = new Panel();
formPanel._hass = {connection:{},user:{id:"admin"},states:{}};
formPanel._manifest = {installation_id:"home-editor"};
formPanel._renderedView = "settings";
formPanel._renderedInstallation = "home-editor";
formPanel._renderedUser = "admin";
formPanel._view = "settings";
const openEditor = {getAttribute:()=>"device:fan.bath"};
const oldInput = {tagName:"INPUT",type:"text",value:"New custom name",checked:false};
const oldList = {scrollTop:212};
formPanel.shadowRoot.querySelectorAll = selector => {
  if (selector === "details[data-editor-key][open]") return [openEditor];
  if (selector.includes(".v7-manager input")) return [oldInput];
  if (selector === ".v7-manager .auditlist") return [oldList];
  return [];
};
const snapshot = formPanel.captureUiState();
assert.deepEqual([...snapshot.opened], ["device:fan.bath"]);
let newOpen = false;
const newEditor = {getAttribute:()=>"device:fan.bath",set open(v){newOpen=v;}};
const newInput = {tagName:"INPUT",type:"text",value:"Old persisted name",checked:false};
const newList = {scrollTop:0};
formPanel.shadowRoot.querySelectorAll = selector => {
  if (selector === "details[data-editor-key]") return [newEditor];
  if (selector.includes(".v7-manager input")) return [newInput];
  if (selector === ".v7-manager .auditlist") return [newList];
  return [];
};
formPanel.restoreUiState(snapshot);
assert.equal(newOpen,true);
assert.equal(newInput.value,"New custom name");
assert.equal(newList.scrollTop,212);
formPanel._resetEditorValues = true;
newInput.value = "Server saved name";
formPanel.restoreUiState(snapshot);
assert.equal(newInput.value,"Server saved name");

// An incoming HA state update must not rerender active Settings or chat.
const stable = new Panel();
const sharedConnection = {};
stable._hass = {connection:sharedConnection,user:{id:"admin"},states:{"light.kitchen":{}}};
stable._mode = "stevora";
stable._admin = {rooms:{},assistants:{}};
stable._stateSignature = "light.kitchen";
stable._view = "settings";
let renders = 0;
stable.render = () => {renders += 1;};
stable.hass = {connection:sharedConnection,user:{id:"admin"},states:{"light.kitchen":{state:"on"}}};
assert.equal(renders,0);
stable._view = "ai";
stable.hass = {connection:sharedConnection,user:{id:"admin"},states:{"light.kitchen":{state:"off"}}};
assert.equal(renders,0);

// Device-specific cards only expose actions granted by scoped manifest.
const scoped = new Set(["fan.bath","cover.window","media_player.tv"]);
const myFan = {entity_id:"fan.bath",name:"Ventilator",domain:"fan",icon:"mdi:fan",
  layout:"expanded",controls:["toggle","percentage"]};
const myCover = {entity_id:"cover.window",name:"Blind",domain:"cover",
  icon:"mdi:window-shutter",layout:"compact",controls:["open","stop","close"]};
const myMedia = {entity_id:"media_player.tv",name:"TV",domain:"media_player",
  icon:"mdi:television",layout:"compact",controls:["play_pause"]};
const native = new Panel();
native._hass = {states:{
  "fan.bath":{entity_id:"fan.bath",state:"on",attributes:{percentage:45}},
  "cover.window":{entity_id:"cover.window",state:"open",attributes:{}},
  "media_player.tv":{entity_id:"media_player.tv",state:"playing",attributes:{}},
}};
assert.match(native.renderNativeCard(myFan,scoped),/data-fanpercentage="fan.bath"/);
assert.match(native.renderNativeCard(myFan,scoped),/data-action="toggle"/);
assert.match(native.renderNativeCard(myCover,scoped),/data-action="open"/);
assert.match(native.renderNativeCard(myCover,scoped),/data-action="close"/);
assert.match(native.renderNativeCard(myMedia,scoped),/data-action="play_pause"/);
assert.doesNotMatch(native.renderNativeCard(myCover,new Set()),/data-action="open"/);
assert.doesNotMatch(native.renderNativeCard({...myFan,layout:"info"},scoped),/data-fanpercentage=/);
assert.doesNotMatch(native.renderNativeCard({...myFan,layout:"info"},scoped),/data-action="details"/);
native._hass.states["fan.bath"].state = "unavailable";
assert.doesNotMatch(native.renderNativeCard(myFan,scoped),/data-action="toggle"/);
assert.doesNotMatch(native.renderNativeCard(myFan,scoped),/data-fanpercentage=/);
assert.doesNotMatch(native.renderNativeCard(myFan,scoped),/fan\.bath<\/div>/);
assert.match(native.renderNativeCard(myFan,scoped),/<ha-icon icon="mdi:fan"/);

// A native HA Conversation agent works even when Hey Stevora is not bundled.
// Plain text must be escaped; conversation_id must carry between turns.
const chatter = new Panel();
const conversationCalls = [];
const chatConnection = {};
chatter._hass = {connection:chatConnection,user:{id:"person"},states:{},
  callWS:async msg => {
    conversationCalls.push(msg);
    return {conversation_id:"ha-thread-1",
      response:{speech:{plain:{speech:"Connected <safe> & private"}}}};
  },
};
chatter._manifest = {installation_id:"independent-chat"};
chatter._mode = "stevora";
chatter._language = "bg";
await chatter.sendAssist("Какво е включено?");
assert.equal(conversationCalls[0].type,"conversation/process");
assert.equal(conversationCalls[0].language,"bg");
assert.equal(conversationCalls[0].text,"Какво е включено?");
assert.equal(chatter._chatMessages.length,2);
assert.match(chatter.renderAssistChat(),/Connected &lt;safe&gt; &amp; private/);
await chatter.sendAssist("Още?");
assert.equal(conversationCalls[1].conversation_id,"ha-thread-1");
assert.equal(chatter._chatMessages.length,4);
assert.match(chatter.renderAssistChat(),/v7-chat-form/);
assert.doesNotMatch(chatter.renderAssistChat(),/Hey Stevora is required/);
const newHomeConnection = {};
chatter.hass = {connection:newHomeConnection,user:{id:"other"},states:{},
  callWS:async ()=>{throw new Error("not available");}};
assert.equal(chatter._chatMessages.length,0);
assert.equal(chatter._chatConversationId,null);

// No HTML injection from manifest or chat responses.
const hostileCard = {...myMedia,name:'<img src=x onerror=alert(1)>'};
assert.doesNotMatch(native.renderNativeCard(hostileCard,scoped),/<img src=/);
assert.match(native.renderNativeCard(hostileCard,scoped),/&lt;img/);


// Malicious/stale DOM controls must be revalidated at click time.
const guardPanel = new Panel();
const guardedButton = {dataset:{id:"fan.bath",action:"toggle"}};
const calledServices = [];
guardPanel._hass = {states:{
  "fan.bath":{entity_id:"fan.bath",state:"on",attributes:{friendly_name:"Bathroom fan"}},
},callService:async (...args)=>calledServices.push(args)};
guardPanel._manifest = {
  installation_id:"safe-home",
  rooms:[{id:"bath",name:"Bathroom"}],
  entities:[{entity_id:"fan.bath",area_id:"bath",name:"Fan"}],
  controllable_entities:[],
};
guardPanel._panelModel = {
  installation_id:"safe-home",panel_version:"7.1.1",
  sections:[{id:"bath",name:"Bathroom",cards:[
    {entity_id:"fan.bath",domain:"fan",name:"Fan",controls:["toggle"],layout:"compact"},
  ]}],
};
guardPanel._mode = "stevora";
guardPanel.shadowRoot.querySelectorAll = selector =>
  selector === "[data-action]" ? [guardedButton] : [];
guardPanel.render();
assert.equal(typeof guardedButton.onclick,"function");
await guardedButton.onclick();
assert.equal(calledServices.length,0);
guardPanel._manifest.controllable_entities = ["fan.bath"];
guardPanel._panelModel.sections[0].cards[0].controls = [];
await guardedButton.onclick();
assert.equal(calledServices.length,0);
guardPanel._panelModel.sections[0].cards[0].controls = ["toggle"];
await guardedButton.onclick();
assert.equal(calledServices.length,1);
assert.equal(calledServices[0][0],"fan");
guardPanel._manifest.entities[0].original_name = "Bathroom backlight";
await guardedButton.onclick();
assert.equal(calledServices.length,1);

// Native Home Assistant Assist error handling is explicit, not fake chat success.
const chatError = new Panel();
chatError._hass = {connection:{},user:{id:"visitor"},
  callWS:async ()=>{throw new Error("unknown_command");}};
chatError._manifest = {installation_id:"home-no-conversation"};
chatError._mode = "stevora";
await chatError.sendAssist("Hello");
assert.equal(chatError._chatMessages.length,2);
assert.match(chatError.renderAssistChat(),/Home Assistant/);
assert.equal(chatError._chatBusy,false);
assert.match(chatError._chatError,/unknown_command/);


// A switch classified as lighting is visible under Lighting, but remains a
// switch for HA services and never gains RGB or brightness abilities.
const classified = new Panel();
classified._hass = {states: {
  "switch.pendant": {entity_id:"switch.pendant",state:"on",attributes:{supported_features:0}},
}};
classified._manifest = {
  installation_id:"new-lighting-home", preferred_language:"en",
  rooms:[{id:"k",name:"Kitchen"}],
  entities:[{entity_id:"switch.pendant",area_id:"k",display_category:"lighting"}],
  controllable_entities:["switch.pendant"],
};
classified._panelModel = {
  installation_id:"new-lighting-home",panel_version:"7.1.1",
  sections:[{id:"k",name:"Kitchen",cards:[{
    entity_id:"switch.pendant",name:"Pendant lamp",domain:"switch",
    display_category:"lighting",layout:"compact",icon:"mdi:lightbulb",
    controls:["toggle"],available_controls:["toggle"],
  }]}],
};
classified._mode = "stevora";
classified._view = "lighting";
classified.render();
assert.match(classified.shadowRoot.innerHTML,/Pendant lamp/);
assert.match(classified.shadowRoot.innerHTML,/data-live-card="switch.pendant"/);
assert.doesNotMatch(classified.shadowRoot.innerHTML,/data-lightbrightness="switch.pendant"/);
assert.doesNotMatch(classified.shadowRoot.innerHTML,/data-lightcolor="switch.pendant"/);

// Strict feature filtering: supporting only toggle cannot create fan speed.
const fanWithNoSpeed = new Panel();
fanWithNoSpeed._hass = {states:{
  "fan.simple":{entity_id:"fan.simple",state:"on",
    attributes:{supported_features:0,percentage:45}},
}};
const fanCard = {entity_id:"fan.simple",domain:"fan",name:"Simple fan",
  controls:["toggle","percentage"],available_controls:["toggle","percentage"],
  layout:"expanded",icon:"mdi:fan"};
assert.deepEqual([...fanWithNoSpeed.supportedControls(fanCard)],["toggle"]);
assert.doesNotMatch(fanWithNoSpeed.renderNativeCard(fanCard,new Set(["fan.simple"])),
  /data-fanpercentage=/);
fanWithNoSpeed._hass.states["fan.simple"].attributes.supported_features = 1;
assert.match(fanWithNoSpeed.renderNativeCard(fanCard,new Set(["fan.simple"])),
  /data-fanpercentage="fan.simple"/);

// Climate Center reflects a room sensor, humidity, target and authorized modes,
// without requiring fixed home identifiers.
const clima = new Panel();
clima._hass = {states:{
  "climate.zone":{entity_id:"climate.zone",state:"heat",attributes:{
    temperature:22,current_temperature:20,supported_features:1|8,
    hvac_modes:["off","heat","cool"],fan_modes:["auto","high"],min_temp:16,max_temp:30,
  }},
  "sensor.room_temperature":{entity_id:"sensor.room_temperature",state:"21.4",
    attributes:{device_class:"temperature",unit_of_measurement:"°C"}},
  "sensor.room_humidity":{entity_id:"sensor.room_humidity",state:"51",
    attributes:{device_class:"humidity",unit_of_measurement:"%"}},
}};
clima._manifest = {installation_id:"climate-home",controllable_entities:["climate.zone"]};
clima._panelModel = {sections:[{id:"a",cards:[
  {entity_id:"climate.zone",domain:"climate",name:"AC",layout:"expanded",
    controls:["temperature","fan_mode","hvac_mode"],available_controls:["temperature","fan_mode","hvac_mode"]},
  {entity_id:"sensor.room_temperature",domain:"sensor"},
  {entity_id:"sensor.room_humidity",domain:"sensor"},
]}]};
const climateHtml = clima.renderClimateCenter({
  entity_id:"climate.zone",domain:"climate",roomId:"a",name:"AC",
  layout:"expanded",controls:["temperature","hvac_mode","fan_mode"],
  available_controls:["temperature","hvac_mode","fan_mode"],
},false);
assert.match(climateHtml,/21\.4/);
assert.match(climateHtml,/51%/);
assert.match(climateHtml,/22°C/);
assert.match(climateHtml,/data-climate-select="hvac_mode"/);
assert.match(climateHtml,/data-climate-select="fan_mode"/);
assert.match(climateHtml,/v7-climate-ring/);
const summaryClimate = clima.renderClimateCenter({
  entity_id:"climate.zone",domain:"climate",roomId:"a",name:"AC",
  layout:"compact",controls:["temperature"],available_controls:["temperature"],
},true);
assert.doesNotMatch(summaryClimate,/data-action="temperature-up"/);

// HA state changes must patch the live DOM instead of re-rendering the shell.
const stableLive = new Panel();
const sameConn = {};
stableLive._hass = {connection:sameConn,user:{id:"u"},states:{
  "switch.pendant":{state:"off",attributes:{supported_features:0}},
}};
stableLive._stateSignature = "switch.pendant";
stableLive._mode = "stevora";
stableLive._view = "home";
let fullRenders = 0,livePatches = 0,refreshes = 0;
stableLive.render = () => {fullRenders++;};
stableLive.patchLiveStates = () => {livePatches++;};
stableLive.refresh = async () => {refreshes++;};
stableLive.hass = {connection:sameConn,user:{id:"u"},states:{
  "switch.pendant":{state:"on",attributes:{supported_features:0}},
}};
assert.equal(fullRenders,0);
assert.equal(livePatches,1);
assert.equal(refreshes,0);
stableLive.hass = {connection:sameConn,user:{id:"u"},states:{
  "switch.pendant":{state:"on",attributes:{supported_features:1}},
}};
assert.equal(refreshes,0); // HA state ticks never trigger full regeneration.
assert.equal(livePatches,2); // In-place update, even when attributes change.
assert.equal(fullRenders,0);


// Expanded controls must expose only HA-advertised fields; compact is not full.
const fullLight = new Panel();
fullLight._hass = {states:{
  "light.color":{entity_id:"light.color",state:"on",
    attributes:{supported_features:4,supported_color_modes:["rgb","color_temp"],
      brightness:180,rgb_color:[100,150,200],color_temp_kelvin:3300,
      min_color_temp_kelvin:2000,max_color_temp_kelvin:6500,
      effect_list:["Rainbow"],effect:"Rainbow"}},
}};
const fullCard = {entity_id:"light.color",domain:"light",name:"Mood light",
  layout:"expanded",controls:["toggle","brightness","color","color_temp","effect"],
  available_controls:["toggle","brightness","color","color_temp","effect"]};
const fullMarkup = fullLight.renderNativeCard(fullCard,new Set(["light.color"]));
assert.match(fullMarkup,/is-expanded/);
assert.match(fullMarkup,/data-lightcolor="light.color"/);
assert.match(fullMarkup,/data-native-range="color_temp"/);
assert.match(fullMarkup,/data-native-select="effect"/);
assert.doesNotMatch(fullLight.renderNativeCard({...fullCard,layout:"compact"},new Set(["light.color"])),
  /data-native-range="color_temp"/);
fullLight._hass.states["light.color"].attributes.supported_features = 0;
assert.doesNotMatch(fullLight.renderNativeCard(fullCard,new Set(["light.color"])),
  /data-native-select="effect"/);

// An info-only climate fixture must remain read-only even if the manifest
// declares a temperature action (backend does not grant controls to info cards).
const noControlsClimate = clima.renderClimateCenter({
  entity_id:"climate.zone",domain:"climate",name:"AC",roomId:"a",
  layout:"info",controls:["temperature","hvac_mode"],
  available_controls:["temperature","hvac_mode"],
},false);
assert.doesNotMatch(noControlsClimate,/data-action="temperature-up"/);
assert.doesNotMatch(noControlsClimate,/data-climate-select="hvac_mode"/);

// The UI category field is a separate visual preference, never a service domain.
const visualForm = classified.deviceEditors({
  entities:[{entity_id:"switch.pendant",name:"Pendant lamp",available_controls:["toggle"]}],
  device_profiles:{"switch.pendant":{display_category:"lighting"}},
  translations:{entities:{}},rooms:[{id:"k",name:"Kitchen"}],
});
assert.match(visualForm,/data-profile-display-category="switch.pendant"/);
assert.match(visualForm,/value="lighting" selected/);
assert.doesNotMatch(visualForm,/value="brightness" data-control-for="switch.pendant"/);


// Explicit save feedback is grounded in post-save manifest projection.
classified._admin = {rooms:{
  entities:[{entity_id:"switch.pendant",name:"Pendant lamp",included:true,reason:"included",area_id:"k"}],
  device_profiles:{"switch.pendant":{display_category:"lighting"}},
  translations:{entities:{}},rooms:[{id:"k",name:"Kitchen"}],
}};
classified._profileFeedback = {entity_id:"switch.pendant",
  result:{included:true,reason:"included",area_id:"k",
    display_category:"lighting",in_lighting:true}};
assert.match(classified.deviceEditors(classified._admin.rooms),/Verified in Lighting|Потвърдено в Осветление/);
const virtualRoomEditor = classified.deviceEditors({
  ...classified._admin.rooms,
  rooms:[{id:"__stevora_unassigned__",name:"Unassigned"},
    {id:"k",name:"Kitchen"}],
});
assert.doesNotMatch(virtualRoomEditor, /<option value="__stevora_unassigned__"/);
// Unassigned is an automatic display room, never a valid writable HA area.

classified._profileFeedback.result = {included:false,reason:"outside_selected_rooms",
  display_category:null,in_lighting:false};
assert.match(classified.deviceEditors(classified._admin.rooms),
  /Outside selected rooms|Извън избраните помещения/);

// Dozens of state publications and extra irrelevant sensors cannot cause a
// repaint or reload; only a real HA registry update can request a silent refresh.
const stableStress = new Panel();
const stressConnection = {};
let redraws = 0, updates = 0, reloads = 0;
stableStress._mode = "stevora";
stableStress._view = "lighting";
stableStress._manifest = {installation_id:"stable-house"};
stableStress._panelModel = {sections:[]};
stableStress._hass = {connection:stressConnection,user:{id:"person"},
  states:{"switch.pendant":{state:"off",attributes:{supported_features:0}}}};
stableStress.render = ()=>{redraws++;};
stableStress.patchLiveStates = ()=>{updates++;};
stableStress.refresh = async ()=>{reloads++;};
for (let count=0;count<100;count++){
  stableStress.hass = {connection:stressConnection,user:{id:"person"},
    states:{"switch.pendant":{state:count%2?"on":"off",
      attributes:{supported_features:count%5}},
    ["sensor.unrelated_"+count]:{state:count,attributes:{}}}};
}
assert.equal(redraws,0);
assert.equal(reloads,0);
assert.equal(updates,100);

// Registry event callbacks are deduplicated in the same event burst and
// deregistered when panel detaches.
const subscriptionHandlers = {};
const unsubscribed = [];
const eventsConnection = {
  subscribeEvents:async (fn,event)=> {
    subscriptionHandlers[event] = fn;
    return ()=>unsubscribed.push(event);
  },
};
const eventsPanel = new Panel();
eventsPanel._hass = {connection:eventsConnection,user:{id:"person"},states:{}};
eventsPanel._manifest = {installation_id:"registry-house"};
eventsPanel._mode = "stevora";
const refreshOptions=[];
eventsPanel.refresh = async options => refreshOptions.push(options);
await eventsPanel.listenForRegistryChanges();
assert.equal(Object.keys(subscriptionHandlers).length,3);
subscriptionHandlers.entity_registry_updated({});
subscriptionHandlers.device_registry_updated({});
subscriptionHandlers.area_registry_updated({});
await Promise.resolve();
assert.equal(refreshOptions.length,1);
assert.equal(refreshOptions[0].silent,true);
eventsPanel.disconnectedCallback();
assert.equal(unsubscribed.length,3);

console.log("STEVORA panel runtime: PASS");
