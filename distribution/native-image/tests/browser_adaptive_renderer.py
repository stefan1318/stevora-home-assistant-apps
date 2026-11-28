"""Test the native adaptive renderer in Chromium without connecting to a home."""
from pathlib import Path
from shutil import which

from playwright.sync_api import expect, sync_playwright

WEB = Path("distribution/native-image/web")


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
    page = browser.new_page(viewport={"width": 375, "height": 740})
    page.set_content("<main id='screen'></main>")
    page.add_style_tag(path=str(WEB / "app.css"))
    page.add_script_tag(path=str(WEB / "adaptive.js"))
    page.evaluate("""() => {
      const thermostat = {
        id:"registry:thermostat", entity_id:"climate.fixture", device_id:"device:living",
        names:{bg:"Термостат",en:"Thermostat"}, availability:"available",
        measurements:["state","current_temperature"],
        actions:[{id:"temperature",confirmation_required:true,
          parameters:{temperature:{type:"number",min:15,max:25}}}],
      };
      const water = {
        id:"registry:water", entity_id:"valve.fixture", names:{bg:"Клапан",en:"Valve"},
        availability:"unavailable", measurements:["state"], actions:[],
      };
      const states = new Map([["climate.fixture",{state:"heat",attributes:{current_temperature:20}}]]);
      const catalog = {
        devices:[{id:"device:living",override:{category:"climate",group:"zone-1"}}],
        management:{configuration_revision:2,categories:{
          climate:{bg:"Климатизация",en:"Climate"}, heat_pump:{bg:"Термопомпа",en:"Heat pump"},
        }},
      };
      const screen = document.querySelector("#screen");
      screen.innerHTML = StevoraAdaptive.render([thermostat,water],states,true,"bg",String,catalog);
      screen.addEventListener("submit",ev=>{
        ev.preventDefault();
        const data = new FormData(ev.target);
        if(ev.target.dataset.form==="adaptive-action"){
          window.command = StevoraAdaptive.command(thermostat,thermostat.actions[0],name=>data.get(name),true);
        }
      });
    }""")
    page.get_by_text("Термостат", exact=True).click()
    expect(page.get_by_text("20", exact=True)).to_be_visible()
    control = page.get_by_role("spinbutton", name="Зададена температура")
    control.fill("26")
    assert control.evaluate("input => input.validity.rangeOverflow")
    control.fill("21")
    page.get_by_role("button", name="Зададена температура").click()
    assert page.evaluate("window.command.parameters") == {"temperature": 21}
    assert page.evaluate("window.command.confirmed")
    expect(page.get_by_label("Категория")).to_have_value("climate")
    expect(page.get_by_label("Идентификатор на група")).to_have_value("zone-1")
    page.get_by_text("Клапан", exact=True).click()
    valve = page.locator('[data-capability-card="registry:water"]')
    expect(valve.get_by_text("Недостъпно")).to_be_visible()
    expect(valve.get_by_role("button")).to_have_count(0)
    page.add_script_tag(path=str(WEB / "management.js"))
    page.evaluate("""() => {
      window.managerRequests = [];
      const catalog = {
        capabilities:[{id:"registry:thermostat", names:{bg:"Термостат"}}],
        devices:[{id:"device:living", capability_ids:["registry:thermostat"],
          override:{category:"climate", group:"zone-1"}}],
        management:{configuration_revision:2,categories:{
          climate:{bg:"Климатизация"}, heat_pump:{bg:"Термопомпа"},
        }},
      };
      const manager = createStevoraManagement({
        call: async request => window.managerRequests.push(request),
        tr: bg => bg, refresh: async () => {}, currentLanguage: () => "bg",
        currentCatalog: () => catalog,
      });
      return manager.run("capabilityGroups");
    }""")
    page.get_by_role("dialog").get_by_role("button", name="Редактирай").click()
    editor = page.get_by_role("dialog")
    editor.get_by_label("Категория").select_option("heat_pump")
    editor.get_by_label("Идентификатор на група").fill("zone-2")
    editor.get_by_role("button", name="Запази").click()
    assert page.evaluate("window.managerRequests") == [{
        "type": "stevora/os/v1/capabilities/override",
        "device_id": "device:living",
        "expected_revision": 2,
        "category": "heat_pump",
        "group": "zone-2",
    }]
    browser.close()
