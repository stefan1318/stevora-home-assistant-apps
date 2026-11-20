/* STEVORA OS runtime smoke test without browser/HA dependencies. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class TestElement {
  attachShadow() {
    this.shadowRoot = {
      html: "",
      addEventListener: () => {},
      querySelector: () => null,
      set innerHTML(value) { this.html = value; },
      get innerHTML() { return this.html; },
    };
    return this.shadowRoot;
  }
}
const elements = new Map();
globalThis.HTMLElement = TestElement;
globalThis.customElements = {
  get: (name) => elements.get(name),
  define: (name, cls) => elements.set(name, cls),
};

const script = fs.readFileSync(
  "custom_components/stevora_os/frontend/stevora-os.js", "utf8"
);
vm.runInThisContext(script, { filename: "stevora-os.js" });
const Klass = elements.get("stevora-os-preview");
assert.ok(Klass, "Panel must register its own web component");

const manifest = (roomName, entityName) => ({
  installation_id: "home-local",
  rooms: [{ id: "living", name: roomName }],
  entities: [{ entity_id: entityName, area_id: "living" }],
  modules: { home_hub: { status: "active" } },
});

const panel = new Klass();
const firstConnection = {};
panel.hass = {
  connection: firstConnection,
  user: { id: "admin-one", is_admin: true },
  config: { version: "2026.11.1" },
  states: { "light.allowed": { state: "on" } },
  callWS: async (message) => {
    assert.equal(message.type, "stevora/manifest");
    return manifest("<script>bad()</script>", "light.allowed");
  },
};
panel.connectedCallback();
await new Promise(setImmediate);
assert.equal(panel._status, "ready");
assert.equal(panel._counts().available, 1);
assert.match(panel.shadowRoot.html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
assert.ok(!panel.shadowRoot.html.includes("<script>bad()"), "Must escape injected room markup");
assert.ok(panel.shadowRoot.html.includes("STEVORA"));
assert.ok(panel.shadowRoot.html.includes("Home Panel"));

panel._language = "en";
await panel.refresh();
assert.ok(panel.shadowRoot.html.includes("Your home. Your system."));

let resolveOther;
const otherManifest = new Promise((resolve) => { resolveOther = resolve; });
panel.hass = {
  connection: {},
  user: { id: "user-two", is_admin: false },
  config: { version: "2026.11.1" },
  states: { "switch.other": { state: "off" } },
  callWS: async () => otherManifest,
};
assert.equal(panel._manifest, null, "Previous home state must clear immediately");
assert.ok(!panel.shadowRoot.html.includes("&lt;script&gt;bad()"), "Old room must not remain visible");
resolveOther(manifest("Bedroom", "switch.other"));
await new Promise(setImmediate);
assert.equal(panel._status, "ready");
assert.ok(panel.shadowRoot.html.includes("Bedroom"));
assert.ok(!panel.shadowRoot.html.includes("<script>bad()"));
panel._view = "system";
panel.render();
assert.ok(!panel.shadowRoot.html.includes('href="/config"'),
  "Read-only user cannot receive an HA admin navigation link");

panel.disconnectedCallback();
assert.equal(panel._manifest, null, "Disconnect must clear manifest");
console.log("STEVORA OS preview runtime smoke PASS");
