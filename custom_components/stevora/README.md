# STEVORA Ecosystem — Universal Integration 0.3.0-beta.1

**Status:** Home Hub major test candidate for an independent Home Assistant installation.
**NOT production approved, NOT deployed to Home Assistant Dunav.**
Built on Home Panel 7.1.1 Premium and the earlier integration 0.2.0-rc.2.

## Bundled modules

- **STEVORA Core:** authenticated per-installation discovery, room/device mapping,
  user-scoped manifest projections, BG/EN localization and administrator customization.
- **STEVORA Home Panel 7.1.1 Premium:** dynamic dark responsive panel at `/stevora`,
  Rooms, Climate, Lighting/RGB, Devices, Scenes, Insights, AI, System,
  Home Hub, Memory and Settings. All device actions pass through native HA.
- **STEVORA Home Hub 1.0.0-beta.1:** optional (enabled by default) local
  event coordinator. Listens to `state_changed`, keeps a bounded 250-item
  volatile event journal, reports local unavailable/recovered alerts, provides
  system metrics and permission-filtered scene/automation directory and
  persists administrator preferences per config entry.

`Hey Stevora`, `Memory & Sync`, standalone `Home Hub add-on`, remote
module installer, and mobile APK/IPA are **not included** in this package.
No separate cloud service, push gateway, autonomous scene runner or AI engine
is installed. They must never be reported as bundled or active.

## Hub WebSocket contract

All commands require an authenticated HA WebSocket connection:

| Command | Access | Purpose |
| --- | --- | --- |
| `stevora/hub/status` | authenticated user | Installation ID, running module status and user's visible entity counts |
| `stevora/hub/events` | authenticated user | Bounded, scoped recent event list and local alerts |
| `stevora/hub/scenes` | authenticated user | Read-permission scoped scenes/scripts/automations; HA control permission marked for scene affordances |
| `stevora/hub/config/get` | administrator | Read persisted local Hub preferences and revision |
| `stevora/hub/config/update` | administrator | Compare-and-swap revision update of Hub preferences |

No Hub API performs privileged HA entity service actions. The Panel
uses the authenticated native `hass.callService` for allowed scenes.
`home_hub_enabled` is available in HA config/options; a disabled
Hub is **disabled**, not `not_included`.

## Local persistence and privacy

Hub options use HA `Store` at `.storage/stevora.home_hub.<entry_id>`.
Events are memory-only and cleared at unload/restart. Only entity IDs,
previous-to-new state classification, new state, timestamp and event
kind are retained; no tokens, device attributes, API credentials or HA
user information are serialized to the event journal. Events and entity
counts are filtered per invoking user's HA read permissions AND
STEVORA's manifest visibility policy.

## Acceptance and installation

Read the mandatory Bulgarian test plan:
[STE-00-05-HOME-HUB-0.3-BETA-ACCEPTANCE-BG.md](../../docs/STE-00-05-HOME-HUB-0.3-BETA-ACCEPTANCE-BG.md).

Use the pinned ZIP produced by an **entirely successful** GitHub Actions
run of `feature/stevora-home-hub-v1-20261119`; verify
`SHA256SUMS.txt`. Install `custom_components/stevora/` on a separate
test Home Assistant. Always take a full backup and a copy of the old
integration directory before replacing files. Restart HA and verify
`0.3.0-beta.1` and the Home Hub module's `active` status.

**Do not install legacy `stevora_manifest` together with `stevora`**:
both register the same WebSocket route. Do not modify existing memory
bridge, voice assistants, BLE integrations or scenes during migration.

## Outstanding release gates

GitHub CI uses Python/JS unit tests with Home Assistant stubs; it does
**not** validate compatibility with the real HA Core runtime. Actual
HA acceptance must test scene permissions, event bus, module on/off,
config persistence, independent homes, mobile clients and reliable
backup/restore. Require explicit owner acceptance before any production
merge or Dunav installation.
