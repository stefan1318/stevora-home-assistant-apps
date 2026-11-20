# [STE-00] STEVORA OS 0.2.0 Developer Preview — System Center

**Status:** DEVELOPMENT / DRAFT PR. Do not deploy to Dunav or merge into main.

## Previous acceptance

The operator reports 6/6 basic VM acceptance checks passed on STEVORA OS 0.1.0:
HA starts, /stevora-os loads, BG/EN and rooms work, /stevora unaffected,
system tiles show correct values, and layout works on desktop/mobile.
This does **not** cover non-admin endpoint probing, cross-home switching,
update entity accuracy, backup restore, or ARM64 hardware.

## What's new in 0.2.0

1. New server-side, admin-protected, **read-only** WebSocket command `stevora_os/system/status`.
2. System Center: actual HA Core version + state; active HA state count; STEVORA and Home Hub status.
3. OS / Core / Supervisor update awareness by HA Update entities, if present. `not_detected`/ `unknown` explicitly means *not verified*, never "up to date". `on` means available and `off` means no update indicated.
4. Admin-only detailed diagnostics. Other users receive a limited system overview, without privileged API data or update details. The HA admin link appears only for administrators.
5. BG/EN System Center labels, responsive update cards, cache-busted assets.
6. Existing `/stevora` and the core OS remain unchanged. No device actions, software update execution, backup, restore or reboot is exposed.

The system backend does **not** use Supervisor private endpoints. This iteration deliberately tests the UI separation and secure data boundary before any potential administrative actions.

## VM upgrade from working 0.1.0

**Preconditions:** user-confirmed existing HA backup; independent VM only; STEVORA Universal Integration configured; the GitHub Actions check for the **exact 0.2.0 head SHA** has passed.

Open Terminal & SSH in the independent VM and execute after verifying the current SHA for the 0.2.0 draft branch:

```sh
set -eu
SHA="<CI-verified-0.2.0-commit-SHA>"
BASE="https://raw.githubusercontent.com/stefan1318/stevora-home-assistant-apps/$SHA/custom_components/stevora_os"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="/config/custom_components/stevora_os"
STAGE="/config/custom_components/.stevora-os-02-$STAMP"
BACKUP="/config/stevora-os-backup-01-$STAMP"

test -d "$TARGET"
test -f /config/configuration.yaml
grep -Eq '^[[:space:]]*stevora_os[[:space:]]*:' /config/configuration.yaml
command -v curl
mkdir -p "$STAGE/frontend"

for FILE in manifest.json __init__.py system_api.py frontend/stevora-os.js frontend/stevora-os.css; do
  curl -fLsS --retry 3 "$BASE/$FILE" -o "$STAGE/$FILE"
done
grep -q '"version": "0.2.0"' "$STAGE/manifest.json"
grep -q 'stevora_os/system/status' "$STAGE/system_api.py"
grep -q 'stevora-os-preview' "$STAGE/frontend/stevora-os.js"

mv "$TARGET" "$BACKUP"
mv "$STAGE" "$TARGET"
echo "Rollback: $BACKUP"
ha core check
```

If `ha core check` passes, execute `ha core restart` and open `/stevora-os`. On desktop refresh cache with Ctrl+Shift+R; on mobile reload the page.

**If `ha core check` fails:** do not restart. Execute the following with the exact reported backup directory:

```sh
mv /config/custom_components/stevora_os /config/stevora-os-failed-02
mv /config/stevora-os-backup-01-<STAMP> /config/custom_components/stevora_os
ha core check
```

Do not run the rollback block until replacing `<STAMP>` with the specific backup name output by the installer. An existing `/config/stevora-os-failed-02` must be moved aside first; do not overwrite it.

## Acceptance for 0.2.0

- [ ] 0.2.0 starts normally after HA restart; `/stevora` unchanged.
- [ ] System Center shows the **actual** Core version and useful HA status, not hardcoded numbers.
- [ ] Updates Core / OS / Supervisor show the correct `available`, `up_to_date`, `unknown` or `not_detected`.
- [ ] Clicking "Check system" performs only the read-only status request.
- [ ] Non-admin user cannot invoke `stevora_os/system/status` (WebSocket unauthorized), nor view admin data/buttons.
- [ ] BG/EN accurately translates all new System Center labels and preserves live home data.
- [ ] Changing HA user/home immediately clears previous private diagnostics.
- [ ] No UI flickering or lost navigation on HA state changes; test desktop/iPhone/Android.
- [ ] Official HA settings, backups, updates and `/stevora` remain operational.
- [ ] Revert to 0.1.0 backup directory and recover System Center after returning to 0.2.0.

**Raspberry Pi 4/5:** not covered by these VM tests.
