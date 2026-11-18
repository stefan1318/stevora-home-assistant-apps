# STEVORA Home Assistant Integration — 0.1.0 experimental

This is an early test build, **not a complete Home Panel installer**.

## Manual isolated test installation
1. Back up Home Assistant configuration and do not overwrite any existing `custom_components/stevora` installation.
2. Copy `custom_components/stevora` from this feature branch into `<HA config>/custom_components/stevora`.
3. Restart Home Assistant and open Settings → Devices & services → Add integration → STEVORA Ecosystem.
4. Select Bulgarian or English. Reopen the integration's Configure menu to change language.
5. For an **administrator** account only, open Home Assistant Developer Tools → Events/Actions or an authenticated WebSocket client and send `{"id":1,"type":"stevora/manifest"}` to the HA WebSocket API. This requires an authenticated connection; sending JSON to the HTTP URL is not sufficient.
6. Confirm rooms and entities. Do not test on a production instance until the custom integration loads cleanly and can be unloaded.

## What works in source
- Config flow and options flow
- BG/EN translations
- Read-only registry discovery for common device domains
- Administrator-only authenticated WebSocket manifest request
- No automatic device actions

## Not yet included
- Frontend Home Panel, `/stevora` panel registration, setup wizard, mapping editor
- Per-user filtered manifest, OAuth implementation in mobile apps
- Cross-product configuration sync, Hey Stevora integration
- Real HA integration tests, installation validation, release artifacts

This code must not be merged as a stable release without passing the required test gates.
