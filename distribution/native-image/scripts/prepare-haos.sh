#!/usr/bin/env bash
# STEVORA OS Native DP 0.1 — patch pinned, fresh upstream HAOS sources.
# This is not a modification of a running Home Assistant installation.
set -euo pipefail

HAOS_DIR="${1:?Usage: prepare-haos.sh path-to-HAOS-clone}"
SELF_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd -- "${SELF_DIR}/../.." && pwd)"
HAOS_DIR="$(cd -- "${HAOS_DIR}" && pwd)"

EXPECTED_UPSTREAM_SHA="495bedb8d70a92ad189efb64829ece34b165d3bd"
ACTUAL_SHA="$(git -C "${HAOS_DIR}" rev-parse HEAD)"
if [[ "${ACTUAL_SHA}" != "${EXPECTED_UPSTREAM_SHA}" ]]; then
  echo "Refusing patch: upstream HAOS commit mismatch: ${ACTUAL_SHA}" >&2
  exit 1
fi
if ! git -C "${HAOS_DIR}" diff --quiet || ! git -C "${HAOS_DIR}" diff --cached --quiet; then
  echo "Refusing patch: upstream HAOS checkout is already modified" >&2
  exit 1
fi

BUSYBOX_CONFIG="${HAOS_DIR}/buildroot-external/busybox.config"
META="${HAOS_DIR}/buildroot-external/meta"
PRESET="${HAOS_DIR}/buildroot-external/rootfs-overlay/usr/lib/systemd/system-preset/70-haos.preset"
SERVICE_TARGET="${HAOS_DIR}/buildroot-external/rootfs-overlay/usr/lib/systemd/system/stevora-native-web.service"
PUBLIC_DIR="${HAOS_DIR}/buildroot-external/rootfs-overlay/usr/share/stevora-os"

grep -qx '# CONFIG_HTTPD is not set' "${BUSYBOX_CONFIG}"
grep -qx 'HAOS_NAME="Home Assistant OS"' "${META}"
grep -qx 'HAOS_ID="haos"' "${META}"
grep -qx 'BR2_PACKAGE_BUSYBOX_INDIVIDUAL_BINARIES=y' "${HAOS_DIR}/buildroot-external/configs/ova_defconfig"
test -f "${PROJECT_ROOT}/custom_components/stevora_os/frontend/icons/stevora-192.png"

# Enable a dedicated static HTTP daemon in the *OS host*. Root / is NOT a
# Home Assistant panel or Lovelace view. No auth, private data or controls
# are exposed here in DP01.
sed -i 's/^# CONFIG_HTTPD is not set$/CONFIG_HTTPD=y/' "${BUSYBOX_CONFIG}"
sed -i 's/^HAOS_NAME="Home Assistant OS"$/HAOS_NAME="STEVORA OS Developer Preview"/' "${META}"

# Preserve HAOS_ID, CPE, Supervisor machine type, RAUC compatibility and
# current development signing profile: changing these prematurely can break
# startup / updates and is prohibited in DP01.
cp "${SELF_DIR}/systemd/stevora-native-web.service" "${SERVICE_TARGET}"
mkdir -p "${PUBLIC_DIR}"
cp "${SELF_DIR}/web/index.html" "${PUBLIC_DIR}/index.html"
cp "${SELF_DIR}/web/app.css" "${PUBLIC_DIR}/app.css"
cp "${PROJECT_ROOT}/custom_components/stevora_os/frontend/icons/stevora-192.png" "${PUBLIC_DIR}/stevora-192.png"

# Buildroot's post-build script runs systemctl preset-all after the overlay.
# It will enable this service as part of the generated read-only rootfs.
printf '\nenable stevora-native-web.service\n' >> "${PRESET}"

cat > "${PUBLIC_DIR}/build.json" <<'EOF'
{
  "product": "STEVORA OS",
  "release": "native-developer-preview-0.1",
  "capabilities": ["native-host-boot", "static-root-frontend"],
  "real_device_control": false,
  "system_bridge_enabled": false,
  "apps_management_enabled": false,
  "updates_management_enabled": false
}
EOF

grep -qx 'CONFIG_HTTPD=y' "${BUSYBOX_CONFIG}"
grep -q 'STEVORA OS Developer Preview' "${META}"
grep -q 'enable stevora-native-web.service' "${PRESET}"
test -s "${SERVICE_TARGET}"
test -s "${PUBLIC_DIR}/index.html"
test -s "${PUBLIC_DIR}/stevora-192.png"

echo "STEVORA native patch installed into pinned HAOS source."
echo "Build target: ova; native root UI: http://<VM-IP>/ (TCP/80)"
echo "DP01 has no HA Core management features — use fresh isolated VM only."
