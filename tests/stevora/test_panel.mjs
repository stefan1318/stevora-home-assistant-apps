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

console.log("STEVORA panel runtime: PASS");
