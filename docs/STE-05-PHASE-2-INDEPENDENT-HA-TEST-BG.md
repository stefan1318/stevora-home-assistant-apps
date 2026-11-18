# [STE-05] Phase 2 — Test on a new independent Home Assistant installation

**Type:** Manual acceptance playbook, not an unattended installer.
**Target:** disposable and independent Home Assistant instance; **never Dunav**.
**Pinned source:** `7c0ea02ee0ba50933fd59d20b411d43f9579a2e9`.
**Expected code version:** `custom_components/stevora/manifest.json` version `0.1.0`.
**Status:** Ready to conduct; **no independent HA runtime test recorded yet**.

## 0. Preconditions

- HA is operating on a separate installation, storage and config directory.
- You can open Settings > System > About and Settings > System > Logs.
- No `custom_components/stevora` nor `custom_components/stevora_manifest` exists on that test server.
- No existing HA custom panel owns `/stevora` (first test).
- A temporary admin account is available for installation and testing.
- Never share access tokens or backup archives in GitHub issues or logs.
- Do NOT modify Dunav, copy its files or use its backup as the starting point.

## 1. Install pinned test code (Terminal on TEST Home Assistant only)

Use the test server's Terminal & SSH app or another terminal with access to its
`/config` directory. First verify you are connected to the **test instance**.
Execute one command at a time:

```sh
cd /config
test ! -e /config/custom_components/stevora
test ! -e /config/custom_components/stevora_manifest
command -v curl
command -v unzip
mkdir -p /config/custom_components
mkdir -p /tmp/stevora-phase2
curl -fL --retry 2 -o /tmp/stevora-phase2/source.zip \
  https://codeload.github.com/stefan1318/stevora-home-assistant-apps/zip/7c0ea02ee0ba50933fd59d20b411d43f9579a2e9
unzip -q /tmp/stevora-phase2/source.zip -d /tmp/stevora-phase2
cp -R /tmp/stevora-phase2/stevora-home-assistant-apps-7c0ea02ee0ba50933fd59d20b411d43f9579a2e9/custom_components/stevora \
  /config/custom_components/
test -f /config/custom_components/stevora/manifest.json
test -f /config/custom_components/stevora/frontend/stevora-panel.js
ls -la /config/custom_components/stevora
```

If `curl`, `unzip` or a file check fails, **STOP** and report the error. No
automatic deletion, overwrite or migration is part of this playbook.

Alternative manual extraction: obtain the exact GitHub commit archive on your
computer, and copy **only** `custom_components/stevora/` to `/config/custom_components/stevora/`
of the *test* server, preserving the folder hierarchy.

## 2. First boot and onboarding

1. Restart the test Home Assistant from Settings > System > Restart.
2. Confirm absence of STEVORA import/manifest/config-flow failures in System > Logs.
3. Settings > Devices & services > Add integration > `STEVORA Ecosystem`.
4. Select Bulgarian or English, `auto_discovery=true`,
   `panel_enabled=true`, `voice_enabled=false`.
5. Ensure STEVORA config entry appears, and navigate to `/stevora`.
6. If the new system has no supported entity assigned to a room, a zero-entity
   panel is expected; attach one supported test light/switch/climate/sensor
   to an area before verifying automatic discovery.

## 3. Record and verify

| ID | Test | Expected result |
|---|---|---|
| T-01 | First setup | STEVORA Ecosystem entry is created, without errors |
| T-02 | /stevora | A panel loads with current states, no backlight controls |
| T-03 | Room mapping | Assigned test entities appear in correct room |
| T-04 | Read-only account | Only readable entities; no control buttons |
| T-05 | Restricted control | Only authorized entities show controls |
| T-06 | Disable panel in options | /stevora panel disappears after entry reload; Core remains |
| T-07 | Reenable panel | Panel returns; no duplicated static-route errors |
| T-08 | Unload/remove | STEVORA-owned panel disappears and other HA panels remain |
| T-09 | Restart | Config survives restart, without duplicate-command errors |
| T-10 | Other home | Independent server has its own room IDs and installation ID |
| T-11 | Missing optional modules | Home Hub/Hey Stevora/Memory Sync never claim to be installed |
| T-12 | Conflict | Foreign /stevora panel is not overwritten or removed |

**Not tested by current CI:** actual Home Assistant core runtime, custom components
Marketplace packaging, OAuth between independent Android/iOS apps and home,
and complete migration/restore. Any failures block moving to Dunav.

## 4. What to return to development

- HA Core and OS version from the test server, installation type and chosen language.
- Result PASS/FAIL for tests T-01 to T-12; start with T-01, T-02, T-03.
- Only relevant STEVORA-related sanitized log lines if a test fails.
- Do not send private IPs, credentials, authentication tokens, personal device IDs
  or real home location.

## 5. Rollback for the isolated TEST Home Assistant only

First remove STEVORA through Settings > Devices & services and restart. In the
disposable instance, if the integration fails to load and no working configuration
depends on it, move the test `stevora` folder aside and restart; do not touch
`stevora_manifest`, Dunav, user automations, scenes or devices.

**Exit gate:** T-01 to T-12 recorded, real HA runtime compatibility confirmed,
rollback verified, then conduct separately approved Dunav migration.
