# [STE-00] STEVORA OS 1.0 — Full Frontend Edition

**Product policy override — 2026-11-20:** [STEVORA_ECOSYSTEM_POLICY.md](../STEVORA_ECOSYSTEM_POLICY.md) is canonical. Home Panel/Hub/Core/Manifest/Universal Integration/Frontend/People & Presence are **internally integrated STEVORA OS subsystems**, not independent installable products. Android and iOS are OS clients; Hey Stevora is an embedded capability; Memory is a private owner-only optional OS extension. The earlier separate-module wording below refers solely to technical implementation and migration, not the product model.

**Status:** Architecture approved in principle; implementation **GATED** pending real independent HA OS VM acceptance of STEVORA OS Developer Preview 0.2.0. This file is a build contract, not a claim of full implementation. No merge to `main`, no changes to Dunav.

## Goal

Replace Home Assistant's *everyday user experience* with the STEVORA OS branded experience on Raspberry Pi 4/5 and x86-64 HA OS VM, preserving official Home Assistant OS, Core, Supervisor, firmware/image updates, maintenance, recovery, integrations and permissions. Users should normally never need to open the stock Home Assistant dashboard.

**Explicit technical boundary:** We are not removing or patching the HA frontend distribution from Home Assistant Core. HA frontend and HA authorization remain installed and available as recovery/compatibility surfaces. STEVORA is the *primary* frontend with its own navigation, layouts, styling, labels, device controls and administrative views. Home Assistant Core and Supervisor are the backend; HA OS is the underlying host, not the sole backend.

## Release gate: 0.2.0

Existing known status:
- 0.1.0: operator reports 6/6 basic independent Windows VM checks passed.
- 0.2.0: CI success for `bec8279fe26c4bbb597d0cadd61b3a0fd3d751fc`; **real VM acceptance not yet reported**.

Proceed with full feature implementation after operator confirms 0.2.0 passes, including:
- HA restarts, `/stevora-os` and `/stevora` continue to work.
- Accurate non-hardcoded System Center data and update states.
- Admin/non-admin endpoint and frontend separation.
- BG/EN and responsive Windows/iPhone/Android.
- No unintended device/update/backup operations.
- Snapshot/backup path available for rollback.

Do not interpret CI passing as equivalent to this gate.

## System layout

1. **Official HA OS:** Original HA OS x86-64 for Windows VM, official ARM64 images for Raspberry Pi 4/5; official A/B update mechanism intact.
2. **Official HA Supervisor:** Runs Core, manages add-ons/apps, storage, backup/restore and system updates. No direct Supervisor token exposure to frontend; use supported authenticated HA Core paths.
3. **Official HA Core:** Devices, state machine, service registry, automations, discovery, configuration entities, access control, websocket API, long-lived integration persistence.
4. **STEVORA backend layer:** `stevora` Universal Integration, Home Hub, manifest and permission projection; secure additional APIs for capabilities not available via safe native HA interfaces; use HA permission checks and administrator-only handlers for operations requiring admin.
5. **STEVORA OS frontend:** Standalone namespaced `/stevora-os` shell with BG/EN language models, multi-room views and system administration. No hardcoded Dunav identifiers; no device/backlight actions contrary to project policy.
6. **STEVORA clients:** Web/PWA/iOS/Android consume the same backend contract; each native mobile app retains its own release cycle; do not imply they are bundled with OS.
7. **Emergency fallback:** Known stock HA URLs, functional stock login and recovery, and VM snapshot/backup paths retained; a broken STEVORA page must not prevent admin recovery.

The full STEVORA home landing can be the user's bookmark/PWA start URL. Avoid route rewrites of `/`, `/auth`, `/api`, `/config` or WebSocket endpoints. Proxy routing may be considered only after separate tested isolation and fallback.

## Full frontend scope — functional parity matrix

| Section | Required user-facing functionality | Backend/authority |
|---|---|---|
| Home | Premium overview, rooms, online status, quick scene/status tiles | scoped STEVORA manifest + HA websocket |
| Rooms & Devices | Full grouping, device search, assigned room, rename, BG/EN labels, capability-aware controls | STEVORA admin managers + HA entities/services |
| Climate | Room climate center, ±1-degree control only when supported, HVAC/fan/swing/preset; info-only status summary on Home | HA climate services + feature validation |
| Lighting/RGB | Whole-device on/off, brightness, color/effects only when genuinely supported; no backlight management | HA light/switch service capabilities + STEVORA exclusion policy |
| Scenes/Automations | list, inspect, run allowed scenes; create/edit flows only via supported/validated backend actions | HA scenes/automations and permissions |
| AI/Voice | Assist, conversation UX and separately integrated Hey Stevora where actually deployed | HA conversation + approved STEVORA voice backend |
| Users/Security | HA native login, permissions, permission-specific views, own user preferences, sessions | HA auth & policies; admin-only changes |
| Integrations | list installed integrations and add-on/app availability; setup flows only via supported HA APIs | HA Config Entries and Supervisor-mediated features |
| System Center | Core, Supervisor, OS versions, real health signals, logs/repair indicators where supported | authenticated HA and admin-only endpoints |
| Updates | accurate states, explicit confirmation, backup before updates, failure/rollback information | native official HA update paths; staged safety tests |
| Backup & Restore | inventory and safe guided backup; restore is high-risk with explicit confirmation and fallback | supported HA backup/restore paths, administrative auth |
| Network/Storage/Hardware | Wi-Fi/Ethernet/hostname/disk telemetry and settings, hardware guards | native HA/Supervisor capabilities as available |
| Onboarding | first-run STEVORA setup, language, room preferences, devices, accounts, optional integrations, desktop/mobile pairing | after native HA identity/security initialization |
| Notifications | offline/online, system alerts and updates; push only when explicitly connected | HA events, Home Hub, separately connected mobile push |
| About/Legal | STEVORA branding, versioning, HA attribution and source/license information | static metadata |

