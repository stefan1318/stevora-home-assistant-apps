"""Regression tests: STEVORA first-boot hook must never corrupt upstream Bash."""
import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

HELPER = Path(__file__).resolve().parents[1] / "scripts" / "patch-data-partition.py"
SPEC = importlib.util.spec_from_file_location("stevora_data_patch", HELPER)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

BASE = """#!/usr/bin/env bash
set -e
data_dir=/tmp/stevora-test-data
sudo mount -o loop /tmp/data.ext4 "$data_dir"
docker exec test sh /build/dind-import-containers.sh
sudo umount "DOLLAR{data_dir}"
trap - ERR EXIT
""".replace("DOLLAR", chr(36))

class TestDataImagePatch(unittest.TestCase):
    def test_inserts_once_and_preserves_valid_shell(self):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / "create-data-partition.sh"
            filename.write_text(BASE)
            MODULE.patch(filename)
            patched = filename.read_text()
            self.assertEqual(patched.count(MODULE.MARKER), 1)
            self.assertEqual(patched.count(MODULE.PINNED_UNMOUNT), 1)
            self.assertIn("native_bootstrap: true", patched)
            self.assertIn("stevora-custom-components/stevora", patched)
            subprocess.run(["bash", "-n", str(filename)], check=True)
            with self.assertRaisesRegex(ValueError, "already installed"):
                MODULE.patch(filename)

    def test_refuses_unknown_upstream_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / "create-data-partition.sh"
            filename.write_text("#!/bin/bash\nsudo umount /mnt/data\n")
            before = filename.read_text()
            with self.assertRaisesRegex(ValueError, "anchor mismatch"):
                MODULE.patch(filename)
            self.assertEqual(filename.read_text(), before)

    def test_preserves_original_bytes_outside_hook(self):
        with tempfile.TemporaryDirectory() as tmp:
            filename = Path(tmp) / "create-data-partition.sh"
            filename.write_text(BASE)
            MODULE.patch(filename)
            expected = BASE.replace(MODULE.PINNED_UNMOUNT, MODULE.HOOK + MODULE.PINNED_UNMOUNT)
            self.assertEqual(filename.read_text(), expected)

if __name__ == "__main__":
    unittest.main()
