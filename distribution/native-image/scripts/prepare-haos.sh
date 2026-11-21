#!/usr/bin/env bash
# STEVORA OS Native Integrated Developer Preview.
# Applies a controlled overlay to a clean, pinned *build* checkout only.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: prepare-haos.sh path-to-HAOS-checkout" >&2
  exit 2
fi
HAOS_DIR="$(cd -- "$1" && pwd)"
SELF_DIR="$(cd -- "$(dirname -- "$0")/.." && pwd)"
PROJECT_ROOT="$(cd -- "$SELF_DIR/../.." && pwd)"
EXPECTED_UPSTREAM_SHA="495bedb8d70a92ad189efb64829ece34b165d3bd"

ACTUAL_SHA="$(git -C "$HAOS_DIR" rev-parse HEAD)"
if [ "$ACTUAL_SHA" != "$EXPECTED_UPSTREAM_SHA" ]; then
  echo "Refusing native overlay: expected pinned upstream commit $EXPECTED_UPSTREAM_SHA, found $ACTUAL_SHA" >&2
  exit 1
fi
if ! git -C "$HAOS_DIR" diff --quiet || ! git -C "$HAOS_DIR" diff --cached --quiet; then
  echo "Refusing to modify an already edited upstream HAOS checkout" >&2
  exit 1
fi

BUSYBOX_CONFIG="$HAOS_DIR/buildroot-external/busybox.config"
META="$HAOS_DIR/buildroot-external/meta"
PRESET="$HAOS_DIR/buildroot-external/rootfs-overlay/usr/lib/systemd/system-preset/70-haos.preset"
SERVICE_TARGET="$HAOS_DIR/buildroot-external/rootfs-overlay/usr/lib/systemd/system/stevora-native-web.service"
GATEWAY_TARGET="$HAOS_DIR/buildroot-external/rootfs-overlay/usr/bin/stevora-native-gateway"
PUBLIC_DIR="$HAOS_DIR/buildroot-external/rootfs-overlay/usr/share/stevora-os"
COMPONENTS_DIR="$HAOS_DIR/buildroot-external/stevora-custom-components"
DATA_SCRIPT="$HAOS_DIR/buildroot-external/package/hassio/create-data-partition.sh"

GATEWAY="$SELF_DIR/gateway/stevora-native-gateway"
test -x "$GATEWAY" || { echo "Native Go gateway has not been compiled" >&2; exit 1; }
test -s "$SELF_DIR/web/app.js"
test -s "$SELF_DIR/web/index.html"
test -s "$SELF_DIR/web/app.css"
test -s "$PROJECT_ROOT/custom_components/stevora/manifest.json"
test -s "$PROJECT_ROOT/custom_components/stevora_os/frontend/icons/stevora-192.png"

# Reject source drift BEFORE modifying any build configuration.
grep -qx '# CONFIG_HTTPD is not set' "$BUSYBOX_CONFIG"
grep -qx 'HAOS_NAME="Home Assistant OS"' "$META"
grep -qx 'HAOS_ID="haos"' "$META"
grep -qx 'BR2_PACKAGE_BUSYBOX_INDIVIDUAL_BINARIES=y' "$HAOS_DIR/buildroot-external/configs/ova_defconfig"
grep -q 'sudo umount "' "$DATA_SCRIPT"

# Keep the native Supervisor OS identity for now (HAOS_ID/RAUC and machine).
# Branding and authenticated STEVORA root UI are provided by our own layers.
sed -i 's/^# CONFIG_HTTPD is not set$/CONFIG_HTTPD=y/' "$BUSYBOX_CONFIG"
# The physical-console publisher enrollment command verifies a public X.509 certificate.
if ! grep -qx 'BR2_PACKAGE_LIBOPENSSL_BIN=y' "$HAOS_DIR/buildroot-external/configs/ova_defconfig"; then
  printf '\nBR2_PACKAGE_LIBOPENSSL_BIN=y\n' >> "$HAOS_DIR/buildroot-external/configs/ova_defconfig"
fi
sed -i 's/^HAOS_NAME="Home Assistant OS"$/HAOS_NAME="STEVORA OS Integrated Developer Preview"/' "$META"

