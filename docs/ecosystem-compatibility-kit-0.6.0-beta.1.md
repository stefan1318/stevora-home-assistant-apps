# STEVORA Ecosystem Compatibility Kit 0.6.0-beta.1 — development snapshot

**Status:** locally developed, unit-tested, **not yet deployed or released**. Date 2026-11-18. Source kit is provided to the user as a ZIP artifact in ChatGPT, and is **not automatically mirrored into this GitHub PR**.

**Package SHA-256:** `8bc2ea4957a4bea9a19b0a9085b5096a348d86e0bc57c7fcb9dac3aa2c596ba2`

## Core contract

- Custom integration domain: `stevora_ecosystem`.
- Independent, admin-only setup sidebar path: `/stevora-ecosystem`. Existing `/stevora` and STEVORA v7.1.1 are not overwritten.
- Native Home Assistant OAuth, entity/device/area registry, Person and Mobile App data. No iCloud or Find My credentials.
- WebSocket protocol `1.0.0`: `stevora_ecosystem/info`, `/discover`, `/mappings`, `/presence`; admin-only `/mapping_set`, `/protection_set`.
- Capability mappings saved into HA config entry options rather than browser localStorage; no site-specific entity IDs or personal IPs.
- No control operations in the Hub. Dynamic protected/backlight exclusion is only part of the safety model: native HA Assist/actions still require per-home permission and automation audits.
- Kotlin and Swift authenticated WebSocket shims, and JavaScript HA frontend adapter, are included **in the ZIP only**. This is not a new Android APK or iOS IPA.

## Local verification

- 38 Python tests passing including mocked WebSocket isolation, capabilities, person privacy, installer dry-run, backup/upgrade and protection logic.
- JS syntax check succeeded.
- ZIP integrity check + SHA-256 manifest generated.

## Runtime tests still required

1. Clean Home Assistant 2026.11.x install and Add Integration flow
2. Existing `/stevora` v7.1.1 + Memory Manager with no path conflict
3. Multiple HA homes, nonadmin, mobile account and wall-panel account isolation
4. iOS/Android signed build integration, OAuth session continuity, background geolocation and native Person association
5. Full v7.1.1 UI migration away from fixed `ENT` devices
6. Backlight safety at every actual HA control path, voice/AI exposure checks
7. HACS repository packaging, security/license audit, rollback and release check

Do not merge or tag a production release until these gates pass. Details are in the ZIP `README_BG.md`, `docs/ARCHITECTURE_BG.md` and `docs/RELEASE_GATES_BG.md`.
