"""Exercise the native thermostat and profile icon editor at phone width."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright, expect

web = Path("distribution/native-image/web")
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
    page = browser.new_page(viewport={"width": 375, "height": 740})
    page.set_content("<main></main>")
    page.add_style_tag(path=str(web / "app.css"))
    for script in ("controls.js", "management.js"):
        page.add_script_tag(path=str(web / script))
    page.evaluate("""() => {
      const state={state:'off', attributes:{temperature:23,min_temp:16,max_temp:24,
        hvac_modes:['heat','cool','off'],fan_modes:['low','high']}};
      openStevoraDevice({id:'climate.test',entity:()=>state,
        profile:()=>({controls:['hvac_mode','temperature','fan_mode']}),canControl:()=>true,
        tr:(bg,en)=>en,name:'AC · Living room',call:async({service,service_data})=>{
          if(service==='set_temperature')state.attributes.temperature=service_data.temperature;
          if(service==='set_hvac_mode')state.state=service_data.hvac_mode;
          document.dispatchEvent(new Event('stevora-device-update'));
        }});
    }""")
    page.get_by_role("button", name="+", exact=True).click()
    expect(page.locator(".setpoint strong")).to_have_text("24°")
    expect(page.get_by_role("button", name="+", exact=True)).to_be_disabled()
    page.get_by_role("button", name="Cooling", exact=True).click()
    expect(page.get_by_role("button", pressed=True)).to_have_text("Cooling")
    page.get_by_text("Additional settings").click()
    expect(page.get_by_role("combobox")).to_be_visible()
    page.get_by_role("button", name="Close").click()
    page.evaluate("""async () => {
      const entity={entity_id:'climate.test',name:'AC',available_controls:[]};
      const manager=createStevoraManagement({tr:(bg,en)=>en,refresh:async()=>{},
        call:async msg=>{
          if(msg.type==='stevora/admin/rooms/get')
            return {revision:1,rooms:[],entities:[entity],device_profiles:{}};
          window.saved=msg.profiles['climate.test'].icon;
        }});
      await manager.run('devices');
    }""")
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("radio", name="Air conditioner").check()
    page.get_by_role("button", name="Save").click()
    expect(page.get_by_role("dialog")).to_have_count(0)
    assert page.evaluate("saved") == "mdi:air-conditioner"
    browser.close()
