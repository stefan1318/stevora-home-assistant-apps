# STEVORA Ecosystem — unified pre-release candidate

Status: **integration candidate / NOT RELEASED**. This file coordinates
Android, iOS, Home Hub/Panel, and Hey Stevora. No product is considered
ready merely because a GitHub commit or CI job exists.

## Product source of truth

| Product | Repository | Product branch | Mandatory artifact |
| --- | --- | --- | --- |
| Android | stefan1318/Ha_android | feature/stevora-companion | com.stevora.companion APK |
| iOS | stefan1318/HA_iOS | feature/stevora-ios | com.stevora.* IPA |
| Home Hub / Panel | stefan1318/stevora-home-assistant-apps | feature/stevora-universal-discovery-v1 | installable HA app/integration + authenticated manifest |
| Hey Stevora | Android/iOS + HA voice integration | product branches | actual mic capture, wake word and permission tests |

## Contract

- WebSocket command: `stevora/manifest` over the **existing authenticated**
  Home Assistant session; no parallel token store.
- Supported `schema_version`: `1.0`.
- Manifest fields: `installation_id`, `revision`, `preferred_language`,
  `rooms: [{id,name}]`, `mappings: {room_id: [entity_id]}`.
- The manifest is **read-only discovery data**, not authority to execute actions.
  Every device action must use current HA state, supported services, and permissions.
- Unsupported/absent manifest falls back to native HA discovery.
- Never upload home entity lists, credentials, tokens, or coordinates to CI logs.
- Do not hardcode one user's entity IDs, voice samples, or location.
- Home Panel must not reintroduce backlight controls.

## Hard release blockers

1. Register `stevora/manifest` on Home Assistant's authenticated WebSocket
   API with per-user entity filtering. The current Python builder alone
   does **not** register this command.
2. Bind manifest projections to **actual native screens and service actions**
   in Android and iOS, including capability checks and live state.
3. iOS: isolate manifest state by server/session, clear it on logout/server
   switch, verify every app/extension bundle identity and display name.
4. Android: prove full-debug build and tests pass; verify APK metadata.
5. iOS: prove device build and identity checks pass; verify IPA packaging
   and installation with the intended signing mechanism.
6. Verify Hub/Panel installer on a clean HA installation and rollback.
7. Run three independent-home scenarios (two with STEVORA, one without)
   and security/offline/permissions/upgrade tests.
8. Hey Stevora: validate real microphone recording, user enrollment,
   recognition and wake word on both mobile platforms.

## Acceptance decision

Mark **test-ready** only when blockers 1–6 are closed and CI artifacts are
verified. Mark **release-ready** only after 7–8 pass on physical devices.
Maintain separate outcomes for compiled, installed, connected, controls
working, and released. Never label upstream HA artifacts as STEVORA.
