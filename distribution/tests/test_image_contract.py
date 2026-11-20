"""Release contract for the real STEVORA OS native installation image.

Prevents accidental marketing/publication of the old /stevora-os panel as an OS.
This validates specifications, NOT a bootable image or runtime.
"""
from __future__ import annotations
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "image-contract.json"
ARCHITECTURE = ROOT / "ARCHITECTURE-BG.md"


def read_contract():
    return json.loads(CONTRACT.read_text(encoding="utf-8"))


def release_ready(contract: dict) -> bool:
    gates = contract["verified_release_gates"]
    artifacts = contract["artifacts"]
    return (
        contract["primary_user_interface"]["url_path"] == "/"
        and contract["primary_user_interface"]["type"] == "own-root-frontend"
        and not contract["primary_user_interface"]["legacy_panel_allowed_in_release"]
        and all(value is True for value in gates.values())
        and all(isinstance(value, str) and bool(value.strip()) for value in artifacts.values())
    )


class DistributionContractTest(unittest.TestCase):
    def test_native_distribution_not_panel_pwa(self):
        c = read_contract()
        self.assertEqual(c["product"], "STEVORA OS")
        self.assertEqual(c["edition"], "native-image")
        self.assertEqual(c["primary_user_interface"]["url_path"], "/")
        self.assertEqual(c["primary_user_interface"]["type"], "own-root-frontend")
        self.assertFalse(c["primary_user_interface"]["legacy_panel_allowed_in_release"])
        self.assertFalse(c["primary_user_interface"]["standalone_pwa_only"])
        self.assertFalse(c["primary_user_interface"]["stock_ha_shell_visible"])
        self.assertFalse(c["legacy_prototype"]["production_entrypoint"])

    def test_platforms_are_original_os_build_targets(self):
        c = read_contract()
        ids = [target["id"] for target in c["targets"]]
        self.assertEqual(ids, ["ova", "rpi4_64", "rpi5_64"])
        self.assertTrue(all(target["required"] for target in c["targets"]))

    def test_full_system_admin_scope_explicit(self):
        c = read_contract()
        for capability in (
            "integrations-configure", "apps-install-manage", "automations-edit",
            "backups-restore", "core-supervisor-os-updates", "settings-network-storage",
            "users-permissions", "onboarding", "recovery"
        ):
            self.assertIn(capability, c["required_capabilities"])
        self.assertEqual(c["system_stack"]["system_backend"], "home-assistant-supervisor")
        self.assertEqual(c["system_stack"]["device_backend"], "home-assistant-core")
        self.assertEqual(c["system_stack"]["privileged_access"], "server-side-authenticated-bridge")

    def test_dev_status_never_claims_ready_image(self):
        c = read_contract()
        self.assertEqual(c["status"], "architecture")
        self.assertFalse(release_ready(c))
        self.assertIsNone(c["artifacts"]["bootable_image"])
        self.assertTrue(all(value is False for value in c["verified_release_gates"].values()))

    def test_architecture_has_recovery_and_update_disclaimers(self):
        text = ARCHITECTURE.read_text(encoding="utf-8")
        for phrase in ("RAUC", "Supervisor", "Core", "Apps", "Dunav", "system bridge",
                       "не", "/stevora-os", "/"):
            self.assertIn(phrase, text)


if __name__ == "__main__":
    unittest.main()