The above table defines **target scope**. All entries require implementation and independent tests; a linked stock HA settings page is a *fallback*, not equivalent to finished STEVORA functionality.

## Product modules and visual UX

- Shared design system for desktop/tablet/mobile, with responsive layouts, 44px+ touch targets, clear focus, accessible contrast, reduced-motion, no modal traps.
- Consistent STEVORA branding; use existing user-supplied official icon and logo assets where rights and repository handling are verified. Avoid generated stand-in logos.
- No distracting duplicate controls; a concise home climate summary, detailed climate in Climate Center.
- BG/EN for all STEVORA labels, room/entity aliases, system errors, onboarding flows and troubleshooting. Do not automatically overwrite native HA entity names in registries.
- Page navigation and edits must not be torn down on ordinary HA state ticks. Efficient diff/targeted state update.
- Render only server-scoped entity data. Never copy hidden/disabled/backlight entities or another installation's status into the current session.
- Stable installations and future new installations use the same schema and onboarding contract; preserve Home Hub/Universal Integration compatibility.
- Never falsely report absent modules as active (Hey Stevora, Memory sync, external AI, push).

## Security rules

- HA authentication remains authoritative. Browser/frontend does not create its own unaudited superuser authentication.
- Admin-only WebSocket endpoints must enforce `@websocket_api.require_admin` or equivalent **server-side** checks; not simply hide a UI button.
- Per-user read/control capabilities enforced in backend and rechecked against current entity capabilities at action time.
- No passwords, HA refresh/access tokens, Supervisor API tokens, private addresses, or home-specific identifiers committed to GitHub. No tokens in localStorage.
- Avoid direct browser-to-Supervisor calls and undocumented internals.
- Create/update/restart/backup operations only after explicit UI confirmation, HA-native permission checks and audit logs; dry-run where feasible.
- Backlight devices are excluded from control per STEVORA project rule.
- Cross-home/HA-user session changes clear all cached manifests, diagnostics, view models and outstanding requests before new data renders.
- Validate all user-controlled strings and escape HTML; tests include hostile name/alias payloads.
- Admin/system restart or update requests require real VM integration tests and a rollback procedure before user exposure.

## Delivery sequence — one major 1.0 program, not a collection of standalone mini-releases

**Gate A: 0.2.0 accepted on independent Windows VM.**

1. **Core / shell integration:** consolidate `stevora` + `stevora_os` APIs under one versioned contract while keeping distinct installable modules; full navigation, dynamic list of modules, stable BG/EN, verified assets.
2. **User-facing parity:** Home, Rooms, Devices, Lighting, Climate, scenes/automations, dashboard customization, search, roles and state live-patching.
3. **Administration parity:** System Center, integrations, modules, onboarding wizard, system settings, guided updates/backup/restore, diagnostics and recovery. Unimplemented functionality clearly says unavailable, never fakes status. Gate high-risk operations behind verified HA capabilities.
4. **Client convergence:** same UI and capabilities in desktop, iOS, Android; test existing native apps separately; own voice availability and permissions.
5. **Full integration test candidate:** unified ZIP/install/update/rollback, complete CI, browser test matrix, multi-home sessions, offline behavior, reboot/update resilience.
6. **ARM validation:** Raspberry Pi 4 & 5 64-bit HA OS hardware, SSD/NVMe differences, memory/power, Bluetooth/Zigbee compatibility, boot/restore.
7. **1.0 release decision:** explicit operator acceptance only after field tests and tested rollback. No implicit merge into Dunav.

## Mandatory acceptance checks

- [ ] Original HA OS, Core, Supervisor install/update flows remain official and unmodified.
- [ ] STEVORA is primary daily frontend; stock HA GUI can be accessed by an administrator for recovery.
- [ ] All user-facing areas above are implemented; any unsupported operation is visibly unsupported.
- [ ] No hardcoded user/home-specific IDs; new installations auto-adapt.
- [ ] Room/alias translations and device actions respect runtime native HA capabilities.
- [ ] HA backlight control exclusion stays enforced even under manual overrides.
- [ ] Standard permissions, non-admin sessions and cross-home switching are independently checked.
- [ ] Successful test on Windows VM with existing home; fresh independent VM onboarding test.
- [ ] iPhone/Android/tablet responsive and functional, including manifest refresh and offline/network changes.
- [ ] Component update, rollback, HA backup and restore are tested in VM; no bricked frontend.
- [ ] Core and Supervisor update scenarios are accepted against supported versions.
- [ ] Raspberry Pi 4/5 ARM64 validation completed before claiming hardware readiness.

**Consequence:** A green 0.2.0 test authorizes beginning the complete build; it does **not** make the full UI an immediate safe replacement or mean all HA settings APIs are already supported.
