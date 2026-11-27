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
  const offline = ui.render([{...item,availability:"unavailable"}],new Map(),true,"bg",String);
  assert.match(offline,/Електромер/);
  assert.match(offline,/Недостъпно/);
  assert.doesNotMatch(offline,/<form/);
  const online = ui.render([item],new Map([[item.entity_id,{state:"12"}]]),true,"en",String);
  assert.match(online,/12 kWh/);
  assert.doesNotMatch(online,/<form/);
});
test("escapes catalog content and uses only gateway target identifiers", () => {
  const action = {id:"temperature",parameters:{temperature:{type:"number",min:15,max:25}}};
  const html = ui.render([{...item,names:{en:"<script>"},actions:[action]}],
    new Map([[item.entity_id,{state:"on"}]]),false,"en",String);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/min="15" max="25"/);
  assert.match(html,/disabled/);
  assert.deepEqual(ui.command(item,action,()=>"21.5",true),{
    type:"stevora/os/v1/capabilities/action",capability_id:item.id,
    action_id:"temperature",parameters:{temperature:21.5},confirmed:true,
  });
});
