# [STE-05] STEVORA Modular Installer — Phase 1

Status: **implemented in experimental GitHub feature branch, CI test only; not approved for production**.

## Goal
A new Home Assistant installation installs the **same** STEVORA Core, but selects only the
modules that are actually shipped. Each HA server keeps its own config entry, users,
room mapping, entities and permissions. No Dunav-specific entities or credentials.

## Bundled in the current experimental integration
- **STEVORA Core**: always enabled, authenticated WebSocket `stevora/manifest` with schema 1.0,
  room/device discovery and permission-filtered projections.
- **STEVORA Home Panel (starter)**: installable option `panel_enabled`, default **true**
  for backward compatibility. The graphical setup flow and options flow expose the choice.
  When disabled, no custom panel is registered. When enabled, `/stevora` is claimed
  **only if the route is unoccupied**.
- Per-config-entry panel ownership is stored under `hass.data["stevora"][entry_id]`.
  Integration unload removes only a panel registered by this entry.
- Module statuses are added as an optional additive `modules` field to the existing manifest
  (no schema_version bump). Values for `home_panel.status`: `active`, `disabled`,
  `conflict` or `pending`.

## Not bundled or silently installed
- **STEVORA Home Hub**, **Hey Stevora** and **Memory & Sync** appear only as
  `bundled: false, enabled: false, status: not_included` in the module catalog.
- **STEVORA Android/iOS** are separate clients, not Home Assistant add-ons or integration
  modules. No APK/IPA is installed by this HA package.
- The existing `voice_enabled` preference is kept for migration compatibility but
  **never claims a working voice engine**; `capabilities.voice` remains false until a
  voice integration is actually delivered.
- No new Home Assistant device integrations, entities, automation, scenes or service calls
  are created during setup.

## Invariants and isolation
1. The integration must never overwrite or remove a foreign `/stevora` panel.
2. The old `stevora_manifest` handler is incompatible with `stevora`:
   **do not activate both**, because both claim `stevora/manifest`.
3. A manifest represents only the connected Home Assistant installation.
4. A user sees only entities authorized by HA read permissions. UI controls are shown
   only for entities authorized by HA control permissions. HA service checks remain authoritative.
5. No user-specific tokens or entity inventories may be uploaded to build logs.

## Phase-1 test coverage
- Setup and options forms expose the panel selection.
- Enabled, disabled and existing-route-conflict cases.
- Panel registration, unload, reload and activation after updating options.
- Multiple HA homes with different entities/rooms and module states.
- Permission projections and frontend exclusion of backlight controls.
- Python tests and JavaScript execution in GitHub Actions.

The current tests use local Home Assistant API stubs. **An actual fresh HA instance
must still be used** to verify config flow, frontend registration, OAuth clients, reload,
upgrade, uninstall and restore. CI success alone is not release approval.

## Next acceptance gate (Phase 2)
Use a disposable, independent HA installation, not Dunav.
1. Install this feature branch's `custom_components/stevora` package.
2. Verify new setup form, panel-on and panel-off installs and options reload.
3. Pre-register a foreign `/stevora` panel; verify STEVORA records a conflict and does
   not remove the foreign panel upon unload.
4. Test admin/read-only/control-limited users and independent Home A/B mappings.
5. Run restart, upgrade, unload, reinstall and rollback; capture evidence.
6. Only after a **verified full Dunav backup and restore rehearsal** approve migration
   from `stevora_manifest` to `stevora`.

## Distribution
This repo is also an HA Apps/add-ons repository. A Home Assistant custom integration
is a different package type. Do not present this phase as a tested HACS one-click
installer or a full ecosystem installer. Packaging, onboarding for future modules and
signing/release channels are later gates.
