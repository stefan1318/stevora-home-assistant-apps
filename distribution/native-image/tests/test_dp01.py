"""STEVORA native DP01 source validation, not a substitute for QEMU boot."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parents[1]
OVERLAY = ROOT / "web"
SCRIPTS = ROOT / "scripts"

class NativeDP01Contracts(unittest.TestCase):
    def test_root_frontend_is_standalone_not_panel(self):
        page = (OVERLAY / "index.html").read_text(encoding="utf8")
        self.assertIn("<!doctype html>", page)
        self.assertIn("<title>STEVORA OS — Native Developer Preview</title>", page)
        self.assertIn("Native Developer Preview 0.1", page)
        self.assertIn('href="/app.css"', page)
        self.assertNotIn("stevora_os_static/", page)
        self.assertNotIn("panel_custom", page)
        self.assertNotIn("window.hass", page)
        self.assertNotIn("supervisor_token", page.lower())
        self.assertNotIn("<iframe", page.lower())
        self.assertIn("Неактивно в DP 0.1", page)

    def test_patch_is_based_on_real_buildroot_not_rootfs_emulation(self):
        patch = (SCRIPTS / "prepare-haos.sh").read_text()
        self.assertIn('EXPECTED_UPSTREAM_SHA="495bedb8d70a92ad189efb64829ece34b165d3bd"', patch)
        for s in ("CONFIG_HTTPD=y", "buildroot-external/rootfs-overlay",
                  "70-haos.preset", "STEVORA OS Developer Preview",
                  "HAOS_ID", "stevora-native-web.service"):
            self.assertIn(s, patch)
        self.assertNotIn("rm -rf /config", patch)

    def test_host_service_is_not_core_panel(self):
        unit = (ROOT / "systemd" / "stevora-native-web.service").read_text()
        self.assertIn("WantedBy=multi-user.target", unit)
        self.assertIn("/usr/sbin/httpd -f -p 80 -h /usr/share/stevora-os", unit)
        self.assertIn("ProtectSystem=strict", unit)
        self.assertNotIn("8123", unit)
        self.assertNotIn("HA_TOKEN", unit)

    def test_real_boot_smoke_required(self):
        script = (SCRIPTS / "qemu-smoke.sh").read_text()
        self.assertIn("qemu-system-x86_64", script)
        self.assertIn("OVMF_CODE", script)
        self.assertIn("hostfwd=tcp:127.0.0.1:18080-:80", script)
        self.assertIn("build.json", script)
        self.assertIn("Native x86_64 OVA boot verified", script)
        self.assertNotIn("echo PASS\nexit 0", script)

    def test_no_dunav_identifiers(self):
        paths = [
            OVERLAY / "index.html", OVERLAY / "app.css",
            SCRIPTS / "prepare-haos.sh",
            ROOT / "systemd" / "stevora-native-web.service",
        ]
        text = "\n".join(p.read_text() for p in paths).lower()
        self.assertNotIn("dunav", text)
        self.assertNotIn("stefan1318/ha_ios", text)


if __name__ == "__main__":
    unittest.main()
