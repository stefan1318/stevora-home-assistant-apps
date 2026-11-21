#!/usr/bin/env python3
"""Integrate the STEVORA adapter into a pinned upstream HAOS data image.

Operates on the *build checkout* only, never on an installed HAOS disk.
Avoid nested heredocs in Bash: all upstream patching and invariants live here.
"""
from __future__ import annotations

import argparse
from pathlib import Path

PINNED_UNMOUNT = 'sudo umount "' + chr(36) + '{data_dir}"'
MARKER = "# STEVORA native integrated first-boot adapter"
HOOK = """# STEVORA native integrated first-boot adapter.
# The source checkout is mounted by scripts/enter.sh at /build, not the DinD
# container's /build. This executes on the outer Buildroot build container.
stevora_adapter="/build/buildroot-external/stevora-custom-components/stevora"
if [ ! -f "$stevora_adapter/manifest.json" ]; then
  echo "STEVORA native adapter missing from build checkout" >&2
  exit 1
fi
sudo touch "$data_dir/stevora-native-image"
sudo install -d "$data_dir/supervisor/homeassistant/custom_components"
sudo cp -a "$stevora_adapter" "$data_dir/supervisor/homeassistant/custom_components/stevora"
# A user-restored HA config remains authoritative; only first boot is seeded.
if [ ! -e "$data_dir/supervisor/homeassistant/configuration.yaml" ]; then
  sudo tee "$data_dir/supervisor/homeassistant/configuration.yaml" > /dev/null <<'STEVORA_NATIVE_CONFIGURATION'
default_config:
http:
  server_port: 8123
stevora:
  native_bootstrap: true
STEVORA_NATIVE_CONFIGURATION
fi

"""

def patch(path: Path) -> None:
    original = path.read_text(encoding="utf-8")
    if MARKER in original:
        raise ValueError("STEVORA data-image hook is already installed")
    if original.count(PINNED_UNMOUNT) != 1:
        raise ValueError("Unsupported upstream create-data-partition.sh: unmount anchor mismatch")
    if "docker exec" not in original or "sudo mount -o loop" not in original:
        raise ValueError("Unsupported upstream image layout; refusing mutation")
    patched = original.replace(PINNED_UNMOUNT, HOOK + PINNED_UNMOUNT)
    if patched.count(MARKER) != 1 or patched.count(PINNED_UNMOUNT) != 1:
        raise ValueError("Invalid patched image creator")
    path.write_text(patched, encoding="utf-8")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Pinned upstream HAOS create-data-partition.sh")
    args = parser.parse_args()
    patch(args.source)
    print("STEVORA first-boot data-image hook installed in build checkout")
