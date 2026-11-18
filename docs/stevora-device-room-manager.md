# STEVORA Device & Room Manager — server contract v1 (draft)
Status: approved architecture, implementation pending. Streams [STE-00] Core / [STE-05] Integrations.
No production HA configuration is changed by this document.

## Source of truth
- HA area registry determines rooms (area_id, display name); entity registry supplies entity_id, device_id, area_id, disabled/hidden status; effective area resolves entity area override, then device area.
- STEVORA overlay stores per-entity visibility and optional order/display overrides, keyed by stable HA registry identifiers where available; preserve settings through entity_id rename.
- Default visible: only supported controllable entities in authorized areas, excluding disabled, hidden and backlight entities. Sensor readings can be separately projected for informational cards; do not infer sensor ownership from arbitrary HA ordering.
- Explicit exclude always wins; never expose backlight controls. No remote user may override HA authorization.
- No area assignment: place in an explicit Unassigned group only if enabled in settings; otherwise omit. Empty HA areas may remain visible according to settings.

## Manifest API
Preserve the existing authenticated WebSocket command `stevora/manifest`. Extend compatibly:
```json
{
  "schema_version": 1,
  "installation_id": "stable-id",
  "revision": 1,
  "rooms": [{"id": "living_room", "name": "Living Room"}],
  "mappings": {"living_room": ["light.example"]},
  "capabilities": {"room_manager": true}
}
```
Note: the JSON above illustrates the contract, not the Dunav live manifest.
Keep schema field naming aligned with the existing deployed manifest; do not change casing without migration.
Server increments revision on area, entity, device, label or visibility changes and emits an authenticated `stevora/manifest_updated` event with revision. Clients refetch manifest and atomically replace their projection, retaining the previous snapshot until a valid response is available.

## Settings UI
Admin-only STEVORA Room & Device Manager:
- Room list derived from HA Areas; room membership follows HA changes automatically.
- Per-entity Include / Exclude / Default setting; room-level display order; read-only explanation for exclusions.
- Preview exact projected entities for current authorized account before applying.
- Settings persist in HA storage and are backed up with HA.
- Normal users cannot alter global visibility; the projection must also enforce their HA permissions.

## Client behavior
- iOS and Android: render rooms/mappings from manifest, not HA domain grouping when manifest is valid.
- HA states are only the source for current values and control service calls.
- Refresh on `stevora/manifest_updated`, reconnect and account switch. Keep offline controls disabled.
- When manifest unsupported, use explicitly labeled HA fallback mode; do not silently mix partial projections.
- If a manifest is valid but mappings are empty, show an empty STEVORA home, not all HA devices.

## Migration / rollout
1. Locate actual deployed `stevora/manifest` server handler and its persisted settings on Dunav; confirm source repository and schema.
2. Back up HA and existing manifest, export current room/entity mappings.
3. Implement manager behind feature flag, initially read-only preview; compare with current manifest and iOS/Android projections.
4. Test entity area overrides, device area inheritance, renamed IDs, no-area entities, disabled/hidden, backlights, multiple users, reconnect and offline states.
5. Enable server-side generation only after preview matches approved selections. Validate on iPhone and Android, then publish stable release.

## Acceptance
No regression of current working iOS build; HA remains operational when STEVORA is disabled; no accidental exposure of hidden or unauthorized entities. No production migration without backup and explicit approval.
