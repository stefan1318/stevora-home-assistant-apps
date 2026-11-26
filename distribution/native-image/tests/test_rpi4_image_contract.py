"""Static gates for the Raspberry Pi 4 ARM64 build-only developer image.

These tests do not claim that an image was built or booted on Pi hardware.
"""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PREPARE = ROOT / "distribution/native-image/scripts/prepare-haos.sh"
WORKFLOW = ROOT / ".github/workflows/stevora-os-native-rpi4-build.yml"


class RaspberryPi4BuildContract(unittest.TestCase):
    def test_prepare_script_is_valid_bash_and_targets_are_explicit(self):
        subprocess.run(["bash", "-n", str(PREPARE)], check=True)
        source = PREPARE.read_text(encoding="utf-8")
        for marker in (
            'TARGET="${2:-ova}"',
            '  rpi4_64)',
            'TARGET_CONFIG="$HAOS_DIR/buildroot-external/configs/${TARGET}_defconfig"',
            'BR2_PACKAGE_HASSIO_MACHINE="raspberrypi4-64"',
            'BR2_PACKAGE_LIBOPENSSL_BIN=y',
            'EXPECTED_UPSTREAM_SHA',
            'RPi4 is build-only',
        ):
            self.assertIn(marker, source)
        self.assertNotIn('>> "$HAOS_DIR/buildroot-external/configs/ova_defconfig"', source)

    def test_github_workflow_compiles_arm64_and_real_disk_image(self):
        source = WORKFLOW.read_text(encoding="utf-8")
        for marker in (
            "GOARCH=arm64",
            "CGO_ENABLED=0",
            "prepare-haos.sh haos rpi4_64",
            "make O=output_rpi4_64 rpi4_64",
            "haos_rpi4-64-*.img.xz",
            "xz -t",
            "sha256sum",
            "BUILD-ONLY",
            "UPSTREAM_HAOS_SHA: 495bedb8d70a92ad189efb64829ece34b165d3bd",
        ):
            self.assertIn(marker, source)
        self.assertIn("retention-days: 7", source)
        self.assertNotIn("QEMU-PASS", source)
        self.assertNotIn("RPi4-BOOT-PASS", source)


if __name__ == "__main__":
    unittest.main()
