"""Exercise a Tuya-style form, QR scan, verification retry and options menu."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright, expect

web = Path("distribution/native-image/web")
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
    page = browser.new_page()
    page.set_content("<main></main>")
    for script in ("qrcode.js", "flows.js"):
        page.add_script_tag(path=str(web / script))
    page.evaluate("""async () => {
      window.sent=[];
      const responses=[
        {type:"form",step_id:"scan",data_schema:[{name:"QR",selector:{qr_code:{data:"tuyaSmart--qrLogin?token=synthetic-test"}}}]},
        {type:"menu",menu_options:["finish"]},
        {type:"create_entry"}
      ];
      await stevoraFlow({base:"/flow",initial:{flow_id:"test",type:"form",data_schema:[{name:"user_code",required:true,type:"string"}]},
        title:"Tuya",translate:(_,en)=>en,request:async (url,method,data)=>{
          sent.push({url,method,data});return {flow_id:"test",...responses.shift()};
        },finished:()=>{}});
    }""")
    page.get_by_label("user code").fill("sample")
    page.get_by_role("button", name="Confirm").click()
    expect(page.get_by_role("img", name="Verification QR code")).to_be_visible()
    page.get_by_role("button", name="Confirm").click()
    page.get_by_role("button", name="finish", exact=True).click()
    expect(page.get_by_role("dialog")).to_have_count(0)
    assert page.evaluate("sent.map(x=>x.data)") == [{"user_code":"sample"},{},{"next_step_id":"finish"}]
    browser.close()
