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

console.log("STEVORA panel runtime: PASS");
