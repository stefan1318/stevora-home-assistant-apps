# STEVORA Device Customization — cross-platform test candidate

Status: implemented in feature branches; NOT certified on an independent Home Assistant installation.

## Admin API
- `stevora/admin/rooms/get`: returns `revision`, `device_profiles`, entity inventory, room names, visibility.
- `stevora/admin/devices/update`: admin-only WebSocket command, payload:
  `{"type":"stevora/admin/devices/update","expected_revision":3,"profiles":{"light.example":{"name":"Main light","icon":"mdi:lightbulb","layout":"compact","area_id":null,"controls":["toggle","brightness"],"user_ids":[]}}}`
- Set a profile value to `null` to remove that customization. Updates are validated against the live HA entity registry, room IDs, active HA user IDs, allowed layouts and domain-level controls. Revision conflicts reject stale writes.
- Profiles are persisted in the STEVORA storage namespace and included in the manifest. They do NOT rename or move original HA entities or change HA permission policy.
- `user_ids: []` means no extra STEVORA audience restriction. When populated, the projected manifest hides that entity from other non-admin users, in addition to normal HA read permissions. HA service calls remain protected by HA authorization.
- `controls` is a presentation preference, not a grant of HA capabilities. The UI must check current HA supported features before offering a control; the server validates the domain allowlist.
- Backlight controls are prohibited. STEVORA does not modify the actual physical backlight state.

## Platform UI
- Home Panel: device profile editor for name, MDI icon ID, layout, room override, controls and user IDs.
- iOS: native per-entity editor in Managers.
- Android: native per-entity editor in Managers.
- UI polish, control widgets for every supported service, and real independent-server behavior require acceptance tests before release.

## Acceptance
1. Install on a clean, independent HA with at least light, climate, fan, sensor and two users.
2. Rename a light and move its STEVORA room. Confirm HA registry remains unchanged.
3. Change layout and icon, save and restart HA. Confirm profile persists and manifest revision changes.
4. Limit a light to one user and confirm another non-admin user cannot see it; HA permission checks must still apply.
5. Attempt forbidden backlight and sensor toggle profiles. Expect `invalid_profile`.
6. Simultaneously update a profile using a stale revision. Expect `conflict`.
7. Verify the UI reflects the profile in Home Panel, iOS and Android after refresh.
8. Confirm no action toggles backlight entities and existing Dunav exclusions remain intact.
