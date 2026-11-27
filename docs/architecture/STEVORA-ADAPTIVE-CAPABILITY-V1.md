# Adaptive Capability Manifest v1

Tracked in #33. This backend increment is based on Dev4 PR #32 (`a820dc1`). The contract retains the native OS as the source of truth. It runs in the Home Assistant adapter which is already bundled by Dev4.

## Baselines checked on 2026-11-27

| Platform | Active baseline | Verified GitHub evidence |
| --- | --- | --- |
| Native Dev4 | `codex/dev4-device-controls-signed-releases`, [PR #32](https://github.com/stefan1318/stevora-home-assistant-apps/pull/32) | Source and regression checks passed. [46004259001](https://github.com/stefan1318/stevora-home-assistant-apps/actions/runs/46004259001) QCOW2 job was running at audit time. [45854608303](https://github.com/stefan1318/stevora-home-assistant-apps/actions/runs/45854608303) is an earlier successful UTM baseline. |
| Raspberry Pi 4 | `feature/stevora-os-native-dev4-rpi4-image-20261125`, [PR #30](https://github.com/stefan1318/stevora-home-assistant-apps/pull/30) | [45497339374](https://github.com/stefan1318/stevora-home-assistant-apps/actions/runs/45497339374) produced an image. Hardware acceptance is separate. [PR #31](https://github.com/stefan1318/stevora-home-assistant-apps/pull/31) is runner routing. |
| Android | `feature/stevora-os-dev4-android-sync` at `553c22d` | [45361495870](https://github.com/stefan1318/Ha_android/actions/runs/45361495870) succeeded. Manager and policy PRs remain open. |
| iOS | `feature/stevora-os-dev4-ios-sync` and `ci/stevora-ios-current-ipa-20261125` | [45698394334](https://github.com/stefan1318/HA_iOS/actions/runs/45698394334) produced the Dev4 candidate at `8d738da`. [PR #7](https://github.com/stefan1318/HA_iOS/pull/7) has a successful IPA job and a failing lint check. |

[Planning draft PR #34](https://github.com/stefan1318/stevora-home-assistant-apps/pull/34) specifies the full acceptance matrix. Historical clients and Dev4 continue using the existing `stevora/manifest` and `stevora/os/v1/manifest` commands.

## WebSocket commands

All commands run on the existing authenticated Home Assistant WebSocket. Request `stevora/os/v1/capabilities` with optional integer `schema_version: 1` and `language: "bg" | "en"`. Unsupported versions return `unsupported_version`. Clients should fall back to their existing protocol if the command or schema is unsupported.

The snapshot includes `installation_id`, `schema_version`, `revision`, `language`, `rooms`, `devices`, `systems` and `capabilities`. Use IDs scoped to the current installation. Clear the snapshot on logout or server change. Each capability is an entity adapter with localized names, logical device and room references, classification evidence, availability, declared state/measurement keys and executable action descriptors. It carries no raw HA attribute object. Subscribe to HA's existing user-scoped state feed for live values. Treat missing/unknown/unavailable capabilities as visible offline entries with disabled controls. Render no category without a system. A system can reference several devices and a device can belong to several systems.

`stevora/os/v1/capabilities/subscribe` takes the same options and emits scoped revision changes. Subscribe before fetching the snapshot and refetch after invalidation or reconnect. Registry, service and significant state metadata changes are coalesced for 250 ms. An ordinary telemetry tick does not trigger a catalog update.

`stevora/os/v1/capabilities/action` takes `capability_id`, `action_id`, optional `parameters` and optional `confirmed`. Use the advertised parameter names and types. The gateway recomputes discovery and permissions, validates the values and invokes only the selected entity service under the user's HA context. Confirmation is required for supported switch, cover and climate actions. HA service validation and device safeguards still apply. A result means HA accepted the call. Device state remains the source of truth for whether it took effect.

`stevora/os/v1/capabilities/override` is administrator-only. It takes `device_id` and optional `category` and `group`. Give several devices the same category and group slug to combine them. Omitting both resets the device override. Overrides are scoped to the installation and use the existing Admin Managers store. Existing names, icons, visibility, room filters and profile restrictions still apply. A category cannot grant control. Backlights stay excluded. Registered entities keep their capability IDs on rename. Unregistered, state-only entities use their HA entity IDs.

## Remaining acceptance

The first backend increment exposes typed domain/class categories, physical-device grouping, administrator classification and an inventory fallback across domains. Action coverage is limited to the currently mapped light, switch, fan, climate, cover and media services. Other operations remain read-only in this contract until they have explicit support/parameter evidence and safety policy. Heat pump and irrigation groupings can be confirmed by an administrator and are not inferred from names or brands. Camera streaming, alarms, valve control, electrical protection, full range/color controls and advanced energy topology require further integration and scenario tests. The OS and native apps have yet to consume this contract. Validate on an isolated HA installation before independently built OS and mobile candidates are approved. Clients can roll back to their existing APIs without removing persisted overrides.
