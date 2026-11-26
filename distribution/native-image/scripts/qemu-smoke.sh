#!/usr/bin/env bash
# Boot the generated QCOW2 via UEFI and probe the STEVORA gateway.
set -euo pipefail

IMAGE="${1:?Usage: qemu-smoke.sh image.qcow2 [x86_64|aarch64] [log-directory]}"
ARCH="${2:-x86_64}"
test -s "$IMAGE"
command -v curl

case "$ARCH" in
  x86_64)
    QEMU=qemu-system-x86_64
    MACHINE=q35
    CPU=max
    FIRMWARE=/usr/share/OVMF/OVMF_CODE_4M.fd
    VARS_TEMPLATE=/usr/share/OVMF/OVMF_VARS_4M.fd
    if [[ ! -f "$FIRMWARE" ]]; then
      FIRMWARE=/usr/share/OVMF/OVMF_CODE.fd
      VARS_TEMPLATE=/usr/share/OVMF/OVMF_VARS.fd
    fi
    ;;
  aarch64)
    QEMU=qemu-system-aarch64
    MACHINE=virt
    CPU=cortex-a72
    FIRMWARE=/usr/share/AAVMF/AAVMF_CODE.fd
    VARS_TEMPLATE=/usr/share/AAVMF/AAVMF_VARS.fd
    ;;
  *) echo "Unsupported QEMU architecture: $ARCH" >&2; exit 2 ;;
esac
command -v "$QEMU"
test -r "$FIRMWARE"
test -r "$VARS_TEMPLATE"

WORKDIR="$(mktemp -d)"
LOGDIR="${3:-$WORKDIR}"
mkdir -p "$LOGDIR"
SERIAL="$LOGDIR/serial.log"
VARSVARS="$WORKDIR/uefi-vars.fd"
cp "$VARS_TEMPLATE" "$VARSVARS"

ACCEL=()
if [[ "$ARCH" = x86_64 && -r /dev/kvm ]]; then ACCEL=(-enable-kvm); fi
# ARM64 UEFI firmware includes the VirtIO driver; the PCI option ROM is not
# required and is missing from some Ubuntu QEMU packages (efi-virtio.rom).
NET_DEVICE="virtio-net-pci,netdev=n0"
if [[ "$ARCH" = aarch64 ]]; then NET_DEVICE+=",romfile="; fi
"$QEMU" \
  "${ACCEL[@]}" \
  -machine "$MACHINE" -cpu "$CPU" -m 3072 -smp 2 \
  -drive "if=pflash,format=raw,readonly=on,file=${FIRMWARE}" \
  -drive "if=pflash,format=raw,file=${VARSVARS}" \
  -drive "if=virtio,format=qcow2,snapshot=on,file=${IMAGE}" \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:18080-:80,hostfwd=tcp:127.0.0.1:18443-:443 \
  -device "$NET_DEVICE" \
  -display none -monitor none -serial "file:${SERIAL}" -no-reboot \
  > "${LOGDIR}/qemu.log" 2>&1 &
QEMU_PID=$!
cleanup() {
  kill "${QEMU_PID}" 2>/dev/null || true
  wait "${QEMU_PID}" 2>/dev/null || true
  rm -rf -- "$WORKDIR"
}
trap cleanup EXIT

echo "Starting UEFI/QEMU boot check (host 18080 to VM 80 HTTP)."
GOOD=0
for attempt in $(seq 1 "${QEMU_BOOT_ATTEMPTS:-120}"); do
  if ! kill -0 "${QEMU_PID}" 2>/dev/null; then
    echo "QEMU exited before STEVORA could serve its root UI." >&2
    break
  fi
  if curl -s --fail --max-time 5 http://127.0.0.1:18080/ > "${WORKDIR}/page.html"; then
    if grep -q '<title>STEVORA OS</title>' "${WORKDIR}/page.html"; then
      GOOD=1
      break
    fi
  fi
  sleep 5
done

if [[ "${GOOD}" != 1 ]]; then
  echo "STEVORA failed actual QEMU boot+HTTP validation" >&2
  tail -80 "${SERIAL}" 2>/dev/null || true
  tail -60 "${LOGDIR}/qemu.log" 2>/dev/null || true
  exit 1
fi

curl -sS --fail --max-time 5 http://127.0.0.1:18080/build.json > "${WORKDIR}/build.json"
for asset in flows.js qrcode.js controls.js management.js setup.js stevora-login.css stevora-login.png; do
  curl -sS --fail --max-time 5 "http://127.0.0.1:18080/$asset" > "${WORKDIR}/$asset"
  test -s "${WORKDIR}/$asset"
done
curl -sS --fail --max-time 5 http://127.0.0.1:18080/healthz >/dev/null
grep -q 'createStevoraSetup' "${WORKDIR}/setup.js"
python3 - "${WORKDIR}/build.json" <<'PY'
import json, pathlib, sys
data = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert data["product"] == "STEVORA OS"
assert data["release"] == "native-integrated-dev.4"
assert data["test_only"] is True
assert data["signed_stevora_ota"] is False
print("Native boot+HTTP service PASS; unsigned update remains disabled.")
PY

echo "Native $ARCH image boot verified: STEVORA root / reachable on HTTP TCP/80."
