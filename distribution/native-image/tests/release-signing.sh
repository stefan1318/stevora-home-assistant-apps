#!/usr/bin/env bash
# Exercise the production signing script against synthetic build outputs.
set -euo pipefail
script=$(cd "$(dirname "$0")/../scripts" && pwd)/sign-release.sh
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
for signer in build publisher; do
  openssl req -new -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=test-$signer" \
    -keyout "$signer.key" -out "$signer.pem" 2>/dev/null
done
mkdir bundle
echo synthetic > bundle/rootfs.img
cat >bundle/manifest.raucm <<'EOF'
[update]
compatible=stevora-ci
version=1.2.3
[bundle]
format=verity
[image.rootfs]
filename=rootfs.img
EOF
# Keep the fixture larger than one verity data block after compression.
dd if=/dev/urandom of=bundle/rootfs.img bs=4096 count=8 status=none
rauc --cert=build.pem --key=build.key bundle bundle input.raucb
for board in rpi4_64 generic_aarch64 ova; do
  mkdir -p "inputs/publisher-input-$board"
  cp input.raucb "inputs/publisher-input-$board/publisher-input.raucb"
done
PUBLISHER_KEY="$(cat publisher.key)" PUBLISHER_CERT="$(cat publisher.pem)" bash "$script" inputs signed
for asset in signed/*.raucb; do
  if rauc --keyring=build.pem info "$asset"; then
    echo "The old signer is still trusted for $asset" >&2
    exit 1
  fi
done
