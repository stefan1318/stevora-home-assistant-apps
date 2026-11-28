const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const source = fs.readFileSync(path.join(__dirname,"../web/adaptive.js"),"utf-8");
const ui = new Function(source+"\nreturn StevoraAdaptive;")();
const item = {
  id:"registry:1", entity_id:"sensor.meter", area_id:"office",
  names:{bg:"Електромер",en:"Power meter"}, measurements:["state"],
  actions:[], availability:"available", unit:"kWh",
};
const catalog = {
  schema_version:1,installation_id:"a",rooms:[],devices:[],capabilities:[item],
  systems:[
    {category:"energy", capability_ids:[item.id], labels:{en:"Energy",bg:"Енергия"}},
    {category:"security", capability_ids:[], labels:{en:"Security"}},
  ],
};

test("derives navigation and room/search results from server evidence", () => {
  assert.equal(ui.valid(catalog),true);
  assert.equal(ui.valid({...catalog,schema_version:2}),false);
  assert.deepEqual([...ui.categories(catalog).keys()],["energy"]);
  assert.deepEqual(ui.rows(catalog,"energy","office","ЕЛЕКТРО","bg"),[item]);
  assert.deepEqual(ui.rows(catalog,"energy","garage","","en"),[]);
});
test("retains offline tiles and leaves read-only entities without controls", () => {
  const offline = ui.render([{...item,availability:"unavailable"}],new Map(),"bg",String);
  assert.match(offline,/Електромер/);
  assert.match(offline,/Недостъпно/);
  assert.doesNotMatch(offline,/<form/);
  const online = ui.render([item],new Map([[item.entity_id,{state:"12"}]]),"en",String);
  assert.match(online,/12 kWh/);
  assert.doesNotMatch(online,/<form/);
});
test("renders accessible tiles with classification icons and custom icon priority", () => {
  const lighting = {...item,names:{en:"<script>"},icon:"mdi:led-strip",classification:{category:"lighting"}};
  const snapshots = new Map([[item.entity_id,{state:"on"}]]);
  const automatic=ui.render([lighting],snapshots,"en",String);
  assert.match(automatic,/☼/);
  assert.match(automatic,/data-detail="sensor.meter"/);
  assert.doesNotMatch(automatic,/<script>|<form|<details/);
  assert.match(ui.render([lighting],snapshots,"en",String,()=>"🌈"),/🌈/);
});

test("consumes the shared v1 catalog", () => {
  const fixture = require("../../../contracts/adaptive/v1/catalog.json");
  assert.equal(ui.valid(fixture, "fixture-home-a"), true);
  assert.equal(ui.valid(fixture, "fixture-home-b"), false);
  const [climate] = ui.rows(fixture, "climate", "workroom", "Климатик", "bg");
  assert.equal(climate.id, "registry:air");
  const [meter] = ui.rows(fixture, "energy", "workroom", "", "bg");
  assert.equal(meter.availability, "unavailable");
  assert.match(ui.render([meter],new Map(),"bg",String),/Електромер/);
});
