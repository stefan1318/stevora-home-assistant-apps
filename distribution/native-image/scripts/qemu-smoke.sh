#!/usr/bin/env bash
# Boot the REAL generated OVA QCOW2 image and probe STEVORA root endpoint.
set -euo pipefail

IMAGE="${1:?Usage: qemu-smoke.sh output/images/haos_ova-*.qcow2}"
test -s "${IMAGE}"
command -v qemu-system-x86_64
command -v curl

WORKDIR="$(mktemp -d)"
SERIAL="${WORKDIR}/serial.log"
FIRMWARE=""
for path in /usr/share/OVMF/OVMF_CODE_4M.fd /usr/share/OVMF/OVMF_CODE.fd; do
  if [[ -f "${path}" ]]; then FIRMWARE="${path}"; break; fi
done
if [[ -z "${FIRMWARE}" ]]; then
  echo "No UEFI OVMF firmware found; this image cannot be boot-tested" >&2
  exit 1
fi

VARSVARS="${WORKDIR}/OVMF_VARS.fd"
if [[ "${FIRMWARE}" == *4M* && -f /usr/share/OVMF/OVMF_VARS_4M.fd ]]; then
  cp /usr/share/OVMF/OVMF_VARS_4M.fd "${VARSVARS}"
elif [[ -f /usr/share/OVMF/OVMF_VARS.fd ]]; then
  cp /usr/share/OVMF/OVMF_VARS.fd "${VARSVARS}"
else
  echo "No compatible UEFI vars firmware found" >&2
  exit 1
fi

ACCEL=()
if [[ -r /dev/kvm ]]; then ACCEL=(-enable-kvm); fi
qemu-system-x86_64 \
  "${ACCEL[@]}" \
  -machine q35 -cpu max -m 3072 -smp 2 \
  -drive "if=pflash,format=raw,readonly=on,file=${FIRMWARE}" \
  -drive "if=pflash,format=raw,file=${VARSVARS}" \
  -drive "if=virtio,format=qcow2,file=${IMAGE}" \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:18080-:80 \
  -device virtio-net-pci,netdev=n0 \
  -display none -monitor none -serial "file:${SERIAL}" -no-reboot \
  > "${WORKDIR}/qemu.log" 2>&1 &
QEMU_PID=$!
cleanup() {
  kill "${QEMU_PID}" 2>/dev/null || true
  wait "${QEMU_PID}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting OVA/QEMU native boot check (UEFI, host TCP 18080 -> VM TCP 80)."
GOOD=0
for attempt in $(seq 1 120); do
  if ! kill -0 "${QEMU_PID}" 2>/dev/null; then
    echo "QEMU exited before STEVORA could serve its root UI." >&2
    break
  fi
  if curl -fsS --max-time 3 http://127.0.0.1:18080/ > "${WORKDIR}/page.html"; then
    if grep -q '<title>STEVORA OS — Native Developer Preview</title>' "${WORKDIR}/page.html"; then
      GOOD=1
      break
    fi
  fi
  sleep 5
done

if [[ "${GOOD}" != 1 ]]; then
  echo "STEVORA Native DP01 failed actual QEMU boot+HTTP validation" >&2
  tail -80 "${SERIAL}" 2>/dev/null || true
  tail -60 "${WORKDIR}/qemu.log" 2>/dev/null || true
  exit 1
fi

curl -fsS --max-time 5 http://127.0.0.1:18080/build.json > "${WORKDIR}/build.json"
python3 - "${WORKDIR}/build.json" <<'PY'
import json, pathlib, sys
data = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert data["product"] == "STEVORA OS"
assert data["release"] == "native-developer-preview-0.1"
assert data["real_device_control"] is False
assert data["system_bridge_enabled"] is False
print("Native boot+HTTP service PASS; no fake control claims.")
PY

echo "Native x86_64 OVA boot verified: STEVORA root / reachable on TCP/80."
