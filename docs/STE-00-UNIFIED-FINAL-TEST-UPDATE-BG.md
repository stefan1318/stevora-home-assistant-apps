# STEVORA Unified Final Test Update — independent HA only

**Release gate:** do not deploy to production Dunav. Deploy to independent HA only after the branch's latest integration and admin-manager CI checks pass and the Android/iOS builds are confirmed. This is a release candidate, not a production release.

## Backup and update

1. On the independent HA installation, create a full HA backup (Settings > System > Backups).
2. Verify `/config/custom_components/stevora/manifest.json` exists. If absent, use the initial installation guide instead.
3. Copy the existing integration folder to `/config/stevora-backup-YYYYMMDD-HHMMSS`.
4. Download the tested commit's ZIP from `https://codeload.github.com/stefan1318/stevora-home-assistant-apps/zip/<TESTED_SHA>` (substitute the successful CI head SHA, not an older commit).
5. Extract `custom_components/stevora/` from that archive into the same directory under `/config`. Preserve the existing HA `.storage` and other unrelated integrations.
6. Restart HA; confirm the STEVORA integration is loaded and Home Panel enabled.
7. Open `/stevora`. Toggle BG/EN and verify room and device names update without changing HA registry names.
8. Use the admin manager to enter explicit BG/EN names for a custom room and device, save, switch languages, restart, and verify persistence.
9. Test Android and iOS using the matching successful build artifacts. Each client should request its own language-specific `stevora/manifest`; the backend is authoritative for bilingual labels.
10. Do not merge/release until all acceptance checklists pass.

## Acceptance — HA Integration
- [ ] Integration loads without errors
- [ ] All expected HA areas and supported entities discovered
- [ ] Existing intentional exclusions remain excluded
- [ ] Device profiles, room overrides and aliases persist
- [ ] BG/EN dictionary translates known names in both directions
- [ ] Unknown/proper names remain unchanged
- [ ] Explicit BG and EN labels override automatic translation
- [ ] Translation edits enforce admin permission and revision conflict
- [ ] Restricted users see only permitted devices

## Acceptance — Home Panel v7.1.1
- [ ] `/stevora` generates rooms for the independent installation
- [ ] BG/EN selector refreshes translated room and device labels
- [ ] Saved custom BG/EN labels appear in both modes
- [ ] Device layout, icon and controls match saved profile
- [ ] No backlight control is exposed
- [ ] New HA entity appears on refresh
- [ ] Panel survives HA restart

## Acceptance — Android
- [ ] Matching APK builds and installs
- [ ] Independent HA OAuth sign-in succeeds
- [ ] Room labels match Android language
- [ ] Device labels use translated manifest names
- [ ] Native admin manager saves BG/EN room/device labels
- [ ] Switching language refreshes labels (not only menu strings)
- [ ] Device visibility and controls respect HA permissions

## Acceptance — iOS
- [ ] Matching IPA builds and is signed for physical-device installation
- [ ] Independent HA OAuth sign-in succeeds
- [ ] Room labels match selected iOS app language
- [ ] Device labels use translated manifest names
- [ ] Native admin manager saves BG/EN room/device labels
- [ ] Switching language refreshes labels (not only menu strings)
- [ ] Device visibility and controls respect HA permissions

## Acceptance — Hey Stevora
- [ ] Configured HA Assist pipeline resolves per user
- [ ] BG/EN voice commands refer to the correct HA entities
- [ ] Voice does not bypass HA permissions
- [ ] Backlight controls remain unavailable

**Limitations:** Dictionary translation is deliberately conservative. Unknown names require explicit BG/EN overrides; no cloud translation API is invoked. Native mobile label rendering and immediate language switching must be verified on real devices before declaring release-ready.
