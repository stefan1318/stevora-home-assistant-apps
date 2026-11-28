"""Test the native adaptive renderer in Chromium without connecting to a home."""
from pathlib import Path
from shutil import which

from playwright.sync_api import expect, sync_playwright

WEB = Path("distribution/native-image/web")


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
    memory_page = browser.new_page(locale="en-US")
    memory_page.route("http://stevora.test/", lambda route: route.fulfill(
        content_type="text/html", body="""<nav id="navigation"><button data-view="lighting"><span></span></button>
        <button data-view="scenes"><span></span></button><button data-view="assist"><span></span></button></nav>
        <span id="current-title"></span><button id="lang-toggle"></button><main id="screen"></main>"""))
    memory_page.goto("http://stevora.test/")
    memory_page.add_script_tag(path=str(WEB / "adaptive.js"))
    for script in ("controls.js", "management.js"):
        memory_page.add_script_tag(path=str(WEB / script))
    memory_page.add_script_tag(content="""window.createStevoraSetup = () => ({});
""")
    app = (WEB / "app.js").read_text()
    startup = "nav();initAuth().catch(e=>showLogin(formatError(e)));"
    assert startup in app
    memory_page.add_script_tag(content=app.replace(startup, """
      window.controlTest = {
        render() {
          const items = [
            ["switch.desk","Desk light","office","lighting","mdi:led-strip","off"],
            ["light.hall","Hall light","hall","lighting","","on"],
            ["fan.desk","Desk fan","office","fans","","on"],
            ["sensor.room","Humidity","office","general","","42"],
          ];
          const caps = items.map(([id,name,area,category,icon])=>({
            id, entity_id:id, names:{en:name}, area_id:area, icon,
            classification:{category}, availability:"available", measurements:["state"],
          }));
          const states=items.map(([id,name,area,category,icon,state])=>({
            entity_id:id,state,attributes:{friendly_name:name},
          }));
          state.adaptiveStates=new Map(states.map(entity=>[entity.entity_id,entity]));
          state.adaptiveCatalog={rooms:[{id:"office",name:"Office"},{id:"hall",name:"Hall"}],capabilities:caps,
            systems:[{category:"lighting",labels:{en:"Lighting"},capability_ids:["switch.desk","light.hall"]},
              {category:"fans",labels:{en:"Fans"},capability_ids:["fan.desk"]}]};
          state.stevoraManifest={entities:[{entity_id:"switch.desk",available_controls:["toggle"]}],
            controllable_entities:["switch.desk"]};
          state.connected=true;
          window.deviceCalls=[];
          state.ws={readyState:WebSocket.OPEN,send(raw){
            const request=JSON.parse(raw);
            const pending=state.pending.get(request.id);
            clearTimeout(pending.timer);
            state.pending.delete(request.id);
            window.deviceCalls.push(request);
            pending.resolve({});
          }};
          state.view="lighting";
          nav();
          document.querySelector("#screen").innerHTML=renderAdaptive();
        },
      };
      window.memoryTest = {
        async load(admin, bridge) {
          state.connected = true; state.login = true;
          state.ws = {readyState:WebSocket.OPEN, send(raw) {
            const {id,type,filename} = JSON.parse(raw);
            const request = state.pending.get(id);
            clearTimeout(request.timer); state.pending.delete(id);
            if(type === "stevora_memory/health" && !bridge) return request.reject(Error("Unknown command"));
            const replies = {
              "auth/current_user": {is_admin:admin},
              "stevora_memory/health": {bridge:"ready",api_version:1,storage_available:true,
                files:["knowledge_base.md","memory_status.json"]},
              "stevora_memory/read": {content:filename === "knowledge_base.md" ? "<img src=x> Notes" : "Sync OK"},
              "stevora_memory/proposals": {proposals:[{title:"Test proposal",status:"pending_review"}]},
              "get_states": [],
            };
            request.resolve(replies[type] || {});
          }};
          await loadData();
          nav();
        },
        async view() { await loadAdmin("memory"); document.querySelector("#screen").innerHTML = memoryView(); },
      };
    """))
    memory = memory_page.locator('[data-view="memory"]')
    memory_page.evaluate("memoryTest.load(true, false)")
    expect(memory).to_have_count(0)
    memory_page.evaluate("memoryTest.load(false, true)")
    expect(memory).to_have_count(0)
    memory_page.evaluate("memoryTest.load(true, true)")
    expect(memory).to_have_text("▤ Memory")
    memory_page.evaluate("memoryTest.view()")
    expect(memory_page.get_by_text("Sync OK")).to_be_visible()
    expect(memory_page.get_by_text("Test proposal")).to_be_visible()
    expect(memory_page.locator("#screen img")).to_have_count(0)
    memory_page.evaluate("memoryTest.load(true, false)")
    expect(memory).to_have_count(0)
    memory_page.evaluate("controlTest.render()")
    expect(memory_page.get_by_role("heading",name="Office",exact=True)).to_be_visible()
    expect(memory_page.get_by_role("heading",name="Hall",exact=True)).to_be_visible()
    expect(memory_page.get_by_role("button",name="Desk light")).to_contain_text("🌈")
    expect(memory_page.locator('[data-view="system:fans"]')).to_have_text("🌀 Fans")
    expect(memory_page.locator("#screen select[name=category]")).to_have_count(0)
    memory_page.get_by_role("button",name="Desk light").click()
    assert memory_page.evaluate("deviceCalls.map(call => [call.domain,call.service,call.target.entity_id])") == [
        ["switch", "turn_on", "switch.desk"],
    ]
    expect(memory_page.get_by_role("dialog")).to_have_count(0)
    memory_page.get_by_role("button",name="Hall light").click()
    expect(memory_page.get_by_role("dialog")).to_be_visible()
    expect(memory_page.get_by_role("heading",name="Hall light · Hall")).to_be_visible()
    browser.close()
