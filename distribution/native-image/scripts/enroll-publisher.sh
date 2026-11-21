#!/bin/sh
# Run on the OS host console, using a public release certificate obtained separately.
set -eu
if [ "$#" -ne 2 ]; then
  echo "Usage: stevoractl-enroll-publisher CERT.pem EXPECTED_SHA256_FINGERPRINT" >&2
  exit 2
fi
umask 077
dir=/mnt/data/stevora/update
mkdir -p "$dir"
tmp=$(mktemp "$dir/publisher.XXXXXX")
trap 'rm -f "$tmp"' EXIT
openssl x509 -in "$1" -out "$tmp"
actual=$(openssl x509 -in "$tmp" -noout -fingerprint -sha256 | cut -d= -f2 | tr -d ':' | tr 'A-F' 'a-f')
expected=$(echo "$2" | tr -d ':' | tr 'A-F' 'a-f')
[ "${#expected}" = 64 ] && [ "$actual" = "$expected" ] || { echo "Fingerprint mismatch" >&2; exit 1; }
openssl x509 -in "$tmp" -checkend 0 -noout
if [ -e "$dir/publisher.pem" ] && ! cmp -s "$tmp" "$dir/publisher.pem"; then
  echo "Existing publisher differs; rotate explicitly from the host console." >&2
  exit 1
fi
mv "$tmp" "$dir/publisher.pem"
systemctl restart rauc.service
