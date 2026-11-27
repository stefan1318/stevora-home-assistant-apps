#!/bin/sh
set -eu
certificate=${1:?missing embedded certificate}
directory=${2:?missing persistent update directory}
destination="$directory/publisher.pem"

[ ! -e "$destination" ] || exit 0
umask 077
mkdir -p "$directory"
temporary=$(mktemp "$directory/publisher.XXXXXX")
trap 'rm -f "$temporary"' EXIT
cp "$certificate" "$temporary"
ln "$temporary" "$destination" || [ -f "$destination" ]
