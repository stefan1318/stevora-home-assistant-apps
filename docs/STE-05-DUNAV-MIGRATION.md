# [STE-05] Home Assistant Dunav — controlled migration to STEVORA Universal Integration v1

Status: **planned / experimental, not approved for production**.

## Verified baseline (2026-11-18)
- HA Core 2026.11.2 / HA OS 18.5.
- `custom_components/stevora_manifest` detected by HA loader at 22:40 local time.
- Existing STEVORA memory integrations and scenes must remain intact.
- Android STEVORA Companion 2.1 has a native Connection & Ecosystem screen.
- No successful authenticated `stevora/manifest` response has yet been verified.

## Critical conflict
Both `custom_components/stevora_manifest/__init__.py` and
`custom_components/stevora/__init__.py` register **the same**
`stevora/manifest` WebSocket command. Do **not** enable both
integrations simultaneously. This may lead to duplicate-command errors or
ambiguous responses. The legacy `stevora_manifest:` YAML entry does not
create a config entry; absence from Settings > Integrations alone is not
proof of failure.

## Required gates before migration
1. Create and verify a full Home Assistant backup.
2. Verify the legacy command with an authenticated administrator WebSocket
   client. Record whether it returns a valid result, `unknown_command`,
   `unauthorized`, or a server error. Do not share access tokens.
3. In a **test HA instance**, remove the legacy YAML key
   `stevora_manifest:` and its folder; restart; confirm the old command is
   no longer registered.
4. Install `custom_components/stevora` in the test instance, restart,
   configure **STEVORA Ecosystem** through Settings > Devices & services.
5. Verify admin manifest schema 1.0, unique installation ID, room mappings,
   role denial for non-admin, unload/reload, and no leakage between homes.
6. Test Android native discovery and an independent HA instance; only then
   plan a backed-up migration for Dunav.

## Rollback
Restore the prior `configuration.yaml` and
`custom_components/stevora_manifest` from backup, remove the experimental
`custom_components/stevora` only if newly installed, then restart HA.
Never remove STEVORA Memory MCP, memory bridge, memory manager, scenes,
Bluetooth integrations or existing panels as part of this migration.

## Product release gates
Android: `com.stevora.companion`, version, STEVORA branding, upgrade signing.
iOS: STEVORA branding, physical-device IPA compatible with AltStore.
No Home Assistant-branded PR #1 integration artifacts are STEVORA products.
