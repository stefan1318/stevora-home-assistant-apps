# STEVORA Manifest — experimental Home Assistant integration

**Not yet validated against a live Home Assistant version. Do not deploy to production.**

## Install on a test Home Assistant instance
Copy `custom_components/stevora_manifest` into `/config/custom_components/stevora_manifest`.
Add the following to `configuration.yaml` and restart Home Assistant:

```yaml
stevora_manifest:
```

From an authenticated **administrator** Home Assistant WebSocket session, send:

```json
{"id":1,"type":"stevora/manifest"}
```

Expected `result`: `schema_version: "1.0"`, `installation_id`, `revision`,
`preferred_language`, `rooms` (id/name), and `mappings` (area ID to entity IDs).

Only enabled registry entities with an explicit area assignment appear. Unassigned
entities are not listed. This endpoint does not return entity states, device capabilities,
services or permissions for non-admin users. Those must be discovered and authorized through
standard HA APIs. **Do not treat this as completed dynamic device control.**

## Validation checklist
- Integration imports and starts on supported HA Core versions.
- Admin socket gets schema 1.0; non-admin socket gets denied.
- Fresh HA without integration responds with unknown command; mobile apps stay in native HA mode.
- Different installations return different installation IDs and no shared entity mappings.
- Empty area registry returns valid empty rooms/mappings.
- Disconnect, account switch and stale revision do not leak another home's UI data.
- Actual mobile settings show STEVORA only after successful manifest validation.

## Limitations
- `revision` is a fixed initial value and must be replaced with change tracking before release.
- Room/entity discovery is registry-only and does not cover every HA entity.
- Install path is manual; the STEVORA Hub installer is not yet wired to this integration.
- No real-world functional or CI tests have passed yet.
