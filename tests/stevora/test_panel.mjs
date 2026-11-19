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
assert.deepEqual([...panel.inventory()].map((x) => x.entity_id), ["climate.bedroom"]);

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

console.log("STEVORA panel runtime: PASS");
