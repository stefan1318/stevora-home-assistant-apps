# STEVORA client discovery — preview

## Native Home Assistant first
1. User enters their Home Assistant URL (HTTPS with a valid trusted certificate for remote use).
2. The iOS/Android client performs the official HA OAuth authorization code flow and stores tokens in OS secure storage.
3. Client opens an authenticated Home Assistant WebSocket connection.
4. Client queries `stevora/manifest` **only for administrator setup**; non-admin clients use native HA discovery with their existing permissions.
5. Use manifest room/entity mappings when available, otherwise native HA entity and area registries.
6. Never issue device commands while discovering. Users explicitly confirm device mappings.

### Example request
```json
{"id": 1, "type": "stevora/manifest"}
```

### Error behavior
- `unauthorized`: administrator access is required for full inventory.
- `not_configured`: use native HA discovery instead.
- Unknown command: integration not installed or not loaded; use native HA discovery.

## Current limitations
This branch does not ship the iOS/Android code, a frontend panel, per-user filtered manifest, configurable room mapping editor, or a full onboarding wizard. It is not a production release.
