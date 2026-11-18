# STEVORA Home Assistant Integration — 0.1.0 experimental

**Status: feature branch / not released / NOT approved for Home Assistant Dunav.**

## Current implementation
- HA graphical config flow and BG/EN options for automatic discovery, optional Home Panel, voice preference, room selection, and climate/lighting entity selection.
- Authenticated `stevora/manifest` WebSocket discovery (schema 1.0).
- Administrator receives complete manifest; other authenticated users receive only entities they can **read**. Control affordances are provided only for entities they may **control**. HA service permissions remain authoritative.
- Native `/stevora` custom frontend panel with live entity states, simple climate and light/fan controls, room filtering and exclusion of backlights.
- Panel registration is optional (`panel_enabled`). An occupied `/stevora` path is treated as a conflict rather than overwritten. Unload removes the panel only if this integration registered it.
- The additive `modules` manifest section identifies bundled Core and starter Panel; Home Hub, Hey Stevora and Memory Sync are explicitly marked not included. The voice preference alone does not enable a voice engine.
- Panel removal uses `frontend.async_remove_panel`; static frontend route is registered once across config-entry reloads.
- Local Python contract and mock-based lifecycle/permissions/config-flow tests, plus execution of Home Panel JS tests in CI.

## How to test safely
1. Use an **independent disposable HA test instance**. This is not a production installer.
2. Copy `custom_components/stevora` into that instance's custom components directory.
3. Restart HA, open Settings → Devices & services → Add integration → **STEVORA Ecosystem**.
4. Check setup form, options, `/stevora` and an authenticated `stevora/manifest` request.
5. Repeat with an administrator, a read-only user and a user with limited control permission.
6. On the disposable test instance, repeat setup with `panel_enabled=false` and with a conflicting `/stevora` route; verify no foreign panels are removed.
7. Test options reload, unload/reload, removal, restart and installation to a second independent HA instance.

## Critical incompatibility and rollback
Do **not** activate the older `stevora_manifest` integration and this `stevora` integration simultaneously. Both register the `stevora/manifest` command; this can cause a conflict. Never remove a working installation without a verified backup.

The universal integration has **not** been installed on Dunav. See `docs/STE-05-DUNAV-MIGRATION.md` for the backup, isolated test, migration and rollback gates, and `docs/STE-05-MODULAR-INSTALLER-PHASE-1.md` for the modular installer scope.

## Release blockers
- Actual Home Assistant runtime installation tests (including version compatibility), not merely mocks.
- Confirmation that the panel works for the intended admin/user roles on real HA.
- Safe upgrade/removal when an existing dashboard or custom panel already claims `/stevora`.
- Android/iOS real-device OAuth, multi-home and permission/controls acceptance tests.
- Verified Dunav full backup, migration dry-run and rollback rehearsal.

Do not treat passing CI as final product acceptance.
