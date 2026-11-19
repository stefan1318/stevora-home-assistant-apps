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

console.log("STEVORA panel runtime: PASS");