install -m 0644 "$SELF_DIR/systemd/stevora-native-web.service" "$SERVICE_TARGET"
install -m 0755 "$GATEWAY" "$GATEWAY_TARGET"
mkdir -p "$PUBLIC_DIR" "$COMPONENTS_DIR"
install -m 0644 "$SELF_DIR/web/index.html" "$PUBLIC_DIR/index.html"
install -m 0644 "$SELF_DIR/web/app.css" "$PUBLIC_DIR/app.css"
install -m 0644 "$SELF_DIR/web/stevora-login.css" "$PUBLIC_DIR/stevora-login.css"
install -m 0644 "$SELF_DIR/web/stevora-login.png" "$PUBLIC_DIR/stevora-login.png"
install -m 0644 "$SELF_DIR/web/setup.js" "$PUBLIC_DIR/setup.js"
install -m 0644 "$SELF_DIR/web/app.js" "$PUBLIC_DIR/app.js"
install -m 0644 "$PROJECT_ROOT/custom_components/stevora_os/frontend/icons/stevora-192.png" "$PUBLIC_DIR/stevora-192.png"
cp -a "$PROJECT_ROOT/custom_components/stevora" "$COMPONENTS_DIR/stevora"

ROOTFS="$HAOS_DIR/buildroot-external/rootfs-overlay"
install -Dm0644 "$SELF_DIR/systemd/stevora-builtin.service" "$ROOTFS/usr/lib/systemd/system/stevora-builtin.service"
install -Dm0644 "$SELF_DIR/systemd/rauc-publisher.conf" "$ROOTFS/usr/lib/systemd/system/rauc.service.d/stevora.conf"
install -Dm0755 "$SELF_DIR/scripts/enroll-publisher.sh" "$ROOTFS/usr/bin/stevoractl-enroll-publisher"
mkdir -p "$ROOTFS/usr/share/stevora-components"
cp -a "$COMPONENTS_DIR/stevora" "$ROOTFS/usr/share/stevora-components/"
printf '%s\n' 'enable stevora-builtin.service' >> "$PRESET"
for asset in qrcode.js qrcode-LICENSE.txt flows.js; do
  install -m0644 "$SELF_DIR/web/$asset" "$PUBLIC_DIR/$asset"
done

# The upstream post-build step runs systemctl preset-all.
printf '\nenable stevora-native-web.service\n' >> "$PRESET"

# First boot includes the STEVORA Core adapter and Home Hub. The legacy panel
# is disabled by the adapter's import config flow. This hook runs during
# HAOS data-image creation, *not* on a running HA installation.
python3 "$SELF_DIR/scripts/patch-data-partition.py" "$DATA_SCRIPT"

cat > "$PUBLIC_DIR/build.json" <<'STEVORA_NATIVE_META'
{
  "product": "STEVORA OS",
  "release": "native-integrated-dev.3",
  "capabilities": ["native-host-boot", "https-root-frontend", "ha-core-oauth", "supervisor-api-through-core"],
  "real_device_control": false,
  "system_bridge_enabled": true,
  "apps_management_enabled": true,
  "local_rauc_upload": true,
  "publisher_enrollment_required": true,
  "backup_restore_enabled": false,
  "signed_stevora_ota": false,
  "test_only": true
}
STEVORA_NATIVE_META

grep -qx 'CONFIG_HTTPD=y' "$BUSYBOX_CONFIG"
grep -q 'STEVORA OS Integrated Developer Preview' "$META"
grep -qx 'enable stevora-native-web.service' "$PRESET"
grep -q 'native_bootstrap: true' "$DATA_SCRIPT"
test -s "$PUBLIC_DIR/index.html"
test -s "$PUBLIC_DIR/app.js"
test -s "$PUBLIC_DIR/build.json"
test -s "$PUBLIC_DIR/stevora-192.png"
test -s "$COMPONENTS_DIR/stevora/manifest.json"
test -x "$GATEWAY_TARGET"

echo "STEVORA native overlay applied to the pinned upstream build checkout."
echo "Boot-test target: https://<VM-IP>/ (self-signed TLS, port 443)."
echo "WARNING: dev image only; no signed OTA or backup restore."
