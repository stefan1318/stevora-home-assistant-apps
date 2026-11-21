"""Developer test checks for native STEVORA OS integrated image.

Source tests are a precondition; QEMU UEFI boot + live Home Assistant auth
is a separate verification gate. Do not claim production readiness here.
"""
import ast
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[1]
WEB=ROOT/"web"
SCRIPTS=ROOT/"scripts"

class NativeIntegratedContract(unittest.TestCase):
    def test_root_shell_not_panel(self):
        html=(WEB/"index.html").read_text()
        self.assertIn("<!doctype html>",html)
        self.assertIn("<title>STEVORA OS — Native Integrated Preview</title>",html)
        self.assertIn('src="/app.js"',html)
        self.assertNotIn("/stevora-os",html)
        self.assertNotIn("panel_custom",html)

    def test_gateway_uses_core_auth_proxy_no_supervisor_secrets(self):
        src=(ROOT/"gateway"/"main.go").read_text()
        self.assertIn("crypto/tls",src)
        self.assertIn("127.0.0.1:8123",src)
        self.assertIn('"/api/"',src)
        self.assertIn('"/auth/"',src)
        self.assertIn("X-Forwarded-For",src)
        self.assertNotIn("SUPERVISOR_TOKEN",src)
        self.assertIn("Content-Security-Policy",src)
        unit=(ROOT/"systemd"/"stevora-native-web.service").read_text()
        self.assertIn("stevora-native-gateway",unit)
        self.assertIn("-https :443",unit)
        self.assertIn("NoNewPrivileges=yes",unit)
        self.assertIn("RequiresMountsFor=/mnt/data",unit)

    def test_bundle_real_os_internal_modules(self):
        shell=(SCRIPTS/"prepare-haos.sh").read_text()
        for required in ("EXPECTED_UPSTREAM_SHA","stevora-custom-components",
                         "native_bootstrap: true","CONFIG_HTTPD=y",
                         "stevora-native-gateway","70-haos.preset",
                         "custom_components/stevora"):
            self.assertIn(required,shell)
        source=(PROJECT/"custom_components"/"stevora"/"__init__.py").read_text()
        flow=(PROJECT/"custom_components"/"stevora"/"config_flow.py").read_text()
        ast.parse(source);ast.parse(flow)
        self.assertIn("SOURCE_IMPORT",source)
        self.assertIn("native_bootstrap",source)
        self.assertIn("CONF_PANEL_ENABLED: False",flow)
        self.assertIn("CONF_HOME_HUB_ENABLED: True",flow)

    def test_native_app_has_real_protocol_types(self):
        script=(WEB/"app.js").read_text()
        for key in ('"/auth/token"','"config/area_registry/list"',
                    '"config_entries/get"','"get_states"','"call_service"',
                    '"supervisor/api"','"conversation/process"',
                    '"/addons"','"/backups"'):
            self.assertIn(key,script)
        self.assertNotIn("SUPERVISOR_TOKEN",script)
        self.assertNotIn("innerHTML = JSON.stringify",script)
        self.assertIn("backlight",script)
        self.assertIn("sessionStorage",script)

    def test_backup_restore_and_signed_ota_gated(self):
        script=(WEB/"app.js").read_text()
        self.assertNotIn('"/os/update","POST"',script)
        self.assertNotIn('"/backups/"+slug+"/restore/full"',script)
        patch=(SCRIPTS/"prepare-haos.sh").read_text()
        self.assertIn('"signed_stevora_ota": false',patch)
        self.assertIn('"backup_restore_enabled": false',patch)

    def test_real_qemu_boot_test_in_ci(self):
        qemu=(SCRIPTS/"qemu-smoke.sh").read_text()
        self.assertIn("qemu-system-x86_64",qemu)
        self.assertIn("hostfwd=tcp:127.0.0.1:18443-:443",qemu)
        self.assertIn("https://127.0.0.1:18443/",qemu)
        self.assertIn('native-integrated-dev.0',qemu)

    def test_no_hardcoded_personal_identifiers(self):
        text="\n".join(p.read_text() for p in [WEB/"app.js",WEB/"index.html",SCRIPTS/"prepare-haos.sh"]).lower()
        for bad in ("dunav","homeassistant.local:8123","stefan1318/ha_ios","secretpassword"):
            self.assertNotIn(bad,text)


if __name__=="__main__":
    unittest.main()
