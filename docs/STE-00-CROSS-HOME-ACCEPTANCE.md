# STEVORA cross-home manager acceptance plan (2026-11-19)

**Status:** integration CI passes; independent Home Assistant E2E is NOT yet certified.

## Server setup
1. Take full backup of the independent Home Assistant instance. Do not replace the Dunav production instance.
2. Install `custom_components/stevora` from branch `feature/stevora-admin-managers-integrated` as an isolated custom integration and restart Home Assistant.
3. Configure STEVORA using the HA UI; open `/stevora` when panel module is enabled.
4. Log in as a real HA admin; verify `stevora/admin/capabilities`, `stevora/admin/rooms/get`, `stevora/admin/assistants/get` and the Home Panel settings.
5. Repeat as a regular user. All admin commands MUST return `unauthorized`. The panel must not show admin controls.

## Room acceptance
- Compare HA Areas and registry entities to `stevora/manifest`.
- Exclude a test light and verify it disappears from the manifest and mobile device list after refresh.
- Restore it using `default`; check original HA discovery behavior.
- Rename a test room and entity via `stevora/admin/rooms/aliases/update` and verify manifest names change without modifying HA Areas.
- Confirm hidden/disabled HA entities cannot be explicitly included.
- Verify existing excluded bathroom entities on Dunav remain excluded (do not migrate without preserving settings).
- Send concurrent writes with the same expected revision; only one must succeed.

## Assistant acceptance
- Create at least two HA Assist pipelines and two users.
- Admin assigns a default pipeline and one user override using `stevora/admin/assistants/update`.
- For each user, `stevora/assistants/resolve` must return only their effective pipeline, never other users' settings.
- Delete a selected pipeline and verify safe fallback.
- Test iOS voice route and its `assist_pipeline/run` selection against the server.
- Confirm Android voice route independently; Android manager client APIs are currently NOT wired to the native Assist runtime.
- Native HA Assist permissions are NOT constrained by STEVORA selection; access grants need a separate enforceable server-side design.

## Mobile/Panel
- iOS admin manager view is present in More tab and uses authenticated WebSocket API.
- Home Panel has admin-only server-authorized controls, also accessible through a HA frontend WebView.
- Android has compiled manager protocol adapters but does not yet have a dedicated native manager UI.
- Test locale BG/EN, lost connection, invalid token, expired session, stale revision, and re-login.
- Verify backlight controls remain absent.

## Release gate
Do not call the next release a final test-ready bundle until (1) iOS and Android CI both pass for current commits; (2) native Android admin UI and assistant routing are integrated or clearly scoped out; (3) HA integration runs on an independent server; (4) admin/non-admin, revision, migration and rollback tests pass; (5) exact APK/IPA artifacts are verified.
