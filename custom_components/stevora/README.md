# STEVORA Ecosystem — Universal Integration 0.3.0-beta.5

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
`0.3.0-beta.5` and the Home Hub module's `active` status.

**Do not install legacy `stevora_manifest` together with `stevora`**:
both register the same WebSocket route. Do not modify existing memory
bridge, voice assistants, BLE integrations or scenes during migration.

## Beta.5 Stability & Lighting placement

- A device manually categorized as `lighting` is now included in the virtual
  Unassigned room when it has no HA area and there is no active room filter.
  Existing room filters, HA disabled/hidden entities, STEVORA explicit excludes
  and forbidden backlights are **never overridden**.
- `stevora/admin/devices/update` verifies the *post-save manifest* and returns
  per-device `included`, `reason`, `area_id`, `display_category` and
  `in_lighting`. The manager displays placement confirmation or an actionable
  exclusion reason instead of silently reporting success.
- Routine HA `hass` state updates only patch the displayed values in place.
  Full Shadow DOM rerender is never triggered by sensor state keys or changes
  of feature attributes on ordinary HA ticks.
- Real HA entity/device/area registry update events can trigger a coalesced
  silent manifest refresh; if the projected manifest revision has not changed,
  no full repaint is performed. Manual Refresh remains available.
- No changes to HA services, user permission model, existing icon/profile
  persistence, Home Hub or Hey Stevora modules.

Acceptance and rollback:
[STEVORA beta.5 checklist](../../docs/STE-01-STABILITY-CLASSIFICATION-BETA5-ACCEPTANCE-BG.md).

## Beta.4 capability-aware visual UI corrections

- `display_category` is a presentation-only profile choice. A switch can
  be shown as Lighting while still using its native HA service domain and
  never acquiring fake RGB/brightness abilities.
- Device profiles, manifest and generated panel expose HA-supported controls
  based on supported_features, supported_color_modes and capability lists;
  the service boundary rechecks the permission-scoped model and live flags.
- Compact, Expanded and Info layouts are visibly and functionally distinct.
- HA state ticks now patch live values without rebuilding the Shadow DOM
  or collapsing focus/scroll.
- The new Climate Center respects user/room-scoped temperature and humidity,
  target temperature, HVAC modes and 1-degree controls, using a premium ring
  layout inspired by the available Dunav climate hierarchy.
- The native asset module + CSS revision are cache-busted for this release.

Field acceptance is required:
[STE-01-HOME-PANEL-7.1.1-CAPABILITY-UX-BETA4-BG.md](../../docs/STE-01-HOME-PANEL-7.1.1-CAPABILITY-UX-BETA4-BG.md).

## Beta.3 Native Premium UI major update

The premium Home Panel includes a stable, user-oriented device editor:
HA state updates no longer close open manager lists; an icon gallery and
friendly controls/layout selection replace typed identifiers. Device cards
use HA MDI icons, visible states, climate/RGB/fan/cover/media controls with
full service authorization and native More Info dialogs when allowed.

**Home Assistant Assist text chat** now works through the authenticated
`conversation/process` WebSocket without Hey Stevora. A configured HA
Conversation agent is required; the UI does not install a standalone voice
engine. Chat history is volatile and erased on HA session/user switch.

Safety: view-only devices and backlights never offer actuator controls in
STEVORA. The Hub, BG/EN localization, independent-installation projection,
and administrator managers remain in the same package.

See [native UI acceptance and rollback plan](../../docs/STE-01-HOME-PANEL-7.1.1-NATIVE-UX-BETA3-BG.md).

## Beta.2 UI hotfix

When a user is already on Home Hub, the primary card now shows
**Refresh Hub data** instead of the non-functional **Open Home Hub** link.
The button invokes the authenticated manifest/Hub API refresh, shows a
refresh-in-progress state, and displays **Last updated** after successful
synchronization. In System it still navigates to the Home Hub view.

## Outstanding release gates

GitHub CI uses Python/JS unit tests with Home Assistant stubs; it does
**not** validate compatibility with the real HA Core runtime. Actual
HA acceptance must test scene permissions, event bus, module on/off,
config persistence, independent homes, mobile clients and reliable
backup/restore. Require explicit owner acceptance before any production
merge or Dunav installation.
