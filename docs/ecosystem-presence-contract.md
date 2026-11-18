# STEVORA Ecosystem — Native Presence contract v1 (proposal)

**Scope:** STEVORA Home Hub, Home Panel, Android, iOS, Hey Stevora.
**Status:** Proposed contract implementation; user approved replacing the experimental iCloud path with the native Home Assistant Companion location capability (2026-11-18). Not a production release.

## Single source of truth

- Each mobile application authenticates to **the user's own Home Assistant instance** using native Home Assistant auth/OAuth and the standard Mobile App integration.
- iOS and Android report location using their existing native OS permission flows and Home Assistant Mobile App APIs; the HA backend owns `device_tracker` and `person` entities.
- Each account's device tracker is associated with the correct HA Person in the user's home, using an admin-approved connection. Wall tablets and shared `panels`-style accounts are not treated as individual persons.
- Home Panel and Hey Stevora **read native HA Person / device_tracker data** and do not create another GPS tracking service or duplicate Apple iCloud passwords.
- `unknown`, `unavailable`, stale GPS, revoked permissions and unreachable mobiles require explicit uncertain state and must never be interpreted as reliable `not_home` without validating the source and freshness.

## Privacy, permissions and consent

- Explicit opt-in for sharing device location, with clear opt-out and permission-state status. Require platform-appropriate foreground/background location authorizations.
- Do not put GPS coordinates, Apple credentials, OAuth refresh tokens, or HA long-lived tokens in frontend JavaScript, public GitHub, analytics events or logs.
- Read/write privilege must be enforced by Home Assistant backend permissions; hiding UI controls does not secure APIs.
- A nonadmin user may see their own location/presence only when a trustworthy backend user ↔ Person link exists. No global roster or coordinates by default. Administrators can manage associations with appropriate audit.
- Keep geolocation data local to each Home Assistant instance unless a user explicitly configures a separate trusted service.
- Disable custom iCloud/Find My connector in new builds; if previously installed, disconnect and revoke sessions **before** uninstalling. Do not delete data automatically.

## Compatibility across products

- Multiple homes and users must be isolated; no hardcoded entity IDs, rooms, IP addresses, ports, or instance-specific defaults.
- Capability-based discovery and user-editable mappings are mandatory for an eventual market-ready release.
- UI/control/voice contracts use the same HA entity and service semantics, feature flags, BG/EN strings and versioned migrations.
- Physical backlight channels designated permanently-on are exempt from automation/device control. Frontend safeguards alone are insufficient; confirm via backend tool exposure and scene audit.
- Preserve each mobile app's package identity, signing, account session, and local settings across updates; never require uninstall when upgrading.
- Test on a fresh HA instance, different devices, nonadmin user, wall panel and iOS/Android apps before releasing.

## Presence API mapping

Use native HA entity states, not a custom GPS API. `Person` is the preferred home/zone status. `device_tracker` provides source metadata where authorized. Do not infer device ownership from entity name alone. Account-to-person linking requires a verified server-side identity association. No custom REST service is required for the read-only compatibility view.

## Implementation status (2026-11-18)

- Confirmed in HA Dunav: HA Mobile App integrations and native Person/device_tracker entities exist.
- Confirmed in GitHub: iOS/Android forks contain Home Assistant's native location tracking code.
- Local, uninstalled compatibility ZIP for Home Panel v7.1.1 prepared separately.
- Not yet verified: end-to-end geo updates from signed STEVORA production app builds; permission and freshness enforcement across all clients; server-side multi-home access policy.
