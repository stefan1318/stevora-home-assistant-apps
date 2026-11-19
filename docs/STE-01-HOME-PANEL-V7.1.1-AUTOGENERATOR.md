# STEVORA Home Panel v7.1.1 — Universal Auto Generator

Status: release candidate for independent Home Assistant acceptance, not a certified clone of the Dunav YAML dashboard.

## Installation behavior

When the STEVORA integration is configured with Home Panel enabled, Home Assistant registers the custom panel at `/stevora` (only if that route is free). The panel requests `stevora/manifest` and `stevora/panel/generate` using the current authenticated Home Assistant account. No per-home YAML file or hardcoded entity IDs are required.

The generator builds sections from the actual Home Assistant area/device/entity registries, respects STEVORA room order, aliases, room overrides, entity exclusions, user visibility and HA read/control permissions. It generates info, compact or expanded cards based on the stored profile. New entities and rooms are discovered on refresh; the web panel also refreshes when the HA state entity set changes.

A device with no saved customization receives default domain-appropriate controls. A saved profile with an empty `controls` list is intentionally info-only. A profile with `layout=info` always has no controls. Other advanced actions open the native HA more-info panel rather than issuing an unvalidated service call. Device control is never authorized by the panel model; HA retains final authority.

**Backlight policy:** never expose or control lamp backlight entities in the generated panel. No automated service call changes their physical power state.

## API

Authenticated WS request:
```json
{"id":1,"type":"stevora/panel/generate"}
```
Returns `panel_version=7.1.1`, installation ID, manifest revision, preferred language, dark theme ID, generated room sections and per-device cards. This endpoint is generated per user and must only receive the permission-projected manifest.

## Compatibility

- The panel is a STEVORA native custom panel, not an overwrite of an existing Lovelace dashboard.
- It does not depend on HACS or custom:button-card to render the generated layout.
- It retains the STEVORA v7.1.1 design principles (dark, room-centric, climate/lighting controls, BG/EN), but it is not yet a pixel-for-pixel reproduction of the historical Dunav YAML.
- A conflicting existing `/stevora` route is never overwritten.
- iOS and Android clients can continue using the existing manifest; a future client may also consume the generated panel model.

## Acceptance checks

1. Clean HA install with different room names and at least one light, climate, fan, sensor and lock.
2. Confirm dynamic room order and aliases, no Dunav-specific entity IDs, and info-only devices.
3. Rename/reassign an entity via Device Manager; refresh the panel and verify it moves without changing the HA registry.
4. Change a device profile to expanded and disable all controls; verify the panel respects both settings.
5. Log in as a restricted user and confirm hidden entities and unauthorized controls are absent.
6. Add a new room/entity, reload the panel, and verify automatic generation.
7. Restart HA; verify the profiles persist and the panel regenerates.
8. Verify that backlight entities never appear and no service is invoked for them.
9. Verify conflict behavior when another integration already owns `/stevora`.
10. Verify rollback by removing the STEVORA integration; other dashboards remain untouched.
