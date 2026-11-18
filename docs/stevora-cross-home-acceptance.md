# STEVORA cross-home product acceptance tests (STE-00/05)

Status: **test specification only** — not implemented or passed.

## Mandatory test environments

- **Home A:** STEVORA Hub/Panel installed, climate + RGB + lights, at least two users.
- **Home B:** independent Home Assistant installation, different entity IDs, areas,
  device mix and user accounts, with STEVORA Hub/Panel installed.
- **Home C:** stock Home Assistant without STEVORA; confirm safe fallback.

Never copy entity IDs, access tokens, person identifiers or location history
between installations.

## Required end-to-end scenarios

| ID | Scenario | Acceptance condition |
| --- | --- | --- |
| STE-05-01 | OAuth login on Home A | App authenticates against the chosen server only |
| STE-05-02 | Discover STEVORA manifest | Authenticated manifest is retrieved and schema-validated |
| STE-05-03 | Dynamic devices and rooms | UI renders Home A entities without hardcoded entity IDs |
| STE-05-04 | Switch to Home B | All Home A entity mappings and cached sensitive data are isolated |
| STE-05-05 | Home B discovery | New areas, climate and RGB capabilities appear without rebuilding apps |
| STE-05-06 | Home C fallback | Standard HA discovery works without STEVORA manifest |
| STE-05-07 | Unknown manifest version | App rejects unsupported schema safely and offers HA fallback |
| STE-05-08 | Revoked token | Session is invalidated; no stale privileged device actions |
| STE-05-09 | Offline/reconnect | State recovers after connectivity restoration, without phantom controls |
| STE-05-10 | Permissions | Admin-only configuration is not exposed to ordinary users |
| STE-05-11 | Presence | Native mobile-app person/device_tracker works with consent; no iCloud requirement |
| STE-05-12 | Upgrade | Existing signed beta updates in place, retaining server configuration |
| STE-05-13 | STEVORA branding | Launcher, splash, navigation, bundle/package identity verified on device |
| STE-05-14 | Voice | Microphone permission, real recordings, Hey Stevora and fallback verified |

## Release rules

1. Android tests run from `feature/stevora-companion`, not manifest-sync.
2. iOS tests run from `feature/stevora-ios`, not manifest-sync.
3. Manifest-sync adapters are not a completed feature until wired into the
   active authenticated connection and validated on Home A/B/C.
4. A successful upstream Home Assistant build does not satisfy any STEVORA
   product acceptance test.
5. Do not publish a product APK/IPA before identity checks and device tests pass.
