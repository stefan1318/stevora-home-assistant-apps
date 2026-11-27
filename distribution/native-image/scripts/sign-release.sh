#!/usr/bin/env bash
set -euo pipefail
input_dir=${1:?missing input directory}
output_dir=${2:?missing output directory}
umask 077
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf '%s\n' "${PUBLISHER_CERT:?missing release certificate}" > "$tmp/cert.pem"
printf '%s\n' "${PUBLISHER_KEY:?missing release key}" > "$tmp/key.pem"
unset PUBLISHER_KEY
mkdir -p "$output_dir"
for board in rpi4_64 generic_aarch64 ova; do
  target="$output_dir/stevora-os-$board.raucb"
  rauc --no-verify --cert="$tmp/cert.pem" --key="$tmp/key.pem" resign \
    "$input_dir/publisher-input-$board/publisher-input.raucb" "$target"
  rauc --keyring="$tmp/cert.pem" info "$target"
done
